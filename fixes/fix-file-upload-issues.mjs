// Fix file upload issues in ChatView.tsx
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const chatViewPath = path.join(__dirname, '..', 'src/components/chat/ChatView.tsx');

console.log('Fixing file upload issues in ChatView.tsx...');

try {
  // Read the original file
  let content = fs.readFileSync(chatViewPath, 'utf8');
  
  // Create a backup of the original file
  fs.writeFileSync(`${chatViewPath}.issues.bak`, content);
  console.log('✅ Created backup at src/components/chat/ChatView.tsx.issues.bak');
  
  // Add import for useState if not already there
  if (!content.includes('useState')) {
    content = content.replace('import React, {', 'import React, { useState,');
    console.log('✅ Added useState import');
  }
  
  // Replace the handleFileSelect function with corrected version
  const handleFileSelectRegex = /const\s+handleFileSelect\s*=\s*async\s*\(\s*event[^{]*{[\s\S]*?}\s*;/;
  
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
      
      // Get recipient public key
      const { data: keyData, error: keyError } = await supabase
        .from('user_keys')
        .select('public_key')
        .eq('user_id', recipient.id)
        .single();
        
      if (keyError || !keyData) {
        throw new Error("Could not find recipient's public key");
      }
      
      // Upload the file directly using the hook function from the component level
      const messageId = await sendMediaMessage(
        file,
        conversationId,
        recipient.id,
        keyData.public_key
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
  };`;
  
  if (content.match(handleFileSelectRegex)) {
    content = content.replace(handleFileSelectRegex, newHandleFileSelect);
    console.log('✅ Replaced handleFileSelect function with fixed version');
  } else {
    console.log('⚠️ Could not find handleFileSelect function - adding new version at the end');
    content += `\n\n// New fixed handleFileSelect function\n${newHandleFileSelect}\n`;
  }
  
  // Extract useMediaMessages hook to the component level
  // First, check if sendMediaMessage is already extracted
  if (!content.includes('const { sendMediaMessage }')) {
    // Find where useMediaMessages is imported
    if (content.includes('import useMediaMessages from')) {
      // Find the mediaMessages or similar declaration
      const mediaMessagesRegex = /const\s+{([^}]*)}\s*=\s*useMediaMessages\(\);/;
      const mediaMessagesMatch = content.match(mediaMessagesRegex);
      
      if (mediaMessagesMatch) {
        // Add sendMediaMessage if it's not already in the destructured variables
        const existingVariables = mediaMessagesMatch[1];
        if (!existingVariables.includes('sendMediaMessage')) {
          const newVariables = existingVariables.trim() ? 
            existingVariables.trim() + ', sendMediaMessage' : 
            'sendMediaMessage';
          
          content = content.replace(
            mediaMessagesRegex, 
            `const { ${newVariables} } = useMediaMessages();`
          );
          console.log('✅ Added sendMediaMessage to useMediaMessages hook destructuring');
        } else {
          console.log('✅ sendMediaMessage is already included in hook destructuring');
        }
      } else {
        // If we can't find the hook usage, add it after the existing hooks
        const hooksRegex = /const\s+{\s*[^}]*}\s*=\s*use[A-Z][a-zA-Z]*\(\);/g;
        let lastHookMatch;
        let match;
        
        while ((match = hooksRegex.exec(content)) !== null) {
          lastHookMatch = match;
        }
        
        if (lastHookMatch) {
          const insertPosition = lastHookMatch.index + lastHookMatch[0].length;
          content = content.slice(0, insertPosition) +
            '\n  const { sendMediaMessage } = useMediaMessages();' +
            content.slice(insertPosition);
          console.log('✅ Added useMediaMessages hook after existing hooks');
        } else {
          console.log('⚠️ Could not find a good position to add useMediaMessages hook');
        }
      }
    } else {
      console.log('⚠️ useMediaMessages is not imported, cannot extract sendMediaMessage');
    }
  } else {
    console.log('✅ sendMediaMessage is already extracted to component level');
  }
  
  // Write the updated content
  fs.writeFileSync(chatViewPath, content);
  console.log('✅ Successfully fixed file upload issues in ChatView.tsx');
} catch (err) {
  console.error('❌ Error fixing file upload issues:', err.message);
}

