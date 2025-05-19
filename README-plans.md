# Sistema de Gerenciamento de Planos de Usuários

Implementação completa de um sistema de gerenciamento de planos com integração ao Stripe, incluindo backend, frontend e testes.

## Índice

- [Visão Geral](#visão-geral)
- [Arquitetura](#arquitetura)
  - [Banco de Dados](#banco-de-dados)
  - [Backend](#backend)
  - [Frontend](#frontend)
- [Fluxo de Trabalho](#fluxo-de-trabalho)
  - [Checkout e Pagamento](#checkout-e-pagamento)
  - [Webhooks e Processamento](#webhooks-e-processamento)
  - [Autorização por Feature](#autorização-por-feature)
- [Guia de Administração](#guia-de-administração)
  - [Como Adicionar Novos Planos](#como-adicionar-novos-planos)
  - [Como Adicionar Novas Features](#como-adicionar-novas-features)
  - [Como Associar Features a Planos](#como-associar-features-a-planos)
- [Testes](#testes)
  - [Testes Unitários](#testes-unitários)
  - [Testes de Integração](#testes-de-integração)
  - [Testes Manuais](#testes-manuais)
- [Troubleshooting e Monitoramento](#troubleshooting-e-monitoramento)
  - [Logs e Observabilidade](#logs-e-observabilidade)
  - [Problemas Comuns](#problemas-comuns)
- [Considerações de Segurança](#considerações-de-segurança)

## Visão Geral

O Sistema de Gerenciamento de Planos de Usuários é uma solução completa para implementar e controlar planos de assinatura em aplicações web. Ele permite:

- Definir diferentes planos (Básico, Pro, Enterprise) com preços e features específicos
- Processar pagamentos através da integração com o Stripe
- Autorização baseada em features, não em planos (desacoplamento)
- Atualização em tempo real das permissões dos usuários
- Interface de gerenciamento de assinaturas para usuários

A abordagem utilizada é focada no desacoplamento entre código e lógica de planos, permitindo que novos planos e features sejam adicionados sem necessidade de alterações no código ou deployments.

## Arquitetura

### Banco de Dados

O sistema utiliza as seguintes tabelas no Supabase:

- **plans**: Armazena os planos disponíveis
  - `id`: UUID do plano
  - `name`: Nome do plano
  - `stripe_price_id`: ID do preço no Stripe
  - `created_at`, `updated_at`: Timestamps

- **features**: Armazena as funcionalidades disponíveis
  - `id`: UUID da feature
  - `feature_key`: Chave única da feature (enum)
  - `description`: Descrição da feature
  - `created_at`, `updated_at`: Timestamps

- **plan_features**: Associa features a planos (muitos-para-muitos)
  - `plan_id`: ID do plano
  - `feature_key`: Chave da feature
  - `created_at`: Timestamp

- **user_plans**: Registra os planos ativos de cada usuário
  - `user_id`: ID do usuário
  - `plan_id`: ID do plano
  - `status`: Status da assinatura ('trialing', 'active', 'past_due', 'canceled')
  - `start_date`, `end_date`: Período da assinatura
  - `stripe_subscription_id`: ID da assinatura no Stripe
  - `created_at`, `updated_at`: Timestamps

- **user_features**: Armazena as features disponíveis para cada usuário
  - `user_id`: ID do usuário
  - `feature_key`: Chave da feature
  - `source`: Origem da feature ('plan' ou 'custom')
  - `created_at`: Timestamp

- **stripe_events**: Armazena eventos processados do Stripe (idempotência)
  - `id`: ID do evento no Stripe
  - `processed_at`: Timestamp do processamento
  - `user_id`: ID do usuário relacionado
  - `type`: Tipo de evento
  - `data`: Dados do evento (JSON)
  - `created_at`, `updated_at`: Timestamps

Cada tabela possui Row-Level Security (RLS) configurado para limitar o acesso apenas aos usuários autorizados.

### Backend

O backend consiste em Edge Functions do Supabase para interação com o Stripe:

1. **create-checkout**: Inicia o processo de checkout do Stripe
   - Localização: `./supabase/functions/create-checkout/index.ts`
   - Recebe: planId e mode ('subscription' ou 'payment')
   - Retorna: URL de checkout do Stripe

2. **verify-payment**: Verifica o status de uma sessão de checkout
   - Localização: `./supabase/functions/verify-payment/index.ts`
   - Recebe: sessionId
   - Retorna: Informações sobre o pagamento/assinatura

3. **stripe-webhook**: Processa webhooks enviados pelo Stripe
   - Localização: `./supabase/functions/stripe-webhook/index.ts`
   - Recebe: Eventos do Stripe (checkout.session.completed, invoice.payment_succeeded, etc.)
   - Atualiza: Tabelas user_plans e user_features

4. **cancel-subscription**: Cancela uma assinatura ativa
   - Localização: `./supabase/functions/cancel-subscription/index.ts`
   - Recebe: subscriptionId
   - Atualiza: Status da assinatura no Stripe e banco de dados

O backend também inclui funções SQL no banco de dados:
- `sync_user_features`: Sincroniza as features de um usuário com base em seu plano
- `add_feature_to_plan`: Adiciona uma feature a um plano e a todos os usuários com esse plano

### Frontend

O frontend é composto por:

1. **Store e Hooks**:
   - `useFeaturesStore`: Store Zustand para gerenciar features do usuário
   - `useFeature`: Hook para verificar se o usuário tem acesso a uma feature
   - Localização: `./src/store/useFeaturesStore.ts`

2. **Componentes de UI**:
   - `FeatureGate`: Componente que controla acesso às funcionalidades
   - `UpgradeBanner`: Componente para sugerir upgrade quando necessário
   - Localização: `./src/components/features/`

3. **Páginas**:
   - `Pricing`: Página de planos disponíveis
   - `Account`: Página de gerenciamento de conta/plano
   - Localização: `./src/pages/`

4. **Testes**:
   - Testes para os hooks e componentes
   - Localização: `./src/store/useFeaturesStore.test.ts`

## Fluxo de Trabalho

### Checkout e Pagamento

1. **Seleção de Plano**: 
   - Usuário acessa a página de Pricing (`/pricing`)
   - Visualiza os diferentes planos disponíveis com suas features
   - Clica em "Escolher Plano" para iniciar checkout

2. **Checkout do Stripe**:
   - Frontend chama `initiateCheckout` do hook `usePayment`
   - Edge Function `create-checkout` é invocada
   - Busca o `stripe_price_id` do plano selecionado
   - Cria uma sessão de checkout no Stripe com `client_reference_id` = `user_id`
   - Redireciona para página de checkout do Stripe

3. **Pagamento**:
   - Usuário completa o pagamento no Stripe
   - Stripe redireciona para página de sucesso (`/payment-success`)
   - Frontend verifica o status via `verify-payment` Edge Function

### Webhooks e Processamento

1. **Evento de Webhook**:
   - Stripe envia webhook para `stripe-webhook` Edge Function
   - Função verifica assinatura para autenticação

2. **Processamento de Eventos**:
   - Para `checkout.session.completed`:
     - Identifica usuário via `client_reference_id`
     - Registra o plano em `user_plans`
     - Sincroniza features em `user_features`
   
   - Para `invoice.payment_succeeded`:
     - Atualiza status da assinatura
     - Estende a data de término
   
   - Para `customer.subscription.deleted`:
     - Atualiza status para 'canceled'
     - Remove features baseadas em plano

3. **Notificação ao Cliente**:
   - Mudanças em `user_features` ativam trigger `notify_feature_update`
   - Frontend recebe atualização via canal websocket
   - Store de features é atualizado automaticamente

### Autorização por Feature

1. **Controle de Acesso**:
   - Componentes usam `FeatureGate` para proteger funcionalidades
   - `FeatureGate` usa o hook `useFeature` para verificar permissões
   - Se o usuário não tem acesso, exibe fallback (UpgradeBanner)

2. **Workflow de Verificação**:
   - Frontend carrega features do usuário na inicialização
   - Features são armazenadas em cache no Zustand store
   - Verifição de permissão é instantânea e sem chamadas ao servidor

3. **Sincronização Automática**:
   - Features são atualizadas quando o usuário faz login
   - Realtime subscription atualiza o store quando há mudanças
   - Front-end sempre exibe estado atual e correto das permissões

## Guia de Administração

### Como Adicionar Novos Planos

Para adicionar um novo plano ao sistema, insira um registro na tabela `plans`:

```sql
-- Adicionar novo plano
INSERT INTO plans (name, stripe_price_id)
VALUES ('Plano Premium Plus', 'price_premium_plus');
```

Nota: O `stripe_price_id` deve ser criado previamente no dashboard do Stripe.

### Como Adicionar Novas Features

Para adicionar uma nova feature ao sistema:

1. Adicione a nova chave ao enum `feature_key_enum`:

```sql
-- Adicionar novo valor ao enum
ALTER TYPE feature_key_enum ADD VALUE 'nova_feature';
```

2. Insira a nova feature na tabela `features`:

```sql
-- Adicionar nova feature
INSERT INTO features (feature_key, description)
VALUES ('nova_feature', 'Descrição da nova feature');
```

### Como Associar Features a Planos

Para associar features a planos, use a função `add_feature_to_plan` ou insira diretamente na tabela:

```sql
-- Usando a função (recomendado - atualiza usuários automaticamente)
SELECT add_feature_to_plan('id-do-plano', 'feature_key');

-- Ou inserindo diretamente
INSERT INTO plan_features (plan_id, feature_key)
VALUES ('id-do-plano', 'feature_key');
```

Para adicionar feature a todos os planos existentes:

```sql
INSERT INTO plan_features (plan_id, feature_key)
SELECT id, 'nova_feature' FROM plans;
```

## Testes

### Testes Unitários

Os testes unitários focam principalmente no hook `useFeature` e nos componentes relacionados:

```bash
# Executar testes unitários
bun test src/store/useFeaturesStore.test.ts
```

Os testes verificam:
- Comportamento quando usuário não está autenticado
- Carregamento de features para usuário autenticado
- Verificação correta de acesso a features
- Estados de carregamento (loading)

### Testes de Integração

Para testar a integração com o Stripe, utilize o modo de teste do Stripe:

1. Use cartões de teste do Stripe:
   - 4242 4242 4242 4242: Pagamento bem-sucedido
   - 4000 0000 0000 0002: Cartão recusado

2. Teste os webhooks usando o Stripe CLI:
   ```bash
   stripe listen --forward-to https://your-project.supabase.co/functions/v1/stripe-webhook
   ```

3. Simulate eventos de webhook:
   ```bash
   stripe trigger checkout.session.completed
   stripe trigger invoice.payment_succeeded
   ```

### Testes Manuais

Fluxo de teste manual recomendado:

1. Criar conta na aplicação
2. Visitar página de planos (/pricing)
3. Selecionar um plano
4. Completar checkout com cartão de teste
5. Verificar acesso a features na aplicação
6. Testar cancelamento na página de conta
7. Verificar que features foram removidas

## Troubleshooting e Monitoramento

### Logs e Observabilidade

Todos os Edge Functions utilizam formato estruturado de logs:

```js
logger.info("Evento processado", { eventId, userId });
logger.error("Falha no processamento", error);
```

Para visualizar logs:
1. Painel do Supabase > Edge Functions > Logs
2. Ou configure Log Drains para enviar logs para Logflare, Datadog, etc.

A tabela `stripe_events` mantém histórico de todos os eventos processados, facilitando auditoria e debug.

### Problemas Comuns

**Problema**: Usuário não tem acesso a features após pagamento
**Solução**: 
1. Verifique se o webhook `checkout.session.completed` foi recebido e processado
2. Confirme que o `client_reference_id` foi setado corretamente no checkout
3. Verifique se as features estão associadas ao plano em `plan_features`

**Problema**: Webhook do Stripe retornando erro 
**Solução**:
1. Verifique se `STRIPE_WEBHOOK_SECRET` está configurado corretamente
2. Confirme que o endpoint está acessível publicamente
3. Verifique logs completos da função na dashboard do Supabase

**Problema**: Features não sendo atualizadas em tempo real
**Solução**:
1. Confirme que `useFeatureSync` está sendo usado na raiz da aplicação
2. Verifique se o canal de realtime está ativo e configurado corretamente
3. Recarregue features manualmente com `refreshFeatures()`

## Considerações de Segurança

### Row-Level Security (RLS)

Todas as tabelas têm R
