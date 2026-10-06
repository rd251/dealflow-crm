import websiteLogo from "@/assets/snakk-website-logo.png.asset.json";

export type BlokkType =
  | "header"
  | "hero"
  | "tekst"
  | "kort"
  | "nyhet"
  | "bilde"
  | "deler"
  | "rutenett"
  | "cta";

export interface Blokk {
  id: string;
  type: BlokkType;
  kicker?: string;
  overskrift?: string;
  tekst?: string;
  emoji?: string;
  bilde_url?: string;
  lenke_url?: string;
  lenke_tekst?: string;
  bildetekst?: string;
  elementer?: { overskrift: string; tekst?: string; lenke_url?: string }[];
  sekundar_lenke_url?: string;
  sekundar_lenke_tekst?: string;
}

export type NewsletterTheme = "snakk-v2" | "snakk-v2-launch" | "snakk-v2-document";

export const BLOKK_LABELS: Record<BlokkType, string> = {
  header: "Header",
  hero: "Hero (stort bilde + tittel)",
  tekst: "Tekst",
  kort: "Kort (ramme)",
  nyhet: "Nyhet",
  bilde: "Bilde",
  deler: "Seksjonsdeler",
  rutenett: "To kolonner",
  cta: "CTA-knapp",
};

export function nyBlokk(type: BlokkType): Blokk {
  const id = crypto.randomUUID();
  switch (type) {
    case "header":
      return { id, type, overskrift: "Nyhetsbrev fra Snakk" };
    case "hero":
      return {
        id,
        type,
        kicker: "NYHET",
        overskrift: "Mer tid til menneskene",
        tekst: "AI-medarbeideren tar telefonen, svarer på nettsiden og følger opp sakene.",
        bilde_url: "",
        lenke_tekst: "Lag din AI-agent gratis",
        lenke_url: "https://www.snakk.ai/kom-i-gang",
      };
    case "tekst":
      return { id, type, tekst: "Skriv teksten din her." };
    case "kort":
      return {
        id,
        type,
        kicker: "DIN BEDRIFT, DIN STEMME.",
        overskrift: "En AI-medarbeider som kan bedriften",
        tekst:
          "Snakk bruker deres egen kunnskap, tar telefonen og hjelper kunder på nettsiden – og setter over til riktig person når det trengs.",
        lenke_tekst: "Se hvordan",
        lenke_url: "https://www.snakk.ai",
      };
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
    case "bilde":
      return { id, type, bilde_url: "", tekst: "" };
    case "deler":
      return { id, type, overskrift: "" };
    case "cta":
      return { id, type, lenke_tekst: "Book en demo", lenke_url: "https://snakk.ai" };
    case "rutenett":
      return { id, type, elementer: [{ overskrift: "Overskrift", tekst: "Skriv teksten din her." }, { overskrift: "Overskrift", tekst: "Skriv teksten din her." }] };
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
      '<a href="$2" style="color:#FF6B0A;text-decoration:underline;">$1</a>'
    )
    .replace(/\n/g, "<br />");
}

// Snakk-farger
const SNAKK_RED = "#FF6B0A"; // Primær CTA-oransje (ny profil)
const SNAKK_DARK_RED = "#171717"; // Nesten svart – overskrifter
const CREAM = "#FAFAF9"; // Varm off-white bakgrunn
const BORDER = "#E1DED9"; // Lys sand ramme
const INK = "#171717";
const MUTED = "#666666";

// Geist finnes ikke i e-postklienter – nærmeste grotesk-stack
const SERIF =
  "Geist,'Helvetica Neue',Helvetica,Arial,sans-serif";
const SANS =
  "Geist,'Helvetica Neue',Helvetica,Arial,sans-serif";

const LOGO = "https://snakk-ai.lovable.app/images/snakk-logo.png";

function kicker(text?: string): string {
  if (!text) return "";
  return `<div style="font-family:${SANS};font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:${MUTED};">${esc(
    text
  )}</div>`;
}

function pilLenke(b: Blokk): string {
  if (!b.lenke_url) return "";
  return `<div style="margin-top:16px;"><a href="${esc(b.lenke_url)}" style="font-family:${SANS};font-size:15px;font-weight:bold;color:${SNAKK_DARK_RED};text-decoration:underline;">${esc(
    b.lenke_tekst || "Les mer"
  )} &rarr;</a></div>`;
}

