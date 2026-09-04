import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const BREVO_API = 'https://api.brevo.com/v3'
const FOLDER_NAME = 'Snakk AI CRM'
const SENDER = { name: 'Snakk AI', email: 'rd@snakk.ai' }
const MAL_NAVN = 'Snakk AI – Nyhetsbrev mal'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TEST_HINTS = ['test@', 'test.', 'example.com', 'noreply', 'no-reply', 'dummy', 'ingen@', 'mailinator', 'yopmail']

// Irrelevante selskaper/domener som ikke skal ligge i noen Brevo-liste
const EKSKLUDERTE_DOMENER = ['fair.no', 'faircollection.no', 'unifon.no', 'gastroplanner.no', 'innlandetlegesenter.no', 'innlandetlegesenter']
const EKSKLUDERTE_SELSKAP = ['fair collection', 'unifon', 'gastro planner', 'gastroplanner', 'innlandet legesenter', 'innlandetlegesenter']
const ekskludert = (e: string, selskap = '') => {
  const s = selskap.toLowerCase()
  if (EKSKLUDERTE_DOMENER.some((d) => e.endsWith(`@${d}`) || e.endsWith(`.${d}`))) return true
  if (EKSKLUDERTE_SELSKAP.some((n) => s.includes(n))) return true
  return false
}

// Kilder vi anser som "kalde" – kjøpte/importerte lister vi selv har lagt inn.
// Disse skal IKKE inn i hovedlisten (Alle).
const KALDE_KILDER = ['Kald outbound', 'Instantly kald e-post', 'Kasoleads']

const LISTE_NAVN: Record<string, string> = {
  alle: 'Snakk AI – Alle (henvendelser + kunder)',
  alle_leads: 'Snakk AI – Alle leads',
  leads_aktive: 'Snakk AI – Leads (aktive)',
  inbound_nettside: 'Snakk AI – Leads inbound (nettside)',
  facebook: 'Snakk AI – Leads Facebook ads',
  google_ads: 'Snakk AI – Leads Google ads',
  outbound: 'Snakk AI – Leads outbound',
  ringeliste: 'Snakk AI – Ringeliste',
  kontakter: 'Snakk AI – Kontakter',
  kunder: 'Snakk AI – Kunder (Live/Pilot)',
  deals_aktive: 'Snakk AI – Aktive salgsmuligheter',
  partnere: 'Snakk AI – Partnere',
}

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

function gyldig(e?: string | null, selskap = ''): boolean {
  const v = (e || '').trim().toLowerCase()
  if (!EMAIL_RE.test(v)) return false
  if (v.endsWith('@snakk.ai')) return false
  if (ekskludert(v, selskap)) return false
  if (TEST_HINTS.some((t) => v.includes(t))) return false
  return true
}

// Fjerner kontakter fra ekskluderte domener/selskap helt ut av Brevo (alle lister)
async function ryddIrrelevante(listeIder: number[]): Promise<string[]> {
  const funnet = new Set<string>()
  for (const listId of listeIder) {
    for (let offset = 0; offset < 5000; offset += 500) {
      let side: any
      try {
        side = await brevo(`/contacts/lists/${listId}/contacts?limit=500&offset=${offset}`)
      } catch {
        break
      }
      const rader = side?.contacts || []
      for (const c of rader) {
        const e = (c.email || '').toLowerCase()
        const selskap = (c.attributes?.COMPANY || '').toLowerCase()
        if (e && ekskludert(e, selskap)) funnet.add(e)
      }
      if (rader.length < 500) break
    }
  }
  for (const e of funnet) {
    await brevo(`/contacts/${encodeURIComponent(e)}`, { method: 'DELETE' }).catch((err) =>
      console.error('Kunne ikke slette kontakt', e, err),
    )
  }
  return [...funnet]
}

async function finnEllerOpprettMappe(): Promise<number> {
  const eksisterende = await brevo('/contacts/folders?limit=50&offset=0')
  const treff = (eksisterende?.folders || []).find((f: any) => f.name === FOLDER_NAME)
  if (treff) return treff.id
  const ny = await brevo('/contacts/folders', {
    method: 'POST',
    body: JSON.stringify({ name: FOLDER_NAME }),
  })
  return ny.id
}

async function finnEllerOpprettListe(folderId: number, navn: string): Promise<number> {
  const eksisterende = await brevo(`/contacts/folders/${folderId}/lists?limit=50&offset=0`)
  const treff = (eksisterende?.lists || []).find((l: any) => l.name === navn)
  if (treff) return treff.id
  const ny = await brevo('/contacts/lists', {
    method: 'POST',
    body: JSON.stringify({ name: navn, folderId }),
  })
  return ny.id
}

