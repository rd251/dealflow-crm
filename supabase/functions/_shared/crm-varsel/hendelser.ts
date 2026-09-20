import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { TOM_OPPGAVEOVERSIKT, type OppgaveLinje, type VarselInnhold } from './mal.ts'
import { hentForfalteOppgaver, hentOppgaveOversikt, norskDato, tilLinje } from './oppgaver.ts'
import { sendVarsel, sendVarslerTil, type SendVarselResultat, type VarselMottaker } from './send.ts'

/** Får alltid kopi av signerte kontrakter. */
export const KONTRAKT_KOPI_EPOST = 'rd@snakk.ai'

export type HendelseType =
  | 'prosjekt_tildelt'
  | 'oppgave_tildelt'
  | 'lead_konvertert'
  | 'deal_vunnet'
  | 'kontrakt_signert'
  | 'kunde_live'

export interface HendelsePayload {
  hendelse: HendelseType
  prosjekt_id?: string
  oppgave_id?: string
  salgsmulighet_id?: string
  selskap_id?: string
  lead_id?: string
  utfort_av_user_id?: string | null
  signert_av?: string | null
  signert_dato?: string | null
}

export function adminKlient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
}

interface Profil {
  user_id: string
  display_name: string
  email: string
}

async function alleProfiler(supabase: SupabaseClient): Promise<Profil[]> {
  const { data, error } = await supabase.from('profiles').select('user_id, display_name, email')
  if (error) {
    console.error('Kunne ikke hente profiler', { code: error.code, message: error.message })
    return []
  }
  return (data || []) as Profil[]
}

/** «ansvarlig» kan være en bruker-id eller et visningsnavn – vi tåler begge. */
function finnProfil(profiler: Profil[], verdi: string | null | undefined): Profil | undefined {
  if (!verdi) return undefined
  const v = verdi.trim().toLowerCase()
  return profiler.find(p => p.user_id === verdi) || profiler.find(p => (p.display_name || '').toLowerCase() === v)
}

function navnFor(profiler: Profil[], verdi: string | null | undefined): string {
  return finnProfil(profiler, verdi)?.display_name || verdi || '—'
}

function kroner(v: number | null | undefined): string | null {
  if (v === null || v === undefined || Number.isNaN(Number(v)) || Number(v) === 0) return null
  return `${Math.round(Number(v)).toLocaleString('nb-NO').replace(/\u00a0/g, ' ')} kr`
}

function tilMottaker(p: Profil | undefined): VarselMottaker | null {
  if (!p?.email) return null
  return { epost: p.email, navn: p.display_name }
}

async function medOppgaver(
  supabase: SupabaseClient,
  profiler: Profil[],
  mottaker: VarselMottaker,
  base: Omit<VarselInnhold, 'oppgaver'>,
): Promise<VarselInnhold> {
  const profil = profiler.find(p => (p.email || '').toLowerCase() === mottaker.epost.toLowerCase())
  const oppgaver = profil ? await hentOppgaveOversikt(supabase, profil.user_id) : TOM_OPPGAVEOVERSIKT
  return { ...base, oppgaver }
}