function renderBlokk(b: Blokk): string {
  if (!b || typeof b !== "object") return "";
  switch (b.type) {
    case "header":
      return `
        <tr><td style="background:#ffffff;padding:30px 36px 8px 36px;text-align:center;">
          <img src="${LOGO}" alt="Snakk" width="120" style="display:inline-block;width:120px;height:auto;" />
          ${
            b.overskrift
              ? `<div style="font-family:${SANS};font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:${MUTED};margin-top:16px;">${esc(
                  b.overskrift
                )}</div>`
              : ""
          }
        </td></tr>`;

    case "hero":
      return `
        <tr><td style="background:${CREAM};padding:36px 36px 40px 36px;text-align:center;border-bottom:1px solid ${BORDER};">
          ${kicker(b.kicker)}
          <div style="font-family:${SERIF};font-weight:600;letter-spacing:-0.02em;font-size:40px;line-height:1.1;color:${SNAKK_DARK_RED};margin-top:12px;">${esc(
            b.overskrift
          )}</div>
          ${
            b.tekst
              ? `<div style="font-family:${SERIF};font-weight:400;font-size:19px;line-height:1.55;color:${MUTED};margin-top:14px;">${richText(
                  b.tekst
                )}</div>`
              : ""
          }
          ${
            b.lenke_url
              ? `<div style="margin-top:24px;"><a href="${esc(b.lenke_url)}" style="display:inline-block;background:${SNAKK_RED};color:#ffffff;font-family:${SANS};font-size:15px;font-weight:bold;padding:14px 30px;border-radius:999px;text-decoration:none;">${esc(
                  b.lenke_tekst || "Kom i gang"
                )} &rarr;</a></div>`
              : ""
          }
          ${
            b.bilde_url
              ? `<div style="margin-top:28px;"><img src="${esc(
                  b.bilde_url
                )}" alt="" width="528" style="display:block;width:100%;max-width:528px;height:auto;border-radius:14px;" /></div>`
              : ""
          }
        </td></tr>`;

    case "tekst":
      return `
        <tr><td style="padding:22px 36px;font-family:${SANS};font-size:16px;line-height:1.7;color:${INK};">
          ${richText(b.tekst)}
        </td></tr>`;

    case "kort":
      return `
        <tr><td style="padding:14px 36px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDER};border-radius:16px;background:#ffffff;">
            <tr><td style="padding:28px 26px;">
              ${kicker(b.kicker)}
              <div style="font-family:${SERIF};font-weight:600;letter-spacing:-0.02em;font-size:27px;line-height:1.2;color:${SNAKK_DARK_RED};margin-top:${
                b.kicker ? "16px" : "0"
              };">${esc(b.overskrift)}</div>
              ${
                b.bilde_url
                  ? `<div style="margin-top:18px;"><img src="${esc(
                      b.bilde_url
                    )}" alt="" width="476" style="display:block;width:100%;max-width:476px;height:auto;border-radius:12px;" /></div>`
                  : ""
              }
              ${
                b.tekst
                  ? `<div style="font-family:${SANS};font-size:16px;line-height:1.65;color:${INK};margin-top:14px;">${richText(
                      b.tekst
                    )}</div>`
                  : ""
              }
              ${pilLenke(b)}
            </td></tr>
          </table>
        </td></tr>`;

    case "nyhet":
      return `
        <tr><td style="padding:14px 36px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};border:1px solid ${BORDER};border-radius:16px;">
            <tr><td style="padding:24px 26px;">
              <div style="font-family:${SERIF};font-weight:600;letter-spacing:-0.02em;font-size:22px;line-height:1.25;color:${SNAKK_DARK_RED};">${esc(
                b.emoji
              )} ${esc(b.overskrift)}</div>
              <div style="font-family:${SANS};font-size:16px;line-height:1.65;color:${INK};margin-top:10px;">${richText(
                b.tekst
              )}</div>
              ${pilLenke(b)}
            </td></tr>
          </table>
        </td></tr>`;

    case "bilde":
      return `
        <tr><td style="padding:16px 36px;">
          ${
            b.bilde_url
              ? `<img src="${esc(
                  b.bilde_url
                )}" alt="" width="528" style="display:block;width:100%;max-width:528px;height:auto;border-radius:14px;" />`
              : ""
          }
          ${
            b.tekst
              ? `<div style="font-family:${SANS};font-size:13px;color:${MUTED};margin-top:10px;text-align:center;">${esc(
                  b.tekst
                )}</div>`
              : ""
          }
        </td></tr>`;

    case "deler":
      return `
        <tr><td style="padding:26px 36px 6px 36px;">
          <div style="border-top:1px solid ${BORDER};"></div>
          ${
            b.overskrift
              ? `<div style="font-family:${SANS};font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:${MUTED};margin-top:18px;">${esc(
                  b.overskrift
                )}</div>`
              : ""
          }
        </td></tr>`;

    case "cta":
      return `
        <tr><td align="center" style="padding:30px 36px;">
          <a href="${esc(b.lenke_url)}" style="display:inline-block;background:${SNAKK_RED};color:#ffffff;font-family:${SANS};font-size:15px;font-weight:bold;padding:15px 34px;border-radius:999px;text-decoration:none;">${esc(
            b.lenke_tekst
          )} &rarr;</a>
        </td></tr>`;
    case "rutenett":
      return renderDocumentBlock(b);
  }
}

// Semantic website palette serialized inline for email-client compatibility.
const DOCUMENT_COLORS = {
  ink: "#222b25", muted: "#526057", accent: "#1d513d", deep: "#123b2f",
  paper: "#ffffff", soft: "#f7f6f0", line: "#dedfd8", hero: "#b5ff6d", onHero: "#ffffff", highlight: "#b5ff6d",
};

function renderDocumentBlock(b: Blokk): string {
  const c = DOCUMENT_COLORS;
  const link = b.lenke_url ? `<div style="margin-top:14px;"><a href="${esc(b.lenke_url)}" style="color:${c.accent};font-weight:600;text-decoration:underline;">${esc(b.lenke_tekst || "Les mer")} &rarr;</a></div>` : "";
  const image = b.bilde_url ? `<img src="${esc(b.bilde_url)}" alt="${esc(b.bildetekst || b.overskrift || "Snakk V2")}" width="528" style="display:block;width:100%;max-width:528px;height:auto;" />${b.bildetekst ? `<div style="font-size:12px;line-height:1.5;color:${c.muted};margin-top:8px;">${esc(b.bildetekst)}</div>` : ""}` : "";
  const wrap = (inner: string, extra = "") => `<tr><td class="content" style="padding:22px 36px;${extra}">${inner}</td></tr>`;
  switch (b.type) {
    case "header":
      return wrap(`<img src="https://snakk-ai.lovable.app${websiteLogo.url}" alt="Snakk" width="90" style="display:inline-block;width:90px;height:auto;vertical-align:middle;" /><span style="font-size:12px;color:${c.muted};margin-left:16px;">&middot; &nbsp;${esc(b.overskrift)}</span>`, `background:${c.soft};`);
    case "hero":
      return wrap(`<div style="font-size:11px;font-weight:600;color:${c.accent};">${esc(b.kicker)}</div><h1 style="margin:18px 0;font-size:40px;line-height:1.2;font-weight:700;color:${c.deep};">${esc(b.overskrift).replace(/\. /g, ".<br />")}</h1><div style="font-size:17px;line-height:1.65;color:${c.deep};">${richText(b.tekst)}</div>`, `background:${c.hero};padding-top:36px;padding-bottom:36px;`);
    case "bilde":
      return wrap(image, `background:${c.soft};`);
    case "deler":
      return wrap(`<div style="border-top:1px solid ${c.line};padding-top:18px;text-align:center;font-size:11px;font-weight:600;color:${c.muted};">${esc(b.overskrift)}</div>`, "padding-top:36px;padding-bottom:8px;");
    case "kort":
    case "nyhet":
      return wrap(`${image ? `<div style="margin-bottom:24px;">${image}</div>` : ""}<div style="font-size:11px;font-weight:700;color:${c.accent};">${esc(b.kicker)}</div><h2 style="font-size:23px;line-height:1.3;font-weight:600;margin:10px 0;color:${c.ink};">${esc(b.overskrift)}</h2><div style="line-height:1.65;">${richText(b.tekst)}</div>${link}`);
    case "rutenett": {
      const items = b.elementer ?? [];
      const rows: string[] = [];
      for (let i = 0; i < items.length; i += 2) {
        rows.push(`<tr>${items.slice(i, i + 2).map(item => `<td class="grid-cell" width="50%" valign="top" style="width:50%;padding:16px;font-size:14px;line-height:1.5;"><strong style="font-size:16px;">${esc(item.overskrift)}</strong>${item.tekst ? `<div style="margin-top:6px;color:${c.muted};">${richText(item.tekst)}</div>` : ""}${item.lenke_url ? `<a href="${esc(item.lenke_url)}" style="display:inline-block;margin-top:8px;color:${c.accent};font-weight:600;">Les mer &rarr;</a>` : ""}</td>`).join("")}</tr>`);
      }
      return wrap(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${b.kicker === "verdi" ? c.paper : c.soft};table-layout:fixed;">${rows.join("")}</table>`);
    }
    case "cta":
      return wrap(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="grid-cell" width="50%" style="padding:0 6px 0 0;"><a href="${esc(b.lenke_url)}" style="display:block;padding:14px 8px;text-align:center;background:${c.accent};color:${c.onHero};font-size:14px;font-weight:600;text-decoration:none;border:1px solid ${c.accent};">${esc(b.lenke_tekst)}</a></td>${b.sekundar_lenke_url ? `<td class="grid-cell" width="50%" style="padding:0 0 0 6px;"><a href="${esc(b.sekundar_lenke_url)}" style="display:block;padding:14px 8px;text-align:center;color:${c.ink};font-size:14px;font-weight:600;text-decoration:none;border:1px solid ${c.ink};">${esc(b.sekundar_lenke_tekst)}</a></td>` : ""}</tr></table>`);
    case "tekst":
      return wrap(richText(b.tekst), b.kicker === "kontakt" ? `background:${c.soft};font-size:14px;` : "");
  }
}

function renderDocumentNewsletter(blokker: Blokk[], preheader?: string): string {
  const c = DOCUMENT_COLORS;
  return `<!DOCTYPE html><html lang="nb"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><style>@media(max-width:480px){.content{padding-left:20px!important;padding-right:20px!important;}h1{font-size:34px!important;}.grid-cell{padding:12px 8px!important;}}a{overflow-wrap:anywhere;}</style></head><body style="margin:0;background:${c.soft};font-family:${SANS};font-size:16px;line-height:1.65;color:${c.ink};"><div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 0;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${c.paper};">${blokker.filter(Boolean).map(renderDocumentBlock).join("")}<tr><td class="content" style="padding:30px 36px;text-align:center;font-size:12px;color:${c.muted};">Snakk Teknologi AS &middot; Org.nr. 835 505 812<br />AI og mennesker. På lag hele veien.<br /><a href="https://www.snakk.ai/personvern" style="color:${c.accent};">Personvern</a> &middot; <a href="{{unsubscribe}}" style="color:${c.muted};">Meld deg av</a></td></tr></table></td></tr></table></body></html>`;
}

