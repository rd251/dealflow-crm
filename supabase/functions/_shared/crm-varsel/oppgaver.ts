import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { TOM_OPPGAVEOVERSIKT, type OppgaveLinje, type OppgaveOversikt } from './mal.ts'

/** Antall dager framover som regnes som «denne uken» i mini-oversikten. */
export const DENNE_UKEN_DAGER = 7
/** Maks antall oppgaver som listes per bolk, slik at e-posten holder seg lesbar. */
export const MAKS_PER_BOLK = 5

export function iDag(): string {
  return new Date().toISOString().split('T')[0]
}

function omDager(dager: number): string {
  const d = new Date()
  d.setDate(d.getDate() + dager)
  return d.toISOString().split('T')[0]
}

function norskDato(dato: string): string {
  const [aar, mnd, dag] = dato.split('-')
  return `${dag}.${mnd}.${aar}`
}

function tilLinje(o: any, selskapNavn?: string | null): OppgaveLinje {
  const detaljer = [o.frist ? `frist ${norskDato(o.frist)}` : null, selskapNavn || null, o.prioritet === 'Høy' ? 'høy prioritet' : null]
    .filter(Boolean)
    .join(' · ')
  return {
    tekst: o.oppgave,
    detalj: detaljer || null,
    lenke: o.salgsmulighet_id ? `/salgsmuligheter?open=${o.salgsmulighet_id}` : '/oppgaver',
  }
}

/** Henter forfalte oppgaver, oppgaver i dag og oppgaver denne uken for én bruker. */
export async function hentOppgaveOversikt(supabase: SupabaseClient, userId: string | null): Promise<OppgaveOversikt> {
  if (!userId) return TOM_OPPGAVEOVERSIKT
  const dagensDato = iDag()
  const ukeSlutt = omDager(DENNE_UKEN_DAGER)

  const { data, error } = await supabase
    .from('oppgaver')
    .select('id, oppgave, frist, prioritet, status, selskap_id, salgsmulighet_id')
    .or(`ansvarlig.eq.${userId},user_id.eq.${userId}`)
    .neq('status', 'Ferdig')
    .not('frist', 'is', null)
    .lte('frist', ukeSlutt)
    .order('frist', { ascending: true })

  if (error) {
    console.error('Kunne ikke hente oppgaveoversikt', { code: error.code, message: error.message })
    return TOM_OPPGAVEOVERSIKT
  }

  const rader = data || []
  const selskapIder = Array.from(new Set(rader.map(r => r.selskap_id).filter(Boolean))) as string[]
  const selskapNavn = new Map<string, string>()
  if (selskapIder.length > 0) {
    const { data: selskaper } = await supabase.from('selskaper').select('id, firmanavn').in('id', selskapIder)
    for (const s of selskaper || []) selskapNavn.set(s.id, s.firmanavn)
  }

  const linje = (r: any) => tilLinje(r, r.selskap_id ? selskapNavn.get(r.selskap_id) : null)

  return {
    forfalt: rader.filter(r => r.frist! < dagensDato).slice(0, MAKS_PER_BOLK).map(linje),
    idag: rader.filter(r => r.frist === dagensDato).slice(0, MAKS_PER_BOLK).map(linje),
    denneUken: rader.filter(r => r.frist! > dagensDato).slice(0, MAKS_PER_BOLK).map(linje),
  }
}

/** Alle forfalte oppgaver for en bruker – brukes av det daglige forfalt-varselet. */
export async function hentForfalteOppgaver(supabase: SupabaseClient, userId: string) {
  const dagensDato = iDag()
  const { data, error } = await supabase
    .from('oppgaver')
    .select('id, oppgave, frist, prioritet, status, selskap_id, salgsmulighet_id')
    .or(`ansvarlig.eq.${userId},user_id.eq.${userId}`)
    .neq('status', 'Ferdig')
    .not('frist', 'is', null)
    .lt('frist', dagensDato)
    .order('frist', { ascending: true })
  if (error) {
    console.error('Kunne ikke hente forfalte oppgaver', { code: error.code, message: error.message })
    return []
  }
  return data || []
}

export { norskDato, tilLinje }
