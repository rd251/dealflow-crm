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

interface SnapshotData {
  totalPipeline: number
  pipelineEndring: number | null
  vunnetVerdi: number
  taptVerdi: number
  winRate: number | null
}

interface WonDeal { selskap: string; verdi: number | null; ansvarlig: string | null }
interface LostDeal { selskap: string; verdi: number | null; tapsaarsak: string | null }
interface StageBreakdown { stage: string; totalVerdi: number; antall: number }
interface NearClosingDeal { selskap: string; verdi: number | null; sistAktivitet: string | null }

interface KundeSnapshot {
  antallLive: number
  antallIkkeLive: number
  snittDagerTilGoLive: number | null
  antallPause: number
  antallChurn: number
}
interface GaattLiveItem { selskap: string; dagerFraVunnet: number | null }
interface IkkeLiveItem { selskap: string; dagerSidenVunnet: number | null; advarsel: boolean }
interface PlanlagtGoLiveItem { selskap: string; planlagtDato: string }
interface PauseChurnItem { selskap: string; status: 'Pause' | 'Kansellert'; aarsak: string | null }

interface WeeklyReportProps {
  displayName?: string
  snapshot?: SnapshotData
  wonDeals?: WonDeal[]
  lostDeals?: LostDeal[]
  stageBreakdown?: StageBreakdown[]
  nearClosing?: NearClosingDeal[]
  innsikt?: string[]
  kundeSnapshot?: KundeSnapshot
  gaattLive?: GaattLiveItem[]
  ikkeLive?: IkkeLiveItem[]
  planlagtGoLive?: PlanlagtGoLiveItem[]
  pauseChurn?: PauseChurnItem[]
  appUrl?: string
  periodLabel?: string
}

// ── Helpers ──

const nok = (v: number | null | undefined) =>
  v != null ? v.toLocaleString('no-NO') + ' kr' : '–'

const pct = (v: number | null | undefined) =>
  v != null ? `${Math.round(v)}%` : '–'

const changeArrow = (v: number | null) => {
  if (v == null) return ''
  if (v > 0) return `↑ ${Math.round(v)}%`
  if (v < 0) return `↓ ${Math.abs(Math.round(v))}%`
  return '→ 0%'
}

const changeColor = (v: number | null) => {
  if (v == null) return '#666'
  if (v > 0) return '#16a34a'
  if (v < 0) return BRAND_RED
  return '#666'
}

// ── Component ──

