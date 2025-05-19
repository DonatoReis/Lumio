import fs from 'fs';

// Read the file
const filePath = './src/hooks/useMessages.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Find and fix the duplicated useEffect closing bracket
const fixedContent = content.replace(
  /\n\s*\}, \[conversationId, user, reconnectAttempts\]\); \/\/ Minimal dependencies to prevent unnecessary resubscriptions/,
  ''
);

// Write the fixed content back to the file
fs.writeFileSync(filePath, fixedContent, 'utf8');
console.log('Fixed useMessages.ts file');
