import React, { useMemo } from "react";

interface Props {
  partner_navn?: string;
  lead_firmanavn?: string;
  lead_kontaktperson?: string;
  lead_epost?: string;
  lead_telefon?: string;
  lead_rolle?: string;
  lead_kilde?: string;
  lead_use_case?: string;
  lead_notater?: string;
  har_byggeagent?: boolean;
  onboarding_oppsummering?: string;
  videresendt_av?: string;
  intern_melding?: string;
}

const BRAND_RED = "#c0392b";
const BRAND_DARK = "#1a1917";
const LOGO_URL =
  "https://tchmujgzcklwgptocbno.supabase.co/storage/v1/object/public/email-assets/snakk-logo-full.svg";

const escape = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Renders an HTML preview that mirrors the lead-forwarded-to-partner email
 * template. Kept in sync visually with
 * supabase/functions/_shared/transactional-email-templates/lead-forwarded-to-partner.tsx
 */
export const LeadForwardEmailPreview: React.FC<Props> = (props) => {
  const html = useMemo(() => {
    const v = (s?: string) => (s && s.trim() ? escape(s) : "&ndash;");
    const subject = `Nytt lead videresendt: ${props.lead_firmanavn || "nytt firma"}`;
    const partner_navn = props.partner_navn || "Partner";
    return `<!doctype html><html><head><meta charset="utf-8"/>
<style>
  body{margin:0;background:#f5f4f2;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:8px 0;color:${BRAND_DARK};}
  .container{max-width:600px;margin:0 auto;width:100%;}
  .header{background:#fff;padding:22px 0;text-align:center;border-radius:8px 8px 0 0;border-bottom:3px solid ${BRAND_RED};}
  .content{background:#fff;padding:28px;}
  h1{font-size:22px;font-weight:700;color:${BRAND_DARK};margin:0 0 12px;}
  h2{font-size:14px;font-weight:700;color:${BRAND_DARK};margin:8px 0;text-transform:uppercase;letter-spacing:.5px;}
  p{font-size:14px;color:#555;line-height:1.6;margin:0 0 14px;}
  hr{border:none;border-top:1px solid #eee;margin:20px 0;}
  table{width:100%;border-collapse:collapse;}
  td{padding:6px 8px 6px 0;vertical-align:top;width:50%;}
  .label{font-size:11px;color:#999;margin:0 0 2px;text-transform:uppercase;letter-spacing:.4px;}
  .value{font-size:14px;color:${BRAND_DARK};margin:0;font-weight:500;}
  .multi{font-size:14px;color:#333;margin:0;white-space:pre-wrap;line-height:1.5;}
  .msgbox{background:#fdf4f3;border-left:3px solid ${BRAND_RED};padding:10px 14px;margin:8px 0 16px;border-radius:4px;}
  .msglabel{font-size:11px;color:${BRAND_RED};font-weight:600;margin:0 0 4px;text-transform:uppercase;letter-spacing:.4px;}
  .footer{padding:18px 28px;text-align:center;border-radius:0 0 8px 8px;background:#fff;border-top:2px solid ${BRAND_RED};}
  .footer p{font-size:12px;color:#999;margin:0 0 4px;}
  .footer .copy{font-size:11px;color:#bbb;margin:6px 0 0;}
  .note{font-size:12px;color:#888;font-style:italic;margin:8px 0 0;}
</style></head><body>
<div class="container">
  <div class="header"><img src="${LOGO_URL}" alt="Snakk" width="120"/></div>
  <div class="content">
    <h1>Nytt lead til ${escape(partner_navn)}</h1>
    <p>Hei! Vi har et nytt lead vi tror passer for dere. Under finner du all kontaktinfo og bakgrunn vi har på leaden så langt.</p>
    ${props.intern_melding ? `<div class="msgbox"><p class="msglabel">Melding fra Snakk</p><p class="multi">${escape(props.intern_melding)}</p></div>` : ""}
    <hr/>
    <h2>Kontaktinformasjon</h2>
    <table><tr>
      <td><p class="label">Firma</p><p class="value">${v(props.lead_firmanavn)}</p></td>
      <td><p class="label">Kontaktperson</p><p class="value">${v(props.lead_kontaktperson)}</p></td>
    </tr><tr>
      <td><p class="label">E-post</p><p class="value">${v(props.lead_epost)}</p></td>
      <td><p class="label">Telefon</p><p class="value">${v(props.lead_telefon)}</p></td>
    </tr>
    ${props.lead_rolle ? `<tr><td colspan="2"><p class="label">Rolle i firma</p><p class="value">${escape(props.lead_rolle)}</p></td></tr>` : ""}
    </table>
    <hr/>
    <h2>Om leaden</h2>
    <table><tr>
      <td><p class="label">Kilde</p><p class="value">${v(props.lead_kilde)}</p></td>
      <td><p class="label">Byggeagent via selvbygger</p><p class="value">${props.har_byggeagent ? "Ja – har startet i selvbyggeren" : "Nei"}</p></td>
    </tr>
    ${props.lead_use_case ? `<tr><td colspan="2"><p class="label">Use case</p><p class="value">${escape(props.lead_use_case)}</p></td></tr>` : ""}
    ${props.lead_notater ? `<tr><td colspan="2"><p class="label">Notater</p><p class="multi">${escape(props.lead_notater)}</p></td></tr>` : ""}
    </table>
    ${props.onboarding_oppsummering ? `<hr/><h2>Svar fra selvbyggeren</h2><p class="multi">${escape(props.onboarding_oppsummering)}</p>` : ""}
    <hr/>
    <p class="note">Videresendt ${props.videresendt_av ? `av ${escape(props.videresendt_av)}` : ""}. Ta gjerne kontakt direkte med leaden, og gi oss en oppdatering når dere har snakket sammen.</p>
  </div>
  <div class="footer">
    <img src="${LOGO_URL}" alt="Snakk" width="80" style="margin:0 auto 8px;display:block;"/>
    <p>Snakk Teknologi AS — snakk.ai</p>
    <p class="copy">©2026 Snakk. Alle rettigheter reservert.</p>
  </div>
</div>
<!-- subject: ${escape(subject)} -->
</body></html>`;
  }, [props]);

  return (
    <iframe
      title="E-post forhåndsvisning"
      srcDoc={html}
      className="w-full h-[460px] rounded-lg border bg-white"
      sandbox=""
    />
  );
};

export default LeadForwardEmailPreview;
