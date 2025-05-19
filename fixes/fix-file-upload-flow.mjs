// Improve file upload flow in ChatView.tsx
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const chatViewPath = path.join(__dirname, '..', 'src/components/chat/ChatView.tsx');

console.log('Improving file upload flow in ChatView.tsx...');

try {
  // Read the original file
  let content = fs.readFileSync(chatViewPath, 'utf8');
  
  // Create a backup of the original file
  fs.writeFileSync(`${chatViewPath}.flow.bak`, content);
  console.log('✅ Created backup at src/components/chat/ChatView.tsx.flow.bak');
  
  // Find the handleFileSelect function and replace it
  const handleFileSelectRegex = /const\s+handleFileSelect\s*=\s*\(\s*event[^{]*{[^}]*setMediaUploadModalOpen\s*\(\s*true\s*\)\s*;[^}]*\}\s*;/s;
  
  const newHandleFileSelect = `const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    // Reset input value so the same file can be selected again
    event.target.value = '';
    
    try {
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
      
      // Upload the file directly (used to happen in MediaUploader)
      await useMediaMessages().sendMediaMessage(
        file,
        conversationId,
        recipient.id,
        recipient.public_key
      );
      
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
  };`;
  
  if (content.match(handleFileSelectRegex)) {
    content = content.replace(handleFileSelectRegex, newHandleFileSelect);
    console.log('✅ Replaced handleFileSelect function with direct upload flow');
    
    // Remove the MediaUploader Dialog component that we added earlier
    const mediaUploaderDialogRegex = /{\s*\/\* Media Upload Dialog \*\/\s*}[\s\S]*?<\/Dialog>/;
    if (content.match(mediaUploaderDialogRegex)) {
      content = content.replace(mediaUploaderDialogRegex, '');
      console.log('✅ Removed the MediaUploader Dialog component');
    } else {
      console.log('⚠️ Could not find the MediaUploader Dialog component');
    }
    
    // Remove unused handleMediaUploadComplete and handleMediaUploadCancel functions
    const handleMediaUploadFunctionsRegex = /\/\/ Handle media upload completion[\s\S]*?setMediaUploadModalOpen\(false\);\s*};/;
    if (content.match(handleMediaUploadFunctionsRegex)) {
      content = content.replace(handleMediaUploadFunctionsRegex, '');
      console.log('✅ Removed unused media upload handler functions');
    } else {
      console.log('⚠️ Could not find media upload handler functions');
    }
    
    // Write the updated content
    fs.writeFileSync(chatViewPath, content);
    console.log('✅ Successfully improved file upload flow in ChatView.tsx');
  } else {
    console.log('⚠️ Could not find handleFileSelect function in ChatView.tsx');
  }
} catch (err) {
  console.error('❌ Error improving file upload flow:', err.message);
}

