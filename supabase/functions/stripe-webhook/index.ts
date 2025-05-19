import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Cabeçalhos CORS para a função
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Função de logger para facilitar o debug
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
  },
  warn: (message: string, data?: any) => {
    const log = {
      level: "WARN",
      timestamp: new Date().toISOString(),
      message,
      ...(data && { data }),
    };
    console.warn(JSON.stringify(log));
  }
};

// Interface para os eventos do Stripe que vamos processar
interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
}

// Inicializar cliente Supabase
const initSupabaseClient = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidas");
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });
};

// Verificar se o evento já foi processado (idempotência)
const isEventProcessed = async (supabase: any, eventId: string) => {
  const { data, error } = await supabase
    .from("stripe_events")
    .select("id")
    .eq("id", eventId)
    .single();
  
  if (error && error.code !== "PGRST116") { // PGRST116 is "No rows returned"
    throw error;
  }
  
  return !!data;
};

// Registrar que o evento foi processado
const markEventAsProcessed = async (
  supabase: any, 
  eventId: string, 
  userId: string | null, 
  eventType: string, 
  eventData: any
) => {
  const { error } = await supabase
    .from("stripe_events")
    .insert({
      id: eventId,
      user_id: userId,
      type: eventType,
      data: eventData,
      processed_at: new Date().toISOString()
    });
  
  if (error) {
    throw error;
  }
};

// Obter ID do plano pelo stripe_price_id
const getPlanIdByStripePrice = async (supabase: any, stripePriceId: string) => {
  const { data, error } = await supabase
    .from("plans")
    .select("id")
    .eq("stripe_price_id", stripePriceId)
    .single();
  
  if (error) {
    throw error;
  }
  
  return data.id;
};

// Obter nome do plano pelo ID
const getPlanNameById = async (supabase: any, planId: string) => {
  const { data, error } = await supabase
    .from("plans")
    .select("name")
    .eq("id", planId)
    .single();
  
  if (error) {
    logger.error("Erro ao buscar nome do plano", { error, planId });
    return "Plano";
  }
  
  return data.name;
};

// Processar evento checkout.session.completed
const handleCheckoutSessionCompleted = async (supabase: any, event: StripeEvent) => {
  const session = event.data.object;
  logger.info("Processando checkout.session.completed", { session_id: session.id });
  
  // Verificar se o cliente foi identificado
  if (!session.client_reference_id) {
    logger.error("client_reference_id não encontrado na sessão", { session_id: session.id });
    return { success: false, error: "client_reference_id não encontrado" };
  }
  
  const userId = session.client_reference_id;
  const stripePriceId = session.line_items?.data[0]?.price?.id || session.subscription?.plan?.id;
  
  if (!stripePriceId) {
    logger.error("Não foi possível identificar stripe_price_id", { session_id: session.id });
    return { success: false, error: "stripe_price_id não encontrado" };
  }
  
  try {
    // Buscar o plano correspondente ao price_id
    const planId = await getPlanIdByStripePrice(supabase, stripePriceId);
    
    if (!planId) {
      logger.error("Plano não encontrado para o price_id", { stripe_price_id: stripePriceId });
      return { success: false, error: "Plano não encontrado" };
    }
    
    // Inserir ou atualizar o plano do usuário
    const { error: userPlanError } = await supabase
      .from("user_plans")
      .upsert({
        user_id: userId,
        plan_id: planId,
        status: session.payment_status === "paid" ? "active" : "past_due",
        start_date: new Date().toISOString(),
        stripe_subscription_id: session.subscription || null
      });
    
    if (userPlanError) {
      throw userPlanError;
    }
    
    // Sincronizar features do usuário
    const { error: syncError } = await supabase.rpc(
      'sync_user_features',
      { user_id_param: userId }
    );
    
    if (syncError) {
      throw syncError;
    }
    
    logger.info("Plano e features do usuário atualizados com sucesso", { user_id: userId, plan_id: planId });
    return { success: true, user_id: userId };
  } catch (error) {
    logger.error("Erro ao processar checkout", error);
    throw error;
  }
};

