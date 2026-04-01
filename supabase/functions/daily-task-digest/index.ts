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

  // Get all open tasks (not "Ferdig") that are overdue or due today
  const { data: tasks, error: tasksError } = await supabase
    .from('oppgaver')
    .select('id, oppgave, frist, ansvarlig, prioritet, status, user_id')
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

  // Get today's meetings
  const { data: meetings, error: meetingsError } = await supabase
    .from('aktiviteter')
    .select('id, tittel, beskrivelse, start_tid, slutt_tid, dato, user_id')
    .eq('type', 'Møte')
    .eq('dato', today)
    .not('user_id', 'is', null)
    .order('start_tid', { ascending: true })

  if (meetingsError) {
    console.error('Failed to fetch meetings', meetingsError)
  }

  const hasTasks = tasks && tasks.length > 0
  const hasMeetings = meetings && meetings.length > 0

  if (!hasTasks && !hasMeetings) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no_tasks_or_meetings' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Group tasks by user_id
  const tasksByUser = new Map<string, typeof tasks>()
  for (const task of tasks) {
    if (!task.user_id) continue
    const existing = tasksByUser.get(task.user_id) || []
    existing.push(task)
    tasksByUser.set(task.user_id, existing)
  }

  // Get profiles for all relevant users
  const userIds = Array.from(tasksByUser.keys())
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('user_id, display_name, email')
    .in('user_id', userIds)

  if (profilesError) {
    console.error('Failed to fetch profiles', profilesError)
    return new Response(JSON.stringify({ error: 'Failed to fetch profiles' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || [])
  // Build a lookup for user_id → display_name (used to resolve ansvarlig UUIDs)
  const nameMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || [])

  let sentCount = 0
  const errors: string[] = []

  for (const [userId, userTasks] of tasksByUser) {
    const profile = profileMap.get(userId)
    if (!profile?.email) {
      console.warn('No profile/email for user', userId)
      continue
    }

    // Split into overdue vs today
    const overdueTasks = userTasks
      .filter(t => t.frist && t.frist < today)
      .map(t => ({
        oppgave: t.oppgave,
        frist: formatDate(t.frist!),
        ansvarlig: (t.ansvarlig && nameMap.get(t.ansvarlig)) || t.ansvarlig,
        prioritet: t.prioritet,
      }))

    const todayTasks = userTasks
      .filter(t => t.frist === today)
      .map(t => ({
        oppgave: t.oppgave,
        frist: formatDate(t.frist!),
        ansvarlig: (t.ansvarlig && nameMap.get(t.ansvarlig)) || t.ansvarlig,
        prioritet: t.prioritet,
      }))

    if (overdueTasks.length === 0 && todayTasks.length === 0) continue

    const firstName = profile.display_name?.split(' ')[0] || profile.display_name || 'der'

    try {
      const { error: sendError } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'daily-task-reminder',
          recipientEmail: profile.email,
          idempotencyKey: `daily-tasks-${userId}-${today}`,
          templateData: {
            displayName: firstName,
            overdueCount: overdueTasks.length,
            todayCount: todayTasks.length,
            overdueTasks,
            todayTasks,
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
  return date.toLocaleDateString('no-NO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
