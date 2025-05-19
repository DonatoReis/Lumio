// Fix Web Crypto API issues in mediaCrypto.ts
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mediaCryptoPath = path.join(__dirname, '..', 'src/utils/mediaCrypto.ts');

console.log('Fixing Web Crypto API issues in mediaCrypto.ts...');

try {
  // Read the original file
  let content = fs.readFileSync(mediaCryptoPath, 'utf8');
  
  // Create a backup of the original file
  fs.writeFileSync(`${mediaCryptoPath}.bak`, content);
  console.log('✅ Created backup at src/utils/mediaCrypto.ts.bak');
  
  // Add a check for window.crypto.subtle at the beginning of the file
  const importSection = content.match(/import.*(\n|.)*?;/g);
  if (importSection && importSection.length > 0) {
    const afterImports = content.indexOf(importSection[importSection.length - 1]) + importSection[importSection.length - 1].length;
    
    // Add crypto availability check after imports
    const cryptoCheck = `

// Ensure Web Crypto API is available
const getCrypto = () => {
  // Check if window is defined (browser environment)
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    return window.crypto;
  } 
  // Fallback to Node.js crypto if available
  else if (typeof crypto !== 'undefined' && crypto.subtle) {
    return crypto;
  }
  // Last resort, throw a clear error
  throw new Error('Web Crypto API is not available in this environment');
};

`;
    
    content = content.slice(0, afterImports) + cryptoCheck + content.slice(afterImports);
    
    // Replace direct window.crypto references with getCrypto() function
    content = content.replace(/window\.crypto\.subtle/g, 'getCrypto().subtle');
    
    // Write the updated content
    fs.writeFileSync(mediaCryptoPath, content);
    console.log('✅ Successfully fixed Web Crypto API references in mediaCrypto.ts');
  } else {
    console.log('⚠️ Could not find import section in mediaCrypto.ts');
  }
} catch (err) {
  console.error('❌ Error fixing mediaCrypto.ts:', err.message);
}

