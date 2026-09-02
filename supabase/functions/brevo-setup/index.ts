import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const GATEWAY = 'https://connector-gateway.lovable.dev/brevo'
const FOLDER_NAME = 'Snakk AI CRM'
const LIST_NAME = 'Snakk AI – Alle leads'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TEST_HINTS = ['test@', 'test.', 'example.com', 'noreply', 'no-reply', 'dummy', 'ingen@', 'mailinator', 'yopmail']

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function brevo(path: string, init: RequestInit = {}) {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY')
  const connectionKey = Deno.env.get('BREVO_API_KEY')
  if (!lovableKey) throw new Error('LOVABLE_API_KEY is not configured')
  if (!connectionKey) throw new Error('BREVO_API_KEY is not configured')

  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      'X-Connection-Api-Key': connectionKey,
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

function gyldig(e?: string | null): boolean {
  const v = (e || '').trim().toLowerCase()
  if (!EMAIL_RE.test(v)) return false
  if (v.endsWith('@snakk.ai')) return false
  if (TEST_HINTS.some((t) => v.includes(t))) return false
  return true
}

async function finnEllerOpprettMappe(): Promise<number> {
  const eksisterende = await brevo('/v3/contacts/folders?limit=50&offset=0')
  const treff = (eksisterende?.folders || []).find((f: any) => f.name === FOLDER_NAME)
  if (treff) return treff.id
  const ny = await brevo('/v3/contacts/folders', {
    method: 'POST',
    body: JSON.stringify({ name: FOLDER_NAME }),
  })
  return ny.id
}

async function finnEllerOpprettListe(folderId: number): Promise<number> {
  const eksisterende = await brevo(`/v3/contacts/folders/${folderId}/lists?limit=50&offset=0`)
  const treff = (eksisterende?.lists || []).find((l: any) => l.name === LIST_NAME)
  if (treff) return treff.id
  const ny = await brevo('/v3/contacts/lists', {
    method: 'POST',
    body: JSON.stringify({ name: LIST_NAME, folderId }),
  })
  return ny.id
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const folderId = await finnEllerOpprettMappe()
    const listId = await finnEllerOpprettListe(folderId)

    await supabase
      .from('app_settings')
      .upsert({ key: 'brevo_list_id', value: String(listId) }, { onConflict: 'key' })
    await supabase
      .from('app_settings')
      .upsert({ key: 'brevo_folder_id', value: String(folderId) }, { onConflict: 'key' })

    const [leads, ringeliste, avmeldte] = await Promise.all([
      supabase.from('leads').select('e_post, kontaktperson, firmanavn, status'),
      supabase.from('ringeliste').select('e_post, navn, selskap'),
      supabase.from('nyhetsbrev_avmeldte').select('e_post'),
    ])

    const blokkert = new Set((avmeldte.data || []).map((a: any) => (a.e_post || '').toLowerCase()))
    const map = new Map<string, { email: string; FIRSTNAME: string; COMPANY: string }>()
    const add = (e: string, navn?: string | null, firma?: string | null) => {
      const key = (e || '').trim().toLowerCase()
      if (!gyldig(key) || blokkert.has(key) || map.has(key)) return
      map.set(key, {
        email: key,
        FIRSTNAME: (navn || '').trim().split(' ')[0] || '',
        COMPANY: (firma || '').trim(),
      })
    }

    for (const l of leads.data || []) {
      if (l.status === 'Ikke aktuelt') continue
      add(l.e_post, l.kontaktperson, l.firmanavn)
    }
    for (const r of ringeliste.data || []) add(r.e_post, r.navn, r.selskap)

    const kontakter = Array.from(map.values())
    if (kontakter.length) {
      await brevo('/v3/contacts/import', {
        method: 'POST',
        body: JSON.stringify({
          listIds: [listId],
          updateExistingContacts: true,
          emptyContactsAttributes: false,
          jsonBody: kontakter.map((k) => ({
            email: k.email,
            attributes: { FIRSTNAME: k.FIRSTNAME, COMPANY: k.COMPANY },
          })),
        }),
      })
    }

    return json({ liste_id: listId, folder_id: folderId, antall_importert: kontakter.length })
  } catch (e) {
    console.error('brevo-setup error', e)
    return json({ error: e instanceof Error ? e.message : 'Ukjent feil' }, 500)
  }
})
