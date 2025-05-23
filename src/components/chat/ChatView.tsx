import React, { useState, useRef, useEffect } from 'react';
import { useMessages } from '@/hooks/useMessages';
import { useMediaMessages } from '@/hooks/useMediaMessages';
import { useConversations } from '@/hooks/useConversations';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { SendHorizonal, Loader, ShieldCheck, Info, Camera, Mic, Paperclip, Smile, MoreVertical, Image, FileText, MapPin, Calendar as CalendarIcon, Users, AlertTriangle, BellOff, Bell, Pin, Archive, Trash2, Eraser, Circle, Download, File, X, Film } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageWithSender } from '@/types/supabase';
import { useToast } from '@/hooks/use-toast';
import EmojiPicker from './EmojiPicker';
import AttachmentOptions from './AttachmentOptions';
import { ScrollArea } from '@/components/ui/scroll-area';
import MediaUploader from '@/components/media/MediaUploader';
import MediaViewer from '@/components/media/MediaViewer';
import { fileTypeFromMimeType } from '@/utils/fileUtils';
import { MessageUpdateCallback } from '@/hooks/useMessages';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { 
  AlertDialog, 
  AlertDialogContent, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction 
} from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useConversationProtection } from '@/hooks/useConversationProtection';
import { testConnection } from '@/integrations/supabase/client';
import { generateKeyPair } from '@/utils/cryptography';

type ChatViewProps = {
  conversationId: string;
  onMessageUpdate?: MessageUpdateCallback;
};

// MessageItem component to display individual messages with drag functionality
type MessageItemProps = {
  message: MessageWithSender;
  isCurrentUser: boolean;
  formatMessageDate: (message: MessageWithSender) => string;
  handleViewMedia?: (messageId: string) => void;
  isMediaMessageType?: (message: MessageWithSender) => boolean;
};

