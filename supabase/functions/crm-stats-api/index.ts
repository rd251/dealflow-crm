import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'x-api-key, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Auth via X-API-Key header
  const apiKey = req.headers.get('x-api-key')
  const validKey = Deno.env.get('CRM_STATS_API_KEY')
  if (!apiKey || apiKey !== validKey) {
    return json({ error: 'Unauthorized. Provide valid X-API-Key header.' }, 401)
  }

  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/crm-stats-api\/?/, '').replace(/^\//, '')

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    switch (path) {
      case 'mrr':
        return json(await getMrr(supabase))
      case 'customers':
        return json(await getCustomers(supabase))
      case 'revenue':
        return json(await getRevenue(supabase))
      case 'pipeline':
        return json(await getPipeline(supabase))
      case 'partners':
        return json(await getPartners(supabase))
      case 'leads':
        return json(await getLeads(supabase))
      case 'tasks':
        return json(await getTasks(supabase))
      case 'activities':
        return json(await getActivities(supabase, url))
      case 'churn':
        return json(await getChurn(supabase))
      case 'health':
        return json({ status: 'ok', updated_at: new Date().toISOString() })
      default:
        return json({
          error: 'Unknown endpoint',
          available_endpoints: [
            'mrr', 'customers', 'revenue', 'pipeline',
            'partners', 'leads', 'tasks', 'activities', 'churn', 'health',
          ],
        }, 404)
    }
  } catch (e) {
    console.error('Stats API error:', e)
    return json({ error: 'Internal server error' }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ─── GET /mrr ───────────────────────────────────────────
async function getMrr(sb: any) {
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const firstOfMonth = `${thisMonth}-01`

  const { data: companies } = await sb
    .from('selskaper')
    .select('mrr, kundestatus')

  const liveMrr = (companies || [])
    .filter((c: any) => c.kundestatus === 'Live')
    .reduce((s: number, c: any) => s + (c.mrr || 0), 0)

  const pilotMrr = (companies || [])
    .filter((c: any) => c.kundestatus === 'Pilot')
    .reduce((s: number, c: any) => s + (c.mrr || 0), 0)

  const totalMrr = liveMrr + pilotMrr

  // Won deals this month = new MRR
  const { data: wonThisMonth } = await sb
    .from('salgsmuligheter')
    .select('forventet_mrr')
    .eq('status', 'Vunnet')
    .gte('vunnet_dato', firstOfMonth)

  const newMrr = (wonThisMonth || []).reduce((s: number, d: any) => s + (d.forventet_mrr || 0), 0)

  // Lost/cancelled this month = lost MRR
  const { data: cancelledThisMonth } = await sb
    .from('selskaper')
    .select('mrr')
    .gte('kansellert_dato', firstOfMonth)
    .eq('kundestatus', 'Kansellert')

  const lostMrr = (cancelledThisMonth || []).reduce((s: number, c: any) => s + (c.mrr || 0), 0)
  const netChange = newMrr - lostMrr
  const prevMrr = totalMrr - netChange

  return {
    mrr: totalMrr,
    live_mrr: liveMrr,
    pilot_mrr: pilotMrr,
    currency: 'NOK',
    month: thisMonth,
    new_mrr_this_month: newMrr,
    lost_mrr_this_month: lostMrr,
    change_vs_last_month: netChange,
    change_percent: prevMrr > 0 ? Math.round((netChange / prevMrr) * 1000) / 10 : 0,
    arr: totalMrr * 12,
    updated_at: new Date().toISOString(),
  }
}

// ─── GET /customers ─────────────────────────────────────
async function getCustomers(sb: any) {
  const now = new Date()
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const { data: companies } = await sb
    .from('selskaper')
    .select('kundestatus, bransje, go_live_dato, kansellert_dato, kundetilstand')

  const all = companies || []
  const live = all.filter((c: any) => c.kundestatus === 'Live')
  const pilot = all.filter((c: any) => c.kundestatus === 'Pilot')
  const pause = all.filter((c: any) => c.kundestatus === 'Pause')
  const cancelled = all.filter((c: any) => c.kundestatus === 'Kansellert')

  const newThisMonth = live.filter((c: any) => c.go_live_dato && c.go_live_dato >= firstOfMonth).length
  const churnedThisMonth = cancelled.filter((c: any) => c.kansellert_dato && c.kansellert_dato >= firstOfMonth).length

  const totalActive = live.length + pilot.length
  const churnRate = totalActive > 0 ? Math.round((churnedThisMonth / (totalActive + churnedThisMonth)) * 1000) / 10 : 0

  // By industry/segment
  const bySegment: Record<string, number> = {}
  for (const c of [...live, ...pilot]) {
    const seg = (c.bransje || 'unknown').toLowerCase()
    bySegment[seg] = (bySegment[seg] || 0) + 1
  }

  // Customer health
  const healthMap: Record<string, number> = { good: 0, uncertain: 0, at_risk: 0 }
  for (const c of live) {
    const h = c.kundetilstand
    if (h === 'Bra') healthMap.good++
    else if (h === 'Usikker') healthMap.uncertain++
    else if (h === 'Risiko') healthMap.at_risk++
  }

  return {
    total_active: totalActive,
    live: live.length,
    pilot: pilot.length,
    paused: pause.length,
    cancelled: cancelled.length,
    new_this_month: newThisMonth,
    churned_this_month: churnedThisMonth,
    churn_rate_percent: churnRate,
    by_segment: bySegment,
    customer_health: healthMap,
    updated_at: new Date().toISOString(),
  }
}

// ─── GET /revenue ───────────────────────────────────────
async function getRevenue(sb: any) {
  const { data: companies } = await sb
    .from('selskaper')
    .select('firmanavn, mrr, arr, kundestatus, go_live_dato, oppstartskostnad')
    .in('kundestatus', ['Live', 'Pilot'])
    .order('mrr', { ascending: false })

  const contracts = (companies || []).map((c: any) => ({
    customer_name: c.firmanavn,
    mrr: c.mrr || 0,
    arr: c.arr || 0,
    status: c.kundestatus === 'Live' ? 'active' : 'pilot',
    start_date: c.go_live_dato || null,
    setup_fee: c.oppstartskostnad || 0,
  }))

  const totalMrr = contracts.reduce((s: number, c: any) => s + c.mrr, 0)
  const totalArr = totalMrr * 12

  return {
    contracts,
    total_mrr: totalMrr,
    total_arr: totalArr,
    currency: 'NOK',
    contract_count: contracts.length,
    updated_at: new Date().toISOString(),
  }
}

// ─── GET /pipeline ──────────────────────────────────────
async function getPipeline(sb: any) {
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0]
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const { data: deals } = await sb
    .from('salgsmuligheter')
    .select('navn, status, forventet_mrr, forventet_lukkedato, sannsynlighet, ansvarlig, selskap_id, opprettet_dato, sist_aktivitet')
    .not('status', 'in', '("Vunnet","Tapt")')

  const all = deals || []

  // Demos = meetings booked
  const demoBookedThisWeek = all.filter((d: any) => d.status === 'Møte booket' && d.opprettet_dato && d.opprettet_dato >= weekAgo).length
  const demosPending = all.filter((d: any) => ['Møte booket', 'Demo gjennomført'].includes(d.status)).length

  const closingStages = ['Tilbud sendt', 'Forhandling', 'Beslutning']
  const closingThisMonth = all.filter((d: any) =>
    closingStages.includes(d.status) &&
    d.forventet_lukkedato && d.forventet_lukkedato <= endOfMonth
  )

  const estimatedNewMrr = closingThisMonth.reduce((s: number, d: any) => s + (d.forventet_mrr || 0), 0)
  const weightedMrr = all.reduce((s: number, d: any) => s + ((d.forventet_mrr || 0) * (d.sannsynlighet || 50) / 100), 0)

  // Stage breakdown
  const stageOrder = ['Ny mulighet', 'Møte booket', 'Behov avklart', 'Demo gjennomført', 'Løsning presentert', 'Tilbud sendt', 'Forhandling', 'Beslutning']
  const stages = stageOrder.map(s => {
    const inStage = all.filter((d: any) => d.status === s)
    return {
      stage: s,
      stage_en: norwegianToEnglish(s),
      count: inStage.length,
      total_mrr: inStage.reduce((sum: number, d: any) => sum + (d.forventet_mrr || 0), 0),
    }
  }).filter(s => s.count > 0)

  const totalPipelineValue = all.reduce((s: number, d: any) => s + (d.forventet_mrr || 0), 0)

  return {
    total_deals: all.length,
    total_pipeline_mrr: totalPipelineValue,
    weighted_pipeline_mrr: Math.round(weightedMrr),
    demo_bookings_this_week: demoBookedThisWeek,
    demos_pending: demosPending,
    deals_closing_this_month: closingThisMonth.length,
    estimated_new_mrr: estimatedNewMrr,
    stages,
    deals: all.slice(0, 50).map((d: any) => ({
      name: d.navn,
      stage: d.status,
      stage_en: norwegianToEnglish(d.status),
      mrr: d.forventet_mrr || 0,
      probability: d.sannsynlighet || 50,
      expected_close: d.forventet_lukkedato,
      last_activity: d.sist_aktivitet,
    })),
    updated_at: new Date().toISOString(),
  }
}

// ─── GET /partners ──────────────────────────────────────
async function getPartners(sb: any) {
  const { data: partners } = await sb
    .from('partnere')
    .select('partnernavn, partnertype, partnerstatus, provisjonsprosent, provisjonstype, opprettet_dato, sist_aktivitet')

  const all = partners || []
  const active = all.filter((p: any) => p.partnerstatus === 'Aktiv')

  const byType: Record<string, number> = {}
  for (const p of all) {
    const t = p.partnertype || 'Unknown'
    byType[t] = (byType[t] || 0) + 1
  }

  // Partners with live customers
  const { data: companies } = await sb
    .from('selskaper')
    .select('partner_id, kundestatus')
    .not('partner_id', 'is', null)

  const partnerCustomerCount: Record<string, number> = {}
  for (const c of companies || []) {
    if (c.kundestatus === 'Live' || c.kundestatus === 'Pilot') {
      partnerCustomerCount[c.partner_id] = (partnerCustomerCount[c.partner_id] || 0) + 1
    }
  }

  return {
    total: all.length,
    active: active.length,
    by_type: byType,
    partners: all.map((p: any) => ({
      name: p.partnernavn,
      type: p.partnertype,
      status: p.partnerstatus,
      commission_percent: p.provisjonsprosent || 0,
      commission_type: p.provisjonstype,
      created: p.opprettet_dato,
      last_activity: p.sist_aktivitet,
    })),
    updated_at: new Date().toISOString(),
  }
}

// ─── GET /leads ─────────────────────────────────────────
async function getLeads(sb: any) {
  const now = new Date()
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0]

  const { data: leads } = await sb
    .from('leads')
    .select('firmanavn, status, kilde, opprettet_dato, sist_aktivitet, konvertert_dato')

  const all = leads || []
  const active = all.filter((l: any) => !['Ikke aktuelt', 'Konvertert til salg', 'Konvertert til partner'].includes(l.status))
  const newThisWeek = all.filter((l: any) => l.opprettet_dato && l.opprettet_dato >= weekAgo).length
  const newThisMonth = all.filter((l: any) => l.opprettet_dato && l.opprettet_dato >= firstOfMonth).length
  const convertedThisMonth = all.filter((l: any) => l.konvertert_dato && l.konvertert_dato >= firstOfMonth).length

  const byStatus: Record<string, number> = {}
  const bySource: Record<string, number> = {}
  for (const l of all) {
    byStatus[l.status || 'Unknown'] = (byStatus[l.status || 'Unknown'] || 0) + 1
    bySource[l.kilde || 'Unknown'] = (bySource[l.kilde || 'Unknown'] || 0) + 1
  }

  const conversionRate = all.length > 0
    ? Math.round((all.filter((l: any) => ['Konvertert til salg', 'Konvertert til partner'].includes(l.status)).length / all.length) * 1000) / 10
    : 0

  return {
    total: all.length,
    active: active.length,
    new_this_week: newThisWeek,
    new_this_month: newThisMonth,
    converted_this_month: convertedThisMonth,
    conversion_rate_percent: conversionRate,
    by_status: byStatus,
    by_source: bySource,
    updated_at: new Date().toISOString(),
  }
}

