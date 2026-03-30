import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Snakk"
const BRAND_RED = '#da291c'
const BRAND_DARK = '#1a1917'
const LOGO_URL = 'https://tchmujgzcklwgptocbno.supabase.co/storage/v1/object/public/email-assets/snakk-logo.png'

interface TaskItem {
  oppgave: string
  frist: string | null
  ansvarlig: string | null
  prioritet: string | null
}

interface DailyTaskReminderProps {
  displayName?: string
  overdueCount?: number
  todayCount?: number
  overdueTasks?: TaskItem[]
  todayTasks?: TaskItem[]
  appUrl?: string
}

const DailyTaskReminderEmail = ({
  displayName = 'der',
  overdueCount = 0,
  todayCount = 0,
  overdueTasks = [],
  todayTasks = [],
  appUrl = 'https://snakk-ai-crm.lovable.app',
}: DailyTaskReminderProps) => {
  const totalTasks = overdueCount + todayCount
  const previewText = `Du har ${overdueCount > 0 ? `${overdueCount} forfalte` : ''}${overdueCount > 0 && todayCount > 0 ? ' og ' : ''}${todayCount > 0 ? `${todayCount} oppgaver i dag` : overdueCount > 0 ? ' oppgaver' : 'oppgaver å se på'}`

  return (
    <Html lang="no" dir="ltr">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header with Snakk branding */}
          <Section style={headerSection}>
            <Img src={LOGO_URL} alt="Snakk" width="140" height="auto" style={logoImg} />
          </Section>

          {/* Main content */}
          <Section style={contentSection}>
            <Heading style={h1}>Hei {displayName},</Heading>
            <Text style={summaryText}>
              Du har <strong style={{ color: BRAND_DARK }}>{totalTasks} {overdueCount > 0 ? 'forfalte ' : ''}oppgave{totalTasks !== 1 ? 'r' : ''}</strong>.
            </Text>

            <Button style={ctaButton} href={`${appUrl}/oppgaver`}>
              Se alle oppgaver
            </Button>

            <Hr style={divider} />

            {/* Overdue section */}
            {overdueTasks.length > 0 && (
              <>
                <Heading as="h2" style={sectionHeading}>Forfalt</Heading>
                {overdueTasks.map((task, i) => (
                  <Section key={i} style={taskCard}>
                    <Text style={taskName}>
                      <span style={taskCircle}>○</span>&nbsp;&nbsp;{task.oppgave}
                    </Text>
                    <Text style={taskMetaLine}>
                      <span style={taskDateOverdue}>📅 {task.frist || 'Ingen frist'}</span>
                      {task.ansvarlig && (
                        <>
                          &nbsp;&nbsp;
                          <span style={assigneeBadge}>{task.ansvarlig.charAt(0).toUpperCase()}</span>
                          <span style={taskAssigneeText}>&nbsp;Tildelt {task.ansvarlig}</span>
                        </>
                      )}
                    </Text>
                  </Section>
                ))}
              </>
            )}

            {/* Today section */}
            {todayTasks.length > 0 && (
              <>
                <Heading as="h2" style={sectionHeading}>I dag</Heading>
                {todayTasks.map((task, i) => (
                  <Section key={i} style={taskCard}>
                    <Text style={taskName}>
                      <span style={taskCircle}>○</span>&nbsp;&nbsp;{task.oppgave}
                    </Text>
                    <Text style={taskMetaLine}>
                      <span style={taskDateToday}>📅 {task.frist || 'Ingen frist'}</span>
                      {task.ansvarlig && (
                        <>
                          &nbsp;&nbsp;
                          <span style={assigneeBadge}>{task.ansvarlig.charAt(0).toUpperCase()}</span>
                          <span style={taskAssigneeText}>&nbsp;Tildelt {task.ansvarlig}</span>
                        </>
                      )}
                    </Text>
                  </Section>
                ))}
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
    if (overdue > 0 && today > 0) return `Du har ${overdue} forfalte og ${today} oppgaver i dag`
    if (overdue > 0) return `Du har ${overdue} forfalte oppgaver`
    if (today > 0) return `Du har ${today} oppgaver i dag`
    return 'Dine oppgaver for i dag'
  },
  displayName: 'Daglig oppgavepåminnelse',
  previewData: {
    displayName: 'Robin',
    overdueCount: 2,
    todayCount: 1,
    overdueTasks: [
      { oppgave: 'Ring han', frist: '17. februar 2026', ansvarlig: 'Robin Sæter Diallo', prioritet: 'Høy' },
      { oppgave: 'Følg opp', frist: '17. februar 2026', ansvarlig: 'Robin Sæter Diallo', prioritet: 'Medium' },
    ],
    todayTasks: [
      { oppgave: 'Send tilbud til Acme Corp', frist: '30. mars 2026', ansvarlig: 'Robin Sæter Diallo', prioritet: 'Høy' },
    ],
    appUrl: 'https://snakk-ai-crm.lovable.app',
  },
} satisfies TemplateEntry

// Styles — Snakk brand: red #da291c, dark #1a1917, warm white backgrounds
const main: React.CSSProperties = { backgroundColor: '#f5f4f2', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container: React.CSSProperties = { maxWidth: '580px', margin: '0 auto' }
const headerSection: React.CSSProperties = { backgroundColor: BRAND_DARK, padding: '28px 0', textAlign: 'center', borderRadius: '8px 8px 0 0' }
const logoText: React.CSSProperties = { color: '#ffffff', fontSize: '26px', fontWeight: 700, margin: '0', letterSpacing: '-0.5px' }
const contentSection: React.CSSProperties = { backgroundColor: '#ffffff', padding: '32px 40px' }
const h1: React.CSSProperties = { fontSize: '24px', fontWeight: 700, color: BRAND_DARK, margin: '0 0 8px' }
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
const divider: React.CSSProperties = { borderColor: '#e8e6e3', margin: '28px 0' }
const sectionHeading: React.CSSProperties = { fontSize: '13px', fontWeight: 700, color: BRAND_DARK, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.5px' }
const taskCard: React.CSSProperties = { padding: '16px 0', borderBottom: '1px solid #f0eeec' }
const taskCircle: React.CSSProperties = { color: '#cccccc', fontSize: '16px' }
const taskName: React.CSSProperties = { fontSize: '15px', color: BRAND_DARK, margin: '0 0 8px', fontWeight: 500 }
const taskMetaLine: React.CSSProperties = { fontSize: '13px', color: '#666666', margin: '0' }
const taskDateOverdue: React.CSSProperties = { color: BRAND_RED, fontSize: '13px' }
const taskDateToday: React.CSSProperties = { color: '#666666', fontSize: '13px' }
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
const footerSection: React.CSSProperties = { padding: '24px 40px', textAlign: 'center', borderRadius: '0 0 8px 8px' }
const footerLogo: React.CSSProperties = { fontSize: '18px', fontWeight: 700, color: '#999999', margin: '0 0 4px' }
const footerText: React.CSSProperties = { fontSize: '13px', color: '#999999', margin: '0 0 4px' }
const footerCopy: React.CSSProperties = { fontSize: '12px', color: '#bbbbbb', margin: '8px 0 0' }
