import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import useEncryptedMedia, { MediaMessage, MediaFile, MediaProcessStatus } from './useEncryptedMedia';
import signalProtocolUtils from '@/utils/signalProtocol';

// Define a simple interface for the user_public_keys query result
interface UserPublicKeyResult {
  public_key: string;
}

// Constants
const BUCKET_NAME = 'encrypted-media';

// Interface for media message operations
interface MediaMessagesHookResult {
  // State
  isLoading: boolean;
  loadingMediaIds: string[];
  error: string | null;
  
  // Methods for sending media
  sendMediaMessage: (
    file: File,
    conversationId: string,
    recipientId: string,
    recipientPublicKey: string
  ) => Promise<string | null>;
  
  // Methods for receiving/viewing media
  getMediaMessage: (messageId: string) => Promise<MediaFile | null>;
  isMediaLoading: (messageId: string) => boolean;
  markMediaMessageAsRead: (messageId: string) => Promise<void>;
  
  // Methods for managing media messages
  deleteMediaMessage: (messageId: string) => Promise<boolean>;
  
  // Methods for checking media types
  isMediaMessage: (message: any) => boolean;
  getMediaTypeIcon: (message: any) => string;
}

/**
 * Hook for handling media message operations
 * Integrates with existing messaging systems to provide media functionality
 */
