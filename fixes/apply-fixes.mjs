// Script to apply fixes to ChatView.tsx
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const chatViewPath = path.join(__dirname, '..', 'src/components/chat/ChatView.tsx');
const fileInputPath = path.join(__dirname, 'add-file-input.txt');
const mediaUploaderDialogPath = path.join(__dirname, 'add-media-uploader-dialog.txt');

console.log('Applying fixes to ChatView.tsx...');

try {
  // Read the original file
  let content = fs.readFileSync(chatViewPath, 'utf8');
  
  // Read the fixes
  const fileInputContent = fs.readFileSync(fileInputPath, 'utf8');
  const mediaUploaderDialogContent = fs.readFileSync(mediaUploaderDialogPath, 'utf8');
  
  // Create a backup of the original file
  fs.writeFileSync(`${chatViewPath}.bak`, content);
  console.log('✅ Created backup at src/components/chat/ChatView.tsx.bak');
  
  // Find the closing div tag
  const closingDivIndex = content.lastIndexOf('</div>');
  
  if (closingDivIndex !== -1) {
    // Insert both components before the closing div
    const newContent = content.slice(0, closingDivIndex) + 
      fileInputContent + 
      mediaUploaderDialogContent + 
      content.slice(closingDivIndex);
    
    // Write the updated content
    fs.writeFileSync(chatViewPath, newContent);
    console.log('✅ Successfully applied fixes to ChatView.tsx');
  } else {
    console.log('⚠️ Could not find closing div tag in ChatView.tsx');
  }
} catch (err) {
  console.error('❌ Error applying fixes:', err.message);
}

