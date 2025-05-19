import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";
// Placeholder Signal Protocol imports – replace with actual library usage
// import { SessionBuilder, KeyHelper } from "npm:@privacyresearch/signal-protocol";
import type { Database } from "../../../src/integrations/supabase/types";

// Initialize Supabase client with service role key
const supabaseAdmin = createClient<Database>(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// URL of the send-notification function
const SEND_NOTIFICATION_URL = `${Deno.env.get("SUPABASE_FUNCTIONS_URL")}/send-notification`;

interface SuspiciousLoginRequest {
  user_id: string;
  login_ip: string;
  device_info: string;
  timestamp: string;
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  let bodyData: SuspiciousLoginRequest;
  try {
    bodyData = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }

  const { user_id, login_ip, device_info, timestamp } = bodyData;
  if (!user_id || !login_ip || !device_info || !timestamp) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
  }

  // Serialize payload
  const payloadObject = { login_ip, device_info, timestamp };
  const serialized = JSON.stringify(payloadObject);

  // TODO: Replace this with real Signal Protocol encryption
  const encryptedMessage = `encrypted:${serialized}`;
  const encryptedPayload = { data: encryptedMessage };

  // Dispatch critical security notification
  let success = true;
  try {
    const resp = await fetch(SEND_NOTIFICATION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id,
        notification_type: "security",
        title: "Suspicious login detected",
        body: encryptedMessage,
        payload: encryptedPayload,
        priority: "critical",
        channels: ["email", "push"],
      }),
    });
    if (!resp.ok) {
      success = false;
    }
  } catch {
    success = false;
  }

  const statusCode = success ? 200 : 500;
  return new Response(JSON.stringify({ success }), {
    status: statusCode,
    headers: { "Content-Type": "application/json" },
  });
});

