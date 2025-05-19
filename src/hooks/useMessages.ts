
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, throttledSafeQuery, optimizeRealtimeSubscription } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MessageWithSender, ConversationWithParticipants } from '@/types/supabase';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { debounce } from 'lodash';
import { generateConversationId, createLocalConversationKey, isMatchingLocalConversation } from '@/utils/conversationUtils';

// Define an event type for message updates
export type MessageUpdateEvent = {
  type: 'message_insert' | 'message_update' | 'message_delete' | 'conversation_created';
  message: MessageWithSender | null;
  conversationId: string;
  previousId?: string; // Used when a temporary conversation becomes a real one
};

// Define a callback type for message updates
export type MessageUpdateCallback = (event: MessageUpdateEvent) => void;

export const useMessages = (
  conversationId: string, 
  onMessageUpdate?: MessageUpdateCallback
) => {
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'reconnecting' | 'error'>('connecting');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Use refs to track active channel and prevent stale closures in cleanup
  const channelRef = useRef<any>(null);
  const subscriptionRef = useRef<any>(null);
  const stableChannelId = useRef<string>(`messages-${conversationId}-stable`);
  const isInitialFetch = useRef<boolean>(true);
  const reconnectTimeoutRef = useRef<any>(null);
  const hasCleanedUp = useRef<boolean>(false);

  // Stable fetch messages function that won't change on re-renders
  const fetchMessages = useCallback(async () => {
    if (!conversationId || !user) return;
    
    // Ensure we're working with a valid UUID
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(conversationId);
    
    if (!isValidUUID) {
      console.error('Invalid conversation ID format, must be a UUID:', conversationId);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      // Use throttled query to prevent ERR_INSUFFICIENT_RESOURCES
      const { data, error } = await throttledSafeQuery<any[]>(
        () => supabase
          .from('messages')
          .select(`
            id,
            sender_id,
            conversation_id,
            content,
            encrypted_content,
            is_encrypted,
            created_at,
            read,
            sender:profiles!sender_id(id, email, first_name, last_name, updated_at)
          `)
          .eq('conversation_id', conversationId)
          .order('created_at'),
        'fetching messages'
      );
      
      if (error) {
        throw error;
      }
      
      // Ensure all fetched messages conform to the MessageWithSender type
      const typedMessages = data?.map(msg => ({
        ...msg,
        read: msg.read ?? false,
        sender: {
          ...msg.sender,
          id: msg.sender.id ?? '',
          email: msg.sender.email ?? '',
          first_name: msg.sender.first_name ?? null,
          last_name: msg.sender.last_name ?? null,
          updated_at: msg.sender.updated_at ?? ''
        }
      })) as MessageWithSender[];
      
      setMessages(typedMessages || []);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast({
        variant: "destructive",
        title: "Error loading messages",
        description: "Could not load messages for this conversation",
      });
    } finally {
      setLoading(false);
      isInitialFetch.current = false;
    }
  }, [conversationId, user, toast]);

  // Handler for new message inserts through realtime
  const handleInsert = useCallback(async (payload: any) => {
    console.log("Received new message via realtime:", payload);
    try {
      // Fetch sender details
      if (payload.new) {
        const { data: senderData, error: senderError } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name, updated_at')
          .eq('id', payload.new.sender_id)
          .single();
          
        if (senderError) {
          console.error("Error fetching sender data:", senderError);
          return;
        }

        const newMessage: MessageWithSender = {
          ...(payload.new as any),
          read: (payload.new as any).read ?? false,
          sender: {
            id: senderData?.id ?? '',
            email: senderData?.email ?? '',
            first_name: senderData?.first_name ?? null,
            last_name: senderData?.last_name ?? null,
            updated_at: senderData?.updated_at ?? ''
          }
        };
        
        // Ensure we don't add duplicate messages
        setMessages(prevMessages => {
          // Check if the message already exists
          const exists = prevMessages.some(msg => msg.id === newMessage.id);
          if (exists) {
            return prevMessages;
          }
          return [...prevMessages, newMessage];
        });
        
        // Notify parent components about the new message
        if (onMessageUpdate) {
          onMessageUpdate({
            type: 'message_insert',
            message: newMessage,
            conversationId: newMessage.conversation_id
          });
        }
      }
    } catch (error) {
      console.error("Error processing new message:", error);
    }
  }, [onMessageUpdate]);

  // Handler for message updates through realtime
  const handleUpdate = useCallback((payload: any) => {
    console.log("Message updated via realtime:", payload);
    try {
      if (payload.new) {
        // Find the message to be updated
        let updatedMessage: MessageWithSender | null = null;
        
        // Update the message in the local state
        setMessages(prevMessages => {
          const newMessages = prevMessages.map(msg => {
            if (msg.id === payload.new.id) {
              // Store the updated message for emitting events
              updatedMessage = { 
                ...msg, 
                ...payload.new, 
                read: payload.new.read ?? msg.read 
              };
              return updatedMessage;
            }
            return msg;
          });
          return newMessages;
        });
        
        // Notify parent components about the updated message
        if (updatedMessage && onMessageUpdate) {
          onMessageUpdate({
            type: 'message_update',
            message: updatedMessage,
            conversationId: updatedMessage.conversation_id
          });
        }
      }
    } catch (error) {
      console.error("Error processing message update:", error);
    }
  }, [onMessageUpdate]);

  // Handler for message deletions through realtime
  const handleDelete = useCallback((payload: any) => {
    console.log("Message deleted via realtime:", payload);
    try {
      if (payload.old) {
        // Get the conversation ID before removing the message
        const conversationId = payload.old.conversation_id;
        
        // Find the message before removing it
        let deletedMessage: MessageWithSender | null = null;
        
        setMessages(prevMessages => {
          // Find the message to be deleted
          deletedMessage = prevMessages.find(msg => msg.id === payload.old.id) || null;
          
          // Remove the message from the local state
          return prevMessages.filter(msg => msg.id !== payload.old.id);
        });
        
        // Notify parent components about the deleted message
        if (onMessageUpdate) {
          onMessageUpdate({
            type: 'message_delete',
            message: deletedMessage,
            conversationId: conversationId
          });
        }
      }
    } catch (error) {
      console.error("Error processing message deletion:", error);
    }
  }, [onMessageUpdate]);

  // Setup subscription to fetch messages when conversation changes
  useEffect(() => {
    if (isInitialFetch.current && conversationId && user) {
      fetchMessages();
    }
  }, [conversationId, user, fetchMessages]);
  
  // Helper function to safely clean up the subscription
  const cleanupSubscription = useCallback(() => {
    if (channelRef.current) {
      try {
        console.log(`Cleaning up existing channel for ${conversationId}`);
        supabase.removeChannel(channelRef.current);
      } catch (cleanupError) {
        console.error(`Error cleaning up existing channel for ${conversationId}`, cleanupError);
      }
      channelRef.current = null;
      subscriptionRef.current = null;
    }
  }, [conversationId]);
  
  // Setup realtime subscription with cleanup
  useEffect(() => {
    if (!conversationId || !user || !supabase) return;
    
    // Clear any existing timeout to prevent memory leaks
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    hasCleanedUp.current = false;
    setConnectionState('connecting');
    
    // Create a stable channel name that won't change across component remounts
    const channelName = stableChannelId.current;
    
    console.log(`Setting up new channel: ${channelName}`);

    try {
      // Clean up any existing channel before creating a new one
      if (channelRef.current && subscriptionRef.current) {
        try {
          console.log(`Cleaning up existing channel: ${channelName}`);
          supabase.removeChannel(channelRef.current);
        } catch (cleanupError) {
          console.error(`Error cleaning up existing channel: ${channelName}`, cleanupError);
        }
      }
      
      // Create a new channel
      const channel = supabase.channel(channelName);
      
      // Configure channel with event handlers
      channel
        .on('postgres_changes', 
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`
          }, 
          handleInsert
        )
        .on('postgres_changes', 
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`
          }, 
          handleUpdate
        )
        .on('postgres_changes', 
          {
            event: 'DELETE',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`
          }, 
          handleDelete
        );

      // Store the channel in ref for cleanup
      channelRef.current = channel;
      
      // Subscribe to the channel
      const subscription = channel.subscribe((status) => {
        console.log(`Subscription to ${channelName} status:`, status);
        
        if (status === 'SUBSCRIBED') {
          console.log(`Successfully subscribed to messages for conversation: ${conversationId}`);
          setConnectionState('connected');
          setReconnectAttempts(0); // Reset reconnect attempts counter
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`Channel error for ${channelName}`);
          setConnectionState('error');
          
          // Only attempt reconnect if we haven't cleaned up
          if (!hasCleanedUp.current) {
            handleReconnection();
          }
        } else if (status === 'CLOSED' && !hasCleanedUp.current) {
          // Only handle closed if it wasn't intentional (via cleanup)
          console.warn(`Channel ${channelName} was closed unexpectedly`);
          setConnectionState('reconnecting');
          handleReconnection();
        }
      });
      
      // Store subscription in ref for cleanup
      subscriptionRef.current = subscription;
      
      console.log(`Created channel for ${channelName}`);
    } catch (error) {
      console.error(`Error setting up realtime for ${conversationId}:`, error);
      setConnectionState('error');
    }
    
    // Reconnection handler with exponential backoff
    function handleReconnection() {
      if (hasCleanedUp.current) return;
      
      const attempts = reconnectAttempts + 1;
      setReconnectAttempts(attempts);
      
      // Calculate backoff time: min(2^attempts * 1000ms, 30000ms)
      const backoffTime = Math.min(Math.pow(2, attempts) * 1000, 30000);
      console.log(`Reconnection attempt ${attempts} scheduled in ${backoffTime}ms`);
      
      // Clear any existing reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Set new reconnection timeout
      reconnectTimeoutRef.current = setTimeout(() => {
        // Only proceed if we haven't cleaned up
        if (!hasCleanedUp.current) {
          console.log(`Attempting to reconnect to ${stableChannelId.current}...`);
          
          // Refetch messages to ensure we have the latest data
          fetchMessages().catch(err => {
            console.error("Error fetching messages during reconnection:", err);
          });
          
          // Rerun the effect to create a new subscription
          if (channelRef.current) {
            try {
              supabase.removeChannel(channelRef.current);
            } catch (cleanupError) {
              console.error("Error removing channel during reconnection:", cleanupError);
            }
          }
          
          // Force effect to run again by incrementing reconnectAttempts
          
      // Use a ref to track reconnection attempts to avoid re-rendering
      const attempts = reconnectAttempts + 1;
      setReconnectAttempts(attempts);
      
      // Clear any existing timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Use exponential backoff for reconnection attempts
      const backoffTime = Math.min(2000 * Math.pow(1.5, attempts), 30000);
      console.log(`Will try to reconnect in ${backoffTime}ms (attempt ${attempts})`);
      
      reconnectTimeoutRef.current = setTimeout(() => {
        // This won't cause the useEffect to run again since we're not updating reconnectAttempts in the dependency array
        if (channelRef.current === null && !hasCleanedUp.current) {
          console.log(`Attempting to reconnect (attempt ${attempts})`);
          setupChannel();
        }
      }, backoffTime);
    
        }
      }, backoffTime);
    }
    
    // Cleanup function
    return () => {
      // Only proceed with cleanup if we haven't already cleaned up
      if (hasCleanedUp.current) {
        console.log(`Skipping cleanup for ${channelName} - already cleaned up`);
        return;
      }
      
      hasCleanedUp.current = true;
      console.log(`Cleaning up subscription to ${channelName}`);
      
      // Clear any reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Clean up channel
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
          console.log(`Successfully removed channel ${channelName}`);
        } catch (cleanupError) {
          console.error(`Error removing channel ${channelName}:`, cleanupError);
        }
        channelRef.current = null;
        subscriptionRef.current = null;
      }
    };
  }, [conversationId, user, handleInsert, handleUpdate, handleDelete, fetchMessages, supabase]);

const sendMessage = async (content: string) => {
    if (!conversationId || !user || !content.trim()) {
      return false;
    }
    
    try {
      setIsSending(true);
      console.log("[useMessages] Sending message:", {
        conversation_id: conversationId,
        sender_id: user.id,
        content: content.substring(0, 20) + (content.length > 20 ? '...' : '')
      });

      // Check if the conversation ID is a temporary local ID
      // (starts with 'temp-conv-' which means it needs to be created in the DB)
      const isTemporaryId = conversationId.startsWith('temp-conv-');
      
      // Check if the ID is already a valid UUID (for existing conversations)
      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(conversationId);
      
      // Variable to hold the actual conversation ID we'll use
      let actualConversationId = conversationId;
      
      // For temporary/local conversations, we need to create a real one in the DB
      if (isTemporaryId) {
        console.log("[useMessages] This is a temporary conversation ID, creating real conversation");
        
        // Extract participant IDs from temporary ID
        const participantIds = conversationId.replace('temp-conv-', '').split('-');
        
        // Generate a deterministic conversation ID based on all participants
        const allParticipants = [...new Set([user.id, ...participantIds])];
        const deterministicId = await generateConversationId(allParticipants);
        console.log("[useMessages] Generated deterministic conversation ID:", deterministicId);
        
        // First, check if this conversation already exists
        const { data: existingConv, error: checkError } = await supabase
          .from('conversations')
          .select('id')
          .eq('id', deterministicId)
          .maybeSingle();
          
        if (checkError) {
          console.error("[useMessages] Error checking for existing conversation:", checkError);
        }
        
        // If the conversation exists, use it
        if (existingConv) {
          console.log("[useMessages] Found existing conversation with deterministic ID");
          actualConversationId = existingConv.id;
        } else {
          // Create a new conversation with the deterministic ID
          console.log("[useMessages] Creating new conversation with deterministic ID");
          const { data: newConversation, error: convError } = await supabase
            .from('conversations')
            .insert({
              id: deterministicId,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select();
            
          if (convError || !newConversation || newConversation.length === 0) {
            throw new Error('Failed to create new conversation: ' + (convError?.message || 'Unknown error'));
          }
            
          actualConversationId = newConversation[0].id;
          console.log("[useMessages] Created new conversation:", actualConversationId);
          
          // Add all participants to the conversation
          for (const participantId of allParticipants) {
            const { error: participantError } = await supabase
              .from('conversation_participants')
              .insert({
                conversation_id: actualConversationId, 
                user_id: participantId,
                created_at: new Date().toISOString()
              });
              
            if (participantError) {
              console.error(`[useMessages] Error adding participant ${participantId}:`, participantError);
            }
          }
        }
        
        // Store mapping from temporary ID to real ID
        const mappingKey = 'conversation_id_mapping';
        const storedMapping = localStorage.getItem(mappingKey);
        const mapping = storedMapping ? JSON.parse(storedMapping) : {};
        mapping[conversationId] = actualConversationId;
        localStorage.setItem(mappingKey, JSON.stringify(mapping));
      } else if (!isValidUUID) {
        // For backward compatibility with non-UUID, non-temporary IDs
        console.log("[useMessages] Converting legacy non-UUID conversation ID format");
        
        // Check if we have a mapping for this ID
        const storedMapping = localStorage.getItem('conversation_id_mapping');
        const mapping = storedMapping ? JSON.parse(storedMapping) : {};
        
        if (mapping[conversationId]) {
          actualConversationId = mapping[conversationId];
          console.log("[useMessages] Found mapped UUID:", actualConversationId);
        } else {
          console.error("[useMessages] Non-UUID conversation ID with no mapping found");
          throw new Error('Invalid conversation ID format with no mapping');
        }
      }
      
      // Create a unique message ID
      const messageId = uuidv4();
      
      // Send the message with a transaction-like approach to ensure consistency
      const { data, error } = await supabase
        .from('messages')
        .insert({
          id: messageId,
          conversation_id: actualConversationId,
          sender_id: user.id,
          content,
          read: false,
          created_at: new Date().toISOString()
        })
        .select();
        
      if (error) {
        console.error("[useMessages] Error sending message:", error);
        throw error;
      }
      
      console.log("[useMessages] Message sent successfully with ID:", messageId);
        
      // Update conversation last message
      const { error: updateError } = await supabase
        .from('conversations')
        .update({
          last_message: content,
          last_message_time: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', actualConversationId);
        
      if (updateError) {
        console.error("[useMessages] Error updating conversation last message:", updateError);
        // Non-critical error, continue without throwing
      }

      if (data && data.length > 0) {
        console.log("[useMessages] Adding sent message to local state");
        
        // Ensure the sent message adheres to the MessageWithSender type
        const sentMessage: MessageWithSender = {
          ...data[0],
          read: false,
          sender: {
            id: user.id,
            email: user.email || '',
            first_name: user.user_metadata?.first_name || null,
            last_name: user.user_metadata?.last_name || null,
            updated_at: new Date().toISOString()
          }
        };
        
        // If we changed from a temporary ID to a real ID, we need to update our channel subscription
        if (conversationId !== actualConversationId) {
          console.log("[useMessages] Conversation ID changed from temporary to real, updating subscription");
          // Store the real conversation ID for use in other components
          if (onMessageUpdate) {
            onMessageUpdate({
              type: 'conversation_created',
              message: null,
              conversationId: actualConversationId,
              previousId: conversationId
            });
          }
          
          // We'll let the parent component handle navigating to the new conversation ID
          // For now, we'll add the message to our local state for immediate feedback
        }
        
        // Add message to state immediately for better user experience
        // and then let real-time handle any updates
        setMessages(prevMessages => {
          // Check if the message already exists (in case of duplicate sends)
          const exists = prevMessages.some(msg => msg.id === sentMessage.id);
          if (exists) {
            return prevMessages;
          }
          return [...prevMessages, sentMessage];
        });
        
        // Notify parent components about the new message
        if (onMessageUpdate) {
          onMessageUpdate({
            type: 'message_insert',
            message: sentMessage,
            conversationId: actualConversationId
          });
        }
      }
      
      return true;
    } catch (error) {
      console.error("Erro ao enviar mensagem: ", error);
      toast({
        variant: "destructive",
        title: "Message not sent",
        description: "Could not send your message. Please try again."
      });
      return false;
    } finally {
      setIsSending(false);
    }
  };

  const markAsRead = async (messageIds: string[]) => {
    if (!messageIds.length || !user) return;
    
    try {
      const { error } = await supabase
        .from('messages')
        .update({ read: true })
        .in('id', messageIds);
        
      if (error) {
        throw error;
      }
      
      // Keep track of updated messages
      const updatedMessages: MessageWithSender[] = [];
      
      setMessages(prevMessages => {
        const newMessages = prevMessages.map(message => {
          if (messageIds.includes(message.id)) {
            // Update the message and add to updated list
            const updatedMessage = { ...message, read: true };
            updatedMessages.push(updatedMessage);
            return updatedMessage;
          }
          return message;
        });
        return newMessages;
      });
      
      // Notify parent components about the read status change
      if (onMessageUpdate && updatedMessages.length > 0) {
        // Emit an event for each updated message
        updatedMessages.forEach(message => {
          onMessageUpdate({
            type: 'message_update',
            message,
            conversationId
          });
        });
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  // Function to explicitly refresh messages for the current conversation
  const refreshMessages = async () => {
    if (!conversationId) return;
    
    setLoading(true);
    try {
      console.log("Explicitly refreshing messages for conversation:", conversationId);
      
      // Use throttled query to prevent ERR_INSUFFICIENT_RESOURCES
      const { data, error } = await throttledSafeQuery<any[]>(
        () => supabase
          .from('messages')
          .select(`
            id,
            sender_id,
            conversation_id,
            content,
            encrypted_content,
            is_encrypted,
            created_at,
            read,
            sender:profiles!sender_id(id, email, first_name, last_name, updated_at)
          `)
          .eq('conversation_id', conversationId)
          .order('created_at'),
        'refreshing messages'
      );
      
      if (error) {
        throw error;
      }
      
      // Ensure all fetched messages conform to the MessageWithSender type
      const typedMessages = data?.map(msg => ({
        ...msg,
        read: msg.read ?? false,
        sender: {
          ...msg.sender,
          id: msg.sender.id ?? '',
          email: msg.sender.email ?? '',
          first_name: msg.sender.first_name ?? null,
          last_name: msg.sender.last_name ?? null,
          updated_at: msg.sender.updated_at ?? ''
        }
      })) as MessageWithSender[];
      
      setMessages(typedMessages || []);
    } catch (error) {
      console.error('Error refreshing messages:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    messages,
    loading,
    sendMessage,
    markAsRead,
    isSending,
    connectionState,
    refreshMessages,
    setMessages  // Expose setMessages to allow clearing state when needed
  };
};
