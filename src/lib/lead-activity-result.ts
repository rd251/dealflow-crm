import type { Lead } from "@/data/crm-data";
import type { loggAktivitet } from "@/lib/activity-logging";

export type ActivityLogResult = Awaited<ReturnType<typeof loggAktivitet>>;

/** Apply the saved outcome before the CRM store writes the lead back. */
export function applyLeadActivityResult(lead: Lead, result?: ActivityLogResult): Lead {
  return {
    ...lead,
    sist_aktivitet: new Date().toISOString().split("T")[0],
    ...(result ? {
      status: result.ikkeAktuelt ? "Ikke aktuelt" : lead.status,
      neste_oppfolging: result.ikkeAktuelt ? "" : result.nesteOppfolging || lead.neste_oppfolging,
    } : {}),
  };
}