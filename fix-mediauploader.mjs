// Fix syntax issues in MediaUploader.tsx
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mediaUploaderPath = path.join(__dirname, 'src/components/media/MediaUploader.tsx');

console.log('Fixing syntax issues in MediaUploader.tsx...');

try {
  let content = fs.readFileSync(mediaUploaderPath, 'utf8');
  
  // Fix 1: Ensure the interface definition ends with a semicolon
  // Find the MediaUploaderProps interface
  const interfaceRegex = /interface\s+MediaUploaderProps\s*{[^}]*}/g;
  if (content.match(interfaceRegex)) {
    // Add a semicolon after the interface closing brace if missing
    content = content.replace(/interface\s+MediaUploaderProps\s*{[^}]*}(?!\s*;)/, match => match + ';');
    console.log('✅ Added semicolon to MediaUploaderProps interface');
  } else {
    console.log('⚠️ Could not find MediaUploaderProps interface');
  }
  
  // Fix 2: Clean up any duplicated code blocks that can cause brace mismatch
  // Look for duplicated component declarations
  const componentDeclarationRegex = /const\s+MediaUploader:\s*React\.FC<MediaUploaderProps>\s*=/g;
  const matches = content.match(componentDeclarationRegex);
  
  if (matches && matches.length > 1) {
    // Find the second occurrence and remove everything up to that point to rebuild
    const secondDeclarationIndex = content.indexOf(matches[1]);
    
    // Keep the first occurrence and declarations above it
    const cleanContent = content.substring(0, secondDeclarationIndex);
    
    // Find the rest of the file after the component definition
    const endIndex = content.lastIndexOf('export default MediaUploader');
    if (endIndex > 0) {
      const endContent = content.substring(endIndex);
      
      // Save the fixed content
      fs.writeFileSync(mediaUploaderPath, cleanContent + endContent);
      console.log('✅ Removed duplicated component declaration');
    } else {
      console.log('⚠️ Could not find the end of the file');
    }
  } else {
    // If there's no duplicate, just check for a clean structure
    if (!content.includes('export default MediaUploader')) {
      content += '\nexport default MediaUploader;\n';
      fs.writeFileSync(mediaUploaderPath, content);
      console.log('✅ Added default export');
    }
    
    fs.writeFileSync(mediaUploaderPath, content);
    console.log('✅ Structure looks good, saved any minor fixes');
  }
  
} catch (err) {
  console.error('❌ Error fixing MediaUploader.tsx:', err.message);
}
