// Leser lead-notater og avgjør hvilke Snakk-produkter leadet faktisk er ute etter.
// Bruker Lovable AI Gateway (Responses API, streaming, strengt JSON).

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/responses'
const MODEL = 'openai/gpt-6-astra'

export const PRODUKTER = ['Telefon', 'Chat', 'Møter', 'E-post'] as const
export type Produkt = typeof PRODUKTER[number]

export interface ProduktVurdering {
  produkter: Produkt[]
  oppsummering: string
}

/** Kastes når gatewayen sier stopp (402/403) – kalleren pauser hele kjøringen. */
export class ProduktAiStopp extends Error {
  status: number
  constructor(status: number, melding: string) {
    super(melding)
    this.status = status
  }
}

const skjema = {
  type: 'object',
  additionalProperties: false,
  required: ['produkter', 'oppsummering'],
  properties: {
    produkter: {
      type: 'array',
      items: { type: 'string', enum: [...PRODUKTER] },
    },
    oppsummering: { type: 'string' },
  },
}

const SYSTEM =
  'Du leser notater og skjemasvar om innkommende leads til Snakk Teknologi AS, som selger fire ting: ' +
  'Telefon (AI som tar telefonen og håndterer anrop), Chat (AI-chat på nettsiden), ' +
  'Møter (AI-møtereferat og transkribering av møter i Teams, Zoom, Meet, Webex) og ' +
  'E-post (AI som svarer på e-post i innboksen). ' +
  'Velg kun produktene leadet faktisk er ute etter, ut fra hva de har skrevet. ' +
  'Nevner de en møteløsning (Teams, Zoom, Google Meet, Webex) eller referat/transkribering, er det Møter. ' +
  'Ikke ta med et produkt bare fordi ordet står i et kontaktfelt som «e-post» eller «telefonnummer». ' +
  'Er det umulig å se hva de vil ha, returner en tom liste. ' +
  '"oppsummering" er én kort setning på norsk (bokmål) om hva de ønsker hjelp med, ' +
  'skrevet til selgeren, maks 15 ord. Ikke finn på noe som ikke står i teksten.'

/** Returnerer null når vurderingen ikke kunne gjøres. Kaster ProduktAiStopp ved 402/403. */
export async function vurderProduktInteresse(tekst: string): Promise<ProduktVurdering | null> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  if (!apiKey) return null

  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Lovable-API-Key': apiKey,
      'X-Lovable-AIG-SDK': 'fetch',
    },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      reasoning: { effort: 'low', summary: 'auto' },
      instructions: SYSTEM,
      input: [{ role: 'user', content: [{ type: 'input_text', text: tekst.slice(0, 6000) }] }],
      text: { format: { type: 'json_schema', name: 'produkt_interesse', strict: true, schema: skjema } },
    }),
  })

  if (res.status === 402 || res.status === 403) {
    throw new ProduktAiStopp(res.status, (await res.text().catch(() => '')).slice(0, 300))
  }
  if (!res.ok) {
    console.error('lead-produkt gateway error', res.status, (await res.text().catch(() => '')).slice(0, 300))
    return null
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      try {
        const evt = JSON.parse(payload)
        if (evt.type === 'response.output_text.delta' && typeof evt.delta === 'string') text += evt.delta
        else if (evt.type === 'response.completed' && !text && evt.response?.output_text) text = String(evt.response.output_text)
      } catch { /* ufullstendig event */ }
    }
  }

  if (!text.trim()) return null
  try {
    const parsed = JSON.parse(text)
    const produkter = (parsed.produkter || [])
      .map((p: unknown) => String(p))
      .filter((p: string): p is Produkt => (PRODUKTER as readonly string[]).includes(p))
    return { produkter, oppsummering: String(parsed.oppsummering || '').trim() }
  } catch {
    return null
  }
}
