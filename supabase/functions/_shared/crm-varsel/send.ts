import { createClient } from 'npm:@supabase/supabase-js@2'
import { byggHtml, byggTekst, emne, type VarselInnhold } from './mal.ts'

// Interne driftsvarsler sendes via Brevos transaksjons-API. Disse e-postene er
// ikke markedsføring og skal derfor ikke ha avmeldingslenke.
const AVSENDER = { name: 'Snakk CRM', email: 'rd@snakk.ai' }
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'

export interface VarselMottaker {
  epost: string
  navn?: string | null
}

export type SendVarselResultat =
  | { sendt: true; mottaker: string }
  | { sendt: false; mottaker: string; feil: string }

function admin() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
}

async function logg(malNavn: string, mottaker: string, status: string, feilmelding?: string) {
  const { error } = await admin().from('email_send_log').insert({
    message_id: null,
    template_name: malNavn,
    recipient_email: mottaker,
    status,
    error_message: feilmelding ? feilmelding.slice(0, 1000) : null,
  })
  if (error) {
    console.error('Kunne ikke skrive email_send_log', { code: error.code, message: error.message, malNavn, status })
  }
}

/** Sender ett internt varsel til én mottaker. Kaster aldri – returnerer resultatet. */
export async function sendVarsel(
  malNavn: string,
  mottaker: VarselMottaker,
  innhold: VarselInnhold,
): Promise<SendVarselResultat> {
  const apiKey = Deno.env.get('BREVO_DIRECT_API_KEY') || Deno.env.get('BREVO_API_KEY')
  if (!apiKey) {
    const feil = 'BREVO_DIRECT_API_KEY mangler'
    console.error(feil)
    await logg(malNavn, mottaker.epost, 'failed', feil)
    return { sendt: false, mottaker: mottaker.epost, feil }
  }

  try {
    const res = await fetch(BREVO_URL, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: AVSENDER,
        to: [{ email: mottaker.epost, name: mottaker.navn || undefined }],
        subject: emne(innhold),
        htmlContent: byggHtml(innhold),
        textContent: byggTekst(innhold),
      }),
    })

    if (!res.ok) {
      const tekst = (await res.text()).slice(0, 500)
      console.error('Brevo avviste varselet', { status: res.status, malNavn })
      await logg(malNavn, mottaker.epost, 'failed', `Brevo ${res.status}: ${tekst}`)
      return { sendt: false, mottaker: mottaker.epost, feil: `Brevo ${res.status}` }
    }

    await logg(malNavn, mottaker.epost, 'sent')
    return { sendt: true, mottaker: mottaker.epost }
  } catch (error) {
    const melding = error instanceof Error ? error.message : String(error)
    console.error('Klarte ikke sende varsel', { malNavn, melding })
    await logg(malNavn, mottaker.epost, 'failed', melding)
    return { sendt: false, mottaker: mottaker.epost, feil: melding }
  }
}

/** Sender samme varsel til flere mottakere, med individuell oppgaveoversikt. */
export async function sendVarslerTil(
  malNavn: string,
  mottakere: VarselMottaker[],
  byggInnhold: (mottaker: VarselMottaker) => Promise<VarselInnhold> | VarselInnhold,
): Promise<SendVarselResultat[]> {
  const resultater: SendVarselResultat[] = []
  const sett = new Set<string>()
  for (const m of mottakere) {
    const nokkel = m.epost.trim().toLowerCase()
    if (!nokkel || sett.has(nokkel)) continue
    sett.add(nokkel)
    resultater.push(await sendVarsel(malNavn, m, await byggInnhold(m)))
  }
  return resultater
}
