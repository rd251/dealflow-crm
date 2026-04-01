import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Snakk"
const BRAND_RED = '#da291c'
const BRAND_DARK = '#1a1917'
const LOGO_URL = 'https://tchmujgzcklwgptocbno.supabase.co/storage/v1/object/public/email-assets/snakk-logo-dark.svg'

interface TaskItem {
  oppgave: string
  frist: string | null
  ansvarlig: string | null
  prioritet: string | null
}

interface MeetingItem {
  tittel: string
  start_tid: string | null
  slutt_tid: string | null
}

interface DailyTaskReminderProps {
  displayName?: string
  overdueCount?: number
  todayCount?: number
  meetingCount?: number
  overdueTasks?: TaskItem[]
  todayTasks?: TaskItem[]
  todayMeetings?: MeetingItem[]
  appUrl?: string
}

const priorityLabel: Record<string, { text: string; color: string }> = {
  'Høy': { text: '🔴 Høy', color: BRAND_RED },
  'Medium': { text: '🟡 Medium', color: '#d97706' },
  'Lav': { text: '🟢 Lav', color: '#16a34a' },
}

const DailyTaskReminderEmail = ({
  displayName = 'der',
  overdueCount = 0,
  todayCount = 0,
  meetingCount = 0,
  overdueTasks = [],
  todayTasks = [],
  todayMeetings = [],
  appUrl = 'https://snakk-ai-crm.lovable.app',
}: DailyTaskReminderProps) => {
  const totalTasks = overdueCount + todayCount
  const parts: string[] = []
  if (overdueCount > 0) parts.push(`${overdueCount} forfalte oppgaver`)
  if (todayCount > 0) parts.push(`${todayCount} oppgaver i dag`)
  if (meetingCount > 0) parts.push(`${meetingCount} møter`)
  const previewText = parts.length > 0 ? `Du har ${parts.join(' og ')}` : 'Ingenting planlagt i dag'

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
            .summary-text { font-size: 13px !important; }
            .task-name { font-size: 14px !important; }
            .task-meta { font-size: 12px !important; }
            .meeting-row { font-size: 13px !important; }
            .logo-img { width: 110px !important; }
            .footer-logo { width: 60px !important; }
          }
        `}</style>
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container} className="email-container">
          {/* Header */}
          <Section style={headerSection} className="header-section">
            <Img src={LOGO_URL} alt="Snakk" width="120" height="auto" style={logoImg} className="logo-img" />
          </Section>

          {/* Main content */}
          <Section style={contentSection} className="content-section">
            <Heading style={h1} className="h1-heading">God morgen, {displayName} ☀️</Heading>
            <Text style={summaryText} className="summary-text">
              {overdueCount > 0 && (
                <span style={{ color: BRAND_RED, fontWeight: 700 }}>⚠️ {overdueCount} forfalte</span>
              )}
              {overdueCount > 0 && (todayCount > 0 || meetingCount > 0) && <span> · </span>}
              {todayCount > 0 && <span>{todayCount} oppgave{todayCount !== 1 ? 'r' : ''} i dag</span>}
              {todayCount > 0 && meetingCount > 0 && <span> · </span>}
              {meetingCount > 0 && <span>📅 {meetingCount} møte{meetingCount !== 1 ? 'r' : ''}</span>}
            </Text>

            <Button style={ctaButton} className="cta-button" href={`${appUrl}/oppgaver`}>
              Åpne Snakk
            </Button>

            {/* ===== OVERDUE TASKS ===== */}
            {overdueTasks.length > 0 && (
              <>
                <Hr style={divider} />
                <Section style={overdueHeader}>
                  <Heading as="h2" style={overdueHeading}>⚠️ Forfalt ({overdueTasks.length})</Heading>
                </Section>
                {overdueTasks.map((task, i) => (
                  <Section key={i} style={overdueTaskCard}>
                    <Text style={taskName} className="task-name">
                      <span style={taskCircleOverdue}>●</span>&nbsp;&nbsp;{task.oppgave}
                    </Text>
                    <Text style={taskMetaLine} className="task-meta">
                      <span style={taskDateOverdue}>📅 {task.frist || 'Ingen frist'}</span>
                      {task.prioritet && priorityLabel[task.prioritet] && (
                        <span style={{ ...priorityBadge, color: priorityLabel[task.prioritet].color }}>
                          &nbsp;&nbsp;{priorityLabel[task.prioritet].text}
                        </span>
                      )}
                      {task.ansvarlig && (
                        <>
                          &nbsp;&nbsp;
                          <span style={assigneeBadge}>{task.ansvarlig.charAt(0).toUpperCase()}</span>
                          <span style={taskAssigneeText}>&nbsp;{task.ansvarlig}</span>
                        </>
                      )}
                    </Text>
                  </Section>
                ))}
              </>
            )}

            {/* ===== TODAY'S TASKS ===== */}
            {todayTasks.length > 0 && (
              <>
                <Hr style={divider} />
                <Heading as="h2" style={sectionHeading}>✅ I dag ({todayTasks.length})</Heading>
                {todayTasks.map((task, i) => (
                  <Section key={i} style={taskCard}>
                    <Text style={taskName}>
                      <span style={taskCircle}>○</span>&nbsp;&nbsp;{task.oppgave}
                    </Text>
                    <Text style={taskMetaLine}>
                      {task.prioritet && priorityLabel[task.prioritet] && (
                        <span style={{ ...priorityBadge, color: priorityLabel[task.prioritet].color }}>
                          {priorityLabel[task.prioritet].text}
                        </span>
                      )}
                      {task.ansvarlig && (
                        <>
                          &nbsp;&nbsp;
                          <span style={assigneeBadge}>{task.ansvarlig.charAt(0).toUpperCase()}</span>
                          <span style={taskAssigneeText}>&nbsp;{task.ansvarlig}</span>
                        </>
                      )}
                    </Text>
                  </Section>
                ))}
              </>
            )}

            {/* ===== MEETINGS (compact) ===== */}
            {todayMeetings.length > 0 && (
              <>
                <Hr style={divider} />
                <Heading as="h2" style={sectionHeading}>📅 Møter i dag</Heading>
                <Section style={meetingsContainer}>
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
          </Section>

          {/* Footer */}
          <Section style={footerSection}>
            <Img src={LOGO_URL} alt="Snakk" width="80" height="auto" style={{ margin: '0 auto 8px' }} />
            <Text style={footerText}>Snakk CRM</Text>
            <Text style={footerCopy}>©2026 Snakk. Alle rettigheter reservert.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: DailyTaskReminderEmail,
  subject: (data: Record<string, any>) => {
    const overdue = data.overdueCount || 0
    const today = data.todayCount || 0
    const meetings = data.meetingCount || 0
    const parts: string[] = []
    if (overdue > 0) parts.push(`⚠️ ${overdue} forfalte`)
    if (today > 0) parts.push(`${today} oppgaver`)
    if (meetings > 0) parts.push(`${meetings} møter`)
    if (parts.length === 0) return 'Din dag i Snakk'
    return parts.join(' · ')
  },
  displayName: 'Daglig oppgavepåminnelse',
  previewData: {
    displayName: 'Robin',
    overdueCount: 2,
    todayCount: 1,
    meetingCount: 3,
    overdueTasks: [
      { oppgave: 'Ring han', frist: '17. februar 2026', ansvarlig: 'Robin Sæter Diallo', prioritet: 'Høy' },
      { oppgave: 'Følg opp tilbud Straye', frist: '28. mars 2026', ansvarlig: 'Robin Sæter Diallo', prioritet: 'Medium' },
    ],
    todayTasks: [
      { oppgave: 'Send tilbud til Acme Corp', frist: '1. april 2026', ansvarlig: 'Robin Sæter Diallo', prioritet: 'Høy' },
    ],
    todayMeetings: [
      { tittel: 'Trale.ai <> Snakk ai', start_tid: '10:00', slutt_tid: '11:00' },
      { tittel: 'Internmøte - Snakk Teknologi', start_tid: '13:00', slutt_tid: '14:00' },
      { tittel: 'Unaas Cycling <> Snakk ai demo', start_tid: '14:00', slutt_tid: '15:00' },
    ],
    appUrl: 'https://snakk-ai-crm.lovable.app',
  },
} satisfies TemplateEntry

// Styles
const main: React.CSSProperties = { backgroundColor: '#f5f4f2', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container: React.CSSProperties = { maxWidth: '580px', margin: '0 auto' }
const headerSection: React.CSSProperties = { backgroundColor: '#ffffff', padding: '28px 0', textAlign: 'center', borderRadius: '8px 8px 0 0', borderBottom: `3px solid ${BRAND_RED}` }
const logoImg: React.CSSProperties = { margin: '0 auto', display: 'block' }
const contentSection: React.CSSProperties = { backgroundColor: '#ffffff', padding: '32px 40px' }
const h1: React.CSSProperties = { fontSize: '22px', fontWeight: 700, color: BRAND_DARK, margin: '0 0 8px' }
const summaryText: React.CSSProperties = { fontSize: '15px', color: '#555555', lineHeight: '1.5', margin: '0 0 24px' }
const ctaButton: React.CSSProperties = {
  backgroundColor: BRAND_RED,
  color: '#ffffff',
  padding: '14px 32px',
  borderRadius: '8px',
  fontSize: '15px',
  fontWeight: 600,
  textDecoration: 'none',
  display: 'block',
  textAlign: 'center',
  width: '100%',
  boxSizing: 'border-box',
}
const divider: React.CSSProperties = { borderColor: '#e8e6e3', margin: '24px 0' }

// Overdue section — visually distinct
const overdueHeader: React.CSSProperties = { backgroundColor: '#fef2f2', borderRadius: '8px', padding: '12px 16px', marginBottom: '8px' }
const overdueHeading: React.CSSProperties = { fontSize: '14px', fontWeight: 700, color: BRAND_RED, margin: '0', textTransform: 'uppercase', letterSpacing: '0.5px' }
const overdueTaskCard: React.CSSProperties = { padding: '12px 0', borderBottom: '1px solid #fde8e8' }
const taskCircleOverdue: React.CSSProperties = { color: BRAND_RED, fontSize: '14px' }

// General task styles
const sectionHeading: React.CSSProperties = { fontSize: '13px', fontWeight: 700, color: BRAND_DARK, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.5px' }
const taskCard: React.CSSProperties = { padding: '12px 0', borderBottom: '1px solid #f0eeec' }
const taskCircle: React.CSSProperties = { color: '#cccccc', fontSize: '14px' }
const taskName: React.CSSProperties = { fontSize: '15px', color: BRAND_DARK, margin: '0 0 6px', fontWeight: 500 }
const taskMetaLine: React.CSSProperties = { fontSize: '13px', color: '#666666', margin: '0' }
const taskDateOverdue: React.CSSProperties = { color: BRAND_RED, fontSize: '13px', fontWeight: 600 }
const priorityBadge: React.CSSProperties = { fontSize: '12px', fontWeight: 500 }
const taskAssigneeText: React.CSSProperties = { fontSize: '13px', color: '#666666' }
const assigneeBadge: React.CSSProperties = {
  display: 'inline-block',
  width: '20px',
  height: '20px',
  borderRadius: '50%',
  backgroundColor: BRAND_RED,
  color: '#ffffff',
  fontSize: '11px',
  fontWeight: 600,
  lineHeight: '20px',
  textAlign: 'center',
  verticalAlign: 'middle',
}

// Meetings — compact
const meetingsContainer: React.CSSProperties = { padding: '0' }
const meetingRow: React.CSSProperties = { fontSize: '14px', color: BRAND_DARK, margin: '0', padding: '8px 0', borderBottom: '1px solid #f5f4f2', lineHeight: '1.4' }
const meetingTime: React.CSSProperties = { color: '#16a34a', fontWeight: 600, fontSize: '13px' }

// Footer
const footerSection: React.CSSProperties = { padding: '24px 40px', textAlign: 'center', borderRadius: '0 0 8px 8px', backgroundColor: '#ffffff', borderTop: `2px solid ${BRAND_RED}` }
const footerText: React.CSSProperties = { fontSize: '13px', color: '#999999', margin: '0 0 4px' }
const footerCopy: React.CSSProperties = { fontSize: '12px', color: '#bbbbbb', margin: '8px 0 0' }
