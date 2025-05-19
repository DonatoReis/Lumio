// Fix data usage before declaration in useEncryptedMedia.ts
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const encryptedMediaPath = path.join(__dirname, 'src/hooks/useEncryptedMedia.ts');

console.log('Fixing useEncryptedMedia.ts issues...');

try {
  let content = fs.readFileSync(encryptedMediaPath, 'utf8');
  
  // Fix 1: Find issue with data usage before declaration
  const dataUsageRegex = /if\s*\(\s*!data\s*\|\|\s*!data\s*\[\s*messageId\s*\]\s*\)\s*return\s*null/;
  
  if (content.match(dataUsageRegex)) {
    // Assuming data is a state variable that should be declared at the top of the hook
    // We'll add a simple safety check instead
    content = content.replace(dataUsageRegex, 'if (!messageId || !mediaFiles[messageId]) return null');
    console.log('✅ Fixed data usage before declaration');
  } else {
    console.log('⚠️ Could not find the specific data usage pattern');
  }
  
  // Fix 2: Add safety checks before accessing data properties
  // Look for patterns where data properties are accessed
  const patterns = [
    {
      regex: /\bdata\.storage_path\b/g,
      replacement: '(data && !("error" in data) ? data.storage_path : "")'
    },
    {
      regex: /\bdata\.encrypted_key\b/g,
      replacement: '(data && !("error" in data) ? data.encrypted_key : "")'
    },
    {
      regex: /\bdata\.iv\b/g,
      replacement: '(data && !("error" in data) ? data.iv : "")'
    },
    {
      regex: /\bdata\.type\b/g,
      replacement: '(data && !("error" in data) ? data.type : "file")'
    },
    {
      regex: /\bdata\.thumbnail\b/g,
      replacement: '(data && !("error" in data) ? data.thumbnail : null)'
    },
    {
      regex: /\bdata\.content\b/g,
      replacement: '(data && !("error" in data) ? data.content : "")'
    }
  ];
  
  // Add type checking before accessing data
  const metadataRegex = /const\s+metadata:\s*EncryptedMediaMetadata\s*=\s*{/g;
  const dataCheckBlock = `// Check if data exists and doesn't have an error property
if (!data || 'error' in data) {
  throw new Error('Failed to fetch media metadata');
}

const metadata: EncryptedMediaMetadata = {`;
  
  if (content.match(metadataRegex)) {
    content = content.replace(metadataRegex, dataCheckBlock);
    console.log('✅ Added data existence check before metadata creation');
  }
  
  // Apply all safety checks
  patterns.forEach(({ regex, replacement }) => {
    if (content.match(regex)) {
      content = content.replace(regex, replacement);
    }
  });
  
  fs.writeFileSync(encryptedMediaPath, content);
  console.log('✅ Added safety checks for data property access');
  
} catch (err) {
  console.error('❌ Error fixing useEncryptedMedia.ts:', err.message);
}
