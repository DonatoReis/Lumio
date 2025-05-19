import { useState, useEffect, useCallback, useRef, useReducer } from 'react';
import { supabase, safeQuery } from '@/integrations/supabase/client';
import { Database } from '@/types/supabase';
type ConversationRow = Database['public']['Views']['user_conversations']['Row'];
type ConversationPrefRow = Database['public']['Tables']['user_conversation_preferences']['Row'];
type MessageRow = Database['public']['Tables']['messages']['Row'];
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { normalizeEmail, isValidEmail } from '@/utils/email-validator';
import { MessageUpdateEvent } from '@/hooks/useMessages';
import { generateConversationId, createLocalConversationKey, isMatchingUserSets } from '@/utils/conversationUtils';
import isMatchingLocalConversation from '@/utils/conversationUtils';

// Add type definitions
type ConversationParticipant = Database['public']['Tables']['conversation_participants']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

// Define ConversationWithParticipants
interface ConversationWithParticipants extends ConversationRow {
  participants?: Profile[];
  preferences?: ConversationPrefRow | null;
  unread_count?: number;
  last_message?: MessageRow | null;
  is_temporary?: boolean; // Add is_temporary property
  deterministic_id?: string; // Add deterministic_id property
}
const DEBUG = false;

// Reconnection parameters
const INITIAL_DELAY = 5000; // 5 seconds
const MAX_DELAY = 120000; // 2 minutes
const BACKOFF_MULTIPLIER = 2;
const JITTER_RANGE = 1000; // +/- 1 second jitter
const MAX_RECONNECT_ATTEMPTS = 5;
const CIRCUIT_BREAKER_RESET_TIMEOUT = 60000; // 1 minute
const WEBSOCKET_PING_INTERVAL = 30000; // 30 seconds

// Circuit breaker states
type BreakerState = 'CLOSED' | 'HALF_OPEN' | 'OPEN';

// Circuit breaker reducer state
interface BreakerReducerState {
  breaker: BreakerState;
  failureCount: number;
  lastFailureTime: number | null;
}

// Circuit breaker actions
type BreakerAction =
  | { type: 'FAIL' }
  | { type: 'SUCCESS' }
  | { type: 'RESET' }
  | { type: 'HALF_OPEN' };

// Log throttling
const lastLogTime: Record<string, number> = {};

// Throttled logging function to reduce console verbosity
function throttledLog(key: string, message: string, level: 'log' | 'warn' | 'error' = 'log', minInterval = 60000) {
  const now = Date.now();
  if (!lastLogTime[key] || (now - lastLogTime[key] > minInterval)) {
    if (DEBUG || level !== 'log') {
      console[level](`[useConversations] ${message}`);
    }
    lastLogTime[key] = now;
    return true;
  }
  return false;
}

// Calculate backoff delay with jitter
function getBackoffDelay(attempt: number): number {
  const baseDelay = Math.min(INITIAL_DELAY * Math.pow(BACKOFF_MULTIPLIER, attempt), MAX_DELAY);
  const jitter = Math.random() * JITTER_RANGE * 2 - JITTER_RANGE; // +/- JITTER_RANGE
  return baseDelay + jitter;
}

// Circuit breaker reducer function
function breakerReducer(state: BreakerReducerState, action: BreakerAction): BreakerReducerState {
  switch (action.type) {
    case 'FAIL':
      const failures = state.failureCount + 1;
      if (failures >= MAX_RECONNECT_ATTEMPTS) {
        return { 
          breaker: 'OPEN', 
          failureCount: failures,
          lastFailureTime: Date.now()
        };
      }
      return { 
        ...state, 
        failureCount: failures,
        lastFailureTime: Date.now()
      };
    case 'SUCCESS':
      return { 
        breaker: 'CLOSED', 
        failureCount: 0,
        lastFailureTime: null
      };
    case 'HALF_OPEN':
      return { 
        breaker: 'HALF_OPEN', 
        failureCount: state.failureCount,
        lastFailureTime: null
      };
    case 'RESET':
      return { 
        breaker: 'CLOSED', 
        failureCount: 0,
        lastFailureTime: null
      };
    default:
      return state;
  }
}

// Define specific interfaces to replace 'any' types
interface ConversationParticipant {
  conversation_id: string;
  user_id: string;
  id?: string;
}

interface ConversationData {
  id: string;
  name: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: any; // For other properties
}

interface MessageData {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read?: boolean;
  [key: string]: any; // For other properties
}

// Support type for RPC functions that return strings
type RPCReturnType = string | number | boolean | object | null;

// Define a type for user conversation preferences
interface UserConversationPreference {
  id: string;
  user_id: string;
  conversation_id: string;
  is_muted: boolean;
  is_pinned: boolean;
  is_archived: boolean;
  is_deleted: boolean;
  messages_cleared_at?: string;
  created_at: string;
  updated_at: string;
}

// Type assertion helper functions to fix TS errors
function fromTable<T = any>(tableName: string) {
  return supabase.from(tableName as any) as any;
}

function callRPC<TResult = any, TParams extends Record<string, any> = {}>(
  functionName: string,
  params?: TParams
): Promise<{ data: TResult; error: any }> {
  return supabase.rpc(functionName as any, params) as any;
}

// Define public methods that will be available to external components
export interface ConversationsHook {
  conversations: ConversationWithParticipants[];
  loading: boolean;
  refreshConversations: () => Promise<void>;
  createConversation: (participantIds: string[]) => Promise<string | null>;
  deleteConversation: (conversationId: string) => Promise<boolean>;
  clearMessages: (conversationId: string) => Promise<boolean>;
  archiveConversation: (conversationId: string) => Promise<boolean>;
  muteConversation: (conversationId: string) => Promise<boolean>;
  pinConversation: (conversationId: string) => Promise<boolean>;
  findUserByEmail: (email: string) => Promise<{id: string, email: string} | null>;
  connectionStatus: 'OPEN' | 'CLOSED' | 'ERROR';
  
