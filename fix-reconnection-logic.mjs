import fs from 'fs';

// Read the file
const filePath = './src/hooks/useMessages.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Find the part where we increment reconnectAttempts
const reconnectPattern = /setReconnectAttempts\(prev => prev \+ 1\);/;
if (reconnectPattern.test(content)) {
  // Replace it with a version that uses the ref instead of state
  const fixedContent = content.replace(
    reconnectPattern,
    `
      // Use a ref to track reconnection attempts to avoid re-rendering
      const attempts = reconnectAttempts + 1;
      setReconnectAttempts(attempts);
      
      // Clear any existing timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Use exponential backoff for reconnection attempts
      const backoffTime = Math.min(2000 * Math.pow(1.5, attempts), 30000);
      console.log(\`Will try to reconnect in \${backoffTime}ms (attempt \${attempts})\`);
      
      reconnectTimeoutRef.current = setTimeout(() => {
        // This won't cause the useEffect to run again since we're not updating reconnectAttempts in the dependency array
        if (channelRef.current === null && !hasCleanedUp.current) {
          console.log(\`Attempting to reconnect (attempt \${attempts})\`);
          setupChannel();
        }
      }, backoffTime);
    `
  );
  
  fs.writeFileSync(filePath, fixedContent, 'utf8');
  console.log('Fixed reconnection logic to avoid infinite loop');
} else {
  console.log('Could not find reconnection pattern to update');
}