// ─── GET /tasks ─────────────────────────────────────────
async function getTasks(sb: any) {
  const today = new Date().toISOString().split('T')[0]

  const { data: tasks } = await sb
    .from('oppgaver')
    .select('oppgave, status, prioritet, frist, ansvarlig')

  const all = tasks || []
  const open = all.filter((t: any) => t.status !== 'Ferdig')
  const overdue = open.filter((t: any) => t.frist && t.frist < today)
  const highPriority = open.filter((t: any) => t.prioritet === 'Høy')

  const byStatus: Record<string, number> = {}
  for (const t of all) {
    byStatus[t.status || 'Unknown'] = (byStatus[t.status || 'Unknown'] || 0) + 1
  }

  return {
    total: all.length,
    open: open.length,
    overdue: overdue.length,
    high_priority: highPriority.length,
    by_status: byStatus,
    overdue_tasks: overdue.slice(0, 20).map((t: any) => ({
      task: t.oppgave,
      due_date: t.frist,
      priority: t.prioritet,
      assignee: t.ansvarlig,
    })),
    updated_at: new Date().toISOString(),
  }
}

// ─── GET /activities?days=7 ─────────────────────────────
async function getActivities(sb: any, url: URL) {
  const days = parseInt(url.searchParams.get('days') || '7', 10)
  const cutoff = new Date(Date.now() - days * 86400000).toISOString()

  const { data: activities } = await sb
    .from('aktiviteter')
    .select('type, dato, tittel, ekstern_provider')
    .gte('dato', cutoff)
    .order('dato', { ascending: false })
    .limit(200)

  const all = activities || []
  const byType: Record<string, number> = {}
  for (const a of all) {
    byType[a.type || 'Unknown'] = (byType[a.type || 'Unknown'] || 0) + 1
  }

  return {
    period_days: days,
    total: all.length,
    by_type: byType,
    recent: all.slice(0, 30).map((a: any) => ({
      type: a.type,
      date: a.dato,
      title: a.tittel || '',
      source: a.ekstern_provider || 'manual',
    })),
    updated_at: new Date().toISOString(),
  }
}

