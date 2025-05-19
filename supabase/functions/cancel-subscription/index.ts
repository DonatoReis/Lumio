import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Cabeçalhos CORS para a função
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Função de logger para facilitar debug e monitoramento
const logger = {
  info: (message: string, data?: any) => {
    const log = {
      level: "INFO",
      timestamp: new Date().toISOString(),
      message,
      ...(data && { data }),
    };
    console.log(JSON.stringify(log));
  },
  error: (message: string, error?: any) => {
    const log = {
      level: "ERROR",
      timestamp: new Date().toISOString(),
      message,
      ...(error && { error: typeof error === 'object' ? JSON.stringify(error) : error }),
    };
    console.error(JSON.stringify(log));
  }
};

// Inicializar cliente Supabase
const initSupabaseClient = (authToken?: string) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidas");
  }
  
  // Se token de autenticação for fornecido, cria cliente com ele
  if (authToken) {
    return createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      },
      auth: { persistSession: false }
    });
  }
  
  // Caso contrário, cria cliente apenas com service role para operações administrativas
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });
};

serve(async (req) => {
  // Lidar com requisições OPTIONS para CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    logger.info("Iniciando função de cancelamento de assinatura");
    
    // Obter token de autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Cabeçalho de autorização não fornecido");
    }
    
    const token = authHeader.replace("Bearer ", "");
    
    // Obter dados do corpo da requisição
    const { subscriptionId } = await req.json();
    
    if (!subscriptionId) {
      throw new Error("ID da assinatura não fornecido");
    }
    
    logger.info("Dados recebidos", { subscriptionId });
    
    // Inicializar clientes
    const supabaseAuth = initSupabaseClient(token);
    const supabaseAdmin = initSupabaseClient(); // Cliente com permissões admin para atualizar tabelas
    
    // Verificar autenticação e obter usuário
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
    
    if (userError || !userData.user) {
      logger.error("Erro de autenticação", userError);
      throw new Error(`Usuário não autenticado: ${userError?.message || "Token inválido"}`);
    }
    
    const userId = userData.user.id;
    logger.info("Usuário autenticado", { userId });
    
    // Verificar se a assinatura pertence ao usuário
    const { data: userPlan, error: userPlanError } = await supabaseAdmin
      .from('user_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('stripe_subscription_id', subscriptionId)
      .maybeSingle();
    
    if (userPlanError) {
      logger.error("Erro ao buscar plano do usuário", userPlanError);
      throw new Error(`Erro ao verificar assinatura: ${userPlanError.message}`);
    }
    
    if (!userPlan) {
      logger.error("Assinatura não encontrada para o usuário", { userId, subscriptionId });
      throw new Error("Assinatura não encontrada ou não pertence a este usuário");
    }
    
    // Inicializar Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY não configurada");
    }
    
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    // Cancelar assinatura no Stripe
    logger.info("Cancelando assinatura no Stripe", { subscriptionId });
    
    const subscription = await stripe.subscriptions.cancel(subscriptionId, {
      // Opcionalmente, fornecer motivo do cancelamento
      // prorate: true,  // Gerar crédito proporcional
      // invoice_now: false  // Se deve gerar fatura final imediatamente
    });
    
    logger.info("Assinatura cancelada no Stripe", { 
      status: subscription.status,
      cancelAt: subscription.cancel_at 
    });
    
    // Atualizar status no banco de dados
    const { error: updateError } = await supabaseAdmin
      .from('user_plans')
      .update({ 
        status: 'canceled',
        end_date: new Date(subscription.cancel_at * 1000).toISOString()
      })
      .eq('user_id', userId)
      .eq('stripe_subscription_id', subscriptionId);
    
    if (updateError) {
      logger.error("Erro ao atualizar status da assinatura no BD", updateError);
      // Não lançar erro aqui, pois o cancelamento no Stripe já foi realizado
      // Apenas logar o erro para investigação posterior
    } else {
      logger.info("Status da assinatura atualizado no banco de dados", { userId, subscriptionId });
    }
    
    // Retornar resposta de sucesso
    return new Response(JSON.stringify({
      success: true,
      message: "Assinatura cancelada com sucesso",
      canceledAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
      active_until: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    // Log detalhado do erro
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error("Erro no cancelamento da assinatura", { 
      message: errorMessage, 
      stack: errorStack 
    });
    
    // Response com erro formatado
    return new Response(JSON.stringify({
      success: false,
      message: errorMessage,
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

