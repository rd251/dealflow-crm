/** Approved contact identity; shared by plain-text and HTML email senders. */
export const ROBIN_SIGNATURE = {
  navn: "Robin Sæter Diallo",
  tittel: "Head of sales & Partner",
  selskap: "Snakk Teknologi AS",
  telefon: "+47 934 38 816",
  epost: "rd@snakk.ai",
  nettsted: "snakk.ai",
  adresse: "Sørkedalsveien 6, 0369 Oslo",
};

export const SIGNATURE_COLORS = { text: "#111111", accent: "#ff3939", background: "#ffffff" };

export function escapeEmailHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function robinSignatureText(): string {
  const s = ROBIN_SIGNATURE;
  return [s.navn, s.tittel, s.selskap, s.telefon, s.epost, s.nettsted, s.adresse].join("\n");
}

/** Exact copy of Robin's Gmail signature (fetched from Gmail sendAs settings). */
export const ROBIN_GMAIL_SIGNATURE_HTML = "<div dir=\"ltr\"><table cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"color:rgb(34,34,34);vertical-align:-webkit-baseline-middle;font-size:medium;font-family:Tahoma\"><tbody><tr><td><table cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"600px\" style=\"vertical-align:-webkit-baseline-middle;font-size:small;font-family:&quot;Trebuchet MS&quot;\"><tbody><tr><td><table cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"vertical-align:-webkit-baseline-middle\"><tbody><tr><td style=\"vertical-align:middle\"><h2 style=\"margin:0px;font-size:16px;color:rgb(0,0,0);line-height:24px\">Robin Sæter Diallo</h2><p style=\"margin:0px;color:rgb(0,0,0);font-size:12px;line-height:20px\">Head of sales &amp; Partner</p><div style=\"margin:0px;color:rgb(0,0,0);font-size:12px;line-height:20px\">Snakk Teknologi AS</div><div style=\"margin:0px;font-size:12px;line-height:20px\"><font style=\"background-color:rgb(255,255,255)\" color=\"#f3f3f3\"><a href=\"https://www.snakk.ai/kom-i-gang\" target=\"_blank\">Bygg din AI-agent gratis på 2 min</a><br></font></div></td><td width=\"30\"><div style=\"width:30px\"></div></td><td width=\"1\" style=\"width:1px;height:auto;border-bottom:none;border-left:1px solid rgb(218,41,28)\"></td><td width=\"30\"><div style=\"width:30px\"></div></td><td style=\"vertical-align:middle\"><table cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"vertical-align:-webkit-baseline-middle;line-height:1\"><tbody><tr style=\"vertical-align:middle;height:26px\"><td width=\"24\" style=\"vertical-align:middle\"><table cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"vertical-align:-webkit-baseline-middle;width:24px\"><tbody><tr><td style=\"vertical-align:bottom\"><span style=\"display:inline-block;background-color:rgb(218,41,28)\"><img src=\"https://ci3.googleusercontent.com/meips/ADKq_NbPrROLtj4fawXnKVUz794HAvSkMKhRBWWDN0Y_YxrVHR3XBu1iz0RuuT6mj35BoMcSCFUZBPPioV3WeEhQ_tblOblclUXZugFTzsme1ve9hKpcoqJxBR_eeQw4DJznceJThOuk6JIOfp2ykyvf7HYffXPf=s0-d-e1-ft#https://cdn2.hubspot.net/hubfs/53/tools/email-signature-generator/icons/phone-icon-dark-2x.png\" alt=\"mobilePhone\" width=\"16\" style=\"display:block;background-image:linear-gradient(rgb(218,41,28),rgb(218,41,28))\"></span></td></tr></tbody></table></td><td style=\"padding:0px;color:rgb(0,0,0)\"><a href=\"tel:+47+93+43+88+16\" style=\"color:rgb(0,0,0);font-size:12px\" target=\"_blank\">+47 934 38 816</a></td></tr><tr style=\"vertical-align:middle;height:26px\"><td width=\"24\" style=\"vertical-align:middle\"><table cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"vertical-align:-webkit-baseline-middle;width:24px\"><tbody><tr><td style=\"vertical-align:bottom\"><span style=\"display:inline-block;background-color:rgb(218,41,28)\"><img src=\"https://ci3.googleusercontent.com/meips/ADKq_NZiGr2hZow7eNQIBWE33hRNabiVCggeahhaAzeawU0jvGbvAK8CLW59gunksF1wGY8qaWCGs7REQpIh2zztfSX4CsWz-EeWkxKkqLHj7PYGE_M3qMKVl4Dkr01vC6EbFprePDiasLDNdM0kBXbekPvCQd5n=s0-d-e1-ft#https://cdn2.hubspot.net/hubfs/53/tools/email-signature-generator/icons/email-icon-dark-2x.png\" alt=\"emailAddress\" width=\"16\" style=\"display:block;background-image:linear-gradient(rgb(218,41,28),rgb(218,41,28))\"></span></td></tr></tbody></table></td><td style=\"padding:0px;color:rgb(0,0,0)\"><a href=\"mailto:rd@snakk.ai\" style=\"color:rgb(0,0,0);font-size:12px\" target=\"_blank\">rd@snakk.ai</a></td></tr><tr style=\"vertical-align:middle;height:26px\"><td width=\"24\" style=\"vertical-align:middle\"><table cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"vertical-align:-webkit-baseline-middle;width:24px\"><tbody><tr><td style=\"vertical-align:bottom\"><span style=\"display:inline-block;background-color:rgb(218,41,28)\"><img src=\"https://ci3.googleusercontent.com/meips/ADKq_NZRuPhoYde1grloPhf5ahppRrM1pnpAirGxrGobVGeeRAdL2I-ToE89YB5M1KbjKVKLYXh5KKlgo3lgQI7s7GrW_YSvwW5RMm0Ogwt6VGDKXoNGCrGopCtmWGjLbuniLPf--etzyVrcvknsig5f0OgDZYk=s0-d-e1-ft#https://cdn2.hubspot.net/hubfs/53/tools/email-signature-generator/icons/link-icon-dark-2x.png\" alt=\"website\" width=\"16\" style=\"display:block;background-image:linear-gradient(rgb(218,41,28),rgb(218,41,28))\"></span></td></tr></tbody></table></td><td style=\"padding:0px;color:rgb(0,0,0)\"><a href=\"https://snakk.ai/\" style=\"color:rgb(0,0,0);font-size:12px\" target=\"_blank\">snakk.ai</a></td></tr><tr style=\"vertical-align:middle;height:26px\"><td width=\"24\" style=\"vertical-align:middle\"><table cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"vertical-align:-webkit-baseline-middle;width:24px\"><tbody><tr><td style=\"vertical-align:bottom\"><span style=\"display:inline-block;background-color:rgb(218,41,28)\"><img src=\"https://ci3.googleusercontent.com/meips/ADKq_Nb9fh8Szw5GTE-UiL85xBwrBuVRt9RxL6uiBu6tzZmf8uly88ofSm15GkqFBAdY2cPlGeXBL4PHsbuAdzwDGuCXmW-XF1qlJfmuAkhzgs8AyY2FKzeB8Syb4HUUgBnc5q62WdfynYVN6JfIKc9Tv4um-BBw3q4=s0-d-e1-ft#https://cdn2.hubspot.net/hubfs/53/tools/email-signature-generator/icons/address-icon-dark-2x.png\" alt=\"address\" width=\"16\" style=\"display:block;background-image:linear-gradient(rgb(218,41,28),rgb(218,41,28))\"></span></td></tr></tbody></table></td><td style=\"padding:0px;color:rgb(0,0,0)\"><span style=\"font-size:12px\">Sørkedalsveien 6, 0369 Oslo</span></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></div>";

