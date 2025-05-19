#!/bin/bash
# Backup the original file
cp src/pages/Settings.tsx src/pages/Settings.tsx.original

# Find the line with the icon imports and modify it to include our new icons
line_number=$(grep -n "import {" src/pages/Settings.tsx | grep "lucide-react" | cut -d ":" -f 1)
sed -i'.bak1' "${line_number}s/import {/import { AlertCircle, CheckCircle2, Loader2,/" src/pages/Settings.tsx
