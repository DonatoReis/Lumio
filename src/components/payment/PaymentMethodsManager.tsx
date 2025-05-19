import React, { useState } from 'react';
import { CreditCard, Trash2, CheckCircle, Plus, Loader2 } from 'lucide-react';
import { usePayment, PaymentMethod, PaymentMethodType } from '@/hooks/usePayment';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

// Mapping for payment method types to display names and icons
const PAYMENT_METHOD_INFO = {
  card: {
    label: 'Cartão',
    icon: CreditCard,
  },
  pix: {
    label: 'PIX',
    icon: () => <span className="font-bold text-sm">PIX</span>,
  },
  boleto: {
    label: 'Boleto',
    icon: () => <span className="font-bold text-sm">Boleto</span>,
  },
};

interface PaymentMethodsManagerProps {
  limit?: number;
  showTitle?: boolean;
}

/**
 * Componente para gerenciar métodos de pagamento do usuário
 */
const PaymentMethodsManager: React.FC<PaymentMethodsManagerProps> = ({
  limit,
  showTitle = true,
}) => {
  const { 
    paymentMethods, 
    loadingPaymentMethods, 
    loading,
    fetchPaymentMethods, 
    setDefaultPaymentMethod, 
    removePaymentMethod 
  } = usePayment();
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const { toast } = useToast();

  // Renderizar o ícone do método de pagamento
  const renderPaymentMethodIcon = (type: PaymentMethodType) => {
    const Icon = PAYMENT_METHOD_INFO[type]?.icon || CreditCard;
    return <Icon className="h-5 w-5" />;
  };

  // Renderizar informações do método de pagamento
  const renderPaymentMethodInfo = (method: PaymentMethod) => {
    switch (method.payment_type) {
      case 'card':
        return (
          <div className="flex flex-col">
            <div className="flex items-center">
              <span className="font-medium">
                {method.brand ? `${method.brand} ` : ''}
                •••• {method.last_four_digits}
              </span>
              {method.is_default && (
                <Badge variant="outline" className="ml-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800">
                  Padrão
                </Badge>
              )}
            </div>
            {method.expiry_date && (
              <span className="text-xs text-muted-foreground">
                Expira em {method.expiry_date}
              </span>
            )}
          </div>
        );
      case 'pix':
        return (
          <div className="flex flex-col">
            <span className="font-medium">Chave PIX</span>
            {method.is_default && (
              <Badge variant="outline" className="ml-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800">
                Padrão
              </Badge>
            )}
          </div>
        );
      default:
        return (
          <div className="flex flex-col">
            <span className="font-medium">{PAYMENT_METHOD_INFO[method.payment_type]?.label || 'Método de pagamento'}</span>
            {method.is_default && (
              <Badge variant="outline" className="ml-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800">
                Padrão
              </Badge>
            )}
          </div>
        );
    }
  };

  // Handler para definir um método como padrão
  const handleSetDefault = async (method: PaymentMethod) => {
    if (method.is_default) return; // Já é o padrão
    
    await setDefaultPaymentMethod(method.id);
  };

  // Handler para remover um método de pagamento
  const handleRemove = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setShowRemoveDialog(true);
  };

  // Confirmação de remoção
  const confirmRemove = async () => {
    if (!selectedMethod) return;
    
    const success = await removePaymentMethod(selectedMethod.id);
    if (success) {
      setShowRemoveDialog(false);
      setSelectedMethod(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        {showTitle && (
          <>
            <CardTitle className="flex justify-between items-center">
              <span>Métodos de Pagamento</span>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => fetchPaymentMethods()}
                disabled={loadingPaymentMethods}
                title="Atualizar"
              >
                {loadingPaymentMethods ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>⟳</span>}
              </Button>
            </CardTitle>
            <CardDescription>
              Gerenciar seus métodos de pagamento salvos
            </CardDescription>
          </>
        )}
      </CardHeader>
      
      <CardContent>
        {loadingPaymentMethods ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Carregando métodos de pagamento...</p>
          </div>
        ) : paymentMethods.length === 0 ? (
          <Alert>
            <AlertTitle>Nenhum método de pagamento salvo</AlertTitle>
            <AlertDescription>
              Você ainda não possui métodos de pagamento salvos. Ao fazer uma assinatura, você pode salvar seu método para facilitar pagamentos futuros.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {paymentMethods.slice(0, limit).map((method) => (
              <div 
                key={method.id} 
                className={`flex items-center justify-between p-3 border rounded-lg
                  ${method.is_default ? 'bg-muted/30 border-primary/50' : 'hover:bg-muted/10'}`}
              >
                <div className="flex items-center gap-3">
                  <div className="bg-muted w-10 h-10 rounded-full flex items-center justify-center">
                    {renderPaymentMethodIcon(method.payment_type)}
                  </div>
                  {renderPaymentMethodInfo(method)}
                </div>
                
                <div className="flex gap-2">
                  {!method.is_default && (
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleSetDefault(method)}
                      disabled={loading}
                      title="Definir como padrão"
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                  )}
                  
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => handleRemove(method)}
                    disabled={loading}
                    title="Remover método de pagamento"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            
            {limit && paymentMethods.length > limit && (
              <div className="text-center mt-2">
                <Button variant="ghost" size="sm" asChild>
                  <a href="/payment-methods">Ver todos ({paymentMethods.length})</a>
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-center">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar novo método de pagamento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar método de pagamento</DialogTitle>
              <DialogDescription>
                Para adicionar um novo método de pagamento, você será redirecionado para a página de pagamento.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm">
                Para garantir a segurança dos seus dados, todos os métodos de pagamento são processados diretamente pela Stripe, uma plataforma líder em segurança de pagamentos.
              </p>
            </div>
            <DialogFooter>
              <Button variant="secondary" type="button" asChild>
                <a 
                  href={`https://billing.stripe.com/p/login/test_aEU5kW1Kj55k1yg288`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  Ir para Portal de Pagamentos
                </a>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardFooter>

      {/* Diálogo de confirmação para remover método de pagamento */}
      <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover método de pagamento</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover este método de pagamento? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedMethod && (
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <div className="bg-muted w-10 h-10 rounded-full flex items-center justify-center">
                  {renderPaymentMethodIcon(selectedMethod.payment_type)}
                </div>
                {renderPaymentMethodInfo(selectedMethod)}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="ghost" 
              onClick={() => setShowRemoveDialog(false)} 
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmRemove} 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                'Sim, remover'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default PaymentMethodsManager;

