import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ProgressWithLabel } from '@/components/ui/progress-with-label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Download, File, AlertCircle, ImageIcon, FileText, Film, Play, Pause, RotateCw, X } from 'lucide-react';
import mediaCrypto, { EncryptedMediaMetadata } from '@/utils/mediaCrypto';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

// Constants
const BUCKET_NAME = 'encrypted-media';
const DOWNLOAD_TIMEOUT = 60000; // 60 seconds
const MAX_RETRY_ATTEMPTS = 3;

// Media types for different viewer behaviors
enum MediaType {
  Image = 'image',
  Video = 'video',
  Audio = 'audio',
  Document = 'document',
  Other = 'other'
}

// Process stages for better UX feedback
enum ProcessStage {
  Idle = 'idle',
  LoadingMetadata = 'loading_metadata',
  Downloading = 'downloading',
  Decrypting = 'decrypting',
  Ready = 'ready',
  Error = 'error'
}

interface MediaViewerProps {
  messageId: string; // ID of the message containing the media
  conversationId: string;
  senderId: string;
  senderPublicKey: string;
  onClose?: () => void;
  autoPlay?: boolean;
  showControls?: boolean;
  className?: string;
}

const MediaViewer: React.FC<MediaViewerProps> = ({
  messageId,
  conversationId,
  senderId,
  senderPublicKey,
  onClose,
  autoPlay = true,
  showControls = true,
  className = ''
}) => {
  // State for media
  const [mediaMetadata, setMediaMetadata] = useState<EncryptedMediaMetadata | null>(null);
  const [mediaBlob, setMediaBlob] = useState<Blob | null>(null);
  const [mediaBlobUrl, setMediaBlobUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>(MediaType.Other);
  const [processStage, setProcessStage] = useState<ProcessStage>(ProcessStage.Idle);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // References
  const downloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Hooks
  const { toast } = useToast();
  const { user } = useAuth();

  // Cleanup function
  useEffect(() => {
    return () => {
      if (downloadTimeoutRef.current) {
        clearTimeout(downloadTimeoutRef.current);
      }
      
      // Revoke any blob URLs
      if (mediaBlobUrl) {
        URL.revokeObjectURL(mediaBlobUrl);
      }
    };
  }, [mediaBlobUrl]);

  // Load media metadata on mount
  const fetchMediaMetadata = useCallback(async () => {
    try {
      setProcessStage(ProcessStage.LoadingMetadata);

  // Detect media type from mime type
  const detectMediaType = (mimeType: string): MediaType => {
    mimeType = mimeType.toLowerCase();
    
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

  // Fetch media metadata from the database
  const fetchMediaMetadata = async () => {
    try {
      setProcessStage(ProcessStage.LoadingMetadata);
      
      const { data, error } = await supabase
        .from('messages')
        .select('storage_path, encrypted_key, iv, type, created_at, expires_at, thumbnail, content')
        .eq('id', messageId)
        .single();
      
      if (error) {
        throw new Error(`Failed to fetch media metadata: ${error.message}`);
      }
      
      if (!data) {
        throw new Error('Media not found');
      }
      
      type MediaData = {
        storage_path: string;
        encrypted_key: string;
        iv: string;
        type?: string;
        content?: string;
        thumbnail?: string | null;
        expires_at?: string | null;
      };
      
      // Check if data exists and doesn't have an error property
if (!data || 'error' in data) {
  throw new Error('Invalid media data');
}

const messageData = data as MediaData;
      
      if (!messageData.storage_path || !messageData.encrypted_key || !messageData.iv) {
        throw new Error('Invalid media metadata');
      }
      
      const metadata: EncryptedMediaMetadata = {
        storagePath: messageData.storage_path,
        encryptedKey: messageData.encrypted_key,
        iv: messageData.iv,
        mimeType: messageData.type || 'application/octet-stream',
        fileName: messageData.content || 'unknown',
        fileSize: 0, // Will be updated after download
        thumbnailData: messageData.thumbnail || null,
        expiresAt: messageData.expires_at || '',
        version: 'v1'
      };
      
      setMediaMetadata(metadata);
      setMediaType(detectMediaType(metadata.mimeType));
      
      // If there's a thumbnail, we can download and decrypt the full media
      if (metadata.thumbnailData) {
        setProgress(10);
      }
      
      // Start download process
      await downloadAndDecryptMedia(metadata);
      
    } catch (error: any) {
      if (error instanceof Error) {
        console.error('Error fetching media metadata:', error);
        setError(error.message);
        setProcessStage(ProcessStage.Error);
    }
  };

  // Download and decrypt the media
  const downloadAndDecryptMedia = async (metadata: EncryptedMediaMetadata) => {
    try {
      setProcessStage(ProcessStage.Downloading);
      
      // Set a timeout for the download
      downloadTimeoutRef.current = setTimeout(() => {
        if (processStage !== ProcessStage.Ready) {
          setError('Download timed out. Please try again.');
          setProcessStage(ProcessStage.Error);
        }
      }, DOWNLOAD_TIMEOUT);
      
      // Get download URL for the file
      const { data: { signedUrl }, error: urlError } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(metadata.storagePath, 60); // 60 seconds expiry
      
      if (urlError || !signedUrl) {
        throw new Error(`Failed to generate download URL: ${urlError?.message || 'Unknown error'}`);
      }
      
      // Download the encrypted file
      const response = await fetch(signedUrl);
      
      if (!response.ok) {
        throw new Error(`Download failed with status: ${response.status}`);
      }
      
      // Get content length for progress calculation
      const contentLength = response.headers.get('content-length');
      const totalSize = contentLength ? parseInt(contentLength, 10) : 0;
      
      // Create a reader to stream the response
      const reader = response.body?.getReader();
      
      if (!reader) {
        throw new Error('Unable to read response body');
      }
      
      // Read the encrypted data with progress updates
      const chunks: Uint8Array[] = [];
      
      while (true) {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        chunks.push(value);
        receivedLength += value.length;
        
        if (totalSize) {
          // Update progress (40% for download, 40% for decryption, 20% for initial)
          const downloadProgress = 20 + Math.min(receivedLength / totalSize * 40, 40);
          setProgress(Math.round(downloadProgress));
        }
      }
      
      // Combine chunks into a single Uint8Array
      const encryptedData = new Uint8Array(receivedLength);
      let position = 0;
      
      for (const chunk of chunks) {
        encryptedData.set(chunk, position);
        position += chunk.length;
      }
      
      setProgress(60);
      setProcessStage(ProcessStage.Decrypting);
      
      // Decrypt the symmetric key using sender's public key
      const ephemeralPublicKey = ""; // This should be retrieved from the metadata
      const symmetricKey = await mediaCrypto.decryptKeyFromSender(
        metadata.encryptedKey,
        ephemeralPublicKey || senderPublicKey // Fallback to sender's public key if ephemeral key is not available
      );
      
      // Convert base64 IV to Uint8Array
      const ivString = atob(metadata.iv);
      const iv = new Uint8Array(ivString.length);
      for (let i = 0; i < ivString.length; i++) {
        iv[i] = ivString.charCodeAt(i);
      }
      
      // Decrypt the file
      const decryptedData = await mediaCrypto.decryptMedia(
        encryptedData.buffer,
        symmetricKey,
        iv
      );
      
      setProgress(90);
      
      // Create a blob from the decrypted data
      const blob = new Blob([decryptedData], { type: metadata.mimeType });
      setMediaBlob(blob);
      
      // Create a URL for the blob
      const url = URL.createObjectURL(blob);
      setMediaBlobUrl(url);
      
      // Update file size in metadata
      metadata.fileSize = blob.size;
      setMediaMetadata(metadata);
      
      setProgress(100);
      setProcessStage(ProcessStage.Ready);
      
      // Auto-play if enabled and it's audio/video
      if (autoPlay && (mediaType === MediaType.Video || mediaType === MediaType.Audio)) {
        setTimeout(() => {
          if (mediaType === MediaType.Video && videoRef.current) {
            videoRef.current.play();
            setIsPlaying(true);
          } else if (mediaType === MediaType.Audio && audioRef.current) {
            audioRef.current.play();
            setIsPlaying(true);
          }
        }, 100);
      }
      
      // Clear the timeout
      if (downloadTimeoutRef.current) {
        clearTimeout(downloadTimeoutRef.current);
        downloadTimeoutRef.current = null;
      }
      
    } catch (error) {
      console.error('Error downloading and decrypting media:', error);
      setError(error instanceof Error ? error.message : 'Failed to download or decrypt media');
      setProcessStage(ProcessStage.Error);
      
      // Clear the timeout
      if (downloadTimeoutRef.current) {
        clearTimeout(downloadTimeoutRef.current);
        downloadTimeoutRef.current = null;
      }
      
      // If we haven't exceeded retry count, offer retry
      if (retryCount < MAX_RETRY_ATTEMPTS) {
        setRetryCount(prev => prev + 1);
      }
    }
  };

  useEffect(() => {
    fetchMediaMetadata();
  }, [fetchMediaMetadata]);

  // Handle retry
  const handleRetry = () => {
    setError(null);
    setProgress(0);
    setProcessStage(ProcessStage.Idle);
    
    if (mediaMetadata) {
      downloadAndDecryptMedia(mediaMetadata);
    } else {
      fetchMediaMetadata();
    }
  };

  // Handle play/pause for audio and video
  const togglePlayPause = () => {
    if (mediaType === MediaType.Video && videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
    } else if (mediaType === MediaType.Audio && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  // Download the decrypted file
  const handleDownload = () => {
    if (!mediaBlob || !mediaMetadata) return;
    
    try {
      // Create a download link
      const downloadLink = document.createElement('a');
      downloadLink.href = mediaBlobUrl || '';
      downloadLink.download = mediaMetadata.fileName;
      
      // Trigger download
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      toast({
        title: "Download started",
        description: `Downloading ${mediaMetadata.fileName}`,
      });
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Download failed",
        description: "Failed to download file. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Render loading state
  const renderLoading = () => {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 p-8">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <ProgressWithLabel 
          value={progress} 
          label={
            processStage === ProcessStage.LoadingMetadata
              ? "Loading metadata"
              : processStage === ProcessStage.Downloading
              ? "Downloading"
              : "Decrypting"
          }
        />
        {mediaMetadata?.thumbnailData && (
          <div className="relative w-full max-w-sm mx-auto mt-4 opacity-60">
            <img 
              src={`data:image/jpeg;base64,${mediaMetadata.thumbnailData}`} 
              alt="Thumbnail" 
              className="rounded-md max-h-48 max-w-full object-contain border border-border"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-background/40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render error state
  const renderError = () => {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-5 w-5" />
          <AlertDescription>
            {error || 'Failed to load media'}
          </AlertDescription>
        </Alert>
        
        {retryCount < MAX_RETRY_ATTEMPTS && (
          <Button onClick={handleRetry} className="mt-4">
            <RotateCw className="h-4 w-4 mr-2" />
            Retry Download
          </Button>
        )}
      </div>
    );
  };

  // Render image viewer
  const renderImageViewer = () => {
    if (!mediaBlobUrl) return null;
    
    return (
      <div className="flex flex-col space-y-4">
        <div className="relative w-full max-w-xl mx-auto">
          <img 
            src={mediaBlobUrl} 
            alt={mediaMetadata?.fileName || 'Image'} 
            className="rounded-md max-h-[70vh] max-w-full object-contain border border-border"
          />
        </div>
        
        <div className="flex justify-between items-center p-2">
          <div className="text-sm">
            <p className="font-medium">{mediaMetadata?.fileName}</p>
            <p className="text-muted-foreground">
              {mediaMetadata?.fileSize 
                ? `${(mediaMetadata.fileSize / 1024 / 1024).toFixed(2)} MB` 
                : ''}
            </p>
          </div>
          
          <Button onClick={handleDownload} size="sm" variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </div>
    );
  };

  // Render video viewer
  const renderVideoViewer = () => {
    if (!mediaBlobUrl) return null;
    
    return (
      <div className="flex flex-col space-y-4">
        <div className="relative w-full max-w-xl mx-auto bg-black rounded-md overflow-hidden">
          <video 
            ref={videoRef}
            src={mediaBlobUrl} 
            className="w-full max-h-[70vh]"
            controls={showControls}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
          />
          
          {!showControls && (
            <div className="absolute bottom-4 left-4 right-4 flex justify-center">
              <Button 
                variant="outline" 
                size="icon" 
                className="bg-background/80 backdrop-blur-sm"
                onClick={togglePlayPause}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </Button>
            </div>
          )}
        </div>
        
        <div className="flex justify-between items-center p-2">
          <div className="text-sm">
            <p className="font-medium">{mediaMetadata?.fileName}</p>
            <p className="text-muted-foreground">
              {mediaMetadata?.fileSize 
                ? `${(mediaMetadata.fileSize / 1024 / 1024).toFixed(2)} MB` 
                : ''}
            </p>
          </div>
          
          <Button onClick={handleDownload} size="sm" variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </div>
    );
  };

  // Render audio viewer
  const renderAudioViewer = () => {
    if (!mediaBlobUrl) return null;
    
    return (
      <div className="flex flex-col space-y-4">
        <Card className="w-full max-w-xl mx-auto p-6">
          <CardContent className="p-0 flex flex-col space-y-4">
            <div className="flex items-center justify-center p-4">
              <svg 
                className="h-24 w-24 text-primary" 
                viewBox="0 0 100 100" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="50" cy="50" r="45" className="fill-primary/10 stroke-primary/80" strokeWidth="2"/>
                <rect x="35" y="30" width="8" height="40" rx="4" className="fill-primary/80">
                  <animate attributeName="height" values="40;15;40" dur="1s" repeatCount={isPlaying ? "indefinite" : "0"}/>
                  <animate attributeName="y" values="30;42.5;30" dur="1s" repeatCount={isPlaying ? "indefinite" : "0"}/>
                </rect>
                <rect x="47" y="25" width="8" height="50" rx="4" className="fill-primary/80">
                  <animate attributeName="height" values="50;20;50" dur="1.3s" repeatCount={isPlaying ? "indefinite" : "0"}/>
                  <animate attributeName="y" values="25;40;25" dur="1.3s" repeatCount={isPlaying ? "indefinite" : "0"}/>
                </rect>
                <rect x="59" y="35" width="8" height="30" rx="4" className="fill-primary/80">
                  <animate attributeName="height" values="30;10;30" dur="0.8s" repeatCount={isPlaying ? "indefinite" : "0"}/>
                  <animate attributeName="y" values="35;45;35" dur="0.8s" repeatCount={isPlaying ? "indefinite" : "0"}/>
                </rect>
              </svg>
            </div>
            
            <div className="w-full">
              <audio 
                ref={audioRef}
                src={mediaBlobUrl} 
                className="w-full" 
                controls={showControls}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
              />
              
              {!showControls && (
                <div className="mt-4 flex justify-center">
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={togglePlayPause}
                  >
                    {isPlaying ? (
                      <Pause className="h-5 w-5" />
                    ) : (
                      <Play className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        <div className="flex justify-between items-center p-2">
          <div className="text-sm">
            <p className="font-medium">{mediaMetadata?.fileName}</p>
            <p className="text-muted-foreground">
              {mediaMetadata?.fileSize 
                ? `${(mediaMetadata.fileSize / 1024 / 1024).toFixed(2)} MB` 
                : ''}
            </p>
          </div>
          
          <Button onClick={handleDownload} size="sm" variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </div>
    );
  };

  // Render document or other file viewer
  const renderDocumentViewer = () => {
    if (!mediaBlobUrl) return null;
    
    const isPdf = mediaMetadata?.mimeType === 'application/pdf';
    
    return (
      <div className="flex flex-col space-y-4">
        <Card className="w-full max-w-xl mx-auto p-6">
          <CardContent className="p-0 flex flex-col items-center space-y-4">
            <div className="flex items-center justify-center p-4">
              {isPdf ? (
                <FileText className="h-24 w-24 text-primary" />
              ) : (
                <File className="h-24 w-24 text-primary" />
              )}
            </div>
            
            <div className="text-center">
              <h3 className="text-lg font-medium">{mediaMetadata?.fileName}</h3>
              <p className="text-sm text-muted-foreground">
                {mediaMetadata?.fileSize 
                  ? `${(mediaMetadata.fileSize / 1024 / 1024).toFixed(2)} MB` 
                  : ''}
              </p>
            </div>
            
            {isPdf && mediaBlobUrl && (
              <div className="w-full mt-4">
                <object
                  data={mediaBlobUrl}
                  type="application/pdf"
                  width="100%"
                  height="500px"
                  className="border border-border rounded-md"
                >
                  <p>PDF cannot be displayed. Please download the file to view it.</p>
                </object>
              </div>
            )}
            
            <Button onClick={handleDownload} className="mt-4">
              <Download className="h-4 w-4 mr-2" />
              Download {mediaMetadata?.fileName}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Render media content based on type and process stage
  const renderMediaContent = () => {
    if (processStage === ProcessStage.Error) {
      return renderError();
    }
    
    if (processStage !== ProcessStage.Ready) {
      return renderLoading();
    }
    
    switch (mediaType) {
      case MediaType.Image:
        return renderImageViewer();
      case MediaType.Video:
        return renderVideoViewer();
      case MediaType.Audio:
        return renderAudioViewer();
      case MediaType.Document:
      case MediaType.Other:
      default:
        return renderDocumentViewer();
    }
  };

  return (
    <div className={`w-full h-full bg-background rounded-md overflow-hidden ${className}`}>
      <div className="p-4">
        {renderMediaContent()}
      </div>
      
      {onClose && (
        <div className="absolute top-2 right-2">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default MediaViewer;