// Processar evento invoice.payment_succeeded
const handleInvoicePaymentSucceeded = async (supabase: any, event: StripeEvent) => {
  const invoice = event.data.object;
  logger.info("Processando invoice.payment_succeeded", { invoice_id: invoice.id });
  
  const customerId = invoice.customer;
  const subscriptionId = invoice.subscription;
  
  if (!customerId || !subscriptionId) {
    logger.error("Dados de cliente ou assinatura não encontrados na fatura", { invoice_id: invoice.id });
    return { success: false, error: "Dados incompletos na fatura" };
  }
  
  try {
    // Buscar cliente no Stripe para obter o user_id
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });
    
    const customer = await stripe.customers.retrieve(customerId);
    
    if (!customer || customer.deleted) {
      logger.error("Cliente não encontrado no Stripe", { customer_id: customerId });
      return { success: false, error: "Cliente não encontrado" };
    }
    
    const userId = (customer as any).metadata?.supabaseUserId;
    
    if (!userId) {
      logger.error("supabaseUserId não encontrado nos metadados do cliente", { customer_id: customerId });
      return { success: false, error: "ID do usuário não encontrado" };
    }
    
    // Buscar a assinatura para obter o plano atual
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const stripePriceId = subscription.items.data[0]?.price.id;
    
    if (!stripePriceId) {
      logger.error("Price ID não encontrado na assinatura", { subscription_id: subscriptionId });
      return { success: false, error: "Price ID não encontrado" };
    }
    
    // Buscar o plano correspondente ao price_id
    const planId = await getPlanIdByStripePrice(supabase, stripePriceId);
    
    // Atualizar o plano do usuário
    const { error: userPlanError } = await supabase
      .from("user_plans")
      .upsert({
        user_id: userId,
        plan_id: planId,
        status: "active",
        start_date: new Date(subscription.current_period_start * 1000).toISOString(),
        end_date: new Date(subscription.current_period_end * 1000).toISOString(),
        stripe_subscription_id: subscriptionId
      });
    
    if (userPlanError) {
      throw userPlanError;
    }
    
    // Sincronizar features do usuário
    const { error: syncError } = await supabase.rpc(
      'sync_user_features',
      { user_id_param: userId }
    );
    
    if (syncError) {
      throw syncError;
    }
    
    // Extrair informações de pagamento
    const amount = invoice.amount_paid / 100; // Stripe stores amounts in smallest currency unit
    const currency = invoice.currency.toUpperCase();
    const paymentMethod = invoice.payment_method_types?.[0] || 'card';
    
    // Obter informações para descrição e período
    const planName = await getPlanNameById(supabase, planId);
    const periodStart = new Date(invoice.period_start * 1000);
    const periodEnd = new Date(invoice.period_end * 1000);
    const periodStartMonth = periodStart.toLocaleString('pt-BR', { month: 'long' });
    const periodEndMonth = periodEnd.toLocaleString('pt-BR', { month: 'long' });
    const periodYear = periodEnd.getFullYear();
    
    // Criar descrição da fatura
    let description = '';
    if (periodStartMonth === periodEndMonth) {
      description = `Assinatura ${planName} - ${periodStartMonth}/${periodYear}`;
    } else {
      description = `Assinatura ${planName} - ${periodStartMonth} a ${periodEndMonth}/${periodYear}`;
    }
    
    // Definir período de referência para filtragem ou agrupamento
    const referencePeriod = `${periodYear}-${(periodEnd.getMonth() + 1).toString().padStart(2, '0')}`;
    
    // Registrar o pagamento no histórico
    const { data: paymentRecord, error: paymentError } = await supabase.rpc(
      'add_payment_record',
      {
        p_user_id: userId,
        p_transaction_id: invoice.id,
        p_amount: amount,
        p_currency: currency,
        p_status: 'succeeded',
        p_payment_method: paymentMethod,
        p_description: description,
        p_invoice_url: invoice.hosted_invoice_url || null,
        p_invoice_pdf_url: invoice.invoice_pdf || null,
        p_reference_period: referencePeriod,
        p_metadata: {
          invoice_number: invoice.number,
          subscription_id: subscriptionId,
          plan_id: planId,
          plan_name: planName
        }
      }
    );
    
    if (paymentError) {
      logger.error("Erro ao registrar histórico de pagamento", { error: paymentError });
      // Não interromper o processo se houver erro no registro de pagamento
      // apenas log para investigação
    } else {
      logger.info("Pagamento registrado com sucesso no histórico", { 
        payment_id: paymentRecord,
        invoice_id: invoice.id,
        user_id: userId
      });
    }
    
    logger.info("Status da assinatura atualizado com sucesso", { user_id: userId });
    return { success: true, user_id: userId };
  } catch (error) {
    logger.error("Erro ao processar pagamento de fatura", error);
    throw error;
  }
};

// Processar evento customer.subscription.deleted
const handleSubscriptionDeleted = async (supabase: any, event: StripeEvent) => {
  const subscription = event.data.object;
  logger.info("Processando customer.subscription.deleted", { subscription_id: subscription.id });
  
  const customerId = subscription.customer;
  
  if (!customerId) {
    logger.error("Customer ID não encontrado na assinatura", { subscription_id: subscription.id });
    return { success: false, error: "Customer ID não encontrado" };
  }
  
  try {
    // Buscar cliente no Stripe para obter o user_id
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });
    
    const customer = await stripe.customers.retrieve(customerId);
    
    if (!customer || customer.deleted) {
      logger.error("Cliente não encontrado no Stripe", { customer_id: customerId });
      return { success: false, error: "Cliente não encontrado" };
    }
    
    const userId = (customer as any).metadata?.supabaseUserId;
    
    if (!userId) {
      logger.error("supabaseUserId não encontrado nos metadados do cliente", { customer_id: customerId });
      return { success: false, error: "ID do usuário não encontrado" };
    }
    
    // Atualizar o plano do usuário para "canceled"
    const { error: userPlanError } = await supabase
      .from("user_plans")
      .update({ status: "canceled", end_date: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("stripe_subscription_id", subscription.id);
    
    if (userPlanError) {
      throw userPlanError;
    }
    
    // Remover as features do plano (mantendo apenas as custom)
    const { error: deleteError } = await supabase
      .from("user_features")
      .delete()
      .eq("user_id", userId)
      .eq("source", "plan");
    
    if (deleteError) {
      throw deleteError;
    }
    
    logger.info("Assinatura cancelada com sucesso", { user_id: userId });
    return { success: true, user_id: userId };
  } catch (error) {
    logger.error("Erro ao processar cancelamento de assinatura", error);
    throw error;
  }
};

