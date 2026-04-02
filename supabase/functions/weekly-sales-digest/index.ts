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
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const weekAgo = new Date(today.getTime() - 7 * 86400000).toISOString().split('T')[0]
  const twoWeeksAgo = new Date(today.getTime() - 14 * 86400000).toISOString().split('T')[0]

  // 1. Fetch deals won this week
  const { data: wonDeals } = await supabase
    .from('salgsmuligheter')
    .select('navn, forventet_mrr, ansvarlig, selskap_id, vunnet_dato')
    .eq('status', 'Vunnet')
    .gte('vunnet_dato', weekAgo)
    .lte('vunnet_dato', todayStr)

  // 2. Fetch deals lost this week
  const { data: lostDeals } = await supabase
    .from('salgsmuligheter')
    .select('navn, forventet_mrr, selskap_id, tapt_dato, tapsaarsak')
    .eq('status', 'Tapt')
    .gte('tapt_dato', weekAgo)
    .lte('tapt_dato', todayStr)

  // 3. Fetch all active pipeline deals (not Vunnet/Tapt)
  const { data: activeDeals } = await supabase
    .from('salgsmuligheter')
    .select('id, navn, status, forventet_mrr, forventet_lukkedato, ansvarlig, selskap_id, sist_aktivitet, neste_steg, kontaktperson')
    .not('status', 'in', '("Vunnet","Tapt")')

  // 4. Fetch deals won/lost in previous week (for pipeline change calculation)
  const { data: prevWon } = await supabase
    .from('salgsmuligheter')
    .select('forventet_mrr')
    .eq('status', 'Vunnet')
    .gte('vunnet_dato', twoWeeksAgo)
    .lt('vunnet_dato', weekAgo)

  const { data: prevLost } = await supabase
    .from('salgsmuligheter')
    .select('forventet_mrr')
    .eq('status', 'Tapt')
    .gte('tapt_dato', twoWeeksAgo)
    .lt('tapt_dato', weekAgo)

  // Resolve company names
  const allSelskapIds = new Set<string>()
  for (const d of [...(wonDeals || []), ...(lostDeals || []), ...(activeDeals || [])]) {
    if (d.selskap_id) allSelskapIds.add(d.selskap_id)
  }

  const selskapMap = new Map<string, string>()
  if (allSelskapIds.size > 0) {
    const { data: selskaper } = await supabase
      .from('selskaper')
      .select('id, firmanavn')
      .in('id', Array.from(allSelskapIds))
    for (const s of selskaper || []) selskapMap.set(s.id, s.firmanavn)
  }

  // Resolve ansvarlig user names
  const allAnsvarlige = new Set<string>()
  for (const d of [...(wonDeals || []), ...(activeDeals || [])]) {
    if (d.ansvarlig) allAnsvarlige.add(d.ansvarlig)
  }

  const nameMap = new Map<string, string>()
  if (allAnsvarlige.size > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name')
      .in('user_id', Array.from(allAnsvarlige))
    for (const p of profiles || []) nameMap.set(p.user_id, p.display_name)
  }

  // ── Compute snapshot ──
  const totalPipeline = (activeDeals || []).reduce((s, d) => s + (d.forventet_mrr || 0), 0)
  const vunnetVerdi = (wonDeals || []).reduce((s, d) => s + (d.forventet_mrr || 0), 0)
  const taptVerdi = (lostDeals || []).reduce((s, d) => s + (d.forventet_mrr || 0), 0)

  // Win rate = won / (won + lost) for this week
  const wonCount = (wonDeals || []).length
  const lostCount = (lostDeals || []).length
  const totalClosed = wonCount + lostCount
  const winRate = totalClosed > 0 ? Math.round((wonCount / totalClosed) * 100) : null

  // Pipeline change: compare current total to estimated previous week total
  const prevWonTotal = (prevWon || []).reduce((s, d) => s + (d.forventet_mrr || 0), 0)
  const prevLostTotal = (prevLost || []).reduce((s, d) => s + (d.forventet_mrr || 0), 0)
  const estimatedPrevPipeline = totalPipeline + vunnetVerdi + taptVerdi - prevWonTotal - prevLostTotal
  const pipelineEndring = estimatedPrevPipeline > 0
    ? Math.round(((totalPipeline - estimatedPrevPipeline) / estimatedPrevPipeline) * 100)
    : null

  // ── Stage breakdown ──
  const stageMap = new Map<string, { total: number; count: number }>()
  const stageOrder = ['Møte booket', 'Behov avklart', 'Løsning presentert', 'Tilbud sendt', 'Forhandling', 'Beslutning']
  for (const d of activeDeals || []) {
    if (!d.status) continue
    const existing = stageMap.get(d.status) || { total: 0, count: 0 }
    existing.total += d.forventet_mrr || 0
    existing.count++
    stageMap.set(d.status, existing)
  }
  const stageBreakdown = stageOrder
    .filter(s => stageMap.has(s))
    .map(s => ({ stage: s, totalVerdi: stageMap.get(s)!.total, antall: stageMap.get(s)!.count }))

  // ── Near closing (Beslutning or Forhandling stage) ──
  const closingStages = ['Beslutning', 'Forhandling', 'Tilbud sendt']
  const nearClosing = (activeDeals || [])
    .filter(d => d.status && closingStages.includes(d.status))
    .slice(0, 5)
    .map(d => ({
      selskap: (d.selskap_id && selskapMap.get(d.selskap_id)) || d.navn,
      verdi: d.forventet_mrr,
      sistAktivitet: d.sist_aktivitet ? formatDate(d.sist_aktivitet) : null,
    }))

  // ── AI Innsikt ──
  const innsikt: string[] = []

  // Win rate trend
  const prevWonCount = (prevWon || []).length
  const prevLostCount = (prevLost || []).length
  const prevTotal = prevWonCount + prevLostCount
  const prevWinRate = prevTotal > 0 ? Math.round((prevWonCount / prevTotal) * 100) : null
  if (winRate != null && prevWinRate != null) {
    if (winRate > prevWinRate) innsikt.push(`Win rate er ${winRate}% – opp fra ${prevWinRate}% forrige uke`)
    else if (winRate < prevWinRate) innsikt.push(`Win rate har falt til ${winRate}% fra ${prevWinRate}% forrige uke`)
  } else if (winRate != null) {
    innsikt.push(`Win rate denne uken: ${winRate}%`)
  }

  // Stuck deals (same stage for >14 days based on sist_aktivitet)
  for (const [stage, data] of stageMap.entries()) {
    const stuckDeals = (activeDeals || []).filter(d => {
      if (d.status !== stage || !d.sist_aktivitet) return false
      return daysBetween(d.sist_aktivitet, todayStr) > 14
    })
    if (stuckDeals.length > 0) {
      innsikt.push(`${stuckDeals.length} deal${stuckDeals.length > 1 ? 's' : ''} har stått i "${stage}" i over 14 dager`)
    }
  }

  // Risk deals (inactive >7 days in late stages)
  for (const d of activeDeals || []) {
    if (!d.sist_aktivitet || !d.status) continue
    if (!closingStages.includes(d.status)) continue
    const inactive = daysBetween(d.sist_aktivitet, todayStr)
    if (inactive > 7) {
      const sNavn = (d.selskap_id && selskapMap.get(d.selskap_id)) || d.navn
      innsikt.push(`${sNavn} har ikke hatt aktivitet på ${inactive} dager – vurder oppfølging`)
    }
  }

  // No neste_steg
  const missingNesteSteg = (activeDeals || []).filter(d => !d.neste_steg).length
  if (missingNesteSteg > 0) {
    innsikt.push(`${missingNesteSteg} deal${missingNesteSteg > 1 ? 's' : ''} mangler definert neste steg`)
  }

  // ── Prepare template data ──
  const templateData = {
    snapshot: { totalPipeline, pipelineEndring, vunnetVerdi, taptVerdi, winRate },
    wonDeals: (wonDeals || []).map(d => ({
      selskap: (d.selskap_id && selskapMap.get(d.selskap_id)) || d.navn,
      verdi: d.forventet_mrr,
      ansvarlig: (d.ansvarlig && nameMap.get(d.ansvarlig)) || d.ansvarlig || null,
    })),
    lostDeals: (lostDeals || []).map(d => ({
      selskap: (d.selskap_id && selskapMap.get(d.selskap_id)) || d.navn,
      verdi: d.forventet_mrr,
      tapsaarsak: d.tapsaarsak || null,
    })),
    stageBreakdown,
    nearClosing,
    innsikt: innsikt.slice(0, 6),
    periodLabel: 'Siste 7 dager',
    appUrl: 'https://snakk-ai-crm.lovable.app',
  }

  // ── Send to all users who have active deals or tasks ──
  const allUserIds = new Set<string>()
  for (const d of activeDeals || []) if (d.ansvarlig) allUserIds.add(d.ansvarlig)
  for (const d of wonDeals || []) if (d.ansvarlig) allUserIds.add(d.ansvarlig)

  // If no deals at all, send to all profiles (so admins still get the report)
  if (allUserIds.size === 0) {
    const { data: allProfiles } = await supabase.from('profiles').select('user_id')
    for (const p of allProfiles || []) allUserIds.add(p.user_id)
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, display_name, email')
    .in('user_id', Array.from(allUserIds))

  let sentCount = 0
  const errors: string[] = []

  for (const profile of profiles || []) {
    if (!profile.email) continue
    const firstName = profile.display_name?.split(' ')[0] || 'der'

    try {
      const { error: sendError } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'weekly-sales-report',
          recipientEmail: profile.email,
          idempotencyKey: `weekly-sales-${profile.user_id}-${todayStr}`,
          templateData: { ...templateData, displayName: firstName },
        },
      })

      if (sendError) {
        console.error('Failed to send weekly report to', profile.email, sendError)
        errors.push(`${profile.email}: ${sendError.message}`)
      } else {
        sentCount++
      }
    } catch (err) {
      console.error('Error sending weekly report to', profile.email, err)
      errors.push(`${profile.email}: ${err}`)
    }
  }

  return new Response(
    JSON.stringify({ sent: sentCount, errors: errors.length > 0 ? errors : undefined }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})

function formatDate(dateStr: string): string {
  const d = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr
  const date = new Date(d + 'T00:00:00')
  return date.toLocaleDateString('no-NO', { day: 'numeric', month: 'long', year: 'numeric' })
}

function daysBetween(a: string, b: string): number {
  const d1 = a.includes('T') ? a.split('T')[0] : a
  const d2 = b.includes('T') ? b.split('T')[0] : b
  const msPerDay = 86400000
  return Math.round((new Date(d2 + 'T00:00:00').getTime() - new Date(d1 + 'T00:00:00').getTime()) / msPerDay)
}