/** Behandler én CRM-hendelse og sender de interne varslene den utløser. */
export async function behandleHendelse(
  supabase: SupabaseClient,
  payload: HendelsePayload,
): Promise<SendVarselResultat[]> {
  const profiler = await alleProfiler(supabase)
  const utforer = navnFor(profiler, payload.utfort_av_user_id)

  switch (payload.hendelse) {
    case 'prosjekt_tildelt': {
      if (!payload.prosjekt_id) return []
      const { data: p } = await supabase
        .from('prosjekter')
        .select('id, prosjektnavn, selskap_id, ansvarlig, onboarding_type, timepris, forventet_go_live, integrasjon, notater_ansvarlig, pinned_notat, pinned_notat_av')
        .eq('id', payload.prosjekt_id)
        .maybeSingle()
      if (!p) return []
      const firmanavn = await hentFirmanavn(supabase, p.selskap_id)
      const mottaker = tilMottaker(finnProfil(profiler, p.ansvarlig))
      if (!mottaker) return []
      return sendVarslerTil('crm-prosjekt-tildelt', [mottaker], m =>
        medOppgaver(supabase, profiler, m, {
          emneTittel: `Nytt prosjekt: ${firmanavn}`,
          overskrift: `Nytt prosjekt tildelt deg`,
          underoverskrift: `${p.prosjektnavn} · ${firmanavn}`,
          felter: [
            { label: 'Firma', verdi: firmanavn },
            { label: 'Onboarding-type', verdi: p.onboarding_type },
            { label: 'Timepris', verdi: kroner(p.timepris) },
            { label: 'Forventet go-live', verdi: p.forventet_go_live ? norskDato(p.forventet_go_live) : 'Ikke satt' },
            { label: 'Integrasjon', verdi: p.integrasjon },
            { label: 'Tildelt av', verdi: utforer },
          ],
          pinnedNotat: p.pinned_notat || p.notater_ansvarlig,
          pinnedNotatAv: p.pinned_notat_av || utforer,
          ctaTekst: 'Åpne prosjektet',
          ctaSti: `/prosjekter?open=${p.id}`,
        }),
      )
    }

    case 'oppgave_tildelt': {
      if (!payload.oppgave_id) return []
      const { data: o } = await supabase
        .from('oppgaver')
        .select('id, oppgave, ansvarlig, user_id, frist, prioritet, selskap_id, lead_id, salgsmulighet_id, notater')
        .eq('id', payload.oppgave_id)
        .maybeSingle()
      if (!o) return []
      const mottaker = tilMottaker(finnProfil(profiler, o.ansvarlig || o.user_id))
      if (!mottaker) return []
      const tilknytning = await hentTilknytning(supabase, o)
      return sendVarslerTil('crm-oppgave-tildelt', [mottaker], m =>
        medOppgaver(supabase, profiler, m, {
          emneTittel: `Ny oppgave: ${o.oppgave}`,
          overskrift: 'Ny oppgave tildelt deg',
          underoverskrift: o.oppgave,
          felter: [
            { label: 'Tilknyttet', verdi: tilknytning.navn },
            { label: 'Frist', verdi: o.frist ? norskDato(o.frist) : 'Ingen frist' },
            { label: 'Prioritet', verdi: o.prioritet },
            { label: 'Opprettet av', verdi: utforer },
          ],
          pinnedNotat: o.notater,
          pinnedNotatAv: utforer,
          ctaTekst: 'Åpne oppgaven',
          ctaSti: tilknytning.sti || '/oppgaver',
        }),
      )
    }

    case 'lead_konvertert': {
      if (!payload.salgsmulighet_id) return []
      const { data: sm } = await supabase
        .from('salgsmuligheter')
        .select('id, navn, selskap_id, ansvarlig, kontaktperson, kilde, neste_steg, pinned_notat, pinned_notat_av')
        .eq('id', payload.salgsmulighet_id)
        .maybeSingle()
      if (!sm) return []
      const firmanavn = (await hentFirmanavn(supabase, sm.selskap_id)) || sm.navn
      const mottaker = tilMottaker(finnProfil(profiler, sm.ansvarlig))
      if (!mottaker) return []
      return sendVarslerTil('crm-lead-konvertert', [mottaker], m =>
        medOppgaver(supabase, profiler, m, {
          emneTittel: `Lead konvertert: ${firmanavn}`,
          overskrift: 'Lead er konvertert til salgsmulighet',
          underoverskrift: `${firmanavn} ligger nå i pipeline`,
          felter: [
            { label: 'Firma', verdi: firmanavn },
            { label: 'Kontaktperson', verdi: sm.kontaktperson },
            { label: 'Kilde', verdi: sm.kilde },
            { label: 'Neste steg', verdi: sm.neste_steg },
            { label: 'Konvertert av', verdi: utforer },
          ],
          pinnedNotat: sm.pinned_notat,
          pinnedNotatAv: sm.pinned_notat_av,
          ctaTekst: 'Åpne salgsmuligheten',
          ctaSti: `/salgsmuligheter?open=${sm.id}`,
        }),
      )
    }

    case 'deal_vunnet': {
      if (!payload.salgsmulighet_id) return []
      const { data: sm } = await supabase
        .from('salgsmuligheter')
        .select('id, navn, selskap_id, ansvarlig, forventet_mrr, valgt_pakke')
        .eq('id', payload.salgsmulighet_id)
        .maybeSingle()
      if (!sm) return []
      const firmanavn = (await hentFirmanavn(supabase, sm.selskap_id)) || sm.navn
      const mrr = Number(sm.forventet_mrr || 0)
      const mottakere = profiler.map(tilMottaker).filter(Boolean) as VarselMottaker[]
      return sendVarslerTil('crm-deal-vunnet', mottakere, m =>
        medOppgaver(supabase, profiler, m, {
          emneTittel: `Deal vunnet: ${firmanavn} 🎉`,
          overskrift: `${firmanavn} er vunnet! 🎉`,
          underoverskrift: 'Gratulerer – ny kunde er signert inn i pipeline.',
          felter: [
            { label: 'Firma', verdi: firmanavn },
            { label: 'Pakke', verdi: sm.valgt_pakke },
            { label: 'MRR', verdi: kroner(mrr) },
            { label: 'ARR', verdi: kroner(mrr * 12) },
            { label: 'Ansvarlig', verdi: navnFor(profiler, sm.ansvarlig) },
          ],
          ctaTekst: 'Se dealen',
          ctaSti: `/salgsmuligheter?open=${sm.id}`,
        }),
      )
    }

    case 'kontrakt_signert': {
      if (!payload.salgsmulighet_id) return []
      const { data: sm } = await supabase
        .from('salgsmuligheter')
        .select('id, navn, selskap_id, ansvarlig, forventet_mrr, valgt_pakke, kontrakt_signert_dato')
        .eq('id', payload.salgsmulighet_id)
        .maybeSingle()
      if (!sm) return []
      const firmanavn = (await hentFirmanavn(supabase, sm.selskap_id)) || sm.navn
      const signertDato = payload.signert_dato || sm.kontrakt_signert_dato
      const ansvarlig = tilMottaker(finnProfil(profiler, sm.ansvarlig))
      const mottakere: VarselMottaker[] = [...(ansvarlig ? [ansvarlig] : []), { epost: KONTRAKT_KOPI_EPOST }]
      return sendVarslerTil('crm-kontrakt-signert', mottakere, m =>
        medOppgaver(supabase, profiler, m, {
          emneTittel: `Kontrakt signert: ${firmanavn}`,
          overskrift: 'Kontrakt er signert',
          underoverskrift: `${firmanavn} har signert avtalen.`,
          felter: [
            { label: 'Firma', verdi: firmanavn },
            { label: 'Pakke', verdi: sm.valgt_pakke },
            { label: 'MRR', verdi: kroner(sm.forventet_mrr) },
            { label: 'Signert av', verdi: payload.signert_av },
            { label: 'Signert dato', verdi: signertDato ? norskDato(String(signertDato).split('T')[0]) : null },
          ],
          ctaTekst: 'Åpne salgsmuligheten',
          ctaSti: `/salgsmuligheter?open=${sm.id}`,
        }),
      )
    }

    case 'kunde_live': {
      if (!payload.selskap_id) return []
      const { data: s } = await supabase
        .from('selskaper')
        .select('id, firmanavn, kundeansvarlig, go_live_dato')
        .eq('id', payload.selskap_id)
        .maybeSingle()
      if (!s) return []
      const { data: p } = payload.prosjekt_id
        ? await supabase.from('prosjekter').select('ansvarlig').eq('id', payload.prosjekt_id).maybeSingle()
        : { data: null as any }
      const { data: pakke } = await supabase
        .from('salgsmuligheter')
        .select('valgt_pakke')
        .eq('selskap_id', s.id)
        .eq('status', 'Vunnet')
        .order('vunnet_dato', { ascending: false })
        .limit(1)
        .maybeSingle()
      const mottaker = tilMottaker(finnProfil(profiler, s.kundeansvarlig))
      if (!mottaker) return []
      return sendVarslerTil('crm-kunde-live', [mottaker], m =>
        medOppgaver(supabase, profiler, m, {
          emneTittel: `Kunde live: ${s.firmanavn}`,
          overskrift: `${s.firmanavn} er nå live 🚀`,
          underoverskrift: 'Onboardingen er fullført og kunden er satt i drift.',
          felter: [
            { label: 'Firma', verdi: s.firmanavn },
            { label: 'Pakke', verdi: pakke?.valgt_pakke },
            { label: 'Go-live dato', verdi: s.go_live_dato ? norskDato(s.go_live_dato) : null },
            { label: 'Prosjektansvarlig', verdi: p?.ansvarlig ? navnFor(profiler, p.ansvarlig) : null },
            { label: 'Satt live av', verdi: utforer },
          ],
          ctaTekst: 'Åpne kunden',
          ctaSti: `/selskaper/${s.id}`,
        }),
      )
    }

    default:
      return []
  }
}

