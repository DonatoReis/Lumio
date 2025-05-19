import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";
import * as webPush from "npm:web-push";
import type { Database } from "../../../src/integrations/supabase/types";

// Configurar VAPID keys
webPush.setVapidDetails(
  "mailto:admin@bizconnect.ai",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!
);

// Cliente Supabase com service role
const supabaseAdmin = createClient<Database>(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface PushRequest {
  user_id: string;
  title: string;
  body?: string;
  payload?: Record<string, any>;
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  let data: PushRequest;
  try {
    data = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const { user_id, title, body = "", payload = {} } = data;
  if (!user_id || !title) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
  }

  // Buscar subscriptions do usuário
  const { data: subscriptions, error } = await supabaseAdmin
    .from("user_push_subscriptions")
    .select("*")
    .eq("user_id", user_id);

  if (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500 }
    );
  }

  if (!subscriptions || subscriptions.length === 0) {
    return new Response(
      JSON.stringify({ success: false, message: "Nenhuma subscription encontrada" }),
      { status: 404 }
    );
  }

  // Criar payload da notificação
  const notificationPayload = JSON.stringify({
    title,
    body,
    payload,
    icon: "/favicon.ico"
  });

  // Resultado de cada envio
  const results = [];
  
  // Enviar para cada subscription
  for (const subscription of subscriptions) {
    try {
      const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: subscription.keys
      };
      
      const result = await webPush.sendNotification(
        pushSubscription,
        notificationPayload
      );
      
      results.push({ 
        id: subscription.id, 
        status: "sent", 
        statusCode: result.statusCode 
      });
    } catch (pushError: any) {
      console.error(`Erro ao enviar para subscription ${subscription.id}:`, pushError);
      
      // Se subscription expirada ou inválida, remover
      if (pushError.statusCode === 404 || pushError.statusCode === 410) {
        await supabaseAdmin
          .from("user_push_subscriptions")
          .delete()
          .eq("id", subscription.id);
      }
      
      results.push({ 
        id: subscription.id, 
        status: "failed",
        statusCode: pushError.statusCode,
        error: pushError.message
      });
    }
  }
  
  // Verificar se pelo menos uma notificação foi enviada
  const anySuccess = results.some(r => r.status === "sent");
  
  // Registrar o envio em notification_logs
  await supabaseAdmin
    .from("notification_logs")
    .insert({
      user_id,
      channel: "push",
      notification_type: payload.type || "general",
      title,
      body,
      payload,
      status: anySuccess ? "sent" : "failed",
      priority: payload.priority || "normal",
      meta: { push_results: results }
    });
  
  return new Response(
    JSON.stringify({
      success: anySuccess,
      total: subscriptions.length,
      sent: results.filter(r => r.status === "sent").length,
      failed: results.filter(r => r.status === "failed").length,
      results
    }),
    {
      status: anySuccess ? 200 : 500,
      headers: { "Content-Type": "application/json" }
    }
  );
});

