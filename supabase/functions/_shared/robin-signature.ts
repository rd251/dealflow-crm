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

export function robinSignatureHtml(): string {
  const s = ROBIN_SIGNATURE;
  const c = SIGNATURE_COLORS;
  const link = `color:${c.text};text-decoration:underline;`;
  return `<table data-snakk-signature="robin" role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;max-width:440px;font-family:Arial,Helvetica,sans-serif;color:${c.text};background-color:${c.background};font-size:12px;line-height:20px;"><tr><td style="vertical-align:top;padding:8px 16px 8px 0;border-right:1px solid ${c.accent};"><strong style="font-size:15px;line-height:22px;">${s.navn}</strong><br>${escapeEmailHtml(s.tittel)}<br>${s.selskap}</td><td style="vertical-align:top;padding:4px 0 4px 16px;"><span style="color:${c.accent};">&#9742;</span> &nbsp;<a href="tel:+4793438816" style="${link}">${s.telefon}</a><br><span style="color:${c.accent};">&#9993;</span> &nbsp;<a href="mailto:${s.epost}" style="${link}">${s.epost}</a><br><span style="color:${c.accent};">&#9678;</span> &nbsp;<a href="https://${s.nettsted}" style="${link}">${s.nettsted}</a><br><span style="color:${c.accent};">&#9906;</span> &nbsp;${s.adresse}</td></tr></table>`;
}

export function appendRobinHtml(html: string): string {
  if (html.includes('data-snakk-signature="robin"')) return html;
  const signature = robinSignatureHtml();
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${signature}</body>`) : `${html}${signature}`;
}

/** Only remove a trailing signature, never a name mentioned in the message. */
export function withoutRobinSignature(body: string): string {
  const lines = body.trimEnd().split("\n");
  const nameIndex = lines.findLastIndex(line => line.trim() === ROBIN_SIGNATURE.navn);
  if (nameIndex < 0) return body.trimEnd();
  const allowed = new Set([
    ...Object.values(ROBIN_SIGNATURE), "Snakk AI", "Salgssjef i Snakk", "",
  ]);
  if (!lines.slice(nameIndex + 1).every(line => allowed.has(line.trim()))) return body.trimEnd();
  let cut = nameIndex;
  if (cut > 0 && /^(vennlig hilsen|med vennlig hilsen|mvh)[,.!]?$/i.test(lines[cut - 1].trim())) cut--;
  return lines.slice(0, cut).join("\n").trimEnd();
}