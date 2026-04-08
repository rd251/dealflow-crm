import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Snakk"
const BRAND_RED = '#c0392b'
const BRAND_DARK = '#1a1917'
const LOGO_URL = 'https://tchmujgzcklwgptocbno.supabase.co/storage/v1/object/public/email-assets/snakk-logo-dark.svg'
const APP_URL = 'https://snakk-ai-crm.lovable.app'

interface WelcomeCustomerProps {
  firmanavn?: string
  kontaktperson?: string
  ansvarlig?: string
  ansvarlig_epost?: string
  prosjekt_id?: string
}

const WelcomeCustomerEmail = ({
  firmanavn = 'Kunde',
  kontaktperson,
  ansvarlig,
  ansvarlig_epost,
  prosjekt_id,
}: WelcomeCustomerProps) => {
  const onboardingUrl = prosjekt_id
    ? `${APP_URL}/onboarding?prosjekt=${prosjekt_id}`
    : `${APP_URL}/onboarding`

  return (
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
              Velkommen, {kontaktperson || firmanavn}! 🎉
            </Heading>

            <Text style={text}>
              Vi er glade for å ha {firmanavn} med på laget. Her er hva som skjer videre:
            </Text>

            <Hr style={divider} />

            {/* Step 1 */}
            <Section style={stepBox}>
              <Text style={stepItem}>
                <span style={stepNumber}>1</span>
                <span style={stepContent}>
                  <span style={stepTitle}>Fyll ut onboarding-skjema</span>
                  <span style={stepDesc}>Hjelper oss å forstå virksomheten din og trene agenten riktig.</span>
                </span>
              </Text>
            </Section>

            <Section style={{ textAlign: 'center', margin: '4px 0 20px' }}>
              <Button style={ctaButton} className="cta-button" href={onboardingUrl}>
                Start skjema →
              </Button>
            </Section>

            {/* Step 2 */}
            <Section style={stepBox}>
              <Text style={stepItem}>
                <span style={stepNumber}>2</span>
                <span style={stepContent}>
                  <span style={stepTitle}>Vi setter opp agenten din</span>
                  <span style={stepDesc}>Teamet vårt konfigurerer og trener AI-agenten basert på informasjonen du gir oss.</span>
                </span>
              </Text>
            </Section>

            {/* Step 3 */}
            <Section style={stepBox}>
              <Text style={stepItem}>
                <span style={stepNumber}>3</span>
                <span style={stepContent}>
                  <span style={stepTitle}>Test og go live</span>
                  <span style={stepDesc}>Du får tilgang til å teste agenten før den går live. Vi er der hele veien.</span>
                </span>
              </Text>
            </Section>

            {ansvarlig && (
              <>
                <Hr style={divider} />
                <Text style={text}>
                  Din kontaktperson hos Snakk er <strong>{ansvarlig}</strong>.
                  {ansvarlig_epost ? ` Ta gjerne kontakt på ${ansvarlig_epost}.` : ' Ikke nøl med å ta kontakt!'}
                </Text>
              </>
            )}
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
    `Velkommen som kunde, ${data.firmanavn || 'ny kunde'}! 🎉`,
  displayName: 'Velkomst-e-post til ny kunde',
  previewData: {
    firmanavn: 'Acme Corp',
    kontaktperson: 'Kari Nordmann',
    ansvarlig: 'Robin',
    ansvarlig_epost: 'robin@snakk.ai',
    prosjekt_id: 'abc-123',
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

const stepBox: React.CSSProperties = { padding: '0', marginBottom: '8px' }
const stepItem: React.CSSProperties = { fontSize: '14px', color: '#555555', margin: '0', lineHeight: '1.5', display: 'flex', alignItems: 'flex-start' }
const stepNumber: React.CSSProperties = {
  display: 'inline-block', width: '28px', height: '28px', borderRadius: '50%',
  backgroundColor: BRAND_RED, color: '#ffffff', fontSize: '13px', fontWeight: 700,
  textAlign: 'center', lineHeight: '28px', marginRight: '14px', flexShrink: 0,
}
const stepContent: React.CSSProperties = { display: 'inline-flex', flexDirection: 'column' }
const stepTitle: React.CSSProperties = { fontWeight: 700, color: BRAND_DARK, fontSize: '14px' }
const stepDesc: React.CSSProperties = { fontSize: '13px', color: '#777', marginTop: '2px' }

const ctaButton: React.CSSProperties = {
  backgroundColor: BRAND_RED, color: '#ffffff', padding: '14px 28px',
  borderRadius: '8px', fontSize: '14px', fontWeight: 600,
  textDecoration: 'none', display: 'inline-block', textAlign: 'center',
}

const footerSection: React.CSSProperties = { padding: '18px 28px', textAlign: 'center', borderRadius: '0 0 8px 8px', backgroundColor: '#ffffff', borderTop: `2px solid ${BRAND_RED}` }
const footerText: React.CSSProperties = { fontSize: '12px', color: '#999999', margin: '0 0 4px' }
const footerCopy: React.CSSProperties = { fontSize: '11px', color: '#bbbbbb', margin: '6px 0 0' }
