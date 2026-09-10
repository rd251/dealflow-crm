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

  const leadId = typeof body.leadId === 'string' ? body.leadId : ''
  const partnerId = typeof body.partnerId === 'string' ? body.partnerId : ''
  const internMelding = typeof body.internMelding === 'string' ? body.internMelding.slice(0, 5000) : ''
  const harByggeagent = Boolean(body.harByggeagent)
  const onboardingOppsummering =
    typeof body.onboardingOppsummering === 'string' ? body.onboardingOppsummering.slice(0, 5000) : ''

  if (!leadId || !partnerId) return json({ error: 'Mangler lead eller partner' }, 400)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).maybeSingle()
  if (!lead) return json({ error: 'Fant ikke lead' }, 404)

  const { data: partner } = await supabase
    .from('partnere')
    .select('id, partnernavn, e_post')
    .eq('id', partnerId)
    .maybeSingle()
  if (!partner?.e_post) return json({ error: 'Partneren mangler e-postadresse' }, 400)

  const today = new Date().toISOString().split('T')[0]

  try {
    const result = await sendTemplateEmailWithLog('lead-forwarded-to-partner', partner.e_post, {
      idempotencyKey: `lead-forward-${lead.id}-${partner.id}-${today}`,
      templateData: {
        partner_navn: partner.partnernavn,
        lead_firmanavn: lead.firmanavn,
        lead_kontaktperson: lead.kontaktperson,
        lead_epost: lead.e_post,
        lead_telefon: lead.telefon,
        lead_rolle: lead.rolle_i_firma,
        lead_kilde: lead.kilde,
        lead_use_case: lead.use_case,
        lead_notater: lead.notater,
        har_byggeagent: harByggeagent,
        onboarding_oppsummering: onboardingOppsummering,
        videresendt_av: user.email || 'Snakk',
        intern_melding: internMelding,
      },
    })

    if (!result.sent) {
      return json({ success: false, reason: 'recipient_suppressed' })
    }
    return json({ success: true })
  } catch (error) {
    console.error('Kunne ikke sende lead-videresending', {
      message: error instanceof Error ? error.message : String(error),
    })
    return json({ error: 'Kunne ikke sende e-post' }, 500)
  }
})