// ─── GET /churn ─────────────────────────────────────────
async function getChurn(sb: any) {
  const { data: companies } = await sb
    .from('selskaper')
    .select('firmanavn, kundestatus, kanselleringsaarsak, kansellert_dato, kundetilstand, mrr')
    .in('kundestatus', ['Kansellert', 'Pause', 'Live'])

  const all = companies || []
  const cancelled = all.filter((c: any) => c.kundestatus === 'Kansellert')
  const paused = all.filter((c: any) => c.kundestatus === 'Pause')
  const atRisk = all.filter((c: any) => c.kundestatus === 'Live' && c.kundetilstand === 'Risiko')

  const reasonMap: Record<string, number> = {}
  for (const c of cancelled) {
    const r = c.kanselleringsaarsak || 'Unknown'
    reasonMap[r] = (reasonMap[r] || 0) + 1
  }

  const lostMrr = cancelled.reduce((s: number, c: any) => s + (c.mrr || 0), 0)

  return {
    total_cancelled: cancelled.length,
    total_paused: paused.length,
    at_risk: atRisk.length,
    at_risk_mrr: atRisk.reduce((s: number, c: any) => s + (c.mrr || 0), 0),
    lost_mrr: lostMrr,
    cancellation_reasons: reasonMap,
    cancelled_customers: cancelled.map((c: any) => ({
      name: c.firmanavn,
      reason: c.kanselleringsaarsak,
      date: c.kansellert_dato,
      mrr_lost: c.mrr || 0,
    })),
    paused_customers: paused.map((c: any) => ({
      name: c.firmanavn,
      mrr: c.mrr || 0,
    })),
    updated_at: new Date().toISOString(),
  }
}

function norwegianToEnglish(stage: string): string {
  const map: Record<string, string> = {
    'Ny mulighet': 'New opportunity',
    'Møte booket': 'Meeting booked',
    'Behov avklart': 'Needs identified',
    'Demo gjennomført': 'Demo completed',
    'Løsning presentert': 'Solution presented',
    'Tilbud sendt': 'Proposal sent',
    'Forhandling': 'Negotiation',
    'Beslutning': 'Decision',
    'Vunnet': 'Won',
    'Tapt': 'Lost',
  }
  return map[stage] || stage
}
