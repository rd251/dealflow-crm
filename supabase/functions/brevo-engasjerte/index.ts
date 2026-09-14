import { createClient } from 'npm:@supabase/supabase-js@2'

const BREVO_API = 'https://api.brevo.com/v3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TEST_HINTS = [
  'test@', 'test.', 'testing', 'example.com', 'example.org', 'noreply',
  'no-reply', 'dummy', 'ingen@', 'mailinator', 'yopmail', 'demo@',
]

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function brevo(path: string) {
  const apiKey = Deno.env.get('BREVO_DIRECT_API_KEY') || Deno.env.get('BREVO_API_KEY')
  if (!apiKey) throw new Error('BREVO_DIRECT_API_KEY is not configured')
  const res = await fetch(`${BREVO_API}${path}`, {
    headers: { 'api-key': apiKey, accept: 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Brevo ${path} -> ${res.status}: ${text.slice(0, 300)}`)
  }
  return await res.json()
}

type Contact = {
  email: string
  emailBlacklisted?: boolean
  listIds?: number[]
}

async function alleKontakter(): Promise<Contact[]> {
  const out: Contact[] = []
  let offset = 0
  const limit = 1000
  while (offset < 50000) {
    const data = await brevo(`/contacts?limit=${limit}&offset=${offset}`)
    const batch: Contact[] = data?.contacts ?? []
    out.push(...batch)
    if (batch.length < limit) break
    offset += limit
  }
  return out
}

type Stat = { email: string; sent: number; opened: number; clicked: number; bounced: number }

function tell(v: unknown): number {
  if (Array.isArray(v)) return v.length
  if (v && typeof v === 'object') {
    return Object.values(v as Record<string, unknown>).reduce<number>((n, x) => n + tell(x), 0)
  }
  return 0
}

async function kontaktStatistikk(email: string): Promise<Stat | null> {
  try {
    const d = await brevo(`/contacts/${encodeURIComponent(email)}`)
    const s = d?.statistics ?? {}
    return {
      email: email.toLowerCase(),
      sent: tell(s.messagesSent),
      opened: tell(s.opened),
      clicked: tell(s.clicked),
      bounced: tell(s.hardBounces),
    }
  } catch {
    return null
  }
}

async function medBegrensning<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>) {
  const results: R[] = []
  let i = 0
  const workers = Array.from({ length: n }, async () => {
    while (i < items.length) {
      const idx = i++
      results[idx] = await fn(items[idx])
    }
  })
  await Promise.all(workers)
  return results
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => ({}))
    const nyhetsbrevId: string | undefined = body.nyhetsbrev_id
    const dryRun: boolean = body.dry_run ?? true
    const kunEngasjerte: boolean = body.kun_engasjerte ?? false

    if (!nyhetsbrevId) return json({ error: 'nyhetsbrev_id mangler' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const [{ data: eksisterende }, { data: avmeldte }] = await Promise.all([
      supabase.from('nyhetsbrev_mottakere').select('e_post').eq('nyhetsbrev_id', nyhetsbrevId),
      supabase.from('nyhetsbrev_avmeldte').select('e_post'),
    ])

    const finnes = new Set((eksisterende ?? []).map((r) => r.e_post.toLowerCase()))
    const blokkert = new Set((avmeldte ?? []).map((r) => r.e_post.toLowerCase()))

    const kontakter = await alleKontakter()

    const kandidater = kontakter
      .map((c) => (c.email || '').toLowerCase().trim())
      .filter((e, idx) => {
        const c = kontakter[idx]
        if (!EMAIL_RE.test(e)) return false
        if (c.emailBlacklisted) return false
        if (blokkert.has(e)) return false
        if (TEST_HINTS.some((h) => e.includes(h))) return false
        return true
      })

    const unike = Array.from(new Set(kandidater))
    const nye = unike.filter((e) => !finnes.has(e))

    const stats = (await medBegrensning(nye, 8, kontaktStatistikk)).filter(Boolean) as Stat[]

    const engasjerte = stats.filter((s) => s.opened > 0 || s.clicked > 0).map((s) => s.email)
    const fikkTidligere = stats
      .filter((s) => s.bounced === 0 && (s.sent > 0 || s.opened > 0 || s.clicked > 0))
      .map((s) => s.email)

    const skalLeggesTil = kunEngasjerte ? engasjerte : Array.from(new Set([...engasjerte, ...fikkTidligere]))

    if (dryRun) {
      return json({
        dry_run: true,
        brevo_kontakter: kontakter.length,
        allerede_mottakere: finnes.size,
        nye_kandidater: nye.length,
        engasjerte: engasjerte.length,
        fikk_tidligere: fikkTidligere.length,
        vil_legges_til: skalLeggesTil.length,
        eksempler: skalLeggesTil.slice(0, 20),
      })
    }

    const engasjertSet = new Set(engasjerte)
    const rader = skalLeggesTil.map((e) => ({
      nyhetsbrev_id: nyhetsbrevId,
      e_post: e,
      kilde: engasjertSet.has(e) ? 'brevo-engasjert' : 'brevo-tidligere',
      status: 'pending',
    }))

    for (let i = 0; i < rader.length; i += 500) {
      const { error } = await supabase.from('nyhetsbrev_mottakere').insert(rader.slice(i, i + 500))
      if (error) throw new Error(error.message)
    }

    const { count } = await supabase
      .from('nyhetsbrev_mottakere')
      .select('id', { count: 'exact', head: true })
      .eq('nyhetsbrev_id', nyhetsbrevId)

    await supabase.from('nyhetsbrev').update({ mottaker_antall: count ?? null }).eq('id', nyhetsbrevId)

    return json({
      lagt_til: rader.length,
      engasjerte: engasjerte.length,
      fikk_tidligere: fikkTidligere.length,
      totalt_mottakere: count ?? null,
    })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
