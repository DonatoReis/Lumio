# Integrating End-to-End Encrypted Media Sharing in ChatView

This document provides detailed instructions for integrating the media upload and download functionality into the existing `ChatView.tsx` component. Follow these steps to implement secure media sharing with end-to-end encryption.

## 1. Add Required Imports

Add the following imports at the top of the `ChatView.tsx` file:

```tsx
// New component imports
import MediaUploader from '@/components/media/MediaUploader';
import MediaViewer from '@/components/media/MediaViewer';

// New hook imports
import useMediaMessages from '@/hooks/useMediaMessages';
import { MediaFile } from '@/hooks/useEncryptedMedia';

// Additional icon imports
import { 
  FileUp, 
  Download, 
  File as FileIcon, 
  Film, 
  Music, 
  X,
  AlertTriangle
} from 'lucide-react';

// Dialog component for modals
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
```

## 2. Add State Variables and Hooks

Add the following state variables inside the ChatView component:

```tsx
// Media upload states
const [mediaUploadModalOpen, setMediaUploadModalOpen] = useState(false);
const [mediaViewModalOpen, setMediaViewModalOpen] = useState(false);
const [selectedMediaMessage, setSelectedMediaMessage] = useState<string | null>(null);
const [mediaUploadType, setMediaUploadType] = useState<string>('');

// Media hooks
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

// Reference for file input
const fileInputRef = useRef<HTMLInputElement>(null);
```

## 3. Implement handleAttach for Media Selection

Replace the existing `handleAttach` function with this enhanced version:

```tsx
const handleAttach = (type: string) => {
  setShowAttachmentOptions(false);
  
  // Set the upload type and open modal
  setMediaUploadType(type);
  
  // Different behavior based on attachment type
  if (type === 'image' || type === 'document' || type === 'video' || type === 'audio') {
    // For file types, open the upload modal
    setMediaUploadModalOpen(true);
    
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
    // Non-file attachments (locations, contacts, etc.) - show a toast for now
    toast({
      title: `${type === 'location' ? 'Location' : 
              type === 'calendar' ? 'Event' : 
              type === 'contact' ? 'Contact' : 'Attachment'} sharing`,
      description: "This feature is coming soon.",
      variant: "default"
    });
  }
};

// Handle file selection
const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
  const files = event.target.files;
  if (!files || files.length === 0) return;
  
  const file = files[0];
  
  // Validate file size (show payment dialog for large files, implemented separately)
  if (file.size > 25 * 1024 * 1024) {
    toast({
      title: "File too large",
      description: "Files larger than 25MB require payment. This feature is coming soon.",
      variant: "destructive"
    });
    return;
  }
  
  // Now we have the file, proceed with the upload modal
  setMediaUploadModalOpen(true);
};
```

## 4. Add Media Message Handling to renderMessage

Modify the render message function to handle media messages:

```tsx
// Add this function to check if a message is a media message
const isMediaMessageType = (message: any): boolean => {
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

// Add this inside your renderMessage function, replacing or modifying the content section
// Look for a section similar to: <div className="text-sm whitespace-pre-wrap mt-1 break-words">
{isMediaMessageType(message) ? (
  <div className="mt-1">
    <div 
      className={`rounded-md overflow-hidden relative cursor-pointer hover:opacity-90 transition-opacity p-2 border border-border flex items-center gap-2 ${
        isLoading ? 'opacity-70' : ''
      }`}
      onClick={() => handleViewMedia(message.id)}
    >
      {message.thumbnail ? (
        <div className="w-10 h-10 rounded overflow-hidden bg-muted flex-shrink-0">
          <img 
            src={`data:image/jpeg;base64,${message.thumbnail}`}
            alt="Media thumbnail"
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
          {message.type === 'image' && <Image className="h-5 w-5 text-primary" />}
          {message.type === 'video' && <Film className="h-5 w-5 text-primary" />}
          {message.type === 'audio' && <Music className="h-5 w-5 text-primary" />}
          {message.type === 'document' && <FileText className="h-5 w-5 text-primary" />}
          {message.type === 'file' && <FileIcon className="h-5 w-5 text-primary" />}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {message.content || `${message.type.charAt(0).toUpperCase() + message.type.slice(1)} file`}
        </p>
        <p className="text-xs text-muted-foreground">
          {isMessageLoading(message.id) 
            ? 'Loading...' 
            : message.file_size 
              ? `${(message.file_size / (1024 * 1024)).toFixed(2)} MB` 
              : 'Encrypted media'}
        </p>
      </div>
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-8 w-8 ml-auto flex-shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          handleViewMedia(message.id);
        }}
      >
        <Download className="h-4 w-4" />
      </Button>
    </div>
  </div>
) : (
  <div 
    className={`text-sm whitespace-pre-wrap mt-1 break-words ${
      isSender ? 'text-white' : 'text-foreground'
    }`}
  >
    {message.content}
  </div>
)}
```

