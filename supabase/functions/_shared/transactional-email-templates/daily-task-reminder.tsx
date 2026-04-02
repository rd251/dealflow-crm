import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Snakk"
const BRAND_RED = '#da291c'
const BRAND_DARK = '#1a1917'
const LOGO_URL = 'https://tchmujgzcklwgptocbno.supabase.co/storage/v1/object/public/email-assets/snakk-logo-dark.svg'
const APP_URL_DEFAULT = 'https://snakk-ai-crm.lovable.app'

// ── Types ──

interface TaskItem {
  oppgave: string
  frist: string | null
  dagerForsinket: number
  ansvarlig: string | null
  prioritet: string | null
  selskap: string | null
  kontakt: string | null
}

interface MeetingItem {
  tittel: string
  start_tid: string | null
  slutt_tid: string | null
}

interface DealItem {
  navn: string
  selskap: string | null
  status: string | null
  forventetMrr: number | null
  forventetLukkedato: string | null
  kontaktperson: string | null
  nesteSteg: string | null
}

interface DailyBriefProps {
  displayName?: string
  prioritertIDag?: TaskItem[]
  overdueTasks?: TaskItem[]
  todayMeetings?: MeetingItem[]
  aktiveSalgsmuligheter?: DealItem[]
  anbefalinger?: string[]
  overdueCount?: number
  todayCount?: number
  meetingCount?: number
  dealCount?: number
  appUrl?: string
}

// ── Helpers ──

const nok = (v: number | null | undefined) =>
  v != null ? v.toLocaleString('no-NO') + ' kr' : '–'

const priorityLabel: Record<string, { emoji: string; color: string }> = {
  'Høy': { emoji: '🔴', color: BRAND_RED },
  'Medium': { emoji: '🟡', color: '#d97706' },
  'Lav': { emoji: '🟢', color: '#16a34a' },
}

// ── Component ──

