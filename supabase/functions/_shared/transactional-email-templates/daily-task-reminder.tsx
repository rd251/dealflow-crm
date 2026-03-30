import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr, Link, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Snakk"

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
          {/* Header */}
          <Section style={headerSection}>
            <Text style={logoText}>Snakk</Text>
          </Section>

          {/* Main content */}
          <Section style={contentSection}>
            <Heading style={h1}>Hei {displayName},</Heading>
            <Text style={summaryText}>
              Du har <strong>{totalTasks} oppgave{totalTasks !== 1 ? 'r' : ''}</strong> som trenger oppmerksomhet.
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
                    <Text style={taskName}>○&nbsp;&nbsp;{task.oppgave}</Text>
                    <Section style={taskMeta}>
                      <Text style={taskDate}>📅 {task.frist || 'Ingen frist'}</Text>
                      {task.ansvarlig && (
                        <Text style={taskAssignee}>
                          <span style={assigneeBadge}>
                            {task.ansvarlig.charAt(0).toUpperCase()}
                          </span>
                          &nbsp;Tildelt {task.ansvarlig}
                        </Text>
                      )}
                    </Section>
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
                    <Text style={taskName}>○&nbsp;&nbsp;{task.oppgave}</Text>
                    <Section style={taskMeta}>
                      <Text style={taskDate}>📅 {task.frist || 'Ingen frist'}</Text>
                      {task.ansvarlig && (
                        <Text style={taskAssignee}>
                          <span style={assigneeBadge}>
                            {task.ansvarlig.charAt(0).toUpperCase()}
                          </span>
                          &nbsp;Tildelt {task.ansvarlig}
                        </Text>
                      )}
                    </Section>
                  </Section>
                ))}
              </>
            )}
          </Section>

          {/* Footer */}
          <Section style={footerSection}>
            <Text style={footerLogo}>Snakk</Text>
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
      { oppgave: 'Ring han', frist: 'February 17, 2026', ansvarlig: 'Robin Sæter Diallo', prioritet: 'Høy' },
      { oppgave: 'Følg opp', frist: 'February 17, 2026', ansvarlig: 'Robin Sæter Diallo', prioritet: 'Medium' },
    ],
    todayTasks: [
      { oppgave: 'Send tilbud til Acme Corp', frist: 'March 30, 2026', ansvarlig: 'Robin Sæter Diallo', prioritet: 'Høy' },
    ],
    appUrl: 'https://snakk-ai-crm.lovable.app',
  },
} satisfies TemplateEntry

// Styles
const main = { backgroundColor: '#f4f4f5', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container = { maxWidth: '580px', margin: '0 auto' }
const headerSection = { backgroundColor: '#1a1a1a', padding: '28px 0', textAlign: 'center' as const, borderRadius: '8px 8px 0 0' }
const logoText = { color: '#ffffff', fontSize: '24px', fontWeight: '700' as const, margin: '0', letterSpacing: '-0.5px' }
const contentSection = { backgroundColor: '#ffffff', padding: '32px 40px' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#111111', margin: '0 0 8px' }
const summaryText = { fontSize: '15px', color: '#555555', lineHeight: '1.5', margin: '0 0 24px' }
const ctaButton = {
  backgroundColor: '#3b82f6',
  color: '#ffffff',
  padding: '14px 32px',
  borderRadius: '8px',
  fontSize: '15px',
  fontWeight: '600' as const,
  textDecoration: 'none',
  display: 'inline-block' as const,
  textAlign: 'center' as const,
  width: '100%',
  boxSizing: 'border-box' as const,
}
const divider = { borderColor: '#e5e5e5', margin: '28px 0' }
const sectionHeading = { fontSize: '14px', fontWeight: '700' as const, color: '#111111', margin: '0 0 16px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
const taskCard = { padding: '16px 0', borderBottom: '1px solid #f0f0f0' }
const taskName = { fontSize: '15px', color: '#111111', margin: '0 0 8px', fontWeight: '500' as const }
const taskMeta = { display: 'flex' as const, gap: '16px', alignItems: 'center' as const }
const taskDate = { fontSize: '13px', color: '#dc2626', margin: '0', display: 'inline' as const }
const taskAssignee = { fontSize: '13px', color: '#666666', margin: '0 0 0 8px', display: 'inline' as const }
const assigneeBadge = {
  display: 'inline-block' as const,
  width: '20px',
  height: '20px',
  borderRadius: '50%',
  backgroundColor: '#7c3aed',
  color: '#ffffff',
  fontSize: '11px',
  fontWeight: '600' as const,
  lineHeight: '20px',
  textAlign: 'center' as const,
  verticalAlign: 'middle' as const,
}
const footerSection = { padding: '24px 40px', textAlign: 'center' as const, borderRadius: '0 0 8px 8px' }
const footerLogo = { fontSize: '18px', fontWeight: '700' as const, color: '#999999', margin: '0 0 4px' }
const footerText = { fontSize: '13px', color: '#999999', margin: '0 0 4px' }
const footerCopy = { fontSize: '12px', color: '#bbbbbb', margin: '8px 0 0' }
