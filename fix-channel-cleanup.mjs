import fs from 'fs';

// Read the file
const filePath = './src/hooks/useMessages.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Add a safeguard condition to the channel cleanup function to prevent unnecessary cleanups
const cleanupPattern = /hasCleanedUp\.current = true;\s*console\.log\(`Cleaning up subscription to \${channelName}`\);/;

if (cleanupPattern.test(content)) {
  // Enhance the cleanup function with additional checks
  const fixedContent = content.replace(
    cleanupPattern,
    `// Only proceed with cleanup if we haven't already cleaned up
      if (hasCleanedUp.current) {
        console.log(\`Skipping cleanup for \${channelName} - already cleaned up\`);
        return;
      }
      
      hasCleanedUp.current = true;
      console.log(\`Cleaning up subscription to \${channelName}\`);`
  );
  
  fs.writeFileSync(filePath, fixedContent, 'utf8');
  console.log('Added safeguard to channel cleanup logic');
} else {
  console.log('Could not find cleanup pattern to update');
}
