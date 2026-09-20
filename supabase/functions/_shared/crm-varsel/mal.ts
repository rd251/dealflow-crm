// HTML-mal for interne driftsvarsler i Snakk CRM.
// Dette er interne varsler – ingen avmeldingslenke og ingen markedsføringsinnhold.

export const APP_URL = 'https://snakk-ai-crm.lovable.app'

const HEADER_ROD = '#c0392b'
const TEKST_MORK = '#1a1917'
const TEKST_DEMPET = '#6b6560'
const KANT = '#ece9e4'
const NOTAT_GUL_BG = '#fff8e1'
const NOTAT_GUL_KANT = '#f0c419'
const LOGO_URL =
  'https://tchmujgzcklwgptocbno.supabase.co/storage/v1/object/public/email-assets/snakk-logo-hvit.png'

export interface VarselFelt {
  label: string
  verdi: string | number | null | undefined
}

export interface OppgaveLinje {
  tekst: string
  detalj?: string | null
  lenke?: string | null
}

export interface OppgaveOversikt {
  forfalt: OppgaveLinje[]
  idag: OppgaveLinje[]
  denneUken: OppgaveLinje[]
}

export const TOM_OPPGAVEOVERSIKT: OppgaveOversikt = { forfalt: [], idag: [], denneUken: [] }

export interface VarselInnhold {
  /** Vises i emnefeltet etter «[Snakk CRM] ». */
  emneTittel: string
  overskrift: string
  underoverskrift?: string | null
  felter: VarselFelt[]
  pinnedNotat?: string | null
  pinnedNotatAv?: string | null
  ctaTekst?: string
  ctaSti: string
  /** Ekstra liste over toppen av oppgaveoversikten (brukes av forfalt-varselet). */
  hovedliste?: { tittel: string; linjer: OppgaveLinje[] } | null
  oppgaver: OppgaveOversikt
}

export function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function emne(innhold: VarselInnhold): string {
  return `[Snakk CRM] ${innhold.emneTittel}`
}

