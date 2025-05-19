import fs from 'fs';

// Read the file
const filePath = './src/hooks/useConversations.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Fix the extra closing brace
const fixedContent = content.replace(/\}\;\n\}\;\n/, '};\n');

// Write the fixed content back to the file
fs.writeFileSync(filePath, fixedContent, 'utf8');
console.log('Fixed useConversations.ts file');
