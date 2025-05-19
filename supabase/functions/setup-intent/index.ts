import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Cabeçalhos CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Função de logger para facilitar debug
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

serve(async (req) => {
  // Lidar com requisições OPTIONS para CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    logger.info("Iniciando função setup-intent");
    
    // Verificar chave do Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY não configurada");
    
    // Inicializar clientes
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidas");
    }
    
    // Obter token de autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Cabeçalho de autorização não fornecido");
    }
    
    const token = authHeader.replace("Bearer ", "");
    
    // Criar cliente Supabase com o token
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      },
      auth: { persistSession: false }
    });
    
    // Autenticar usuário
    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !userData.user) {
      logger.error("Erro de autenticação", userError);
      throw new Error(`Usuário não autenticado: ${userError?.message || "Token inválido"}`);
    }
    
    const userId = userData.user.id;
    const userEmail = userData.user.email;
    
    logger.info("Usuário autenticado", { userId, email: userEmail });
    
    // Obter parâmetros da requisição
    const { paymentMethodType = 'card' } = await req.json();
    
    // Inicializar Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    // Buscar ou criar o cliente no Stripe
    let customerId;
    const customers = await stripe.customers.list({ 
      email: userEmail,
      limit: 1 
    });
    
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logger.info("Cliente existente encontrado", { customerId });
      
      // Atualizar metadata do cliente se necessário
      if (!customers.data[0].metadata?.supabaseUserId) {
        await stripe.customers.update(customerId, {
          metadata: {
            supabaseUserId: userId,
          },
        });
      }
    } else {
      // Criar um novo cliente no Stripe
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          supabaseUserId: userId,
        },
      });
      customerId = customer.id;
      logger.info("Novo cliente criado", { customerId });
    }
    
    // Criar SetupIntent para salvar método de pagamento
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: [paymentMethodType],
      usage: 'off_session', // Permite uso futuro sem interação do usuário
      metadata: {
        userId,
        created_from: 'setup-intent-function'
      }
    });
    
    logger.info("SetupIntent criado com sucesso", { 
      setupIntentId: setupIntent.id,
      clientSecret: setupIntent.client_secret ? 'presente' : 'ausente'
    });
    
    return new Response(JSON.stringify({
      success: true,
      clientSecret: setupIntent.client_secret,
      customerId,
      setupIntentId: setupIntent.id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    // Log detalhado do erro
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error("Erro ao criar SetupIntent", { 
      message: errorMessage, 
      stack: errorStack 
    });
    
    return new Response(JSON.stringify({
      success: false,
      message: errorMessage,
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

