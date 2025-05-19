import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";
import type { Database } from "../../../src/integrations/supabase/types";

// Initialize Supabase client with service role for privileged operations
const supabaseAdmin = createClient<Database>(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// URL for the send-notification function (base URL provided via env)
const SEND_NOTIFICATION_URL = `${Deno.env.get("SUPABASE_FUNCTIONS_URL")}/send-notification`;

serve(async (_req: Request) => {
  // Fetch pending reminders due for execution
  const now = new Date().toISOString();
  const { data: reminders, error } = await supabaseAdmin
    .from("scheduled_reminders")
    .select("*")
    .eq("status", "pending")
    .lte("run_at", now)
    .limit(100);

  if (error) {
    return new Response(JSON.stringify({ error: "Failed to fetch reminders" }), { status: 500 });
  }

  let processed = 0;
  let failedCount = 0;

  for (const reminder of reminders || []) {
    processed++;
    let newStatus: "pending" | "sent" | "failed" = "sent";
    const currentRetry = reminder.retry_count ?? 0;
    let retryCount = currentRetry;

    try {
      // Invoke send-notification for this reminder
      const resp = await fetch(SEND_NOTIFICATION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: reminder.user_id,
          notification_type: "reminder",
          title: reminder.title,
          body: reminder.body,
          payload: reminder.payload,
          priority: reminder.priority
        })
      });

      if (!resp.ok) {
        throw new Error(`send-notification responded ${resp.status}`);
      }
    } catch {
      retryCount++;
      // If exceeded max_retries, mark as failed; otherwise leave pending
      newStatus = retryCount >= (reminder.max_retries ?? 3) ? "failed" : "pending";
      failedCount++;
    }

    // Update reminder status and retry count
    await supabaseAdmin
      .from("scheduled_reminders")
      .update({ status: newStatus, retry_count: retryCount })
      .eq("id", reminder.id);
  }

  const summary = { processed, failed: failedCount };
  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
});

