# Correção dos Problemas de Assinatura

## 1. Adicionar o Componente Modal ao Account.tsx

1. Abra o arquivo `src/pages/Account.tsx`
2. Vá até o final do componente, logo antes do último `</div>` (antes do `return` final)
3. Adicione o componente CancelSubscriptionModal:

```jsx
{/* Modal de confirmação de cancelamento */}
<CancelSubscriptionModal
  isOpen={showCancelModal}
  onClose={closeCancelModal}
  onConfirm={handleCancelSubscription}
  loading={cancelingSubscription}
/>
```

O componente final deveria terminar assim:

```jsx
      </div>
    </div>
    
    {/* Modal de confirmação de cancelamento */}
    <CancelSubscriptionModal
      isOpen={showCancelModal}
      onClose={closeCancelModal}
      onConfirm={handleCancelSubscription}
      loading={cancelingSubscription}
    />
  );
}
```

## 2. Implantar as Edge Functions do Supabase

Para implantar as Edge Functions, siga estas etapas:

1. Verifique se você tem o CLI do Supabase instalado:
```bash
supabase -v
```

2. Faça login no Supabase:
```bash
supabase login
```

3. Acesse a pasta do projeto:
```bash
cd /Users/creisbarreto/Downloads/biz-connect-ai-nexus-main
```

4. Implante cada uma das novas funções:
```bash
supabase functions deploy setup-intent
supabase functions deploy save-payment-method
supabase functions deploy remove-payment-method
```

5. Reimplante as funções existentes que foram atualizadas:
```bash
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook
```

## Resumo das Alterações

1. **Correção do Modal de Cancelamento**:
   - Adicionado o componente CancelSubscriptionModal ao final do componente Account.tsx
   - Conectado aos estados e funções corretos para gerenciar o cancelamento

2. **Implantação das Edge Functions**:
   - `setup-intent`: Permite adicionar métodos de pagamento
   - `save-payment-method`: Salva os métodos no banco de dados
   - `remove-payment-method`: Remove métodos de pagamento
   - Atualização das funções existentes para suportar novas funcionalidades

Depois de fazer essas alterações, os botões "Alterar Plano" e "Cancelar Assinatura" devem funcionar corretamente.
