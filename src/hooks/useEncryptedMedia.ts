import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import mediaCrypto, { EncryptedMediaMetadata } from '@/utils/mediaCrypto';
import { useToast } from '@/hooks/use-toast';
import signalProtocolUtils from '@/utils/signalProtocol';

// Constants
const BUCKET_NAME = 'encrypted-media';
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB for regular uploads
const MAX_RETRIES = 3; // Maximum number of retry attempts
const RETRY_DELAY = 1000; // Delay between retries in ms

// Type definitions
export enum MediaProcessStatus {
  Idle = 'idle',
  Processing = 'processing',
  Encrypting = 'encrypting',
  Uploading = 'uploading',
  Downloading = 'downloading',
  Decrypting = 'decrypting',
  Success = 'success',
  Error = 'error'
}

export interface MediaMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  type: string;
  storage_path: string;
  encrypted_key: string;
  iv: string;
  thumbnail?: string | null;
  expires_at?: string | null;
  created_at: string;
  read: boolean;
  is_encrypted: boolean;
}

export interface MediaFile {
  id: string;
  blob: Blob;
  url: string;
  mimeType: string;
  fileName: string;
  fileSize: number;
  thumbnailUrl?: string;
}

interface EncryptedMediaHookResult {
  status: MediaProcessStatus;
  progress: number;
  error: string | null;
  mediaFiles: Record<string, MediaFile>; // Map of message IDs to decrypted files
  
  // Upload related methods
  uploadMedia: (
    file: File,
    conversationId: string,
    recipientId: string,
    recipientPublicKey: string
  ) => Promise<string | null>;
  
  // Download related methods
  downloadMedia: (messageId: string, senderId: string, senderPublicKey: string) => Promise<MediaFile | null>;
  getMediaFile: (messageId: string) => MediaFile | null;
  
  // Cleanup
  revokeMediaUrl: (messageId: string) => void;
  clearMediaFiles: () => void;
}

/**
 * Hook for handling encrypted media operations
 * Provides methods for uploading, downloading, and managing encrypted media files
 */