async function hentFirmanavn(supabase: SupabaseClient, selskapId: string | null | undefined): Promise<string> {
  if (!selskapId) return ''
  const { data } = await supabase.from('selskaper').select('firmanavn').eq('id', selskapId).maybeSingle()
  return data?.firmanavn || ''
}

async function hentTilknytning(supabase: SupabaseClient, o: any): Promise<{ navn: string; sti: string }> {
  if (o.selskap_id) {
    const navn = await hentFirmanavn(supabase, o.selskap_id)
    return { navn: navn || 'Selskap', sti: `/selskaper/${o.selskap_id}` }
  }
  if (o.salgsmulighet_id) {
    const { data } = await supabase.from('salgsmuligheter').select('navn').eq('id', o.salgsmulighet_id).maybeSingle()
    return { navn: data?.navn || 'Salgsmulighet', sti: `/salgsmuligheter?open=${o.salgsmulighet_id}` }
  }
  if (o.lead_id) {
    const { data } = await supabase.from('leads').select('firmanavn').eq('id', o.lead_id).maybeSingle()
    return { navn: data?.firmanavn || 'Lead', sti: `/leads?open=${o.lead_id}` }
  }
  return { navn: 'Ingen kobling', sti: '/oppgaver' }
}

/** Daglig varsel om forfalte oppgaver til hver ansvarlig. */
export async function sendForfalteOppgaver(supabase: SupabaseClient): Promise<SendVarselResultat[]> {
  const profiler = await alleProfiler(supabase)
  const resultater: SendVarselResultat[] = []

  for (const profil of profiler) {
    if (!profil.email) continue
    const forfalte = await hentForfalteOppgaver(supabase, profil.user_id)
    if (forfalte.length === 0) continue

    const selskapIder = Array.from(new Set(forfalte.map(f => f.selskap_id).filter(Boolean))) as string[]
    const navn = new Map<string, string>()
    if (selskapIder.length > 0) {
      const { data } = await supabase.from('selskaper').select('id, firmanavn').in('id', selskapIder)
      for (const s of data || []) navn.set(s.id, s.firmanavn)
    }
    const linjer: OppgaveLinje[] = forfalte.map(f => tilLinje(f, f.selskap_id ? navn.get(f.selskap_id) : null))
    const oppgaver = await hentOppgaveOversikt(supabase, profil.user_id)

    resultater.push(
      await sendVarsel(
        'crm-forfalte-oppgaver',
        { epost: profil.email, navn: profil.display_name },
        {
          emneTittel: `${forfalte.length} forfalte ${forfalte.length === 1 ? 'oppgave' : 'oppgaver'}`,
          overskrift: `Du har ${forfalte.length} ${forfalte.length === 1 ? 'forfalt oppgave' : 'forfalte oppgaver'}`,
          underoverskrift: 'Disse har passert fristen og venter på deg.',
          felter: [],
          ctaTekst: 'Åpne oppgavelisten',
          ctaSti: '/oppgaver',
          hovedliste: { tittel: 'Forfalte oppgaver', linjer },
          oppgaver,
        },
      ),
    )
  }

  return resultater
}
