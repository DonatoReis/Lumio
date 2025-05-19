import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";
import type { Database } from "../../../src/integrations/supabase/types";

// Initialize Supabase client with service role (for admin operations)
const supabaseAdmin = createClient<Database>(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface NotificationRequest {
  user_id: string;
  notification_type: string;
  title: string;
  body?: string;
  payload?: Record<string, any>;
  priority?: "low" | "normal" | "high" | "critical";
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  let data: NotificationRequest;
  try {
    data = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }

  const {
    user_id,
    notification_type,
    title,
    body = "",
    payload = {},
    priority = "normal",
  } = data;

  // Fetch user preferences via RPC
  const { data: prefs, error: rpcError } = await supabaseAdmin
    .rpc("get_user_notification_prefs", { p_user_id: user_id })
    .throws();
  if (rpcError || !prefs) {
    return new Response(JSON.stringify({ error: "Failed to fetch user preferences" }), { status: 500 });
  }

  let sentCount = 0;
  let failedCount = 0;

  // Process each channel based on preferences
  for (const pref of prefs) {
    if (!pref.is_enabled) {
      continue;
    }

    const channel = pref.channel_name;

    // Insert a pending log entry
    const { data: logEntry, error: insertError } = await supabaseAdmin
      .from("notification_logs")
      .insert({
        user_id,
        channel,
        notification_type,
        title,
        body,
        payload,
        priority,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError || !logEntry) {
      failedCount++;
      continue;
    }

    const logId = logEntry.id as string;

    // Dispatch notification (stub - replace with real integration)
    let status: "sent" | "failed" = "sent";
    try {
      // Route based on channel
      if (channel === "email") {
        // await sendEmailNotification(user_id, title, body, payload);
        console.log("Would send email notification");
      } else if (channel === "push") {
        try {
          const pushResponse = await fetch(`${Deno.env.get("SUPABASE_FUNCTIONS_URL")}/send-push`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id,
              title,
              body,
              payload: {
                ...payload,
                notification_type,
                priority
              }
            })
          });
          
          if (!pushResponse.ok) {
            throw new Error(`Push notification failed with status ${pushResponse.status}`);
          }
        } catch (pushError) {
          console.error("Error sending push notification:", pushError);
          status = "failed";
        }
      } else if (channel === "in-app") {
        // await deliverInAppNotification(user_id, title, body, payload);
        console.log("Would deliver in-app notification");
      }
    } catch (dispatchError) {
      status = "failed";
    }

    // Update log status
    const { error: updateError } = await supabaseAdmin
      .from("notification_logs")
      .update({ status })
      .eq("id", logId);

    if (updateError) {
      failedCount++;
    } else {
      status === "sent" ? sentCount++ : failedCount++;
    }
  }

  const response = { sent: sentCount, failed: failedCount };
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

