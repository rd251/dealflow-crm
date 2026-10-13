// Morgenrapport: hvor mange e-poster er sendt ut de siste 24 timene.
// Kjøres daglig kl. 06:00 UTC (08:00 norsk tid) og sendes til rd@snakk.ai.
// Internt driftsvarsel – ingen avmeldingslenke.
import { createClient } from 'npm:@supabase/supabase-js@2'

const AVSENDER = { name: 'Snakk CRM', email: 'rd@snakk.ai' }
const MOTTAKER = 'rd@snakk.ai'
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'
const APP_URL = 'https://snakk-ai.lovable.app'
const LOGO_URL =
  'https://tchmujgzcklwgptocbno.supabase.co/storage/v1/object/public/email-assets/snakk-logo-hvit.png'

const HEADER_ROD = '#c0392b'
const TEKST_MORK = '#1a1917'
const TEKST_DEMPET = '#6b6560'
const KANT = '#ece9e4'
const GUL_BG = '#fff8e1'
const GUL_KANT = '#f0c419'

const VELKOMST_EMNE = '→ Snakk AI – Skal vi ta en prat?'
const MAKS_LISTE = 10

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

function klokke(iso: string): string {
  return new Date(iso).toLocaleString('no-NO', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Europe/Oslo',
  })
}

Deno.serve(async () => {
  if (Deno.env.get('SUPABASE_URL') === undefined) {
    return new Response(JSON.stringify({ error: 'Mangler konfigurasjon' }), { status: 500 })
  }
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const grense24 = new Date(Date.now() - 24 * 3600e3).toISOString()
  const grense7 = new Date(Date.now() - 7 * 24 * 3600e3).toISOString()

  // 1. Automatiske velkomst-e-poster
  const { data: velkomst } = await sb
    .from('leads')
    .select('id, firmanavn, kontaktperson, e_post, velkomst_sendt_at, velkomst_status, velkomst_feil')
    .gte('velkomst_sendt_at', grense24)
    .order('velkomst_sendt_at', { ascending: false })
  const { count: velkomstUken } = await sb
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .gte('velkomst_sendt_at', grense7)

  // 2. E-poster sendt via Gmail (manuelle + velkomst)
  const { data: gmailAkt } = await sb
    .from('aktiviteter')
    .select('id, tittel, beskrivelse, created_at, lead_id, selskap_id')
    .eq('type', 'E-post')
    .eq('aktivitet_kilde', 'gmail_sendt')
    .gte('created_at', grense24)
    .order('created_at', { ascending: false })
  const { count: gmailUken } = await sb
    .from('aktiviteter')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'E-post')
    .eq('aktivitet_kilde', 'gmail_sendt')
    .gte('created_at', grense7)

  const velkomstAktiviteter = (gmailAkt ?? []).filter(a => a.tittel === VELKOMST_EMNE)
  const manuelle = (gmailAkt ?? []).filter(a => a.tittel !== VELKOMST_EMNE)
  const manuelle7 = Math.max((gmailUken ?? 0) - (velkomstUken ?? 0), 0)

  // 3. Oppfølgingspåminnelser («venter på svar»)
  const { count: paaminnelser } = await sb
    .from('venter_pa_svar')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'varslet')
    .gte('varslet_at', grense24)

  // 4. Nyhetsbrev
  const { data: nyhetsbrev } = await sb
    .from('nyhetsbrev')
    .select('tittel, mottaker_antall, sendt_dato')
    .gte('sendt_dato', grense24)

  // 5. Velkommere som feilet
  const { data: velkomstFeilet } = await sb
    .from('leads')
    .select('firmanavn, kontaktperson, e_post, velkomst_feil')
    .eq('velkomst_status', 'feilet')

  const velkomstAntall = (velkomst ?? []).length
  const nyhetsbrevAntall = (nyhetsbrev ?? []).reduce((s, n) => s + (n.mottaker_antall ?? 0), 0)
  const totalt = velkomstAntall + manuelle.length + (paaminnelser ?? 0) + nyhetsbrevAntall

  // ── HTML ──
  const rad = (label: string, verdi: string, dempet?: boolean) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid ${KANT};color:${TEKST_DEMPET};font-size:14px;width:55%;vertical-align:top;">${esc(label)}</td>
      <td style="padding:10px 0;border-bottom:1px solid ${KANT};text-align:right;color:${dempet ? TEKST_DEMPET : TEKST_MORK};font-size:18px;font-weight:700;font-variant-numeric:tabular-nums;vertical-align:top;">${esc(verdi)}</td>
    </tr>`

  const velkomstLinjer = (velkomst ?? [])
    .slice(0, MAKS_LISTE)
    .map(l => `<li style="margin:0 0 6px;color:${TEKST_MORK};font-size:14px;line-height:20px;">
      ${esc(l.firmanavn || 'Ukjent')} · ${esc(l.kontaktperson || '–')}
      <span style="color:${TEKST_DEMPET};">· ${esc(klokke(l.velkomst_sendt_at!))}</span></li>`)
    .join('')
  const manuelleLinjer = manuelle
    .slice(0, MAKS_LISTE)
    .map(a => `<li style="margin:0 0 6px;color:${TEKST_MORK};font-size:14px;line-height:20px;">
      ${esc(a.tittel || 'E-post')}
      <span style="color:${TEKST_DEMPET};">· ${esc(klokke(a.created_at))}</span></li>`)
    .join('')
  const feilLinjer = (velkomstFeilet ?? [])
    .slice(0, MAKS_LISTE)
    .map(l => `<li style="margin:0 0 6px;color:${TEKST_MORK};font-size:14px;line-height:20px;">
      ${esc(l.firmanavn || 'Ukjent')} · ${esc(l.kontaktperson || '–')}
      <span style="color:${TEKST_DEMPET};">· ${esc(l.velkomst_feil || 'Ukjent feil')}</span></li>`)
    .join('')
  const nyhetsbrevLinjer = (nyhetsbrev ?? [])
    .map(n => `<li style="margin:0 0 6px;color:${TEKST_MORK};font-size:14px;line-height:20px;">
      ${esc(n.tittel)} · ${esc(String(n.mottaker_antall ?? 0))} mottakere
      <span style="color:${TEKST_DEMPET};">· ${esc(klokke(n.sendt_dato!))}</span></li>`)
    .join('')

  const blokk = (tittel: string, liste: string) =>
    !liste
      ? ''
      : `<p style="margin:18px 0 6px;color:${TEKST_DEMPET};font-size:12px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${esc(tittel)}</p>
         <ul style="margin:0;padding-left:18px;">${liste}</ul>`

  const html = `<!DOCTYPE html>