const MessageItem: React.FC<MessageItemProps> = ({ 
  message, 
  isCurrentUser, 
  formatMessageDate,
  handleViewMedia = () => {}, 
  isMediaMessageType = () => false 
}) => {
  const [draggedMessageId, setDraggedMessageId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [touchStartX, setTouchStartX] = useState(0);

  const isBeingDragged = draggedMessageId === message.id;
  const offsetAmount = isBeingDragged ? dragOffset : 0;
  const revealThreshold = 30; // px to trigger metadata reveal (lowered for better responsiveness)
  const showMetadata = Math.abs(offsetAmount) > revealThreshold || isBeingDragged;
  
  // Calculate max drag distance
  const maxDragDistance = 100;
  
  // Threshold to determine if it's a click or a drag
  const clickThreshold = 5;
  
  // Add visual feedback for drag state
  const metadataFadeDistance = 20; // Start showing metadata earlier for better UX
  
  // Track if we've moved beyond click threshold
  const [isDragging, setIsDragging] = useState(false);
  
  const handleTouchStart = (e: React.TouchEvent) => {
    setDraggedMessageId(message.id);
    setTouchStartX(e.touches[0].clientX);
    setIsDragging(false);
  };
  
  const handleMouseDown = (e: React.MouseEvent) => {
    setDraggedMessageId(message.id);
    setTouchStartX(e.clientX);
    setIsDragging(false);
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (draggedMessageId !== message.id) return;
    const currentX = e.touches[0].clientX;
    const diffX = currentX - touchStartX;
    
    // Mark as dragging if we've moved beyond the click threshold
    if (Math.abs(diffX) > clickThreshold && !isDragging) {
      setIsDragging(true);
    }
    
    // Limit drag in opposite direction based on message sender
    if ((isCurrentUser && diffX > 0) || (!isCurrentUser && diffX < 0)) {
      setDragOffset(0);
    } else {
      // Apply resistance beyond threshold
      const direction = diffX < 0 ? -1 : 1;
      const absOffset = Math.min(Math.abs(diffX), maxDragDistance);
      setDragOffset(direction * absOffset);
    }
    
    // If we're dragging, prevent default to avoid unwanted interactions
    if (isDragging) {
      e.preventDefault();
    }
  };
  
  const handleMouseMove = (e: MouseEvent) => {
    if (draggedMessageId !== message.id) return;
    const diffX = e.clientX - touchStartX;
    
    // Mark as dragging if we've moved beyond the click threshold
    if (Math.abs(diffX) > clickThreshold && !isDragging) {
      setIsDragging(true);
    }
    
    // Limit drag in opposite direction based on message sender
    if ((isCurrentUser && diffX > 0) || (!isCurrentUser && diffX < 0)) {
      setDragOffset(0);
    } else {
      // Apply resistance beyond threshold
      const direction = diffX < 0 ? -1 : 1;
      const absOffset = Math.min(Math.abs(diffX), maxDragDistance);
      setDragOffset(direction * absOffset);
    }
    
    // If we're dragging, prevent default to avoid unwanted interactions
    if (isDragging) {
      e.preventDefault();
    }
  };
  
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (draggedMessageId === message.id) {
      setDraggedMessageId(null);
      setDragOffset(0);
      
      // If we were dragging, stop propagation to prevent unwanted clicks
      if (isDragging) {
        e.stopPropagation();
      }
      
      setIsDragging(false);
    }
  };
  
  const handleMouseUp = (e: React.MouseEvent) => {
    if (draggedMessageId === message.id) {
      setDraggedMessageId(null);
      setDragOffset(0);
      
      // If we were dragging, stop propagation to prevent unwanted clicks
      if (isDragging) {
        e.stopPropagation();
      }
      
      setIsDragging(false);
    }
  };
  
  // Register global mouse move and up handlers when dragging
  useEffect(() => {
    if (draggedMessageId === message.id) {
      const mouseMoveHandler = (e: MouseEvent) => handleMouseMove(e);
      const mouseUpHandler = (e: MouseEvent) => {
        // Convert MouseEvent to React.MouseEvent equivalent behavior
        handleMouseUp({
          ...e,
          stopPropagation: () => e.stopPropagation()
        } as unknown as React.MouseEvent);
      };
      
      window.addEventListener('mousemove', mouseMoveHandler);
      window.addEventListener('mouseup', mouseUpHandler);
      
      return () => {
        window.removeEventListener('mousemove', mouseMoveHandler);
        window.removeEventListener('mouseup', mouseUpHandler);
      };
    }
  }, [draggedMessageId, message.id, isDragging]);

  return (
    <div
      className={`mb-2 relative ${isCurrentUser ? 'flex flex-col items-end' : 'flex flex-col items-start'}`}
    >
      {/* Message metadata - always rendered but only visible when dragged */}
      <div 
        className={`absolute ${isCurrentUser ? 'right-full pr-2' : 'left-full pl-2'} top-1/2 -translate-y-1/2 flex items-center text-xs text-foreground z-10 opacity-0 transition-all duration-300 pointer-events-none ${showMetadata ? 'opacity-100' : ''}`}
        style={{
          transitionProperty: 'opacity, transform',
          width: '120px',
          textAlign: isCurrentUser ? 'right' : 'left',
          transform: `translateX(${isCurrentUser ? (showMetadata ? '0' : '10px') : (showMetadata ? '0' : '-10px')})`,
          filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))'
        }}
      >
        <div className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'} bg-background/80 backdrop-blur-sm rounded-md py-1 px-2 border border-border/30`}>
          <span className="font-medium whitespace-nowrap text-sm">
            {isCurrentUser 
              ? 'You' 
              : message.sender?.first_name || message.sender?.email?.split('@')[0] || 'User'}
          </span>
          <span className="whitespace-nowrap font-medium text-xs text-muted-foreground">{formatMessageDate(message)}</span>
        </div>
      </div>
      
      {/* Message bubble with drag functionality */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        style={{
          transform: `translateX(${offsetAmount}px)`,
          transition: draggedMessageId === message.id ? 'none' : 'transform 0.3s ease-out, box-shadow 0.2s ease',
          cursor: isDragging ? 'grabbing' : 'grab',
          boxShadow: isBeingDragged ? '0 2px 8px rgba(0, 0, 0, 0.1)' : 'none',
          touchAction: 'pan-y' // Allow vertical scrolling but handle horizontal ourselves
        }}
        className={`rounded-full px-4 py-2 max-w-[75%] break-words ${
          isCurrentUser 
            ? 'bg-app-yellow text-app-textoBotoes' 
            : 'bg-muted-foreground/10 text-foreground'
        }`}
      >
        {isMediaMessageType(message) ? (
          <div 
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => handleViewMedia(message.id)}
          >
            {message.type === 'image' && message.thumbnail ? (
              <div className="relative w-48 h-32 bg-black/5 rounded-md overflow-hidden">
                <img 
                  src={`data:image/jpeg;base64,${message.thumbnail}`} 
                  alt="Image" 
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 p-2 bg-black/5 rounded-md">
                {message.type === 'image' ? (
                  <Image className="h-5 w-5 text-muted-foreground" />
                ) : message.type === 'video' ? (
                  <Film className="h-5 w-5 text-muted-foreground" />
                ) : message.type === 'audio' ? (
                  <Mic className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <File className="h-5 w-5 text-muted-foreground" />
                )}
                <span>{message.content || fileTypeFromMimeType(message.type || '')}</span>
              </div>
            )}
          </div>
        ) : (
          message.content
        )}
        
        {/* Check for link previews in messages */}
        {(() => {
          // Look for URL in message content
          const urlRegex = /(https?:\/\/[^\s]+)/g;
          const urls = message.content.match(urlRegex);
          
          // First check if there's a stored preview for this message
          if (urls && urls.length > 0) {
            // Try to find a preview in localStorage
            let preview = null;
            
            // Search through localStorage for a matching preview
            Object.keys(localStorage).forEach(key => {
              if (key.startsWith('msg_preview_')) {
                try {
                  const item = JSON.parse(localStorage.getItem(key));
                  if (item && item.content === message.content) {
                    preview = item.preview;
                  }
                } catch (e) {
                  // Invalid JSON, ignore
                }
              }
            });
            
            // If we found a preview, render it
            if (preview) {
              return (
                <div className="link-preview mt-2 bg-background/80 rounded-md overflow-hidden border border-border/30">
                  {preview.image && (
                    <div className="h-32 overflow-hidden">
                      <img src={preview.image} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-2">
                    <div className="font-medium text-sm">{preview.title}</div>
                    <div className="text-xs text-muted-foreground">{preview.description}</div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">{preview.url}</div>
                  </div>
                </div>
              );
            }
          }
          
          return null;
        })()}
      </div>
    </div>
  );
};