export const useEncryptedMedia = (): EncryptedMediaHookResult => {
  const [status, setStatus] = useState<MediaProcessStatus>(MediaProcessStatus.Idle);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [mediaFiles, setMediaFiles] = useState<Record<string, MediaFile>>({});
  
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Clean up blob URLs when the component unmounts
  useEffect(() => {
    return () => {
      Object.values(mediaFiles).forEach(file => {
        if (file.url) {
          URL.revokeObjectURL(file.url);
        }
        if (file.thumbnailUrl) {
          URL.revokeObjectURL(file.thumbnailUrl);
        }
      });
    };
  }, [mediaFiles]);
  
  /**
   * Upload and encrypt a media file
   * @param file The file to upload
   * @param conversationId The conversation ID
   * @param recipientId The recipient's user ID
   * @param recipientPublicKey The recipient's public key for encryption
   * @returns The message ID if successful, null otherwise
   */
  /**
   * Check if the encrypted-media bucket exists and create it if not
   * @returns Promise<boolean> indicating success
   */
  const ensureBucketExists = async (): Promise<boolean> => {
    try {
      // Check if bucket exists
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      
      if (bucketsError) {
        console.error('Error checking buckets:', bucketsError);
        return false;
      }
      
      // If bucket already exists, return success
      if (buckets && buckets.some(bucket => bucket.name === BUCKET_NAME)) {
        return true;
      }
      
      // Bucket doesn't exist, try to create it
      const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: false,  // Private bucket for security
        fileSizeLimit: MAX_FILE_SIZE,
        allowedMimeTypes: ['application/octet-stream']  // For encrypted content
      });
      
      if (createError) {
        console.error('Error creating bucket:', createError);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error ensuring bucket exists:', error);
      return false;
    }
  };

  /**
   * Upload media with retry mechanism
   * @param storagePath Path in storage bucket
   * @param blob Data to upload
   * @param options Upload options
   * @param retryCount Current retry attempt 
   * @returns Promise with upload result
   */
  const uploadWithRetry = async (
    storagePath: string, 
    blob: Blob, 
    options: any,
    retryCount = 0
  ): Promise<{ error: any | null }> => {
    try {
      // Attempt the upload
      const result = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, blob, options);
      
      // If error is "Bucket not found" and we haven't exceeded retries, 
      // try to create the bucket and retry
      if (result.error) {
        if (result.error.message?.includes('Bucket not found') && retryCount < MAX_RETRIES) {
          console.log(`Bucket not found, attempting to create (retry ${retryCount + 1}/${MAX_RETRIES})`);
          
          // Try to create the bucket
          const bucketCreated = await ensureBucketExists();
          
          if (bucketCreated) {
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            
            // Retry the upload
            return uploadWithRetry(storagePath, blob, options, retryCount + 1);
          }
        } else if (retryCount < MAX_RETRIES) {
          // Other error, but we can still retry
          console.log(`Upload failed, retrying (${retryCount + 1}/${MAX_RETRIES}): ${result.error.message}`);
          
          // Wait longer between each retry (exponential backoff)
          const backoffDelay = RETRY_DELAY * Math.pow(2, retryCount);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          
          // Retry the upload
          return uploadWithRetry(storagePath, blob, options, retryCount + 1);
        }
      }
      
      return result;
    } catch (error) {
      console.error('Unexpected error during upload:', error);
      return { error };
    }
  };

  const uploadMedia = useCallback(async (
    file: File,
    conversationId: string,
    recipientId: string,
    recipientPublicKey: string
  ): Promise<string | null> => {
    try {
      setError(null);
      setStatus(MediaProcessStatus.Processing);
      setProgress(0);
      
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
      }
      
      // Generate thumbnail if it's an image or video
      setProgress(10);
      const thumbData = await mediaCrypto.generateThumbnail(file, file.type);
      
      // Encrypt the file
      setStatus(MediaProcessStatus.Encrypting);
      setProgress(20);
      
      // Generate a new symmetric key
      const symmetricKey = await mediaCrypto.generateSymmetricKey();
      
      // Convert file to ArrayBuffer
      const fileArrayBuffer = await file.arrayBuffer();
      
      // Encrypt the file with the symmetric key
      const { cipher, iv } = await mediaCrypto.encryptMedia(fileArrayBuffer, symmetricKey);
      
      // Encrypt the symmetric key with the recipient's public key
      const { encryptedKey } = await mediaCrypto.encryptKeyForRecipient(
        symmetricKey,
        recipientPublicKey
      );
      
      setProgress(50);
      
      // Upload the encrypted file
      setStatus(MediaProcessStatus.Uploading);
      
      // Generate a unique path for the file
      // Check if user is authenticated
      if (!user?.id) {
        throw new Error('User authentication required for uploading media');
      }
      
      const timestamp = new Date().getTime();
      const safeFileName = file.name
        .replace(/[^a-zA-Z0-9-_.]/g, '_')
        .substring(0, 100);
      
      // Format: userId/conversationId_timestamp_filename 
      // This follows the format expected by RLS policies where
      // auth.uid() = (storage.foldername(name))[1]::uuid
      const storagePath = `${user.id}/${conversationId}_${timestamp}_${safeFileName}`;
      
      // Convert ArrayBuffer to Blob for upload
      const encryptedBlob = new Blob([cipher], { type: 'application/octet-stream' });

      // First, ensure the bucket exists
      const bucketExists = await ensureBucketExists();
      if (!bucketExists) {
        throw new Error('Failed to access or create storage bucket. Please try again or contact support.');
      }
      
      // Upload to Supabase Storage with retry mechanism
      const { error: uploadError } = await uploadWithRetry(
        storagePath, 
        encryptedBlob, 
        {
          contentType: 'application/octet-stream',
          cacheControl: '3600'
        }
      );
      
      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }
      
      setProgress(80);
      
      // Calculate expiry date (30 days from now)
      const expiresAt = mediaCrypto.calculateExpiryDate();
      
      // Prepare metadata for the message
      const metadata: EncryptedMediaMetadata = {
        iv: btoa(String.fromCharCode(...iv)),
        encryptedKey,
        mimeType: file.type,
        fileName: file.name,
        fileSize: file.size,
        thumbnailData: thumbData,
        storagePath,
        expiresAt,
        version: 'v1'
      };
      
      // Store media metadata in the database
      const { data, error: dbError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user?.id,
          content: file.name,
          type: file.type.split('/')[0], // 'image', 'video', 'audio', etc.
          storage_path: metadata.storagePath,
          encrypted_key: metadata.encryptedKey,
          iv: metadata.iv,
          thumbnail: metadata.thumbnailData || null,
          expires_at: metadata.expiresAt,
          created_at: new Date().toISOString(),
          read: false,
          is_encrypted: true
        })
        .select('id')
        .single();
      
      if (dbError) {
        throw new Error(`Failed to store media metadata: ${dbError.message}`);
      }
      
      setProgress(100);
      setStatus(MediaProcessStatus.Success);
      
      // Return the message ID
      return data.id;
      
    } catch (error) {
      console.error('Error uploading encrypted media:', error);
      
      // Provide more specific error messages based on the error type
      let errorMessage = 'Failed to upload media';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Handle specific error types
        if (errorMessage.includes('Bucket not found')) {
          errorMessage = 'Storage system unavailable. Please try again later or contact support.';
        } else if (errorMessage.includes('permission') || errorMessage.includes('access')) {
          errorMessage = 'You do not have permission to upload files. Please check your account status.';
        } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
          errorMessage = 'Network connection issue. Please check your internet connection and try again.';
        }
      }
      
      setError(errorMessage);
      setStatus(MediaProcessStatus.Error);
      
      // Show user-friendly toast message
      toast({
        variant: "destructive",
        title: "Failed to upload file",
        description: errorMessage
      });
      
      return null;
    }
  }, [user, toast]);
  
  /**
   * Download and decrypt a media file
   * @param messageId The message ID containing the media metadata
   * @param senderId The sender's user ID
   * @param senderPublicKey The sender's public key for decryption
   * @returns The decrypted media file or null if an error occurred
   */
  const downloadMedia = useCallback(async (
    messageId: string,
    senderId: string,
    senderPublicKey: string
  ): Promise<MediaFile | null> => {
    try {
      // Check if we already have this file in cache
      if (mediaFiles[messageId]) {
        return mediaFiles[messageId];
      }
      
      setError(null);
      setStatus(MediaProcessStatus.Downloading);
      setProgress(0);
      
      // Fetch media metadata from database
      const { data, error } = await supabase
        .from('messages')
        .select('storage_path, encrypted_key, iv, type, content, created_at, expires_at, thumbnail')
        .eq('id', messageId)
        .single();
      
      if (error) {
        throw new Error(`Failed to fetch media metadata: ${error.message}`);
      }
      
      if (!data) {
        throw new Error('Media not found');
      }
      
      // Helper function for safely accessing properties
      const getSafeProperty = <T,>(obj: any, prop: string, defaultValue: T): T => {
        if (!obj || 'error' in obj) {
          return defaultValue;
        }
        return obj[prop] as T;
      };
      
      // Validate required fields
      if (!getSafeProperty(data, 'storage_path', '') || 
          !getSafeProperty(data, 'encrypted_key', '') || 
          !getSafeProperty(data, 'iv', '')) {
        throw new Error('Invalid media metadata');
      }
      
      // Get download URL for the file
      const { data: { signedUrl }, error: urlError } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(getSafeProperty(data, 'storage_path', ''), 60); // 60 seconds expiry
      
      if (urlError || !signedUrl) {
        throw new Error(`Failed to generate download URL: ${urlError?.message || 'Unknown error'}`);
      }
      
      // Download the encrypted file
      const response = await fetch(signedUrl);
      
      if (!response.ok) {
        throw new Error(`Download failed with status: ${response.status}`);
      }
      
      // Read the response as an ArrayBuffer
      const encryptedData = await response.arrayBuffer();
      
      setProgress(50);
      setStatus(MediaProcessStatus.Decrypting);
      
      // Decrypt the symmetric key using the sender's public key
      const symmetricKey = await mediaCrypto.decryptKeyFromSender(
        getSafeProperty(data, 'encrypted_key', ''),
        senderPublicKey
      );
      
      // Convert base64 IV to Uint8Array
      const ivString = atob(getSafeProperty(data, 'iv', ''));
      const iv = new Uint8Array(ivString.length);
      for (let i = 0; i < ivString.length; i++) {
        iv[i] = ivString.charCodeAt(i);
      }
      
      // Decrypt the file
      const decryptedData = await mediaCrypto.decryptMedia(
        encryptedData,
        symmetricKey,
        iv
      );
      
      // Create a blob from the decrypted data
      const mimeType = getSafeProperty(data, 'type', 'file') || 'application/octet-stream';
      const blob = new Blob([decryptedData], { type: mimeType });
      
      // Create a URL for the blob
      const url = URL.createObjectURL(blob);
      
      // Create a thumbnail URL if available
      let thumbnailUrl: string | undefined;
      const thumbnail = getSafeProperty(data, 'thumbnail', null);
      if (thumbnail) {
        thumbnailUrl = `data:image/jpeg;base64,${thumbnail}`;
      }
      
      setProgress(100);
      setStatus(MediaProcessStatus.Success);
      
      // Create a MediaFile object
      const mediaFile: MediaFile = {
        id: messageId,
        blob,
        url,
        mimeType,
        fileName: getSafeProperty(data, 'content', '') || 'unknown',
        fileSize: blob.size,
        thumbnailUrl
      };
      
      // Update the cache
      setMediaFiles(prev => ({
        ...prev,
        [messageId]: mediaFile
      }));
      
      return mediaFile;
      
    } catch (error) {
      console.error('Error downloading encrypted media:', error);
      setError(error instanceof Error ? error.message : 'Failed to download media');
      setStatus(MediaProcessStatus.Error);
      return null;
    }
  }, [mediaFiles]);
  
  /**
   * Get a cached media file
   * @param messageId The message ID
   * @returns The media file or null if not found
   */
  const getMediaFile = useCallback((messageId: string): MediaFile | null => {
    return mediaFiles[messageId] || null;
  }, [mediaFiles]);
  
  /**
   * Revoke a media URL to free up memory
   * @param messageId The message ID
   */
  const revokeMediaUrl = useCallback((messageId: string): void => {
    const file = mediaFiles[messageId];
    if (file) {
      if (file.url) {
        URL.revokeObjectURL(file.url);
      }
      if (file.thumbnailUrl && file.thumbnailUrl.startsWith('blob:')) {
        URL.revokeObjectURL(file.thumbnailUrl);
      }
      
      setMediaFiles(prev => {
        const newFiles = { ...prev };
        delete newFiles[messageId];
        return newFiles;
      });
    }
  }, [mediaFiles]);
  
  /**
   * Clear all media files and revoke URLs
   */
  const clearMediaFiles = useCallback((): void => {
    Object.values(mediaFiles).forEach(file => {
      if (file.url) {
        URL.revokeObjectURL(file.url);
      }
      if (file.thumbnailUrl && file.thumbnailUrl.startsWith('blob:')) {
        URL.revokeObjectURL(file.thumbnailUrl);
      }
    });
    
    setMediaFiles({});
  }, [mediaFiles]);
  
  return {
    status,
    progress,
    error,
    mediaFiles,
    uploadMedia,
    downloadMedia,
    getMediaFile,
    revokeMediaUrl,
    clearMediaFiles
  };
};

export default useEncryptedMedia;

