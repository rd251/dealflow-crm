import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendTemplateEmailWithLog } from '../_shared/transactional-email-templates/send-and-log.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Ikke autentisert' }, 401)

  const supabaseAnon = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user } } = await supabaseAnon.auth.getUser()
  if (!user) return json({ error: 'Ikke autentisert' }, 401)

  let body: Record<string, any>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Ugyldig forespørsel' }, 400)
  }

  const dealId = typeof body.dealId === 'string' ? body.dealId : ''
  const partnerId = typeof body.partnerId === 'string' ? body.partnerId : ''
  const internMelding = typeof body.internMelding === 'string' ? body.internMelding.slice(0, 5000) : ''

  if (!dealId || !partnerId) return json({ error: 'Mangler salgsmulighet eller partner' }, 400)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: sm } = await supabase.from('salgsmuligheter').select('*').eq('id', dealId).maybeSingle()
  if (!sm) return json({ error: 'Fant ikke salgsmulighet' }, 404)

  const { data: partner } = await supabase
    .from('partnere')
    .select('id, partnernavn, e_post')
    .eq('id', partnerId)
    .maybeSingle()
  if (!partner?.e_post) return json({ error: 'Partneren mangler e-postadresse' }, 400)

  let firmanavn = ''
  if (sm.selskap_id) {
    const { data: selskap } = await supabase
      .from('selskaper')
      .select('firmanavn')
      .eq('id', sm.selskap_id)
      .maybeSingle()
    firmanavn = selskap?.firmanavn || ''
  }

  const today = new Date().toISOString().split('T')[0]

  try {
    const result = await sendTemplateEmailWithLog('deal-forwarded-to-partner', partner.e_post, {
      idempotencyKey: `deal-forward-${sm.id}-${partner.id}-${today}`,
      templateData: {
        partner_navn: partner.partnernavn,
        deal_navn: sm.navn,
        selskap_firmanavn: firmanavn,
        kontaktperson: sm.kontaktperson,
        kontakt_epost: sm.e_post,
        kontakt_telefon: sm.telefon,
        kontakt_rolle: sm.rolle_i_firma,
        status: sm.status,
        kilde: sm.kilde,
        use_case: sm.use_case,
        notater: sm.notater,
        forventet_mrr: sm.forventet_mrr,
        oppstartskostnad: sm.oppstartskostnad,
        kontraktslengde_mnd: sm.kontraktslengde_mnd,
        forventet_lukkedato: sm.forventet_lukkedato,
        neste_steg: sm.neste_steg,
        videresendt_av: user.email || 'Snakk',
        intern_melding: internMelding,
      },
    })

    if (!result.sent) {
      return json({ success: false, reason: 'recipient_suppressed' })
    }
    return json({ success: true })
  } catch (error) {
    console.error('Kunne ikke sende salgsmulighet-videresending', {
      message: error instanceof Error ? error.message : String(error),
    })
    return json({ error: 'Kunne ikke sende e-post' }, 500)
  }
})
