#!/bin/bash

# Find the lines containing specific markers in the password card
CURRENT_PW_LINE=$(grep -n "id=\"currentPassword\"" src/pages/Settings.tsx | head -n 1 | cut -d ":" -f 1)
NEW_PW_LINE=$(grep -n "id=\"newPassword\"" src/pages/Settings.tsx | head -n 1 | cut -d ":" -f 1)
CONFIRM_PW_LINE=$(grep -n "id=\"confirmPassword\"" src/pages/Settings.tsx | head -n 1 | cut -d ":" -f 1)
BUTTON_LINE=$(grep -n "onClick={handlePasswordChange}" src/pages/Settings.tsx | head -n 1 | cut -d ":" -f 1)

if [ -z "$CURRENT_PW_LINE" ] || [ -z "$NEW_PW_LINE" ] || [ -z "$CONFIRM_PW_LINE" ] || [ -z "$BUTTON_LINE" ]; then
  echo "Could not find all markers in the file!"
  exit 1
fi

# Update the current password field
sed -i'.bak1' "${CURRENT_PW_LINE}s/type=\"password\"/type={passwordVisibility.currentPassword ? \"text\" : \"password\"}/" src/pages/Settings.tsx
sed -i'.bak2' "${CURRENT_PW_LINE}s/className=\"bg-app-border\/30 pr-10\"/className=\"bg-app-border\/30 pr-10\" value={passwordForm.currentPassword} onChange={handlePasswordInputChange} autoComplete=\"current-password\" disabled={isSubmitting}/" src/pages/Settings.tsx

# Update the Eye button for current password
EYE_BUTTON_LINE=$((CURRENT_PW_LINE + 5))
sed -i'.bak3' "${EYE_BUTTON_LINE}s/<button /<button type=\"button\" onClick={() => togglePasswordVisibility('currentPassword')} disabled={isSubmitting} /" src/pages/Settings.tsx
sed -i'.bak4' "${EYE_BUTTON_LINE}s/<Eye className=\"h-4 w-4\" \/>/{passwordVisibility.currentPassword ? <EyeOff className=\"h-4 w-4\" \/> : <Eye className=\"h-4 w-4\" \/>}/" src/pages/Settings.tsx

# Update the new password field
sed -i'.bak5' "${NEW_PW_LINE}s/type=\"password\"/type={passwordVisibility.newPassword ? \"text\" : \"password\"}/" src/pages/Settings.tsx
sed -i'.bak6' "${NEW_PW_LINE}s/className=\"bg-app-border\/30 pr-10\"/className=\"bg-app-border\/30 pr-10\" value={passwordForm.newPassword} onChange={handlePasswordInputChange} autoComplete=\"new-password\" disabled={isSubmitting}/" src/pages/Settings.tsx

# Update the Eye button for new password
EYE_BUTTON_LINE_2=$((NEW_PW_LINE + 5))
sed -i'.bak7' "${EYE_BUTTON_LINE_2}s/<button /<button type=\"button\" onClick={() => togglePasswordVisibility('newPassword')} disabled={isSubmitting} /" src/pages/Settings.tsx
sed -i'.bak8' "${EYE_BUTTON_LINE_2}s/<EyeOff className=\"h-4 w-4\" \/>/{passwordVisibility.newPassword ? <EyeOff className=\"h-4 w-4\" \/> : <Eye className=\"h-4 w-4\" \/>}/" src/pages/Settings.tsx

