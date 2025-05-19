# End-to-End Encrypted Media Sharing

This document provides comprehensive documentation for the end-to-end encrypted media sharing implementation in our application.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Setup Instructions](#setup-instructions)
3. [Component Reference](#component-reference)
4. [Security Considerations](#security-considerations)
5. [Troubleshooting](#troubleshooting)
6. [Future Enhancements](#future-enhancements)

## Architecture Overview

The encrypted media sharing system allows users to securely exchange files (images, videos, documents, etc.) with end-to-end encryption. This means that files are encrypted on the sender's device before upload and can only be decrypted by the intended recipient.

### Encryption Process

1. **Key Generation**: For each media file upload, a unique symmetric AES-256 key is generated.
2. **File Encryption**: The media file is encrypted locally using the symmetric key with AES-256-GCM encryption.
3. **Key Encryption**: The symmetric key is then encrypted with the recipient's public key using the Signal Protocol.
4. **Upload**: Only the encrypted file and encrypted key are sent to the server; the server never sees the original file.
5. **Download**: The recipient downloads the encrypted file and the encrypted key.
6. **Decryption**: The recipient decrypts the symmetric key using their private key, then uses it to decrypt the file.

![Encryption Process](../assets/images/e2ee-media-flow.png)

### Data Flow

```
┌─────────┐         ┌───────────┐         ┌──────────┐
│  Sender │         │  Supabase │         │ Recipient│
│  Client │         │  Backend  │         │  Client  │
└────┬────┘         └─────┬─────┘         └────┬─────┘
     │                    │                     │
     │ Generate           │                     │
     │ symmetric key      │                     │
     │◄─────────┐         │                     │
     │          │         │                     │
     │ Encrypt file       │                     │
     │◄─────────┐         │                     │
     │          │         │                     │
     │ Encrypt symmetric  │                     │
     │ key with recipient │                     │
     │ public key         │                     │
     │◄─────────┐         │                     │
     │          │         │                     │
     │ Upload encrypted   │                     │
     │ file & metadata    │                     │
     │─────────────────► │                     │
     │                    │ Store in            │
     │                    │ Supabase Storage    │
     │                    │◄──────────┐         │
     │                    │            │        │
     │                    │ Notify recipient    │
     │                    │ via Realtime       │
     │                    │────────────────────►│
     │                    │                     │
     │                    │ Download encrypted  │
     │                    │ file & metadata     │
     │                    │◄────────────────────│
     │                    │                     │
     │                    │                     │ Decrypt 
     │                    │                     │ symmetric key
     │                    │                     │◄─────────┐
     │                    │                     │          │
     │                    │                     │ Decrypt file
     │                    │                     │◄─────────┐
     │                    │                     │          │
     │                    │                     │ Display media
     │                    │                     │◄─────────┐
```

### Technical Components

1. **Frontend**:
   - `MediaUploader`: React component for selecting, encrypting, and uploading media
   - `MediaViewer`: React component for downloading, decrypting, and displaying media
   - `useEncryptedMedia`: Hook for managing encrypted media state and operations
   - `useMediaMessages`: Hook for integrating with messaging system

2. **Backend**:
   - `uploadMedia`: Edge Function for secure file uploads
   - `cleanupMedia`: Scheduled Edge Function for removing expired media files
   - Supabase Storage for storing encrypted files
   - Supabase Database for storing metadata

3. **Crypto Utilities**:
   - `mediaCrypto.ts`: Utilities for media encryption/decryption
   - `signalProtocol.ts`: Signal Protocol implementation for key exchange

## Setup Instructions

### Prerequisites

- Supabase project with Storage enabled
- Authentication system setup (for user management)
- Signal Protocol key exchange system implemented
- Node.js v18+ and npm/yarn

### Database Setup

1. Run the migration script to add necessary tables and columns:

```bash
supabase migrations up 20250515000000_media_sharing.sql
```

This migration adds:
- New columns to the `messages` table for storing media metadata
- A `maintenance_logs` table for tracking cleanup operations
- Appropriate indexes and RLS policies

### Storage Setup

The migration script automatically creates an `encrypted_media` bucket with proper RLS policies. Verify the bucket exists in your Supabase dashboard:

1. Go to **Storage** in Supabase dashboard
2. Ensure the `encrypted_media` bucket exists and is set to private
3. Verify RLS policies are correctly set:
   - Users can upload media to conversations they are part of
   - Users can read media from conversations they are part of
   - Users can delete their own media
   - Service role can manage all media (for cleanup)

### Edge Functions Setup

1. Deploy the Edge Functions to your Supabase project:

```bash
supabase functions deploy uploadMedia
supabase functions deploy cleanupMedia
```

2. Set up the cleanup function to run on a schedule:

```bash
supabase functions schedule cleanupMedia --cron "0 0 * * *"  # Daily at midnight
```

### Environment Variables

Ensure these environment variables are set in your Supabase functions:

```
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Component Reference

### MediaUploader

A component for uploading encrypted media files.

**Props:**
- `conversationId`: ID of the conversation
- `recipientId`: ID of the recipient
- `recipientPublicKey`: Public key of the recipient
- `onUploadComplete`: Callback when upload is complete
- `onCancel`: Callback when upload is canceled
- `maxFileSize`: Maximum file size (default: 25MB)
- `acceptedTypes`: Accepted file types (default: '*/*')
- `showThumbnail`: Whether to generate and show thumbnails (default: true)

**Example usage:**

```tsx
<MediaUploader
  conversationId="123e4567-e89b-12d3-a456-426614174000"
  recipientId="123e4567-e89b-12d3-a456-426614174001"
  recipientPublicKey="BASE64_ENCODED_PUBLIC_KEY"
  onUploadComplete={(metadata) => console.log('Upload complete', metadata)}
  onCancel={() => console.log('Upload canceled')}
  acceptedTypes="image/*"
/>
```

### MediaViewer

A component for viewing decrypted media files.

**Props:**
- `messageId`: ID of the message containing the media
- `conversationId`: ID of the conversation
- `senderId`: ID of the sender
- `senderPublicKey`: Public key of the sender
- `onClose`: Callback when viewer is closed
- `autoPlay`: Whether to auto-play media (default: true)
- `showControls`: Whether to show media controls (default: true)

**Example usage:**

```tsx
<MediaViewer
  messageId="123e4567-e89b-12d3-a456-426614174002"
  conversationId="123e4567-e89b-12d3-a456-426614174000"
  senderId="123e4567-e89b-12d3-a456-426614174003"
  senderPublicKey="BASE64_ENCODED_PUBLIC_KEY"
  autoPlay={true}
  showControls={true}
/>
```

### useEncryptedMedia Hook

A hook for managing encrypted media operations.

**Returns:**
- `status`: Current status of media operations
- `progress`: Upload/download progress (0-100)
- `error`: Error message if any
- `mediaFiles`: Cached decrypted media files
- `uploadMedia`: Function to upload encrypted media
- `downloadMedia`: Function to download and decrypt media
- `getMediaFile`: Function to get a cached media file
- `revokeMediaUrl`: Function to revoke a media URL
- `clearMediaFiles`: Function to clear all media files

**Example usage:**

```tsx
const {
  status,
  progress,
  uploadMedia,
  downloadMedia,
  error
} = useEncryptedMedia();

// Upload a file
const handleUpload = async (file) => {
  const messageId = await uploadMedia(file, conversationId, recipientId, recipientPublicKey);
  if (messageId) {
    console.log('Upload successful', messageId);
  }
};

// Download a file
const handleDownload = async (messageId) => {
  const mediaFile = await downloadMedia(messageId, senderId, senderPublicKey);
  if (mediaFile) {
    console.log('Download successful', mediaFile.url);
  }
};
```

### useMediaMessages Hook

A hook for integrating media messages with the chat system.

**Returns:**
- `isLoading`: Whether media operations are in progress
- `loadingMediaIds`: IDs of messages currently being loaded
- `error`: Error message if any
- `sendMediaMessage`: Function to send a media message
- `getMediaMessage`: Function to get a media message
- `isMediaLoading`: Function to check if a media message is loading
- `markMediaMessageAsRead`: Function to mark a media message as read
- `deleteMediaMessage`: Function to delete a media message
- `isMediaMessage`: Function to check if a message is a media message
- `getMediaTypeIcon`: Function to get an icon for a media type

**Example usage:**

```tsx
const {
  sendMediaMessage,
  getMediaMessage,
  isMediaMessage,
  isMediaLoading
} = useMediaMessages();

// Send a media message
const handleSend = async (file) => {
  const messageId = await sendMediaMessage(file, conversationId, recipientId, recipientPublicKey);
  if (messageId) {
    console.log('Message sent', messageId);
  }
};

// Render messages
const renderMessage = (message) => {
  if (isMediaMessage(message)) {
    return (
      <div>
        <p>{message.content}</p>
        <button 
          onClick={() => getMediaMessage(message.id)}
          disabled={isMediaLoading(message.id)}
        >
          View Media
        </button>
      </div>
    );
  }
  
  return <p>{message.content}</p>;
};
```

## Security Considerations

### Key Management

- **Private Keys**: Never expose or transmit private keys. They should remain on the user's device.
- **Key Storage**: Store keys securely using industry-standard encryption methods. In web browsers, use IndexedDB with appropriate encryption.
- **Key Rotation**: Implement key rotation mechanisms to limit the impact of potential key compromise.

### Data Security

- **Zero Knowledge**: The server never has access to unencrypted media or decryption keys.
- **Transport Security**: Always use HTTPS/TLS for all API communication.
- **Metadata Protection**: Minimize sensitive information in file names and metadata.
- **Automatic Expiry**: Media files are automatically deleted after the expiry period (default 30 days).

### Implementation Best Practices

- **Input Validation**: Always validate input parameters on both client and server.
- **Error Handling**: Implement proper error handling to prevent information leakage.
- **Content Security Policy**: Use strict CSP headers to prevent XSS attacks.
- **Dependencies**: Regularly update cryptographic libraries and dependencies.

### Limitations

- **Forward Secrecy**: While the Signal Protocol provides forward secrecy for messages, media sharing uses a simpler encryption model that doesn't provide perfect forward secrecy for files.
- **Metadata**: While file contents are encrypted, some metadata like file size and type may be inferrable by the server.
- **Browser Security**: The security model relies on browser security. Compromise of the user's device compromises the encryption.

## Troubleshooting

### Common Issues

#### Upload Failures

**Symptoms:** File uploads fail, timeouts, or errors in console.

**Potential Solutions:**
- Check browser console for specific error messages
- Verify Supabase Storage is properly configured
- Ensure user has appropriate permissions for the bucket
- Check file size limits (25MB default, 100MB with payment)
- Verify network connectivity and firewall settings

#### Decryption Failures

**Symptoms:** "Failed to decrypt file" errors, corrupted downloads.

**Potential Solutions:**
- Ensure public/private key pairs match between sender and recipient
- Verify the IV (initialization vector) is properly stored and retrieved
- Check browser Web Crypto API support (requires HTTPS)
- Clear browser cache and reload the application
- Check browser storage limits and permissions

#### Performance Issues

**Symptoms:** Slow uploads/downloads, UI freezes during encryption/decryption.

**Potential Solutions:**
- Implement chunked uploading for large files
- Use Web Workers for encryption/decryption operations
- Optimize thumbnail generation for large images/videos
- Consider using streaming for large file handling
- Monitor memory usage in browser developer tools

### Debugging Tools

- Browser DevTools Network panel to monitor API calls
- Supabase Dashboard for checking storage and database state
- Function logs in Supabase for Edge Function errors
- Query the `maintenance_logs` table for cleanup operation issues

### Support Channels

- File issues in the GitHub repository
- Reference the #media-encryption channel in the team Discord
- Check the developer documentation on the wiki
- Contact the security team for encryption-specific issues

## Future Enhancements

1. **Chunked Uploads**: Implement chunked uploading for large files to improve reliability.
2. **Web Workers**: Move encryption/decryption to background threads for better performance.
3. **Perfect Forward Secrecy**: Enhance the protocol to provide perfect forward secrecy for media files.
4. **Client-side Transcoding**: Add client-side video transcoding to optimize streaming.
5. **Shared Media Gallery**: Create a gallery view of all media shared in a conversation.
6. **Media Expiry Controls**: Allow users to set custom expiry periods for sensitive media.
7. **Watermarking**: Optional client-side watermarking for copyright protection.
8. **Read Receipts**: Add read receipts specifically for media messages.

---

## Appendix: Database Schema

### messages Table (Media-related columns)

| Column        | Type      | Description                                           |
|---------------|-----------|-------------------------------------------------------|
| type          | VARCHAR   | Message type (text, image, video, audio, document)    |
| storage_path  | TEXT      | Path to the encrypted file in Supabase Storage        |
| encrypted_key | TEXT      | Encrypted symmetric key for file decryption           |
| iv            | TEXT      | Initialization vector used for encryption             |
| thumbnail     | TEXT      | Base64 encoded thumbnail for images and videos        |
| expires_at    | TIMESTAMP | Date when the media should be deleted                 |
| file_size     | BIGINT    | Size of the file in bytes                             |

### maintenance_logs Table

| Column     | Type      | Description                             |
|------------|-----------|-----------------------------------------|
| id         | UUID      | Primary key                             |
| operation  | VARCHAR   | Type of operation (e.g., media_cleanup) |
| result     | VARCHAR   | Result status (success, error)          |
| details    | JSONB     | Detailed operation information          |
| created_at | TIMESTAMP |

