# Correção dos Botões em Settings.tsx

Para fazer os botões "Alterar Plano" e "Cancelar Assinatura" funcionarem na página de Settings, siga estas instruções:

## 1. Adicionar Importações Necessárias

No topo do arquivo `src/pages/Settings.tsx`, adicione estas importações (junto com as existentes):

```javascript
import CancelSubscriptionModal from '@/components/subscription/CancelSubscriptionModal';
import { usePayment } from '@/hooks/usePayment';
```

## 2. Adicionar Estados e Funções

Dentro do componente Settings, adicione estes estados (junto com os outros `useState`):

```javascript
const [showCancelModal, setShowCancelModal] = useState(false);
const [cancelingSubscription, setCancelingSubscription] = useState(false);
```

Adicione estas funções (antes do `return`):

```javascript
// Funções para o modal de cancelamento
const openCancelModal = () => {
  setShowCancelModal(true);
};

const closeCancelModal = () => {
  setShowCancelModal(false);
};

// Função para cancelar a assinatura
const handleCancelSubscription = async () => {
  if (!user?.id) {
    toast({
      title: 'Erro',
      description: 'Você precisa estar logado para cancelar sua assinatura.',
      variant: 'destructive'
    });
    return;
  }
  
  try {
    setCancelingSubscription(true);
    
    // Buscar ID da assinatura
    const { data: userPlan, error: planError } = await supabase
      .from('user_plans')
      .select('stripe_subscription_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    
    if (planError) throw new Error(planError.message);
    
    if (!userPlan?.stripe_subscription_id) {
      throw new Error('Não foi possível identificar sua assinatura.');
    }
    
    // Chamar função do Supabase para cancelar a assinatura
    const { data, error } = await supabase.functions.invoke('cancel-subscription', {
      body: { 
        subscriptionId: userPlan.stripe_subscription_id 
      }
    });
    
    if (error) throw new Error(error.message);
    
    if (data?.success) {
      // Atualizar UI - opcional: recarregar a página ou atualizar o estado
      
      toast({
        title: 'Assinatura cancelada',
        description: 'Sua assinatura foi cancelada com sucesso. Você terá acesso até o final do período já pago.',
        variant: 'default'
      });
      
      // Fechar modal após cancelamento bem-sucedido
      closeCancelModal();
    } else {
      throw new Error(data?.message || 'Erro ao cancelar assinatura');
    }
  } catch (error) {
    console.error('Erro ao cancelar assinatura:', error);
    toast({
      title: 'Erro ao cancelar assinatura',
      description: error instanceof Error ? error.message : 'Ocorreu um erro inesperado',
      variant: 'destructive'
    });
  } finally {
    setCancelingSubscription(false);
  }
};
```

## 3. Atualizar os Botões

Localize os botões por volta da linha 738 e modifique-os assim:

```jsx
<div className="flex justify-end gap-2">
  <Button 
    variant="outline" 
    onClick={() => navigate('/pricing?source=settings')}
  >
    Alterar Plano
  </Button>
  <Button 
    variant="destructive" 
    onClick={openCancelModal}
    disabled={cancelingSubscription}
  >
    Cancelar Assinatura
  </Button>
</div>
```

## 4. Adicionar o Modal de Cancelamento

No final do componente, antes do último fechamento de parênteses e depois do último `</div>`, adicione:

```jsx
{/* Modal de confirmação de cancelamento */}
<CancelSubscriptionModal
  isOpen={showCancelModal}
  onClose={closeCancelModal}
  onConfirm={handleCancelSubscription}
  loading={cancelingSubscription}
/>
```

## Após essas alterações, os botões devem funcionar:

1. "Alterar Plano" vai navegar para a página de preços
2. "Cancelar Assinatura" vai abrir o modal de confirmação
3. Ao confirmar no modal, a assinatura será cancelada através da Edge Function

Lembre-se de certificar que as Edge Functions foram implantadas corretamente como mencionado anteriormente.
