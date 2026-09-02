export type BlokkType = "header" | "tekst" | "nyhet" | "deler" | "cta";

export interface Blokk {
  id: string;
  type: BlokkType;
  overskrift?: string;
  tekst?: string;
  emoji?: string;
  lenke_url?: string;
  lenke_tekst?: string;
}

export const BLOKK_LABELS: Record<BlokkType, string> = {
  header: "Header",
  tekst: "Tekst",
  nyhet: "Nyhet",
  deler: "Seksjonsdeler",
  cta: "CTA-knapp",
};

export function nyBlokk(type: BlokkType): Blokk {
  const id = crypto.randomUUID();
  switch (type) {
    case "header":
      return { id, type, overskrift: "Nyhetsbrev fra Snakk AI" };
    case "tekst":
      return { id, type, tekst: "Skriv teksten din her." };
    case "nyhet":
      return {
        id,
        type,
        emoji: "🚀",
        overskrift: "Ny funksjon i Snakk",
        tekst: "Kort beskrivelse av nyheten.",
        lenke_url: "https://snakk.ai",
        lenke_tekst: "Les mer",
      };
    case "deler":
      return { id, type, overskrift: "" };
    case "cta":
      return { id, type, lenke_tekst: "Book en demo", lenke_url: "https://snakk.ai" };
  }
}

function esc(s: string | undefined): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Enkel rik tekst: **fet**, *kursiv*, [tekst](url), linjeskift */
export function richText(raw: string | undefined): string {
  return esc(raw)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(
      /\[([^\]]+)\]\(([^)\s]+)\)/g,
      '<a href="$2" style="color:#e01e26;text-decoration:underline;">$1</a>'
    )
    .replace(/\n/g, "<br />");
}

// Farger hentet fra snakk.ai
const SNAKK_RED = "#e01e26"; // Primær CTA-rød
const SNAKK_DARK_RED = "#6b0f0f"; // Mørkerød overskriftsfarge
const SNAKK_LIGHT = "#fdf4f3"; // Lys rosa kortbakgrunn

function renderBlokk(b: Blokk): string {
  switch (b.type) {
    case "header":
      return `
        <tr><td style="background:#ffffff;padding:32px 32px 24px 32px;border-bottom:1px solid #f3e3e2;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:28px;font-weight:bold;color:#111111;letter-spacing:1px;"><span style="color:${SNAKK_RED};">✦</span> SNAKK</div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:bold;color:${SNAKK_DARK_RED};margin-top:14px;line-height:1.3;">${esc(b.overskrift)}</div>
        </td></tr>`;
    case "tekst":
      return `
        <tr><td style="padding:20px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#333333;">
          ${richText(b.tekst)}
        </td></tr>`;
    case "nyhet":
      return `
        <tr><td style="padding:12px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:${SNAKK_LIGHT};border:1px solid #f3e3e2;border-radius:10px;">
            <tr><td style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;">
              <div style="font-size:17px;font-weight:bold;color:${SNAKK_DARK_RED};">${esc(b.emoji)} ${esc(b.overskrift)}</div>
              <div style="font-size:15px;line-height:1.6;color:#444444;margin-top:8px;">${richText(b.tekst)}</div>
              ${
                b.lenke_url
                  ? `<div style="margin-top:12px;"><a href="${esc(b.lenke_url)}" style="color:${SNAKK_RED};font-weight:bold;font-size:14px;text-decoration:none;">${esc(b.lenke_tekst || "Les mer")} →</a></div>`
                  : ""
              }
            </td></tr>
          </table>
        </td></tr>`;
    case "deler":
      return `
        <tr><td style="padding:22px 32px 6px 32px;">
          <div style="border-top:1px solid #e5e5e5;"></div>
          ${
            b.overskrift
              ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#888888;margin-top:16px;">${esc(b.overskrift)}</div>`
              : ""
          }
        </td></tr>`;
    case "cta":
      return `
        <tr><td align="center" style="padding:26px 32px;">
          <a href="${esc(b.lenke_url)}" style="display:inline-block;background:${SNAKK_RED};color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;padding:14px 34px;border-radius:999px;text-decoration:none;">${esc(b.lenke_tekst)} →</a>
        </td></tr>`;
  }
}

export function renderNewsletterHtml(blokker: Blokk[], preheader?: string): string {
  const body = blokker.map(renderBlokk).join("");
  return `<!DOCTYPE html>
<html lang="no"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#eeeeee;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#eeeeee;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;">
        ${body}
        <tr><td style="padding:26px 32px 10px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#333333;">
          Hilsen Robin &amp; teamet hos Snakk AI
        </td></tr>
        <tr><td style="padding:18px 32px 28px 32px;border-top:1px solid #eeeeee;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#999999;line-height:1.6;">
          Du mottar denne e-posten fordi du er i kontakt med Snakk AI.<br />
          <a href="{{unsubscribe}}" style="color:#999999;text-decoration:underline;">Meld deg av nyhetsbrevet</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
