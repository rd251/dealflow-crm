import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const BREVO_API = 'https://api.brevo.com/v3'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TEST_HINTS = ['test@', 'test.', 'example.com', 'noreply', 'no-reply', 'dummy', 'ingen@', 'mailinator', 'yopmail']

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => ({}))
    const record = body?.record ?? body
    const epost = (record?.e_post || '').trim().toLowerCase()
    if (!gyldig(epost)) return json({ skipped: true, reason: 'Ugyldig eller filtrert e-post' })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: setting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'brevo_list_id')
      .maybeSingle()

    const listId = setting?.value ? Number(setting.value) : null
    if (!listId) return json({ skipped: true, reason: 'Brevo-liste er ikke satt opp ennå' })

    const lovableKey = Deno.env.get('LOVABLE_API_KEY')
    const connectionKey = Deno.env.get('BREVO_API_KEY')
    if (!lovableKey || !connectionKey) throw new Error('Brevo-nøkler mangler')

    const res = await fetch(`${GATEWAY}/v3/contacts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        'X-Connection-Api-Key': connectionKey,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        email: epost,
        updateEnabled: true,
        listIds: [listId],
        attributes: {
          FIRSTNAME: (record?.kontaktperson || '').trim().split(' ')[0] || '',
          COMPANY: (record?.firmanavn || '').trim(),
        },
      }),
    })
    const text = await res.text()
    if (!res.ok) {
      console.error(`Brevo contacts failed [${res.status}]: ${text}`)
      return json({ error: 'Brevo-kall feilet', status: res.status, details: text }, res.status)
    }

    return json({ ok: true, liste_id: listId, e_post: epost })
  } catch (e) {
    console.error('brevo-sync-lead error', e)
    return json({ error: e instanceof Error ? e.message : 'Ukjent feil' }, 500)
  }
})
