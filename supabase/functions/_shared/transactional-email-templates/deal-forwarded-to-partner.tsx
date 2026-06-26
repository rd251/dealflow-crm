import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Img, Row, Column,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const BRAND_RED = '#500000'
const BRAND_DARK = '#1a1917'
const LOGO_URL = 'https://tchmujgzcklwgptocbno.supabase.co/storage/v1/object/public/email-assets/snakk-logo-full.svg'

interface Props {
  partner_navn?: string
  deal_navn?: string
  selskap_firmanavn?: string
  kontaktperson?: string
  kontakt_epost?: string
  kontakt_telefon?: string
  kontakt_rolle?: string
  status?: string
  kilde?: string
  use_case?: string
  notater?: string
  forventet_mrr?: number
  oppstartskostnad?: number
  kontraktslengde_mnd?: number
  forventet_lukkedato?: string
  neste_steg?: string
  videresendt_av?: string
  intern_melding?: string
}

const fmtNok = (n?: number) => typeof n === 'number' && !isNaN(n)
  ? new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(n)
  : '–'

const DealForwardedToPartnerEmail = ({
  partner_navn = 'Partner',
  deal_navn = '',
  selskap_firmanavn = '',
  kontaktperson = '',
  kontakt_epost = '',
  kontakt_telefon = '',
  kontakt_rolle = '',
  status = '',
  kilde = '',
  use_case = '',
  notater = '',
  forventet_mrr,
  oppstartskostnad,
  kontraktslengde_mnd,
  forventet_lukkedato = '',
  neste_steg = '',
  videresendt_av = '',
  intern_melding = '',
}: Props) => {
  return (
    <Html lang="no" dir="ltr">
      <Head />
      <Preview>Salgsmulighet videresendt til deg: {selskap_firmanavn || deal_navn}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={headerSection}>
            <Img src={LOGO_URL} alt="Snakk" width="120" height="auto" style={logoImg} />
          </Section>

          <Section style={contentSection}>
            <Heading style={h1}>Salgsmulighet videresendt til {partner_navn}</Heading>
            <Text style={text}>
              Hei! Vi har en salgsmulighet vi tror passer godt for dere. Under finner du
              all kontaktinfo, deal-detaljer og bakgrunn så langt.
            </Text>

            {intern_melding && (
              <Section style={messageBox}>
                <Text style={messageLabel}>Melding fra Snakk</Text>
                <Text style={messageText}>{intern_melding}</Text>
              </Section>
            )}

            <Hr style={hr} />

            <Heading as="h2" style={h2}>Salgsmulighet</Heading>
            <Row>
              <Column style={fieldCol}><Text style={fieldLabel}>Firma</Text><Text style={fieldValue}>{selskap_firmanavn || '–'}</Text></Column>
              <Column style={fieldCol}><Text style={fieldLabel}>Deal-navn</Text><Text style={fieldValue}>{deal_navn || '–'}</Text></Column>
            </Row>
            <Row>
              <Column style={fieldCol}><Text style={fieldLabel}>Status</Text><Text style={fieldValue}>{status || '–'}</Text></Column>
              <Column style={fieldCol}><Text style={fieldLabel}>Kilde</Text><Text style={fieldValue}>{kilde || '–'}</Text></Column>
            </Row>

            <Hr style={hr} />

            <Heading as="h2" style={h2}>Kontaktinformasjon</Heading>
            <Row>
              <Column style={fieldCol}><Text style={fieldLabel}>Kontaktperson</Text><Text style={fieldValue}>{kontaktperson || '–'}</Text></Column>
              <Column style={fieldCol}><Text style={fieldLabel}>Rolle</Text><Text style={fieldValue}>{kontakt_rolle || '–'}</Text></Column>
            </Row>
            <Row>
              <Column style={fieldCol}><Text style={fieldLabel}>E-post</Text><Text style={fieldValue}>{kontakt_epost || '–'}</Text></Column>
              <Column style={fieldCol}><Text style={fieldLabel}>Telefon</Text><Text style={fieldValue}>{kontakt_telefon || '–'}</Text></Column>
            </Row>

            <Hr style={hr} />

            <Heading as="h2" style={h2}>Økonomi</Heading>
            <Row>
              <Column style={fieldCol}><Text style={fieldLabel}>Forventet MRR</Text><Text style={fieldValue}>{fmtNok(forventet_mrr)}</Text></Column>
              <Column style={fieldCol}><Text style={fieldLabel}>Oppstartskostnad</Text><Text style={fieldValue}>{fmtNok(oppstartskostnad)}</Text></Column>
            </Row>
            <Row>
              <Column style={fieldCol}><Text style={fieldLabel}>Kontraktslengde</Text><Text style={fieldValue}>{kontraktslengde_mnd ? `${kontraktslengde_mnd} mnd` : '–'}</Text></Column>
              <Column style={fieldCol}><Text style={fieldLabel}>Forventet lukkedato</Text><Text style={fieldValue}>{forventet_lukkedato || '–'}</Text></Column>
            </Row>

            {(use_case || neste_steg || notater) && (
              <>
                <Hr style={hr} />
                <Heading as="h2" style={h2}>Bakgrunn</Heading>
                {use_case && (
                  <Row><Column style={fieldCol}><Text style={fieldLabel}>Use case</Text><Text style={fieldValue}>{use_case}</Text></Column></Row>
                )}
                {neste_steg && (
                  <Row><Column style={fieldCol}><Text style={fieldLabel}>Neste steg</Text><Text style={fieldValue}>{neste_steg}</Text></Column></Row>
                )}
                {notater && (
                  <Row><Column style={fieldCol}><Text style={fieldLabel}>Notater</Text><Text style={fieldValueMulti}>{notater}</Text></Column></Row>
                )}
              </>
            )}

            <Hr style={hr} />
            <Text style={footerNote}>
              Videresendt {videresendt_av ? `av ${videresendt_av}` : ''}. Ta gjerne kontakt
              direkte med kunden, og gi oss en oppdatering når dere har snakket sammen.
            </Text>
          </Section>

          <Section style={footerSection}>
            <Img src={LOGO_URL} alt="Snakk" width="80" height="auto" style={{ margin: '0 auto 8px' }} />
            <Text style={footerText}>Snakk Teknologi AS — snakk.ai</Text>
            <Text style={footerCopy}>©2026 Snakk. Alle rettigheter reservert.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: DealForwardedToPartnerEmail,
  subject: (data: Record<string, any>) =>
    `Salgsmulighet videresendt: ${data.selskap_firmanavn || data.deal_navn || 'ny deal'}`,
  displayName: 'Salgsmulighet videresendt til partner',
  previewData: {
    partner_navn: 'Acme Partner',
    deal_navn: 'Bergen Eiendom – Support agent',
    selskap_firmanavn: 'Bergen Eiendom AS',
    kontaktperson: 'Lise Berg',
    kontakt_epost: 'lise@bergeneiendom.no',
    kontakt_telefon: '+47 902 55 666',
    kontakt_rolle: 'Daglig leder',
    status: 'Behov avklart',
    kilde: 'Nettside',
    use_case: 'Support agent for kundehenvendelser',
    notater: 'Møte gjennomført, klar for tilbud.',
    forventet_mrr: 7500,
    oppstartskostnad: 25000,
    kontraktslengde_mnd: 12,
    forventet_lukkedato: '2026-08-15',
    neste_steg: 'Sende tilbud',
    videresendt_av: 'Snakk-teamet',
    intern_melding: 'Tror dette passer godt for dere – ta kontakt direkte.',
  },
} satisfies TemplateEntry

const main: React.CSSProperties = { backgroundColor: '#f5f4f2', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', padding: '8px 0' }
const container: React.CSSProperties = { maxWidth: '600px', margin: '0 auto', width: '100%' }
const headerSection: React.CSSProperties = { backgroundColor: '#ffffff', padding: '22px 0', textAlign: 'center', borderRadius: '8px 8px 0 0', borderBottom: `3px solid ${BRAND_RED}` }
const logoImg: React.CSSProperties = { margin: '0 auto', display: 'block' }
const contentSection: React.CSSProperties = { backgroundColor: '#ffffff', padding: '28px 28px' }
const h1: React.CSSProperties = { fontSize: '22px', fontWeight: 700, color: BRAND_DARK, margin: '0 0 12px' }
const h2: React.CSSProperties = { fontSize: '14px', fontWeight: 700, color: BRAND_DARK, margin: '8px 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }
const text: React.CSSProperties = { fontSize: '14px', color: '#555555', lineHeight: '1.6', margin: '0 0 14px' }
const hr: React.CSSProperties = { borderColor: '#eeeeee', margin: '20px 0' }
const fieldCol: React.CSSProperties = { padding: '6px 8px 6px 0', verticalAlign: 'top' }
const fieldLabel: React.CSSProperties = { fontSize: '11px', color: '#999999', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.4px' }
const fieldValue: React.CSSProperties = { fontSize: '14px', color: BRAND_DARK, margin: '0', fontWeight: 500 }
const fieldValueMulti: React.CSSProperties = { fontSize: '14px', color: '#333333', margin: '0', whiteSpace: 'pre-wrap', lineHeight: '1.5' }
const messageBox: React.CSSProperties = { backgroundColor: '#fdf4f3', borderLeft: `3px solid ${BRAND_RED}`, padding: '10px 14px', margin: '8px 0 16px', borderRadius: '4px' }
const messageLabel: React.CSSProperties = { fontSize: '11px', color: BRAND_RED, fontWeight: 600, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.4px' }
const messageText: React.CSSProperties = { fontSize: '14px', color: BRAND_DARK, margin: '0', whiteSpace: 'pre-wrap' }
const footerNote: React.CSSProperties = { fontSize: '12px', color: '#888888', fontStyle: 'italic', margin: '8px 0 0' }
const footerSection: React.CSSProperties = { padding: '18px 28px', textAlign: 'center', borderRadius: '0 0 8px 8px', backgroundColor: '#ffffff', borderTop: `2px solid ${BRAND_RED}` }
const footerText: React.CSSProperties = { fontSize: '12px', color: '#999999', margin: '0 0 4px' }
const footerCopy: React.CSSProperties = { fontSize: '11px', color: '#bbbbbb', margin: '6px 0 0' }