<html lang="nb"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Morgenrapport – e-poster sendt ut</title></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;">
    <tr><td align="center" style="padding:0 0 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
        <tr><td style="background-color:${HEADER_ROD};padding:20px 24px;">
          <img src="${LOGO_URL}" alt="Snakk" width="92" style="display:block;border:0;" />
        </td></tr>
        <tr><td style="padding:28px 24px 0;">
          <h1 style="margin:0 0 6px;color:${TEKST_MORK};font-size:22px;line-height:30px;font-weight:700;">Morgenrapport – e-poster sendt ut</h1>
          <p style="margin:0 0 20px;color:${TEKST_DEMPET};font-size:14px;line-height:21px;">Siste 24 timer, mottatt ${esc(klokke(new Date().toISOString()))}.</p>
          <div style="margin:0 0 24px;">
            <p style="margin:0;color:${TEKST_MORK};font-size:44px;font-weight:700;line-height:1.1;font-variant-numeric:tabular-nums;">${totalt}</p>
            <p style="margin:2px 0 0;color:${TEKST_DEMPET};font-size:13px;">e-poster sendt ut totalt</p>
          </div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${KANT};border-radius:10px;margin:0 0 20px;">
            <tr><td style="padding:6px 18px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${rad('Automatisk velkomst («Skal vi ta en prat?»)', String(velkomstAntall))}
                ${rad('Sendt fra Gmail (manuelle)', String(manuelle.length))}
                ${rad('Oppfølgingspåminnelser (venter på svar)', String(paaminnelser ?? 0))}
                ${rad('Nyhetsbrev (mottakere)', String(nyhetsbrevAntall))}
              </table>
            </td></tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${GUL_BG};border:1px solid ${GUL_KANT};border-radius:8px;margin:0 0 24px;">
            <tr><td style="padding:12px 16px;">
              <p style="margin:0;color:#8a6d1a;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;font-weight:700;">Siste 7 dager</p>
              <p style="margin:4px 0 0;color:${TEKST_MORK};font-size:14px;">${esc(String((velkomstUken ?? 0) + manuelle7))} e-poster fra Gmail · ${esc(String(velkomstUken ?? 0))} av dem var automatiske velkomster.</p>
            </td></tr>
          </table>
          <a href="${APP_URL}/aktiviteter" style="background-color:${HEADER_ROD};border-radius:8px;color:#ffffff;display:inline-block;font-size:15px;font-weight:600;padding:12px 22px;text-decoration:none;">Åpne i CRM &rarr;</a>
          ${blokk('Automatiske velkomster', velkomstLinjer)}
          ${blokk('Manuelle e-poster', manuelleLinjer)}
          ${blokk('Nyhetsbrev', nyhetsbrevLinjer)}
          ${blokk(`Velkommere som feilet (${(velkomstFeilet ?? []).length})`, feilLinjer)}
          <hr style="border:none;border-top:1px solid ${KANT};margin:28px 0 14px;" />
          <p style="margin:0;color:${TEKST_DEMPET};font-size:12px;line-height:18px;">
            Snakk Teknologi AS · <a href="https://snakk.ai" style="color:${TEKST_DEMPET};text-decoration:underline;">snakk.ai</a><br />
            Internt driftsvarsel fra Snakk CRM.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  const tekst = [
    `MORGENRAPPORT – E-POSTER SENDT UT (siste 24 t)`,
    ``,
    `Totalt: ${totalt}`,
    `Automatiske velkomster: ${velkomstAntall}`,
    `Sendt fra Gmail (manuelle): ${manuelle.length}`,
    `Oppfølgingspåminnelser: ${paaminnelser ?? 0}`,
    `Nyhetsbrev-mottakere: ${nyhetsbrevAntall}`,
    `Siste 7 dager: ${(velkomstUken ?? 0) + manuelle7} e-poster fra Gmail (${velkomstUken ?? 0} automatiske)`,
    ``,
    `Åpne i CRM: ${APP_URL}/aktiviteter`,
    `Snakk Teknologi AS · snakk.ai`,
  ].join('\n')

  const apiKey = Deno.env.get('BREVO_DIRECT_API_KEY') || Deno.env.get('BREVO_API_KEY')
  if (!apiKey) {
    console.error('BREVO_DIRECT_API_KEY mangler')
    return new Response(JSON.stringify({ error: 'BREVO_DIRECT_API_KEY mangler' }), { status: 500 })
  }

  try {
    const res = await fetch(BREVO_URL, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: AVSENDER,
        to: [{ email: MOTTAKER }],
        subject: `[Snakk CRM] Morgenrapport – ${totalt} e-poster sendt ut`,
        htmlContent: html,
        textContent: tekst,
      }),
    })
    const sendt = res.ok
    if (!sendt) console.error('Brevo avviste morgenrapporten', res.status, (await res.text()).slice(0, 300))
    await sb.from('email_send_log').insert({
      message_id: null,
      template_name: 'morgen-epost-rapport',
      recipient_email: MOTTAKER,
      status: sendt ? 'sent' : 'failed',
      error_message: sendt ? null : `Brevo ${res.status}`,
      metadata: { totalt, velkomstAntall, manuelle: manuelle.length, paaminnelser: paaminnelser ?? 0, nyhetsbrevAntall },
    })
    return new Response(
      JSON.stringify({ totalt, velkomstAntall, manuelle: manuelle.length, paaminnelser: paaminnelser ?? 0, nyhetsbrevAntall, sendt }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    const melding = e instanceof Error ? e.message : String(e)
    console.error('Klarte ikke sende morgenrapporten', melding)
    await sb.from('email_send_log').insert({
      message_id: null,
      template_name: 'morgen-epost-rapport',
      recipient_email: MOTTAKER,
      status: 'failed',
      error_message: melding.slice(0, 1000),
    })
    return new Response(JSON.stringify({ error: melding }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
