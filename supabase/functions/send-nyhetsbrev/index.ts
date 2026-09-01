import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const BREVO = 'https://api.brevo.com/v3'
const SENDER = { name: 'Snakk AI', email: 'robin@snakk.ai' }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function brevo(apiKey: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${BREVO}${path}`, {
    ...init,
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      accept: 'application/json',
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  if (!res.ok) {
    console.error(`Brevo ${path} failed [${res.status}]: ${text}`)
    throw new Error(`[${res.status}] ${text}`)
  }
  return text ? JSON.parse(text) : {}
}

interface Mottaker {
  e_post: string
  firmanavn: string | null
  kilde: string
  kilde_id: string | null
}

async function hentMottakere(supabase: any): Promise<Mottaker[]> {
  const [leads, kontakter, deals, avmeldte] = await Promise.all([
    supabase.from('leads').select('id, e_post, firmanavn, status'),
    supabase.from('kontakter').select('id, e_post, navn, selskaper(firmanavn)'),
    supabase.from('salgsmuligheter').select('id, e_post, navn'),
    supabase.from('nyhetsbrev_avmeldte').select('e_post'),
  ])

  const blokkert = new Set((avmeldte.data || []).map((a: any) => a.e_post.toLowerCase()))
  const map = new Map<string, Mottaker>()
  const add = (e: string, firmanavn: string | null, kilde: string, id: string | null) => {
    const key = (e || '').trim().toLowerCase()
    if (!EMAIL_RE.test(key) || blokkert.has(key) || map.has(key)) return
    map.set(key, { e_post: key, firmanavn, kilde, kilde_id: id })
  }

  for (const l of leads.data || []) {
    if (l.status === 'Ikke aktuelt') continue
    add(l.e_post, l.firmanavn, 'lead', l.id)
  }
  for (const d of deals.data || []) add(d.e_post, d.navn, 'kunde', d.id)
  for (const k of kontakter.data || []) add(k.e_post, k.selskaper?.firmanavn ?? k.navn, 'kontakt', k.id)

  return Array.from(map.values())
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const apiKey = Deno.env.get('BREVO_API_KEY')
  if (!apiKey) return json({ error: 'BREVO_API_KEY mangler' }, 500)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Krev innlogget bruker
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  const { data: userData } = await supabase.auth.getUser(token)
  if (!userData?.user) return json({ error: 'Ikke autorisert' }, 401)

  try {
    const body = await req.json().catch(() => ({}))
    const action = body.action ?? 'send'

    if (action === 'preview_recipients') {
      const mottakere = await hentMottakere(supabase)
      return json({ antall: mottakere.length, mottakere })
    }

    if (action === 'sync_stats') {
      // Hent alle kampanjer med Brevo-ID hvis ingen id er oppgitt
      const query = supabase.from('nyhetsbrev').select('*').not('brevo_campaign_id', 'is', null)
      const { data: rader } = body.nyhetsbrev_id
        ? await supabase.from('nyhetsbrev').select('*').eq('id', body.nyhetsbrev_id)
        : await query
      const liste = rader || []
      if (liste.length === 0) return json({ error: 'Ingen Brevo-kampanjer å synkronisere' }, 400)

      const resultater: any[] = []
      for (const nb of liste) {
        if (!nb.brevo_campaign_id) continue
        try {
          const camp = await brevo(apiKey, `/emailCampaigns/${nb.brevo_campaign_id}`)
          const s = camp.statistics?.globalStats ?? {}
          const aapnet = s.uniqueViews ?? s.viewed ?? 0
          const klikk = s.uniqueClicks ?? s.clickers ?? 0
          const levert = s.delivered ?? nb.mottaker_antall ?? 0
          const stats = {
            navn: camp.name ?? null,
            sendere: camp.sender ?? null,
            sendt: camp.sentDate ?? null,
            levert: levert,
            sendte: s.sent ?? 0,
            aapninger: s.viewed ?? 0,
            unike_aapninger: aapnet,
            klikk: s.clickers ?? 0,
            unike_klikk: klikk,
            harde_bounces: s.hardBounces ?? 0,
            myke_bounces: s.softBounces ?? 0,
            avmeldinger: s.unsubscriptions ?? 0,
            spam: s.complaints ?? 0,
          }
          await supabase
            .from('nyhetsbrev')
            .update({
              aapnet_antall: aapnet,
              klikk_antall: klikk,
              mottaker_antall: levert || nb.mottaker_antall,
              brevo_status: camp.status ?? null,
              brevo_stats: stats,
              brevo_synk_dato: new Date().toISOString(),
            })
            .eq('id', nb.id)
          resultater.push({ id: nb.id, campaign_id: nb.brevo_campaign_id, ...stats })
        } catch (e) {
          resultater.push({ id: nb.id, campaign_id: nb.brevo_campaign_id, feil: String(e) })
        }
      }

      const forste = resultater[0] ?? {}
      return json({
        antall: resultater.length,
        resultater,
        aapnet_antall: forste.unike_aapninger ?? 0,
        klikk_antall: forste.unike_klikk ?? 0,
        mottaker_antall: forste.levert ?? 0,
      })
    }


    if (action === 'send_test') {
      const testEpost = String(body.test_epost || userData.user.email || '').trim().toLowerCase()
      if (!EMAIL_RE.test(testEpost)) return json({ error: 'Ugyldig test-e-post' }, 400)

      const { data: nb } = await supabase
        .from('nyhetsbrev')
        .select('*')
        .eq('id', body.nyhetsbrev_id)
        .maybeSingle()
      if (!nb) return json({ error: 'Nyhetsbrev ikke funnet' }, 404)
      if (!nb.innhold_html) return json({ error: 'Nyhetsbrevet mangler innhold' }, 400)

      // Brevo krever at test-mottakeren finnes som kontakt
      await brevo(apiKey, '/contacts', {
        method: 'POST',
        body: JSON.stringify({ email: testEpost, updateEnabled: true }),
      }).catch(() => {})

      // Gjenbruk eksisterende utkast-kampanje hvis den finnes, ellers lag ny
      let campaignId = nb.brevo_campaign_id as number | null
      if (campaignId) {
        await brevo(apiKey, `/emailCampaigns/${campaignId}`, {
          method: 'PUT',
          body: JSON.stringify({ subject: nb.emne, htmlContent: nb.innhold_html }),
        }).catch(() => { campaignId = null })
      }
      if (!campaignId) {
        const camp = await brevo(apiKey, '/emailCampaigns', {
          method: 'POST',
          body: JSON.stringify({
            name: `[TEST] ${nb.tittel} – ${new Date().toISOString().slice(0, 16)}`,
            subject: nb.emne,
            sender: SENDER,
            type: 'classic',
            htmlContent: nb.innhold_html,
            recipients: { listIds: [] },
            inlineImageActivation: false,
          }),
        })
        campaignId = camp.id
      }

      await brevo(apiKey, `/emailCampaigns/${campaignId}/sendTest`, {
        method: 'POST',
        body: JSON.stringify({ emailTo: [testEpost] }),
      })

      await supabase
        .from('nyhetsbrev')
        .update({ brevo_campaign_id: campaignId, status: nb.status === 'sendt' ? nb.status : 'test' })
        .eq('id', nb.id)

      return json({ ok: true, test_epost: testEpost, campaign_id: campaignId })
    }

    if (action !== 'send') return json({ error: 'Ukjent action' }, 400)


    const { data: nb } = await supabase
      .from('nyhetsbrev')
      .select('*')
      .eq('id', body.nyhetsbrev_id)
      .maybeSingle()
    if (!nb) return json({ error: 'Nyhetsbrev ikke funnet' }, 404)
    if (nb.status === 'sendt') return json({ error: 'Nyhetsbrevet er allerede sendt' }, 400)
    if (!nb.innhold_html) return json({ error: 'Nyhetsbrevet mangler innhold' }, 400)

    const mottakere = await hentMottakere(supabase)
    if (mottakere.length === 0) return json({ error: 'Ingen gyldige mottakere' }, 400)

    // 1. Opprett Brevo-liste
    const liste = await brevo(apiKey, '/contacts/lists', {
      method: 'POST',
      body: JSON.stringify({
        name: `CRM – ${nb.tittel} – ${new Date().toISOString().slice(0, 16)}`,
        folderId: 1,
      }),
    })
    const listId = liste.id

    // 2. Importer kontakter i batcher
    for (let i = 0; i < mottakere.length; i += 100) {
      const batch = mottakere.slice(i, i + 100)
      await brevo(apiKey, '/contacts/import', {
        method: 'POST',
        body: JSON.stringify({
          listIds: [listId],
          updateExistingContacts: true,
          emptyContactsAttributes: false,
          jsonBody: batch.map((m) => ({
            email: m.e_post,
            attributes: { FIRMANAVN: m.firmanavn ?? '' },
          })),
        }),
      })
    }

    // 3. Opprett kampanje
    const planlagt = nb.planlagt_dato && new Date(nb.planlagt_dato) > new Date() ? nb.planlagt_dato : null
    const campaign = await brevo(apiKey, '/emailCampaigns', {
      method: 'POST',
      body: JSON.stringify({
        name: nb.tittel,
        subject: nb.emne,
        sender: SENDER,
        type: 'classic',
        htmlContent: nb.innhold_html,
        recipients: { listIds: [listId] },
        ...(planlagt ? { scheduledAt: new Date(planlagt).toISOString() } : {}),
      }),
    })

    // 4. Send nå hvis ikke planlagt
    if (!planlagt) {
      await brevo(apiKey, `/emailCampaigns/${campaign.id}/sendNow`, { method: 'POST' })
    }

    // 5. Lagre snapshot + status
    await supabase.from('nyhetsbrev_mottakere').delete().eq('nyhetsbrev_id', nb.id)
    for (let i = 0; i < mottakere.length; i += 500) {
      await supabase.from('nyhetsbrev_mottakere').insert(
        mottakere.slice(i, i + 500).map((m) => ({
          nyhetsbrev_id: nb.id,
          e_post: m.e_post,
          firmanavn: m.firmanavn,
          kilde: m.kilde,
          kilde_id: m.kilde_id,
          status: 'sendt',
        }))
      )
    }

    await supabase
      .from('nyhetsbrev')
      .update({
        status: planlagt ? 'planlagt' : 'sendt',
        brevo_campaign_id: campaign.id,
        mottaker_antall: mottakere.length,
        sendt_dato: planlagt ? null : new Date().toISOString(),
      })
      .eq('id', nb.id)

    return json({ ok: true, antall: mottakere.length, planlagt: !!planlagt, campaign_id: campaign.id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('send-nyhetsbrev feilet:', msg)
    if (req.headers.get('x-nb-id')) {
      await supabase.from('nyhetsbrev').update({ status: 'feilet' }).eq('id', req.headers.get('x-nb-id'))
    }
    return json({ error: msg }, 500)
  }
})
