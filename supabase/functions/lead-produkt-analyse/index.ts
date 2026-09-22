// Bakgrunnsjobb: leser notatene på leads og lagrer hvilke produkter de er ute etter.
// Kjører i små porsjoner, med lås så to kjøringer aldri overlapper.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { vurderProduktInteresse, ProduktAiStopp } from '../_shared/lead-produkt.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BATCH_STORRELSE = 20
const LAS_MINUTTER = 10
const LAS_NOKKEL = 'lead_produkt_analyse_las'
const PAUSE_NOKKEL = 'lead_produkt_analyse_pause'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const supabase = createClient(url, key)

  let leadIds: string[] | null = null
  try {
    const body = await req.json()
    if (Array.isArray(body?.lead_ids)) leadIds = body.lead_ids.map((s: unknown) => String(s)).slice(0, BATCH_STORRELSE)
  } catch { /* tomt body er ok */ }

  const svar = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  // Pauset etter tidligere stopp fra AI-gatewayen?
  const { data: pause } = await supabase.from('app_settings').select('value').eq('key', PAUSE_NOKKEL).maybeSingle()
  if (pause?.value) return svar({ pauset: pause.value, behandlet: 0 })

  // Enkel lås: én kjøring om gangen.
  const na = new Date()
  const { data: las } = await supabase.from('app_settings').select('value').eq('key', LAS_NOKKEL).maybeSingle()
  if (las?.value && new Date(las.value) > na) return svar({ hoppet_over: 'kjører allerede', behandlet: 0 })
  await supabase.from('app_settings').upsert({
    key: LAS_NOKKEL,
    value: new Date(na.getTime() + LAS_MINUTTER * 60000).toISOString(),
  })

  try {
    let q = supabase
      .from('leads')
      .select('id, firmanavn, kontaktperson, notater, use_case, kilde, produkt_analysert_at, updated_at')
      .limit(BATCH_STORRELSE)
    if (leadIds) q = q.in('id', leadIds)
    else q = q.is('produkt_analysert_at', null).order('created_at', { ascending: false })

    const { data: leads, error } = await q
    if (error) return svar({ error: error.message }, 500)

    let behandlet = 0
    let pauset: string | null = null

    for (const lead of leads || []) {
      const tekst = [lead.notater, lead.use_case].filter(Boolean).join('\n').trim()
      if (!tekst) {
        await supabase.from('leads')
          .update({ produkt_interesse: [], produkt_oppsummering: null, produkt_analysert_at: new Date().toISOString() })
          .eq('id', lead.id)
        continue
      }
      try {
        const vurdering = await vurderProduktInteresse(
          `Firma: ${lead.firmanavn}\nKilde: ${lead.kilde || 'ukjent'}\n\n${tekst}`,
        )
        if (!vurdering) continue
        await supabase.from('leads').update({
          produkt_interesse: vurdering.produkter,
          produkt_oppsummering: vurdering.oppsummering || null,
          produkt_analysert_at: new Date().toISOString(),
        }).eq('id', lead.id)
        behandlet++
      } catch (e) {
        if (e instanceof ProduktAiStopp) {
          pauset = `AI-gateway svarte ${e.status}`
          await supabase.from('app_settings').upsert({ key: PAUSE_NOKKEL, value: pauset })
          break
        }
        console.error('lead-produkt-analyse feil', lead.id, e)
      }
    }

    return svar({ behandlet, antall: (leads || []).length, pauset })
  } finally {
    await supabase.from('app_settings').upsert({ key: LAS_NOKKEL, value: new Date(0).toISOString() })
  }
})
