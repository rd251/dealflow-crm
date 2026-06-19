import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Img, Row, Column,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const BRAND_RED = '#c0392b'
const BRAND_DARK = '#1a1917'
const LOGO_URL = 'https://tchmujgzcklwgptocbno.supabase.co/storage/v1/object/public/email-assets/snakk-logo-full.svg'

interface Props {
  partner_navn?: string
  lead_firmanavn?: string
  lead_kontaktperson?: string
  lead_epost?: string
  lead_telefon?: string
  lead_rolle?: string
  lead_kilde?: string
  lead_use_case?: string
  lead_notater?: string
  har_byggeagent?: boolean
  onboarding_oppsummering?: string
  videresendt_av?: string
  intern_melding?: string
}

const LeadForwardedToPartnerEmail = ({
  partner_navn = 'Partner',
  lead_firmanavn = '',
  lead_kontaktperson = '',
  lead_epost = '',
  lead_telefon = '',
  lead_rolle = '',
  lead_kilde = '',
  lead_use_case = '',
  lead_notater = '',
  har_byggeagent = false,
  onboarding_oppsummering = '',
  videresendt_av = '',
  intern_melding = '',
}: Props) => {
  return (
    <Html lang="no" dir="ltr">
      <Head />
      <Preview>Nytt lead videresendt til deg: {lead_firmanavn}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={headerSection}>
            <Img src={LOGO_URL} alt="Snakk" width="120" height="auto" style={logoImg} />
          </Section>

          <Section style={contentSection}>
            <Heading style={h1}>Nytt lead til {partner_navn}</Heading>
            <Text style={text}>
              Hei! Vi har et nytt lead vi tror passer for dere. Under finner du
              all kontaktinfo og bakgrunn vi har på leaden så langt.
            </Text>

            {intern_melding && (
              <Section style={messageBox}>
                <Text style={messageLabel}>Melding fra Snakk</Text>
                <Text style={messageText}>{intern_melding}</Text>
              </Section>
            )}

            <Hr style={hr} />

            <Heading as="h2" style={h2}>Kontaktinformasjon</Heading>
            <Row>
              <Column style={fieldCol}><Text style={fieldLabel}>Firma</Text><Text style={fieldValue}>{lead_firmanavn || '–'}</Text></Column>
              <Column style={fieldCol}><Text style={fieldLabel}>Kontaktperson</Text><Text style={fieldValue}>{lead_kontaktperson || '–'}</Text></Column>
            </Row>
            <Row>
              <Column style={fieldCol}><Text style={fieldLabel}>E-post</Text><Text style={fieldValue}>{lead_epost || '–'}</Text></Column>
              <Column style={fieldCol}><Text style={fieldLabel}>Telefon</Text><Text style={fieldValue}>{lead_telefon || '–'}</Text></Column>
            </Row>
            {lead_rolle && (
              <Row><Column style={fieldCol}><Text style={fieldLabel}>Rolle i firma</Text><Text style={fieldValue}>{lead_rolle}</Text></Column></Row>
            )}

            <Hr style={hr} />

            <Heading as="h2" style={h2}>Om leaden</Heading>
            <Row>
              <Column style={fieldCol}><Text style={fieldLabel}>Kilde</Text><Text style={fieldValue}>{lead_kilde || '–'}</Text></Column>
              <Column style={fieldCol}>
                <Text style={fieldLabel}>Byggeagent via selvbygger</Text>
                <Text style={fieldValue}>{har_byggeagent ? 'Ja – har startet i selvbyggeren' : 'Nei'}</Text>
              </Column>
            </Row>
            {lead_use_case && (
              <Row><Column style={fieldCol}><Text style={fieldLabel}>Use case</Text><Text style={fieldValue}>{lead_use_case}</Text></Column></Row>
            )}
            {lead_notater && (
              <Row><Column style={fieldCol}><Text style={fieldLabel}>Notater</Text><Text style={fieldValueMulti}>{lead_notater}</Text></Column></Row>
            )}

            {onboarding_oppsummering && (
              <>
                <Hr style={hr} />
                <Heading as="h2" style={h2}>Svar fra selvbyggeren</Heading>
                <Text style={fieldValueMulti}>{onboarding_oppsummering}</Text>
              </>
            )}

            <Hr style={hr} />
            <Text style={footerNote}>
              Videresendt {videresendt_av ? `av ${videresendt_av}` : ''}. Ta gjerne kontakt
              direkte med leaden, og gi oss en oppdatering når dere har snakket sammen.
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
  component: LeadForwardedToPartnerEmail,
  subject: (data: Record<string, any>) =>
    `Nytt lead videresendt: ${data.lead_firmanavn || 'nytt firma'}`,
  displayName: 'Lead videresendt til partner',
  previewData: {
    partner_navn: 'Acme Partner',
    lead_firmanavn: 'Bergen Eiendom AS',
    lead_kontaktperson: 'Lise Berg',
    lead_epost: 'lise@bergeneiendom.no',
    lead_telefon: '+47 902 55 666',
    lead_rolle: 'Daglig leder',
    lead_kilde: 'Nettside',
    lead_use_case: 'Support agent for kundehenvendelser',
    lead_notater: 'Henvist fra Defigo, vurderer AI-agent for chat.',
    har_byggeagent: true,
    onboarding_oppsummering: 'Beskrev agentens oppgaver, vanlige spørsmål og åpningstider.',
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
