# Implantação das Edge Functions do Supabase

Para resolver os problemas com os botões "Alterar Plano" e "Cancelar Assinatura", é necessário implantar as Edge Functions no Supabase. Estas funções são responsáveis por processar as operações de pagamento e gerenciamento de assinaturas.

## Métodos de Implantação

### Método 1: Usando o CLI do Supabase

1. **Instale o CLI do Supabase** (se ainda não tiver):
   ```bash
   # Com npm
   npm install -g supabase

   # Ou com Homebrew no macOS
   brew install supabase/tap/supabase
   ```

2. **Faça login no Supabase**:
   ```bash
   supabase login
   ```

3. **Vincule o projeto** (se ainda não estiver vinculado):
   ```bash
   # Substitua PROJECT_REF pelo ID do seu projeto Supabase
   # Encontre-o no URL do dashboard: https://app.supabase.com/project/PROJECT_REF
   supabase link --project-ref YOUR_PROJECT_REF
   ```

4. **Implante as novas funções** do diretório atual:
   ```bash
   cd /Users/creisbarreto/Downloads/biz-connect-ai-nexus-main
   supabase functions deploy setup-intent
   supabase functions deploy save-payment-method
   supabase functions deploy remove-payment-method
   ```

5. **Reimplante as funções existentes que foram atualizadas**:
   ```bash
   supabase functions deploy create-checkout
   supabase functions deploy stripe-webhook
   ```

### Método 2: Usando o Dashboard do Supabase

1. Acesse o [Dashboard do Supabase](https://app.supabase.com)
2. Selecione seu projeto
3. Vá para "Edge Functions" no menu lateral
4. Para cada função, clique em "New Function" e siga as instruções:
   - Nome da função: `setup-intent`
   - Selecione o arquivo: navegue até `/Users/creisbarreto/Downloads/biz-connect-ai-nexus-main/supabase/functions/setup-intent/index.ts`
   - Repita para `save-payment-method`, `remove-payment-method`, e as funções atualizadas

## Verificação da Implantação

Após a implantação, você pode verificar se as funções estão funcionando corretamente:

1. No Dashboard do Supabase, vá para "Edge Functions"
2. Verifique se todas as funções estão listadas e têm status "Live"
3. Teste os botões "Alterar Plano" e "Cancelar Assinatura" na aplicação
4. Verifique os logs das funções para debugging, se necessário

## Variáveis de Ambiente Necessárias

Certifique-se de que suas Edge Functions têm acesso a estas variáveis de ambiente:

- `STRIPE_SECRET_KEY`: Sua chave secreta do Stripe
- `STRIPE_WEBHOOK_SECRET`: Segredo para verificar webhooks do Stripe
- `SUPABASE_URL`: URL do seu projeto Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: Chave de serviço do Supabase
- `SUPABASE_ANON_KEY`: Chave anônima do Supabase

Você pode configurar estas variáveis através do dashboard do Supabase em:
Edge Functions > Settings > Environment variables

## Funções que precisam ser implantadas:

1. `setup-intent`: Permite adicionar métodos de pagamento sem fazer uma compra
2. `save-payment-method`: Salva referências a métodos de pagamento no banco de dados
3. `remove-payment-method`: Remove métodos de pagamento salvos
4. `create-checkout`: (atualizada) Suporta múltiplos métodos de pagamento e parcelamento
5. `stripe-webhook`: (atualizada) Registra histórico de pagamentos

Após implantar estas funções, os botões "Alterar Plano" e "Cancelar Assinatura" devem funcionar corretamente.
