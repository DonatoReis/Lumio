
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Função de log para facilitar debugging
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Iniciando verificação de pagamento");
    
    const { sessionId } = await req.json();
    
    if (!sessionId) {
      throw new Error("ID da sessão não fornecido");
    }
    
    logStep("Sessão de verificação", { sessionId });
    
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY não configurada");
    }
    
    // Inicializar Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    // Inicializar Supabase
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    
    // Autenticar usuário
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Cabeçalho de autorização não fornecido");
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError) {
      throw new Error(`Erro de autenticação: ${userError.message}`);
    }
    
    const user = userData.user;
    logStep("Usuário autenticado", { userId: user.id });
    
    // Verificar sessão no Stripe
    logStep("Buscando sessão no Stripe");
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'line_items.data.price.product']
    });
    
    if (!session) {
      throw new Error("Sessão não encontrada");
    }
    
    logStep("Sessão encontrada", { 
      mode: session.mode,
      status: session.status,
      paymentStatus: session.payment_status
    });
    
    // Verificar se o usuário é o mesmo que iniciou a sessão
    if (session.client_reference_id && session.client_reference_id !== user.id) {
      logStep("Alerta: Usuário diferente do que iniciou a sessão", {
        sessionUserId: session.client_reference_id,
        currentUserId: user.id
      });
      // Note: Continuamos o processo mesmo com o alerta, pois pode ser um usuário legítimo verificando
    }
    
    // Obter informações do plano
    const planId = session.metadata?.planId;
    let planDetails = null;
    
    if (planId) {
      const { data: planData, error: planError } = await supabaseClient
        .from('plans')
        .select('id, name')
        .eq('id', planId)
        .single();
      
      if (!planError && planData) {
        planDetails = planData;
        logStep("Informações do plano encontradas", planDetails);
      } else {
        logStep("Erro ao buscar informações do plano", { error: planError?.message });
      }
    }
    
    // Se não temos o planId nos metadados, podemos tentar buscar pelo stripe_price_id
    if (!planDetails && session.line_items?.data?.[0]?.price?.id) {
      const stripePriceId = session.line_items.data[0].price.id;
      
      const { data: planFromPrice, error: planPriceError } = await supabaseClient
        .from('plans')
        .select('id, name')
        .eq('stripe_price_id', stripePriceId)
        .single();
      
      if (!planPriceError && planFromPrice) {
        planDetails = planFromPrice;
        logStep("Plano encontrado via price_id", planDetails);
      }
    }
    
    // Determinar o tipo de assinatura com base no modo da sessão
    const subscriptionType = session.mode === "subscription" ? "subscription" : "onetime";
    
    // Inicializar resposta com informações básicas
    const statusData: Record<string, any> = {
      status: "",
      planId: planDetails?.id || session.metadata?.planId,
      planName: planDetails?.name,
      customerId: session.customer as string,
      paymentStatus: session.payment_status,
      paymentIntent: session.payment_intent as string,
      subscriptionId: session.subscription as string,
      subscriptionType,
      userId: user.id
    };
    
    // Verificar status baseado no modo de pagamento
    if (session.mode === "subscription" && session.subscription) {
      logStep("Verificando detalhes da assinatura");
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
      
      statusData.status = subscription.status;
      statusData.isActive = subscription.status === "active";
      statusData.currentPeriodStart = new Date(subscription.current_period_start * 1000).toISOString();
      statusData.currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
      
      // Verificar se existem features ativas para o usuário
      const { data: userFeatures, error: featuresError } = await supabaseClient
        .from('user_features')
        .select('feature_key')
        .eq('user_id', user.id);
      
      if (!featuresError && userFeatures) {
        statusData.features = userFeatures.map(f => f.feature_key);
        logStep("Features do usuário encontradas", { features: statusData.features });
      }
      
      // Verificar se o plano já está ativo para o usuário
      const { data: userPlans, error: userPlansError } = await supabaseClient
        .from('user_plans')
        .select('status, plan_id')
        .eq('user_id', user.id)
        .eq('stripe_subscription_id', subscription.id)
        .maybeSingle();
      
      statusData.planActivated = !userPlansError && !!userPlans && userPlans.status === 'active';
    } else {
      // Para pagamentos únicos
      statusData.status = session.payment_status === "paid" ? "completed" : "pending";
      statusData.isActive = session.payment_status === "paid";
    }
    
    logStep("Verificação de pagamento completa", statusData);
    
    return new Response(JSON.stringify({ 
      success: true, 
      paymentVerified: statusData.paymentStatus === "paid" || statusData.isActive,
      details: statusData 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logStep("Erro na verificação de pagamento", { message: errorMessage, stack: errorStack });
    
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage,
      paymentVerified: false
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
