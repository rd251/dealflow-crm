import { createClient } from "npm:@supabase/supabase-js@2";
import {
  MAX_BODY_BYTES,
  extractLeadgenEvents,
  handleChallenge,
  isAllowedPage,
  parsePageAllowlist,
  verifyMetaSignature,
} from "../_shared/meta-leads.ts";

const jsonHeaders = { "Content-Type": "application/json" };

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // 1. Meta verification handshake
  if (req.method === "GET") {
    const result = handleChallenge(url, Deno.env.get("META_VERIFY_TOKEN"));
    return new Response(result.body, { status: result.status, headers: { "Content-Type": "text/plain" } });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders });
  }

  // 2. Body size guard before anything else
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared && declared > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ error: "Payload too large" }), { status: 413, headers: jsonHeaders });
  }

  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ error: "Payload too large" }), { status: 413, headers: jsonHeaders });
  }

  // 3. Signature over the unmodified raw body
  const valid = await verifyMetaSignature(
    rawBody,
    req.headers.get("x-hub-signature-256"),
    Deno.env.get("META_APP_SECRET"),
  );
  if (!valid) {
    console.error("meta-lead-webhook: invalid or missing signature");
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: jsonHeaders });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: jsonHeaders });
  }

  const events = extractLeadgenEvents(payload);
  const allowlist = parsePageAllowlist(Deno.env.get("META_PAGE_IDS"));

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let queued = 0;
  let skipped = 0;

  for (const ev of events) {
    if (!isAllowedPage(ev.pageId, allowlist)) {
      skipped++;
      console.warn(`meta-lead-webhook: ignoring event for non-allowlisted page ${ev.pageId}`);
      continue;
    }
    // Unique leadgen_id makes this atomically idempotent across concurrent deliveries.
    const { error } = await supabase
      .from("meta_lead_events")
      .upsert(
        {
          leadgen_id: ev.leadgenId,
          page_id: ev.pageId,
          form_id: ev.formId,
          ad_id: ev.adId,
          adgroup_id: ev.adgroupId,
          created_time: ev.createdTime,
          raw_change: ev.raw,
        },
        { onConflict: "leadgen_id", ignoreDuplicates: true },
      );
    if (error) {
      console.error("meta-lead-webhook: enqueue failed", error.message);
      // Fail the delivery so Meta retries rather than losing the lead.
      return new Response(JSON.stringify({ error: "Queue write failed" }), { status: 500, headers: jsonHeaders });
    }
    queued++;
  }

  if (queued > 0) {
    await supabase.from("meta_integration_state").upsert({
      id: "default",
      last_event_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Wake the worker immediately. The queue row is already committed, so a failed
    // wake-up only delays processing until the hourly reconciliation run.
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/meta-lead-worker`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    }).catch((e) => console.error("meta-lead-webhook: worker wake-up failed", e));
  }

  return new Response(JSON.stringify({ received: events.length, queued, skipped }), {
    status: 200,
    headers: jsonHeaders,
  });
});
