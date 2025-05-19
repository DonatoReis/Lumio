
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tipo para métodos de pagamento suportados
type PaymentMethodType = 'card' | 'pix' | 'boleto' | undefined;

// Interface para opções de parcelamento
interface InstallmentOptions {
  enabled: boolean;
  plan?: {
    count: number;
    interval: 'month';
  };
}

// Função de log para facilitar debugging
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    logStep("Iniciando função de checkout");
    
    // Obter informações do corpo da requisição
    const { 
      planId, 
      billingInterval = 'monthly',
      mode = "subscription",
      paymentMethod = 'card', // Método de pagamento padrão é cartão
      installments, // Opções de parcelamento (opcional)
      savePaymentMethod = true // Salvar método de pagamento para uso futuro
    } = await req.json();
    
    if (!planId) {
      throw new Error("planId é obrigatório");
    }
    
    // Validar método de pagamento
    if (!['card', 'pix', 'boleto'].includes(paymentMethod)) {
      throw new Error("Método de pagamento inválido. Opções válidas: card, pix, boleto");
    }
    
    // Verificar chave do Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY não configurada");
    logStep("Chave do Stripe verificada");
    
    // Inicializar clientes
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    // Autenticar usuário
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Cabeçalho de autorização não fornecido");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError) throw new Error(`Erro de autenticação: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("Usuário não autenticado ou email não disponível");
    logStep("Usuário autenticado", { userId: user.id, email: user.email });
    
    // Buscar informações do plano no Supabase
    const { data: planData, error: planError } = await supabaseClient
      .from('plans')
      .select('id, name, stripe_monthly_price_id, stripe_yearly_price_id')
      .eq('id', planId)
      .single();
    
    if (planError) {
      throw new Error(`Erro ao buscar plano: ${planError.message}`);
    }
    
    if (!planData) {
      throw new Error(`Plano não encontrado`);
    }
    
    // Determine correct price ID based on billing interval
    const priceId = billingInterval === 'yearly'
      ? planData.stripe_yearly_price_id
      : planData.stripe_monthly_price_id;
    if (!priceId) {
      throw new Error(`Price ID for ${billingInterval} not configured`);
    }
    
    logStep("Plano encontrado", { 
      planId: planData.id, 
      name: planData.name, 
      stripe_price_id: planData.stripe_price_id 
    });
    
    // Buscar features do plano
    const { data: featuresData, error: featuresError } = await supabaseClient
      .from('plan_features')
      .select(`
        feature_key,
        features!inner(description)
      `)
      .eq('plan_id', planId);
      
    if (featuresError) {
      logStep("Erro ao buscar features do plano", { error: featuresError.message });
      // Continuamos mesmo com erro para não bloquear o checkout
    }
    
    // Extrair descrições das features para exibição
    const featureDescriptions = featuresData?.map(item => item.features.description) || [];
    
    // Verificar se o cliente já existe no Stripe
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      
      // Atualizar metadata do cliente se necessário
      if (!customers.data[0].metadata?.supabaseUserId) {
        await stripe.customers.update(customerId, {
          metadata: {
            supabaseUserId: user.id,
          },
        });
      }
      
      logStep("Cliente existente encontrado", { customerId });
    } else {
      // Criar um novo cliente no Stripe
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabaseUserId: user.id,
        },
      });
      customerId = customer.id;
      logStep("Novo cliente criado", { customerId });
    }
    
    // Configurar métodos de pagamento e opções de parcelamento
    const paymentMethodTypes = [paymentMethod];
    
    // Configurar opções de pagamento específicas para cada método
    const paymentMethodOptions: Stripe.Checkout.SessionCreateParams.PaymentMethodOptions = {};
    
    // Opções para cartão de crédito (incluindo parcelamento)
    if (paymentMethod === 'card') {
      paymentMethodOptions.card = {
        setup_future_usage: savePaymentMethod ? 'off_session' : undefined
      };
      
      // Adicionar suporte a parcelamento se especificado
      if (installments && installments.enabled) {
        paymentMethodOptions.card.installments = {
          enabled: true
        };
        
        // Se um plano específico de parcelamento for solicitado
        if (installments.plan) {
          paymentMethodOptions.card.installments.plan = {
            count: installments.plan.count,
            interval: installments.plan.interval
          };
        }
      }
    }
    
    // Opções para PIX
    if (paymentMethod === 'pix') {
      paymentMethodOptions.pix = {
        expires_after_seconds: 3600 // 1 hora para pagamento
      };
    }
    
    // Opções para boleto
    if (paymentMethod === 'boleto') {
      paymentMethodOptions.boleto = {
        expires_after_days: 3 // 3 dias para pagamento
      };
    }
    
    // Criar a sessão de checkout do Stripe
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      client_reference_id: user.id, // Importante para identificar o usuário no webhook
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: mode as "subscription" | "payment",
      payment_method_types: paymentMethodTypes,
      payment_method_options: paymentMethodOptions,
      success_url: `${req.headers.get("origin") || "https://app.example.com"}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin") || "https://app.example.com"}/pricing`,
      metadata: {
        userId: user.id,
        planId: planId,
        paymentMethod: paymentMethod,
        installmentsEnabled: installments?.enabled ? "true" : "false",
        installmentsCount: installments?.plan?.count?.toString() || "0",
        savePaymentMethod: savePaymentMethod ? "true" : "false"
      },
    };
    
    logStep("Configurando sessão de checkout", { 
      payment_method: paymentMethod,
      installments: installments,
      save_payment_method: savePaymentMethod
    });
    
    const session = await stripe.checkout.sessions.create(sessionParams);
    
    logStep("Sessão de checkout criada", { sessionId: session.id, url: session.url });
    
    return new Response(JSON.stringify({ 
      url: session.url,
      session_id: session.id,
      plan: {
        id: planData.id,
        name: planData.name
      },
      payment_options: {
        method: paymentMethod,
        installments: installments || null,
        save_method: savePaymentMethod
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Erro na função create-checkout:", errorMessage);
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
