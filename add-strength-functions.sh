#!/bin/bash

# Find position after the last function and before the return statement
RETURN_LINE=$(grep -n "return (" src/pages/Settings.tsx | head -n 1 | cut -d ":" -f 1)
INSERT_LINE=$((RETURN_LINE - 1))

# Create the functions to insert
FUNCTIONS=$(cat << 'ENDFUNCS'

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

ENDFUNCS
)

# Insert the functions
sed -i'.bak' "${INSERT_LINE}i\\
${FUNCTIONS}" src/pages/Settings.tsx

echo "Strength functions have been added successfully!"
