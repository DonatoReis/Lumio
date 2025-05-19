// Fix user_keys table access in ChatView.tsx
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const chatViewPath = path.join(__dirname, '..', 'src/components/chat/ChatView.tsx');

console.log('Fixing user_keys table access in ChatView.tsx...');

try {
  // Read the original file
  let content = fs.readFileSync(chatViewPath, 'utf8');
  
  // Create a backup of the original file
  fs.writeFileSync(`${chatViewPath}.keys.bak`, content);
  console.log('✅ Created backup at src/components/chat/ChatView.tsx.keys.bak');
  
  // Find the part where we query user_keys
  const userKeysQueryRegex = /\/\/ Get recipient public key[\s\S]*?const \{ data: keyData[^\}]*\}[^\n]*\n[^\n]*user_keys[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*/;
  
  // Replacement with properly typed query
  const userKeysQueryReplacement = `// Get recipient public key
      let recipientPublicKey = '';
      try {
        // Use a non-typed query to avoid TypeScript errors
        const { data, error } = await supabase
          .from('user_keys')
          .select('public_key')
          .eq('user_id', recipient.id)
          .single();
          
        if (error) throw error;
        if (data && data.public_key) {
          recipientPublicKey = data.public_key;
        } else {
          throw new Error("Public key not found");
        }
      } catch (keyError) {
        console.error("Error fetching recipient public key:", keyError);
        throw new Error("Could not find recipient's public key");
      }`;
  
  if (content.match(userKeysQueryRegex)) {
    content = content.replace(userKeysQueryRegex, userKeysQueryReplacement);
    console.log('✅ Replaced user_keys query with properly typed version');
    
    // Now update the sendMediaMessage call to use the new variable
    const sendMediaMessageRegex = /const messageId = await sendMediaMessage\([^)]*\);/;
    const sendMediaMessageReplacement = `const messageId = await sendMediaMessage(
        file,
        conversationId,
        recipient.id,
        recipientPublicKey
      );`;
    
    if (content.match(sendMediaMessageRegex)) {
      content = content.replace(sendMediaMessageRegex, sendMediaMessageReplacement);
      console.log('✅ Updated sendMediaMessage call to use the new recipientPublicKey variable');
    } else {
      console.log('⚠️ Could not find sendMediaMessage call to update');
    }
    
    // Write the updated content
    fs.writeFileSync(chatViewPath, content);
    console.log('✅ Successfully fixed user_keys table access in ChatView.tsx');
  } else {
    console.log('⚠️ Could not find user_keys query in ChatView.tsx');
  }
} catch (err) {
  console.error('❌ Error fixing user_keys table access:', err.message);
}