const DailyBriefEmail = ({
  displayName = 'der',
  prioritertIDag = [],
  overdueTasks = [],
  todayMeetings = [],
  aktiveSalgsmuligheter = [],
  anbefalinger = [],
  overdueCount = 0,
  todayCount = 0,
  meetingCount = 0,
  dealCount = 0,
  appUrl = APP_URL_DEFAULT,
}: DailyBriefProps) => {
  const parts: string[] = []
  if (overdueCount > 0) parts.push(`⚠️ ${overdueCount} forfalte`)
  if (todayCount > 0) parts.push(`${todayCount} i dag`)
  if (dealCount > 0) parts.push(`${dealCount} aktive deals`)
  const previewText = parts.length > 0 ? parts.join(' · ') : 'Din daglige salgsbrief'

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
            .h1-heading { font-size: 18px !important; }
            .logo-img { width: 110px !important; }
            .footer-logo { width: 60px !important; }
          }
        `}</style>
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container} className="email-container">
          {/* ── Header ── */}
          <Section style={headerSection} className="header-section">
            <Img src={LOGO_URL} alt="Snakk" width="120" height="auto" style={logoImg} className="logo-img" />
          </Section>

          {/* ── Content ── */}
          <Section style={contentSection} className="content-section">
            <Heading style={h1} className="h1-heading">God morgen, {displayName} ☀️</Heading>
            <Text style={summaryText}>
              {overdueCount > 0 && <span style={{ color: BRAND_RED, fontWeight: 700 }}>⚠️ {overdueCount} forfalte</span>}
              {overdueCount > 0 && (todayCount > 0 || meetingCount > 0 || dealCount > 0) && <span> · </span>}
              {todayCount > 0 && <span>{todayCount} oppgave{todayCount !== 1 ? 'r' : ''} i dag</span>}
              {todayCount > 0 && (meetingCount > 0 || dealCount > 0) && <span> · </span>}
              {meetingCount > 0 && <span>📅 {meetingCount} møte{meetingCount !== 1 ? 'r' : ''}</span>}
              {meetingCount > 0 && dealCount > 0 && <span> · </span>}
              {dealCount > 0 && <span>💼 {dealCount} aktive deals</span>}
            </Text>

            <Button style={ctaButtonPrimary} className="cta-button" href={`${appUrl}/oppgaver`}>
              Åpne CRM
            </Button>

            {/* ═══ 1. PRIORITERT I DAG ═══ */}
            {prioritertIDag.length > 0 && (
              <>
                <Hr style={divider} />
                <Heading as="h2" style={sectionHeading}>🎯 Prioritert i dag ({prioritertIDag.length})</Heading>
                {prioritertIDag.map((task, i) => (
                  <Section key={i} style={taskCard}>
                    <Text style={taskName}>
                      {task.prioritet && priorityLabel[task.prioritet] && (
                        <span>{priorityLabel[task.prioritet].emoji} </span>
                      )}
                      {task.oppgave}
                    </Text>
                    <Text style={taskMeta}>
                      {task.selskap && <span style={metaChip}>🏢 {task.selskap}</span>}
                      {task.kontakt && <span style={metaChip}>👤 {task.kontakt}</span>}
                      {task.frist && <span style={metaChip}>📅 {task.frist}</span>}
                      {task.prioritet && <span style={{ ...metaChip, color: priorityLabel[task.prioritet]?.color || '#666' }}>{task.prioritet}</span>}
                    </Text>
                  </Section>
                ))}
              </>
            )}

            {/* ═══ Møter i dag (compact) ═══ */}
            {todayMeetings.length > 0 && (
              <>
                <Hr style={divider} />
                <Heading as="h2" style={sectionHeading}>📅 Møter i dag</Heading>
                <Section style={{ padding: '0' }}>
                  {todayMeetings.map((m, i) => (
                    <Text key={i} style={meetingRow}>
                      <span style={meetingTime}>
                        {m.start_tid || '?'}{m.slutt_tid ? `–${m.slutt_tid}` : ''}
                      </span>
                      &nbsp;&nbsp;{m.tittel}
                    </Text>
                  ))}
                </Section>
              </>
            )}

            {/* ═══ 2. FORFALT ═══ */}
            {overdueTasks.length > 0 && (
              <>
                <Hr style={divider} />
                <Section style={overdueHeaderBox}>
                  <Heading as="h2" style={overdueHeading}>⚠️ Forfalt ({overdueTasks.length})</Heading>
                </Section>
                {overdueTasks.map((task, i) => (
                  <Section key={i} style={overdueCard}>
                    <Text style={taskName}>
                      <span style={{ color: BRAND_RED }}>●</span>&nbsp;&nbsp;{task.oppgave}
                    </Text>
                    <Text style={taskMeta}>
                      {task.selskap && <span style={metaChip}>🏢 {task.selskap}</span>}
                      {task.kontakt && <span style={metaChip}>👤 {task.kontakt}</span>}
                      <span style={{ ...metaChip, color: BRAND_RED, fontWeight: 600 }}>
                        {task.dagerForsinket} dag{task.dagerForsinket !== 1 ? 'er' : ''} forsinket
                      </span>
                      {task.prioritet && priorityLabel[task.prioritet] && (
                        <span style={{ ...metaChip, color: priorityLabel[task.prioritet].color }}>{task.prioritet}</span>
                      )}
                    </Text>
                  </Section>
                ))}
              </>
            )}

            {/* ═══ 3. AKTIVE SALGSMULIGHETER ═══ */}
            {aktiveSalgsmuligheter.length > 0 && (
              <>
                <Hr style={divider} />
                <Heading as="h2" style={sectionHeading}>💼 Aktive salgsmuligheter ({aktiveSalgsmuligheter.length})</Heading>
                {aktiveSalgsmuligheter.slice(0, 8).map((deal, i) => (
                  <Section key={i} style={dealCard}>
                    <Text style={dealName}>
                      {deal.selskap || deal.navn}
                    </Text>
                    <Text style={taskMeta}>
                      <span style={stageBadge}>{deal.status}</span>
                      {deal.forventetMrr != null && <span style={metaChip}>💰 {nok(deal.forventetMrr)}/mnd</span>}
                      {deal.kontaktperson && <span style={metaChip}>👤 {deal.kontaktperson}</span>}
                      {deal.forventetLukkedato && <span style={metaChip}>📅 {deal.forventetLukkedato}</span>}
                    </Text>
                    {deal.nesteSteg && (
                      <Text style={nesteStegText}>→ {deal.nesteSteg}</Text>
                    )}
                  </Section>
                ))}
              </>
            )}

            {/* ═══ 4. ANBEFALT NESTE STEG (AI) ═══ */}
            {anbefalinger.length > 0 && (
              <>
                <Hr style={divider} />
                <Heading as="h2" style={sectionHeading}>🤖 Anbefalt neste steg</Heading>
                <Section style={aiBox}>
                  {anbefalinger.map((a, i) => (
                    <Text key={i} style={aiItem}>💡 {a}</Text>
                  ))}
                </Section>
              </>
            )}

            {/* ═══ 5. QUICK ACTIONS ═══ */}
            <Hr style={divider} />
            <Section style={quickActionsRow}>
              <Button style={ctaButtonPrimary} href={`${appUrl}/dashboard`}>
                Åpne CRM
              </Button>
            </Section>
            <Section style={quickActionsRow}>
              <Button style={ctaButtonSecondary} href={`${appUrl}/salgsmuligheter`}>
                Se pipeline
              </Button>
              &nbsp;&nbsp;
              <Button style={ctaButtonSecondary} href={`${appUrl}/oppgaver`}>
                Oppgaver
              </Button>
            </Section>
          </Section>

          {/* ── Footer ── */}
          <Section style={footerSection} className="footer-section">
            <Img src={LOGO_URL} alt="Snakk" width="80" height="auto" style={{ margin: '0 auto 8px' }} className="footer-logo" />
            <Text style={footerText}>Snakk CRM – Din daglige salgsbrief</Text>
            <Text style={footerCopy}>©2026 Snakk. Alle rettigheter reservert.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// ── Export ──

export const template = {
  component: DailyBriefEmail,
  subject: (data: Record<string, any>) => {
    const overdue = data.overdueCount || 0
    const today = data.todayCount || 0
    const deals = data.dealCount || 0
    const parts: string[] = []
    if (overdue > 0) parts.push(`⚠️ ${overdue} forfalte`)
    if (today > 0) parts.push(`${today} oppgaver`)
    if (deals > 0) parts.push(`${deals} deals`)
    if (parts.length === 0) return '☀️ Din dag i Snakk'
    return parts.join(' · ')
  },
  displayName: 'Daglig salgsbrief',
  previewData: {
    displayName: 'Robin',
    overdueCount: 2,
    todayCount: 3,
    meetingCount: 2,
    dealCount: 4,
    prioritertIDag: [
      { oppgave: 'Send tilbud til Acme Corp', frist: '2. april 2026', dagerForsinket: 0, ansvarlig: 'Robin', prioritet: 'Høy', selskap: 'Acme Corp', kontakt: 'Kari Nordmann' },
      { oppgave: 'Forbered demo for Trale.ai', frist: '2. april 2026', dagerForsinket: 0, ansvarlig: 'Robin', prioritet: 'Medium', selskap: 'Trale.ai', kontakt: 'Ola Hansen' },
      { oppgave: 'Oppdater prisforslag Nova', frist: '2. april 2026', dagerForsinket: 0, ansvarlig: 'Robin', prioritet: 'Lav', selskap: 'Nova AS', kontakt: null },
    ],
    overdueTasks: [
      { oppgave: 'Følg opp tilbud Straye', frist: '28. mars 2026', dagerForsinket: 5, ansvarlig: 'Robin', prioritet: 'Høy', selskap: 'Straye AS', kontakt: 'Per Olsen' },
      { oppgave: 'Send kontrakt med BankID', frist: '27. mars 2026', dagerForsinket: 6, ansvarlig: 'Robin', prioritet: 'Medium', selskap: 'FjordTech', kontakt: null },
    ],
    todayMeetings: [
      { tittel: 'Trale.ai <> Snakk ai', start_tid: '10:00', slutt_tid: '11:00' },
      { tittel: 'Unaas Cycling demo', start_tid: '14:00', slutt_tid: '15:00' },
    ],
    aktiveSalgsmuligheter: [
      { navn: 'CRM-integrasjon', selskap: 'Acme Corp', status: 'Tilbud sendt', forventetMrr: 12000, forventetLukkedato: '5. april 2026', kontaktperson: 'Kari Nordmann', nesteSteg: 'Venter på svar fra juridisk' },
      { navn: 'Onboarding-plattform', selskap: 'Trale.ai', status: 'Demo gjennomført', forventetMrr: 8500, forventetLukkedato: '15. april 2026', kontaktperson: 'Ola Hansen', nesteSteg: 'Send tilbud' },
      { navn: 'Chatbot-løsning', selskap: 'FjordTech', status: 'Behov avklart', forventetMrr: 5000, forventetLukkedato: null, kontaktperson: 'Lise Berg', nesteSteg: null },
      { navn: 'Kundeportal', selskap: 'Nova AS', status: 'Møte booket', forventetMrr: null, forventetLukkedato: '20. april 2026', kontaktperson: null, nesteSteg: 'Avklar behov i møte' },
    ],
    anbefalinger: [
      'Definer neste steg for FjordTech (Behov avklart)',
      'Følg opp Straye AS – 5 dager uten aktivitet',
      'Acme Corp nærmer seg lukkedato – forbered closing',
    ],
    appUrl: 'https://snakk-ai-crm.lovable.app',
  },
} satisfies TemplateEntry

// ── Styles ──

const main: React.CSSProperties = { backgroundColor: '#f5f4f2', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', padding: '8px 0' }
const container: React.CSSProperties = { maxWidth: '560px', margin: '0 auto', width: '100%' }
const headerSection: React.CSSProperties = { backgroundColor: '#ffffff', padding: '22px 0', textAlign: 'center', borderRadius: '8px 8px 0 0', borderBottom: `3px solid ${BRAND_RED}` }
const logoImg: React.CSSProperties = { margin: '0 auto', display: 'block' }
const contentSection: React.CSSProperties = { backgroundColor: '#ffffff', padding: '24px 28px' }
const h1: React.CSSProperties = { fontSize: '20px', fontWeight: 700, color: BRAND_DARK, margin: '0 0 6px' }
const summaryText: React.CSSProperties = { fontSize: '14px', color: '#555555', lineHeight: '1.5', margin: '0 0 18px' }
const divider: React.CSSProperties = { borderColor: '#e8e6e3', margin: '18px 0' }
const sectionHeading: React.CSSProperties = { fontSize: '12px', fontWeight: 700, color: BRAND_DARK, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.5px' }

// Tasks
const taskCard: React.CSSProperties = { padding: '10px 0', borderBottom: '1px solid #f0eeec' }
const taskName: React.CSSProperties = { fontSize: '14px', color: BRAND_DARK, margin: '0 0 4px', fontWeight: 500 }
const taskMeta: React.CSSProperties = { fontSize: '12px', color: '#666666', margin: '0', lineHeight: '1.6' }
const metaChip: React.CSSProperties = { marginRight: '10px', fontSize: '12px' }

// Overdue
const overdueHeaderBox: React.CSSProperties = { backgroundColor: '#fef2f2', borderRadius: '6px', padding: '10px 14px', marginBottom: '6px' }
const overdueHeading: React.CSSProperties = { fontSize: '13px', fontWeight: 700, color: BRAND_RED, margin: '0', textTransform: 'uppercase', letterSpacing: '0.5px' }
const overdueCard: React.CSSProperties = { padding: '10px 0', borderBottom: '1px solid #fde8e8' }

// Deals
const dealCard: React.CSSProperties = { padding: '10px 0', borderBottom: '1px solid #f0eeec' }
const dealName: React.CSSProperties = { fontSize: '14px', color: BRAND_DARK, margin: '0 0 4px', fontWeight: 600 }
const stageBadge: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#f0f0ee',
  color: BRAND_DARK,
  fontSize: '11px',
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: '4px',
  marginRight: '10px',
}
const nesteStegText: React.CSSProperties = { fontSize: '12px', color: '#16a34a', margin: '4px 0 0', fontStyle: 'italic' }

// AI box
const aiBox: React.CSSProperties = { backgroundColor: '#f8f7f5', borderRadius: '6px', padding: '12px 14px', borderLeft: `3px solid ${BRAND_RED}` }
const aiItem: React.CSSProperties = { fontSize: '13px', color: BRAND_DARK, margin: '0 0 8px', lineHeight: '1.4' }

// CTAs
const ctaButtonPrimary: React.CSSProperties = {
  backgroundColor: BRAND_RED,
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 600,
  textDecoration: 'none',
  display: 'inline-block',
  textAlign: 'center',
}
const ctaButtonSecondary: React.CSSProperties = {
  backgroundColor: '#ffffff',
  color: BRAND_DARK,
  padding: '10px 20px',
  borderRadius: '8px',
  fontSize: '13px',
  fontWeight: 600,
  textDecoration: 'none',
  display: 'inline-block',
  textAlign: 'center',
  border: `1px solid #e0dfdc`,
}
const quickActionsRow: React.CSSProperties = { textAlign: 'center', margin: '8px 0' }

// Footer
const footerSection: React.CSSProperties = { padding: '18px 28px', textAlign: 'center', borderRadius: '0 0 8px 8px', backgroundColor: '#ffffff', borderTop: `2px solid ${BRAND_RED}` }
const footerText: React.CSSProperties = { fontSize: '12px', color: '#999999', margin: '0 0 4px' }
const footerCopy: React.CSSProperties = { fontSize: '11px', color: '#bbbbbb', margin: '6px 0 0' }
