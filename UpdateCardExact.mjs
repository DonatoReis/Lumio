import fs from 'fs';

// Read the file
const filePath = './src/pages/Settings.tsx';
const fileContents = fs.readFileSync(filePath, 'utf8');

// Define the pattern to match the entire password card
const cardPattern = /<Card[^>]*>(\s|\n)*<CardHeader[^>]*>(\s|\n)*<CardTitle>Alterar Senha<\/CardTitle>[\s\S]*?<\/CardContent>(\s|\n)*<\/Card>/;

// Define the replacement card with all our enhancements
const enhancedCard = `<Card className="bg-app-black border-app-border">
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
                          className={\`h-full \${getStrengthColor(passwordValidation.score)}\`} 
                          style={{ width: \`\${(passwordValidation.score + 1) * 20}%\` }}
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
            </Card>`;

// Replace the card in the file
const updatedFileContents = fileContents.replace(cardPattern, enhancedCard);

// Check if a replacement was made
if (updatedFileContents === fileContents) {
  console.error('No changes were made. The card pattern may not have matched.');
  process.exit(1);
}

// Write the updated content back to the file
fs.writeFileSync(filePath, updatedFileContents);

console.log('Password card has been successfully updated!');
