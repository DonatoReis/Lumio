import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CreditCard, Calendar, CheckCircle2, XCircle, ArrowUpRight, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import CancelSubscriptionModal from '@/components/subscription/CancelSubscriptionModal';
import PaymentHistory from '@/components/payment/PaymentHistory';
import PaymentMethodsManager from '@/components/payment/PaymentMethodsManager';

// Tipos para os dados relacionados a planos
interface UserPlan {
  id: string;
  user_id: string;
  plan_id: string;
  plan_name?: string;
  status: string;
  start_date: string;
  end_date: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
}

interface UserFeature {
  feature_key: string;
  description: string;
  source: string;
}

/**
 * Página de perfil e gestão de plano do usuário
 */
export default function Account() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState<boolean>(true);
  const [currentPlan, setCurrentPlan] = useState<UserPlan | null>(null);
  const [features, setFeatures] = useState<UserFeature[]>([]);
  const [planHistory, setPlanHistory] = useState<UserPlan[]>([]);
  const [cancelingSubscription, setCancelingSubscription] = useState<boolean>(false);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  
  // Formatar status da assinatura
  const formatStatus = (status: string) => {
    switch (status) {
      case 'active':
        return { label: 'Ativo', color: 'success' as const };
      case 'trialing':
        return { label: 'Período de teste', color: 'warning' as const };
      case 'past_due':
        return { label: 'Pagamento pendente', color: 'destructive' as const };
      case 'canceled':
        return { label: 'Cancelado', color: 'default' as const };
      default:
        return { label: status, color: 'default' as const };
    }
  };
  
  // Carregar dados do usuário
  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    const fetchUserData = async () => {
      try {
        setLoading(true);
        
        // Buscar plano atual do usuário
        const { data: currentPlanData, error: currentPlanError } = await supabase
          .from('user_plans_table' as any) // Replace 'user_plans_table' with the correct table name if it exists, and add type assertion
          .select(`
            *,
            plans!inner(
              name
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (currentPlanError && currentPlanError.code !== 'PGRST116') {
          console.error('Erro ao buscar plano atual:', currentPlanError);
          toast({
            title: 'Erro ao carregar informações',
            description: 'Não foi possível buscar seu plano atual.',
            variant: 'destructive'
          });
        }
        
        if (currentPlanData) {
          setCurrentPlan(
            currentPlanData && !('error' in currentPlanData) ? {
              ...currentPlanData,
              plan_name: (typeof currentPlanData.plans === 'object' && currentPlanData.plans !== null) ? currentPlanData.plans.name || 'Plano desconhecido' : 'Plano desconhecido'
            } : null
          );
        }
        // Buscar features do usuário
        const { data: featuresData, error: featuresError } = await supabase
          .from('user_features_table' as any) // Replace 'user_features_table' with a correct table name, if it exists
          .select(`
            feature_key,
            source,
            features!inner(
              description
            )
          `)
          .eq('user_id', user.id);
        
        if (featuresError) {
          console.error('Erro ao buscar features:', featuresError);
        } else if (featuresData) {
          // Transformar resultado em formato mais amigável
          const transformedFeatures = featuresData && !('error' in featuresData) ? featuresData.map(item => ({
            feature_key: item.feature_key,
            description: (typeof item.features === 'object' && item.features !== null) ? item.features.description || 'Feature desconhecida' : 'Feature desconhecida',
            source: item.source
          })) : [];
          
          setFeatures(transformedFeatures);
        }
        
        // Buscar histórico de planos
        const { data: historyData, error: historyError } = await supabase
          .from('user_plans_table' as any) // Replace 'user_plans_table' with a correct table name, if it exists
          .select(`
            *,
            plans!inner(
              name
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        if (historyError) {
          console.error('Erro ao buscar histórico de planos:', historyError);
        } else if (historyData) {
          // Transformar resultado para incluir nome do plano
          const transformedHistory = historyData.map(item => ({
            ...item,
            plan_name: item.plans?.name || 'Plano desconhecido'
          }));
          
          setPlanHistory(transformedHistory);
        }
      } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
        toast({
          title: 'Erro inesperado',
          description: 'Ocorreu um erro ao carregar seus dados. Tente novamente mais tarde.',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, [user, navigate]);
  
  // Abrir modal de cancelamento
  const openCancelModal = () => {
    setShowCancelModal(true);
  };

  // Fechar modal de cancelamento
  const closeCancelModal = () => {
    setShowCancelModal(false);
  };
  
  // Processar o cancelamento de assinatura
  const handleCancelSubscription = async () => {
    if (!currentPlan?.stripe_subscription_id) {
      toast({
        title: 'Erro',
        description: 'Não foi possível identificar sua assinatura.',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      setCancelingSubscription(true);
      
      // Chamar função do Supabase para cancelar a assinatura
      const { data, error } = await supabase.functions.invoke('cancel-subscription', {
        body: { 
          subscriptionId: currentPlan.stripe_subscription_id 
        }
      });
      
      if (error) throw new Error(error.message);
      
      if (data?.success) {
        // Atualizar UI
        setCurrentPlan(prev => prev ? { ...prev, status: 'canceled' } : null);
        
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
  
  // Exibir indicador de carregamento
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Carregando informações da sua conta...</p>
      </div>
    );
  }
  
  return (
    <div className="container py-8 px-4 mx-auto max-w-5xl">
      <h1 className="text-3xl font-bold mb-6">Minha Conta</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Principal - Plano atual */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Plano Atual</span>
                {currentPlan && (
                  <Badge variant={formatStatus(currentPlan.status).color}>
                    {formatStatus(currentPlan.status).label}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Informações sobre sua assinatura atual
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {!currentPlan ? (
                <Alert>
                  <AlertTitle>Sem plano ativo</AlertTitle>
                  <AlertDescription>
                    Você não possui um plano ativo no momento. Escolha um plano para desbloquear recursos premium.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Plano</p>
                      <p className="text-xl font-semibold">{currentPlan.plan_name}</p>
                    </div>
                    
                    {currentPlan.status === 'active' && (
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground mb-1">Renovação</p>
                        <p className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          {currentPlan.end_date ? (
                            format(new Date(currentPlan.end_date), "dd 'de' MMMM',' yyyy", { locale: ptBR })
                          ) : (
                            'Não disponível'
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="pt-2">
                    <p className="text-sm text-muted-foreground mb-2">Recursos Disponíveis</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                      {features.length > 0 ? (
                        features.map(feature => (
                          <div key={feature.feature_key} className="flex items-center">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />
                            <span className="text-sm">{feature.description}</span>
                            {feature.source === 'custom' && (
                              <Badge variant="outline" className="ml-2 text-xs">Personalizado</Badge>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground col-span-2">
                          Nenhum recurso especial disponível
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
            
            <CardFooter className="flex justify-between flex-wrap gap-3">
              <Button variant="outline" asChild>
                <a href="/pricing?source=account">
                  <ArrowUpRight className="mr-2 h-4 w-4" />
                  {currentPlan ? 'Alterar Plano' : 'Ver Planos'}
                </a>
              </Button>
              
              {currentPlan?.status === 'active' && (
                <Button 
                  variant="destructive" 
                  onClick={openCancelModal} 
                  disabled={cancelingSubscription}
                >
                  <span>Cancelar Assinatura</span>
                </Button>
              )}
            </CardFooter>
          </Card>
          
          {/* Histórico de Planos */}
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Assinaturas</CardTitle>
              <CardDescription>
                Histórico dos seus planos anteriores
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {planHistory.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum histórico disponível</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plano</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Término</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {planHistory.map((plan) => (
                      <TableRow key={plan.id}>
                        <TableCell className="font-medium">{plan.plan_name}</TableCell>
                        <TableCell>
                          <Badge variant={formatStatus(plan.status).color}>
                            {formatStatus(plan.status).label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(plan.start_date), 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell>
                          {plan.end_date ? format(new Date(plan.end_date), 'dd/MM/yyyy') : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          
          {/* Histórico de Pagamentos */}
          <PaymentHistory limit={5} />
        </div>
        
        {/* Coluna Lateral - Informações e Links */}
        <div className="space-y-6">
          {/* Métodos de Pagamento */}
          <PaymentMethodsManager limit={3} />
          
          {/* FAQ e ajuda */}
          <Card>
            <CardHeader>
              <CardTitle>Precisa de ajuda?</CardTitle>
              <CardDescription>
                Dúvidas frequentes sobre sua conta e plano
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-1">Como mudar de plano?</h3>
                <p className="text-xs text-muted-foreground">
                  Visite a página de Planos e selecione o novo plano desejado. O valor será ajustado proporcionalmente.
                </p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-1">Como funciona o cancelamento?</h3>
                <p className="text-xs text-muted-foreground">
                  Ao cancelar, sua assinatura permanecerá ativa até o final do período já pago.
                </p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-1">Como atualizar método de pagamento?</h3>
                <p className="text-xs text-muted-foreground">
                  Acesse o Portal do Cliente através do botão acima para gerenciar seus métodos de pagamento.
                </p>
              </div>
              
              <Separator className="my-2" />
              
              <div className="pt-2">
                <Button variant="ghost" size="sm" className="w-full" asChild>
                  <a href="/support">
                    Contatar Suporte
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
