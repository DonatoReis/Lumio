import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";
import type { Database } from "../../../src/integrations/supabase/types";

// Initialize Supabase client with service role key
const supabaseAdmin = createClient<Database>(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface RegisterPushRequest {
  user_id: string;
  endpoint: string;
  keys: Record<string, any>;
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  let data: RegisterPushRequest;
  try {
    data = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }

  const { user_id, endpoint, keys } = data;
  if (!user_id || !endpoint || !keys) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: user_id, endpoint, keys" }),
      { status: 400 }
    );
  }

  // Upsert push subscription
  const { error } = await supabaseAdmin
    .from("user_push_subscriptions")
    .upsert(
      { user_id, endpoint, keys },
      { onConflict: "user_id,endpoint" }
    );

  if (error) {
    console.error("Error saving push subscription:", error);
    return new Response(JSON.stringify({ success: false }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

