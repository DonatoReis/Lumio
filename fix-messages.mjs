import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho para o arquivo Messages.tsx
const filePath = path.join(__dirname, 'src', 'pages', 'Messages.tsx');

try {
  // Ler o conteúdo atual do arquivo
  const data = fs.readFileSync(filePath, 'utf8');
  
  // Dividir o arquivo em linhas
  const lines = data.split('\n');
  
  // Modificar linha 793
  if (lines[792] && lines[793]) {
    if (lines[792].includes('))') && lines[793].includes(')}')) {
      lines[793] = '              )}';
      console.log('Linha 793 modificada.');
    }
  }
  
  // Juntar as linhas novamente
  const correctedContent = lines.join('\n');
  
  // Escrever o conteúdo corrigido de volta para o arquivo
  fs.writeFileSync(filePath, correctedContent, 'utf8');
  console.log('Arquivo corrigido com sucesso!');
} catch (err) {
  console.error('Erro:', err);
}
