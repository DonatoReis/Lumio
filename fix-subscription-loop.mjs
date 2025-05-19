import fs from 'fs';

// Read the file
const filePath = './src/hooks/useMessages.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Fix the dependency array issue - remove reconnectAttempts from dependencies
const fixedContent = content.replace(
  /\[conversationId, user, handleInsert, handleUpdate, handleDelete, reconnectAttempts, fetchMessages, supabase\]/,
  '[conversationId, user, handleInsert, handleUpdate, handleDelete, fetchMessages, supabase]'
);

// Write the fixed content back to the file
fs.writeFileSync(filePath, fixedContent, 'utf8');
console.log('Fixed subscription loop in useMessages.ts file');
