
// Implementation of the key exchange edge function for Signal Protocol
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Initialize Supabase client with the user's JWT token
    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    // Get user data from the JWT token
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Usuário não encontrado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse the request body
    const { action, publicKey, keyId, targetUserId, recipientKeyId } = await req.json();

    console.log(`[key-exchange] Action: ${action}, UserId: ${user.id}`);

    // Handle different actions
    switch (action) {
      case 'register-key': {
        if (!publicKey || !keyId) {
          return new Response(JSON.stringify({ error: 'Chave pública ou ID de chave não fornecidos' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Store the public key in the database
        const { error: insertError } = await supabaseAdmin
          .from('user_public_keys')
          .upsert({
            user_id: user.id,
            key_id: keyId,
            public_key: publicKey
          });

        if (insertError) {
          return new Response(JSON.stringify({ error: `Erro ao registrar chave: ${insertError.message}` }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ success: true, keyId }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get-key': {
        if (!targetUserId || !recipientKeyId) {
          return new Response(JSON.stringify({ error: 'ID do usuário ou ID da chave não fornecidos' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Get the public key for a specific user and key ID
        const { data: keyData, error: keyError } = await supabaseAdmin
          .from('user_public_keys')
          .select('*')
          .eq('user_id', targetUserId)
          .eq('key_id', recipientKeyId)
          .single();

        if (keyError || !keyData) {
          return new Response(JSON.stringify({ error: 'Chave não encontrada' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          success: true,
          publicKey: keyData.public_key,
          keyId: keyData.key_id,
          userId: keyData.user_id
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get-latest-key': {
        if (!targetUserId) {
          return new Response(JSON.stringify({ error: 'ID do usuário não fornecido' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Get the most recent public key for a specific user
        const { data: keyData, error: keyError } = await supabaseAdmin
          .from('user_public_keys')
          .select('*')
          .eq('user_id', targetUserId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (keyError || !keyData) {
          return new Response(JSON.stringify({ error: 'Chave não encontrada' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          success: true,
          publicKey: keyData.public_key,
          keyId: keyData.key_id,
          userId: keyData.user_id
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Ação não reconhecida' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error('[key-exchange] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
