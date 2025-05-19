#!/bin/bash

# Colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== BizConnect AI Nexus - HTTPS Development Server ===${NC}"
echo "This script will restart the development server with HTTPS support."

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Check if node is installed
if ! command_exists node; then
  echo -e "${RED}Error: Node.js is not installed. Please install Node.js first.${NC}"
  exit 1
fi

# Check if npm is installed
if ! command_exists npm; then
  echo -e "${RED}Error: npm is not installed. Please install npm first.${NC}"
  exit 1
fi

# Check if certificate files exist
if [ ! -f "./certs/localhost.pem" ] || [ ! -f "./certs/localhost-key.pem" ]; then
  echo -e "${YELLOW}Warning: SSL certificate files not found in ./certs directory.${NC}"
  echo "Would you like to generate self-signed certificates now? (y/n)"
  read -r generate_certs
  
  if [[ $generate_certs =~ ^[Yy]$ ]]; then
    mkdir -p certs
    
    if command_exists openssl; then
      echo "Generating certificates using OpenSSL..."
      openssl req -x509 -newkey rsa:4096 -nodes -out certs/localhost.pem -keyout certs/localhost-key.pem -days 365 -subj "/CN=localhost"
      
      if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to generate certificates with OpenSSL.${NC}"
        exit 1
      fi
      
      echo -e "${GREEN}Certificates generated successfully!${NC}"
    else
      echo -e "${RED}OpenSSL not found. Cannot generate certificates.${NC}"
      echo "Please install OpenSSL or manually create the certificates as described in the README."
      exit 1
    fi
  else
    echo -e "${YELLOW}Proceeding without certificate generation.${NC}"
    echo "Note: HTTPS may not work correctly without valid certificates."
  fi
fi

echo -e "\n${BLUE}Step 1:${NC} Stopping any running Vite server processes..."
if command_exists pkill; then
  pkill -f "vite" >/dev/null 2>&1
elif command_exists killall; then
  killall -9 node >/dev/null 2>&1
else
  echo -e "${YELLOW}Warning: Could not automatically stop processes. Please manually stop any running servers.${NC}"
fi
sleep 1

echo -e "\n${BLUE}Step 2:${NC} Clearing Vite cache..."
if [ -d "./node_modules/.vite" ]; then
  rm -rf ./node_modules/.vite
  echo "Cache cleared."
else
  echo "No cache directory found. Skipping."
fi

echo -e "\n${BLUE}Step 3:${NC} Installing dependencies (if needed)..."
if [ ! -d "./node_modules" ]; then
  echo "Running npm install..."
  npm install
  
  if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to install dependencies. Please run 'npm install' manually.${NC}"
    exit 1
  fi
fi

echo -e "\n${BLUE}Step 4:${NC} Starting development server with HTTPS support..."
echo -e "${YELLOW}Server will start in a new terminal window. This window will remain open for logs.${NC}"

# Start the server 
npm run dev &
SERVER_PID=$!

# Wait a moment for the server to start
sleep 5

if ps -p $SERVER_PID > /dev/null; then
  echo -e "\n${GREEN}=== Development Server Started Successfully! ===${NC}"
  echo -e "Access your application at: ${GREEN}https://localhost:8080${NC}"
  echo -e "\nTo test the Web Crypto API, visit: ${GREEN}https://localhost:8080/crypto-test.html${NC}"
  echo -e "\n${YELLOW}Note:${NC} You may see a certificate warning in your browser if using self-signed certificates."
  echo "This is normal in development. Click 'Advanced' and 'Proceed' to continue."
  echo -e "\nPress Ctrl+C to stop the server when you're done.\n"
  
  # Wait for user to press Ctrl+C
  wait $SERVER_PID
else
  echo -e "${RED}Failed to start the development server.${NC}"
  echo "Please check for errors and try running 'npm run dev' manually."
  exit 1
fi

echo -e "${BLUE}Server stopped.${NC}"
exit 0

