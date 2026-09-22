import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendTemplateEmailWithLog } from '../_shared/transactional-email-templates/send-and-log.ts'
import { rangerAgenda, AgendaAiError, type AgendaPunkt } from '../_shared/agenda-ai.ts'

const APP_URL = 'https://snakk-ai.lovable.app'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const today = new Date().toISOString().split('T')[0]

  // Fetch open tasks with deadline <= today
  const { data: tasks, error: tasksError } = await supabase
    .from('oppgaver')
    .select('id, oppgave, frist, ansvarlig, prioritet, status, user_id, selskap_id, kontakt_id, salgsmulighet_id, lead_id, notater')
    .neq('status', 'Ferdig')
    .not('user_id', 'is', null)
    .not('frist', 'is', null)
    .lte('frist', today)
    .order('frist', { ascending: true })

  if (tasksError) {
    console.error('Failed to fetch tasks', tasksError)
    return new Response(JSON.stringify({ error: 'Failed to fetch tasks' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Fetch today's meetings
  const { data: meetings, error: meetingsError } = await supabase
    .from('aktiviteter')
    .select('id, tittel, beskrivelse, start_tid, slutt_tid, dato, user_id')
    .eq('type', 'Møte')
    .eq('dato', today)
    .not('user_id', 'is', null)
    .order('start_tid', { ascending: true })

  if (meetingsError) console.error('Failed to fetch meetings', meetingsError)

  // Fetch active salgsmuligheter (not Vunnet/Tapt)
  const { data: deals, error: dealsError } = await supabase
    .from('salgsmuligheter')
    .select('id, navn, status, forventet_mrr, forventet_lukkedato, ansvarlig, selskap_id, kontaktperson, neste_steg, sist_aktivitet, use_case')
    .not('status', 'in', '("Vunnet","Tapt")')
    .not('ansvarlig', 'is', null)
    .order('forventet_lukkedato', { ascending: true })

  if (dealsError) console.error('Failed to fetch deals', dealsError)

  // Fetch company names for resolving selskap_id
  const allSelskapIds = new Set<string>()
  for (const t of tasks || []) if (t.selskap_id) allSelskapIds.add(t.selskap_id)
  for (const d of deals || []) if (d.selskap_id) allSelskapIds.add(d.selskap_id)

  const selskapMap = new Map<string, string>()
  if (allSelskapIds.size > 0) {
    const { data: selskaper } = await supabase
      .from('selskaper')
      .select('id, firmanavn')
      .in('id', Array.from(allSelskapIds))
    for (const s of selskaper || []) selskapMap.set(s.id, s.firmanavn)
  }

  // Fetch contact names
  const allKontaktIds = new Set<string>()
  for (const t of tasks || []) if (t.kontakt_id) allKontaktIds.add(t.kontakt_id)

  const kontaktMap = new Map<string, any>()
  if (allKontaktIds.size > 0) {
    const { data: kontakter } = await supabase
      .from('kontakter')
      .select('id, navn, telefon, e_post')
      .in('id', Array.from(allKontaktIds))
    for (const k of kontakter || []) kontaktMap.set(k.id, k)
  }

  // Hva leadene bak oppgavene er ute etter (lest ut av notatene)
  const allLeadIds = new Set<string>()
  for (const t of tasks || []) if ((t as any).lead_id) allLeadIds.add((t as any).lead_id)

  const leadOnskerMap = new Map<string, string>()
  if (allLeadIds.size > 0) {
    const { data: leads } = await supabase
      .from('leads')
      .select('id, produkt_interesse, produkt_oppsummering')
      .in('id', Array.from(allLeadIds))
    for (const l of leads || []) {
      const produkter = ((l as any).produkt_interesse || []).join(' · ')
      const tekst = [produkter, (l as any).produkt_oppsummering].filter(Boolean).join(' — ')
      if (tekst) leadOnskerMap.set(l.id, tekst)
    }
  }



  // Collect all user IDs
  const tasksByUser = new Map<string, typeof tasks>()
  for (const task of tasks || []) {
    if (!task.user_id) continue
    const existing = tasksByUser.get(task.user_id) || []
    existing.push(task)
    tasksByUser.set(task.user_id, existing)
  }

  const meetingsByUser = new Map<string, NonNullable<typeof meetings>>()
  for (const meeting of meetings || []) {
    if (!meeting.user_id) continue
    const existing = meetingsByUser.get(meeting.user_id) || []
    existing.push(meeting)
    meetingsByUser.set(meeting.user_id, existing)
  }

  const dealsByUser = new Map<string, NonNullable<typeof deals>>()
  for (const deal of deals || []) {
    if (!deal.ansvarlig) continue
    const existing = dealsByUser.get(deal.ansvarlig) || []
    existing.push(deal)
    dealsByUser.set(deal.ansvarlig, existing)
  }

  const allUserIds = new Set([...tasksByUser.keys(), ...meetingsByUser.keys(), ...dealsByUser.keys()])

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('user_id, display_name, email, daglig_epost_aktiv')
    .in('user_id', Array.from(allUserIds))

  if (profilesError) {
    console.error('Failed to fetch profiles', profilesError)
    return new Response(JSON.stringify({ error: 'Failed to fetch profiles' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || [])
  const nameMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || [])

  let sentCount = 0
  let aiPauset = false
  const errors: string[] = []

  for (const userId of allUserIds) {
    const profile = profileMap.get(userId)
    if (!profile?.email) continue
    // Personlig av/på for daglig e-post
    if ((profile as any).daglig_epost_aktiv === false) continue

    const userTasks = tasksByUser.get(userId) || []
    const userMeetings = meetingsByUser.get(userId) || []
    const userDeals = dealsByUser.get(userId) || []

    const mapTask = (t: any) => ({
      oppgave: t.oppgave,
      frist: t.frist ? formatDate(t.frist) : null,
      fristRaw: t.frist,
      dagerForsinket: t.frist && t.frist < today ? daysBetween(t.frist, today) : 0,
      ansvarlig: (t.ansvarlig && nameMap.get(t.ansvarlig)) || null,
      prioritet: t.prioritet,
      selskap: t.selskap_id ? selskapMap.get(t.selskap_id) || null : null,
      kontakt: t.kontakt_id ? kontaktMap.get(t.kontakt_id)?.navn || null : null,
      telefon: t.kontakt_id ? kontaktMap.get(t.kontakt_id)?.telefon || null : null,
      ePost: t.kontakt_id ? kontaktMap.get(t.kontakt_id)?.e_post || null : null,
      notat: t.notater ? String(t.notater).slice(0, 160) : null,
      lenke: t.salgsmulighet_id ? `${APP_URL}/salgsmuligheter?open=${t.salgsmulighet_id}` : `${APP_URL}/oppgaver`,
    })

    const overdueTasks = userTasks.filter(t => t.frist && t.frist < today).map(mapTask)
    const todayTasks = userTasks.filter(t => t.frist === today).map(mapTask)

    // Prioritized today: high priority first, then today tasks
    const prioritertIDag = [
      ...todayTasks.filter(t => t.prioritet === 'Høy'),
      ...todayTasks.filter(t => t.prioritet !== 'Høy'),
    ]

    const todayMeetings = userMeetings.map(m => ({
      tittel: m.tittel || m.beskrivelse || 'Møte',
      start_tid: m.start_tid ? formatTime(m.start_tid) : null,
      slutt_tid: m.slutt_tid ? formatTime(m.slutt_tid) : null,
    }))

    // Active deals - sorted by closing date, include deals near closing
    const aktiveSalgsmuligheter = userDeals.map(d => ({
      navn: d.navn || d.use_case || 'Ukjent deal',
      selskap: d.selskap_id ? selskapMap.get(d.selskap_id) || null : null,
      status: d.status,
      forventetMrr: d.forventet_mrr,
      forventetLukkedato: d.forventet_lukkedato ? formatDate(d.forventet_lukkedato) : null,
      kontaktperson: d.kontaktperson,
      nesteSteg: d.neste_steg,
      dagerUtenAktivitet: d.sist_aktivitet ? daysBetween(d.sist_aktivitet.split('T')[0], today) : null,
      lenke: `${APP_URL}/salgsmuligheter?open=${d.id}`,
    }))

    // Deals near closing (within 7 days)
    const nearClosing = userDeals.filter(d => {
      if (!d.forventet_lukkedato) return false
      const diff = daysBetween(today, d.forventet_lukkedato)
      return diff >= 0 && diff <= 7
    })

    // Generate AI recommendations
    const anbefalinger: string[] = []
    for (const d of userDeals) {
      if (!d.neste_steg) {
        const sNavn = d.selskap_id ? selskapMap.get(d.selskap_id) : null
        anbefalinger.push(`Definer neste steg for ${sNavn || d.navn || 'deal'} (${d.status})`)
      }
      if (d.sist_aktivitet) {
        const inactiveDays = daysBetween(d.sist_aktivitet.split('T')[0], today)
        if (inactiveDays > 5) {
          const sNavn = d.selskap_id ? selskapMap.get(d.selskap_id) : null
          anbefalinger.push(`Følg opp ${sNavn || d.navn || 'deal'} – ${inactiveDays} dager uten aktivitet`)
        }
      }
    }
    for (const t of overdueTasks) {
      if (t.dagerForsinket > 3) {
        anbefalinger.push(`Prioriter "${t.oppgave}" – ${t.dagerForsinket} dager forsinket`)
      }
    }
    if (nearClosing.length > 0) {
      for (const d of nearClosing) {
        const sNavn = d.selskap_id ? selskapMap.get(d.selskap_id) : null
        anbefalinger.push(`${sNavn || d.navn} nærmer seg lukkedato – forbered closing`)
      }
    }

    // ── Topp 3 konkrete handlinger (AI) ──
    let topp3: AgendaPunkt[] = []
    if (!aiPauset && (prioritertIDag.length > 0 || overdueTasks.length > 0 || aktiveSalgsmuligheter.length > 0)) {
      try {
        const res = await rangerAgenda(
          'Du er kommersiell sparringspartner for Snakk AI og lager dagens tre viktigste handlinger for én selger. ' +
          'Hver handling må være så konkret at den kan utføres uten å tenke: hvem som skal kontaktes, på hvilken kanal ' +
          '(bruk telefonnummer eller e-post fra dataene når det finnes), hva som skal sies eller sendes, og når. ' +
          'Prioriter det som flytter penger i dag: forfalte frister, deals nær beslutning og møter som krever forberedelse. ' +
          'Ingen generelle råd som "følg opp kunden" – si eksakt hva som skal gjøres. Ikke finn på tall eller navn. Norsk bokmål.',
          {
            dato: today,
            forfalte_oppgaver: overdueTasks,
            oppgaver_i_dag: prioritertIDag,
            moter_i_dag: todayMeetings,
            salgsmuligheter: aktiveSalgsmuligheter,
          },
          3,
        )
        topp3 = res.agenda
      } catch (err) {
        const status = err instanceof AgendaAiError ? err.status : 0
        console.error('Daglig AI-rangering feilet', status)
        if (status === 402 || status === 403) aiPauset = true
      }
    }

    if (prioritertIDag.length === 0 && overdueTasks.length === 0 && aktiveSalgsmuligheter.length === 0 && todayMeetings.length === 0) continue

    const firstName = profile.display_name?.split(' ')[0] || profile.display_name || 'der'

    try {
      const result = await sendTemplateEmailWithLog('daily-task-reminder', profile.email, {
        idempotencyKey: `daily-tasks-${userId}-${today}`,
        templateData: {
          displayName: firstName,
          topp3,
          prioritertIDag,
          overdueTasks,
          todayMeetings,
          aktiveSalgsmuligheter,
          anbefalinger: anbefalinger.slice(0, 5),
          overdueCount: overdueTasks.length,
          todayCount: prioritertIDag.length,
          meetingCount: todayMeetings.length,
          dealCount: aktiveSalgsmuligheter.length,
          appUrl: 'https://snakk-ai.lovable.app',
        },
      })

      if (result.sent) {
        sentCount++
      }
    } catch (err) {
      console.error('Error sending to', profile.email, err)
      errors.push(`${profile.email}: ${err}`)
    }
  }

  return new Response(
    JSON.stringify({ sent: sentCount, errors: errors.length > 0 ? errors : undefined }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('no-NO', { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatTime(timeStr: string): string {
  if (timeStr.includes('T')) {
    const date = new Date(timeStr)
    return date.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })
  }
  return timeStr.substring(0, 5)
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 86400000
  const d1 = new Date(a + 'T00:00:00').getTime()
  const d2 = new Date(b + 'T00:00:00').getTime()
  return Math.round((d2 - d1) / msPerDay)
}
