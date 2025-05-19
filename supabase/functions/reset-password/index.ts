import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

// Configuration constants
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PASSWORD_HISTORY_LIMIT = 5; // Number of previous passwords to check against

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "http://192.168.0.88:8080",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-csrf-token, x-client-info, apikey",
  "Access-Control-Max-Age": "86400" // 24 hours caching for preflight
};

// Define the request body type
interface RequestBody {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  csrfToken?: string;
}

// Helper function to validate a password
function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: "A senha deve ter pelo menos 8 caracteres" };
  }
  
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "A senha deve conter pelo menos uma letra maiúscula" };
  }
  
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "A senha deve conter pelo menos uma letra minúscula" };
  }
  
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "A senha deve conter pelo menos um número" };
  }
  
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, message: "A senha deve conter pelo menos um caractere especial" };
  }
  
  return { valid: true };
}

// Helper function to check if password is in history
async function isPasswordInHistory(
  supabase: any, 
  userId: string, 
  newPassword: string
): Promise<boolean> {
  // Get password history for user
  const { data: passwordHistory, error } = await supabase
    .from('password_history')
    .select('password_hash')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(PASSWORD_HISTORY_LIMIT);
  
  if (error) {
    console.error("Error fetching password history:", error);
    return false;
  }
  
  // If no history, password is not in history
  if (!passwordHistory || passwordHistory.length === 0) {
    return false;
  }
  
  // Check if new password matches any historical password
  for (const item of passwordHistory) {
    try {
      const isMatch = await bcrypt.compare(newPassword, item.password_hash);
      if (isMatch) {
        return true;
      }
    } catch (err) {
      console.error("Error comparing passwords:", err);
      // Continue checking other passwords
    }
  }
  
  return false;
}

// Helper function to log security events
async function logSecurityEvent(
  supabase: any,
  userId: string,
  event: string,
  details: any,
  request: Request
) {
  try {
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    await supabase.from('security_logs').insert({
      user_id: userId,
      event,
      ip_address: ipAddress,
      user_agent: userAgent,
      details,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error logging security event:", error);
    // Don't throw, just log the error
  }
}

serve(async (req: Request) => {
  // CORS handling
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    });
  }
  
  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 405,
    });
  }
  
  try {
    // Parse the request body
    const requestData: RequestBody = await req.json();
    
    // Validate request data
    if (!requestData.currentPassword || !requestData.newPassword || !requestData.confirmPassword) {
      return new Response(
        JSON.stringify({ error: "Todos os campos de senha são obrigatórios" }),
        { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 400 }
      );
    }
    
    // Verify passwords match
    if (requestData.newPassword !== requestData.confirmPassword) {
      return new Response(
        JSON.stringify({ error: "A nova senha e a confirmação não correspondem" }),
        { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 400 }
      );
    }
    
    // Validate password strength
    const passwordValidation = validatePassword(requestData.newPassword);
    if (!passwordValidation.valid) {
      return new Response(
        JSON.stringify({ error: passwordValidation.message }),
        { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 400 }
      );
    }

    // Validate CSRF token if provided
    const csrfToken = req.headers.get("x-csrf-token") || requestData.csrfToken;
    if (!csrfToken) {
      console.warn("CSRF token missing in password reset request");
      // In a production system, you might want to reject requests without CSRF tokens
      // For now, we'll just log a warning
    }
    
    // Get the JWT from the Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 401 }
      );
    }
    
    const token = authHeader.split(" ")[1];

    // Create a Supabase client with the service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    });
    
    // Create a client with the user's JWT to check if they're authenticated
    const userSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });
    
    // Verify the user is authenticated
    const { data: { user }, error: getUserError } = await userSupabase.auth.getUser();
    
    if (getUserError || !user) {
      await logSecurityEvent(
        supabase,
        "unknown",
        "password_reset_unauthorized",
        { error: getUserError?.message || "User not authenticated" },
        req
      );
      
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 401 }
      );
    }
    
    // Get the user's current password hash from the auth.users table
    const { data: userData, error: userError } = await supabase
      .from('auth.users')
      .select('encrypted_password')
      .eq('id', user.id)
      .single();
      
    if (userError || !userData) {
      await logSecurityEvent(
        supabase,
        user.id,
        "password_reset_failure",
        { error: "User data not found", message: userError?.message },
        req
      );
      
      return new Response(
        JSON.stringify({ error: "Falha ao verificar credenciais" }),
        { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 500 }
      );
    }
    
    // Verify the current password
    const currentPasswordHash = userData.encrypted_password;
    const isCurrentPasswordValid = await bcrypt.compare(
      requestData.currentPassword,
      currentPasswordHash
    );
    
    if (!isCurrentPasswordValid) {
      await logSecurityEvent(
        supabase,
        user.id,
        "password_reset_invalid_current_password",
        { userId: user.id },
        req
      );
      
      return new Response(
        JSON.stringify({ error: "Senha atual incorreta" }),
        { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 400 }
      );
    }
    
    // Check if the new password is in the user's password history
    const passwordInHistory = await isPasswordInHistory(
      supabase,
      user.id,
      requestData.newPassword
    );
    
    if (passwordInHistory) {
      await logSecurityEvent(
        supabase,
        user.id,
        "password_reset_reused_password",
        { userId: user.id },
        req
      );
      
      return new Response(
        JSON.stringify({ 
          error: `A nova senha não pode ser igual a uma das últimas ${PASSWORD_HISTORY_LIMIT} senhas utilizadas` 
        }),
        { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 400 }
      );
    }
    
    // Generate a new password hash
    const newPasswordHash = await bcrypt.hash(requestData.newPassword);
    
    // Update the user's password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: requestData.newPassword }
    );
    
    if (updateError) {
      await logSecurityEvent(
        supabase,
        user.id,
        "password_reset_failure",
        { error: updateError.message },
        req
      );
      
      return new Response(
        JSON.stringify({ error: "Falha ao atualizar senha" }),
        { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 500 }
      );
    }
    
    // Store the new password hash in the password history
    const { error: historyError } = await supabase.from('password_history').insert({
      user_id: user.id,
      password_hash: newPasswordHash,
      created_at: new Date().toISOString()
    });
    
    if (historyError) {
      console.error("Error storing password in history:", historyError);
      // We'll continue even if there's an error storing the password history
    }
    
    // Sign out all other sessions for this user
    const { error: signOutError } = await supabase.auth.admin.signOut(user.id, "global");
    
    if (signOutError) {
      console.error("Error signing out other sessions:", signOutError);
      // We'll continue even if there's an error signing out other sessions
    }
    
    // Log the successful password reset
    await logSecurityEvent(
      supabase,
      user.id,
      "password_reset_success",
      { userId: user.id },
      req
    );
    
    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Senha alterada com sucesso. Todas as outras sessões foram encerradas." 
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 200 }
    );
    
  } catch (error) {
    console.error("Error in password reset edge function:", error);
    
    // Return a generic error response
    return new Response(
      JSON.stringify({ error: "Ocorreu um erro ao processar sua solicitação" }),
      { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 500 }
    );
  }
});

