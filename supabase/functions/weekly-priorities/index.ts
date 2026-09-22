import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendTemplateEmailWithLog } from '../_shared/transactional-email-templates/send-and-log.ts'
import { rangerAgenda, AgendaAiError, type AgendaPunkt } from '../_shared/agenda-ai.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const APP_URL = 'https://snakk-ai.lovable.app'
const MAKS_BRUKERE = 10
const MAKS_PUNKTER = 7
const KALD_DEAL_DAGER = 10
const RISIKO_LUKKEDATO_DAGER = 14

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // dryRun = beregn agenda uten å sende e-post (for testing)
  let dryRun = false
  let kunEpost: string | null = null
  try {
    const body = await req.json()
    dryRun = body?.dryRun === true
    kunEpost = typeof body?.email === 'string' ? body.email : null
  } catch { /* tomt body er ok */ }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const weekAgo = new Date(today.getTime() - 7 * 86400000).toISOString().split('T')[0]
  const inTwoWeeks = new Date(today.getTime() + 14 * 86400000).toISOString().split('T')[0]

  const [
    { data: deals },
    { data: leads },
    { data: partnere },
    { data: prosjekter },
    { data: oppgaver },
    { data: selskaper },
    { data: vunnet },
    { data: tapt },
  ] = await Promise.all([
    supabase.from('salgsmuligheter')
      .select('id, navn, status, forventet_mrr, forventet_lukkedato, sist_aktivitet, neste_steg, kontaktperson, ansvarlig, selskap_id')
      .not('status', 'in', '("Vunnet","Tapt")'),
    supabase.from('leads')
      .select('id, firmanavn, kontaktperson, telefon, e_post, status, neste_steg, neste_oppfolging, sist_aktivitet, ansvarlig, use_case, produkt_interesse, produkt_oppsummering')
      .not('status', 'in', '("Ikke aktuelt","Konvertert til salg","Konvertert til partner")'),
    supabase.from('partnere')
      .select('id, partnernavn, kontaktperson, partnerstatus, pipeline_status, sist_aktivitet, ansvarlig'),
    supabase.from('prosjekter')
      .select('id, prosjektnavn, selskap_id, status, forventet_go_live, go_live_dato, ansvarlig, notater')
      .neq('status', 'Live'),
    supabase.from('oppgaver')
      .select('id, oppgave, frist, prioritet, user_id, selskap_id, salgsmulighet_id, lead_id, notater')
      .neq('status', 'Ferdig').not('frist', 'is', null).lte('frist', inTwoWeeks),
    supabase.from('selskaper').select('id, firmanavn, kundestatus, mrr'),
    supabase.from('salgsmuligheter').select('navn, forventet_mrr, ansvarlig, selskap_id').eq('status', 'Vunnet').gte('vunnet_dato', weekAgo),
    supabase.from('salgsmuligheter').select('navn, forventet_mrr, ansvarlig, tapsaarsak').eq('status', 'Tapt').gte('tapt_dato', weekAgo),
  ])

  const selskapNavn = new Map((selskaper || []).map((s: any) => [s.id, s.firmanavn]))
  const dager = (fra: string | null) => {
    if (!fra) return null
    const d = fra.includes('T') ? fra.split('T')[0] : fra
    return Math.round((new Date(todayStr + 'T00:00:00').getTime() - new Date(d + 'T00:00:00').getTime()) / 86400000)
  }

  // Brukere som faktisk eier kommersielt arbeid
  const userIds = new Set<string>()
  for (const d of deals || []) if (d.ansvarlig) userIds.add(d.ansvarlig)
  for (const l of leads || []) if (l.ansvarlig) userIds.add(l.ansvarlig)
  for (const p of prosjekter || []) if (p.ansvarlig) userIds.add(p.ansvarlig)

  const { data: profiles } = await supabase
    .from('profiles').select('user_id, display_name, email, ukesagenda_aktiv').in('user_id', Array.from(userIds))

  let sent = 0
  const errors: string[] = []
  let aiPauset = false

  const forhandsvisning: unknown[] = []

  for (const profile of (profiles || []).slice(0, MAKS_BRUKERE)) {
    if (!profile.email) continue
    // Personlig av/på for ukesagenda
    if ((profile as any).ukesagenda_aktiv === false && !kunEpost) continue
    if (kunEpost && profile.email !== kunEpost) continue
    const uid = profile.user_id

    const mineDeals = (deals || []).filter((d: any) => d.ansvarlig === uid).map((d: any) => ({
      selskap: selskapNavn.get(d.selskap_id) || d.navn,
      stadium: d.status,
      mrr: d.forventet_mrr,
      kontakt: d.kontaktperson,
      neste_steg: d.neste_steg,
      forventet_lukkedato: d.forventet_lukkedato,
      dager_uten_aktivitet: dager(d.sist_aktivitet),
      lenke: `${APP_URL}/salgsmuligheter?open=${d.id}`,
    }))

    const mineLeads = (leads || []).filter((l: any) => l.ansvarlig === uid).map((l: any) => ({
      firma: l.firmanavn,
      kontakt: l.kontaktperson,
      telefon: l.telefon,
      e_post: l.e_post,
      status: l.status,
      use_case: l.use_case,
      produkt_interesse: (l.produkt_interesse || []).join(', ') || null,
      onsker: l.produkt_oppsummering || null,
      neste_steg: l.neste_steg,
      neste_oppfolging: l.neste_oppfolging,
      dager_uten_aktivitet: dager(l.sist_aktivitet),
      lenke: `${APP_URL}/leads?open=${l.id}`,
    }))

    const minePartnere = (partnere || []).filter((p: any) => p.ansvarlig === uid).map((p: any) => ({
      partner: p.partnernavn,
      kontakt: p.kontaktperson,
      status: p.partnerstatus,
      pipeline_status: p.pipeline_status,
      dager_uten_aktivitet: dager(p.sist_aktivitet),
      lenke: `${APP_URL}/partnere/${p.id}`,
    }))

    const mineLanseringer = (prosjekter || []).filter((p: any) => p.ansvarlig === uid || !p.ansvarlig).map((p: any) => ({
      kunde: selskapNavn.get(p.selskap_id) || p.prosjektnavn,
      status: p.status,
      forventet_go_live: p.forventet_go_live,
      dager_til_go_live: p.forventet_go_live ? -(dager(p.forventet_go_live) ?? 0) : null,
      notat: p.notater ? String(p.notater).slice(0, 200) : null,
      lenke: `${APP_URL}/prosjekter`,
    }))

    const mineFrister = (oppgaver || []).filter((o: any) => o.user_id === uid).map((o: any) => ({
      oppgave: o.oppgave,
      frist: o.frist,
      dager_forsinket: Math.max(0, dager(o.frist) ?? 0),
      prioritet: o.prioritet,
      selskap: o.selskap_id ? selskapNavn.get(o.selskap_id) || null : null,
      notat: o.notater ? String(o.notater).slice(0, 200) : null,
      lenke: `${APP_URL}/oppgaver`,
    }))

    // Uavklarte beslutninger: deals uten neste steg, eller som har stått stille
    const uavklart = mineDeals
      .filter((d) => !d.neste_steg || (d.dager_uten_aktivitet ?? 0) > KALD_DEAL_DAGER)
      .map((d) => ({
        selskap: d.selskap,
        stadium: d.stadium,
        mangler: !d.neste_steg ? 'Ingen definert neste steg' : `${d.dager_uten_aktivitet} dager uten aktivitet`,
        lenke: d.lenke,
      }))

    const pipelineVerdi = mineDeals.reduce((s, d) => s + (d.mrr || 0), 0)
    const vunnetUke = (vunnet || []).filter((d: any) => d.ansvarlig === uid)
    const taptUke = (tapt || []).filter((d: any) => d.ansvarlig === uid)

    const kontekst = {
      dato: todayStr,
      salgsmuligheter: mineDeals,
      leads: mineLeads.slice(0, 40),
      partnere: minePartnere,
      kundelanseringer: mineLanseringer,
      frister: mineFrister,
      uavklarte_beslutninger: uavklart,
      forrige_uke: {
        vunnet: vunnetUke.map((d: any) => ({ selskap: selskapNavn.get(d.selskap_id) || d.navn, mrr: d.forventet_mrr })),
        tapt: taptUke.map((d: any) => ({ navn: d.navn, aarsak: d.tapsaarsak })),
      },
    }

    if (mineDeals.length === 0 && mineLeads.length === 0 && mineLanseringer.length === 0 && mineFrister.length === 0) continue

    let agenda: AgendaPunkt[] = []
    let risikoer: string[] = []
    let oppsummering = ''
    let aiBrukt = false

    if (!aiPauset) {
      try {
        const res = await rangerAgenda(
          'Du er kommersiell sparringspartner for Snakk AI. Du lager en kort, rangert ukesagenda for én selger. ' +
          'Prioriter det som faktisk flytter omsetning denne uken: deals nær beslutning, kunder som skal lanseres, ' +
          'partnerarbeid som står stille, frister som ryker og uavklarte beslutninger. ' +
          'Hvert punkt skal ha en konkret handling som kan gjøres i dag eller denne uken – navn, kanal og hva som skal sies. ' +
          'Vær nøktern og kort. Ingen floskler, ingen plassholdere i klammer.',
          kontekst,
          MAKS_PUNKTER,
        )
        agenda = res.agenda
        risikoer = res.risikoer
        oppsummering = res.oppsummering
        aiBrukt = true
      } catch (err) {
        const status = err instanceof AgendaAiError ? err.status : 0
        console.error('AI-rangering feilet', status)
        if (status === 402 || status === 403) aiPauset = true
      }
    }

    if (!aiBrukt) {
      // Regelbasert fallback: frister først, deretter stille deals
      agenda = [
        ...mineFrister.filter((f) => f.dager_forsinket > 0).slice(0, 3).map((f) => ({
          tittel: f.oppgave,
          selskap: f.selskap,
          hvorfor: `${f.dager_forsinket} dager forsinket`,
          handling: 'Fullfør eller flytt fristen i dag',
          risiko: null,
          lenke: f.lenke,
        })),
        ...uavklart.slice(0, 4).map((u) => ({
          tittel: `Avklar ${u.selskap}`,
          selskap: u.selskap,
          hvorfor: u.mangler,
          handling: 'Ta kontakt og sett et konkret neste steg med dato',
          risiko: null,
          lenke: u.lenke,
        })),
      ].slice(0, MAKS_PUNKTER)
      risikoer = mineDeals
        .filter((d) => d.forventet_lukkedato && (dager(d.forventet_lukkedato) ?? -99) > -RISIKO_LUKKEDATO_DAGER && (d.dager_uten_aktivitet ?? 0) > KALD_DEAL_DAGER)
        .map((d) => `${d.selskap} nærmer seg lukkedato uten aktivitet på ${d.dager_uten_aktivitet} dager`)
        .slice(0, 5)
      oppsummering = `${mineDeals.length} aktive salgsmuligheter · ${pipelineVerdi.toLocaleString('no-NO')} kr i pipeline`
    }

    if (agenda.length === 0) continue

    if (dryRun) {
      forhandsvisning.push({ email: profile.email, aiBrukt, oppsummering, agenda, risikoer })
      continue
    }

    try {
      const result = await sendTemplateEmailWithLog('weekly-priorities', profile.email, {
        idempotencyKey: `weekly-priorities-${uid}-${todayStr}`,
        templateData: {
          displayName: profile.display_name?.split(' ')[0] || 'der',
          oppsummering,
          agenda,
          risikoer,
          pipelineVerdi,
          antallDeals: mineDeals.length,
          antallLeads: mineLeads.length,
          antallLanseringer: mineLanseringer.length,
          antallForfalte: mineFrister.filter((f) => f.dager_forsinket > 0).length,
          aiBrukt,
          appUrl: APP_URL,
        },
      })
      if (result.sent) sent++
    } catch (err) {
      console.error('Kunne ikke sende ukesagenda', err)
      errors.push(`${profile.email}: ${err}`)
    }
  }

  return new Response(
    JSON.stringify({ sent, aiPauset, dryRun, forhandsvisning: dryRun ? forhandsvisning : undefined, errors: errors.length ? errors : undefined }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
