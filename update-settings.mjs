import fs from 'fs';
import path from 'path';

// Path to the Settings.tsx file
const settingsPath = path.join('src', 'pages', 'Settings.tsx');

// Read the current file content
const fileContent = fs.readFileSync(settingsPath, 'utf8');

// Add import for PasswordResetForm
const importRegex = /import {[\s\S]*?} from 'lucide-react';/;
const updatedImports = fileContent.match(importRegex)[0] + '\nimport PasswordResetForm from \'@/components/security/PasswordResetForm\';';

// Replace the old password change card with the new component
const passwordCardRegex = /<Card className="bg-app-black border-app-border">[\s\S]*?<CardHeader>[\s\S]*?<CardTitle>Alterar Senha<\/CardTitle>[\s\S]*?<\/CardHeader>[\s\S]*?<CardContent[\s\S]*?<\/CardContent>[\s\S]*?<\/Card>/;

const newPasswordCard = `<Card className="bg-app-black border-app-border">
              <CardHeader>
                <CardTitle>Alterar Senha</CardTitle>
                <CardDescription>
                  Altere sua senha regularmente para maior segurança
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <PasswordResetForm 
                  onSuccess={() => {
                    toast({
                      title: "Senha alterada com sucesso",
                      description: "Sua nova senha foi configurada e outras sessões foram encerradas"
                    });
                  }}
                  onError={(error) => {
                    console.error('Error changing password:', error);
                    toast({
                      variant: "destructive",
                      title: "Erro ao alterar senha",
                      description: error.message || "Ocorreu um erro ao tentar alterar sua senha"
                    });
                  }}
                />
              </CardContent>
            </Card>`;

// Update the file content
let updatedContent = fileContent.replace(importRegex, updatedImports);
updatedContent = updatedContent.replace(passwordCardRegex, newPasswordCard);

// Write the updated content back to the file
fs.writeFileSync(settingsPath, updatedContent, 'utf8');

console.log('Successfully updated Settings.tsx with PasswordResetForm component');
