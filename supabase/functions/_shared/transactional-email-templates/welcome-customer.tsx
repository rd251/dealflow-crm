import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Snakk"
const BRAND_RED = '#da291c'
const BRAND_DARK = '#1a1917'
const LOGO_URL = 'https://tchmujgzcklwgptocbno.supabase.co/storage/v1/object/public/email-assets/snakk-logo-dark.svg'
const APP_URL = 'https://snakk-ai-crm.lovable.app'

interface WelcomeCustomerProps {
  firmanavn?: string
  kontaktperson?: string
  ansvarlig?: string
  prosjektnavn?: string
}

const WelcomeCustomerEmail = ({
  firmanavn = 'Kunde',
  kontaktperson,
  ansvarlig,
  prosjektnavn,
}: WelcomeCustomerProps) => (
  <Html lang="no" dir="ltr">
    <Head>
      <style>{`
        @media only screen and (max-width: 480px) {
          .email-container { width: 100% !important; }
          .content-section { padding: 20px 16px !important; }
          .header-section { padding: 18px 0 !important; }
          .footer-section { padding: 16px 16px !important; }
          .cta-button { padding: 12px 20px !important; font-size: 14px !important; }
        }
      `}</style>
    </Head>
    <Preview>Velkommen som kunde hos {SITE_NAME}! 🎉</Preview>
    <Body style={main}>
      <Container style={container} className="email-container">
        {/* Header */}
        <Section style={headerSection} className="header-section">
          <Img src={LOGO_URL} alt="Snakk" width="120" height="auto" style={logoImg} />
        </Section>

        {/* Content */}
        <Section style={contentSection} className="content-section">
          <Heading style={h1}>
            Velkommen som kunde, {firmanavn}! 🎉
          </Heading>

          <Text style={text}>
            {kontaktperson ? `Hei ${kontaktperson},` : 'Hei,'} 
          </Text>

          <Text style={text}>
            Vi er veldig glade for å ha dere med som kunde hos {SITE_NAME}. 
            Kontrakten er nå signert og vi er klare til å komme i gang!
          </Text>

          {prosjektnavn && (
            <Section style={highlightBox}>
              <Text style={highlightLabel}>Ditt onboarding-prosjekt</Text>
              <Text style={highlightValue}>{prosjektnavn}</Text>
            </Section>
          )}

          <Hr style={divider} />

          <Heading as="h2" style={sectionHeading}>Hva skjer videre?</Heading>

          <Section style={stepBox}>
            <Text style={stepItem}>
              <span style={stepNumber}>1</span>
              <span>Vi setter opp onboarding-prosjektet ditt</span>
            </Text>
            <Text style={stepItem}>
              <span style={stepNumber}>2</span>
              <span>Du vil bli kontaktet av din kundeansvarlig for oppstartsmøte</span>
            </Text>
            <Text style={stepItem}>
              <span style={stepNumber}>3</span>
              <span>Vi konfigurerer løsningen sammen</span>
            </Text>
            <Text style={stepItem}>
              <span style={stepNumber}>4</span>
              <span>Go live! 🚀</span>
            </Text>
          </Section>

          {ansvarlig && (
            <>
              <Hr style={divider} />
              <Text style={text}>
                Din kontaktperson hos oss er <strong>{ansvarlig}</strong>. 
                Ikke nøl med å ta kontakt om du har spørsmål!
              </Text>
            </>
          )}

          <Hr style={divider} />

          <Section style={{ textAlign: 'center', margin: '8px 0' }}>
            <Button style={ctaButton} className="cta-button" href={APP_URL}>
              Logg inn i Snakk
            </Button>
          </Section>
        </Section>

        {/* Footer */}
        <Section style={footerSection} className="footer-section">
          <Img src={LOGO_URL} alt="Snakk" width="80" height="auto" style={{ margin: '0 auto 8px' }} />
          <Text style={footerText}>Takk for tilliten – vi gleder oss til samarbeidet!</Text>
          <Text style={footerCopy}>©2026 Snakk. Alle rettigheter reservert.</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeCustomerEmail,
  subject: (data: Record<string, any>) =>
    `Velkommen som kunde, ${data.firmanavn || 'ny kunde'}! 🎉`,
  displayName: 'Velkomst-e-post til ny kunde',
  previewData: {
    firmanavn: 'Acme Corp',
    kontaktperson: 'Kari Nordmann',
    ansvarlig: 'Robin',
    prosjektnavn: 'Acme Corp – Onboarding',
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
const divider: React.CSSProperties = { borderColor: '#e8e6e3', margin: '18px 0' }
const sectionHeading: React.CSSProperties = { fontSize: '12px', fontWeight: 700, color: BRAND_DARK, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.5px' }

const highlightBox: React.CSSProperties = { backgroundColor: '#f8f7f5', borderRadius: '8px', padding: '14px 18px', borderLeft: `3px solid ${BRAND_RED}`, margin: '16px 0' }
const highlightLabel: React.CSSProperties = { fontSize: '11px', fontWeight: 600, color: '#999', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }
const highlightValue: React.CSSProperties = { fontSize: '16px', fontWeight: 700, color: BRAND_DARK, margin: '0' }

const stepBox: React.CSSProperties = { padding: '0' }
const stepItem: React.CSSProperties = { fontSize: '14px', color: '#555555', margin: '0 0 12px', lineHeight: '1.5', display: 'flex', alignItems: 'center' }
const stepNumber: React.CSSProperties = {
  display: 'inline-block', width: '24px', height: '24px', borderRadius: '50%',
  backgroundColor: BRAND_RED, color: '#ffffff', fontSize: '12px', fontWeight: 700,
  textAlign: 'center', lineHeight: '24px', marginRight: '12px', flexShrink: 0,
}

const ctaButton: React.CSSProperties = {
  backgroundColor: BRAND_RED, color: '#ffffff', padding: '14px 28px',
  borderRadius: '8px', fontSize: '14px', fontWeight: 600,
  textDecoration: 'none', display: 'inline-block', textAlign: 'center',
}

const footerSection: React.CSSProperties = { padding: '18px 28px', textAlign: 'center', borderRadius: '0 0 8px 8px', backgroundColor: '#ffffff', borderTop: `2px solid ${BRAND_RED}` }
const footerText: React.CSSProperties = { fontSize: '12px', color: '#999999', margin: '0 0 4px' }
const footerCopy: React.CSSProperties = { fontSize: '11px', color: '#bbbbbb', margin: '6px 0 0' }
