import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho para o arquivo Messages.tsx
const filePath = path.join(__dirname, 'src', 'pages', 'Messages.tsx');

// Conteúdo de substituição para a seção problemática
const replacement = `          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-auto p-2">
              {conversationsLoading ? (
                <div className="flex items-center justify-center h-24">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <p>Nenhuma conversa encontrada</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => setDialogOpen(true)}
                  >
                    <MessageSquarePlus className="h-4 w-4 mr-2" />
                    Nova conversa
                  </Button>
                </div>
              ) : (
                filteredConversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className="relative"
                  >
                    {/* Item da conversa */}
                    <div
                      onClick={() => {
                        setSelectedConversationId(conversation.id);
                        if (window.innerWidth < 768) {
                          setShowSidebar(false);
                        }
                      }}
                      className={\`p-3 cursor-pointer \${
                        selectedConversationId === conversation.id ? 'bg-muted-foreground/10' : ''
                      }\`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>
                              {getInitials(conversation.participants[0]?.email || 'U')}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between">
                              <div className="font-medium truncate">
                                {getConversationName(conversation)}
                                {conversation.is_favorite && (
                                  <span className="ml-1 text-yellow-500">⭐</span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                                {formatDate(conversation.lastMessage?.created_at)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>`;

try {
  // Ler o conteúdo atual do arquivo
  const data = fs.readFileSync(filePath, 'utf8');
  
  // Dividir o arquivo em linhas
  const lines = data.split('\n');
  
  // Substituir as linhas 571-796
  const startLine = 571;  // Linha onde começa a seção a ser substituída
  const endLine = 796;    // Linha onde termina a seção a ser substituída
  
  // Construir o novo conteúdo
  const newLines = [
    ...lines.slice(0, startLine),
    replacement,
    ...lines.slice(endLine)
  ];
  
  // Juntar as linhas novamente
  const correctedContent = newLines.join('\n');
  
  // Escrever o conteúdo corrigido de volta para o arquivo
  fs.writeFileSync(filePath, correctedContent, 'utf8');
  console.log('Seção do arquivo substituída com sucesso!');
} catch (err) {
  console.error('Erro:', err);
}
