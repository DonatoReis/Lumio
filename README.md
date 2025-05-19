# Biz Connect AI Nexus 

## Visão Geral

O Biz Connect AI Nexus é uma plataforma de comunicação que oferece mensagens em tempo real e compartilhamento de mídia com criptografia de ponta a ponta. Desenvolvido utilizando React, Vite, Shadcn UI e Supabase, o projeto visa garantir a segurança e a privacidade das comunicações dos usuários.

## Funcionalidades

### Mensagens em Tempo Real

O sistema de mensagens em tempo real foi implementado com as seguintes características:

*   **Prevenção de Duplicação de Conversas:** Utilização de IDs determinísticos para evitar a criação de múltiplas conversas entre os mesmos participantes. O ID da conversa é gerado a partir de um hash dos IDs dos usuários participantes, garantindo que a mesma combinação de usuários sempre resulte no mesmo ID.
    ```typescript
    // Generates a deterministic conversation ID based on participants
    // Sort UIDs to ensure consistent order regardless of who initiates
    // Join with a separator
    // Calculate a consistent hash
    // Format as UUID-like string
    const generateConversationId = async (userIds: string[]): Promise<string> => {
      // Sort UIDs to ensure consistent order regardless of who initiates
      const sortedUserIds = [...userIds].sort();
      // Join with a separator
      const joinedIds = sortedUserIds.join(':');
      // Calculate a consistent hash
      const hash = await calculateHash(joinedIds);
      // Format as UUID-like string
      return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
    };
    ```
*   **Configurações Específicas do Usuário:** A tabela `user_conversation_preferences` permite que cada usuário personalize sua experiência (soft deletion, mute, pin, archive). Essa tabela armazena as preferências de cada usuário em relação a cada conversa, permitindo que ele "delete" uma conversa sem afetar a visibilidade para outros participantes, silencie notificações, fixe conversas no topo da lista ou archive conversas antigas.
    ```sql
    CREATE TABLE user_conversation_preferences (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      is_muted BOOLEAN NOT NULL DEFAULT false,
      is_pinned BOOLEAN NOT NULL DEFAULT false,
      is_archived BOOLEAN NOT NULL DEFAULT false,
      is_deleted BOOLEAN NOT NULL DEFAULT false,
      messages_cleared_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
      UNIQUE(user_id, conversation_id)
    );
    ```
*   **Criação de Conversas Sob Demanda:** Conversas são criadas apenas quando a primeira mensagem é enviada, evitando a criação de conversas vazias no banco de dados.
*   **Subscriptions em Tempo Real Aprimoradas:** Canais em tempo real configurados para lidar com todos os eventos (INSERT, UPDATE, DELETE), garantindo que as atualizações nas mensagens sejam refletidas em tempo real para todos os participantes da conversa.

### Compartilhamento de Mídia Encriptada

O compartilhamento de mídia é realizado com criptografia de ponta a ponta, garantindo que apenas o remetente e o destinatário tenham acesso ao conteúdo.

*   **Processo de Criptografia:**
    1.  Geração de uma chave simétrica AES-256 única para cada arquivo.
    2.  Criptografia do arquivo localmente com a chave simétrica.
    3.  Criptografia da chave simétrica com a chave pública do destinatário (Signal Protocol).
    4.  Upload do arquivo criptografado e metadados para o servidor.
    5.  Download do arquivo criptografado e metadados pelo destinatário.
    6.  Decriptografia da chave simétrica com a chave privada do destinatário.
    7.  Decriptografia do arquivo com a chave simétrica.

*Fluxo de Dados:*

```
┌─────────┐         ┌───────────┐         ┌──────────┐
│  Remetente│         │  Supabase │         │Destinatário│
│  Cliente │         │  Backend  │         │  Cliente  │
└────┬────┘         └─────┬─────┘         └────┬─────┘
     │                    │                     │
     │ Gerar              │                     │
     │ chave simétrica    │                     │
     │◄─────────┐         │                     │
     │          │         │                     │
     │ Criptografar arquivo │                     │
     │◄─────────┐         │                     │
     │          │         │                     │
     │ Criptografar chave │                     │
     │ simétrica com chave│                     │
     │ pública do destinatário│                     │
     │◄─────────┐         │                     │
     │          │         │                     │
     │ Upload criptografado │                     │
     │ arquivo & metadados│                     │
     │─────────────────► │                     │
     │                    │ Armazenar em       │
     │                    │ Supabase Storage    │
     │                    │◄──────────┐         │
     │                    │            │        │
     │                    │ Notificar destinatário│
     │                    │ via Realtime       │
     │                    │────────────────────►│
     │                    │                     │
     │                    │ Download criptografado│
     │                    │ arquivo & metadados│
     │                    │◄────────────────────│
     │                    │                     │
     │                    │                     │ Decriptografar
     │                    │                     │ chave simétrica
     │                    │                     │◄─────────┐
     │                    │                     │          │
     │                    │                     │ Decriptografar arquivo
     │                    │                     │◄─────────┐
     │                    │                     │          │
     │                    │                     │ Exibir mídia
     │                    │                     │◄─────────┐
```

