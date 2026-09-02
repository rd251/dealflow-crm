import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const BREVO_API = 'https://api.brevo.com/v3'
const FOLDER_NAME = 'Snakk AI CRM'
const HOVEDLISTE = 'Snakk AI – Alle leads'
const SENDER = { name: 'Snakk AI', email: 'rd@snakk.ai' }
const MAL_NAVN = 'Snakk AI – Nyhetsbrev mal'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TEST_HINTS = ['test@', 'test.', 'example.com', 'noreply', 'no-reply', 'dummy', 'ingen@', 'mailinator', 'yopmail']

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

function gyldig(e?: string | null): boolean {
  const v = (e || '').trim().toLowerCase()
  if (!EMAIL_RE.test(v)) return false
  if (v.endsWith('@snakk.ai')) return false
  if (TEST_HINTS.some((t) => v.includes(t))) return false
  return true
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
<html lang="no"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Snakk AI – Nyhetsbrev</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Helvetica,Arial,sans-serif;color:#111;">
<div style="display:none;max-height:0;overflow:hidden;">{{ params.PREHEADER }}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;">
  <tr><td style="padding:28px 32px 8px 32px;">
    <span style="font-size:22px;font-weight:800;letter-spacing:-.5px;color:#111;">SNAKK</span>
    <span style="color:#e01e26;font-size:22px;">&#10022;</span>
  </td></tr>
  <tr><td style="padding:8px 32px 0 32px;">
    <h1 style="margin:0;font-size:26px;line-height:1.25;color:#6b0f0f;">Overskrift her</h1>
  </td></tr>
  <tr><td style="padding:14px 32px 0 32px;font-size:16px;line-height:1.65;color:#333;">
    Hei {{ contact.FIRSTNAME | default: "der" }},<br><br>
    Her er de siste nyhetene fra Snakk AI.
  </td></tr>
  <tr><td style="padding:22px 32px 0 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdf0f0;border-radius:12px;">
      <tr><td style="padding:18px 20px;">
        <div style="font-size:17px;font-weight:700;color:#6b0f0f;">&#128640; Nyhet</div>
        <div style="font-size:15px;line-height:1.6;color:#444;padding-top:6px;">Kort beskrivelse av nyheten.</div>
        <a href="https://snakk.ai" style="color:#e01e26;font-weight:600;text-decoration:underline;font-size:14px;">Les mer</a>
      </td></tr>
    </table>
  </td></tr>
  <tr><td align="center" style="padding:28px 32px 8px 32px;">
    <a href="https://snakk.ai" style="display:inline-block;background:#e01e26;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 30px;border-radius:999px;">Book en demo</a>
  </td></tr>
  <tr><td style="padding:28px 32px 32px 32px;border-top:1px solid #eee;font-size:12px;color:#888;line-height:1.6;">
    Snakk AI &middot; Oslo, Norge<br>
    Du mottar denne e-posten fordi du er i kontakt med Snakk AI.<br>
    <a href="{{ unsubscribe }}" style="color:#888;">Meld deg av</a>
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
      supabase.from('kontakter').select('e_post, navn, selskap_id, selskaper(firmanavn, kundestatus)'),
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
      if (!gyldig(key) || blokkert.has(key) || m.has(key)) return
      m.set(key, {
        email: key,
        FIRSTNAME: (navn || '').trim().split(' ')[0] || '',
        COMPANY: (firma || '').trim(),
        KILDE: kilde,
        STATUS: status,
      })
    }

    const alleLeads = lag()
    const aktiveLeads = lag()
    const nettsideLeads = lag()
    const outboundLeads = lag()
    const ringelisteM = lag()
    const kunderLive = lag()
    const kontakterM = lag()
    const dealsAktive = lag()
    const partnereM = lag()

    for (const l of leads.data || []) {
      add(alleLeads, l.e_post, l.kontaktperson, l.firmanavn, l.kilde || '', l.status || '')
      if (l.status !== 'Ikke aktuelt') {
        add(aktiveLeads, l.e_post, l.kontaktperson, l.firmanavn, l.kilde || '', l.status || '')
      }
      if (l.kilde === 'Nettside' || l.kilde === 'Organisk') {
        add(nettsideLeads, l.e_post, l.kontaktperson, l.firmanavn, l.kilde || '', l.status || '')
      }
      if (['Kald outbound', 'Instantly kald e-post', 'E-post', 'Telefon', 'LinkedIn'].includes(l.kilde || '')) {
        add(outboundLeads, l.e_post, l.kontaktperson, l.firmanavn, l.kilde || '', l.status || '')
      }
    }
    for (const r of ringeliste.data || []) {
      add(ringelisteM, r.e_post, r.navn, r.selskap, r.segment || 'ringeliste', r.status || '')
    }
    const selskapMap = new Map((selskaper.data || []).map((s: any) => [s.id, s]))
    for (const k of (kontakter.data || []) as any[]) {
      const s = k.selskap_id ? selskapMap.get(k.selskap_id) : null
      add(kontakterM, k.e_post, k.navn, s?.firmanavn || '', 'kontakt', s?.kundestatus || '')
      if (s && (s.kundestatus === 'Live' || s.kundestatus === 'Pilot')) {
        add(kunderLive, k.e_post, k.navn, s.firmanavn, 'kunde', s.kundestatus)
      }
    }
    for (const d of deals.data || []) {
      if (['Vunnet', 'Tapt'].includes(d.status || '')) continue
      add(dealsAktive, d.e_post, d.kontaktperson, d.navn, 'salgsmulighet', d.status || '')
    }
    for (const p of partnere.data || []) {
      add(partnereM, p.e_post, p.kontaktperson, p.partnernavn, 'partner', p.partnerstatus || '')
    }

    const segmenter: { navn: string; kontakter: Kontakt[] }[] = [
      { navn: HOVEDLISTE, kontakter: [...alleLeads.values()] },
      { navn: 'Snakk AI – Leads (aktive)', kontakter: [...aktiveLeads.values()] },
      { navn: 'Snakk AI – Leads inbound (nettside)', kontakter: [...nettsideLeads.values()] },
      { navn: 'Snakk AI – Leads outbound', kontakter: [...outboundLeads.values()] },
      { navn: 'Snakk AI – Ringeliste', kontakter: [...ringelisteM.values()] },
      { navn: 'Snakk AI – Kontakter', kontakter: [...kontakterM.values()] },
      { navn: 'Snakk AI – Kunder (Live/Pilot)', kontakter: [...kunderLive.values()] },
      { navn: 'Snakk AI – Aktive salgsmuligheter', kontakter: [...dealsAktive.values()] },
      { navn: 'Snakk AI – Partnere', kontakter: [...partnereM.values()] },
    ]

    const resultat: Record<string, { liste_id: number; antall: number }> = {}
    let hovedlisteId = 0
    for (const seg of segmenter) {
      const listId = await finnEllerOpprettListe(folderId, seg.navn)
      if (seg.navn === HOVEDLISTE) hovedlisteId = listId
      if (seg.kontakter.length) await importer(listId, seg.kontakter)
      resultat[seg.navn] = { liste_id: listId, antall: seg.kontakter.length }
    }

    const malId = await sikreMal()

    await supabase.from('app_settings').upsert(
      [
        { key: 'brevo_list_id', value: String(hovedlisteId) },
        { key: 'brevo_folder_id', value: String(folderId) },
        ...(malId ? [{ key: 'brevo_template_id', value: String(malId) }] : []),
      ],
      { onConflict: 'key' },
    )

    const totalt = Object.values(resultat).reduce((a, b) => a + b.antall, 0)
    return json({
      liste_id: hovedlisteId,
      folder_id: folderId,
      mal_id: malId,
      antall_importert: resultat[HOVEDLISTE]?.antall ?? 0,
      antall_totalt: totalt,
      lister: resultat,
    })
  } catch (e) {
    console.error('brevo-setup error', e)
    return json({ error: e instanceof Error ? e.message : 'Ukjent feil' }, 500)
  }
})