# Add password strength meter after new password field
STRENGTH_METER=$(cat << 'ENDMETER'
                  
                  {/* Password strength meter */}
                  {passwordForm.newPassword.length > 0 && (
                    <div className="space-y-1 mt-1">
                      <div className="flex justify-between items-center text-xs">
                        <span>Força da Senha:</span>
                        <span className="font-medium">{getStrengthText(passwordValidation.score)}</span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${getStrengthColor(passwordValidation.score)}`} 
                          style={{ width: `${(passwordValidation.score + 1) * 20}%` }}
                        ></div>
                      </div>
                      
                      {/* Password requirements checklist */}
                      <div className="mt-2 space-y-1">
                        <div className="text-xs flex items-center">
                          {passwordValidation.hasMinLength ? 
                            <CheckCircle2 className="h-3 w-3 mr-1 text-green-400" /> : 
                            <AlertCircle className="h-3 w-3 mr-1 text-amber-400" />}
                          Mínimo de 8 caracteres
                        </div>
                        <div className="text-xs flex items-center">
                          {passwordValidation.hasUppercase ? 
                            <CheckCircle2 className="h-3 w-3 mr-1 text-green-400" /> : 
                            <AlertCircle className="h-3 w-3 mr-1 text-amber-400" />}
                          Pelo menos uma letra maiúscula (A-Z)
                        </div>
                        <div className="text-xs flex items-center">
                          {passwordValidation.hasLowercase ? 
                            <CheckCircle2 className="h-3 w-3 mr-1 text-green-400" /> : 
                            <AlertCircle className="h-3 w-3 mr-1 text-amber-400" />}
                          Pelo menos uma letra minúscula (a-z)
                        </div>
                        <div className="text-xs flex items-center">
                          {passwordValidation.hasNumber ? 
                            <CheckCircle2 className="h-3 w-3 mr-1 text-green-400" /> : 
                            <AlertCircle className="h-3 w-3 mr-1 text-amber-400" />}
                          Pelo menos um número (0-9)
                        </div>
                        <div className="text-xs flex items-center">
                          {passwordValidation.hasSpecial ? 
                            <CheckCircle2 className="h-3 w-3 mr-1 text-green-400" /> : 
                            <AlertCircle className="h-3 w-3 mr-1 text-amber-400" />}
                          Pelo menos um caractere especial (!@#$%...)
                        </div>
                        <div className="text-xs flex items-center">
                          {passwordValidation.strongEnough ? 
                            <CheckCircle2 className="h-3 w-3 mr-1 text-green-400" /> : 
                            <AlertCircle className="h-3 w-3 mr-1 text-amber-400" />}
                          Nível de segurança suficiente
                        </div>
                      </div>
                    </div>
                  )}
ENDMETER
)

# Insert the strength meter after the new password field
NEW_PW_DIV_END=$((NEW_PW_LINE + 12))
sed -i'.bak9' "${NEW_PW_DIV_END}i\\
${STRENGTH_METER}" src/pages/Settings.tsx

# Update the confirm password field
sed -i'.bak10' "${CONFIRM_PW_LINE}s/type=\"password\"/type={passwordVisibility.confirmPassword ? \"text\" : \"password\"}/" src/pages/Settings.tsx
sed -i'.bak11' "${CONFIRM_PW_LINE}s/className=\"bg-app-border\/30 pr-10\"/className=\"bg-app-border\/30 pr-10\" value={passwordForm.confirmPassword} onChange={handlePasswordInputChange} autoComplete=\"new-password\" disabled={isSubmitting}/" src/pages/Settings.tsx

# Update the Eye button for confirm password
EYE_BUTTON_LINE_3=$((CONFIRM_PW_LINE + 5))
sed -i'.bak12' "${EYE_BUTTON_LINE_3}s/<button /<button type=\"button\" onClick={() => togglePasswordVisibility('confirmPassword')} disabled={isSubmitting} /" src/pages/Settings.tsx
sed -i'.bak13' "${EYE_BUTTON_LINE_3}s/<EyeOff className=\"h-4 w-4\" \/>/{passwordVisibility.confirmPassword ? <EyeOff className=\"h-4 w-4\" \/> : <Eye className=\"h-4 w-4\" \/>}/" src/pages/Settings.tsx

# Add confirmation error message
CONFIRM_PW_DIV_END=$((CONFIRM_PW_LINE + 12))
ERROR_MESSAGE=$(cat << 'ENDERROR'
                  {passwordForm.confirmPassword.length > 0 && !passwordValidation.passwordsMatch && (
                    <div className="text-red-400 text-xs flex items-center mt-1">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      As senhas não correspondem
                    </div>
                  )}
ENDERROR
)

sed -i'.bak14' "${CONFIRM_PW_DIV_END}i\\
${ERROR_MESSAGE}" src/pages/Settings.tsx

# Update the submit button
sed -i'.bak15' "${BUTTON_LINE}s/onClick={handlePasswordChange}/onClick={handlePasswordChange} disabled={!isPasswordFormValid() || isSubmitting}/" src/pages/Settings.tsx

# Update the button content
BUTTON_CONTENT=$(cat << 'ENDBUTTON'
                    {isSubmitting ? (
                      <div className="flex items-center space-x-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Processando...</span>
                      </div>
                    ) : (
                      "Alterar Senha"
                    )}
ENDBUTTON
)

sed -i'.bak16' "${BUTTON_LINE}s/Alterar Senha/${BUTTON_CONTENT}/" src/pages/Settings.tsx

echo "Password card has been enhanced successfully!"
