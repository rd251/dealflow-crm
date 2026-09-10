import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const BREVO_API = 'https://api.brevo.com/v3'
const FOLDER_NAME = 'Snakk AI CRM'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TEST_HINTS = [
  'test@',
  'test.',
  'testing',
  'example.com',
  'example.org',
  'noreply',
  'no-reply',
  'dummy',
  'ingen@',
  'mailinator',
  'yopmail',
  'demo@',
]

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

type Aarsak = 'hard_bounce' | 'blokkert' | 'avmeldt' | 'ugyldig' | 'testadresse'

function testadresse(e: string) {
  return TEST_HINTS.some((t) => e.includes(t))
}

/** Henter alle e-poster med et gitt hendelsesnavn fra transaksjonell logg. */
async function hendelser(event: string): Promise<Set<string>> {
  const funnet = new Set<string>()
  for (let offset = 0; offset < 10000; offset += 1000) {
    let side: any
    try {
      side = await brevo(`/smtp/statistics/events?limit=1000&offset=${offset}&event=${event}`)
    } catch {
      break
    }
    const rader = side?.events || []
    for (const r of rader) if (r.email) funnet.add(String(r.email).toLowerCase())
    if (rader.length < 1000) break
  }
  return funnet
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const body = await req.json().catch(() => ({}))
    const tørrkjøring: boolean = body.dry_run === true

    // Finn mappen og alle listene våre
    const mapper = await brevo('/contacts/folders?limit=50&offset=0')
    const mappe = (mapper?.folders || []).find((f: any) => f.name === FOLDER_NAME)
    if (!mappe) return json({ error: 'Fant ingen Brevo-mappe for Snakk AI' }, 404)

    const listerRes = await brevo(`/contacts/folders/${mappe.id}/lists?limit=50&offset=0`)
    const lister: { id: number; name: string }[] = listerRes?.lists || []

    // Kampanje-/testresultater: harde bounces, blokkerte og avmeldte
    const [harde, blokkerteHendelser, avmeldteHendelser, ugyldige] = await Promise.all([
      hendelser('hardBounces'),
      hendelser('blocked'),
      hendelser('unsubscribed'),
      hendelser('invalid'),
    ])

    const funn = new Map<string, { aarsak: Aarsak; lister: string[] }>()
    const perListe: Record<string, number> = {}

    const merk = (e: string, aarsak: Aarsak, listeNavn: string) => {
      const eksisterende = funn.get(e)
      if (eksisterende) {
        if (!eksisterende.lister.includes(listeNavn)) eksisterende.lister.push(listeNavn)
        return
      }
      funn.set(e, { aarsak, lister: [listeNavn] })
    }

    for (const liste of lister) {
      perListe[liste.name] = 0
      for (let offset = 0; offset < 20000; offset += 500) {
        let side: any
        try {
          side = await brevo(`/contacts/lists/${liste.id}/contacts?limit=500&offset=${offset}`)
        } catch {
          break
        }
        const rader = side?.contacts || []
        for (const c of rader) {
          const e = String(c.email || '').toLowerCase().trim()
          if (!e) continue
          let aarsak: Aarsak | null = null
          if (!EMAIL_RE.test(e) || ugyldige.has(e)) aarsak = 'ugyldig'
          else if (harde.has(e)) aarsak = 'hard_bounce'
          else if (c.emailBlacklisted === true || blokkerteHendelser.has(e)) aarsak = 'blokkert'
          else if (avmeldteHendelser.has(e) || c.listUnsubscribed === true) aarsak = 'avmeldt'
          else if (testadresse(e)) aarsak = 'testadresse'
          if (!aarsak) continue
          merk(e, aarsak, liste.name)
          perListe[liste.name] += 1
        }
        if (rader.length < 500) break
      }
    }

    const adresser = [...funn.keys()]

    if (!tørrkjøring && adresser.length) {
      // Slett kontaktene helt ut av Brevo
      for (const e of adresser) {
        await brevo(`/contacts/${encodeURIComponent(e)}`, { method: 'DELETE' }).catch((err) =>
          console.error('Kunne ikke slette kontakt', e, err),
        )
      }
      // Blokker dem lokalt så de ikke importeres inn igjen
      for (let i = 0; i < adresser.length; i += 200) {
        const batch = adresser.slice(i, i + 200).map((e_post) => ({ e_post }))
        const { error } = await supabase
          .from('nyhetsbrev_avmeldte')
          .upsert(batch, { onConflict: 'e_post', ignoreDuplicates: true })
        if (error) console.error('Kunne ikke lagre avmeldte', error)
      }
    }

    const perAarsak: Record<string, number> = {}
    for (const { aarsak } of funn.values()) perAarsak[aarsak] = (perAarsak[aarsak] || 0) + 1

    return json({
      dry_run: tørrkjøring,
      antall_lister: lister.length,
      antall_fjernet: adresser.length,
      per_aarsak: perAarsak,
      per_liste: perListe,
      adresser: adresser.slice(0, 200),
    })
  } catch (e) {
    console.error('brevo-rens-lister error', e)
    return json({ error: e instanceof Error ? e.message : 'Ukjent feil' }, 500)
  }
})
