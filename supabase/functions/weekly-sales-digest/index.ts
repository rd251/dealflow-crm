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

  // ── Fetch sales data ──
  const [
    { data: wonDeals },
    { data: lostDeals },
    { data: activeDeals },
    { data: prevWon },
    { data: prevLost },
    { data: allSelskaper },
  ] = await Promise.all([
    supabase.from('salgsmuligheter').select('navn, forventet_mrr, ansvarlig, selskap_id, vunnet_dato').eq('status', 'Vunnet').gte('vunnet_dato', weekAgo).lte('vunnet_dato', todayStr),
    supabase.from('salgsmuligheter').select('navn, forventet_mrr, selskap_id, tapt_dato, tapsaarsak').eq('status', 'Tapt').gte('tapt_dato', weekAgo).lte('tapt_dato', todayStr),
    supabase.from('salgsmuligheter').select('id, navn, status, forventet_mrr, forventet_lukkedato, ansvarlig, selskap_id, sist_aktivitet, neste_steg, kontaktperson').not('status', 'in', '("Vunnet","Tapt")'),
    supabase.from('salgsmuligheter').select('forventet_mrr').eq('status', 'Vunnet').gte('vunnet_dato', twoWeeksAgo).lt('vunnet_dato', weekAgo),
    supabase.from('salgsmuligheter').select('forventet_mrr').eq('status', 'Tapt').gte('tapt_dato', twoWeeksAgo).lt('tapt_dato', weekAgo),
    supabase.from('selskaper').select('id, firmanavn, kundestatus, go_live_dato, lukkedato, kanselleringsaarsak, kansellert_dato, kundetilstand'),
  ])

  // ── Build selskap map ──
  const selskapMap = new Map<string, any>()
  for (const s of allSelskaper || []) selskapMap.set(s.id, s)

  const getSelskapNavn = (id: string | null) => id && selskapMap.get(id) ? selskapMap.get(id).firmanavn : null

  // ── Resolve ansvarlig user names ──
  const allAnsvarlige = new Set<string>()
  for (const d of [...(wonDeals || []), ...(activeDeals || [])]) {
    if (d.ansvarlig) allAnsvarlige.add(d.ansvarlig)
  }
  const nameMap = new Map<string, string>()
  if (allAnsvarlige.size > 0) {
    const { data: profiles } = await supabase.from('profiles').select('user_id, display_name').in('user_id', Array.from(allAnsvarlige))
    for (const p of profiles || []) nameMap.set(p.user_id, p.display_name)
  }

  // ── Compute snapshot ──
  const totalPipeline = (activeDeals || []).reduce((s, d) => s + (d.forventet_mrr || 0), 0)
  const vunnetVerdi = (wonDeals || []).reduce((s, d) => s + (d.forventet_mrr || 0), 0)
  const taptVerdi = (lostDeals || []).reduce((s, d) => s + (d.forventet_mrr || 0), 0)
  const wonCount = (wonDeals || []).length
  const lostCount = (lostDeals || []).length
  const totalClosed = wonCount + lostCount
  const winRate = totalClosed > 0 ? Math.round((wonCount / totalClosed) * 100) : null

  const prevWonTotal = (prevWon || []).reduce((s, d) => s + (d.forventet_mrr || 0), 0)
  const prevLostTotal = (prevLost || []).reduce((s, d) => s + (d.forventet_mrr || 0), 0)
  const estimatedPrevPipeline = totalPipeline + vunnetVerdi + taptVerdi - prevWonTotal - prevLostTotal
  const pipelineEndring = estimatedPrevPipeline > 0
    ? Math.round(((totalPipeline - estimatedPrevPipeline) / estimatedPrevPipeline) * 100)
    : null

  // ── Stage breakdown ──
  const stageMap = new Map<string, { total: number; count: number }>()
  const stageOrder = ['Møte booket', 'Behov avklart', 'Løsning presentert', 'Kontrakt sendt']
  for (const d of activeDeals || []) {
    if (!d.status) continue
    const existing = stageMap.get(d.status) || { total: 0, count: 0 }
    existing.total += d.forventet_mrr || 0
    existing.count++
    stageMap.set(d.status, existing)
  }
  const stageBreakdown = stageOrder.filter(s => stageMap.has(s)).map(s => ({ stage: s, totalVerdi: stageMap.get(s)!.total, antall: stageMap.get(s)!.count }))

  // ── Near closing ──
  const closingStages = ['Kontrakt sendt']
  const nearClosing = (activeDeals || [])
    .filter(d => d.status && closingStages.includes(d.status))
    .slice(0, 5)
    .map(d => ({
      selskap: getSelskapNavn(d.selskap_id) || d.navn,
      verdi: d.forventet_mrr,
      sistAktivitet: d.sist_aktivitet ? formatDate(d.sist_aktivitet) : null,
    }))

  // ── AI Innsikt ──
  const innsikt: string[] = []
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

  for (const [stage] of stageMap.entries()) {
    const stuckDeals = (activeDeals || []).filter(d => d.status === stage && d.sist_aktivitet && daysBetween(d.sist_aktivitet, todayStr) > 14)
    if (stuckDeals.length > 0) innsikt.push(`${stuckDeals.length} deal${stuckDeals.length > 1 ? 's' : ''} har stått i "${stage}" i over 14 dager`)
  }

  for (const d of activeDeals || []) {
    if (!d.sist_aktivitet || !d.status || !closingStages.includes(d.status)) continue
    const inactive = daysBetween(d.sist_aktivitet, todayStr)
    if (inactive > 7) innsikt.push(`${getSelskapNavn(d.selskap_id) || d.navn} har ikke hatt aktivitet på ${inactive} dager – vurder oppfølging`)
  }

  const missingNesteSteg = (activeDeals || []).filter(d => !d.neste_steg).length
  if (missingNesteSteg > 0) innsikt.push(`${missingNesteSteg} deal${missingNesteSteg > 1 ? 's' : ''} mangler definert neste steg`)

  // ══════════════════════════════════════════════════
  // ── SECTIONS 8-12: KUNDE & GO-LIVE STATUS ──
  // ══════════════════════════════════════════════════

  const kundeStatuser = allSelskaper || []
  const liveKunder = kundeStatuser.filter(s => s.kundestatus === 'Live')
  const pilotKunder = kundeStatuser.filter(s => s.kundestatus === 'Pilot')
  const pauseKunder = kundeStatuser.filter(s => s.kundestatus === 'Pause')
  const kansellertKunder = kundeStatuser.filter(s => s.kundestatus === 'Kansellert')

  // 8. Snapshot: kunder & go-live
  // Snitt dager fra vunnet (lukkedato) → go-live
  const goLiveDays: number[] = []
  for (const s of liveKunder) {
    if (s.go_live_dato && s.lukkedato) {
      const days = daysBetween(s.lukkedato, s.go_live_dato)
      if (days >= 0) goLiveDays.push(days)
    }
  }
  const snittGoLive = goLiveDays.length > 0 ? Math.round(goLiveDays.reduce((a, b) => a + b, 0) / goLiveDays.length) : null

  const kundeSnapshot = {
    antallLive: liveKunder.length,
    antallIkkeLive: pilotKunder.length,
    snittDagerTilGoLive: snittGoLive,
    antallPause: pauseKunder.length,
    antallChurn: kansellertKunder.length,
  }

  // 9. Gått live denne uken
  const gaattLive = liveKunder
    .filter(s => s.go_live_dato && s.go_live_dato >= weekAgo && s.go_live_dato <= todayStr)
    .map(s => ({
      selskap: s.firmanavn,
      dagerFraVunnet: s.lukkedato ? daysBetween(s.lukkedato, s.go_live_dato!) : null,
    }))

  // 10. Ikke live (Pilot-kunder som ennå ikke er live)
  const ikkeLive = pilotKunder
    .map(s => ({
      selskap: s.firmanavn,
      dagerSidenVunnet: s.lukkedato ? daysBetween(s.lukkedato, todayStr) : null,
      advarsel: s.lukkedato ? daysBetween(s.lukkedato, todayStr) > 7 : false,
    }))
    .sort((a, b) => (b.dagerSidenVunnet || 0) - (a.dagerSidenVunnet || 0))
    .slice(0, 10)

  // 11. Planlagt go-live (prosjekter med forventet_go_live)
  const { data: prosjekter } = await supabase
    .from('prosjekter')
    .select('prosjektnavn, selskap_id, forventet_go_live, status')
    .not('status', 'eq', 'Live')
    .not('forventet_go_live', 'is', null)
    .order('forventet_go_live', { ascending: true })
    .limit(10)

  const planlagtGoLive = (prosjekter || []).map(p => ({
    selskap: getSelskapNavn(p.selskap_id) || p.prosjektnavn,
    planlagtDato: formatDate(p.forventet_go_live!),
  }))

  // 12. Pause / Churn
  const pauseChurn = [
    ...pauseKunder.map(s => ({
      selskap: s.firmanavn,
      status: 'Pause' as const,
      aarsak: null as string | null,
    })),
    ...kansellertKunder
      .filter(s => !s.kansellert_dato || s.kansellert_dato >= weekAgo)
      .map(s => ({
        selskap: s.firmanavn,
        status: 'Kansellert' as const,
        aarsak: s.kanselleringsaarsak || null,
      })),
  ].slice(0, 10)

  // Add go-live insights
  if (ikkeLive.filter(s => s.advarsel).length > 0) {
    innsikt.push(`${ikkeLive.filter(s => s.advarsel).length} kunde(r) har ventet >7 dager på go-live`)
  }
  if (gaattLive.length > 0) {
    innsikt.push(`${gaattLive.length} kunde(r) gikk live denne uken 🎉`)
  }

  // ── Prepare template data ──
  const templateData = {
    snapshot: { totalPipeline, pipelineEndring, vunnetVerdi, taptVerdi, winRate },
    wonDeals: (wonDeals || []).map(d => ({
      selskap: getSelskapNavn(d.selskap_id) || d.navn,
      verdi: d.forventet_mrr,
      ansvarlig: (d.ansvarlig && nameMap.get(d.ansvarlig)) || d.ansvarlig || null,
    })),
    lostDeals: (lostDeals || []).map(d => ({
      selskap: getSelskapNavn(d.selskap_id) || d.navn,
      verdi: d.forventet_mrr,
      tapsaarsak: d.tapsaarsak || null,
    })),
    stageBreakdown,
    nearClosing,
    innsikt: innsikt.slice(0, 8),
    kundeSnapshot,
    gaattLive,
    ikkeLive,
    planlagtGoLive,
    pauseChurn,
    periodLabel: 'Siste 7 dager',
    appUrl: 'https://snakk-ai-crm.lovable.app',
  }

  // ── Send to all relevant users ──
  const allUserIds = new Set<string>()
  for (const d of activeDeals || []) if (d.ansvarlig) allUserIds.add(d.ansvarlig)
  for (const d of wonDeals || []) if (d.ansvarlig) allUserIds.add(d.ansvarlig)

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