function lenkeUrl(sti: string): string {
  if (/^https?:\/\//i.test(sti)) return sti
  return `${APP_URL}${sti.startsWith('/') ? sti : `/${sti}`}`
}

function feltRader(felter: VarselFelt[]): string {
  const synlige = felter.filter(f => f.verdi !== null && f.verdi !== undefined && String(f.verdi).trim() !== '')
  if (synlige.length === 0) return ''
  return synlige
    .map(
      f => `
        <tr>
          <td style="padding:6px 0;color:${TEKST_DEMPET};font-size:13px;width:44%;vertical-align:top;">${esc(f.label)}</td>
          <td style="padding:6px 0;color:${TEKST_MORK};font-size:14px;font-weight:600;vertical-align:top;">${esc(f.verdi)}</td>
        </tr>`,
    )
    .join('')
}

function listeBlokk(tittel: string, linjer: OppgaveLinje[]): string {
  if (linjer.length === 0) return ''
  const punkter = linjer
    .map(l => {
      const tekst = l.lenke
        ? `<a href="${esc(lenkeUrl(l.lenke))}" style="color:${TEKST_MORK};text-decoration:underline;">${esc(l.tekst)}</a>`
        : esc(l.tekst)
      const detalj = l.detalj ? ` <span style="color:${TEKST_DEMPET};">· ${esc(l.detalj)}</span>` : ''
      return `<li style="margin:0 0 6px;color:${TEKST_MORK};font-size:14px;line-height:20px;">${tekst}${detalj}</li>`
    })
    .join('')
  return `
    <p style="margin:18px 0 6px;color:${TEKST_DEMPET};font-size:12px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${esc(tittel)}</p>
    <ul style="margin:0;padding-left:18px;">${punkter}</ul>`
}

function oppgaveSeksjon(o: OppgaveOversikt): string {
  const totalt = o.forfalt.length + o.idag.length + o.denneUken.length
  const innhold =
    totalt === 0
      ? `<p style="margin:0;color:${TEKST_DEMPET};font-size:14px;">Du har ingen aktive oppgaver akkurat nå.</p>`
      : [
          listeBlokk(`Forfalt (${o.forfalt.length})`, o.forfalt),
          listeBlokk(`I dag (${o.idag.length})`, o.idag),
          listeBlokk(`Denne uken (${o.denneUken.length})`, o.denneUken),
        ].join('')
  return `
    <hr style="border:none;border-top:1px solid ${KANT};margin:28px 0 20px;" />
    <p style="margin:0 0 4px;color:${TEKST_MORK};font-size:15px;font-weight:700;">Dine aktive oppgaver</p>
    ${innhold}
    <p style="margin:16px 0 0;">
      <a href="${APP_URL}/oppgaver" style="color:${HEADER_ROD};font-size:13px;font-weight:600;text-decoration:underline;">Se alle oppgaver</a>
    </p>`
}

export function byggHtml(innhold: VarselInnhold): string {
  const notat = innhold.pinnedNotat?.trim()
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${NOTAT_GUL_BG};border:1px solid ${NOTAT_GUL_KANT};border-radius:8px;margin:0 0 20px;">
        <tr><td style="padding:14px 16px;">
          <p style="margin:0 0 4px;color:#8a6d1a;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;font-weight:700;">
            ${innhold.pinnedNotatAv ? `Notat fra ${esc(innhold.pinnedNotatAv)}` : 'Notat'}
          </p>
          <p style="margin:0;color:${TEKST_MORK};font-size:14px;line-height:21px;white-space:pre-wrap;">${esc(innhold.pinnedNotat)}</p>
        </td></tr>
      </table>`
    : ''

  const rader = feltRader(innhold.felter)
  const kort = rader
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${KANT};border-radius:10px;margin:0 0 20px;">
        <tr><td style="padding:16px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rader}</table>
        </td></tr>
      </table>`
    : ''

  const hovedliste = innhold.hovedliste ? listeBlokk(innhold.hovedliste.tittel, innhold.hovedliste.linjer) : ''

  return `<!DOCTYPE html>
<html lang="nb"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(innhold.emneTittel)}</title></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;">
    <tr><td align="center" style="padding:0 0 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
        <tr><td style="background-color:${HEADER_ROD};padding:20px 24px;">
          <img src="${LOGO_URL}" alt="Snakk" width="92" style="display:block;border:0;" />
        </td></tr>
        <tr><td style="padding:28px 24px 0;">
          <h1 style="margin:0 0 6px;color:${TEKST_MORK};font-size:22px;line-height:30px;font-weight:700;">${esc(innhold.overskrift)}</h1>
          ${innhold.underoverskrift ? `<p style="margin:0 0 20px;color:${TEKST_DEMPET};font-size:14px;line-height:21px;">${esc(innhold.underoverskrift)}</p>` : '<div style="height:14px;"></div>'}
          ${kort}
          ${notat}
          <a href="${esc(lenkeUrl(innhold.ctaSti))}" style="background-color:${HEADER_ROD};border-radius:8px;color:#ffffff;display:inline-block;font-size:15px;font-weight:600;padding:12px 22px;text-decoration:none;">${esc(innhold.ctaTekst || 'Åpne i CRM')} &rarr;</a>
          ${hovedliste}
          ${oppgaveSeksjon(innhold.oppgaver)}
          <hr style="border:none;border-top:1px solid ${KANT};margin:28px 0 14px;" />
          <p style="margin:0;color:${TEKST_DEMPET};font-size:12px;line-height:18px;">
            Snakk Teknologi AS · <a href="https://snakk.ai" style="color:${TEKST_DEMPET};text-decoration:underline;">snakk.ai</a><br />
            Internt driftsvarsel fra Snakk CRM.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

export function byggTekst(innhold: VarselInnhold): string {
  const felter = innhold.felter
    .filter(f => f.verdi !== null && f.verdi !== undefined && String(f.verdi).trim() !== '')
    .map(f => `${f.label}: ${f.verdi}`)
    .join('\n')
  const liste = (tittel: string, linjer: OppgaveLinje[]) =>
    linjer.length ? `\n${tittel}:\n${linjer.map(l => `- ${l.tekst}${l.detalj ? ` (${l.detalj})` : ''}`).join('\n')}` : ''
  return [
    innhold.overskrift,
    innhold.underoverskrift || '',
    '',
    felter,
    innhold.pinnedNotat ? `\nNotat${innhold.pinnedNotatAv ? ` fra ${innhold.pinnedNotatAv}` : ''}: ${innhold.pinnedNotat}` : '',
    `\nÅpne i CRM: ${lenkeUrl(innhold.ctaSti)}`,
    innhold.hovedliste ? liste(innhold.hovedliste.tittel, innhold.hovedliste.linjer) : '',
    '\nDine aktive oppgaver',
    liste('Forfalt', innhold.oppgaver.forfalt),
    liste('I dag', innhold.oppgaver.idag),
    liste('Denne uken', innhold.oppgaver.denneUken),
    '\nSnakk Teknologi AS · snakk.ai — internt driftsvarsel fra Snakk CRM.',
  ]
    .filter(Boolean)
    .join('\n')
}
