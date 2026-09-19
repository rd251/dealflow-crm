// Avgjør om en utgående e-post krever svar («venter på svar»).
// Kaller Lovable AI Gateway Responses API med streaming og strengt JSON-skjema.

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/responses'
const MODEL = 'openai/gpt-6-astra'

export interface VenterVurdering {
  venter: boolean
  emne: string
  begrunnelse: string
}

const skjema = {
  type: 'object',
  additionalProperties: false,
  required: ['venter', 'emne', 'begrunnelse'],
  properties: {
    venter: { type: 'boolean' },
    emne: { type: 'string' },
    begrunnelse: { type: 'string' },
  },
}

const SYSTEM =
  'Du vurderer utgående e-poster fra et norsk salgsteam. ' +
  'Sett "venter" til true kun når avsenderen ber om noe som krever et svar fra mottakeren: ' +
  'bekrefte et tidspunkt, ta en beslutning, sende et dokument, svare på et spørsmål. ' +
  'Sett false for rene informasjonsmeldinger, takk-for-møtet uten spørsmål, og automatiske meldinger. ' +
  '"emne" er en kort beskrivelse av hva samtalen handler om (maks 8 ord). ' +
  '"begrunnelse" er én setning på norsk (bokmål) som forklarer hvorfor det trenger oppfølging, ' +
  'formulert til avsenderen, for eksempel: "Du ba dem bekrefte et tidspunkt for et kort introduksjonsmøte, ' +
  'noe som krever svar — følg opp hvis du ikke har fått svar." Ikke finn på detaljer som ikke står i e-posten.'

/** Returnerer null når vurderingen ikke kunne gjøres – da markeres ingenting. */
export async function vurderVenterPaSvar(
  emne: string,
  tekst: string,
): Promise<VenterVurdering | null> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  if (!apiKey) return null

  try {
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
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: `Emne: ${emne}\n\nTekst:\n${tekst.slice(0, 6000)}`,
              },
            ],
          },
        ],
        text: {
          format: { type: 'json_schema', name: 'venter_pa_svar', strict: true, schema: skjema },
        },
      }),
    })

    if (!res.ok) {
      console.error('awaiting-reply gateway error', res.status, (await res.text()).slice(0, 300))
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

    if (!text.trim()) return null
    const parsed = JSON.parse(text)
    return {
      venter: !!parsed.venter,
      emne: String(parsed.emne || '').trim(),
      begrunnelse: String(parsed.begrunnelse || '').trim(),
    }
  } catch (e) {
    console.error('awaiting-reply feilet:', e)
    return null
  }
}

/** Registrerer «venter på svar» for en sendt e-post. Feiler aldri hardt. */
export async function registrerVenterPaSvar(
  supabase: any,
  args: {
    userId: string
    threadId: string
    emne: string
    tekst: string
    ePost?: string | null
    kontaktId?: string | null
    leadId?: string | null
    salgsmulighetId?: string | null
    selskapId?: string | null
    aktivitetId?: string | null
  },
): Promise<void> {
  if (!args.threadId) return
  const vurdering = await vurderVenterPaSvar(args.emne, args.tekst)
  if (!vurdering?.venter) return

  const { error } = await supabase.from('venter_pa_svar').upsert(
    {
      user_id: args.userId,
      thread_id: args.threadId,
      emne: vurdering.emne || args.emne,
      ai_begrunnelse: vurdering.begrunnelse,
      e_post: args.ePost ?? null,
      kontakt_id: args.kontaktId ?? null,
      lead_id: args.leadId ?? null,
      salgsmulighet_id: args.salgsmulighetId ?? null,
      selskap_id: args.selskapId ?? null,
      aktivitet_id: args.aktivitetId ?? null,
      sendt_dato: new Date().toISOString(),
      status: 'venter',
      varslet_at: null,
    },
    { onConflict: 'user_id,thread_id' },
  )
  if (error) console.error('Kunne ikke lagre venter_pa_svar:', error.message)
}