*   **Componentes Técnicos:**
    *   `MediaUploader`: Componente React para seleção, criptografia e upload de mídia.
    *   `MediaViewer`: Componente React para download, descriptografia e exibição de mídia.
    *   `useEncryptedMedia`: Hook para gerenciar o estado e as operações de mídia criptografada.
    *   `useMediaMessages`: Hook para integrar com o sistema de mensagens.
    *   `uploadMedia`: Edge Function para uploads seguros de arquivos.
    *   `cleanupMedia`: Scheduled Edge Function para remover arquivos de mídia expirados.
    *   Supabase Storage: Para armazenar arquivos criptografados.
    *   Supabase Database: Para armazenar metadados.
    *   `mediaCrypto.ts`: Utilitários para criptografia/descriptografia de mídia.
    *   `signalProtocol.ts`: Implementação do Signal Protocol para troca de chaves.

### Outras Funcionalidades

*   Gerenciamento de perfil
*   Sistema de pagamento
*   Autenticação Multifator
*   KYC (Know Your Customer)
*   Marketplace

## Arquitetura

O projeto utiliza uma arquitetura baseada em:

*   **Frontend:** React com Vite e Shadcn UI para a interface do usuário.
*   **Backend:** Supabase (autenticação, banco de dados PostgreSQL, armazenamento de arquivos) para gerenciar os dados e a lógica do aplicativo.
*   **Edge Functions:** Funções executadas na borda da rede (servidores da Supabase) para tarefas específicas e de alta performance, como:
    *   `uploadMedia`: Lidar com uploads seguros de arquivos de mídia.
    *   `cleanupMedia`: Remover arquivos de mídia expirados, garantindo a otimização do armazenamento e a privacidade dos dados.

## Estrutura do Projeto

```
biz-connect-ai-nexus-main/
├── src/
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   ├── contexts/
│   ├── utils/
│   ├── App.tsx
│   ├── main.tsx
│   └── ...
├── public/
├── supabase/
├── package.json
├── README.md
├── .env
└── ...
```

*   `src/`: Contém o código fonte da aplicação React.
    *   `components/`: Componentes reutilizáveis.
    *   `pages/`: Páginas da aplicação.
    *   `hooks/`: Hooks personalizados.
    *   `contexts/`: Contextos para gerenciamento de estado.
    *   `utils/`: Funções utilitárias.
*   `public/`: Arquivos estáticos.
*   `supabase/`: Configuração do Supabase (schemas, policies, functions).
*   `package.json`: Informações sobre o projeto e dependências.
*   `.env`: Variáveis de ambiente.

## Instalação e Execução

Para executar o projeto localmente:

1.  Clone o repositório:

    ```bash
    git clone https://github.com/seu-usuario/biz-connect-ai-nexus-main.git
    ```
2.  Navegue até o diretório do projeto:

    ```bash
    cd biz-connect-ai-nexus-main
    ```
3.  Instale as dependências:

    ```bash
    npm install
    ```
4.  Configure as variáveis de ambiente:

    *   Crie um arquivo `.env` na raiz do projeto.
    *   Copie o conteúdo do `.env.example` para o `.env` e ajuste os valores de acordo com sua configuração.
    ```
    VITE_SUPABASE_URL=https://<seu-projeto>.supabase.co
    VITE_SUPABASE_FUNCTIONS_URL=https://<seu-projeto>.functions.supabase.co
    VITE_VAPID_PUBLIC_KEY=<sua-chave-vapid-publica>

    VITE_API_BASE_URL=http://localhost:3001/api
    VITE_TURN_URL=turn:turn.myserver.com:3478

    STRIP_PUBLIC_KEY=<sua-chave-publica-stripe>
    ```

5.  Execute o projeto:

    ```bash
    npm run dev
    ```

## Contribuição

Para contribuir com o projeto:

1.  Faça um fork do repositório.
2.  Crie uma branch com sua feature: `git checkout -b minha-feature`
3.  Faça commit das suas mudanças: `git commit -m 'feat: Minha nova feature'`
4.  Faça push para a branch: `git push origin minha-feature`
5.  Abra um pull request.

## Licença

[A definir]

## Demonstração

[Capturas de tela ou GIFs demonstrando as funcionalidades do projeto (se disponíveis).]