export function renderNewsletterHtml(blokker: Blokk[], preheader?: string, theme?: NewsletterTheme): string {
  if (theme === "snakk-v2-document") return renderDocumentNewsletter(blokker ?? [], preheader);
  const body = (blokker ?? [])
    .filter((b): b is Blokk => !!b && typeof b === "object")
    .map(renderBlokk)
    .join("");
  const html = `<!DOCTYPE html>
<html lang="no"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f1ede7;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1ede7;padding:28px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;">
        ${body}
        <tr><td style="padding:30px 36px 10px 36px;font-family:${SANS};font-size:16px;line-height:1.7;color:${INK};">
          Hilsen Snakk-teamet
        </td></tr>
        <tr><td style="padding:26px 36px 32px 36px;border-top:1px solid ${BORDER};background:${CREAM};text-align:center;">
          <img src="${LOGO}" alt="Snakk" width="104" style="display:inline-block;width:104px;height:auto;" />
          <div style="font-family:${SERIF};font-weight:500;font-size:17px;color:${SNAKK_DARK_RED};margin-top:10px;">Mer tid til menneskene.</div>
          <div style="font-family:${SANS};font-size:12px;color:${MUTED};line-height:1.7;margin-top:14px;">
            Snakk Teknologi AS &middot; Norge<br />
            Du mottar denne e-posten fordi du er i kontakt med Snakk.<br />
            <a href="{{unsubscribe}}" style="color:${MUTED};text-decoration:underline;">Meld deg av nyhetsbrevet</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  if (theme !== "snakk-v2" && theme !== "snakk-v2-launch") return html;
  // Website brand tokens are serialized inline because email clients cannot use app CSS.
  const websitePalette: Record<string, string> = {
    "#FF6B0A": "#244b3d",
    "#171717": "#222b25",
    "#FAFAF9": "#e9eee5",
    "#E1DED9": "#d6dcd3",
    "#666666": "#526057",
    "#f1ede7": "#f7f6f0",
    "#ffffff": "#fbfaf7",
  };
  if (theme === "snakk-v2-launch") {
    Object.assign(websitePalette, {
      "#FF6B0A": "#1d513d",
      "#FAFAF9": "#f7f6f0",
      "#E1DED9": "#dedfd8",
      "#f1ede7": "#e9eee5",
    });
  }
  const themedHtml = html.replace(/#[0-9a-f]{6}\b/gi, color => websitePalette[color] ?? color)
    .split(LOGO).join(`https://snakk-ai.lovable.app${websiteLogo.url}`)
    .replace(/letter-spacing:(?:-0\.02em|2px)/g, "letter-spacing:0")
    .replace(/border-radius:999px/g, "border-radius:6px");
  if (theme !== "snakk-v2-launch") return themedHtml;
  return themedHtml
    .replace("Mer tid til menneskene.", "Mindre styr. Mer Snakk.")
    .replace(/background:#f7f6f0;padding:36px/, "background:#e2f0cd;padding:36px");
}
