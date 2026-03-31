/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

const BRAND_RED = '#da291c'
const BRAND_DARK = '#1a1917'
const LOGO_URL = 'https://tchmujgzcklwgptocbno.supabase.co/storage/v1/object/public/email-assets/snakk-logo.png'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="no" dir="ltr">
    <Head />
    <Preview>Din innloggingslenke for Snakk</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Img src={LOGO_URL} alt="Snakk" width="140" height="auto" style={logoImg} />
        </Section>
        <Section style={contentSection}>
          <Heading style={h1}>Din innloggingslenke</Heading>
          <Text style={text}>
            Klikk på knappen under for å logge inn på Snakk. Lenken utløper snart.
          </Text>
          <Button style={button} href={confirmationUrl}>
            Logg inn
          </Button>
          <Text style={footer}>
            Hvis du ikke ba om denne lenken, kan du trygt ignorere denne e-posten.
          </Text>
        </Section>
        <Section style={footerSection}>
          <Text style={footerBrand}>Snakk CRM</Text>
          <Text style={footerCopy}>©2026 Snakk. Alle rettigheter reservert.</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main: React.CSSProperties = { backgroundColor: '#f5f4f2', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container: React.CSSProperties = { maxWidth: '580px', margin: '0 auto' }
const headerSection: React.CSSProperties = { backgroundColor: BRAND_DARK, padding: '28px 0', textAlign: 'center', borderRadius: '8px 8px 0 0' }
const logoImg: React.CSSProperties = { margin: '0 auto', display: 'block' }
const contentSection: React.CSSProperties = { backgroundColor: '#ffffff', padding: '32px 40px' }
const h1: React.CSSProperties = { fontSize: '24px', fontWeight: 700, color: BRAND_DARK, margin: '0 0 16px' }
const text: React.CSSProperties = { fontSize: '15px', color: '#555555', lineHeight: '1.5', margin: '0 0 20px' }
const button: React.CSSProperties = { backgroundColor: BRAND_RED, color: '#ffffff', padding: '14px 32px', borderRadius: '12px', fontSize: '15px', fontWeight: 600, textDecoration: 'none', display: 'block', textAlign: 'center', width: '100%', boxSizing: 'border-box' }
const footer: React.CSSProperties = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
const footerSection: React.CSSProperties = { padding: '24px 40px', textAlign: 'center', borderRadius: '0 0 8px 8px' }
const footerBrand: React.CSSProperties = { fontSize: '13px', color: '#999999', margin: '0 0 4px' }
const footerCopy: React.CSSProperties = { fontSize: '12px', color: '#bbbbbb', margin: '0' }