export const useMediaMessages = (): MediaMessagesHookResult => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMediaIds, setLoadingMediaIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    uploadMedia,
    downloadMedia,
    getMediaFile,
    revokeMediaUrl,
    status: mediaStatus
  } = useEncryptedMedia();
  
  // Track loading media IDs
  useEffect(() => {
    if (mediaStatus === MediaProcessStatus.Downloading || 
        mediaStatus === MediaProcessStatus.Decrypting) {
      setIsLoading(true);
    } else if (mediaStatus === MediaProcessStatus.Success || 
               mediaStatus === MediaProcessStatus.Error) {
      setIsLoading(false);
    }
  }, [mediaStatus]);
  
  /**
   * Check if a message is a media message
   * @param message The message to check
   * @returns True if the message is a media message
   */
  const isMediaMessage = useCallback((message: any): boolean => {
    return message && 
           message.is_encrypted === true && 
           message.storage_path && 
           message.type && 
           (message.type === 'image' || 
            message.type === 'video' || 
            message.type === 'audio' || 
            message.type === 'file' || 
            message.type === 'document');
  }, []);
  
  /**
   * Get an icon name for a media type
   * @param message The message
   * @returns The icon name
   */
  const getMediaTypeIcon = useCallback((message: any): string => {
    if (!message || !message.type) return 'file';
    
    switch (message.type) {
      case 'image':
        return 'image';
      case 'video':
        return 'film';
      case 'audio':
        return 'music';
      case 'document':
        return 'file-text';
      default:
        return 'file';
    }
  }, []);
  
  /**
   * Send a media message
   * @param file The file to send
   * @param conversationId The conversation ID
   * @param recipientId The recipient's user ID
   * @param recipientPublicKey The recipient's public key
   * @returns The message ID if successful, null otherwise
   */
  const sendMediaMessage = useCallback(async (
    file: File,
    conversationId: string,
    recipientId: string,
    recipientPublicKey: string
  ): Promise<string | null> => {
    try {
      setError(null);
      setIsLoading(true);
      
      // Upload and encrypt the media
      const messageId = await uploadMedia(
        file,
        conversationId,
        recipientId,
        recipientPublicKey
      );
      
      if (!messageId) {
        throw new Error('Failed to upload media');
      }
      
      // Notify the recipient via Realtime
      try {
        // Send a notification through the realtime channel
        const eventPayload = {
          type: 'new_media_message',
          conversation_id: conversationId,
          message_id: messageId,
          sender_id: user?.id,
          recipient_id: recipientId,
          timestamp: new Date().toISOString()
        };
        
        // Publish to the notification channel
        await supabase.channel('chat_notifications')
          .send({
            type: 'broadcast',
            event: 'media_message',
            payload: eventPayload,
          });
      } catch (notifyError) {
        console.error('Error notifying recipient:', notifyError);
        // Continue even if notification fails
      }
      
      setIsLoading(false);
      return messageId;
      
    } catch (error) {
      console.error('Error sending media message:', error);
      setError(error instanceof Error ? error.message : 'Failed to send media message');
      setIsLoading(false);
      return null;
    }
  }, [user, uploadMedia]);
  
  /**
   * Get a media message
   * @param messageId The message ID
   * @returns The media file
   */
  const getMediaMessage = useCallback(async (messageId: string): Promise<MediaFile | null> => {
    try {
      // Check if we have the media in cache
      const cachedMedia = getMediaFile(messageId);
      if (cachedMedia) {
        return cachedMedia;
      }
      
      // Start loading
      setError(null);
      setLoadingMediaIds(prev => [...prev, messageId]);
      
      // Get the message data
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .select('*, sender:sender_id(id, public_key)')
        .eq('id', messageId)
        .single();
      
      if (messageError) {
        throw new Error(`Failed to load message: ${messageError.message}`);
      }
      
      if (!message) {
        throw new Error('Message not found');
      }
      
      if (!isMediaMessage(message)) {
        throw new Error('Not a media message');
      }
      
      // Get the sender's public key
      let senderPublicKey = '';
      
      const sender = message.sender;
      if (sender) {
        // Once we check for null, we can safely assert the type
        const typedSender = sender as { public_key?: string };
        
        if (typeof typedSender === 'object' && 
            'public_key' in typedSender && 
            typedSender.public_key) {
          senderPublicKey = typedSender.public_key;
        }
      } else {
        // If not available in the database, try to get it from the key store
        try {
          const { data: keyData, error: keyError } = await supabase
            .from('user_public_keys')
            .select('public_key')
            .eq('user_id', message.sender_id)
            .single();
          
          if (keyError) throw keyError;
          if (keyData && 'public_key' in keyData) senderPublicKey = keyData.public_key;
        } catch (keyError) {
          console.error('Error getting sender public key:', keyError);
          throw new Error('Could not retrieve sender public key');
        }
      }
      
      if (!senderPublicKey) {
        throw new Error('Sender public key not available');
      }
      
      // Download and decrypt the media
      const mediaFile = await downloadMedia(
        messageId,
        message.sender_id,
        senderPublicKey
      );
      
      // Remove from loading IDs
      setLoadingMediaIds(prev => prev.filter(id => id !== messageId));
      
      return mediaFile;
      
    } catch (error) {
      console.error('Error getting media message:', error);
      setError(error instanceof Error ? error.message : 'Failed to load media');
      setLoadingMediaIds(prev => prev.filter(id => id !== messageId));
      return null;
    }
  }, [getMediaFile, downloadMedia, isMediaMessage]);
  
  /**
   * Check if a media message is currently loading
   * @param messageId The message ID
   * @returns True if the message is loading
   */
  const isMediaLoading = useCallback((messageId: string): boolean => {
    return loadingMediaIds.includes(messageId);
  }, [loadingMediaIds]);
  
  /**
   * Mark a media message as read
   * @param messageId The message ID
   */
  const markMediaMessageAsRead = useCallback(async (messageId: string): Promise<void> => {
    try {
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('id', messageId);
    } catch (error) {
      console.error('Error marking media message as read:', error);
    }
  }, []);
  
  /**
   * Delete a media message
   * @param messageId The message ID
   * @returns True if successful
   */
  const deleteMediaMessage = useCallback(async (messageId: string): Promise<boolean> => {
    try {
      // Get the message data first
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .select('storage_path')
        .eq('id', messageId)
        .single();
      
      if (messageError || !message) {
        throw new Error('Failed to find message to delete');
      }
      
      // Delete the file from storage
      if (message && 'storage_path' in message && message.storage_path) {
        const { error: storageError } = await supabase.storage
          .from(BUCKET_NAME)
          .remove([message.storage_path as string]);
        
        if (storageError) {
          console.error('Error deleting media file:', storageError);
          // Continue with message deletion even if file deletion fails
        }
      }
      
      // Delete the message from the database
      const { error: deleteError } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);
      
      if (deleteError) {
        throw deleteError;
      }
      
      // Revoke any blob URLs
      revokeMediaUrl(messageId);
      
      return true;
      
    } catch (error) {
      console.error('Error deleting media message:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete media message');
      return false;
    }
  }, [revokeMediaUrl]);
  
  // Return the hook interface
  return {
    isLoading,
    loadingMediaIds,
    error,
    sendMediaMessage,
    getMediaMessage,
    isMediaLoading,
    markMediaMessageAsRead,
    deleteMediaMessage,
    isMediaMessage,
    getMediaTypeIcon
  };
};

export default useMediaMessages;