## 5. Add Media View and Upload Handler Functions

Add these functions inside your component:

```tsx
// Handle viewing a media message
const handleViewMedia = async (messageId: string) => {
  try {
    setSelectedMediaMessage(messageId);
    setMediaViewModalOpen(true);
    
    // Mark as read
    if (currentConversation) {
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

// Handle media upload completion
const handleMediaUploadComplete = (metadata: any) => {
  setMediaUploadModalOpen(false);
  
  // Refresh messages to show the new media message
  if (currentConversation) {
    getMessages(currentConversation.id);
  }
  
  toast({
    title: 'Media shared',
    description: 'Your file has been securely shared',
  });
};

// Handle media upload cancellation
const handleMediaUploadCancel = () => {
  setMediaUploadModalOpen(false);
};
```

## 6. Add Input Element for File Selection

Add this hidden input element somewhere in your JSX, outside the main return:

```tsx
{/* Hidden file input for media selection */}
<input
  type="file"
  ref={fileInputRef}
  className="hidden"
  onChange={handleFileSelect}
/>
```

## 7. Add Modal Dialogs for Media Upload and View

Add these modal dialogs at the end of your component's JSX, before the final closing tag:

```tsx
{/* Media Upload Modal */}
<Dialog open={mediaUploadModalOpen} onOpenChange={setMediaUploadModalOpen}>
  <DialogContent className="sm:max-w-[600px]">
    <DialogHeader>
      <DialogTitle>Share Media</DialogTitle>
      <DialogDescription>
        Files are end-to-end encrypted before upload for maximum privacy.
      </DialogDescription>
    </DialogHeader>
    
    {currentConversation && currentConversation.participants.length > 0 && (
      <MediaUploader
        conversationId={currentConversation.id}
        recipientId={currentConversation.participants[0]?.id || ''}
        recipientPublicKey={currentConversation.participants[0]?.public_key || ''}
        onUploadComplete={handleMediaUploadComplete}
        onCancel={handleMediaUploadCancel}
        acceptedTypes={mediaUploadType === 'image' ? 'image/*' : 
                       mediaUploadType === 'video' ? 'video/*' : 
                       mediaUploadType === 'audio' ? 'audio/*' : 
                       mediaUploadType === 'document' ? '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt' : 
                       '*/*'}
      />
    )}
  </DialogContent>
</Dialog>

{/* Media View Modal */}
<Dialog open={mediaViewModalOpen} onOpenChange={setMediaViewModalOpen}>
  <DialogContent className="sm:max-w-[800px] sm:max-h-[90vh] overflow-hidden flex flex-col">
    <DialogHeader className="flex items-center justify-between flex-row">
      <DialogTitle>Media</DialogTitle>
      <DialogClose className="h-6 w-6">
        <X className="h-4 w-4" />
      </DialogClose>
    </DialogHeader>
    
    <div className="flex-1 overflow-auto">
      {selectedMediaMessage && currentConversation && (
        <MediaViewer
          messageId={selectedMediaMessage}
          conversationId={currentConversation.id}
          senderId={messages.find(m => m.id === selectedMediaMessage)?.sender_id || ''}
          senderPublicKey={
            currentConversation.participants.find(
              p => p.id === messages.find(m => m.id === selectedMediaMessage)?.sender_id
            )?.public_key || ''
          }
          autoPlay={true}
          showControls={true}
        />
      )}
    </div>
  </DialogContent>
</Dialog>
```

## 8. Finalize Integration

1. Make sure all the imports, states, functions, and components are properly added to your ChatView.tsx file.
2. Create a database migration to add the necessary columns to the `messages` table if they don't exist already.
3. Test the functionality with a small image file before testing with larger files.
4. Make sure the media bucket is properly configured in Supabase with the correct RLS policies.

## 9. Troubleshooting Common Issues

- If media uploads fail, check browser console for errors and verify Supabase Storage permissions.
- If decryption fails, ensure the correct public keys are being used for encryption and decryption.
- For media display issues, check MIME types and ensure the MediaViewer component is handling them correctly.
- Large files may timeout during upload - implement chunked uploading for files > 10MB (future enhancement).

Remember that all media is end-to-end encrypted, so neither the server nor Supabase can access the content of the files. Only the intended recipients with the correct keys can decrypt and view the shared media.

