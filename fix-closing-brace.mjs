import fs from 'fs';

// Read the file
const filePath = './src/hooks/useConversations.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Add the missing closing brace at the end of the file
const fixedContent = content.trim() + '\n};\n';

// Write the fixed content back to the file
fs.writeFileSync(filePath, fixedContent, 'utf8');
console.log('Added missing closing brace to useConversations.ts file');
