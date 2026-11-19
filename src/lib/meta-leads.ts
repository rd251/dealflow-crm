/**
 * Sjekker om en Meta-feilmelding betyr at innloggingen (tilgangstokenet) er utløpt.
 * Speiler isAuthFailure() i supabase/functions/_shared/meta-leads.ts — der klassifiseres
 * svaret fra Meta, her klassifiserer den lagrede feilmeldingen som vises i Innstillinger.
 */
export function erMetaInnloggingUloept(lastError: string | null | undefined): boolean {
  if (!lastError) return false;
  const t = lastError.toLowerCase();
  return (
    t.includes("graph api 401") ||
    t.includes("error validating access token") ||
    t.includes("session has expired") ||
    t.includes("unsupported access token") ||
    t.includes("invalid oauth_access_token")
  );
}