interface Kontakt {
  email: string
  FIRSTNAME: string
  COMPANY: string
  KILDE: string
  STATUS: string
}

async function importer(listId: number, kontakter: Kontakt[]) {
  for (let i = 0; i < kontakter.length; i += 200) {
    const batch = kontakter.slice(i, i + 200)
    await brevo('/contacts/import', {
      method: 'POST',
      body: JSON.stringify({
        listIds: [listId],
        updateExistingContacts: true,
        emptyContactsAttributes: false,
        jsonBody: batch.map((k) => ({
          email: k.email,
          attributes: {
            FIRSTNAME: k.FIRSTNAME,
            COMPANY: k.COMPANY,
            KILDE: k.KILDE,
            STATUS: k.STATUS,
          },
        })),
      }),
    })
  }
}

async function sikreAttributter() {
  for (const navn of ['KILDE', 'STATUS', 'COMPANY']) {
    await brevo(`/contacts/attributes/normal/${navn}`, {
      method: 'POST',
      body: JSON.stringify({ type: 'text' }),
    }).catch(() => {})
  }
}

function malHtml(): string {
  return `<!DOCTYPE html>
<html lang="no" xmlns="http://www.w3.org/1999/xhtml"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>Snakk AI</title>
<!--[if mso]><style>table{border-collapse:collapse;}td{font-family:Arial,sans-serif;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:#faf7f7;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">{{ params.PREHEADER | default: "Nyheter fra Snakk AI" }}&#8199;&#847;&#8199;&#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f7;padding:28px 12px;">
<tr><td align="center">

<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- LOGO -->
  <tr><td style="padding:6px 8px 18px 8px;">
    <img src="https://snakk-ai.lovable.app/images/snakk-logo.png" alt="Snakk AI" width="132" style="display:block;width:132px;height:auto;" /> &#10022;
  </td></tr>

  <!-- HERO -->
  <tr><td style="background:#500000;border-radius:18px 18px 0 0;padding:40px 36px 36px 36px;">
    <div style="display:inline-block;background:rgba(255,255,255,.14);color:#ffd9d9;font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;padding:6px 14px;border-radius:999px;margin-bottom:18px;">Nyheter fra Snakk AI</div>
    <h1 style="margin:0 0 14px 0;font-size:30px;line-height:1.2;font-weight:800;letter-spacing:-.5px;color:#ffffff;">Skriv en tittel som gjør nysgjerrig</h1>
    <p style="margin:0;font-size:16px;line-height:1.6;color:#f3dcdc;">Hei {{ contact.FIRSTNAME | default: "der" }}! Her er en kort innledning som forklarer hvorfor denne e-posten er verdt å lese – hold den til 1–2 setninger.</p>
  </td></tr>

  <!-- BRØDTEKST -->
  <tr><td style="background:#ffffff;padding:32px 36px 8px 36px;">
    <h2 style="margin:0 0 12px 0;font-size:20px;line-height:1.3;font-weight:800;color:#500000;">Det viktigste først</h2>
    <p style="margin:0;font-size:16px;line-height:1.7;color:#3a3a3a;">Skriv hovedbudskapet her. Én tanke per avsnitt. Korte setninger. Fortell leseren hva de får, ikke bare hva dere har gjort.</p>
  </td></tr>

  <!-- NYHETSKORT 1 -->
  <tr><td style="background:#ffffff;padding:24px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdf0f0;border-radius:14px;">
      <tr><td style="padding:22px 24px;">
        <div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#e01e26;margin-bottom:8px;">&#128640; Nyhet</div>
        <div style="font-size:18px;font-weight:800;color:#500000;line-height:1.3;">Overskrift på nyheten</div>
        <div style="font-size:15px;line-height:1.65;color:#444;padding:8px 0 12px 0;">2–3 setninger om hva dette betyr for kunden. Fokuser på gevinsten: spar tid, færre tapte leads, bedre oppfølging.</div>
        <a href="https://snakk.ai" style="color:#e01e26;font-weight:700;text-decoration:none;font-size:15px;">Les mer &#8594;</a>
      </td></tr>
    </table>
  </td></tr>

  <!-- NYHETSKORT 2 -->
  <tr><td style="background:#ffffff;padding:16px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdf0f0;border-radius:14px;">
      <tr><td style="padding:22px 24px;">
        <div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#e01e26;margin-bottom:8px;">&#128161; Tips</div>
        <div style="font-size:18px;font-weight:800;color:#500000;line-height:1.3;">Et konkret tips leseren kan bruke i dag</div>
        <div style="font-size:15px;line-height:1.65;color:#444;padding:8px 0 12px 0;">Del én praktisk innsikt – f.eks. hvordan man svarer leads innen 5 minutter, eller hvordan AI kan ta oppfølgingen.</div>
        <a href="https://snakk.ai" style="color:#e01e26;font-weight:700;text-decoration:none;font-size:15px;">Se hvordan &#8594;</a>
      </td></tr>
    </table>
  </td></tr>

  <!-- SITAT / SOCIAL PROOF -->
  <tr><td style="background:#ffffff;padding:28px 36px 0 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-left:4px solid #e01e26;">
      <tr><td style="padding:4px 0 4px 20px;">
        <div style="font-size:17px;line-height:1.6;color:#1a1a1a;font-style:italic;">&laquo;Et kundesitat som bygger tillit. Kort, troverdig og gjerne med et konkret resultat.&raquo;</div>
        <div style="font-size:13px;color:#888;padding-top:8px;font-weight:700;">Navn Navnesen &middot; Selskap AS</div>
      </td></tr>
    </table>
  </td></tr>

  <!-- CTA -->
  <tr><td align="center" style="background:#ffffff;padding:36px 36px 40px 36px;border-radius:0 0 18px 18px;">
    <div style="font-size:20px;font-weight:800;color:#500000;line-height:1.3;margin-bottom:8px;">Klar til å ta en prat?</div>
    <div style="font-size:15px;color:#555;line-height:1.6;margin-bottom:22px;">Svar på denne e-posten, eller book en uforpliktende demo – det tar 15 minutter.</div>
    <a href="https://snakk.ai" style="display:inline-block;background:#e01e26;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:16px 40px;border-radius:999px;">Book en demo</a>
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

async function sikreMal(): Promise<number | null> {
  try {
    const eks = await brevo('/smtp/templates?limit=100&offset=0')
    const treff = (eks?.templates || []).find((t: any) => t.name === MAL_NAVN)
    const payload = {
      templateName: MAL_NAVN,
      subject: 'Nyheter fra Snakk AI',
      sender: SENDER,
      htmlContent: malHtml(),
      isActive: true,
    }
    if (treff) {
      await brevo(`/smtp/templates/${treff.id}`, { method: 'PUT', body: JSON.stringify(payload) })
      return treff.id
    }
    const ny = await brevo('/smtp/templates', { method: 'POST', body: JSON.stringify(payload) })
    return ny.id
  } catch (e) {
    console.error('Kunne ikke opprette mal', e)
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const folderId = await finnEllerOpprettMappe()
    await sikreAttributter()

    const [leads, ringeliste, kontakter, deals, selskaper, partnere, avmeldte] = await Promise.all([
      supabase.from('leads').select('e_post, kontaktperson, firmanavn, status, kilde'),
      supabase.from('ringeliste').select('e_post, navn, selskap, segment, status'),
      supabase.from('kontakter').select('e_post, navn, selskap_id'),
      supabase.from('salgsmuligheter').select('e_post, kontaktperson, navn, status'),
      supabase.from('selskaper').select('id, firmanavn, kundestatus'),
      supabase.from('partnere').select('e_post, kontaktperson, partnernavn, partnerstatus'),
      supabase.from('nyhetsbrev_avmeldte').select('e_post'),
    ])

    const blokkert = new Set((avmeldte.data || []).map((a: any) => (a.e_post || '').toLowerCase()))

    const lag = () => new Map<string, Kontakt>()
    const add = (
      m: Map<string, Kontakt>,
      e: string | null,
      navn?: string | null,
      firma?: string | null,
      kilde = '',
      status = '',
    ) => {
      const key = (e || '').trim().toLowerCase()
      const company = (firma || '').trim()
      if (!gyldig(key, company) || blokkert.has(key) || m.has(key)) return
      m.set(key, {
        email: key,
        FIRSTNAME: (navn || '').trim().split(' ')[0] || '',
        COMPANY: company,
        KILDE: kilde,
        STATUS: status,
      })
    }

    const alle = lag()
    const alleLeads = lag()
    const aktiveLeads = lag()
    const nettsideLeads = lag()
    const facebookLeads = lag()
    const googleLeads = lag()
    const outboundLeads = lag()
    const ringelisteM = lag()
    const kunderLive = lag()
    const kontakterM = lag()
    const dealsAktive = lag()
    const partnereM = lag()

    for (const l of leads.data || []) {
      const kilde = l.kilde || ''
      add(alleLeads, l.e_post, l.kontaktperson, l.firmanavn, kilde, l.status || '')
      if (l.status !== 'Ikke aktuelt') {
        add(aktiveLeads, l.e_post, l.kontaktperson, l.firmanavn, kilde, l.status || '')
      }
      if (kilde === 'Nettside' || kilde === 'Organisk') {
        add(nettsideLeads, l.e_post, l.kontaktperson, l.firmanavn, kilde, l.status || '')
      }
      if (kilde === 'Facebook ads') {
        add(facebookLeads, l.e_post, l.kontaktperson, l.firmanavn, kilde, l.status || '')
      }
      if (kilde === 'Google ads') {
        add(googleLeads, l.e_post, l.kontaktperson, l.firmanavn, kilde, l.status || '')
      }
      if (KALDE_KILDER.includes(kilde)) {
        add(outboundLeads, l.e_post, l.kontaktperson, l.firmanavn, kilde, l.status || '')
      } else {
        // Har henvendt seg til oss -> med i hovedlisten
        add(alle, l.e_post, l.kontaktperson, l.firmanavn, kilde || 'lead', l.status || '')
      }
    }
    for (const r of ringeliste.data || []) {
      add(ringelisteM, r.e_post, r.navn, r.selskap, r.segment || 'ringeliste', r.status || '')
    }
    const selskapMap = new Map((selskaper.data || []).map((s: any) => [s.id, s]))
    for (const k of (kontakter.data || []) as any[]) {
      const s = k.selskap_id ? selskapMap.get(k.selskap_id) : null
      add(kontakterM, k.e_post, k.navn, s?.firmanavn || '', 'kontakt', s?.kundestatus || '')
      add(alle, k.e_post, k.navn, s?.firmanavn || '', 'kontakt', s?.kundestatus || '')
      if (s && (s.kundestatus === 'Live' || s.kundestatus === 'Pilot')) {
        add(kunderLive, k.e_post, k.navn, s.firmanavn, 'kunde', s.kundestatus)
      }
    }
    for (const d of deals.data || []) {
      add(alle, d.e_post, d.kontaktperson, d.navn, 'salgsmulighet', d.status || '')
      if (['Vunnet', 'Tapt'].includes(d.status || '')) continue
      add(dealsAktive, d.e_post, d.kontaktperson, d.navn, 'salgsmulighet', d.status || '')
    }
    for (const p of partnere.data || []) {
      add(partnereM, p.e_post, p.kontaktperson, p.partnernavn, 'partner', p.partnerstatus || '')
      add(alle, p.e_post, p.kontaktperson, p.partnernavn, 'partner', p.partnerstatus || '')
    }

    const segmenter: { key: string; kontakter: Kontakt[] }[] = [
      { key: 'alle', kontakter: [...alle.values()] },
      { key: 'alle_leads', kontakter: [...alleLeads.values()] },
      { key: 'leads_aktive', kontakter: [...aktiveLeads.values()] },
      { key: 'inbound_nettside', kontakter: [...nettsideLeads.values()] },
      { key: 'facebook', kontakter: [...facebookLeads.values()] },
      { key: 'google_ads', kontakter: [...googleLeads.values()] },
      { key: 'outbound', kontakter: [...outboundLeads.values()] },
      { key: 'ringeliste', kontakter: [...ringelisteM.values()] },
      { key: 'kontakter', kontakter: [...kontakterM.values()] },
      { key: 'kunder', kontakter: [...kunderLive.values()] },
      { key: 'deals_aktive', kontakter: [...dealsAktive.values()] },
      { key: 'partnere', kontakter: [...partnereM.values()] },
    ]

    const resultat: Record<string, { liste_id: number; antall: number }> = {}
    const listeIder: Record<string, number> = {}
    for (const seg of segmenter) {
      const navn = LISTE_NAVN[seg.key]
      const listId = await finnEllerOpprettListe(folderId, navn)
      listeIder[seg.key] = listId
      if (seg.kontakter.length) await importer(listId, seg.kontakter)
      resultat[navn] = { liste_id: listId, antall: seg.kontakter.length }
    }

    const fjernet = await ryddIrrelevante(Object.values(listeIder))

    const malId = await sikreMal()

    await supabase.from('app_settings').upsert(
      [
        { key: 'brevo_list_id', value: String(listeIder.alle) },
        { key: 'brevo_folder_id', value: String(folderId) },
        { key: 'brevo_lister', value: JSON.stringify(listeIder) },
        ...(malId ? [{ key: 'brevo_template_id', value: String(malId) }] : []),
      ],
      { onConflict: 'key' },
    )

    const totalt = Object.values(resultat).reduce((a, b) => a + b.antall, 0)
    return json({
      liste_id: listeIder.alle,
      folder_id: folderId,
      mal_id: malId,
      antall_importert: resultat[LISTE_NAVN.alle]?.antall ?? 0,
      antall_totalt: totalt,
      fjernet_irrelevante: fjernet,
      lister: resultat,
    })
  } catch (e) {
    console.error('brevo-setup error', e)
    return json({ error: e instanceof Error ? e.message : 'Ukjent feil' }, 500)
  }
})
