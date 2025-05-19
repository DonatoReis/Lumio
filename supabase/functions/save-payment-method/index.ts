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
    logger.info("Iniciando função save-payment-method");
    
    // Obter token de autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Cabeçalho de autorização não fornecido");
    }
    
    const token = authHeader.replace("Bearer ", "");
    
    // Obter dados do corpo da requisição
    const { 
      paymentMethodId, 
      makeDefault = false,
      setupIntentId = null 
    } = await req.json();
    
    if (!paymentMethodId) {
      throw new Error("ID do método de pagamento não fornecido");
    }
    
    logger.info("Dados recebidos", { paymentMethodId, makeDefault, setupIntentId });
    
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
    
    // Inicializar Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY não configurada");
    }
    
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    // Obter detalhes do método de pagamento do Stripe
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    
    if (!paymentMethod) {
      throw new Error("Método de pagamento não encontrado no Stripe");
    }
    
    logger.info("Método de pagamento recuperado do Stripe", { 
      type: paymentMethod.type,
      customerId: paymentMethod.customer
    });
    
    // Detectar tipo de método de pagamento
    const paymentType = paymentMethod.type as 'card' | 'pix' | 'boleto' | 'bank_transfer';
    
    // Extrair detalhes específicos do tipo de método de pagamento
    let lastFourDigits = null;
    let expiryDate = null;
    let brand = null;
    
    if (paymentType === 'card' && paymentMethod.card) {
      lastFourDigits = paymentMethod.card.last4;
      expiryDate = `${paymentMethod.card.exp_month}/${paymentMethod.card.exp_year}`;
      brand = paymentMethod.card.brand;
    }
    
    // Se makeDefault for true, precisamos primeiro remover o default de todos os outros
    if (makeDefault) {
      const { error: updateError } = await supabaseAdmin
        .from('payment_methods')
        .update({ is_default: false })
        .eq('user_id', userId);
      
      if (updateError) {
        logger.error("Erro ao atualizar métodos de pagamento existentes", updateError);
        // Não interromper o fluxo, apenas logar o erro
      }
    }
    
    // Inserir método de pagamento no banco de dados
    const { data: savedMethod, error: insertError } = await supabaseAdmin
      .from('payment_methods')
      .insert({
        user_id: userId,
        payment_method_id: paymentMethodId,
        payment_type: paymentType,
        last_four_digits: lastFourDigits,
        expiry_date: expiryDate,
        brand: brand,
        is_default: makeDefault,
        metadata: {
          setup_intent_id: setupIntentId,
          created_at: new Date().toISOString()
        }
      })
      .select()
      .single();
    
    if (insertError) {
      // Verificar se é um erro de chave duplicada (método já existe)
      if (insertError.message.includes('unique constraint') || 
          insertError.message.includes('duplicate key')) {
        
        logger.info("Método de pagamento já existe, atualizando...");
        
        // Atualizar o método existente
        const { data: updatedMethod, error: updateError } = await supabaseAdmin
          .from('payment_methods')
          .update({
            last_four_digits: lastFourDigits,
            expiry_date: expiryDate,
            brand: brand,
            is_default: makeDefault,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('payment_method_id', paymentMethodId)
          .select()
          .single();
        
        if (updateError) {
          throw new Error(`Erro ao atualizar método de pagamento: ${updateError.message}`);
        }
        
        logger.info("Método de pagamento atualizado com sucesso", { 
          id: updatedMethod?.id,
          is_default: updatedMethod?.is_default
        });
        
        return new Response(JSON.stringify({
          success: true,
          message: "Método de pagamento atualizado com sucesso",
          paymentMethod: updatedMethod
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      } else {
        throw new Error(`Erro ao salvar método de pagamento: ${insertError.message}`);
      }
    }
    
    logger.info("Método de pagamento salvo com sucesso", { 
      id: savedMethod?.id,
      is_default: savedMethod?.is_default
    });
    
    return new Response(JSON.stringify({
      success: true,
      message: "Método de pagamento salvo com sucesso",
      paymentMethod: savedMethod
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    // Log detalhado do erro
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error("Erro ao salvar método de pagamento", { 
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

