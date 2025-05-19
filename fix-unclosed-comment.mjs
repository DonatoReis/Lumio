import fs from 'fs';

// Read the file
const filePath = './src/hooks/useConversations.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Fix the unclosed comment
const fixedContent = content.replace(
  /\/\*\*\n   \* Creates or retrieves a conversation with the given participants\n\n/,
  "/**\n   * Creates or retrieves a conversation with the given participants\n   */\n\n"
);

// Write the fixed content back to the file
fs.writeFileSync(filePath, fixedContent, 'utf8');
console.log('Fixed unclosed comment in useConversations.ts file');
