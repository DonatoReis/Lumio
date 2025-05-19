import React, { useState, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ProgressWithLabel } from '@/components/ui/progress-with-label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Upload, File, X, FilePlus, CheckCircle2, AlertCircle, ImageIcon, FileText, Film, RotateCw } from 'lucide-react';
import { testStorageConnection } from '@/utils/storage-config';
import mediaCrypto, { EncryptedMediaMetadata } from '@/utils/mediaCrypto';
import imageCompression from 'browser-image-compression';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';

// Constants
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_LARGE_FILE_SIZE = 100 * 1024 * 1024; // 100MB (requires payment for files over 25MB)
const UPLOAD_TIMEOUT = 30000; // 30 seconds
const MAX_RETRY_ATTEMPTS = 3;
const BUCKET_NAME = 'encrypted-media';

// Define the upload stages for better UX feedback
enum UploadStage {
  Idle = 'idle',
  Selecting = 'selecting',
  Processing = 'processing',
  Compressing = 'compressing',
  GeneratingThumbnail = 'generating_thumbnail',
  Encrypting = 'encrypting',
  Uploading = 'uploading',
  Complete = 'complete',
  Error = 'error',
  PaymentRequired = 'payment_required',
  PaymentPending = 'payment_pending'
}

// Media types for different upload behaviors
enum MediaType {
  Image = 'image',
  Video = 'video',
  Audio = 'audio',
  Document = 'document',
  Other = 'other'
}

interface MediaUploaderProps {
  conversationId: string;
  recipientId: string;
  recipientPublicKey: string;
  onUploadComplete: (metadata: EncryptedMediaMetadata) => void;
  onCancel: () => void;
  maxFileSize?: number;
  acceptedTypes?: string;
  showThumbnail?: boolean;
}

