import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const BREVO_API = 'https://api.brevo.com/v3'
const SENDER = { name: 'Snakk AI', email: 'rd@snakk.ai' }
const KAMPANJE_NAVN = 'Demo – Nyhetsbrev Snakk AI'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function brevo(path: string, init: RequestInit = {}) {
  const apiKey = Deno.env.get('BREVO_DIRECT_API_KEY')
  if (!apiKey) throw new Error('BREVO_DIRECT_API_KEY is not configured')
  const res = await fetch(`${BREVO_API}${path}`, {
    ...init,
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      accept: 'application/json',
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  if (!res.ok) {
    console.error(`Brevo ${path} failed [${res.status}]: ${text}`)
    throw new Error(`[${res.status}] ${text}`)
  }
  return text ? JSON.parse(text) : {}
}

function demoHtml(): string {
  return `<!DOCTYPE html>
<html lang="no" xmlns="http://www.w3.org/1999/xhtml"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>Snakk AI</title>
<!--[if mso]><style>table{border-collapse:collapse;}td{font-family:Arial,sans-serif;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:#faf7f7;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Nå kjører alle samtalene våre på Telenor-linjer via Unifon &#8211; og det merkes.&#8199;&#847;&#8199;&#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f7;padding:28px 12px;">
<tr><td align="center">

<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- LOGO -->
  <tr><td style="padding:6px 8px 18px 8px;">
    <span style="font-size:24px;font-weight:800;letter-spacing:-.5px;color:#1a1a1a;">SNAKK</span><span style="color:#e01e26;font-size:24px;">&#10022;</span>
  </td></tr>

  <!-- HERO -->
  <tr><td style="background:#500000;border-radius:18px 18px 0 0;padding:40px 36px 36px 36px;">
    <div style="display:inline-block;background:rgba(255,255,255,.14);color:#ffd9d9;font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;padding:6px 14px;border-radius:999px;margin-bottom:18px;">Nyheter fra Snakk AI</div>
    <h1 style="margin:0 0 14px 0;font-size:30px;line-height:1.2;font-weight:800;letter-spacing:-.5px;color:#ffffff;">Nå kjører vi 100&#160;% på Telenor-linjer &#8211; via Unifon</h1>
    <p style="margin:0;font-size:16px;line-height:1.6;color:#f3dcdc;">Hei {{ contact.FIRSTNAME | default: "der" }}! Vi har oppgradert hele telefoni-plattformen vår. Alle AI-samtaler hos Snakk kjører nå på Norges mest robuste mobilnett &#8211; og det betyr bedre lyd, færre brudd og raskere svar for kundene dine.</p>
  </td></tr>

  <!-- BRØDTEKST -->
  <tr><td style="background:#ffffff;padding:32px 36px 8px 36px;">
    <h2 style="margin:0 0 12px 0;font-size:20px;line-height:1.3;font-weight:800;color:#500000;">Hva betyr dette for deg?</h2>
    <p style="margin:0;font-size:16px;line-height:1.7;color:#3a3a3a;">Når en kunde ringer bedriften din, er det én ting som gjelder: samtalen må fungere &#8211; hver gang. Ved å kjøre all trafikk gjennom Unifon på Telenors nett får AI-agentene våre krystallklar lyd og en oppetid vi kan stå inne for. For deg betyr det færre tapte anrop, og flere leads som faktisk blir tatt hånd om.</p>
  </td></tr>

  <!-- NYHETSKORT 1 -->
  <tr><td style="background:#ffffff;padding:24px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdf0f0;border-radius:14px;">
      <tr><td style="padding:22px 24px;">
        <div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#e01e26;margin-bottom:8px;">&#128640; Nyhet</div>
        <div style="font-size:18px;font-weight:800;color:#500000;line-height:1.3;">Full migrering til Unifon &#38; Telenor-nettet</div>
        <div style="font-size:15px;line-height:1.65;color:#444;padding:8px 0 12px 0;">Hele Snakk-plattformen kjører nå på Telenor-linjer levert av Unifon. Resultatet: merkbart bedre samtalekvalitet, norsk infrastruktur hele veien, og en leverandør som svarer når det gjelder.</div>
        <a href="https://snakk.ai" style="color:#e01e26;font-weight:700;text-decoration:none;font-size:15px;">Les mer om plattformen &#8594;</a>
      </td></tr>
    </table>
  </td></tr>

  <!-- NYHETSKORT 2 -->
  <tr><td style="background:#ffffff;padding:16px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdf0f0;border-radius:14px;">
      <tr><td style="padding:22px 24px;">
        <div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#e01e26;margin-bottom:8px;">&#128161; Tips</div>
        <div style="font-size:18px;font-weight:800;color:#500000;line-height:1.3;">Svar leads innen 5 minutter &#8211; automatisk</div>
        <div style="font-size:15px;line-height:1.65;color:#444;padding:8px 0 12px 0;">Visste du at sjansen for å nå et lead faller drastisk etter de første 5 minuttene? Med Snakk AI-agenten din blir hvert anrop og hver henvendelse besvart umiddelbart &#8211; også utenfor åpningstid.</div>
        <a href="https://snakk.ai" style="color:#e01e26;font-weight:700;text-decoration:none;font-size:15px;">Se hvordan det fungerer &#8594;</a>
      </td></tr>
    </table>
  </td></tr>

  <!-- NYHETSKORT 3 -->
  <tr><td style="background:#ffffff;padding:16px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdf0f0;border-radius:14px;">
      <tr><td style="padding:22px 24px;">
        <div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#e01e26;margin-bottom:8px;">&#129309; Nytt forhandlerprogram</div>
        <div style="font-size:18px;font-weight:800;color:#500000;line-height:1.3;">Selg Snakk til kundene dine &#8211; vi tar teknologien</div>
        <div style="font-size:15px;line-height:1.65;color:#444;padding:8px 0 12px 0;">Vi har lansert et helt nytt forhandlerprogram. Du eier kunden og prosjektet, vi eier teknologien og driften. Ingen lisenskostnad, ingen minsteforpliktelse &#8211; og l&#248;pende provisjon s&#229; lenge kunden er kunde. Over 100 virksomheter bruker allerede plattformen.</div>
        <a href="https://snakk.ai" style="color:#e01e26;font-weight:700;text-decoration:none;font-size:15px;">Les om forhandlerprogrammet &#8594;</a>
      </td></tr>
    </table>
  </td></tr>

  <!-- AI BYGGER -->
  <tr><td style="background:#ffffff;padding:16px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdf0f0;border-radius:14px;">
      <tr><td style="padding:22px 24px;">
        <div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#e01e26;margin-bottom:8px;">&#128640; Prøv selv</div>
        <div style="font-size:18px;font-weight:800;color:#500000;line-height:1.3;">Bygg din egen AI-agent på minutter</div>
        <div style="font-size:15px;line-height:1.65;color:#444;padding:8px 0 12px 0;">Lim inn nettsideadressen din på snakk.ai/kom-i-gang, så analyserer vi siden og bygger en skreddersydd AI-agent klar til å svare på spørsmål om bedriften din.</div>
        <a href="https://www.snakk.ai/kom-i-gang" style="display:inline-block;background:#e01e26;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 28px;border-radius:999px;">Bygg AI-agent nå &#8594;</a>
      </td></tr>
    </table>
  </td></tr>

  <!-- SITAT -->
  <tr><td style="background:#ffffff;padding:28px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-left:4px solid #e01e26;">
      <tr><td style="padding:4px 0 4px 20px;">
        <div style="font-size:17px;line-height:1.6;color:#1a1a1a;font-style:italic;">&laquo;Med Snakk sin AI-agent mister vi ikke lenger en eneste telefon. Kundene får svar med én gang &#8211; og vi får flere avtaler i boka.&raquo;</div>
        <div style="font-size:13px;color:#888;padding-top:8px;font-weight:700;">Fornøyd kunde &middot; Snakk AI</div>
      </td></tr>
    </table>
  </td></tr>

  <!-- CTA -->
  <tr><td align="center" style="background:#ffffff;padding:36px 36px 40px 36px;border-radius:0 0 18px 18px;">
    <div style="font-size:20px;font-weight:800;color:#500000;line-height:1.3;margin-bottom:8px;">Vil du høre forskjellen selv?</div>
    <div style="font-size:15px;color:#555;line-height:1.6;margin-bottom:22px;">Book en uforpliktende demo, så viser vi deg AI-agenten i aksjon &#8211; det tar bare 15 minutter.</div>
    <a href="https://meet.brevo.com/robin-saeter-diallo" style="display:inline-block;background:#e01e26;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:16px 40px;border-radius:999px;">Book en demo</a>
    <div style="padding-top:14px;"><a href="mailto:rd@snakk.ai" style="color:#500000;font-weight:600;text-decoration:underline;font-size:14px;">Eller svar direkte til oss</a></div>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="padding:26px 12px 8px 12px;text-align:center;font-size:12px;color:#999;line-height:1.7;">
    <span style="font-weight:800;color:#1a1a1a;">SNAKK</span><span style="color:#e01e26;">&#10022;</span> &middot; Oslo, Norge<br>
    <a href="https://snakk.ai" style="color:#999;text-decoration:underline;">snakk.ai</a><br><br>
    Du mottar denne e-posten fordi du har vært i kontakt med Snakk AI.<br>
    <a href="{{ unsubscribe }}" style="color:#999;text-decoration:underline;">Meld deg av nyhetsbrev</a>
  </td></tr>

</table>
</td></tr></table></body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Finn hovedlisten (Alle) fra app_settings
    const { data: setting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'brevo_lister')
      .maybeSingle()

    const lister = setting?.value ? JSON.parse(setting.value) : {}
    const alleId = lister?.alle?.liste_id || lister?.alle
    if (!alleId) {
      return json({ error: 'Fant ikke hovedlisten. Kjør "Synk til Brevo" først.' }, 400)
    }

    // Finn eksisterende demo-kampanje og oppdater den, ellers opprett ny
    const eksisterende = await brevo('/emailCampaigns?limit=100&offset=0&status=draft')
    const treff = (eksisterende?.campaigns || []).find((c: any) => c.name === KAMPANJE_NAVN)

    const payload = {
      name: KAMPANJE_NAVN,
      subject: 'Nå kjører Snakk 100 % på Telenor-linjer 🚀',
      previewText: 'Alle AI-samtalene våre går nå via Unifon på Telenor-nettet – og det merkes.',
      sender: SENDER,
      type: 'classic',
      htmlContent: demoHtml(),
      recipients: { listIds: [Number(alleId)] },
      inlineImageActivation: false,
    }

    if (treff) {
      await brevo(`/emailCampaigns/${treff.id}`, { method: 'PUT', body: JSON.stringify(payload) })
      return json({ kampanje_id: treff.id, oppdatert: true, liste_id: alleId })
    }

    const ny = await brevo('/emailCampaigns', { method: 'POST', body: JSON.stringify(payload) })
    return json({ kampanje_id: ny.id, oppdatert: false, liste_id: alleId })
  } catch (e) {
    console.error(e)
    return json({ error: String(e?.message || e) }, 500)
  }
})
