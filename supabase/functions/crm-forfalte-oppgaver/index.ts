import { adminKlient, sendForfalteOppgaver } from '../_shared/crm-varsel/hendelser.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Kjøres daglig kl. 08:00 norsk tid av en cron-jobb.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const resultater = await sendForfalteOppgaver(adminKlient())
    return new Response(
      JSON.stringify({ ok: true, sendt: resultater.filter(r => r.sendt).length, totalt: resultater.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Forfalt-varsling feilet', error instanceof Error ? error.message : String(error))
    return new Response(JSON.stringify({ error: 'Kunne ikke sende forfalt-varsler' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
