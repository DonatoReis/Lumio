import "@/styles/animations.css";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePayment } from '@/hooks/usePayment';
import { Check, MinusCircle, Loader2, MessageSquare, Video, Users, ShoppingBag, Bot, BarChart2, CircuitBoard, LifeBuoy, Database, Clock, UserCog, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { Switch } from '@/components/ui/switch';
import { GlowEffectCard } from '@/components/features/GlowEffectCard';
import { Label } from '@/components/ui/label';
import { useLocation } from 'react-router-dom';

// Tipos para os dados de plano e feature
interface PlanFeature {
  feature_key: string;
  description: string;
}

interface Plan {
  id: string;
  name: string;
  stripe_price_id: string;
  features: PlanFeature[];
  pricing: PriceInfo;
}

interface PriceInfo {
  monthly: number | null;
  yearly: number | null;
  annualMonthly?: number;
  custom?: boolean;
}

interface UserPlan {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  start_date: string;
  end_date: string | null;
}

// Database types for Supabase
interface Database {
  public: {
    Tables: {
      plans: {
        Row: {
          id: string;
          name: string;
          stripe_price_id: string;
          // Add other columns as needed
        };
      };
      plan_features: {
        Row: {
          id: string;
          plan_id: string;
          feature_key: string;
          // Add other columns as needed
        };
      };
      features: {
        Row: {
          key: string;
          description: string;
          // Add other columns as needed
        };
      };
      user_plans: {
        Row: {
          id: string;
          user_id: string;
          plan_id: string;
          status: string;
          start_date: string;
          end_date: string | null;
          // Add other columns as needed
        };
      };
    };
  };
}

// Type for Plan IDs to use with checkout
type PlanId = string;


// Definição de ícones e descrições para cada feature
const FEATURE_ICONS = {
  'mensagens_ilimitadas': { icon: MessageSquare, label: 'Mensagens ilimitadas' },
  'chamadas_audio_video': { icon: Video, label: 'Chamadas de áudio/vídeo' },
  'grupos': { icon: Users, label: 'Grupos' },
  'marketplace': { icon: ShoppingBag, label: 'Marketplace' },
  'ia_prospeccao_avancada': { icon: Sparkles, label: 'IA de prospecção avançada' },
  'estatisticas_uso': { icon: BarChart2, label: 'Estatísticas de uso' },
  'automacao_marketing': { icon: CircuitBoard, label: 'Automação de marketing' },
  'bots_personalizados': { icon: Bot, label: 'Bots personalizados' },
  'integracao_crm': { icon: Database, label: 'Integração com CRM' },
  'priority_support': { icon: LifeBuoy, label: 'Suporte prioritário' },
  'apis_exclusivas': { icon: CircuitBoard, label: 'APIs exclusivas' },
  'sla_dedicado': { icon: Clock, label: 'SLA dedicado' },
  'suporte_24_7': { icon: LifeBuoy, label: 'Suporte 24/7' },
  'onboarding_personalizado': { icon: Sparkles, label: 'Onboarding personalizado' },
  'gerente_conta_dedicado': { icon: UserCog, label: 'Gerente de conta dedicado' }
};

/**
 * Página de planos que mostra os diferentes planos disponíveis
 * e permite que o usuário faça upgrade.
 */
export default function Pricing() {
  const { user } = useAuth();
  const { initiateCheckout, loading: checkoutLoading } = usePayment();
  const location = useLocation();
  
  // Check if user is coming from account page to change their plan
  const isChangingPlan = new URLSearchParams(location.search).get('source') === 'account';
  
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPlan, setUserPlan] = useState<UserPlan | null>(null);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');
  
  // Carregar planos e features associadas
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoading(true);
        
        // Buscar todos os planos
        const { data: plansData, error: plansError } = await supabase
          .from('plans' as any)
          .select('*')
          .order('id');
        
        if (plansError) throw plansError;
        if (!plansData) throw new Error('Nenhum plano encontrado');
        
        // Para cada plano, buscar suas features
        const typedPlansData = plansData as any[];
        // Fetch dynamic pricing from Stripe via Edge Function
        const allPriceIds = Array.from(
          new Set(
            typedPlansData.flatMap((p) => [
              (p as any).stripe_monthly_price_id,
              (p as any).stripe_yearly_price_id,
            ].filter(Boolean))
          )
        );
        const { data: pricingResp, error: pricingError } =
          await supabase.functions.invoke("get-plans-pricing", {
            body: { priceIds: allPriceIds },
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabase.auth.session()?.access_token}`, // Se precisar de autorização
            },
          });
        if (pricingError || !pricingResp) {
          console.error("Erro ao buscar preços (detalhado):", pricingError);
          throw pricingError || new Error("Erro ao buscar preços");
        }
        const pricingMap = (pricingResp as any)
          .pricingMap as Record<string, { unit_amount: number }>;
        const plansWithFeatures = await Promise.all(typedPlansData.map(async (plan) => {
          // Type assertion for plan
          const typedPlan = plan as any;
          
          // Buscar features deste plano
          const { data: featuresData, error: featuresError } = await supabase
            .from('plan_features' as any)
            .select(`
              feature_key,
              features:feature_key(description)
            `)
            .eq('plan_id', typedPlan.id);
          
          if (featuresError) {
            console.error(`Erro ao buscar features do plano ${typedPlan.id}:`, featuresError);
            return {
              id: typedPlan.id,
              name: typedPlan.name,
              stripe_price_id: typedPlan.stripe_price_id,
              features: [],
              pricing: { monthly: null, yearly: null, annualMonthly: undefined }
            } as Plan;
          }
          
          // Transformar os dados para o formato que queremos
          const features = (featuresData || []).map(item => ({
            feature_key: (item as any).feature_key,
            description: (item as any).features?.description || 'Feature não encontrada'
          }));
          
          return {
            id: typedPlan.id,
            name: typedPlan.name,
            stripe_price_id: typedPlan.stripe_price_id,
            features,
            pricing: (() => {
              const monthlyCents =
                pricingMap[typedPlan.stripe_monthly_price_id]?.unit_amount ?? 0;
              const yearlyCents =
                pricingMap[typedPlan.stripe_yearly_price_id]?.unit_amount ?? 0;
              return {
                monthly: monthlyCents / 100,
                yearly: yearlyCents / 100,
                annualMonthly: yearlyCents
                  ? yearlyCents / 12 / 100
                  : undefined,
              };
            })(),
          } as Plan;
        }));
        
        // Sort plans in correct order: Free, Pro, Business, Enterprise
        const sortedPlans = [...plansWithFeatures].sort((a, b) => {
          const order = { 'Free': 1, 'Pro': 2, 'Business': 3, 'Enterprise': 4 };
          return (order[a.name as keyof typeof order] || 99) - (order[b.name as keyof typeof order] || 99);
        });
        
        
        setPlans(sortedPlans);
        
        // Se o usuário estiver logado, buscar seu plano atual
        if (user) {
          const { data: userPlanData, error: userPlanError } = await supabase
            .from('user_plans' as any)
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .maybeSingle();
          
          if (!userPlanError && userPlanData) {
            const typedUserPlan = {
              id: (userPlanData as any).id,
              user_id: (userPlanData as any).user_id,
              plan_id: (userPlanData as any).plan_id,
              status: (userPlanData as any).status,
              start_date: (userPlanData as any).start_date,
              end_date: (userPlanData as any).end_date
            } as UserPlan;
            
            setUserPlan(typedUserPlan);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar planos:', error);
        toast({
          title: 'Erro ao carregar planos',
          description: 'Não foi possível carregar os planos disponíveis.',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchPlans();
  }, [user]);
  
  // Iniciar o checkout para um plano
  const handleSelectPlan = async (planId: PlanId) => {
    if (!user) {
      toast({
        title: 'Faça login primeiro',
        description: 'Você precisa estar logado para escolher um plano.',
        variant: 'default'
      });
      return;
    }
    
    try {
      await initiateCheckout(planId, { billingInterval, mode: 'subscription' });
    } catch (error) {
      console.error('Erro ao iniciar checkout:', error);
      toast({
        title: 'Erro ao processar pagamento',
        description: 'Não foi possível iniciar o processo de pagamento. Tente novamente.',
        variant: 'destructive'
      });
    }
  };
  
  // Verificar se um plano é o atual do usuário
  const isCurrentPlan = (planId: PlanId) => {
    return userPlan?.plan_id === planId;
  };
  
  // Feature display
  const featureRow = (feature: PlanFeature, includes: boolean) => {
    const featureInfo = FEATURE_ICONS[feature.feature_key as keyof typeof FEATURE_ICONS];
    const Icon = featureInfo?.icon || Check;
    
    return (
      <div className="flex items-center gap-2 py-2">
        {includes ? (
          <motion.div 
            whileHover={{ scale: 1.1 }} 
            className="text-green-500 dark:text-green-400"
          >
            <Icon className="h-4 w-4 transition-all" />
          </motion.div>
        ) : (
          <MinusCircle className="h-4 w-4 text-gray-300 dark:text-gray-600" />
        )}
        <span className={`text-sm ${!includes ? 'text-muted-foreground' : ''}`}>
          {featureInfo?.label || feature.description}
        </span>
      </div>
    );
  };
  
  // Mostrar estado de carregamento
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Carregando planos disponíveis...</p>
      </div>
    );
  }
  
  return (
    <div className="container px-4 py-8 mx-auto max-w-6xl">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          {isChangingPlan ? 'Alterar seu Plano' : 'Planos e Preços'}
        </h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          {isChangingPlan 
            ? 'Selecione o novo plano para sua assinatura' 
            : 'Escolha o plano ideal para suas necessidades de negócio'
          }
        </p>
        
        {/* Seletor de período de cobrança */}
        <div className="flex justify-center items-center mt-8 gap-4">
          <Label htmlFor="billing-toggle" className={`text-sm ${billingInterval === 'monthly' ? 'font-semibold' : 'text-muted-foreground'}`}>Mensal</Label>
          <Switch
            id="billing-toggle"
            checked={billingInterval === 'yearly'}
            onCheckedChange={(checked) => setBillingInterval(checked ? 'yearly' : 'monthly')}
          />
          <div className="flex flex-col items-start">
            <Label htmlFor="billing-toggle" className={`text-sm ${billingInterval === 'yearly' ? 'font-semibold' : 'text-muted-foreground'}`}>
              Anual
              <Badge variant="outline" className="ml-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800">
                Economize até 17%
              </Badge>
            </Label>
          </div>
        </div>
      </div>
      
      {/* Grid de planos */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan, index) => {
          const pricing = plan.pricing;
          const isPro = plan.name === 'Pro';
          const isBusiness = plan.name === 'Business';
          const isEnterprise = plan.name === 'Enterprise';
          const isFree = plan.name === 'Free';
          
          const current = isCurrentPlan(plan.id);
          
          // Determine price display based on plan and billing interval
          const priceDisplay = () => {
            console.log(`[DEBUG] priceDisplay for ${plan.name} - billing interval:`, billingInterval);
            console.log(`[DEBUG] priceDisplay for ${plan.name} - pricing:`, pricing);
            
            if (pricing && 'custom' in pricing && pricing.custom) {
              return "Sob consulta";
            }
            
            const price = billingInterval === 'monthly' 
              ? pricing?.monthly 
              : pricing?.yearly;
              
            console.log(`[DEBUG] priceDisplay for ${plan.name} - selected price:`, price);
            
            if (price === 0) {
              return "0,00";
            }
            
            if (price === null || price === undefined) {
              return "Sob consulta";
            }
            
            return price.toFixed(2).replace('.', ',');
          };
          
          // Button text based on plan type and context
          const getButtonText = () => {
            if (checkoutLoading) return "Processando...";
            if (current) return "Plano Atual";
            
            if (isChangingPlan) {
              if (isFree) return "Mudar para Gratuito";
              if (isPro) return "Mudar para Pro";
              if (isBusiness) return "Mudar para Business";
              if (isEnterprise) return "Solicitar Enterprise";
              return "Mudar para este Plano";
            } else {
              if (isFree) return "Começar Grátis";
              if (isPro) return "Adquirir Pro";
              if (isBusiness) return "Assinar Business";
              if (isEnterprise) return "Fale com Vendas";
              return "Escolher Plano";
            }
          };
          
          // Description text based on plan type
          const getDescription = () => {
            if (isFree) return "Para usuários individuais e pequenos negócios";
            if (isPro) return "Para profissionais e empresas em crescimento";
            if (isBusiness) return "Para empresas que buscam crescimento acelerado";
            if (isEnterprise) return "Soluções personalizadas para grandes empresas";
            return "";
          };
          
          // Display annual price per month if available
          const renderAnnualMonthlyPrice = () => {
            if (billingInterval === 'yearly' && pricing && pricing.yearly) {
              const perMonth = pricing.yearly / 12;
              return (
                <div className="text-sm text-muted-foreground mt-1">
                  R$ {perMonth.toFixed(2).replace('.', ',')}/mês
                </div>
              );
            }
            return null;
          };
          
          // Card wrapper with Pro plan highlight
          const CardWrapper = ({ children }: { children: React.ReactNode }) => {
            if (isPro) {
              return <GlowEffectCard>{children}</GlowEffectCard>;
            }
            return <>{children}</>;
          };

          // Get the cursor style for plan button
          const getButtonCursorStyle = () => {
            if (checkoutLoading || current) return "cursor-not-allowed";
            return "cursor-pointer";
          };
           
          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="flex"
            >
              <CardWrapper>
                <Card 
                  className={`w-full relative overflow-hidden transition-all duration-300 hover:scale-105
                    min-h-[600px] flex flex-col
                    ${current ? 'border-primary shadow-md' : ''}
                    ${isPro ? 'bg-transparent border-none text-white z-10' : ''}
                  `}
                >
                  {current && (
                    <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs transform translate-x-2 -translate-y-0 rotate-45 origin-bottom-left shadow-sm">
                      Seu plano
                    </div>
                  )}
                  {/* "Mais Popular" badge for Pro plan */}
                  {isPro && !current && (
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-none px-3 py-1">
                        Mais Popular
                      </Badge>
                    </div>
                  )}
                  
                  <CardHeader className={`${isPro ? 'relative z-10 bg-transparent' : ''}`}>
                    <CardTitle className={`text-xl ${isPro ? 'text-[#f1f1f1] font-bold' : ''}`}>{plan.name}</CardTitle>
                    <CardDescription className={isPro ? 'text-white/80' : ''}>
                      {getDescription()}
                    </CardDescription>
                    <div className="mt-4">
                      {pricing && 'custom' in pricing && pricing.custom ? (
                        <span className={`text-3xl font-bold ${isPro ? 'text-white' : ''}`}>{priceDisplay()}</span>
                      ) : (
                        <>
                          <span className={`text-3xl font-bold ${isPro ? 'text-white' : ''}`}>
                            R$ {priceDisplay()}
                          </span>
                          <span className={`${isPro ? 'text-gray-300' : 'text-muted-foreground'}`}>
                            {pricing?.monthly === 0 ? '' : `/${billingInterval === 'monthly' ? 'mês' : 'ano'}`}
                          </span>
                          {renderAnnualMonthlyPrice()}
                        </>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent className={`space-y-4 flex-grow ${isPro ? 'relative z-10 bg-transparent' : ''}`}>
                    <div className="space-y-1">
                      {/* Features do plano */}
                      {plan.features.map(feature => (
                        <div key={feature.feature_key}>
                          {featureRow(feature, true)}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                  
                  <CardFooter className={`mt-auto ${isPro ? 'relative z-10 bg-transparent' : ''}`}>
                    <Button 
                      className={`w-full transition-all duration-300 ${getButtonCursorStyle()}
                        ${isPro 
                          ? 'bg-[rgb(245,212,150)] hover:bg-[rgb(223,142,73)] text-black font-medium' 
                          : 'hover:bg-opacity-90 hover:shadow-md'}
                      `}
                      disabled={checkoutLoading || current}
                      onClick={() => isFree ? window.location.href = '/signup?plan=free' : isEnterprise ? window.location.href = '/contact' : handleSelectPlan(plan.id as PlanId)}
                      variant={current ? "outline" : isPro ? "default" : "default"}
                      aria-label={`Selecionar plano ${plan.name}`}
                    >
                      {checkoutLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          {getButtonText()}
                          {isPro && (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2">
                              <path d="M5 12h14"></path>
                              <path d="m12 5 7 7-7 7"></path>
                            </svg>
                          )}
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </CardWrapper>
            </motion.div>
          );
        })}
      </div>
      
      {/* FAQ ou informações adicionais */}
      <div className="mt-16 text-center">
        <h2 className="text-xl font-semibold mb-4">Dúvidas Frequentes</h2>
        <div className="max-w-2xl mx-auto text-left space-y-6">
          <div>
            <h3 className="font-medium mb-1">Como funciona o período de cobrança?</h3>
            <p className="text-muted-foreground text-sm">
              Você pode escolher entre pagamento mensal ou anual. O plano anual oferece um desconto de aproximadamente 17% em relação ao valor mensal.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-1">Posso cancelar a qualquer momento?</h3>
            <p className="text-muted-foreground text-sm">
              Sim, você pode cancelar sua assinatura a qualquer momento. O acesso continua disponível até o final do período já pago.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-1">Como atualizar meu plano?</h3>
            <p className="text-muted-foreground text-sm">
              Basta selecionar um novo plano nesta página. O valor será ajustado proporcionalmente ao tempo restante da sua assinatura atual.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
