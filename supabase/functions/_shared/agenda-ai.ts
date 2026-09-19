// Delt AI-hjelper for kommersiell prioritering (ukesagenda + daglig brief).
// Kaller Lovable AI Gateway Responses API med streaming og strengt JSON-skjema.

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/responses'
const MODEL = 'openai/gpt-6-astra'

export interface AgendaPunkt {
  tittel: string
  selskap: string | null
  hvorfor: string
  handling: string
  risiko: string | null
  lenke: string | null
}

export interface AgendaResultat {
  oppsummering: string
  agenda: AgendaPunkt[]
  risikoer: string[]
}

const agendaSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['oppsummering', 'agenda', 'risikoer'],
  properties: {
    oppsummering: { type: 'string' },
    agenda: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['tittel', 'selskap', 'hvorfor', 'handling', 'risiko', 'lenke'],
        properties: {
          tittel: { type: 'string' },
          selskap: { type: ['string', 'null'] },
          hvorfor: { type: 'string' },
          handling: { type: 'string' },
          risiko: { type: ['string', 'null'] },
          lenke: { type: ['string', 'null'] },
        },
      },
    },
    risikoer: { type: 'array', items: { type: 'string' } },
  },
}

export class AgendaAiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/**
 * Ber modellen rangere kommersielle prioriteringer.
 * Kaster AgendaAiError ved gateway-feil – kaller må falle tilbake på regelbasert liste.
 */
export async function rangerAgenda(
  systemPrompt: string,
  kontekst: unknown,
  maksPunkter: number,
): Promise<AgendaResultat> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  if (!apiKey) throw new AgendaAiError(401, 'Mangler LOVABLE_API_KEY')

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
      instructions: systemPrompt,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text:
                `Her er CRM-dataene som json:\n${JSON.stringify(kontekst)}\n\n` +
                `Gi maks ${maksPunkter} agendapunkter, rangert viktigst først. ` +
                `Hvert punkt må være konkret: navngi selskap/person, si nøyaktig hva som skal gjøres, ` +
                `og bruk "lenke"-feltet fra dataene når det finnes. ` +
                `Ikke finn på tall, navn eller avtaler som ikke står i dataene. Svar på norsk (bokmål).`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'kommersiell_agenda',
          strict: true,
          schema: agendaSchema,
        },
      },
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new AgendaAiError(res.status, body.slice(0, 500))
  }

  // Les SSE-strømmen og samle output_text-deltaene.
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
        if (evt.type === 'response.output_text.delta' && typeof evt.delta === 'string') {
          text += evt.delta
        } else if (evt.type === 'response.completed' && !text && evt.response?.output_text) {
          text = String(evt.response.output_text)
        }
      } catch {
        // ignorer ufullstendige eventer
      }
    }
  }

  if (!text.trim()) throw new AgendaAiError(502, 'Tomt svar fra modellen')

  let parsed: AgendaResultat
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new AgendaAiError(502, 'Kunne ikke tolke svaret som json')
  }

  return {
    oppsummering: String(parsed.oppsummering || '').trim(),
    agenda: (parsed.agenda || []).slice(0, maksPunkter).map((p) => ({
      tittel: String(p.tittel || '').trim(),
      selskap: p.selskap ? String(p.selskap) : null,
      hvorfor: String(p.hvorfor || '').trim(),
      handling: String(p.handling || '').trim(),
      risiko: p.risiko ? String(p.risiko) : null,
      lenke: p.lenke ? String(p.lenke) : null,
    })).filter((p) => p.tittel && p.handling),
    risikoer: (parsed.risikoer || []).map((r) => String(r).trim()).filter(Boolean).slice(0, 8),
  }
}
