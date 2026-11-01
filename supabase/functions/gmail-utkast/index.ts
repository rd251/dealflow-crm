// Lager (eller sletter) et Gmail-UTKAST med en kort påminnelse i samme tråd som en «venter på svar»-e-post.
// Sender aldri e-post.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { ROBIN_SIGNATURE, robinSignatureText, robinSignatureHtml, escapeEmailHtml } from "../_shared/robin-signature.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function token(sb: any, c: any): Promise<string | null> {
  if (new Date(c.token_expires_at) > new Date(Date.now() + 60000)) return c.access_token;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: Deno.env.get("GOOGLE_CLIENT_ID")!, client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!, refresh_token: c.refresh_token, grant_type: "refresh_token" }),
  });
  if (!r.ok) return null;
  const t = await r.json();
  await sb.from("google_calendar_connections").update({ access_token: t.access_token, token_expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString() }).eq("user_id", c.user_id);
  return t.access_token;
}

const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const enc = (s: string) => `=?UTF-8?B?${b64(s)}?=`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Ikke autentisert" }, 401);
    const anon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await anon.auth.getUser();
    if (!user) return json({ error: "Ikke autentisert" }, 401);
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { venter_id, action, draft_id } = await req.json();
    const { data: conn } = await sb.from("google_calendar_connections").select("*").eq("user_id", user.id).eq("gmail_sync_enabled", true).maybeSingle();
    if (!conn) return json({ error: "Gmail er ikke koblet til. Koble til Gmail i Innstillinger." }, 400);
    const at = await token(sb, conn);
    if (!at) return json({ error: "Kunne ikke autentisere mot Gmail. Koble til på nytt." }, 401);
    const H = { Authorization: `Bearer ${at}`, "Content-Type": "application/json" };

    if (action === "slett") {
      if (!draft_id) return json({ error: "Mangler utkast" }, 400);
      const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/drafts/${draft_id}`, { method: "DELETE", headers: H });
      return json({ ok: r.ok || r.status === 404 });
    }

    const { data: v } = await sb.from("venter_pa_svar").select("*").eq("id", venter_id).maybeSingle();
    if (!v) return json({ error: "Fant ikke e-posten" }, 404);
    if (v.user_id !== user.id) return json({ error: "Tråden ligger i en annen persons Gmail – bare avsenderen kan lage utkast." }, 403);

    const tr = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${v.thread_id}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=Subject&metadataHeaders=To&metadataHeaders=References`, { headers: H });
    if (!tr.ok) return json({ error: "Fant ikke tråden i Gmail" }, 404);
    const thread = await tr.json();
    const sist = thread.messages?.[thread.messages.length - 1];
    const hdr = (n: string) => (sist?.payload?.headers || []).find((h: any) => h.name.toLowerCase() === n.toLowerCase())?.value || "";
    const msgId = hdr("Message-ID");
    const refs = [hdr("References"), msgId].filter(Boolean).join(" ").trim();
    const emne0 = v.emne || hdr("Subject") || "";
    const emne = /^re:/i.test(emne0) ? emne0 : `Re: ${emne0}`;
    const til = v.e_post || hdr("To");
    if (!til) return json({ error: "Mangler mottaker" }, 400);

    // Fornavn fra kontakt/lead hvis kjent
    let navn = "";
    if (v.kontakt_id) navn = (await sb.from("kontakter").select("navn").eq("id", v.kontakt_id).maybeSingle()).data?.navn || "";
    if (!navn && v.lead_id) navn = (await sb.from("leads").select("kontaktperson").eq("id", v.lead_id).maybeSingle()).data?.kontaktperson || "";
    const fornavn = navn.trim().split(/\s+/)[0] || "";

    const tekst = `Hei${fornavn ? ` ${fornavn}` : ""}!\n\nVille bare følge opp e-posten min under – har du fått sett på den?\n\nSi gjerne fra om noe er uklart, så tar vi en rask prat.`;
    const erRobin = (user.email || "").toLowerCase() === ROBIN_SIGNATURE.epost;
    let sigTekst = "", sigHtml = "";
    if (erRobin) { sigTekst = robinSignatureText(); sigHtml = robinSignatureHtml(); }
    else {
      const { data: p } = await sb.from("profiles").select("display_name, signatur_navn, signatur_tittel, signatur_selskap").eq("user_id", user.id).maybeSingle();
      const l = [p?.signatur_navn || p?.display_name, p?.signatur_tittel, p?.signatur_selskap].filter(Boolean);
      sigTekst = l.length ? `Vennlig hilsen\n${l.join("\n")}` : "";
      sigHtml = sigTekst ? `<p>${escapeEmailHtml(sigTekst).replace(/\n/g, "<br>")}</p>` : "";
    }
    const plain = `${tekst}${sigTekst ? `\n\n${sigTekst}` : ""}`;
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;">${escapeEmailHtml(tekst).replace(/\n/g, "<br>")}</div>${sigHtml}`;
    const bnd = "b_" + Date.now();
    const raw = [
      `To: ${til}`, `Subject: ${enc(emne)}`,
      ...(msgId ? [`In-Reply-To: ${msgId}`, `References: ${refs}`] : []),
      "MIME-Version: 1.0", `Content-Type: multipart/alternative; boundary="${bnd}"`, "",
      `--${bnd}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", b64(plain), "",
      `--${bnd}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", b64(html), "",
      `--${bnd}--`,
    ].join("\r\n");
    const rawB64 = b64(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const dr = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
      method: "POST", headers: H, body: JSON.stringify({ message: { raw: rawB64, threadId: v.thread_id } }),
    });
    if (!dr.ok) {
      const t = await dr.text(); console.error("draft", dr.status, t);
      if (dr.status === 403 && t.includes("SCOPE")) return json({ error: "Gmail må kobles til på nytt for å kunne lage utkast. Gå til Innstillinger og koble til Google igjen." }, 400);
      return json({ error: "Kunne ikke lage utkast i Gmail" }, 500);
    }
    const d = await dr.json();
    return json({ draft_id: d.id, message_id: d.message?.id, thread_id: v.thread_id, til, emne, tekst: plain });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Ukjent feil" }, 500);
  }
});
