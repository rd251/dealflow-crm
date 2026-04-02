import { createClient } from 'npm:@supabase/supabase-js@2'

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
    .select('id, oppgave, frist, ansvarlig, prioritet, status, user_id, selskap_id, kontakt_id, salgsmulighet_id')
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

  const kontaktMap = new Map<string, string>()
  if (allKontaktIds.size > 0) {
    const { data: kontakter } = await supabase
      .from('kontakter')
      .select('id, navn')
      .in('id', Array.from(allKontaktIds))
    for (const k of kontakter || []) kontaktMap.set(k.id, k.navn)
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
    .select('user_id, display_name, email')
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
  const errors: string[] = []

  for (const userId of allUserIds) {
    const profile = profileMap.get(userId)
    if (!profile?.email) continue

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
      kontakt: t.kontakt_id ? kontaktMap.get(t.kontakt_id) || null : null,
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

    if (prioritertIDag.length === 0 && overdueTasks.length === 0 && aktiveSalgsmuligheter.length === 0 && todayMeetings.length === 0) continue

    const firstName = profile.display_name?.split(' ')[0] || profile.display_name || 'der'

    try {
      const { error: sendError } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'daily-task-reminder',
          recipientEmail: profile.email,
          idempotencyKey: `daily-tasks-${userId}-${today}`,
          templateData: {
            displayName: firstName,
            prioritertIDag,
            overdueTasks,
            todayMeetings,
            aktiveSalgsmuligheter,
            anbefalinger: anbefalinger.slice(0, 5),
            overdueCount: overdueTasks.length,
            todayCount: prioritertIDag.length,
            meetingCount: todayMeetings.length,
            dealCount: aktiveSalgsmuligheter.length,
            appUrl: 'https://snakk-ai-crm.lovable.app',
          },
        },
      })

      if (sendError) {
        console.error('Failed to send to', profile.email, sendError)
        errors.push(`${profile.email}: ${sendError.message}`)
      } else {
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
