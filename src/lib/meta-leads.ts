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

/**
 * Om varselet «Meta-innloggingen er utløpt» skal vises: bare når siste feil er en
 * innloggingsfeil og ingen lead er hentet etter at feilen skjedde.
 */
export function visMetaInnloggingVarsel(state: {
  last_error?: string | null;
  last_error_at?: string | null;
  last_processed_at?: string | null;
} | null | undefined): boolean {
  if (!state || !erMetaInnloggingUloept(state.last_error)) return false;
  if (state.last_processed_at && state.last_error_at
    && new Date(state.last_processed_at).getTime() > new Date(state.last_error_at).getTime()) {
    return false;
  }
  return true;
}
