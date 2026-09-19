/**
 * Snakk CRM er et internt verktøy for Snakk Teknologi AS.
 * Kun ansatte med @snakk.ai-konto får tilgang. Investorer på adminstyrt
 * allowlist er eneste unntak, og de når kun den skrivebeskyttede siden.
 */
export const SNAKK_EPOSTDOMENE = "snakk.ai";

export const IKKE_SNAKK_KONTO_MELDING =
  `Snakk CRM er kun for ansatte i Snakk Teknologi AS. Logg inn med @${SNAKK_EPOSTDOMENE}-kontoen din.`;

export function harSnakkEpost(epost?: string | null): boolean {
  return (epost ?? "").trim().toLowerCase().endsWith(`@${SNAKK_EPOSTDOMENE}`);
}