  // New method to handle message updates from useMessages
  handleMessageUpdate: (event: MessageUpdateEvent) => void;
}

export const useConversations = (): ConversationsHook => {
  const [conversations, setConversations] = useState<ConversationWithParticipants[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'OPEN' | 'CLOSED' | 'ERROR'>('CLOSED');
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Circuit breaker state
  const [{ breaker, failureCount, lastFailureTime }, dispatchBreaker] = useReducer(breakerReducer, {
    breaker: 'CLOSED',
    failureCount: 0,
    lastFailureTime: null
  });
  
  // Refs for cleanup
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const breakerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Refs for subscriptions
  const subscriptionsRef = useRef<Record<string, any>>({});

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Use safeQuery with arrow function properly
      const { data: conversationParticipants, error: participantsError } = await safeQuery<ConversationParticipant[]>(
        () => supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', user.id),
        'fetching conversation participants'
      );
          
      if (participantsError) {
        throw participantsError;
      }
      
      // Use optional chaining and nullish coalescing to safely handle data
      const participantsArray = conversationParticipants || [];
      if (participantsArray.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }
      
      const conversationIds = participantsArray.map(p => p.conversation_id);
      
      // Fetch user conversation preferences to filter out deleted conversations
      const { data: userPreferences, error: preferencesError } = await safeQuery<UserConversationPreference[]>(
        () => fromTable<UserConversationPreference>('user_conversation_preferences')
          .select('conversation_id, is_deleted')
          .eq('user_id', user.id)
          .in('conversation_id', conversationIds),
        'fetching user conversation preferences'
      );
      
      if (preferencesError) {
        console.error("Error fetching user preferences:", preferencesError);
        // Continue without preference filtering if there's an error
      }
      
      // Filter out deleted conversations
      let filteredConversationIds = conversationIds;
      if (userPreferences && userPreferences.length > 0) {

        // Create a map of conversation_id to deleted status for quick lookups
        const deletedMap = userPreferences.reduce((acc, pref) => {
          if (pref.is_deleted) {
            acc[pref.conversation_id] = true;
          }
          return acc;
        }, {} as Record<string, boolean>);
        
        // Filter out deleted conversations
        filteredConversationIds = conversationIds.filter(id => !deletedMap[id]);

      }
      
      if (filteredConversationIds.length === 0) {

        setConversations([]);
        setLoading(false);
        return;
      }
      
      // Use safeQuery with arrow function properly
      const { data: conversationsData, error: conversationsError } = await safeQuery<ConversationData[]>(
        () => supabase
          .from('conversations')
          .select('*')
          .in('id', filteredConversationIds)
          .order('updated_at', { ascending: false }),
        'fetching conversations'
      );
          
      if (conversationsError) {
        throw conversationsError;
      }
      
      // For each conversation, fetch participants and last message
      const conversationsDataArray = conversationsData || [];
      const conversationsWithDetails = await Promise.all(conversationsDataArray.map(async (conversation) => {
        try {
          // Use safeQuery with arrow function properly
          const { data: participants, error: participantsError } = await safeQuery<ConversationParticipant[]>(
            () => supabase
              .from('conversation_participants')
              .select('user_id')
              .eq('conversation_id', conversation.id),
            `fetching participants for conversation ${conversation.id}`
          );
              
          if (participantsError) {
            throw participantsError;
          }
          
          const participantsArray = participants || [];
          const participantIds = participantsArray.map(p => p.user_id);
          
          // Use safeQuery with arrow function properly
          const { data: profiles, error: profilesError } = await safeQuery<Profile[]>(
            () => supabase
              .from('profiles')
              .select('*')
              .in('id', participantIds),
            `fetching profiles for conversation ${conversation.id}`
          );
              
          if (profilesError) {
            throw profilesError;
          }
          
          // Use safeQuery with arrow function properly
          const { data: messages, error: messagesError } = await safeQuery<MessageData[]>(
            () => supabase
              .from('messages')
              .select('*')
              .eq('conversation_id', conversation.id)
              .order('created_at', { ascending: false })
              .limit(1),
            `fetching messages for conversation ${conversation.id}`
          );
              
          if (messagesError) {
            throw messagesError;
          }
          
          const profilesArray = profiles || [];
          const messagesArray = messages || [];
          
          return {
            ...conversation,
            participants: profilesArray,
            lastMessage: messagesArray.length > 0 ? messagesArray[0] : undefined,
          };
        } catch (err) {
          console.error(`Error processing conversation ${conversation.id}:`, err);
          // Return a basic conversation object if there was an error
          return {
            ...conversation,
            participants: [],
            lastMessage: undefined
          };
        }
      }));
      
      setConversations(conversationsWithDetails);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      const errorMessage = error instanceof Error ? error.message : "Could not load your conversations";
      toast({
        variant: "destructive",
        title: "Error loading conversations",
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  // Schedule reconnection with backoff
  const scheduleReconnect = useCallback(() => {
    // Clean up any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // Don't schedule reconnect if circuit breaker is OPEN
    if (breaker === 'OPEN') {
      throttledLog('breaker-open', 'Circuit breaker OPEN - not scheduling reconnect', 'warn');
      return;
    }
    
    // Allow one attempt if breaker is HALF_OPEN
    if (breaker === 'HALF_OPEN') {
      throttledLog('half-open-reconnect', 'Circuit breaker HALF_OPEN - making single reconnect attempt', 'log');
      fetchConversations();
      return;
    }
    
    // Calculate delay based on failure count
    const delay = getBackoffDelay(failureCount);
    
    throttledLog(
      'reconnect-scheduled',
      `Reconnect scheduled in ${(delay/1000).toFixed(1)}s (attempt ${failureCount + 1}/${MAX_RECONNECT_ATTEMPTS})`,
      'log'
    );
    
    // Schedule reconnect
    timeoutRef.current = setTimeout(() => {
      throttledLog('reconnect-executing', 'Executing scheduled reconnect', 'log');
      fetchConversations();
      timeoutRef.current = null;
    }, delay);
  }, [breaker, failureCount, fetchConversations]);
  
  // WebSocket ping function to keep connection alive
  // WebSocket ping function to keep connection alive
  const sendPing = useCallback(async () => {
    if (!supabase || breaker === 'OPEN') return;
    
    try {
      // Simple lightweight query instead of RPC
      await supabase.from('profiles').select('id').limit(1);
      throttledLog('ping-success', 'Ping succeeded', 'log', 180000); // Log success occasionally
    } catch (err) {
      throttledLog('ping-error', `Ping failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'warn');
      
      // If ping fails, treat it as a connection failure
      dispatchBreaker({ type: 'FAIL' });
      
      // Schedule reconnect
      scheduleReconnect();
    }
  }, [breaker, scheduleReconnect, dispatchBreaker]);
  
  // Handle connection status changes
  const handleConnectionStatus = useCallback((status: string, channel: string) => {
    throttledLog('connection-status', `${channel} subscription status: ${status}`, 'log');
    
    if (status === 'SUBSCRIBED') {
      throttledLog('subscription-success', `Successfully subscribed to ${channel}`, 'log');
      setConnectionStatus('OPEN');
      dispatchBreaker({ type: 'SUCCESS' });
    } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
      throttledLog('subscription-error', `Subscription to ${channel} error or closed: ${status}`, 'warn');
      setConnectionStatus('CLOSED');
      
      // Dispatch failure to circuit breaker
      dispatchBreaker({ type: 'FAIL' });
      
      // Schedule reconnect based on circuit breaker state
      scheduleReconnect();
    }
  }, [scheduleReconnect, dispatchBreaker]);

  // Page visibility change handler
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible' && 
        connectionStatus !== 'OPEN' && 
        breaker !== 'OPEN') {
      
      throttledLog(
        'visibility-reconnect',
        'Page became visible and connection is closed - attempting to reconnect',
        'log'
      );
      
      // Reset reconnect attempts when page becomes visible
      dispatchBreaker({ type: 'RESET' });
      
      // Fetch conversations
      fetchConversations();
    }
  }, [connectionStatus, breaker, fetchConversations, dispatchBreaker]);

  // Set up visibility change listener
  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleVisibilityChange]);

  // Set up ping to keep the connection alive
  useEffect(() => {
    // Only start the ping interval if the connection is OPEN and breaker is CLOSED
    if (connectionStatus === 'OPEN' && breaker === 'CLOSED') {
      pingIntervalRef.current = setInterval(sendPing, WEBSOCKET_PING_INTERVAL);
      
      throttledLog('ping-started', 'Started ping interval to keep connection alive', 'log');
    } else if (pingIntervalRef.current) {
      // Clear the interval if the connection is not open
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
      
      throttledLog('ping-stopped', 'Stopped ping interval due to connection state change', 'log');
    }
    
    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
    };
  }, [connectionStatus, breaker, sendPing]);

  // Reset circuit breaker from OPEN to HALF_OPEN after timeout
  useEffect(() => {
    if (breaker === 'OPEN' && lastFailureTime) {
      // Clear any existing timeout
      if (breakerTimeoutRef.current) {
        clearTimeout(breakerTimeoutRef.current);
      }
      
      // Set timeout to transition from OPEN to HALF_OPEN
      breakerTimeoutRef.current = setTimeout(() => {
        throttledLog('breaker-half-open', 'Circuit breaker transitioning from OPEN to HALF_OPEN', 'log');
        dispatchBreaker({ type: 'HALF_OPEN' });
        breakerTimeoutRef.current = null;
      }, CIRCUIT_BREAKER_RESET_TIMEOUT);
      
      return () => {
        if (breakerTimeoutRef.current) {
          clearTimeout(breakerTimeoutRef.current);
          breakerTimeoutRef.current = null;
        }
      };
    }
  }, [breaker, lastFailureTime, dispatchBreaker]);
  
  // Global subscription for catching first messages and new conversations
  // This is critical to fix the issue where first messages aren't noticed
  useEffect(() => {
    if (!user || !supabase || breaker === 'OPEN') return;
    

    
    try {
      // Create a channel for global events
      const globalChannel = supabase.channel('global-messaging-events');
      
      // Subscribe to new conversation participants involving current user
      globalChannel
        // Listen for new messages in ANY conversation
        .on('postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages'
          },
          async (payload) => {

            
            try {
              // Check if current user is a participant in this conversation
              const { data: participant, error: participantError } = await supabase
                .from('conversation_participants')
                .select('conversation_id')
                .eq('conversation_id', payload.new.conversation_id)
                .eq('user_id', user.id)
                .maybeSingle();
                
              if (participantError) {
                console.error("[useConversations] Error checking participant status:", participantError);
                return;
              }
              
              // If user is a participant, refresh conversations to update UI
              if (participant) {

                fetchConversations();
              }
            } catch (err) {
              console.error("[useConversations] Error processing global message event:", err);
            }
          }
        )
        // Listen for when user is added to a new conversation
        .on('postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'conversation_participants',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {

            
            // User was added to a conversation, refresh to show it
            fetchConversations();
          }
        )
        .subscribe((status) => {

          
          if (status === 'SUBSCRIBED') {

          } else if (status === 'CHANNEL_ERROR') {
            console.error("[useConversations] Global subscription error");
          }
        });
      
      // Store for cleanup
      subscriptionsRef.current['global-messaging-events'] = globalChannel;
      
      return () => {
        // Clean up subscription
        try {
          supabase.removeChannel(globalChannel);

        } catch (err) {
          console.error("[useConversations] Error removing global subscription:", err);
        }
      };
    } catch (error) {
      console.error("[useConversations] Error setting up global subscription:", error);
    }
  }, [user, supabase, breaker, fetchConversations]);
  
  // Subscribe to real-time updates for conversations and messages
  useEffect(() => {
    if (!user || !supabase || breaker === 'OPEN') return;
    
    try {
      // Get conversation IDs to listen for
      const conversationIds = conversations.map(c => c.id);
      if (conversationIds.length === 0) return;
      
      throttledLog('realtime-setup', 'Setting up real-time subscriptions for conversations and messages', 'log');
      
      // Create a channel for conversation updates
      const conversationsChannel = supabase.channel('conversations-updates');
      
      // Subscribe to conversation updates
      conversationsChannel
        .on('postgres_changes', 
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'conversations',
            filter: conversationIds.length > 0 ? `id=in.(${conversationIds.join(',')})` : undefined
          },
          (payload) => {
            throttledLog('conversation-update', `Received conversation update for: ${payload.new.id}`, 'log');
            
            // Find and update the conversation in state
            setConversations(prevConversations => {
              return prevConversations.map(conv => {
                if (conv.id === payload.new.id) {
                  // Preserve current conversation details but update with new data
                  return {
                    ...conv,
                    ...payload.new,
                    // Make sure these fields are maintained
                    participants: conv.participants,
                    last_message: payload.new.last_message || conv.last_message,
                    last_message_time: payload.new.last_message_time || conv.last_message_time
                  };
                }
                return conv;
              });
            });
          }
        )
        .subscribe((status) => {
          handleConnectionStatus(status, 'conversations-updates');
        });
        
      // Store the subscription for cleanup
      subscriptionsRef.current['conversations-updates'] = conversationsChannel;
      
      // Create a channel for message inserts
      const messagesChannel = supabase.channel('messages-inserts');
      
      // Subscribe to message inserts
      messagesChannel
        .on('postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: conversationIds.length > 0 ? `conversation_id=in.(${conversationIds.join(',')})` : undefined
          },
          async (payload) => {
            const newMessage = payload.new;
            throttledLog('message-insert', `Received new message for conversation: ${newMessage.conversation_id}`, 'log');
            
            try {
              // Get the sender details
              const { data: senderData, error: senderError } = await supabase
                .from('profiles')
                .select('id, email, first_name, last_name')
                .eq('id', newMessage.sender_id)
                .single();
                
              if (senderError) {
                throw senderError;
              }
              
              // Update unread count for this conversation if sender is not current user
              const shouldIncrementUnread = newMessage.sender_id !== user.id;
              
              // Update the conversation in the state
              setConversations(prevConversations => {
                return prevConversations.map(conv => {
                  if (conv.id === newMessage.conversation_id) {
                    // Preserve current conversation details but update with new message data
                    return {
                      ...conv,
                      lastMessage: newMessage,
                      last_message: newMessage.content,
                      last_message_time: newMessage.created_at,
                      // Increment unread count if sender is not current user
                      unread_count: shouldIncrementUnread ? (conv.unread_count || 0) + 1 : conv.unread_count
                    };
                  }
                  return conv;
                });
              });
              
              // If message is not from current user and message notification is enabled, show notification
              if (shouldIncrementUnread && document.visibilityState !== 'visible') {
                // Play notification sound or show toast
                toast({
                  title: "Nova mensagem",
                  description: `${senderData?.first_name || 'Alguém'}: ${newMessage.content.substring(0, 50)}${newMessage.content.length > 50 ? '...' : ''}`,
                });
                
                // If browser notifications are supported and permitted, show notification
                if ('Notification' in window && Notification.permission === 'granted') {
                  new Notification(`${senderData?.first_name || 'Nova mensagem'}`, {
                    body: newMessage.content.substring(0, 100),
                    icon: '/favicon.ico'
                  });
                }
              }
            } catch (error) {
              console.error('Error processing new message from realtime:', error);
            }
          }
        )
        .subscribe((status) => {
          handleConnectionStatus(status, 'messages-inserts');
        });
        
      // Store the subscription for cleanup
      subscriptionsRef.current['messages-inserts'] = messagesChannel;
      
      // Return cleanup function
      return () => {
        // Unsubscribe from all channels
        if (subscriptionsRef.current['conversations-updates']) {
          supabase.removeChannel(subscriptionsRef.current['conversations-updates']);
          delete subscriptionsRef.current['conversations-updates'];
        }
        
        if (subscriptionsRef.current['messages-inserts']) {
          supabase.removeChannel(subscriptionsRef.current['messages-inserts']);
          delete subscriptionsRef.current['messages-inserts'];
        }
      };
    } catch (error) {
      console.error('Error setting up real-time subscriptions:', error);
      toast({
        variant: "destructive",
        title: "Error with live updates",
        description: "Failed to set up live message updates. Some features may not work correctly."
      });
    }
  }, [user, conversations, breaker, handleConnectionStatus, toast]);

  // Set up a global conversation preferences listener to detect when other users
  // perform actions on conversations (delete, archive, etc.)
  useEffect(() => {
    if (!user || !supabase || breaker === 'OPEN') return;
    

    
    try {
      // Create a channel for conversation preferences updates
      const prefChannel = supabase.channel('global-conversation-prefs');
      
      // Subscribe to changes in user_conversation_preferences that might affect this user
      prefChannel
        .on('postgres_changes', 
          {
            event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'user_conversation_preferences'
          },
          (payload) => {

            
            // When any user's preferences change, we should refresh our conversations
            // to ensure we have the latest state
            fetchConversations();
          }
        )
        .subscribe((status) => {

        });
        
      // Store for cleanup
      subscriptionsRef.current['global-prefs'] = prefChannel;
      
      return () => {
        // Clean up subscription
        try {
          supabase.removeChannel(prefChannel);
        } catch (err) {
          console.error("Error removing global preferences channel:", err);
        }
      };
    } catch (err) {
      console.error("Error setting up global preferences subscription:", err);
    }
  }, [user, supabase, breaker, fetchConversations]);
  
  // Main effect for subscription setup and cleanup
  useEffect(() => {
    // Set up subscriptions
    if (user && supabase && breaker !== 'OPEN') {
      fetchConversations();
    }
    
    // Cleanup function
    return () => {
      // Clean up all timeouts and intervals
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      
      if (breakerTimeoutRef.current) {
        clearTimeout(breakerTimeoutRef.current);
        breakerTimeoutRef.current = null;
      }
      
      // Unsubscribe from all subscriptions
      Object.values(subscriptionsRef.current).forEach(subscription => {
        if (subscription && typeof subscription.unsubscribe === 'function') {
          subscription.unsubscribe();
        }
      });
      
      // Clear subscriptions object
      subscriptionsRef.current = {};
    };
  }, [user, breaker, fetchConversations]);

  // Improved findUserByEmail function with direct database query
  const findUserByEmail = async (email: string): Promise<{id: string, email: string} | null> => {
    // Usar o utilitário centralizado para validação e normalização
    if (!email || !isValidEmail(email)) {
      toast({
        variant: "destructive",
        title: "Email inválido",
        description: "Por favor, forneça um email válido e completo",
      });
      return null;
    }
    
    try {
      // Normalizar o email para garantir consistência
      const normalizedEmail = normalizeEmail(email);

      
      // Buscar diretamente da tabela profiles com email normalizado
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', normalizedEmail)
        .limit(1);
      
      if (error) {
        console.error("Erro ao buscar perfil:", error);
        throw error;
      }
      

      
      if (profiles && profiles.length > 0) {

        
        // Garantir que não estamos retornando um falso positivo
        const foundEmail = profiles[0].email;
        const inputNormalized = normalizeEmail(email);
        const foundNormalized = normalizeEmail(foundEmail);
        
        if (foundNormalized !== inputNormalized) {
          console.warn(`Inconsistência na normalização: input=${inputNormalized}, found=${foundNormalized}`);
          
          toast({
            variant: "destructive",
            title: "Correspondência inexata",
            description: `O email "${profiles[0].email}" foi encontrado, mas você digitou "${email}"`,
          });
        }
        
        return {
          id: profiles[0].id,
          email: profiles[0].email
        };
      }
      
      // Se não encontrar nada, tentar uma busca mais ampla com ilike (apenas para diagnóstico)

      const { data: likeProfiles, error: likeError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', `%${email.split('@')[1]}%`) // Apenas para encontrar domínios similares
        .limit(5);
      
      if (!likeError && likeProfiles && likeProfiles.length > 0) {
        console.log("Domínios similares encontrados (apenas para diagnóstico):", 
          likeProfiles.map(p => p.email));
      }
      

      toast({
        variant: "destructive",
        title: "Usuário não encontrado",
        description: "Não foi possível encontrar um usuário com esse email exato",
      });
      return null;
      
    } catch (err) {
      console.error('Exceção ao buscar usuário por email:', err);
      toast({
        variant: "destructive",
        title: "Erro ao buscar usuário",
        description: "Ocorreu um erro ao buscar o usuário. Tente novamente."
      });
      return null;
    }
  };

  /**
   * Creates a conversation with deterministic ID or returns existing one
   * Important: This function doesn't actually create a conversation in the database until 
   * the first message is sent. It returns a temporary local ID for the UI.
   * 
   * @param participantIds Array of participant user IDs (excluding current user)
   * @returns A conversation ID (either existing or temporary)
   */
  const createConversation = async (participantIds: string[]) => {
    try {
      if (!user) throw new Error("User not authenticated");
      

      
      // Make sure the current user is included in the participants for ID generation
      const allParticipants = [...new Set([user.id, ...participantIds])];
      
      // First, check if a conversation already exists with these exact participants
      // This prevents duplicate conversations between the same users
      if (participantIds.length === 1) {
        const otherParticipantId = participantIds[0];
        

        
        // Generate the deterministic conversation ID
        const determinisitcId = await generateConversationId(allParticipants);

        
        // Check if this conversation already exists in the database
        const { data: existingConversation, error: conversationError } = await safeQuery(
          () => supabase
            .from('conversations')
            .select('id')
            .eq('id', determinisitcId)
            .maybeSingle(),
            'checking for existing conversation by ID'
        );
        
        if (!conversationError && existingConversation) {

          // Check if it's deleted for the current user
          const { data: userPrefs, error: prefsError } = await safeQuery<any>(
            () => supabase
              .from('user_conversation_preferences')
              .select('is_deleted')
              .eq('user_id', user.id)
              .eq('conversation_id', (existingConversation as any).id)
              .maybeSingle(),
            'checking conversation preferences'
          );
          
          // If deleted, undelete it
          if (!prefsError && userPrefs && (prefsError as any).is_deleted) {

            
            await safeQuery(() => supabase
              .from('user_conversation_preferences')
              .update({ is_deleted: false })
              .eq('user_id', user.id)
              .eq('conversation_id', (existingConversation as any).id),
              'undeleting conversation'
            );
          }
          
          // Return the existing conversation ID
          await fetchConversations();
          return (existingConversation as any).id;
        }
        
        // If we didn't find a conversation with the deterministic ID,
        // If we didn't find a conversation with the deterministic ID,
        // let's do a traditional search through participants
        // This is for backward compatibility with existing conversations
        const { data: userConversations, error: userConvError } = await safeQuery(
          () => supabase
            .from('conversation_participants')
            .select('conversation_id')
            .eq('user_id', user.id),
          'fetching user conversations'
        );
        
        if (!userConvError && userConversations && userConversations.length > 0) {
          // Get all conversation IDs where current user is a participant
          const conversationIds = userConversations.map(c => c.conversation_id);
          
          // Find conversations where the other user is also a participant
          const { data: sharedConversations, error: sharedConvError } = await safeQuery(
            () => supabase
              .from('conversation_participants')
              .select('conversation_id')
              .eq('user_id', otherParticipantId)
              .in('conversation_id', conversationIds),
            'finding shared conversations'
          );
          
          if (!sharedConvError && sharedConversations && sharedConversations.length > 0) {
            // We found existing conversations - check if any are not marked as deleted
            for (const shared of sharedConversations) {
              // Check if the conversation is marked as deleted for the current user
              const { data: userPrefs, error: prefsError } = await safeQuery(
                () => supabase
                  .from('user_conversation_preferences')
                  .select('is_deleted')
                  .eq('user_id', user.id)
                  .eq('conversation_id', shared.conversation_id)
                  .maybeSingle(),
                'checking user preferences'
              );
              
              // If no preferences exist or conversation is not marked as deleted, we can reuse it
              if ((!prefsError && !userPrefs) || (!prefsError && userPrefs && !userPrefs.is_deleted)) {

                
                // Refresh conversation list to ensure it's up to date
                await fetchConversations();
                
                // Return the existing conversation ID
                return shared.conversation_id;
              }
            }
          }
        }
        
        // No existing conversation found that's not deleted
        // Return a temporary ID for UI purposes
        // This will be replaced by the deterministic ID when the first message is sent

        const tempId = createLocalConversationKey(allParticipants);
        
        // Remember the deterministic ID that will be used when the conversation is created
        // Add a temporary conversation object to the state for UI purposes
        const otherUser = await getProfileById(otherParticipantId);
        if (otherUser) {
          const tempConversation: ConversationWithParticipants = {
            id: tempId,
            name: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_message: null,
            last_message_time: null,
            participants: [otherUser],
            unread_count: 0,
            is_temporary: true, // Flag to indicate this is not yet in the database
            deterministic_id: determinisitcId // Store the ID that will be used when created
          };
          
          // Add to local state
          setConversations(prev => [tempConversation, ...prev]);
        }
        
        return tempId;
      }
      
      // For multiple participants or group chats
      // Just return a temporary ID for now

      const tempId = createLocalConversationKey(allParticipants);
      return tempId;
    } catch (error) {
      console.error('[useConversations] Error creating conversation:', error);
      const errorMessage = error instanceof Error ? error.message : "Não foi possível criar a conversa";
      toast({
        variant: "destructive",
        title: "Erro ao criar conversa",
        description: errorMessage,
      });
      return null;
    }
  };

  /**
   * Get a user profile by ID
   * @param userId User ID to fetch profile for
   * @returns User profile or null if not found
   */
  const getProfileById = async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await safeQuery(
        () => supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single(),
        'fetching user profile'
      );
      
      if (error || !data) {
        console.error('[useConversations] Error fetching profile:', error);
        return null;
      }
      
      return data as Profile;
    } catch (error) {
      console.error('[useConversations] Error in getProfileById:', error);
      return null;
    }
  };

  /**
   * Creates or retrieves a conversation with the given participants
   */

  // Função para marcar uma conversa como excluída para o usuário atual
  const deleteConversation = async (conversationId: string) => {
    if (!conversationId || !user) {
      console.error(`[useConversations] Cannot delete conversation: ${!conversationId ? 'missing conversationId' : 'user not authenticated'}`);
      return false;
    }
    
    try {

      
      // 1. Atualizar o estado local imediatamente (update otimista)
      setConversations(prevConversations => 
        prevConversations.filter(conv => conv.id !== conversationId)
      );
      
      // 2. Chamar a função SQL que marca a conversa como excluída só para este usuário

      
      // Check if the RPC function exists first
      try {
        // Log the conversationId to ensure it has the expected format


        
        // Alternative implementation using direct table operations if the RPC fails
        const { data, error } = await callRPC<boolean>('mark_conversation_deleted', {
            p_conversation_id: conversationId,
          });
          
        if (error) {
          console.error("[useConversations] RPC Error marking conversation as deleted:", error);
          
          // Fallback to direct table operations if RPC function doesn't exist

          
          // First check if preference already exists
          const { data: existingPrefs, error: prefsError } = await fromTable<UserConversationPreference>('user_conversation_preferences')
            .select('*')
            .eq('user_id', user.id)
            .eq('conversation_id', conversationId)
            .maybeSingle();
            
          if (prefsError) {
            console.error("[useConversations] Error checking existing preferences:", prefsError);
            throw prefsError;
          }
          
          if (existingPrefs) {
            // Update existing preference

            const { error: updateError } = await fromTable<UserConversationPreference>('user_conversation_preferences')
              .update({ 
                is_deleted: true,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingPrefs && 'id' in existingPrefs ? existingPrefs.id : '');
              
            if (updateError) {
              console.error("[useConversations] Error updating preference:", updateError);
              throw updateError;
            }
          } else {
            // Create new preference

            const { error: insertError } = await fromTable<UserConversationPreference>('user_conversation_preferences')
              .insert({ 
                user_id: user.id, 
                conversation_id: conversationId, 
                is_deleted: true,
                is_muted: false,
                is_pinned: false,
                is_archived: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              } as Database['public']['Tables']['user_conversation_preferences']['Insert']);
              
            if (insertError) {
              console.error("[useConversations] Error inserting preference:", insertError);
              throw insertError;
            }
          }
        } else {

        }
      } catch (rpcError) {
        console.error("[useConversations] Exception during RPC or fallback:", rpcError);
        // Reverter a atualização otimista em caso de erro
        fetchConversations(); // Restaurar estado original
        throw rpcError;
      }
      
      // 3. Sucesso - não precisamos refetch total pois já atualizamos otimisticamente

      
      return true;
    } catch (error) {
      console.error('Erro ao excluir conversa:', error);
      const errorMessage = error instanceof Error ? error.message : "Não foi possível excluir a conversa";
      toast({
        variant: "destructive",
        title: "Erro ao excluir conversa",
        description: errorMessage,
      });
      return false;
    }
  };

  // Função para marcar as mensagens de uma conversa como limpas para o usuário atual
  const clearMessages = async (conversationId: string) => {
    if (!conversationId || !user) return false;
    
    try {

      
      // 1. Atualizar o estado local imediatamente (update otimista)
      setConversations(prevConversations => 
        prevConversations.map(conv => {
          if (conv.id === conversationId) {
            return {
              ...conv,
              last_message: null,
              last_message_time: null,
              lastMessage: undefined
            };
          }
          return conv;
        })
      );
      
      // 2. Chamar a função SQL que marca as mensagens como limpas só para este usuário

      
      // Check if the RPC function exists first
      try {
        // Log the conversation ID to ensure it has the expected format


        
        // Call the RPC function to mark messages as cleared
        const { data, error } = await callRPC<boolean>('mark_messages_cleared', {
            p_conversation_id: conversationId
          });
          
        if (error) {
          console.error("[useConversations] RPC Error marking messages as cleared:", error);
          
          // Fallback to direct table operations if RPC function doesn't exist

          
          const currentTimestamp = new Date().toISOString();
          
          // First check if preference already exists
          const { data: existingPrefs, error: prefsError } = await fromTable<UserConversationPreference>('user_conversation_preferences')
            .select('*')
            .eq('user_id', user.id)
            .eq('conversation_id', conversationId)
            .maybeSingle();
            
          if (prefsError) {
            console.error("[useConversations] Error checking existing preferences:", prefsError);
            throw prefsError;
          }
          
          if (existingPrefs) {
            // Update existing preference

            const { error: updateError } = await fromTable<UserConversationPreference>('user_conversation_preferences')
              .update({ 
                messages_cleared_at: currentTimestamp,
                updated_at: currentTimestamp
              })
              .eq('id', existingPrefs && 'id' in existingPrefs ? existingPrefs.id : '');
              
            if (updateError) {
              console.error("[useConversations] Error updating preference:", updateError);
              throw updateError;
            }
          } else {
            // Create new preference

            // Create preference data object
            const preferenceData: Database['public']['Tables']['user_conversation_preferences']['Insert'] = {
                user_id: user.id,
                conversation_id: conversationId,
                messages_cleared_at: currentTimestamp,
                is_muted: false,
                is_pinned: false,
                is_archived: false,
                is_deleted: false,
                created_at: currentTimestamp,
                updated_at: currentTimestamp
            };
            
            const { error: insertError } = await fromTable<UserConversationPreference>('user_conversation_preferences')
              .insert(preferenceData);
              
            if (insertError) {
              console.error("[useConversations] Error inserting preference:", insertError);
              throw insertError;
            }
          }
        } else {

        }
      } catch (rpcError) {
        console.error("[useConversations] Exception during RPC or fallback:", rpcError);
        // Reverter a atualização otimista em caso de erro
        fetchConversations(); // Restaurar estado original
        throw rpcError;
      }
      
      // 3. Sucesso - não precisamos refetch total pois já atualizamos otimisticamente

      
      return true;
    } catch (error) {
      console.error('Erro ao limpar mensagens:', error);
      const errorMessage = error instanceof Error ? error.message : "Não foi possível limpar as mensagens";
      toast({
        variant: "destructive",
        title: "Erro ao limpar mensagens",
        description: errorMessage,
      });
      return false;
    }
  };

  // Função para arquivar uma conversa só para o usuário atual
  const archiveConversation = async (conversationId: string) => {
    if (!conversationId || !user) return false;
    
    try {

      
      // 1. Atualizar o estado local imediatamente (update otimista)
      setConversations(prevConversations => 
        prevConversations.map(conv => {
          if (conv.id === conversationId) {
            return {
              ...conv,
              is_archived: true
            };
          }
          return conv;
        })
      );
      
      // 2. Chamar a função SQL que arquiva a conversa só para este usuário

      
      // Check if the RPC function exists first
      try {
        // Alternative implementation using direct table operations if the RPC fails
        const { data, error } = await callRPC<boolean>('set_conversation_archived', {
            p_conversation_id: conversationId,
            p_is_archived: true
          });
          
        if (error) {
          console.error("[useConversations] RPC Error archiving conversation:", error);
          
          // Fallback to direct table operations if RPC function doesn't exist

          
          // First check if preference already exists
          const { data: existingPrefs, error: prefsError } = await fromTable<UserConversationPreference>('user_conversation_preferences')
            .select('*')
            .eq('user_id', user.id)
            .eq('conversation_id', conversationId)
            .maybeSingle();
            
          if (prefsError) {
            console.error("[useConversations] Error checking existing preferences:", prefsError);
            throw prefsError;
          }
          
          if (existingPrefs) {
            // Update existing preference

            const { error: updateError } = await fromTable<UserConversationPreference>('user_conversation_preferences')
              .update({ 
                is_archived: true,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingPrefs && 'id' in existingPrefs ? existingPrefs.id : '');
              
            if (updateError) {
              console.error("[useConversations] Error updating preference:", updateError);
              throw updateError;
            }
          } else {
            // Create new preference

// Use Database type to define the insert structure
const preferenceData: Database['public']['Tables']['user_conversation_preferences']['Insert'] = {
                user_id: user.id, 
                conversation_id: conversationId, 
                is_archived: true,
                is_muted: false,
                is_pinned: false,
                is_deleted: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
              
const { error: insertError } = await fromTable<UserConversationPreference>('user_conversation_preferences')
              .insert(preferenceData);
              
            if (insertError) {
              console.error("[useConversations] Error inserting preference:", insertError);
              throw insertError;
            }
          }
        } else {

        }
      } catch (rpcError) {
        console.error("[useConversations] Exception during RPC or fallback:", rpcError);
        // Reverter a atualização otimista em caso de erro
        fetchConversations(); // Restaurar estado original
        throw rpcError;
      }
      
      // 3. Não precisamos refetch total pois já atualizamos otimisticamente

      
      return true;
    } catch (error) {
      console.error('Erro ao arquivar conversa:', error);
      const errorMessage = error instanceof Error ? error.message : "Não foi possível arquivar a conversa";
      toast({
        variant: "destructive",
        title: "Erro ao arquivar conversa",
        description: errorMessage,
      });
      return false;
    }
  };

  // Função para silenciar uma conversa só para o usuário atual
  const muteConversation = async (conversationId: string) => {
    if (!conversationId || !user) return false;
    
    try {

      
      // 1. Atualizar o estado local imediatamente (update otimista)
      setConversations(prevConversations => 
        prevConversations.map(conv => {
          if (conv.id === conversationId) {
            return {
              ...conv,
              is_muted: true
            };
          }
          return conv;
        })
      );
      
      // 2. Chamar a função SQL que silencia a conversa só para este usuário
      const { data, error } = await callRPC<boolean>('set_conversation_muted', {
          p_conversation_id: conversationId,
          p_is_muted: true
        });
        
      if (error) {
        // Reverter a atualização otimista em caso de erro
        console.error("[useConversations] Error muting conversation:", error);
        fetchConversations(); // Restaurar estado original
        throw error;
      }
      
      // 3. Não precisamos refetch total pois já atualizamos otimisticamente

      
      return true;
    } catch (error) {
      console.error('Erro ao silenciar conversa:', error);
      const errorMessage = error instanceof Error ? error.message : "Não foi possível silenciar a conversa";
      toast({
        variant: "destructive",
        title: "Erro ao silenciar conversa",
        description: errorMessage,
      });
      return false;
    }
  };

  // Função para fixar uma conversa só para o usuário atual
  const pinConversation = async (conversationId: string) => {
    if (!conversationId || !user) return false;
    
    try {

      
      // 1. Atualizar o estado local imediatamente (update otimista)
      setConversations(prevConversations => 
        prevConversations.map(conv => {
          if (conv.id === conversationId) {
            return {
              ...conv,
              is_pinned: true
            };
          }
          return conv;
        })
      );
      
      // 2. Chamar a função SQL que fixa a conversa só para este usuário
      const { data, error } = await callRPC<boolean>('set_conversation_pinned', {
          p_conversation_id: conversationId,
          p_is_pinned: true
        });
        
      if (error) {
        // Reverter a atualização otimista em caso de erro
        console.error("[useConversations] Error pinning conversation:", error);
        fetchConversations(); // Restaurar estado original
        throw error;
      }
      
      // 3. Não precisamos refetch total pois já atualizamos otimisticamente

      
      return true;
    } catch (error) {
      console.error('Erro ao fixar conversa:', error);
      const errorMessage = error instanceof Error ? error.message : "Não foi possível fixar a conversa";
      toast({
        variant: "destructive",
        title: "Erro ao fixar conversa",
        description: errorMessage,
      });
      return false;
    }
  };

  // Function to request notification permission if not already granted
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      try {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      } catch (error) {
        console.error('Error requesting notification permission:', error);
        return false;
      }
    }
    return Notification.permission === 'granted';
  }, []);
  
  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, [requestNotificationPermission]);

  // Supabase Realtime subscription for message events
  useEffect(() => {
    const channel = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const newMessage = payload.new;
        setConversations(prev =>
          prev.map(conv =>
            conv.id === newMessage.conversation_id
              ? {
                  ...conv,
                  last_message: newMessage.content,
                  last_message_time: newMessage.created_at,
                  unread_count: (conv.unread_count || 0) + 1,
                }
              : conv
          )
        );
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        const updated = payload.new;
        if (updated.read) {
          setConversations(prev =>
            prev.map(conv =>
              conv.id === updated.conversation_id
                ? {
                    ...conv,
                    unread_count: Math.max((conv.unread_count || 1) - 1, 0),
                  }
                : conv
            )
          );
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, () => {
        // On message delete, refresh all conversations to update previews
        fetchConversations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchConversations]);

// Add a new method to handle message updates from useMessages hook
const handleMessageUpdate = useCallback((event: MessageUpdateEvent) => {
  const { type, message, conversationId } = event;

  
  // Skip processing if no valid message for insert or update events
  if ((type === 'message_insert' || type === 'message_update') && !message) {
    console.warn('[useConversations] Received insert/update event without valid message data');
    return;
  }
  
  // Handle the different event types
  switch (type) {
    case 'message_insert': {
      // Find the conversation that this message belongs to
      setConversations(prevConversations => {
        return prevConversations.map(conv => {
          if (conv.id === conversationId) {
            // Only update unread count if sender is not current user
            const isFromCurrentUser = message?.sender_id === user?.id;
            const newUnreadCount = isFromCurrentUser ? 
              conv.unread_count || 0 : 
              (conv.unread_count || 0) + 1;
            
            // Create an updated conversation with the new message
            const updatedConv = {
              ...conv,
              lastMessage: message,
              last_message: message?.content || conv.last_message,
              last_message_time: message?.created_at || conv.last_message_time,
              unread_count: newUnreadCount
            };
            
            return updatedConv;
          }
          return conv;
        }).sort((a, b) => {
          // Move conversation with new message to the top
          if (a.id === conversationId) return -1;
          if (b.id === conversationId) return 1;
          
          // Otherwise sort by last_message_time
          const timeA = a.last_message_time ? new Date(a.last_message_time).getTime() : 0;
          const timeB = b.last_message_time ? new Date(b.last_message_time).getTime() : 0;
          return timeB - timeA;
        });
      });
      break;
    }
    
    case 'message_update': {
      // Handle read status updates which affect unread count
      if (message && message.read) {
        setConversations(prevConversations => {
          return prevConversations.map(conv => {
            if (conv.id === conversationId) {
              // Decrement unread count if message was marked as read
              // and it wasn't sent by the current user
              if (message.sender_id !== user?.id && conv.unread_count && conv.unread_count > 0) {
                return {
                  ...conv,
                  unread_count: conv.unread_count - 1
                };
              }
            }
            return conv;
          });
        });
      }
      break;
    }
    
    case 'message_delete': {
      // Handle message deletion
      // For now, we'll just refresh the conversation data
      // In a more sophisticated implementation, we would update
      // the lastMessage if the deleted message was the last one
      if (conversationId) {
        fetchConversations().catch(err => {
          console.error('[useConversations] Error refreshing conversations after message delete:', err);
        });
      }
      break;
    }
    
    default:
      console.warn(`[useConversations] Unhandled message update event type: ${type}`);
  }
}, [user, fetchConversations]);

return { 
  conversations, 
  loading, 
  createConversation,
  deleteConversation,
  clearMessages,
  archiveConversation,
  muteConversation,
  pinConversation,
  refreshConversations: fetchConversations,
  findUserByEmail,
  connectionStatus,
  handleMessageUpdate
};
};
