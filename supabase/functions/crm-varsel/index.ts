// SLÅTT AV 22.11.2026: interne auto-e-poster (nytt lead, oppgave tildelt, deal vunnet,
// kontrakt signert, lead konvertert, kunde live, prosjekt tildelt) sendes ikke lenger.
// Endepunktet beholdes slik at eldre kall (lead-intake, meta-lead-worker, appen) får et
// raskt, trygt svar og aldri blokkerer leadregistrering. Det leser og sender ingenting.
import { autoEpostAvslattSvar } from '../_shared/auto-epost-stopp.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  return autoEpostAvslattSvar('crm-varsel')
})
