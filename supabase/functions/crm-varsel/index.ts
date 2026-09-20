import { createClient } from 'npm:@supabase/supabase-js@2'
import { adminKlient, behandleHendelse, type HendelsePayload, type HendelseType } from '../_shared/crm-varsel/hendelser.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GYLDIGE_HENDELSER: HendelseType[] = [
  'prosjekt_tildelt',
  'oppgave_tildelt',
  'lead_konvertert',
  'deal_vunnet',
  'kontrakt_signert',
  'kunde_live',
]

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Ikke autorisert' }, 401)

  const bruker = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userError } = await bruker.auth.getUser()
  if (userError || !userData?.user) return json({ error: 'Ikke autorisert' }, 401)

  let body: HendelsePayload
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Ugyldig JSON' }, 400)
  }

  if (!body?.hendelse || !GYLDIGE_HENDELSER.includes(body.hendelse)) {
    return json({ error: `Ukjent hendelse. Gyldige: ${GYLDIGE_HENDELSER.join(', ')}` }, 400)
  }
  for (const nokkel of ['prosjekt_id', 'oppgave_id', 'salgsmulighet_id', 'selskap_id', 'lead_id'] as const) {
    const verdi = body[nokkel]
    if (verdi !== undefined && verdi !== null && !UUID_RE.test(String(verdi))) {
      return json({ error: `${nokkel} må være en gyldig id` }, 400)
    }
  }

  try {
    const resultater = await behandleHendelse(adminKlient(), {
      ...body,
      // Avsenderen er alltid den innloggede brukeren – aldri klientens påstand.
      utfort_av_user_id: userData.user.id,
    })
    return json({ ok: true, sendt: resultater.filter(r => r.sendt).length, resultater })
  } catch (error) {
    console.error('Varsling feilet', error instanceof Error ? error.message : String(error))
    return json({ error: 'Kunne ikke sende varsel' }, 500)
  }
})
