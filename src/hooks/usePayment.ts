
import { useState, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Database } from '@/types/supabase';

export type PlanId = string;
export type CheckoutMode = 'subscription' | 'payment';
export type PaymentMethodType = 'card' | 'pix' | 'boleto';

export interface InstallmentOptions {
  enabled: boolean;
  plan?: {
    count: number;
    interval: 'month';
  };
}

export interface CheckoutOptions {
  mode?: CheckoutMode;
  paymentMethod?: PaymentMethodType;
  installments?: InstallmentOptions;
  savePaymentMethod?: boolean;
}

export interface PaymentMethod {
  id: string;
  payment_method_id: string;
  payment_type: PaymentMethodType;
  last_four_digits?: string;
  expiry_date?: string;
  brand?: string;
  is_default: boolean;
  created_at: string;
}

export interface SetupIntentResult {
  clientSecret: string;
  setupIntentId: string;
  customerId: string;
}

export interface SavePaymentMethodParams {
  paymentMethodId: string;
  makeDefault?: boolean;
  setupIntentId?: string;
}

interface PaymentDetails {
  status: string;
  planId: PlanId;
  customerId: string;
  paymentStatus: string;
  paymentIntent: string;
  subscriptionId: string;
  subscriptionType: string;
}

interface PaymentVerificationResult {
  success: boolean;
  paymentVerified: boolean;
  details?: PaymentDetails;
}

