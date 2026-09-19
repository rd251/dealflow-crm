import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr, Img, Link,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const BRAND_RED = '#da291c'
const LOGO_URL = 'https://tchmujgzcklwgptocbno.supabase.co/storage/v1/object/public/email-assets/snakk-logo-dark.svg'
const APP_URL_DEFAULT = 'https://snakk-ai-crm.lovable.app'

interface AgendaPunkt {
  tittel: string
  selskap?: string | null
  hvorfor: string
  handling: string
  risiko?: string | null
  lenke?: string | null
}

interface Props {
  displayName?: string
  oppsummering?: string
  agenda?: AgendaPunkt[]
  risikoer?: string[]
  pipelineVerdi?: number
  antallDeals?: number
  antallLeads?: number
  antallLanseringer?: number
  antallForfalte?: number
  appUrl?: string
}

const nok = (v: number | null | undefined) =>
  v != null ? v.toLocaleString('no-NO') + ' kr' : '–'

const WeeklyPriorities = ({
  displayName = 'der',
  oppsummering = '',
  agenda = [],
  risikoer = [],
  pipelineVerdi = 0,
  antallDeals = 0,
  antallLeads = 0,
  antallLanseringer = 0,
  antallForfalte = 0,
  appUrl = APP_URL_DEFAULT,
}: Props) => (
  <Html lang="no" dir="ltr">
    <Head />
    <Preview>{`Ukens prioriteringer: ${agenda.length} punkter · ${nok(pipelineVerdi)} i pipeline`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Img src={LOGO_URL} alt="Snakk" width="120" height="auto" style={{ margin: '0 auto', display: 'block' }} />
        </Section>

        <Section style={contentSection}>
          <Heading style={h1}>Ukens prioriteringer, {displayName}</Heading>
          {oppsummering && <Text style={summaryText}>{oppsummering}</Text>}

          <Section style={statRow}>
            <Text style={statText}>
              {antallDeals} salgsmuligheter · {nok(pipelineVerdi)} i pipeline · {antallLeads} leads
              {antallLanseringer > 0 ? ` · ${antallLanseringer} lanseringer` : ''}
              {antallForfalte > 0 ? ` · ${antallForfalte} forfalte frister` : ''}
            </Text>
          </Section>

          <Hr style={divider} />
          <Heading as="h2" style={sectionHeading}>Agenda – viktigst først</Heading>

          {agenda.map((p, i) => (
            <Section key={i} style={card}>
              <Text style={rankRow}>
                <span style={rankBadge}>{i + 1}</span>
                <span style={cardTitle}>{p.tittel}</span>
              </Text>
              {p.selskap && <Text style={metaText}>{p.selskap}</Text>}
              <Text style={whyText}>{p.hvorfor}</Text>
              <Text style={actionText}>→ {p.handling}</Text>
              {p.risiko && <Text style={riskText}>⚠️ {p.risiko}</Text>}
              {p.lenke && (
                <Text style={{ margin: '8px 0 0' }}>
                  <Link href={p.lenke} style={linkStyle}>Åpne i CRM</Link>
                </Text>
              )}
            </Section>
          ))}

          {risikoer.length > 0 && (
            <>
              <Hr style={divider} />
              <Heading as="h2" style={sectionHeading}>Står i fare for å skli</Heading>
              <Section style={riskBox}>
                {risikoer.map((r, i) => (
                  <Text key={i} style={riskItem}>⚠️ {r}</Text>
                ))}
              </Section>
            </>
          )}

          <Hr style={divider} />
          <Section style={{ textAlign: 'center' }}>
            <Button style={ctaButton} href={`${appUrl}/dashboard`}>Åpne CRM</Button>
          </Section>
        </Section>

        <Section style={footerSection}>
          <Text style={footerText}>Snakk CRM – ukentlig kommersiell agenda</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WeeklyPriorities,
  subject: (data: Record<string, any>) => {
    const n = (data.agenda || []).length
    const forfalte = data.antallForfalte || 0
    return forfalte > 0
      ? `Ukens ${n} prioriteringer · ${forfalte} forfalte`
      : `Ukens ${n} prioriteringer`
  },
  displayName: 'Ukentlig prioriteringsagenda',
  previewData: {
    displayName: 'Robin',
    oppsummering: 'To kontrakter kan lukkes denne uken, og én kundelansering står stille.',
    pipelineVerdi: 323760,
    antallDeals: 12,
    antallLeads: 34,
    antallLanseringer: 3,
    antallForfalte: 2,
    agenda: [
      { tittel: 'Lukk kontrakten med Acme Corp', selskap: 'Acme Corp', hvorfor: 'Kontrakt sendt for 9 dager siden, ingen svar', handling: 'Ring Kari Nordmann i dag og be om signering før fredag', risiko: 'Lukkedato 5. april ryker', lenke: 'https://snakk-ai-crm.lovable.app/salgsmuligheter' },
      { tittel: 'Få Trale.ai live', selskap: 'Trale.ai', hvorfor: 'Lansering planlagt om 4 dager, integrasjon ikke bekreftet', handling: 'Avtal 20 min teknisk sjekk med Ola tirsdag', risiko: null, lenke: 'https://snakk-ai-crm.lovable.app/prosjekter' },
    ],
    risikoer: ['FjordTech: 14 dager uten aktivitet i Demo-prosjekt'],
    appUrl: 'https://snakk-ai-crm.lovable.app',
  },
} satisfies TemplateEntry

const main: React.CSSProperties = { backgroundColor: '#f5f4f2', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', padding: '8px 0' }
const container: React.CSSProperties = { maxWidth: '560px', margin: '0 auto', width: '100%' }
const headerSection: React.CSSProperties = { backgroundColor: '#ffffff', padding: '22px 0', textAlign: 'center', borderRadius: '8px 8px 0 0', borderBottom: `3px solid ${BRAND_RED}` }
const contentSection: React.CSSProperties = { backgroundColor: '#ffffff', padding: '24px 28px' }
const h1: React.CSSProperties = { fontSize: '20px', fontWeight: 700, color: '#1a1917', margin: '0 0 8px' }
const summaryText: React.CSSProperties = { fontSize: '14px', color: '#44403c', margin: '0 0 12px', lineHeight: '20px' }
const statRow: React.CSSProperties = { backgroundColor: '#faf9f7', borderRadius: '8px', padding: '10px 12px' }
const statText: React.CSSProperties = { fontSize: '13px', color: '#57534e', margin: 0 }
const divider: React.CSSProperties = { borderColor: '#eae7e3', margin: '20px 0' }
const sectionHeading: React.CSSProperties = { fontSize: '15px', fontWeight: 700, color: '#1a1917', margin: '0 0 12px' }
const card: React.CSSProperties = { backgroundColor: '#ffffff', border: '1px solid #eae7e3', borderRadius: '8px', padding: '12px 14px', margin: '0 0 10px' }
const rankRow: React.CSSProperties = { margin: '0 0 4px' }
const rankBadge: React.CSSProperties = { display: 'inline-block', backgroundColor: BRAND_RED, color: '#ffffff', borderRadius: '10px', fontSize: '11px', fontWeight: 700, padding: '2px 8px', marginRight: '8px' }
const cardTitle: React.CSSProperties = { fontSize: '15px', fontWeight: 600, color: '#1a1917' }
const metaText: React.CSSProperties = { fontSize: '12px', color: '#78716c', margin: '0 0 4px' }
const whyText: React.CSSProperties = { fontSize: '13px', color: '#57534e', margin: '0 0 6px', lineHeight: '19px' }
const actionText: React.CSSProperties = { fontSize: '14px', fontWeight: 600, color: '#1a1917', margin: '0', lineHeight: '20px' }
const riskText: React.CSSProperties = { fontSize: '12px', color: '#b45309', margin: '6px 0 0' }
const riskBox: React.CSSProperties = { backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '12px 14px' }
const riskItem: React.CSSProperties = { fontSize: '13px', color: '#92400e', margin: '0 0 6px' }
const linkStyle: React.CSSProperties = { fontSize: '13px', color: BRAND_RED, fontWeight: 600 }
const ctaButton: React.CSSProperties = { backgroundColor: BRAND_RED, color: '#ffffff', borderRadius: '8px', fontSize: '14px', fontWeight: 600, padding: '12px 24px', textDecoration: 'none', display: 'inline-block' }
const footerSection: React.CSSProperties = { backgroundColor: '#ffffff', padding: '16px', textAlign: 'center', borderRadius: '0 0 8px 8px' }
const footerText: React.CSSProperties = { fontSize: '12px', color: '#a8a29e', margin: 0 }
