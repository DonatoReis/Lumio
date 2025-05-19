#!/bin/bash

# Create a file with the enhanced password card implementation
cat > password-card.txt << 'ENDCARD'
            <Card className="bg-app-black border-app-border">
              <CardHeader>
                <CardTitle>Alterar Senha</CardTitle>
                <CardDescription>
                  Altere sua senha regularmente para maior segurança
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Senha Atual</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={passwordVisibility.currentPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="bg-app-border/30 pr-10"
                      value={passwordForm.currentPassword}
                      onChange={handlePasswordInputChange}
                      autoComplete="current-password"
                      disabled={isSubmitting}
                    />
                    <button 
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      onClick={() => togglePasswordVisibility('currentPassword')}
                      disabled={isSubmitting}
                    >
                      {passwordVisibility.currentPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nova Senha</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={passwordVisibility.newPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="bg-app-border/30 pr-10"
                      value={passwordForm.newPassword}
                      onChange={handlePasswordInputChange}
                      autoComplete="new-password"
                      disabled={isSubmitting}
                    />
                    <button 
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      onClick={() => togglePasswordVisibility('newPassword')}
                      disabled={isSubmitting}
                    >
                      {passwordVisibility.newPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  
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
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={passwordVisibility.confirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="bg-app-border/30 pr-10"
                      value={passwordForm.confirmPassword}
                      onChange={handlePasswordInputChange}
                      autoComplete="new-password"
                      disabled={isSubmitting}
                    />
                    <button 
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      onClick={() => togglePasswordVisibility('confirmPassword')}
                      disabled={isSubmitting}
                    >
                      {passwordVisibility.confirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {passwordForm.confirmPassword.length > 0 && !passwordValidation.passwordsMatch && (
                    <div className="text-red-400 text-xs flex items-center mt-1">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      As senhas não correspondem
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end">
                  <Button 
                    onClick={handlePasswordChange} 
                    disabled={!isPasswordFormValid() || isSubmitting}
                  >
                    {isSubmitting ? (
                      <div className="flex items-center space-x-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Processando...</span>
                      </div>
                    ) : (
                      "Alterar Senha"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
ENDCARD

# Use grep to find the exact line where the password card starts
CARD_START_LINE=$(grep -n "<Card.*Alterar Senha" src/pages/Settings.tsx | awk -F: '{print $1}')
CARD_START_LINE=$((CARD_START_LINE - 1)) # Adjust to catch the beginning of the card

# Find where this card ends (search for the next Card component)
NEXT_CARD_LINE=$(tail -n +$CARD_START_LINE src/pages/Settings.tsx | grep -n "<Card" | tail -n +2 | head -n 1 | awk -F: '{print $1}')
CARD_END_LINE=$((CARD_START_LINE + NEXT_CARD_LINE - 2))

# Create a new version of the file
cp src/pages/Settings.tsx src/pages/Settings.tsx.new

# Extract the part before the password card
head -n $CARD_START_LINE src/pages/Settings.tsx > src/pages/Settings.tsx.part1

# Extract the part after the password card
tail -n +$CARD_END_LINE src/pages/Settings.tsx > src/pages/Settings.tsx.part2

# Create the new file
cat src/pages/Settings.tsx.part1 password-card.txt src/pages/Settings.tsx.part2 > src/pages/Settings.tsx.new

# Verify and replace the original file if all looks good
mv src/pages/Settings.tsx.new src/pages/Settings.tsx

# Clean up temp files
rm src/pages/Settings.tsx.part1 src/pages/Settings.tsx.part2 password-card.txt

echo "Password card has been replaced successfully!"