const MediaUploader: React.FC<MediaUploaderProps> = ({
  conversationId,
  recipientId,
  recipientPublicKey,
  onUploadComplete,
  onCancel,
  maxFileSize = MAX_FILE_SIZE,
  acceptedTypes = '*/*',
  showThumbnail = true
}) => {
  // State for file and upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<UploadStage>(UploadStage.Idle);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>(MediaType.Other);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isLargeFile, setIsLargeFile] = useState(false);
  const [paymentSessionId, setPaymentSessionId] = useState<string | null>(null);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  
  // References
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Hooks
  const { toast } = useToast();
  const { user } = useAuth();

  // Reset component on unmount
  useEffect(() => {
    return () => {
      if (uploadTimeoutRef.current) {
        clearTimeout(uploadTimeoutRef.current);
      }
      // Clean up any blob URLs
      if (filePreview) {
        URL.revokeObjectURL(filePreview);
      }
    };
  }, [filePreview]);

  // Detect media type from file
  const detectMediaType = (file: File): MediaType => {
    const mimeType = file.type.toLowerCase();
    
    if (mimeType.startsWith('image/')) {
      return MediaType.Image;
    } else if (mimeType.startsWith('video/')) {
      return MediaType.Video;
    } else if (mimeType.startsWith('audio/')) {
      return MediaType.Audio;
    } else if (
      mimeType === 'application/pdf' ||
      mimeType.includes('document') ||
      mimeType.includes('text/') ||
      mimeType.includes('spreadsheet')
    ) {
      return MediaType.Document;
    }
    
    return MediaType.Other;
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    const file = files[0];
    
    // Check file size
    if (file.size > MAX_LARGE_FILE_SIZE) {
      setUploadError(`File too large. Maximum size is ${MAX_LARGE_FILE_SIZE / (1024 * 1024)}MB.`);
      setUploadStage(UploadStage.Error);
      return;
    }

    // Check if payment is required
    if (file.size > maxFileSize) {
      setIsLargeFile(true);
      setUploadStage(UploadStage.PaymentRequired);
    }

    // Process the selected file
    const type = detectMediaType(file);
    setMediaType(type);
    setSelectedFile(file);
    
    // Generate preview for visual media
    if (type === MediaType.Image || type === MediaType.Video) {
      setFilePreview(URL.createObjectURL(file));
    }
    
    setUploadStage(UploadStage.Processing);
  };

  // Trigger file input click
  const triggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
    setUploadStage(UploadStage.Selecting);
  };

  // Reset the component state
  const resetState = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setUploadProgress(0);
    setUploadStage(UploadStage.Idle);
    setUploadError(null);
    setThumbnail(null);
    setRetryCount(0);
    setIsLargeFile(false);
    setPaymentSessionId(null);
    
    // Clear any input value
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Preprocess file before encryption (compression for images, etc.)
  const preprocessFile = async (file: File): Promise<File> => {
    if (!file) return file;
    
    try {
      // For images, compress if needed
      if (mediaType === MediaType.Image) {
        setUploadStage(UploadStage.Compressing);
        
        // Only compress if over 1MB
        if (file.size > 1024 * 1024) {
          const options = {
            maxSizeMB: 1, // Max size in MB
            useWebWorker: true,
            maxWidthOrHeight: 1920 // Limit dimensions
          };
          
          // Compress the image
          const compressedFile = await imageCompression(file, options);
          setUploadProgress(20);
          return compressedFile;
        }
      }
      
      // For videos and other types, we could add processing here
      // but for now just return the original file
      setUploadProgress(20);
      return file;
    } catch (error) {
      console.error('Error during file preprocessing:', error);
      // If compression fails, use the original file
      return file;
    }
  };

  // Generate thumbnail for the file
  const generateFilePreview = async (file: File): Promise<string | null> => {
    if (!file || !showThumbnail) return null;
    
    try {
      setUploadStage(UploadStage.GeneratingThumbnail);
      const thumbData = await mediaCrypto.generateThumbnail(file, file.type);
      setUploadProgress(40);
      return thumbData;
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      // Continue without thumbnail
      return null;
    }
  };

  // Encrypt file with symmetric key
  const encryptFile = async (file: File): Promise<{
    cipher: ArrayBuffer;
    iv: Uint8Array;
    encryptedKey: string;
    symmetricKey: CryptoKey;
  }> => {
    try {
      setUploadStage(UploadStage.Encrypting);
      
      // Generate a new symmetric key for this file
      const symmetricKey = await mediaCrypto.generateSymmetricKey();
      
      // Read file as ArrayBuffer
      const fileArrayBuffer = await file.arrayBuffer();
      
      // Encrypt the file
      const { cipher, iv } = await mediaCrypto.encryptMedia(fileArrayBuffer, symmetricKey);
      
      // Encrypt the symmetric key with recipient's public key
      const { encryptedKey } = await mediaCrypto.encryptKeyForRecipient(
        symmetricKey,
        recipientPublicKey
      );
      
      setUploadProgress(60);
      
      return {
        cipher,
        iv,
        encryptedKey,
        symmetricKey
      };
    } catch (error) {
      console.error('Error encrypting file:', error);
      throw new Error('Failed to encrypt file securely.');
    }
  };

  // Upload encrypted file to Supabase Storage
  const uploadEncryptedFile = async (
    cipher: ArrayBuffer,
    fileName: string,
    mimeType: string
  ): Promise<string> => {
    try {
      setUploadStage(UploadStage.Uploading);
      
      // Ensure the storage connection works
      const connectionTest = await testStorageConnection();
      if (!connectionTest.success) {
        throw new Error(`Storage connection failed: ${connectionTest.error}`);
      }
      
      // Check if the encrypted_media bucket exists
      const buckets = connectionTest.buckets || [];
      if (!buckets.includes(BUCKET_NAME)) {
        // Create the bucket if it doesn't exist
        const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
          public: false, // Private bucket
          fileSizeLimit: MAX_LARGE_FILE_SIZE, // 100MB limit
        });
        
        if (error) {
          throw new Error(`Failed to create storage bucket: ${error.message}`);
        }
      }
      
      // Generate a unique path: conversationId/timestamp-fileName
      const timestamp = new Date().getTime();
      const fileExtension = fileName.split('.').pop() || '';
      const safeFileName = fileName
        .replace(/[^a-zA-Z0-9-_.]/g, '_') // Replace special chars with underscore
        .substring(0, 100); // Limit length
      
      const storagePath = `${conversationId}/${timestamp}_${safeFileName}`;
      
      // Convert ArrayBuffer to Blob
      const encryptedBlob = new Blob([cipher], { type: 'application/octet-stream' });
      
      // Upload the encrypted file
      const { error: uploadError, data } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, encryptedBlob, {
          contentType: 'application/octet-stream', // Always use this content type for encrypted data
          cacheControl: '3600' // 1 hour cache
        });
      
      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }
      
      setUploadProgress(90);
      return storagePath;
    } catch (error) {
      console.error('Error uploading encrypted file:', error);
      throw new Error(`Failed to upload file securely: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Store metadata in Supabase database
  const storeMediaMetadata = async (metadata: EncryptedMediaMetadata): Promise<string> => {
    try {
      // Insert new message with media metadata
      const { error, data } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user?.id,
          content: metadata.fileName,
          type: mediaType.toLowerCase(),
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
      
      if (error) {
        throw new Error(`Failed to store media metadata: ${error.message}`);
      }
      
      return data.id;
    } catch (error) {
      console.error('Error storing media metadata:', error);
      throw new Error('Failed to finalize media sharing.');
    }
  };

  // Process payment for large files
  const initiatePayment = async (): Promise<boolean> => {
    if (!isLargeFile) return true; // No payment needed
    
    try {
      setUploadStage(UploadStage.PaymentPending);
      
      // Call your payment API endpoint
      const response = await fetch('/api/create-payment-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileSize: selectedFile?.size || 0,
          fileName: selectedFile?.name || 'Unknown file',
          userId: user?.id,
          conversationId
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Payment initiation failed');
      }
      
      const { sessionId, url } = await response.json();
      setPaymentSessionId(sessionId);
      
      // Redirect to payment page
      window.open(url, '_blank');
      
      // In a real implementation, you would listen for a webhook
      // Here we'll simulate payment completion after a delay for demonstration
      // In production, you'd implement a proper webhook handler
      
      // For demo purposes only - replace with real webhook handling
      setTimeout(() => {
        setPaymentCompleted(true);
      }, 2000);
      
      return new Promise(resolve => {
        setTimeout(() => {
          // Simulate successful payment
          toast({
            title: "Payment successful",
            description: "Your large file upload is now authorized.",
          });
          resolve(true);
        }, 3000);
      });
      
    } catch (error) {
      console.error('Payment error:', error);
      setUploadError('Payment process failed. Please try again.');
      setUploadStage(UploadStage.Error);
      return false;
    }
  };

  // Check payment status
  const checkPaymentStatus = async (sessionId: string): Promise<boolean> => {
    try {
      // For demo purposes, simulate payment verification
      console.log('Checking payment status for session:', sessionId);
      return paymentCompleted; // In production, implement actual verification
    } catch (error) {
      console.error('Error checking payment status:', error);
      return false;
    }
  };

  // Main upload function - orchestrates the entire process
  const processAndUploadFile = async () => {
    if (!selectedFile) {
      setUploadError('No file selected.');
      setUploadStage(UploadStage.Error);
      return;
    }
    
    try {
      // Handle payment for large files if needed
      if (isLargeFile) {
        const paymentSuccess = await initiatePayment();
        if (!paymentSuccess) return;
      }
      
      // Setup timeout for the overall process
      uploadTimeoutRef.current = setTimeout(() => {
        if (uploadStage !== UploadStage.Complete && uploadStage !== UploadStage.Error) {
          setUploadError('Upload timed out. Please try again with a smaller file or better connection.');
          setUploadStage(UploadStage.Error);
        }
      }, UPLOAD_TIMEOUT);
      
      // Step 1: Preprocess the file (compress if it's an image)
      const processedFile = await preprocessFile(selectedFile);
      
      // Step 2: Generate thumbnail if supported
      const thumbData = await generateFilePreview(processedFile);
      setThumbnail(thumbData);
      
      // Step 3: Encrypt the file
      const { cipher, iv, encryptedKey } = await encryptFile(processedFile);
      
      // Step 4: Upload the encrypted file to Supabase Storage
      const storagePath = await uploadEncryptedFile(
        cipher,
        processedFile.name,
        processedFile.type
      );
      
      // Step 5: Calculate expiry date
      const expiresAt = mediaCrypto.calculateExpiryDate();
      
      // Step 6: Prepare metadata
      const metadata: EncryptedMediaMetadata = {
        iv: btoa(String.fromCharCode(...iv)),
        encryptedKey,
        mimeType: processedFile.type,
        fileName: processedFile.name,
        fileSize: processedFile.size,
        thumbnailData: thumbData,
        storagePath,
        expiresAt,
        version: 'v1'
      };
      
      // Step 7: Store metadata in Supabase and get the message ID
      const messageId = await storeMediaMetadata(metadata);
      
      // Step 8: Complete
      setUploadProgress(100);
      setUploadStage(UploadStage.Complete);
      
      // Clear timeout
      if (uploadTimeoutRef.current) {
        clearTimeout(uploadTimeoutRef.current);
        uploadTimeoutRef.current = null;
      }
      
      // Notify parent component
      onUploadComplete(metadata);
      
      // Show success toast
      toast({
        title: "Upload successful",
        description: "Your file has been securely encrypted and shared.",
      });
      
      // Reset after short delay
      setTimeout(() => {
        resetState();
      }, 2000);
      
    } catch (error) {
      console.error('Upload process error:', error);
      setUploadError(error instanceof Error ? error.message : 'Unknown error occurred');
      setUploadStage(UploadStage.Error);
      
      // Clear timeout
      if (uploadTimeoutRef.current) {
        clearTimeout(uploadTimeoutRef.current);
        uploadTimeoutRef.current = null;
      }
      
      // If we haven't exceeded retry count, offer to retry
      if (retryCount < MAX_RETRY_ATTEMPTS) {
        setRetryCount(prev => prev + 1);
      }
    }
  };

  // Retry the upload
  const handleRetry = () => {
    setUploadError(null);
    setUploadProgress(0);
    setUploadStage(UploadStage.Processing);
    processAndUploadFile();
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      triggerFileSelect();
    } else {
      processAndUploadFile();
    }
  };

  // Render file icon based on media type
  const renderFileIcon = () => {
    switch (mediaType) {
      case MediaType.Image:
        return <ImageIcon className="h-16 w-16 text-primary" />;
      case MediaType.Video:
        return <Film className="h-16 w-16 text-primary" />;
      case MediaType.Document:
        return <FileText className="h-16 w-16 text-primary" />;
      case MediaType.Audio:
        return <File className="h-16 w-16 text-primary" />;
      default:
        return <File className="h-16 w-16 text-primary" />;
    }
  };
  // Render file preview

  // Render file preview
  const renderFilePreview = () => {
    if (filePreview && (mediaType === MediaType.Image)) {
      return (
        <div className="relative w-full max-w-sm mx-auto">
          <img 
            src={filePreview} 
            alt="Preview" 
            className="rounded-md max-h-64 max-w-full object-contain border border-border"
          />
        </div>
      );
    } else if (filePreview && mediaType === MediaType.Video) {
      return (
        <div className="relative w-full max-w-sm mx-auto">
          <video 
            src={filePreview} 
            className="rounded-md max-h-64 max-w-full border border-border" 
            controls
          />
        </div>
      );
    } else if (selectedFile) {
      return (
        <div className="flex flex-col items-center justify-center p-4">
          {renderFileIcon()}
          <div className="mt-2 text-center">
            <p className="font-medium text-foreground">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {((selectedFile.size / 1024 / 1024)).toFixed(2)} MB
            </p>
          </div>
        </div>
      );
    }
    
    return null;
  };

  // Render progress indicator
  const renderProgressIndicator = () => {
    if (uploadStage === UploadStage.Complete) {
      return (
        <div className="flex items-center justify-center gap-2 text-green-500">
          <CheckCircle2 className="h-5 w-5" />
          <span>Upload complete</span>
        </div>
      );
    }
    
    if (uploadStage === UploadStage.Error) {
      return (
        <div className="flex items-center justify-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>{uploadError || 'An error occurred'}</span>
        </div>
      );
    }
    
    if (
      uploadStage === UploadStage.Processing ||
      uploadStage === UploadStage.Compressing ||
      uploadStage === UploadStage.GeneratingThumbnail ||
      uploadStage === UploadStage.Encrypting ||
      uploadStage === UploadStage.Uploading
    ) {
      return (
        <div className="w-full space-y-2">
          <ProgressWithLabel
            value={uploadProgress}
            label={
              uploadStage === UploadStage.Compressing
                ? "Compressing"
                : uploadStage === UploadStage.GeneratingThumbnail
                ? "Generating thumbnail"
                : uploadStage === UploadStage.Encrypting
                ? "Encrypting"
                : uploadStage === UploadStage.Uploading
                ? "Uploading"
                : "Processing"
            }
          />
        </div>
      );
    }
    
    return null;
  };


  // Render payment dialog
  const renderPaymentDialog = () => {
    if (uploadStage !== UploadStage.PaymentRequired) return null;
    
    return (
      <Dialog open={uploadStage === UploadStage.PaymentRequired} onOpenChange={() => resetState()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Large File Payment Required</DialogTitle>
            <DialogDescription>
              Files larger than {maxFileSize / (1024 * 1024)}MB require a payment to cover storage and bandwidth costs.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
              <p className="text-sm text-muted-foreground mb-4">
              Your file "{selectedFile?.name}" is {((selectedFile?.size || 0) / (1024 * 1024)).toFixed(2)}MB.
            </p>
            
            <div className="bg-muted p-3 rounded-md">
              <p className="text-sm font-medium">Payment details:</p>
              <p className="text-sm">• One-time fee: $2.99</p>
              <p className="text-sm">• File stored for 30 days</p>
              <p className="text-sm">• End-to-end encrypted transfer</p>
            </div>
          </div>
          
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => resetState()}>
              Cancel
            </Button>
            <Button onClick={() => processAndUploadFile()}>
              Proceed to Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 bg-background rounded-md shadow-sm border border-border">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept={acceptedTypes}
          onChange={handleFileSelect}
        />
        
        {/* File upload area */}
        {!selectedFile && (
          <div
            className="border-2 border-dashed border-border rounded-md p-6 text-center cursor-pointer hover:bg-accent/30 transition-colors"
            onClick={triggerFileSelect}
          >
            <FilePlus className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Click to select a file or drag and drop
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Max size: {maxFileSize / (1024 * 1024)}MB
            </p>
          </div>
        )}
        
        {/* File preview */}
        {selectedFile && (
          <div className="mt-4">
            {renderFilePreview()}
          </div>
        )}
        
        {/* Progress indicator */}
        {renderProgressIndicator()}
        
        {/* Action buttons */}
        <div className="flex justify-between gap-2 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={uploadStage === UploadStage.Uploading || uploadStage === UploadStage.Encrypting}
          >
            Cancel
          </Button>
          
          {uploadStage === UploadStage.Error && retryCount < MAX_RETRY_ATTEMPTS ? (
            <Button type="button" onClick={handleRetry}>
              Retry
            </Button>
          ) : (
            <Button 
              type="submit" 
              disabled={uploadStage === UploadStage.Uploading || uploadStage === UploadStage.Encrypting}
            >
              {selectedFile ? (
                uploadStage === UploadStage.Idle || uploadStage === UploadStage.Processing ? (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </>
                ) : uploadStage === UploadStage.Complete ? (
                  'Complete'
                ) : (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing
                  </>
                )
              ) : (
                'Select File'
              )}
            </Button>
          )}
        </div>
      </form>
      
      {/* Payment dialog */}
      {renderPaymentDialog()}
    </div>
  );
};

export default MediaUploader;

