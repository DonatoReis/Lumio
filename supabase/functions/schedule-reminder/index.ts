import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";
import type { Database } from "../../../src/integrations/supabase/types";

// Initialize Supabase client with service role for privileged operations
const supabaseAdmin = createClient<Database>(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface ScheduleReminderRequest {
  user_id: string;
  title: string;
  body?: string;
  payload?: Record<string, any>;
  run_at: string;
  channels?: string[];
  priority?: "low" | "normal" | "high" | "critical";
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  let data: ScheduleReminderRequest;
  try {
    data = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }

  const { user_id, title, run_at, body = "", payload = {}, channels = ["in-app"], priority = "normal" } = data;

  if (!user_id || !title || !run_at) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: user_id, title, run_at" }),
      { status: 400 }
    );
  }

  // Call RPC to schedule reminder
  const { data: result, error } = await supabaseAdmin
    .rpc("schedule_reminder", {
      p_user_id: user_id,
      p_title: title,
      p_body: body,
      p_payload: payload,
      p_run_at: run_at,
      p_channels: channels,
      p_priority: priority,
    });

  if (error || !result) {
    return new Response(
      JSON.stringify({ error: "Failed to schedule reminder" }),
      { status: 500 }
    );
  }

  return new Response(
    JSON.stringify({ reminder_id: result as string }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
});