const WeeklySalesReportEmail = ({
  displayName = 'der',
  snapshot = { totalPipeline: 0, pipelineEndring: null, vunnetVerdi: 0, taptVerdi: 0, winRate: null },
  wonDeals = [],
  lostDeals = [],
  stageBreakdown = [],
  nearClosing = [],
  innsikt = [],
  kundeSnapshot = { antallLive: 0, antallIkkeLive: 0, snittDagerTilGoLive: null, antallPause: 0, antallChurn: 0 },
  gaattLive = [],
  ikkeLive = [],
  planlagtGoLive = [],
  pauseChurn = [],
  appUrl = APP_URL_DEFAULT,
  periodLabel = 'Siste 7 dager',
}: WeeklyReportProps) => {
  const previewParts: string[] = []
  if (wonDeals.length > 0) previewParts.push(`${wonDeals.length} vunnet`)
  if (lostDeals.length > 0) previewParts.push(`${lostDeals.length} tapt`)
  previewParts.push(`Pipeline: ${nok(snapshot.totalPipeline)}`)
  const previewText = previewParts.join(' · ')

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
            .snapshot-value { font-size: 20px !important; }
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
            <Heading style={h1} className="h1-heading">Ukentlig salgsrapport 📊</Heading>
            <Text style={summaryText}>Hei {displayName} – her er ditt salgssammendrag for {periodLabel.toLowerCase()}.</Text>

            {/* ═══ 1. SNAPSHOT ═══ */}
            <Section style={snapshotGrid}>
              <Section style={snapshotCard}>
                <Text style={snapshotLabel}>Pipeline</Text>
                <Text style={snapshotValue} className="snapshot-value">{nok(snapshot.totalPipeline)}</Text>
                {snapshot.pipelineEndring != null && (
                  <Text style={{ ...snapshotChange, color: changeColor(snapshot.pipelineEndring) }}>
                    {changeArrow(snapshot.pipelineEndring)} fra forrige uke
                  </Text>
                )}
              </Section>
              <Section style={snapshotRow}>
                <Section style={snapshotMini}>
                  <Text style={snapshotLabel}>Vunnet</Text>
                  <Text style={{ ...snapshotMiniValue, color: '#16a34a' }}>{nok(snapshot.vunnetVerdi)}</Text>
                </Section>
                <Section style={snapshotMini}>
                  <Text style={snapshotLabel}>Tapt</Text>
                  <Text style={{ ...snapshotMiniValue, color: BRAND_RED }}>{nok(snapshot.taptVerdi)}</Text>
                </Section>
                <Section style={snapshotMini}>
                  <Text style={snapshotLabel}>Win rate</Text>
                  <Text style={snapshotMiniValue}>{pct(snapshot.winRate)}</Text>
                </Section>
              </Section>
            </Section>

            {/* ═══ 2. VUNNET ═══ */}
            {wonDeals.length > 0 && (
              <>
                <Hr style={divider} />
                <Section style={wonHeaderBox}>
                  <Heading as="h2" style={wonHeading}>🏆 Vunnet ({wonDeals.length})</Heading>
                </Section>
                {wonDeals.map((deal, i) => (
                  <Section key={i} style={dealRow}>
                    <Text style={dealName}>{deal.selskap}</Text>
                    <Text style={dealMeta}>
                      <span style={{ ...metaChip, color: '#16a34a', fontWeight: 600 }}>💰 {nok(deal.verdi)}/mnd</span>
                      {deal.ansvarlig && <span style={metaChip}>👤 {deal.ansvarlig}</span>}
                    </Text>
                  </Section>
                ))}
              </>
            )}

            {/* ═══ 3. TAPT ═══ */}
            {lostDeals.length > 0 && (
              <>
                <Hr style={divider} />
                <Section style={lostHeaderBox}>
                  <Heading as="h2" style={lostHeading}>❌ Tapt ({lostDeals.length})</Heading>
                </Section>
                {lostDeals.map((deal, i) => (
                  <Section key={i} style={dealRow}>
                    <Text style={dealName}>
                      <span style={{ color: BRAND_RED }}>●</span>&nbsp;&nbsp;{deal.selskap}
                    </Text>
                    <Text style={dealMeta}>
                      <span style={metaChip}>💰 {nok(deal.verdi)}/mnd</span>
                      {deal.tapsaarsak && <span style={{ ...metaChip, fontStyle: 'italic' }}>📋 {deal.tapsaarsak}</span>}
                    </Text>
                  </Section>
                ))}
              </>
            )}

            {/* ═══ 4. PIPELINE PER STAGE ═══ */}
            {stageBreakdown.length > 0 && (
              <>
                <Hr style={divider} />
                <Heading as="h2" style={sectionHeading}>📈 Pipeline per stage</Heading>
                {stageBreakdown.map((s, i) => (
                  <Section key={i} style={stageRow}>
                    <Text style={stageName}>
                      <span style={stageBadge}>{s.stage}</span>
                      <span style={{ marginLeft: '8px', fontSize: '12px', color: '#666' }}>{s.antall} deal{s.antall !== 1 ? 's' : ''}</span>
                    </Text>
                    <Text style={stageValue}>{nok(s.totalVerdi)}/mnd</Text>
                  </Section>
                ))}
              </>
            )}

            {/* ═══ 5. NÆR CLOSING ═══ */}
            {nearClosing.length > 0 && (
              <>
                <Hr style={divider} />
                <Heading as="h2" style={sectionHeading}>🔥 Nær closing ({nearClosing.length})</Heading>
                {nearClosing.map((deal, i) => (
                  <Section key={i} style={dealRow}>
                    <Text style={dealName}>{deal.selskap}</Text>
                    <Text style={dealMeta}>
                      {deal.verdi != null && <span style={metaChip}>💰 {nok(deal.verdi)}/mnd</span>}
                      {deal.sistAktivitet && <span style={metaChip}>📅 Siste aktivitet: {deal.sistAktivitet}</span>}
                    </Text>
                  </Section>
                ))}
              </>
            )}

            {/* ═══ 6. INNSIKT (AI) ═══ */}
            {innsikt.length > 0 && (
              <>
                <Hr style={divider} />
                <Heading as="h2" style={sectionHeading}>🤖 Innsikt</Heading>
                <Section style={aiBox}>
                  {innsikt.map((a, i) => (
                    <Text key={i} style={aiItem}>💡 {a}</Text>
                  ))}
                </Section>
              </>
            )}

            {/* ═══ 7. QUICK ACTIONS ═══ */}
            <Hr style={divider} />
            <Section style={quickActionsRow}>
              <Button style={ctaButtonPrimary} className="cta-button" href={`${appUrl}/salgsmuligheter`}>
                Åpne pipeline
              </Button>
            </Section>
            <Section style={quickActionsRow}>
              <Button style={ctaButtonSecondary} href={`${appUrl}/dashboard`}>
                Dashboard
              </Button>
              &nbsp;&nbsp;
              <Button style={ctaButtonSecondary} href={`${appUrl}/oppgaver`}>
                Oppgaver
              </Button>
            </Section>

            {/* ══════════════════════════════════════════ */}
            {/* ═══ 8. KUNDER & GO-LIVE STATUS ═══ */}
            {/* ══════════════════════════════════════════ */}
            <Hr style={dividerThick} />
            <Heading style={h1} className="h1-heading">Kunder & Go-live 🚀</Heading>

            <Section style={snapshotGrid}>
              <Section style={snapshotRow}>
                <Section style={snapshotMini}>
                  <Text style={snapshotLabel}>Live</Text>
                  <Text style={{ ...snapshotMiniValue, color: '#16a34a' }}>{kundeSnapshot.antallLive}</Text>
                </Section>
                <Section style={snapshotMini}>
                  <Text style={snapshotLabel}>Ikke live</Text>
                  <Text style={{ ...snapshotMiniValue, color: '#f59e0b' }}>{kundeSnapshot.antallIkkeLive}</Text>
                </Section>
                <Section style={snapshotMini}>
                  <Text style={snapshotLabel}>Snitt → live</Text>
                  <Text style={snapshotMiniValue}>{kundeSnapshot.snittDagerTilGoLive != null ? `${kundeSnapshot.snittDagerTilGoLive}d` : '–'}</Text>
                </Section>
              </Section>
              <Section style={{ ...snapshotRow, marginTop: '10px' }}>
                <Section style={snapshotMini}>
                  <Text style={snapshotLabel}>Pause</Text>
                  <Text style={{ ...snapshotMiniValue, color: '#f59e0b' }}>{kundeSnapshot.antallPause}</Text>
                </Section>
                <Section style={snapshotMini}>
                  <Text style={snapshotLabel}>Churn</Text>
                  <Text style={{ ...snapshotMiniValue, color: BRAND_RED }}>{kundeSnapshot.antallChurn}</Text>
                </Section>
                <Section style={snapshotMini}>{/* spacer */}</Section>
              </Section>
            </Section>

            {/* ═══ 9. GÅTT LIVE DENNE UKEN ═══ */}
            {gaattLive.length > 0 && (
              <>
                <Hr style={divider} />
                <Section style={wonHeaderBox}>
                  <Heading as="h2" style={wonHeading}>🎉 Gått live denne uken ({gaattLive.length})</Heading>
                </Section>
                {gaattLive.map((item, i) => (
                  <Section key={i} style={dealRow}>
                    <Text style={dealName}>{item.selskap}</Text>
                    <Text style={dealMeta}>
                      {item.dagerFraVunnet != null && <span style={metaChip}>⏱️ {item.dagerFraVunnet} dager fra vunnet → live</span>}
                    </Text>
                  </Section>
                ))}
              </>
            )}

            {/* ═══ 10. IKKE LIVE ═══ */}
            {ikkeLive.length > 0 && (
              <>
                <Hr style={divider} />
                <Heading as="h2" style={sectionHeading}>⏳ Ikke live ennå ({ikkeLive.length})</Heading>
                {ikkeLive.map((item, i) => (
                  <Section key={i} style={dealRow}>
                    <Text style={dealName}>
                      {item.advarsel && <span style={{ color: '#f59e0b' }}>⚠️ </span>}
                      {item.selskap}
                    </Text>
                    <Text style={dealMeta}>
                      {item.dagerSidenVunnet != null && (
                        <span style={{ ...metaChip, color: item.advarsel ? BRAND_RED : '#666', fontWeight: item.advarsel ? 600 : 400 }}>
                          📅 {item.dagerSidenVunnet} dager siden vunnet
                        </span>
                      )}
                    </Text>
                  </Section>
                ))}
              </>
            )}

            {/* ═══ 11. PLANLAGT GO-LIVE ═══ */}
            {planlagtGoLive.length > 0 && (
              <>
                <Hr style={divider} />
                <Heading as="h2" style={sectionHeading}>📅 Planlagt go-live ({planlagtGoLive.length})</Heading>
                {planlagtGoLive.map((item, i) => (
                  <Section key={i} style={dealRow}>
                    <Text style={dealName}>{item.selskap}</Text>
                    <Text style={dealMeta}>
                      <span style={metaChip}>🗓️ {item.planlagtDato}</span>
                    </Text>
                  </Section>
                ))}
              </>
            )}

            {/* ═══ 12. PAUSE / CHURN ═══ */}
            {pauseChurn.length > 0 && (
              <>
                <Hr style={divider} />
                <Section style={lostHeaderBox}>
                  <Heading as="h2" style={lostHeading}>⛔ Pause / Churn ({pauseChurn.length})</Heading>
                </Section>
                {pauseChurn.map((item, i) => (
                  <Section key={i} style={dealRow}>
                    <Text style={dealName}>
                      <span style={{ color: item.status === 'Kansellert' ? BRAND_RED : '#f59e0b' }}>●</span>&nbsp;&nbsp;{item.selskap}
                    </Text>
                    <Text style={dealMeta}>
                      <span style={metaChip}>{item.status === 'Kansellert' ? '🔴 Avsluttet' : '⏸️ Pause'}</span>
                      {item.aarsak && <span style={{ ...metaChip, fontStyle: 'italic' }}>📋 {item.aarsak}</span>}
                    </Text>
                  </Section>
                ))}
              </>
            )}

            {/* ═══ FINAL QUICK ACTIONS ═══ */}
            <Hr style={divider} />
            <Section style={quickActionsRow}>
              <Button style={ctaButtonPrimary} className="cta-button" href={`${appUrl}/selskaper`}>
                Åpne kundeforhold
              </Button>
            </Section>
            <Section style={quickActionsRow}>
              <Button style={ctaButtonSecondary} href={`${appUrl}/prosjekter`}>
                Prosjekter
              </Button>
            </Section>
          </Section>

          {/* ── Footer ── */}
          <Section style={footerSection} className="footer-section">
            <Img src={LOGO_URL} alt="Snakk" width="80" height="auto" style={{ margin: '0 auto 8px' }} className="footer-logo" />
            <Text style={footerText}>Snakk CRM – Ukentlig salgsrapport</Text>
            <Text style={footerCopy}>©2026 Snakk. Alle rettigheter reservert.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// ── Export ──

export const template = {
  component: WeeklySalesReportEmail,
  subject: (data: Record<string, any>) => {
    const won = data.wonDeals?.length || 0
    const lost = data.lostDeals?.length || 0
    const parts: string[] = ['📊 Ukentlig salgsrapport']
    if (won > 0) parts.push(`${won} vunnet`)
    if (lost > 0) parts.push(`${lost} tapt`)
    return parts.join(' · ')
  },
  displayName: 'Ukentlig salgsrapport',
  previewData: {
    displayName: 'Robin',
    periodLabel: 'Siste 7 dager',
    snapshot: { totalPipeline: 245000, pipelineEndring: 12, vunnetVerdi: 32000, taptVerdi: 8000, winRate: 67 },
    wonDeals: [
      { selskap: 'Acme Corp', verdi: 18000, ansvarlig: 'Robin' },
      { selskap: 'Trale.ai', verdi: 14000, ansvarlig: 'Kari' },
    ],
    lostDeals: [
      { selskap: 'FjordTech', verdi: 8000, tapsaarsak: 'Valgte annen leverandør' },
    ],
    stageBreakdown: [
      { stage: 'Møte booket', totalVerdi: 45000, antall: 3 },
      { stage: 'Behov avklart', totalVerdi: 60000, antall: 4 },
      { stage: 'Tilbud sendt', totalVerdi: 85000, antall: 2 },
      { stage: 'Forhandling', totalVerdi: 55000, antall: 2 },
    ],
    nearClosing: [
      { selskap: 'Nova AS', verdi: 12000, sistAktivitet: '30. mars 2026' },
      { selskap: 'Straye AS', verdi: 9500, sistAktivitet: '28. mars 2026' },
    ],
    innsikt: [
      'Win rate er 67% – opp fra 55% forrige uke',
      '3 deals har stått i "Behov avklart" i over 14 dager',
      'Straye AS har ikke hatt aktivitet på 5 dager – vurder oppfølging',
      '2 kunde(r) har ventet >7 dager på go-live',
      '1 kunde(r) gikk live denne uken 🎉',
    ],
    kundeSnapshot: { antallLive: 12, antallIkkeLive: 3, snittDagerTilGoLive: 11, antallPause: 1, antallChurn: 2 },
    gaattLive: [
      { selskap: 'Trale.ai', dagerFraVunnet: 8 },
    ],
    ikkeLive: [
      { selskap: 'NordicFoods', dagerSidenVunnet: 14, advarsel: true },
      { selskap: 'GreenBite', dagerSidenVunnet: 5, advarsel: false },
    ],
    planlagtGoLive: [
      { selskap: 'Sushi Express', planlagtDato: '15. april 2026' },
      { selskap: 'Café Oslo', planlagtDato: '22. april 2026' },
    ],
    pauseChurn: [
      { selskap: 'OldClient AS', status: 'Kansellert', aarsak: 'Lav bruk' },
      { selskap: 'PausedCo', status: 'Pause', aarsak: null },
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
const dividerThick: React.CSSProperties = { borderColor: BRAND_RED, borderWidth: '2px', margin: '28px 0 18px' }
const sectionHeading: React.CSSProperties = { fontSize: '12px', fontWeight: 700, color: BRAND_DARK, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.5px' }
const metaChip: React.CSSProperties = { marginRight: '10px', fontSize: '12px' }

// Snapshot
const snapshotGrid: React.CSSProperties = { backgroundColor: '#f8f7f5', borderRadius: '8px', padding: '16px', marginBottom: '4px' }
const snapshotCard: React.CSSProperties = { textAlign: 'center', marginBottom: '12px' }
const snapshotLabel: React.CSSProperties = { fontSize: '11px', color: '#888', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }
const snapshotValue: React.CSSProperties = { fontSize: '24px', fontWeight: 700, color: BRAND_DARK, margin: '0' }
const snapshotChange: React.CSSProperties = { fontSize: '12px', margin: '2px 0 0', fontWeight: 600 }
const snapshotRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-around', textAlign: 'center' }
const snapshotMini: React.CSSProperties = { display: 'inline-block', width: '33%', textAlign: 'center' }
const snapshotMiniValue: React.CSSProperties = { fontSize: '16px', fontWeight: 700, color: BRAND_DARK, margin: '0' }

// Won / Lost
const wonHeaderBox: React.CSSProperties = { backgroundColor: '#f0fdf4', borderRadius: '6px', padding: '10px 14px', marginBottom: '6px' }
const wonHeading: React.CSSProperties = { fontSize: '13px', fontWeight: 700, color: '#16a34a', margin: '0', textTransform: 'uppercase', letterSpacing: '0.5px' }
const lostHeaderBox: React.CSSProperties = { backgroundColor: '#fef2f2', borderRadius: '6px', padding: '10px 14px', marginBottom: '6px' }
const lostHeading: React.CSSProperties = { fontSize: '13px', fontWeight: 700, color: BRAND_RED, margin: '0', textTransform: 'uppercase', letterSpacing: '0.5px' }

// Deals
const dealRow: React.CSSProperties = { padding: '10px 0', borderBottom: '1px solid #f0eeec' }
const dealName: React.CSSProperties = { fontSize: '14px', color: BRAND_DARK, margin: '0 0 4px', fontWeight: 600 }
const dealMeta: React.CSSProperties = { fontSize: '12px', color: '#666666', margin: '0', lineHeight: '1.6' }

// Stage breakdown
const stageRow: React.CSSProperties = { padding: '8px 0', borderBottom: '1px solid #f0eeec', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
const stageName: React.CSSProperties = { fontSize: '13px', color: BRAND_DARK, margin: '0' }
const stageBadge: React.CSSProperties = { display: 'inline-block', backgroundColor: '#f0f0ee', color: BRAND_DARK, fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px' }
const stageValue: React.CSSProperties = { fontSize: '13px', fontWeight: 600, color: BRAND_DARK, margin: '0', textAlign: 'right' }

// AI box
const aiBox: React.CSSProperties = { backgroundColor: '#f8f7f5', borderRadius: '6px', padding: '12px 14px', borderLeft: `3px solid ${BRAND_RED}` }
const aiItem: React.CSSProperties = { fontSize: '13px', color: BRAND_DARK, margin: '0 0 8px', lineHeight: '1.4' }

// CTAs
const ctaButtonPrimary: React.CSSProperties = { backgroundColor: BRAND_RED, color: '#ffffff', padding: '12px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, textDecoration: 'none', display: 'inline-block', textAlign: 'center' }
const ctaButtonSecondary: React.CSSProperties = { backgroundColor: '#ffffff', color: BRAND_DARK, padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, textDecoration: 'none', display: 'inline-block', textAlign: 'center', border: '1px solid #e0dfdc' }
const quickActionsRow: React.CSSProperties = { textAlign: 'center', margin: '8px 0' }

// Footer
const footerSection: React.CSSProperties = { padding: '18px 28px', textAlign: 'center', borderRadius: '0 0 8px 8px', backgroundColor: '#ffffff', borderTop: `2px solid ${BRAND_RED}` }
const footerText: React.CSSProperties = { fontSize: '12px', color: '#999999', margin: '0 0 4px' }
const footerCopy: React.CSSProperties = { fontSize: '11px', color: '#bbbbbb', margin: '6px 0 0' }
