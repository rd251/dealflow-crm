import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const body = await req.json()
    const {
      prosjekt_id,
      svar,
      kontakt_navn,
      kontakt_epost,
      firmanavn,
      filer,
    } = body || {}

    // Basic validation
    if (!kontakt_navn || typeof kontakt_navn !== 'string' || kontakt_navn.length > 200) {
      return json({ error: 'Invalid kontakt_navn' }, 400)
    }
    if (!kontakt_epost || typeof kontakt_epost !== 'string' || kontakt_epost.length > 200 || !kontakt_epost.includes('@')) {
      return json({ error: 'Invalid kontakt_epost' }, 400)
    }
    if (!firmanavn || typeof firmanavn !== 'string' || firmanavn.length > 300) {
      return json({ error: 'Invalid firmanavn' }, 400)
    }
    if (!svar || typeof svar !== 'object') {
      return json({ error: 'Invalid svar' }, 400)
    }
    const filerArr = Array.isArray(filer) ? filer.filter((f) => typeof f === 'string').slice(0, 50) : []

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { error: insertErr } = await sb.from('onboarding_svar').insert({
      prosjekt_id: prosjekt_id || null,
      svar,
      kontakt_navn,
      kontakt_epost,
      firmanavn,
      filer: filerArr,
    })
    if (insertErr) {
      console.error('Insert error:', insertErr)
      return json({ error: 'Could not save submission' }, 500)
    }

    if (prosjekt_id) {
      await sb.from('prosjekter').update({ status: 'Skjema mottatt' }).eq('id', prosjekt_id)
      const { data: proj } = await sb.from('prosjekter').select('ansvarlig').eq('id', prosjekt_id).maybeSingle()
      if (proj?.ansvarlig) {
        const { data: profiles } = await sb.from('profiles').select('user_id').eq('display_name', proj.ansvarlig)
        if (profiles?.[0]) {
          await sb.from('varsler').insert({
            user_id: profiles[0].user_id,
            tittel: 'Onboarding-skjema fylt ut',
            beskrivelse: `${firmanavn} har fylt ut onboarding-skjemaet.`,
            type: 'onboarding',
            lenke: '/prosjekter',
          })
        }
      }
    }

    return json({ ok: true })
  } catch (e) {
    console.error('submit-onboarding error:', e)
    return json({ error: 'Internal server error' }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