export function robinSignatureHtml(): string {
  return `<div data-snakk-signature="robin" style="margin-top:24px;">${ROBIN_GMAIL_SIGNATURE_HTML}</div>`;
}

export function appendRobinHtml(html: string): string {
  if (html.includes('data-snakk-signature="robin"')) return html;
  const signature = robinSignatureHtml();
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${signature}</body>`) : `${html}${signature}`;
}

/** Only remove a trailing signature, never a name mentioned in the message. */
export function withoutRobinSignature(body: string): string {
  const lines = body.trimEnd().split("\n");
  let nameIndex = -1;
  for (let index = lines.length - 1; index >= 0; index--) {
    if (lines[index].trim() === ROBIN_SIGNATURE.navn) { nameIndex = index; break; }
  }
  if (nameIndex < 0) return body.trimEnd();
  const allowed = new Set([
    ...Object.values(ROBIN_SIGNATURE), "Snakk AI", "Salgssjef i Snakk", "",
  ]);
  if (!lines.slice(nameIndex + 1).every(line => allowed.has(line.trim()))) return body.trimEnd();
  let cut = nameIndex;
  if (cut > 0 && /^(vennlig hilsen|med vennlig hilsen|mvh)[,.!]?$/i.test(lines[cut - 1].trim())) cut--;
  return lines.slice(0, cut).join("\n").trimEnd();
}