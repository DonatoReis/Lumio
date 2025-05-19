import fs from 'fs';

// Read the file
const filePath = './src/pages/Settings.tsx';
const fileContents = fs.readFileSync(filePath, 'utf8');

// Find the position before the return statement
const returnPos = fileContents.indexOf('return (');
if (returnPos === -1) {
  console.error('Cannot find return statement');
  process.exit(1);
}

// Find the position of the last function before return
const lastFunctionPos = fileContents.lastIndexOf('};', returnPos);
if (lastFunctionPos === -1) {
  console.error('Cannot find a suitable position to insert functions');
  process.exit(1);
}

// Insert point is after the last function's closing brace
const insertPos = lastFunctionPos + 2;

// Functions to add
const functionsToAdd = `

  // Get color for password strength meter
  const getStrengthColor = (score) => {
    switch (score) {
      case 0: return 'bg-red-500';
      case 1: return 'bg-red-400';
      case 2: return 'bg-yellow-400';
      case 3: return 'bg-green-400';
      case 4: return 'bg-green-500';
      default: return 'bg-gray-300';
    }
  };

  // Get feedback text for password strength
  const getStrengthText = (score) => {
    switch (score) {
      case 0: return 'Muito fraca';
      case 1: return 'Fraca';
      case 2: return 'Média';
      case 3: return 'Boa';
      case 4: return 'Forte';
      default: return 'Indeterminada';
    }
  };
`;

// Insert the functions
const updatedContents = fileContents.slice(0, insertPos) + functionsToAdd + fileContents.slice(insertPos);

// Write the updated content back to the file
fs.writeFileSync(filePath, updatedContents);

console.log('Strength functions have been added successfully!');