export const usePayment = () => {
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [paymentResult, setPaymentResult] = useState<PaymentVerificationResult | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);
  const [setupIntent, setSetupIntent] = useState<SetupIntentResult | null>(null);
  const [addingPaymentMethod, setAddingPaymentMethod] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  
  /**
   * Inicia o checkout do Stripe para um plano específico
   * @param planId Identificador do plano
   * @param options Opções adicionais para o checkout
   */
  const initiateCheckout = async (
    planId: PlanId,
    options: CheckoutOptions & { billingInterval?: 'monthly' | 'yearly' } = {}
  ) => {
    if (!user) {
      toast({
        title: "Autenticação necessária",
        description: "Você precisa estar logado para assinar um plano.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const {
        billingInterval = 'monthly',
        mode = 'subscription',
        paymentMethod = 'card',
        installments,
        savePaymentMethod = true
      } = options;
      
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          planId,
          billingInterval,
          mode,
          paymentMethod,
          installments,
          savePaymentMethod
        }
      });
      
      if (error) throw new Error(error.message);
      
      if (data?.url) {
        // Abrir o checkout do Stripe em uma nova aba
        window.open(data.url, '_blank');
      } else {
        throw new Error("Não foi possível criar a sessão de checkout");
      }
      
      return data;
    } catch (error: any) {
      console.error('Erro ao iniciar checkout:', error);
      
      toast({
        title: "Erro ao iniciar pagamento",
        description: error.message || "Não foi possível processar sua solicitação",
        variant: "destructive",
      });
      
      return null;
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Verifica o status de um pagamento/assinatura
   * @param sessionId ID da sessão de checkout do Stripe
   */
  const verifyPayment = useCallback(async (sessionId: string) => {
    if (!user) {
      toast({
        title: "Autenticação necessária",
        description: "Você precisa estar logado para verificar o status do pagamento.",
        variant: "destructive",
      });
      return null;
    }
    
    try {
      setVerifying(true);
      
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { sessionId }
      });
      
      if (error) throw new Error(error.message);
      
      setPaymentResult(data as PaymentVerificationResult);
      
      if (data.paymentVerified) {
        toast({
          title: "Pagamento confirmado",
          description: "Seu pagamento foi processado com sucesso!",
        });
      } else {
        toast({
          title: "Pagamento pendente",
          description: "Seu pagamento está sendo processado.",
          variant: "default",
        });
      }
      
      return data as PaymentVerificationResult;
    } catch (error: any) {
      console.error('Erro ao verificar pagamento:', error);
      
      toast({
        title: "Erro na verificação",
        description: error.message || "Não foi possível verificar o status do pagamento",
        variant: "destructive",
      });
      
      return null;
    } finally {
      setVerifying(false);
    }
  }, [user, toast]);
  
  /**
   * Carrega os métodos de pagamento salvos do usuário
   */
  const fetchPaymentMethods = async () => {
    if (!user) {
      return [];
    }

    try {
      setLoadingPaymentMethods(true);
      
      const { data, error } = await supabase
        .from('payment_methods' as any)
        .select('*')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) {
        // Se a tabela não existir ainda, apenas retorne um array vazio
        // e não dispare um erro visual para o usuário
        if (error.message.includes('does not exist')) {
          console.warn('Tabela payment_methods não existe ainda. As migrações precisam ser aplicadas.');
          setPaymentMethods([]);
          return [];
        }
        throw new Error(error.message);
      }
      
      setPaymentMethods(data ? data as PaymentMethod[] : []);
      return data || [];
    } catch (error: any) {
      console.error('Erro ao carregar métodos de pagamento:', error);
      
      toast({
        title: "Erro ao carregar métodos de pagamento",
        description: error.message || "Não foi possível carregar seus métodos de pagamento salvos",
        variant: "destructive",
      });
      
      return [];
    } finally {
      setLoadingPaymentMethods(false);
    }
  };
  
  /**
   * Define um método de pagamento como padrão
   * @param paymentMethodId ID do método de pagamento a ser definido como padrão
   */
  const setDefaultPaymentMethod = async (paymentMethodId: string) => {
    if (!user) {
      toast({
        title: "Autenticação necessária",
        description: "Você precisa estar logado para gerenciar métodos de pagamento.",
        variant: "destructive",
      });
      return false;
    }
    
    try {
      setLoading(true);
      
      const { data, error } = await supabase.rpc<boolean, { p_user_id: string, p_payment_method_id: string }>(
        'set_default_payment_method',
        { 
          p_user_id: user.id,
          p_payment_method_id: paymentMethodId
        }
      );
      
      if (error) throw new Error(error.message);
      
      // Atualizar a lista local de métodos de pagamento
      await fetchPaymentMethods();
      
      toast({
        title: "Método de pagamento atualizado",
        description: "Seu método de pagamento padrão foi alterado com sucesso.",
        variant: "default",
      });
      
      return true;
    } catch (error: any) {
      console.error('Erro ao definir método de pagamento padrão:', error);
      
      toast({
        title: "Erro ao atualizar método de pagamento",
        description: error.message || "Não foi possível definir o método de pagamento como padrão",
        variant: "destructive",
      });
      
      return false;
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Remove um método de pagamento
   * @param paymentMethodId ID do método de pagamento a ser removido
   */
  const removePaymentMethod = async (paymentMethodId: string) => {
    if (!user) {
      toast({
        title: "Autenticação necessária",
        description: "Você precisa estar logado para gerenciar métodos de pagamento.",
        variant: "destructive",
      });
      return false;
    }
    
    try {
      setLoading(true);
      
      // Primeiro, excluir do Stripe (via função Edge)
      const { error: stripeError } = await supabase.functions.invoke('remove-payment-method', {
        body: { paymentMethodId }
      });
      
      if (stripeError) throw new Error(stripeError.message);
      
      // Em seguida, excluir do banco de dados local
      const { error: dbError } = await supabase
        .from<Database['public']['Tables']['payment_methods']['Row'], Database['public']['Tables']['payment_methods']['Row']>('payment_methods')
        .delete()
        .eq('id', paymentMethodId);
      
      if (dbError) throw new Error(dbError.message);
      
      // Atualizar a lista local
      setPaymentMethods(prev => prev.filter(method => method.id !== paymentMethodId));
      
      toast({
        title: "Método de pagamento removido",
        description: "Seu método de pagamento foi removido com sucesso.",
        variant: "default",
      });
      
      return true;
    } catch (error: any) {
      console.error('Erro ao remover método de pagamento:', error);
      
      toast({
        title: "Erro ao remover método de pagamento",
        description: error.message || "Não foi possível remover o método de pagamento",
        variant: "destructive",
      });
      
      return false;
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Cria um SetupIntent para adicionar um método de pagamento
   * @param paymentMethodType Tipo de método de pagamento (card, pix, etc)
   */
  const createSetupIntent = async (paymentMethodType: PaymentMethodType = 'card') => {
    if (!user) {
      toast({
        title: "Autenticação necessária",
        description: "Você precisa estar logado para adicionar um método de pagamento.",
        variant: "destructive",
      });
      return null;
    }
    
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('setup-intent', {
        body: { paymentMethodType }
      });
      
      if (error) throw new Error(error.message);
      
      if (!data?.clientSecret) {
        throw new Error("Resposta inválida do servidor");
      }
      
      setSetupIntent(data as SetupIntentResult);
      return data as SetupIntentResult;
    } catch (error: any) {
      console.error('Erro ao criar SetupIntent:', error);
      
      toast({
        title: "Erro ao preparar adição de método de pagamento",
        description: error.message || "Não foi possível iniciar o processo",
        variant: "destructive",
      });
      
      return null;
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Salva um método de pagamento na base de dados
   * @param params Parâmetros para salvar o método
   */
  const savePaymentMethod = async (params: SavePaymentMethodParams) => {
    if (!user) {
      toast({
        title: "Autenticação necessária",
        description: "Você precisa estar logado para salvar um método de pagamento.",
        variant: "destructive",
      });
      return null;
    }
    
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('save-payment-method', {
        body: params
      });
      
      if (error) throw new Error(error.message);
      
      // Atualizar a lista de métodos de pagamento
      await fetchPaymentMethods();
      
      toast({
        title: "Método de pagamento salvo",
        description: "Seu método de pagamento foi salvo com sucesso.",
        variant: "default",
      });
      
      return data?.paymentMethod || null;
    } catch (error: any) {
      console.error('Erro ao salvar método de pagamento:', error);
      
      toast({
        title: "Erro ao salvar método de pagamento",
        description: error.message || "Não foi possível salvar o método de pagamento",
        variant: "destructive",
      });
      
      return null;
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Adiciona um novo método de pagamento
   * Esta função trata toda a lógica de adicionar um método:
   * 1. Cria um SetupIntent
   * 2. Processa o pagamento do lado do cliente (usando Stripe.js)
   * 3. Salva o método de pagamento no banco de dados
   * 
   * @param paymentMethodId ID do método de pagamento do Stripe
   * @param setupIntentId ID do SetupIntent (opcional, se já tiver um)
   * @param makeDefault Define se este método será o padrão
   */
  const addPaymentMethod = async (
    paymentMethodId: string,
    setupIntentId?: string,
    makeDefault: boolean = true
  ) => {
    if (!user) {
      toast({
        title: "Autenticação necessária",
        description: "Você precisa estar logado para adicionar um método de pagamento.",
        variant: "destructive",
      });
      return null;
    }
    
    try {
      setAddingPaymentMethod(true);
      
      // Salvar o método de pagamento
      const savedMethod = await savePaymentMethod({
        paymentMethodId,
        setupIntentId,
        makeDefault
      });
      
      if (!savedMethod) {
        throw new Error("Não foi possível salvar o método de pagamento");
      }
      
      toast({
        title: "Método de pagamento adicionado",
        description: "Seu método de pagamento foi adicionado com sucesso.",
        variant: "default",
      });
      
      // Resetar o setupIntent
      setSetupIntent(null);
      
      return savedMethod;
    } catch (error: any) {
      console.error('Erro ao adicionar método de pagamento:', error);
      
      toast({
        title: "Erro ao adicionar método de pagamento",
        description: error.message || "Ocorreu um erro inesperado",
        variant: "destructive",
      });
      
      return null;
    } finally {
      setAddingPaymentMethod(false);
    }
  };
  
  // Carregar métodos de pagamento ao inicializar o hook
  useEffect(() => {
    if (user) {
      fetchPaymentMethods();
    }
  }, [user]);

  return {
    loading,
    verifying,
    loadingPaymentMethods,
    addingPaymentMethod,
    paymentResult,
    paymentMethods,
    setupIntent,
    initiateCheckout,
    verifyPayment,
    fetchPaymentMethods,
    setDefaultPaymentMethod,
    removePaymentMethod,
    createSetupIntent,
    savePaymentMethod,
    addPaymentMethod
  };
};