// Processador principal de eventos do Stripe
const processStripeEvent = async (supabase: any, event: StripeEvent) => {
  logger.info(`Processando evento ${event.type}`, { event_id: event.id });
  
  try {
    // Verificar idempotência
    const processed = await isEventProcessed(supabase, event.id);
    if (processed) {
      logger.info(`Evento ${event.id} já processado anteriormente, ignorando`);
      return { success: true, eventId: event.id, alreadyProcessed: true };
    }
    
    let result;
    let userId = null;
    
    // Processar evento de acordo com o tipo
    switch (event.type) {
      case "checkout.session.completed":
        result = await handleCheckoutSessionCompleted(supabase, event);
        userId = result.user_id;
        break;
        
      case "invoice.payment_succeeded":
        result = await handleInvoicePaymentSucceeded(supabase, event);
        userId = result.user_id;
        break;
        
      case "customer.subscription.deleted":
        result = await handleSubscriptionDeleted(supabase, event);
        userId = result.user_id;
        break;
        
      // Também podemos implementar handlers para outros eventos como:
      // - customer.subscription.created
      // - customer.subscription.updated
      // - invoice.payment_failed
        
      default:
        logger.warn(`Tipo de evento não processado: ${event.type}`);
        result = { success: true, skipped: true, reason: "Tipo de evento não implementado" };
    }
    
    // Registrar o evento como processado
    await markEventAsProcessed(supabase, event.id, userId, event.type, event.data.object);
    
    return result;
  } catch (error) {
    logger.error(`Erro ao processar evento ${event.id}`, error);
    throw error;
  }
};

// Implementação de exponential backoff para retry
const executeWithRetry = async (operation: () => Promise<any>, maxRetries = 3) => {
  let attempt = 0;
  
  while (attempt <= maxRetries) {
    try {
      return await operation();
    } catch (error) {
      attempt++;
      
      // Se excedeu o número máximo de tentativas, propaga o erro
      if (attempt > maxRetries) {
        throw error;
      }
      
      // Skip retry para erros que não são de conexão ou temporários
      if (
        error instanceof Error && 
        (error.message.includes("not found") || 
         error.message.includes("already exists") ||
         error.message.includes("permission denied"))
      ) {
        throw error;
      }
      
      // Calcular tempo de espera com jitter para evitar thundering herd
      const baseDelay = 1000; // 1 segundo
      const maxJitter = 500; // 0.5 segundo
      const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
      const jitter = Math.random() * maxJitter;
      const delay = exponentialDelay + jitter;
      
      logger.warn(`Tentativa ${attempt} falhou, tentando novamente em ${delay}ms`, { error });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Função principal para lidar com requisições
serve(async (req) => {
  // Lidar com solicitação OPTIONS para CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Verificar se o método é POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  
  try {
    // Obter a chave secreta do webhook do Stripe
    const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!stripeWebhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET não está definido");
    }
    
    // Inicializar o cliente Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });
    
    // Obter o corpo da requisição e a assinatura
    const payload = await req.text();
    const signature = req.headers.get("stripe-signature");
    
    if (!signature) {
      return new Response(JSON.stringify({ error: "Assinatura do webhook não fornecida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    // Verificar a assinatura do webhook
    let event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, stripeWebhookSecret);
    } catch (error) {
      logger.error("Webhook assinatura inválida", error);
      return new Response(JSON.stringify({ error: "Assinatura do webhook inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    logger.info(`Webhook válido recebido: ${event.type}`, { event_id: event.id });
    
    // Inicializar o cliente Supabase
    const supabase = initSupabaseClient();
    
    // Processar o evento com retry logic
    const result = await executeWithRetry(async () => {
      return await processStripeEvent(supabase, event);
    });
    
    return new Response(JSON.stringify({ 
      success: true, 
      event_id: event.id,
      event_type: event.type,
      result 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
    
  } catch (error) {
    // Log detalhado do erro
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error("Erro no processamento do webhook", { 
      message: errorMessage, 
      stack: errorStack 
    });
    
    // Response com erro formatado
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