const ChatView: React.FC<ChatViewProps> = ({ conversationId, onMessageUpdate }) => {
  const { 
    conversations, 
    refreshConversations, 
    loading: conversationsLoading, 
    deleteConversation,
    clearMessages,
    archiveConversation,
    muteConversation, 
    pinConversation 
  } = useConversations();
  const { user } = useAuth();
  const [newMessage, setNewMessage] = useState('');
  const [linkPreview, setLinkPreview] = useState(null);
  const { messages, loading: messagesLoading, sendMessage, isSending, markAsRead, refreshMessages, setMessages } = useMessages(
    conversationId,
    onMessageUpdate // Pass the callback to the useMessages hook
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { processMessageContent, shouldBlockMessage, loading: protectionLoading } = useConversationProtection();
  const [connectionError, setConnectionError] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  
  const conversation = conversations.find(c => c.id === conversationId);

  // Camera and mic states
  const [cameraDialogOpen, setCameraDialogOpen] = useState(false);
  const [micSheet, setMicSheet] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showAttachmentOptions, setShowAttachmentOptions] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  
  // Conversation management states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isMuting, setIsMuting] = useState(false);
  const [isPinning, setIsPinning] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  
  // Media states
  const [mediaUploadModalOpen, setMediaUploadModalOpen] = useState(false);
  const [mediaViewModalOpen, setMediaViewModalOpen] = useState(false);
  const [selectedMediaMessage, setSelectedMediaMessage] = useState<string | null>(null);
  const [mediaUploadType, setMediaUploadType] = useState<string>('');
  
  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Media messages hooks
  const { 
    isLoading: isMediaLoading, 
    error: mediaError, 
    sendMediaMessage, 
    getMediaMessage, 
    isMediaLoading: isMessageLoading, 
    markMediaMessageAsRead, 
    isMediaMessage, 
    getMediaTypeIcon 
  } = useMediaMessages();
  
  // Check Supabase connection
  useEffect(() => {
    const checkConnection = async () => {
      try {
        setIsCheckingConnection(true);
        
        // Add a small delay to ensure client initialization
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // First, check if supabase is defined before calling testConnection
        if (typeof window === 'undefined') {
          console.log("Skipping connection check in SSR environment");
          setIsCheckingConnection(false);
          return;
        }
        
        // Also check if WebSocket connection is available in this browser
        if (!window.WebSocket) {
          console.error("WebSocket is not supported in this browser");
          toast({
            variant: "destructive",
            title: "Connection Error",
            description: "Your browser doesn't support WebSockets which are needed for real-time updates."
          });
          setConnectionError(true);
          setIsCheckingConnection(false);
          return;
        }

        console.log("Testing Supabase connection and WebSocket availability...");
        const { success, error } = await testConnection();
        console.log("Connection check result:", success, error);
        setConnectionError(!success);
        
        if (!success) {
          // Only show toast if there's a specific error, not just initialization issues
          if (error && error !== "Supabase client is not initialized") {
            toast({
              variant: "destructive",
              title: "Connection Error",
              description: "Could not connect to the messaging server. You may not be able to send or receive messages."
            });
          }
        }
      } catch (err) {
        console.error("Error checking connection:", err);
        setConnectionError(true);
      } finally {
        setIsCheckingConnection(false);
      }
    };
    
    checkConnection();
  }, [toast]);
  
  // Timer for audio recording
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (recording) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(interval);
  }, [recording]);
  
  // Scroll to the end of conversation when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Use a ref to track if we need to refresh messages
  const needsRefreshRef = useRef<boolean>(false);
  const conversationIdRef = useRef<string | null>(null);
  
  // Handle conversation ID changes with immediate cleanup
  useEffect(() => {
    // Only proceed if we have a valid conversationId
    if (!conversationId) return;
    
    // Check if the conversation ID has actually changed
    if (conversationIdRef.current !== conversationId) {
      console.log('Conversation ID changed:', conversationId);
      
      // Update our ref to the new ID
      conversationIdRef.current = conversationId;
      
      // Clear messages immediately
      setMessages([]);
      
      // Mark that we need to refresh after this render cycle
      needsRefreshRef.current = true;
    }
  }, [conversationId]); // Only depend on conversationId
  
  // Handle the actual message fetching in a separate effect
  useEffect(() => {
    // Check if we need to refresh messages (based on the flag set in the previous effect)
    if (needsRefreshRef.current && conversationIdRef.current) {
      needsRefreshRef.current = false; // Reset the flag immediately
      
      // Now we can safely fetch messages for the new conversation
      console.log('Fetching messages for conversation:', conversationIdRef.current);
      refreshMessages();
    }
  }, [refreshMessages]); // Depend on refreshMessages to capture its latest version
  
  // Fetch link preview when a URL is detected in the input
  useEffect(() => {
    const fetchLinkPreview = async (url) => {
      try {
        const session = await supabase.auth.getSession();
        console.log('Session:', session?.data?.session);
        const token = session?.data?.session?.access_token;
        
        if (!token) return null;
        
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'}/preview?url=${encodeURIComponent(url)}`,
          { headers: { Authorization: `Bearer ${token}` }}
        );
        
        if (!response.ok) return null;
        
        const preview = await response.json();
        return preview;
      } catch (error) {
        console.error('Error fetching link preview:', error);
        return null;
      }
    };

    const processInput = async () => {
      if (!newMessage) {
        setLinkPreview(null);
        return;
      }
      
      // Regex for URL detection
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const urls = newMessage.match(urlRegex);
      
      if (urls && urls.length > 0) {
        console.log('URL detected, fetching preview:', urls[0]);
        const preview = await fetchLinkPreview(urls[0]);
        setLinkPreview(preview);
      } else {
        setLinkPreview(null);
      }
    };
    
    processInput();
  }, [newMessage]);

  // Cleanup media streams when component unmounts
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  // Loading state for the entire component
  const isLoading = messagesLoading || conversationsLoading || protectionLoading;
  
  // Determine if inputs should be disabled
  // We're NOT considering connectionError here to allow retry message sending
  const inputsDisabled = isSending;
  
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || isSending) return;
    
    try {
      console.log("Sending message:", newMessage);
      
      // Store original message before processing
      const originalMessage = newMessage;
      
      // Store preview before clearing
      const currentPreview = linkPreview;
      
      // Clear input right away for better UX
      setNewMessage('');
      setLinkPreview(null);
      
      // Process message content - we're bypassing the blocking for now
      const processedContent = processMessageContent(originalMessage);
      
      console.log("Processed content:", processedContent);
      console.log("Sending to conversation:", conversationId);
      
      // We can't directly modify the message structure for sendMessage since
      // it's defined in useMessages, but we can store the preview in localStorage
      // and associate it with the message in the UI
      if (currentPreview) {
        // Store preview in localStorage with a key based on content
        const previewKey = `msg_preview_${Date.now()}`;
        localStorage.setItem(previewKey, JSON.stringify({
          content: processedContent,
          preview: currentPreview,
          timestamp: Date.now()
        }));
        // Cleanup old previews (older than 1 day)
        cleanupOldPreviews();
      }
      
      const success = await sendMessage(processedContent);
      
      console.log("Send message result:", success);
      
      if (success) {
        
        // Focus the input field after sending
        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
      } else {
        console.error("Failed to send message");
        toast({
          variant: "destructive",
          title: "Mensagem não enviada",
          description: "Houve um problema ao enviar sua mensagem. Por favor, tente novamente."
        });
        // Restore the message if sending failed
        setNewMessage(originalMessage);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao enviar mensagem. Por favor, tente novamente."
      });
    }
  };
  
  // Helper function to clean up old previews from localStorage
  const cleanupOldPreviews = () => {
    try {
      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000);
      
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('msg_preview_')) {
          try {
            const item = JSON.parse(localStorage.getItem(key));
            if (item && item.timestamp < oneDayAgo) {
              localStorage.removeItem(key);
            }
          } catch (e) {
            // Invalid JSON, remove it
            localStorage.removeItem(key);
          }
        }
      });
    } catch (e) {
      console.error('Error cleaning up previews:', e);
    }
  };
  
  const getConversationName = () => {
    if (!conversation) return "Loading...";
    
    if (conversation.name) return conversation.name;
    
    const otherParticipants = conversation.participants.filter(p => p.id !== user?.id);
    if (otherParticipants.length === 0) return "Just you";
    
    return otherParticipants
      .map(p => p.first_name || p.company_name || p.email.split('@')[0])
      .join(', ');
  };
  
  const formatMessageDate = (message: MessageWithSender) => {
    return format(new Date(message.created_at), 'HH:mm', { locale: ptBR });
  };
  
  const isConsecutiveMessage = (message: MessageWithSender, index: number) => {
    if (index === 0) return false;
    
    const prevMessage = messages[index - 1];
    return (
      prevMessage.sender_id === message.sender_id && 
      new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime() < 5 * 60 * 1000 // 5 minutes
    );
  };

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    // Focus the input after adding emoji
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleAttach = (type: string, file?: File) => {
    // Hide attachment options menu
    setShowAttachmentOptions(false);
    
    // Set the upload type
    setMediaUploadType(type);
    
    // Different behavior based on attachment type
    if (type === 'image' || type === 'document' || type === 'video' || type === 'audio') {
      // For file types, trigger file selection
      
      // Set accepted file types based on the selected type
      let acceptString = '';
      switch (type) {
        case 'image':
          acceptString = 'image/*';
          break;
        case 'video':
          acceptString = 'video/*';
          break;
        case 'audio':
          acceptString = 'audio/*';
          break;
        case 'document':
          acceptString = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt';
          break;
        default:
          acceptString = '*/*';
      }
      
      // Trigger file selection if we have a reference
      if (fileInputRef.current) {
        fileInputRef.current.accept = acceptString;
        fileInputRef.current.click();
      }
    } else {
      // Non-file attachments (location, contact, etc.) - show a toast for now
      toast({
        title: `${type === 'location' ? 'Location' : 
                 type === 'calendar' ? 'Event' : 
                 type === 'contact' ? 'Contact' : 'Sticker'} sent`,
        description: "This feature is coming soon."
      });
    }
  };
  
  // Check if we're in a secure context for Web Crypto API
  const isSecureContext = (): boolean => {
    if (typeof window === 'undefined') return false;
    
    // If window.isSecureContext is available, use that
    if (typeof window.isSecureContext === 'boolean') {
      return window.isSecureContext;
    }
    
    // Fallback: check protocol
    return window.location && 
           (window.location.protocol === 'https:' || 
            window.location.hostname === 'localhost' || 
            window.location.hostname === '127.0.0.1');
  };
  
  // Show helpful message about HTTPS requirement if needed
  const checkSecureContextAndNotify = (): boolean => {
    const secure = isSecureContext();
    
    if (!secure && process.env.NODE_ENV === 'production') {
      toast({
        variant: "destructive",
        title: "Secure connection required",
        description: "This feature requires a secure connection (HTTPS). Please use HTTPS to enable secure encryption.",
      });
    }
    
    return secure;
  };

  // Generate and store keys for a user
  const generateAndStoreKeys = async (userId: string): Promise<string> => {
    try {
      console.log(`Generating new key pair for user: ${userId}`);
      
      // Check secure context and notify user if in production
      const isSecure = checkSecureContextAndNotify();
      
      if (!isSecure && process.env.NODE_ENV === 'production') {
        throw new Error("Secure context (HTTPS) is required for cryptographic operations");
      }
      
      // Generate a new key pair
      const { publicKey, privateKey } = await generateKeyPair();
      
      // Store public key in the database
      const { data, error } = await supabase
        .from('user_public_keys')
        .insert({
          user_id: userId,
          key_id: `key-${Date.now()}`, // Generate a unique key ID
          public_key: publicKey
        })
        .select('public_key')
        .single();
      
      if (error) {
        console.error("Error storing public key:", error);
        throw error;
      }
      
      // Store private key securely in localStorage (in production, consider more secure options)
      localStorage.setItem(`private_key_${userId}`, privateKey);
      
      console.log(`Key pair successfully generated and stored for user: ${userId}`);
      return publicKey;
    } catch (error) {
      console.error("Error generating key pair:", error);
      
      // Provide more specific error messages based on the error
      if (error instanceof Error) {
        if (error.message.includes("HTTPS") || error.message.includes("secure context")) {
          toast({
            variant: "destructive",
            title: "Security Error",
            description: "Encryption requires a secure connection (HTTPS). Please use HTTPS or check browser settings.",
          });
          throw new Error("Secure connection (HTTPS) required for encryption features.");
        }
        
        if (error.message.includes("Web Crypto API")) {
          toast({
            variant: "destructive",
            title: "Browser Compatibility Error",
            description: "Your browser doesn't support the required encryption features. Please try a modern browser like Chrome, Firefox, or Edge.",
          });
          throw new Error("Your browser doesn't support the required encryption features.");
        }
      }
      
      // Generic fallback message
      toast({
        variant: "destructive",
        title: "Encryption Error",
        description: "Failed to generate encryption keys. Please try again later.",
      });
      
      throw new Error("Failed to generate encryption keys. Please try again.");
    }
  };
  
  // Handle file selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    // Reset input value so the same file can be selected again
    event.target.value = '';
    
    try {
      // Check if in a secure context first to avoid unnecessary operations
      const isSecure = checkSecureContextAndNotify();
      
      if (!isSecure && process.env.NODE_ENV === 'production') {
        toast({
          variant: "destructive",
          title: "Security Error",
          description: "File encryption requires HTTPS. Please use a secure connection.",
        });
        return;
      }
      
      // Show loading toast
      toast({
        title: "Preparing file",
        description: "Encrypting and uploading your file...",
      });
      
      if (!conversation) {
        throw new Error("Conversation not found");
      }
      
      // Get recipient information
      const recipient = conversation.participants.find(p => p.id !== user?.id);
      if (!recipient) {
        throw new Error("Recipient not found");
      }
      
      // Check if current user has keys, generate them if not
      if (user?.id) {
        const { data: currentUserKey } = await supabase
          .from('user_public_keys')
          .select('public_key')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (!currentUserKey) {
          // Generate keys for current user first
          toast({
            title: "Setting up encryption",
            description: "Generating your encryption keys for secure file sharing...",
          });
          
          await generateAndStoreKeys(user.id);
          
          toast({
            title: "Encryption set up",
            description: "Your encryption keys have been generated successfully.",
          });
        }
      }
      
      // Get recipient public key
      let recipientPublicKey = '';
      try {
        console.log(`Fetching public key for user ID: ${recipient.id}`);
        
        // Query the correct table user_public_keys using maybeSingle instead of single
        const { data, error } = await supabase
          .from('user_public_keys')
          .select('public_key')
          .eq('user_id', recipient.id)
          .maybeSingle();
          
        if (error) {
          console.error("Database error when fetching public key:", error);
          throw error;
        }
        
        // Log the result to help debug
        console.log("Public key query result:", data ? "Data found" : "No data found");
        
        if (data && data.public_key) {
          recipientPublicKey = data.public_key;
          console.log("Successfully retrieved recipient's public key");
        } else {
          console.warn(`No public key found for user ${recipient.id}, attempting to generate keys`);
          
          // Show toast about generating keys for recipient
          toast({
            title: "Setting up encryption for recipient",
            description: "We need to set up encryption keys for your recipient to enable secure file sharing.",
          });
          
          // Generate keys for the recipient
          recipientPublicKey = await generateAndStoreKeys(recipient.id);
          
          toast({
            title: "Recipient keys generated",
            description: "Encryption keys for your recipient have been set up. You can now securely share files.",
          });
        }
      } catch (keyError) {
        console.error("Error with public key operations:", keyError);
        
        // Check for specific crypto-related errors
        if (keyError instanceof Error) {
          const errorMsg = keyError.message;
          
          if (errorMsg.includes("HTTPS") || errorMsg.includes("secure context")) {
            toast({
              variant: "destructive",
              title: "Security Error",
              description: "Encryption requires HTTPS. Please use a secure connection.",
            });
            throw new Error("Secure connection required for encryption features.");
          }
          
          if (errorMsg.includes("Web Crypto API") || errorMsg.includes("crypto")) {
            toast({
              variant: "destructive", 
              title: "Browser Compatibility Error",
              description: "Your browser doesn't support the required encryption features.",
            });
            throw new Error("Browser compatibility issue with encryption.");
          }
        }
        
        throw new Error("Could not set up encryption for secure file sharing. Please try again later.");
      }
      
      // Upload the file directly using the hook function from the component level
      const messageId = await sendMediaMessage(
        file,
        conversationId,
        recipient.id,
        recipientPublicKey
      );
      
      if (!messageId) {
        throw new Error("Failed to upload file");
      }
      
      // Show success toast
      toast({
        title: "File shared",
        description: "Your file has been securely shared",
        variant: "default",
      });
      
      // Refresh messages to show the new media message
      refreshMessages();
      
    } catch (error) {
      console.error("Error uploading file:", error);
      
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload file",
        variant: "destructive",
      });
    }
  };
  
  // Handle viewing a media message
  const handleViewMedia = async (messageId: string) => {
    try {
      setSelectedMediaMessage(messageId);
      setMediaViewModalOpen(true);
      
      // Mark as read
      if (conversation) {
        await markMediaMessageAsRead(messageId);
      }
    } catch (error) {
      console.error('Error viewing media:', error);
      toast({
        title: 'Error',
        description: 'Failed to open media file',
        variant: 'destructive'
      });
    }
  };
  


  // Check if a message is a media message
  const isMediaMessageType = (message: MessageWithSender): boolean => {
    return message && 
      message.is_encrypted === true && 
      message.storage_path && 
      message.type && 
      (message.type === 'image' || 
       message.type === 'video' || 
       message.type === 'audio' || 
       message.type === 'file' || 
       message.type === 'document');
  };

  const handleCameraClick = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true 
      });
      
      setCameraStream(stream);
      setCameraDialogOpen(true);
      
      // Set the stream to the video element when dialog opens
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
      
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast({
        title: "Camera Error",
        description: "Could not access your camera. Check your permissions.",
        variant: "destructive"
      });
    }
  };

  const handleMicClick = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicSheet(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast({
        title: "Microphone Error",
        description: "Could not access your microphone. Check your permissions.",
        variant: "destructive"
      });
    }
  };

  const startRecording = () => {
    setRecording(true);
    // In a real implementation, this would start recording audio
  };

  const stopRecording = () => {
    setRecording(false);
    // In a real implementation, this would stop recording and process the audio
  };

  const sendPhoto = () => {
    // Stop the camera stream
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    
    setCameraDialogOpen(false);
    setCameraStream(null);
    
    // In a real implementation, this would capture the current frame and send it
    toast({
      title: "Photo sent",
      description: "Your photo was sent successfully"
    });
    
    sendMessage("[Sent a photo from camera]");
  };

  const sendAudio = () => {
    setMicSheet(false);
    setRecording(false);
    
    // In a real implementation, this would send the recorded audio
    toast({
      title: "Audio sent",
      description: "Your audio was sent successfully"
    });
    
    sendMessage("[Sent a voice message]");
  };
  
  // Format recording time
  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Show connection error with button to retry
  if (connectionError) {
    return (
      <div className="flex flex-col h-full w-full items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-warning mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Connection Error</h2>
          <p className="mb-4 text-muted-foreground">
            We're having trouble connecting to the messaging server. Please check your internet connection and try again.
          </p>
          <Button 
            onClick={async () => {
              setIsCheckingConnection(true);
              try {
                // Check if we're in a browser environment
                if (typeof window === 'undefined') {
                  console.log("Cannot retry connection in SSR environment");
                  return;
                }
                
                const { success, error } = await testConnection();
                console.log("Retry connection result:", success, error);
                setConnectionError(!success);
                
                if (success) {
                  toast({
                    title: "Connection restored",
                    description: "Successfully connected to messaging server."
                  });
                }
              } catch (err) {
                console.error("Error during connection retry:", err);
                setConnectionError(true);
              } finally {
                setIsCheckingConnection(false);
              }
            }}
            disabled={isCheckingConnection}
          >
            {isCheckingConnection ? (
              <>
                <Loader className="h-4 w-4 mr-2 animate-spin" />
                Checking connection...
              </>
            ) : (
              'Try Again'
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Conversation header */}
      <div className="p-3 border-b border-sidebar-border flex items-center shrink-0">
        <div className="flex-1">
          <h2 className="font-semibold">{getConversationName()}</h2>
          <div className="text-xs text-muted-foreground flex items-center">
            <ShieldCheck className="h-3 w-3 mr-1 text-app-green" />
            End-to-end encrypted
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toast({ title: "View information", description: "Viewing conversation information" });
            }}>
              <Info className="h-4 w-4 mr-2" />
              Conversation information
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toast({ title: "Media and files", description: "Viewing shared media and files" });
            }}>
              <Image className="h-4 w-4 mr-2" />
              Media and files
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                  setIsMuting(true);
                  const success = await muteConversation(conversationId);
                  if (success) {
                    // Update the local state to reflect changes immediately
                    await refreshConversations();
                    toast({
                      title: "Notificações silenciadas",
                      description: "As notificações desta conversa foram silenciadas"
                    });
                  } else {
                    toast({
                      variant: "destructive",
                      title: "Erro",
                      description: "Não foi possível silenciar notificações. Tente novamente."
                    });
                  }
                } catch (error) {
                  console.error("Error muting conversation:", error);
                  toast({
                    variant: "destructive",
                    title: "Erro",
                    description: "Ocorreu um erro ao silenciar notificações."
                  });
                } finally {
                  setIsMuting(false);
                }
              }}
              disabled={isMuting}
            >
              {isMuting ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : <BellOff className="h-4 w-4 mr-2" />}
              Mute notifications
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                  setIsPinning(true);
                  const success = await pinConversation(conversationId);
                  if (success) {
                    // Update the local state to reflect changes immediately
                    await refreshConversations();
                    toast({
                      title: "Conversa fixada",
                      description: "Esta conversa foi fixada no topo da lista"
                    });
                  } else {
                    toast({
                      variant: "destructive",
                      title: "Erro",
                      description: "Não foi possível fixar a conversa. Tente novamente."
                    });
                  }
                } catch (error) {
                  console.error("Error pinning conversation:", error);
                  toast({
                    variant: "destructive",
                    title: "Erro",
                    description: "Ocorreu um erro ao fixar a conversa."
                  });
                } finally {
                  setIsPinning(false);
                }
              }}
              disabled={isPinning}
            >
              {isPinning ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : <Pin className="h-4 w-4 mr-2" />}
              Pin conversation
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                  setIsArchiving(true);
                  const success = await archiveConversation(conversationId);
                  if (success) {
                    // Update the local state to reflect changes immediately
                    await refreshConversations();
                    toast({
                      title: "Conversa arquivada",
                      description: "Esta conversa foi arquivada"
                    });
                  } else {
                    toast({
                      variant: "destructive",
                      title: "Erro",
                      description: "Não foi possível arquivar a conversa. Tente novamente."
                    });
                  }
                } catch (error) {
                  console.error("Error archiving conversation:", error);
                  toast({
                    variant: "destructive",
                    title: "Erro",
                    description: "Ocorreu um erro ao arquivar a conversa."
                  });
                } finally {
                  setIsArchiving(false);
                }
              }}
              disabled={isArchiving}
            >
              {isArchiving ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : <Archive className="h-4 w-4 mr-2" />}
              Archive conversation
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowClearConfirm(true);
              }}
            >
              <Eraser className="h-4 w-4 mr-2" />
              Clear messages
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowDeleteConfirm(true);
              }} 
              className="text-red-500 hover:text-red-500"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete conversation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-auto p-4">
        <ScrollArea className="h-full pr-2">
          {messagesLoading ? (
            <div className="flex items-center justify-center h-24">
              <Loader className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <ShieldCheck className="h-12 w-12 mb-4 text-app-green" />
              <h3 className="font-medium mb-1">Secure conversation started</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Send your first message to start chatting. All messages are end-to-end encrypted.
              </p>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <MessageItem 
                  key={message.id}
                  message={message}
                  isCurrentUser={message.sender_id === user?.id}
                  formatMessageDate={formatMessageDate}
                />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </ScrollArea>
      </div>
      
      {/* New message input */}
      <form onSubmit={handleSendMessage} className="p-3 border-t border-sidebar-border shrink-0">
<div className="flex items-center gap-2">
          <div className="flex-1 flex items-center bg-muted-foreground/10 rounded-full px-2 py-1">
            <div className="flex space-x-1 px-2 py-1">
              <EmojiPicker onEmojiSelect={handleEmojiSelect} />
              
              <div className="relative">
                <Button
                  type="button" 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-full h-8 w-8"
                  onClick={() => setShowAttachmentOptions(!showAttachmentOptions)}
                  disabled={inputsDisabled}
                >
                  <Paperclip className="h-5 w-5 text-muted-foreground" />
                </Button>
                
                {/* Attachment options menu */}
                {showAttachmentOptions && (
                  <div className="absolute bottom-full left-0 mb-2 bg-background border border-border rounded-lg shadow-lg p-2 z-10">
                    <div className="flex flex-col gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="flex items-center justify-start" 
                        onClick={() => handleAttach('image')}
                      >
                        <Image className="h-4 w-4 mr-2" />
                        Photo/Video
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="flex items-center justify-start" 
                        onClick={() => handleAttach('document')}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Document
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="flex items-center justify-start" 
                        onClick={() => handleAttach('location')}
                      >
                        <MapPin className="h-4 w-4 mr-2" />
                        Location
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="flex items-center justify-start" 
                        onClick={() => handleAttach('calendar')}
                      >
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        Event
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="flex items-center justify-start" 
                        onClick={() => handleAttach('contact')}
                      >
                        <Users className="h-4 w-4 mr-2" />
                        Contact
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <Input
              ref={inputRef}
              type="text"
              placeholder=""
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              disabled={inputsDisabled}
            />
            
            {/* Link preview below input */}
            {linkPreview && (
              <div className="absolute bottom-full left-0 w-full p-2">
                <div className="link-preview bg-background border border-border rounded-md overflow-hidden">
                  <div className="flex items-start">
                    {linkPreview.image && (
                      <div className="h-16 w-16 overflow-hidden">
                        <img src={linkPreview.image} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-2 flex-1">
                      <div className="font-medium text-sm truncate">{linkPreview.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">{linkPreview.description}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-full h-8 w-8 [&_svg]:h-5 [&_svg]:w-5"
            onClick={handleCameraClick}
            disabled={inputsDisabled}
          >
            <Camera className="text-muted-foreground" />
          </Button>

          {newMessage.trim() ? (
            <Button
              type="submit"
              disabled={!newMessage.trim() || inputsDisabled}
              className="app-button-primary rounded-full"
              size="iconLarge"
            >
              {isSending ? (
                <Loader className="h-5 w-5 animate-spin" />
              ) : (
                <svg
                  viewBox="-2.8 -2.8 33.60 33.60"
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  xmlnsXlink="http://www.w3.org/1999/xlink"
                  fill="#262626"
                  stroke="#262626"
                  className="h-7 w-7"
                >
                  <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                  <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round" stroke="#CCCCCC" strokeWidth="0.168"></g>
                  <g id="SVGRepo_iconCarrier">
                    <title>ic_fluent_send_28_filled</title>
                    <desc>Created with Sketch.</desc>
                    <g id="U+0001F50D-Product-Icons" strokeWidth="0.00028" fill="none" fillRule="evenodd">
                      <g id="ic_fluent_send_28_filled" fill="#262626" fillRule="nonzero">
                        <path d="M3.78963301,2.77233335 L24.8609339,12.8499121 C25.4837277,13.1477699 25.7471402,13.8941055 25.4492823,14.5168992 C25.326107,14.7744476 25.1184823,14.9820723 24.8609339,15.1052476 L3.78963301,25.1828263 C3.16683929,25.4806842 2.42050372,25.2172716 2.12264586,24.5944779 C1.99321184,24.3238431 1.96542524,24.015685 2.04435886,23.7262618 L4.15190935,15.9983421 C4.204709,15.8047375 4.36814355,15.6614577 4.56699265,15.634447 L14.7775879,14.2474874 C14.8655834,14.2349166 14.938494,14.177091 14.9721837,14.0981464 L14.9897199,14.0353553 C15.0064567,13.9181981 14.9390703,13.8084248 14.8334007,13.7671556 L14.7775879,13.7525126 L4.57894108,12.3655968 C4.38011873,12.3385589 4.21671819,12.1952832 4.16392965,12.0016992 L2.04435886,4.22889788 C1.8627142,3.56286745 2.25538645,2.87569101 2.92141688,2.69404635 C3.21084015,2.61511273 3.51899823,2.64289932 3.78963301,2.77233335 Z"></path>
                      </g>
                    </g>
                  </g>
                </svg>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full h-8 w-8 [&_svg]:h-5 [&_svg]:w-5"
              onClick={handleMicClick}
              disabled={inputsDisabled}
            >
              <Mic className="text-muted-foreground" />
            </Button>
          )}
        </div>
      </form>

      {/* Camera Dialog */}
      <Dialog open={cameraDialogOpen} onOpenChange={(open) => {
        if (!open && cameraStream) {
          cameraStream.getTracks().forEach(track => track.stop());
          setCameraStream(null);
        }
        setCameraDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Take a photo</DialogTitle>
            <DialogDescription>
              Use your camera to capture and send an image to this conversation.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            <div className="relative aspect-video bg-black rounded-md overflow-hidden">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
            <div className="flex justify-center mt-4 gap-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  if (cameraStream) {
                    cameraStream.getTracks().forEach(track => track.stop());
                  }
                  setCameraDialogOpen(false);
                  setCameraStream(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={() => {
                if (cameraStream) {
                  cameraStream.getTracks().forEach(track => track.stop());
                }
                setCameraDialogOpen(false);
                setCameraStream(null);
                sendMessage("[Sent a photo from camera]");
                toast({
                  title: "Photo sent",
                  description: "Your photo was sent successfully"
                });
              }}>
                <Camera className="h-4 w-4 mr-2" />
                Take photo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Microphone Sheet */}
      <Sheet open={micSheet} onOpenChange={setMicSheet}>
        <SheetContent side="bottom" className="h-72">
          <SheetHeader>
            <SheetTitle>Record voice message</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col items-center justify-center h-full">
            <div className="mb-8">
              {recording ? (
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-2">
                    <div className="w-8 h-8 rounded-full bg-red-500 animate-pulse"></div>
                  </div>
                  <Badge variant="secondary" className="text-lg">
                    {`${Math.floor(recordingTime / 60).toString().padStart(2, '0')}:${(recordingTime % 60).toString().padStart(2, '0')}`}
                  </Badge>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-2">
                    <Mic className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <Badge variant="outline">Ready to record</Badge>
                </div>
              )}
            </div>
            
            <div className="flex gap-4">
              {!recording ? (
                <>
                  <Button variant="outline" onClick={() => setMicSheet(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => setRecording(true)}>
                    Start recording
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setRecording(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => {
                    setMicSheet(false);
                    setRecording(false);
                    sendMessage("[Sent a voice message]");
                    toast({
                      title: "Audio sent",
                      description: "Your audio was sent successfully"
                    });
                  }}>
                    Send audio
                  </Button>
                </>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Alert dialog for blocked message */}
      <AlertDialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Message blocked</AlertDialogTitle>
            <AlertDialogDescription>
              This message was blocked by your security settings. 
              Check your security filters to allow this message.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => setShowBlockDialog(false)}>I understand</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation dialog for deleting conversation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this conversation? This action cannot be undone
              and all messages will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={async (e) => {
                e.preventDefault();
                try {
                  setIsDeleting(true);
                  console.log("Deleting conversation:", conversationId);
                  const success = await deleteConversation(conversationId);
                  console.log("Delete conversation result:", success);
                  if (success) {
                    // Update the local conversations list immediately
                    await refreshConversations();
                    
                    toast({
                      title: "Conversa apagada",
                      description: "A conversa foi apagada com sucesso"
                    });
                    
                    // Optionally, redirect to conversation list
                    // router.push('/mensagens');
                  } else {
                    toast({
                      variant: "destructive",
                      title: "Erro",
                      description: "Não foi possível apagar a conversa. Tente novamente."
                    });
                  }
                } catch (error) {
                  console.error("Error deleting conversation:", error);
                  toast({
                    variant: "destructive",
                    title: "Erro",
                    description: "Ocorreu um erro ao apagar a conversa."
                  });
                } finally {
                  setIsDeleting(false);
                  setShowDeleteConfirm(false);
                }
              }}
              className="bg-red-500 hover:bg-red-600 focus:ring-red-500"
            >
              {isDeleting ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation dialog for clearing messages */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Messages</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to clear all messages in this conversation? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={async (e) => {
                e.preventDefault();
                try {
                  setIsClearing(true);
                  console.log("Clearing messages for conversation:", conversationId);
                  const success = await clearMessages(conversationId);
                  console.log("Clear messages result:", success);
                  if (success) {
                    // Update the local conversations list
                    await refreshConversations();
                    
                    // Clear the local messages state immediately for better UX
                    // This will be handled by the Messages component, but we do it here too for immediate feedback
                    toast({
                      title: "Mensagens apagadas",
                      description: "Todas as mensagens foram apagadas com sucesso"
                    });
                  } else {
                    toast({
                      variant: "destructive",
                      title: "Erro",
                      description: "Não foi possível apagar as mensagens. Tente novamente."
                    });
                  }
                } catch (error) {
                  console.error("Error clearing messages:", error);
                  toast({
                    variant: "destructive",
                    title: "Erro",
                    description: "Ocorreu um erro ao apagar as mensagens."
                  });
                } finally {
                  setIsClearing(false);
                  setShowClearConfirm(false);
                }
              }}
              className="bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-500"
              disabled={isClearing}
            >
              {isClearing ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                  Clearing...
                </>
              ) : (
                'Clear All Messages'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
          {/* Hidden file input for attachments */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileSelect}
        accept="*/*"
      />

      

</div>
  );
};

export default ChatView;
