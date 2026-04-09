import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Snakk"
const BRAND_RED = '#c0392b'
const BRAND_DARK = '#1a1917'
const LOGO_URL = 'https://tchmujgzcklwgptocbno.supabase.co/storage/v1/object/public/email-assets/snakk-logo-dark.svg'

interface WelcomeCustomerProps {
  firmanavn?: string
  kontaktperson?: string
}

const WelcomeCustomerEmail = ({
  firmanavn = 'Kunde',
  kontaktperson,
}: WelcomeCustomerProps) => {
  return (
    <Html lang="no" dir="ltr">
      <Head>
        <style>{`
          @media only screen and (max-width: 480px) {
            .email-container { width: 100% !important; }
            .content-section { padding: 20px 16px !important; }
            .header-section { padding: 18px 0 !important; }
            .footer-section { padding: 16px 16px !important; }
          }
        `}</style>
      </Head>
      <Preview>Takk for signeringen, {kontaktperson || firmanavn}! 🎉</Preview>
      <Body style={main}>
        <Container style={container} className="email-container">
          {/* Header */}
          <Section style={headerSection} className="header-section">
            <Img src={LOGO_URL} alt="Snakk" width="120" height="auto" style={logoImg} />
          </Section>

          {/* Content */}
          <Section style={contentSection} className="content-section">
            <Heading style={h1}>
              Takk for signeringen, {kontaktperson || firmanavn}! 🎉
            </Heading>

            <Text style={text}>
              Vi er glade for å ha {firmanavn} med på laget! Vi har mottatt den signerte kontrakten og alt er i orden.
            </Text>

            <Text style={text}>
              Vi kontakter deg innen 1–2 dager med neste steg. I mellomtiden er det bare å ta kontakt om du har spørsmål.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footerSection} className="footer-section">
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
  component: WelcomeCustomerEmail,
  subject: (data: Record<string, any>) =>
    `Takk for signeringen, ${data.firmanavn || 'ny kunde'}! 🎉`,
  displayName: 'Velkomst-e-post til ny kunde',
  previewData: {
    firmanavn: 'Acme Corp',
    kontaktperson: 'Kari Nordmann',
  },
} satisfies TemplateEntry

// ── Styles ──
const main: React.CSSProperties = { backgroundColor: '#f5f4f2', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', padding: '8px 0' }
const container: React.CSSProperties = { maxWidth: '560px', margin: '0 auto', width: '100%' }
const headerSection: React.CSSProperties = { backgroundColor: '#ffffff', padding: '22px 0', textAlign: 'center', borderRadius: '8px 8px 0 0', borderBottom: `3px solid ${BRAND_RED}` }
const logoImg: React.CSSProperties = { margin: '0 auto', display: 'block' }
const contentSection: React.CSSProperties = { backgroundColor: '#ffffff', padding: '24px 28px' }
const h1: React.CSSProperties = { fontSize: '22px', fontWeight: 700, color: BRAND_DARK, margin: '0 0 16px' }
const text: React.CSSProperties = { fontSize: '14px', color: '#555555', lineHeight: '1.6', margin: '0 0 14px' }
const footerSection: React.CSSProperties = { padding: '18px 28px', textAlign: 'center', borderRadius: '0 0 8px 8px', backgroundColor: '#ffffff', borderTop: `2px solid ${BRAND_RED}` }
const footerText: React.CSSProperties = { fontSize: '12px', color: '#999999', margin: '0 0 4px' }
const footerCopy: React.CSSProperties = { fontSize: '11px', color: '#bbbbbb', margin: '6px 0 0' }
