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
    logger.info("Iniciando função de remoção de método de pagamento");
    
    // Obter token de autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Cabeçalho de autorização não fornecido");
    }
    
    const token = authHeader.replace("Bearer ", "");
    
    // Obter dados do corpo da requisição
    const { paymentMethodId } = await req.json();
    
    if (!paymentMethodId) {
      throw new Error("ID do método de pagamento não fornecido");
    }
    
    logger.info("Dados recebidos", { paymentMethodId });
    
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
    
    // Verificar se o método de pagamento pertence ao usuário
    const { data: paymentMethod, error: paymentMethodError } = await supabaseAdmin
      .from('payment_methods')
      .select('*')
      .eq('id', paymentMethodId)
      .eq('user_id', userId)
      .maybeSingle();
    
    if (paymentMethodError) {
      logger.error("Erro ao buscar método de pagamento", paymentMethodError);
      throw new Error(`Erro ao verificar método de pagamento: ${paymentMethodError.message}`);
    }
    
    if (!paymentMethod) {
      logger.error("Método de pagamento não encontrado para o usuário", { userId, paymentMethodId });
      throw new Error("Método de pagamento não encontrado ou não pertence a este usuário");
    }
    
    // Inicializar Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY não configurada");
    }
    
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    // Remover método de pagamento do Stripe
    try {
      logger.info("Removendo método de pagamento do Stripe", { 
        stripe_payment_method_id: paymentMethod.payment_method_id 
      });
      
      await stripe.paymentMethods.detach(paymentMethod.payment_method_id);
      
      logger.info("Método de pagamento removido do Stripe com sucesso");
    } catch (stripeError) {
      // Se houver erro no Stripe, logar mas continuar para excluir do banco
      logger.error("Erro ao remover método de pagamento do Stripe", stripeError);
      // Podemos continuar e remover do banco mesmo que falhe no Stripe
      // em casos onde o método já foi removido do Stripe ou é inválido
    }
    
    // Remover método de pagamento do banco de dados
    const { error: deleteError } = await supabaseAdmin
      .from('payment_methods')
      .delete()
      .eq('id', paymentMethodId)
      .eq('user_id', userId);
    
    if (deleteError) {
      logger.error("Erro ao remover método de pagamento do banco de dados", deleteError);
      throw new Error(`Erro ao remover registro do banco de dados: ${deleteError.message}`);
    }
    
    logger.info("Método de pagamento removido com sucesso", { paymentMethodId, userId });
    
    // Resposta de sucesso
    return new Response(JSON.stringify({
      success: true,
      message: "Método de pagamento removido com sucesso"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    // Log detalhado do erro
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error("Erro na remoção do método de pagamento", { 
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

