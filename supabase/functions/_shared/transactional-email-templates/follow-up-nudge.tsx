import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const BRAND_RED = '#da291c'
const BRAND_DARK = '#1a1917'
const LOGO_URL = 'https://tchmujgzcklwgptocbno.supabase.co/storage/v1/object/public/email-assets/snakk-logo-dark.svg'
const APP_URL_DEFAULT = 'https://snakk-ai.lovable.app'

export interface FollowUpNudgeProps {
  /** Fullt navn på personen som ikke har svart. */
  personNavn?: string
  selskap?: string | null
  dagerSiden?: number
  emne?: string
  begrunnelse?: string
  lenke?: string | null
  lenkeTekst?: string
  signaturNavn?: string
  signaturTittel?: string | null
  signaturSelskap?: string | null
  appUrl?: string
}

const FollowUpNudgeEmail = ({
  personNavn = 'kontakten',
  selskap = null,
  dagerSiden = 3,
  emne = '',
  begrunnelse = '',
  lenke = null,
  lenkeTekst = 'Åpne i CRM',
  signaturNavn = '',
  signaturTittel = null,
  signaturSelskap = null,
  appUrl = APP_URL_DEFAULT,
}: FollowUpNudgeProps) => {
  const knappeLenke = lenke || appUrl
  return (
    <Html lang="nb">
      <Head />
      <Preview>{`${personNavn} har ikke svart på ${dagerSiden} dager`}</Preview>
      <Body style={{ backgroundColor: '#faf9f7', fontFamily: 'Helvetica, Arial, sans-serif', margin: 0, padding: '24px 0' }}>
        <Container style={{ backgroundColor: '#ffffff', borderRadius: 12, maxWidth: 560, padding: '32px', border: '1px solid #ece9e4' }}>
          <Img src={LOGO_URL} alt="Snakk" width="96" style={{ marginBottom: 24 }} />

          <Heading style={{ color: BRAND_DARK, fontSize: 22, lineHeight: '30px', margin: '0 0 8px' }}>
            Følg opp {personNavn}
          </Heading>
          <Text style={{ color: '#6b6560', fontSize: 14, margin: '0 0 20px' }}>
            {selskap ? `${selskap} · ` : ''}
            Ingen svar på {dagerSiden} {dagerSiden === 1 ? 'dag' : 'dager'}
          </Text>

          {emne ? (
            <Section style={{ backgroundColor: '#faf9f7', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
              <Text style={{ color: '#6b6560', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 4px' }}>
                Saken gjelder
              </Text>
              <Text style={{ color: BRAND_DARK, fontSize: 15, fontWeight: 600, margin: 0 }}>{emne}</Text>
            </Section>
          ) : null}

          {begrunnelse ? (
            <Text style={{ color: BRAND_DARK, fontSize: 15, lineHeight: '24px', margin: '0 0 24px' }}>
              {begrunnelse}
            </Text>
          ) : null}

          <Button
            href={knappeLenke}
            style={{
              backgroundColor: BRAND_RED,
              borderRadius: 8,
              color: '#ffffff',
              display: 'inline-block',
              fontSize: 15,
              fontWeight: 600,
              padding: '12px 22px',
              textDecoration: 'none',
            }}
          >
            {lenkeTekst}
          </Button>

          <Hr style={{ borderColor: '#ece9e4', margin: '28px 0 16px' }} />

          <Text style={{ color: '#6b6560', fontSize: 13, lineHeight: '20px', margin: 0 }}>
            Vennlig hilsen
            <br />
            {signaturNavn}
            {signaturTittel ? <><br />{signaturTittel}</> : null}
            {signaturSelskap ? <><br />{signaturSelskap}</> : null}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template: TemplateEntry = {
  component: FollowUpNudgeEmail,
  displayName: 'Oppfølgingspåminnelse',
  subject: (data: Record<string, any>) => `Følg opp ${data?.personNavn || 'kontakten'}`,
  previewData: {
    personNavn: 'Kari Nordmann',
    selskap: 'Nordmann AS',
    dagerSiden: 3,
    emne: 'Bekreftelse av møtetidspunkt',
    begrunnelse:
      'Du ba dem bekrefte et tidspunkt for et kort introduksjonsmøte, noe som krever svar — følg opp hvis du ikke har fått svar.',
    lenke: 'https://snakk-ai.lovable.app/relasjoner',
    lenkeTekst: 'Åpne relasjonen',
    signaturNavn: 'Ola Nordmann',
    signaturTittel: 'Salgssjef',
    signaturSelskap: 'Snakk AI',
  },
}
