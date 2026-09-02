import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const BREVO_API = 'https://api.brevo.com/v3'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TEST_HINTS = ['test@', 'test.', 'example.com', 'noreply', 'no-reply', 'dummy', 'ingen@', 'mailinator', 'yopmail']
const KALDE_KILDER = ['Kald outbound', 'Instantly kald e-post', 'Kasoleads']

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function gyldig(e?: string | null): boolean {
  const v = (e || '').trim().toLowerCase()
  if (!EMAIL_RE.test(v)) return false
  if (v.endsWith('@snakk.ai')) return false
  return !TEST_HINTS.some((t) => v.includes(t))
}

const fornavn = (n?: string | null) => (n || '').trim().split(' ')[0] || ''

interface Resultat {
  epost: string
  keys: string[]
  FIRSTNAME: string
  COMPANY: string
  KILDE: string
  STATUS: string
}

async function bygg(
  supabase: ReturnType<typeof createClient>,
  table: string,
  r: any,
): Promise<Resultat | null> {
  if (table === 'leads') {
    const kilde = r.kilde || ''
    const keys = ['alle_leads']
    if (r.status !== 'Ikke aktuelt') keys.push('leads_aktive')
    if (kilde === 'Nettside' || kilde === 'Organisk') keys.push('inbound_nettside')
    if (kilde === 'Facebook ads') keys.push('facebook')
    if (kilde === 'Google ads') keys.push('google_ads')
    if (KALDE_KILDER.includes(kilde)) keys.push('outbound')
    else keys.push('alle')
    return {
      epost: r.e_post,
      keys,
      FIRSTNAME: fornavn(r.kontaktperson),
      COMPANY: (r.firmanavn || '').trim(),
      KILDE: kilde,
      STATUS: r.status || '',
    }
  }
  if (table === 'kontakter') {
    let firma = ''
    let kundestatus = ''
    if (r.selskap_id) {
      const { data } = await supabase
        .from('selskaper')
        .select('firmanavn, kundestatus')
        .eq('id', r.selskap_id)
        .maybeSingle()
      firma = (data as any)?.firmanavn || ''
      kundestatus = (data as any)?.kundestatus || ''
    }
    const keys = ['kontakter', 'alle']
    if (kundestatus === 'Live' || kundestatus === 'Pilot') keys.push('kunder')
    return {
      epost: r.e_post,
      keys,
      FIRSTNAME: fornavn(r.navn),
      COMPANY: firma,
      KILDE: 'kontakt',
      STATUS: kundestatus,
    }
  }
  if (table === 'salgsmuligheter') {
    const keys = ['alle']
    if (!['Vunnet', 'Tapt'].includes(r.status || '')) keys.push('deals_aktive')
    return {
      epost: r.e_post,
      keys,
      FIRSTNAME: fornavn(r.kontaktperson),
      COMPANY: (r.navn || '').trim(),
      KILDE: 'salgsmulighet',
      STATUS: r.status || '',
    }
  }
  if (table === 'partnere') {
    return {
      epost: r.e_post,
      keys: ['partnere', 'alle'],
      FIRSTNAME: fornavn(r.kontaktperson),
      COMPANY: (r.partnernavn || '').trim(),
      KILDE: 'partner',
      STATUS: r.partnerstatus || '',
    }
  }
  if (table === 'ringeliste') {
    return {
      epost: r.e_post,
      keys: ['ringeliste'],
      FIRSTNAME: fornavn(r.navn),
      COMPANY: (r.selskap || '').trim(),
      KILDE: r.segment || 'ringeliste',
      STATUS: r.status || '',
    }
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => ({}))
    const record = body?.record ?? body
    const table: string = body?.table || body?.tabell || 'leads'

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const bygget = await bygg(supabase, table, record)
    if (!bygget) return json({ skipped: true, reason: `Ukjent tabell: ${table}` })

    const epost = (bygget.epost || '').trim().toLowerCase()
    if (!gyldig(epost)) return json({ skipped: true, reason: 'Ugyldig eller filtrert e-post' })

    const { data: avmeldt } = await supabase
      .from('nyhetsbrev_avmeldte')
      .select('id')
      .ilike('e_post', epost)
      .maybeSingle()
    if (avmeldt) return json({ skipped: true, reason: 'Avmeldt' })

    const { data: setting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'brevo_lister')
      .maybeSingle()

    let lister: Record<string, number> = {}
    try {
      lister = setting?.value ? JSON.parse(setting.value as string) : {}
    } catch {
      lister = {}
    }
    const listIds = bygget.keys.map((k) => lister[k]).filter((n): n is number => Number.isFinite(n))
    if (!listIds.length) return json({ skipped: true, reason: 'Brevo-lister er ikke satt opp ennå' })

    const apiKey = Deno.env.get('BREVO_DIRECT_API_KEY')
    if (!apiKey) throw new Error('BREVO_DIRECT_API_KEY is not configured')

    const res = await fetch(`${BREVO_API}/contacts`, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        email: epost,
        updateEnabled: true,
        listIds,
        attributes: {
          FIRSTNAME: bygget.FIRSTNAME,
          COMPANY: bygget.COMPANY,
          KILDE: bygget.KILDE,
          STATUS: bygget.STATUS,
        },
      }),
    })
    const text = await res.text()
    if (!res.ok) {
      console.error(`Brevo contacts failed [${res.status}]: ${text}`)
      return json({ error: 'Brevo-kall feilet', status: res.status, details: text }, res.status)
    }

    return json({ ok: true, tabell: table, liste_ider: listIds, e_post: epost })
  } catch (e) {
    console.error('brevo-sync-lead error', e)
    return json({ error: e instanceof Error ? e.message : 'Ukjent feil' }, 500)
  }
})
