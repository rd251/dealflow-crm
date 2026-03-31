import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  return await res.json();
}

async function getValidAccessToken(supabase: any, connection: any): Promise<string | null> {
  const now = new Date();
  const expiresAt = new Date(connection.token_expires_at);
  if (expiresAt > new Date(now.getTime() + 60000)) {
    return connection.access_token;
  }
  const refreshed = await refreshAccessToken(connection.refresh_token);
  if (!refreshed) return null;
  const newExpires = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await supabase.from("google_calendar_connections").update({
    access_token: refreshed.access_token,
    token_expires_at: newExpires,
  }).eq("user_id", connection.user_id);
  return refreshed.access_token;
}

function buildRawEmail(to: string, subject: string, body: string, fromEmail: string): string {
  const boundary = "boundary_" + Date.now();
  const lines = [
    `From: ${fromEmail}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    btoa(unescape(encodeURIComponent(body))),
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    btoa(unescape(encodeURIComponent(body.replace(/\n/g, "<br>")))),
    "",
    `--${boundary}--`,
  ];
  return lines.join("\r\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { to, subject, body, entity_id, entity_type, selskap_id, kontakt_id } = await req.json();

    if (!to || !subject || !body) {
      return new Response(JSON.stringify({ error: "Mangler mottaker, emne eller innhold" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Ikke autentisert" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAnon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabaseAnon.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Ikke autentisert" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Get Gmail connection
    const { data: connection } = await supabase
      .from("google_calendar_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("gmail_sync_enabled", true)
      .single();

    if (!connection) {
      return new Response(JSON.stringify({ error: "Gmail er ikke koblet til. Koble til Gmail i Innstillinger." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getValidAccessToken(supabase, connection);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Kunne ikke autentisere mot Gmail. Prøv å koble til på nytt." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's email
    const profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!profileRes.ok) {
      return new Response(JSON.stringify({ error: "Kunne ikke hente Gmail-profil" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const profile = await profileRes.json();
    const fromEmail = profile.emailAddress;

    // Fetch Gmail signature
    let signature = "";
    try {
      const sendAsRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (sendAsRes.ok) {
        const sendAsData = await sendAsRes.json();
        const primary = sendAsData.sendAs?.find((s: any) => s.isPrimary);
        if (primary?.signature) {
          signature = primary.signature;
        }
      }
    } catch (e) {
      console.warn("Could not fetch Gmail signature:", e);
    }

    // Build and send email (with signature appended)
    const fullBody = signature ? `${body}\n\n${signature}` : body;
    const rawEmail = buildRawEmail(to, subject, fullBody, fromEmail);
    const encodedEmail = btoa(unescape(encodeURIComponent(rawEmail)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    // Actually we need web-safe base64 of the raw bytes
    const encoder = new TextEncoder();
    const rawBytes = encoder.encode(rawEmail);
    const base64 = btoa(String.fromCharCode(...rawBytes));
    const webSafeBase64 = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: webSafeBase64 }),
    });

    if (!sendRes.ok) {
      const errText = await sendRes.text();
      console.error("Gmail send error:", sendRes.status, errText);
      return new Response(JSON.stringify({ error: "Kunne ikke sende e-post via Gmail" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sendData = await sendRes.json();

    // Log activity
    const aktivitetData: Record<string, any> = {
      type: "E-post",
      tittel: `→ ${subject}`,
      beskrivelse: `[${to}] ${body.substring(0, 500)}`,
      dato: new Date().toISOString(),
      ekstern_id: sendData.id,
      ekstern_provider: "gmail",
      aktivitet_kilde: "gmail_sendt",
      user_id: user.id,
    };

    // Link to entities
    if (entity_type === "salgsmulighet" && entity_id) {
      aktivitetData.salgsmulighet_id = entity_id;
    } else if (entity_type === "lead" && entity_id) {
      aktivitetData.lead_id = entity_id;
    }
    if (selskap_id) aktivitetData.selskap_id = selskap_id;
    if (kontakt_id) aktivitetData.kontakt_id = kontakt_id;

    await supabase.from("aktiviteter").insert(aktivitetData);

    // Update sist_aktivitet on the entity
    const today = new Date().toISOString().split("T")[0];
    if (entity_type === "salgsmulighet" && entity_id) {
      await supabase.from("salgsmuligheter").update({ sist_aktivitet: today }).eq("id", entity_id);
    } else if (entity_type === "lead" && entity_id) {
      await supabase.from("leads").update({ sist_aktivitet: today }).eq("id", entity_id);
    }

    return new Response(JSON.stringify({ success: true, messageId: sendData.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("gmail-send error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Ukjent feil" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
