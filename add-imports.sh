#!/bin/bash
# Find the line with ConnectedDevicesPage import
line_number=$(grep -n "ConnectedDevicesPage" src/pages/Settings.tsx | cut -d ":" -f 1)
next_line=$((line_number + 1))

# Insert our imports after that line
sed -i'.bak2' "${next_line}i\\
import { checkPasswordStrength, sanitizeInput } from '@/utils/security';\
import { supabase } from '@/integrations/supabase/client';\
import { debounce } from 'lodash';\
import zxcvbn from 'zxcvbn';\
" src/pages/Settings.tsx
