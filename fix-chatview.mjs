// Fix Film icon import in ChatView.tsx
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const chatViewPath = path.join(__dirname, 'src/components/chat/ChatView.tsx');

console.log('Adding Film icon to imports in ChatView.tsx...');

try {
  let content = fs.readFileSync(chatViewPath, 'utf8');
  
  // Find the lucide-react import line
  const importRegex = /import\s+{([^}]*)}\s+from\s+['"]lucide-react['"]/;
  const importMatch = content.match(importRegex);
  
  if (importMatch) {
    const currentImports = importMatch[1];
    
    // Check if Film is already in imports
    if (!currentImports.includes('Film')) {
      // Add Film to the imports
      const newImports = currentImports.trim() + ', Film';
      const newImportLine = `import { ${newImports} } from 'lucide-react'`;
      
      content = content.replace(importRegex, newImportLine);
      fs.writeFileSync(chatViewPath, content);
      console.log('✅ Successfully added Film icon to imports');
    } else {
      console.log('✅ Film icon is already imported');
    }
  } else {
    console.log('⚠️ Could not find lucide-react import line');
  }
} catch (err) {
  console.error('❌ Error fixing ChatView.tsx:', err.message);
}
