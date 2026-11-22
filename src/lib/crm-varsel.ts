/**
 * Interne driftsvarsler på e-post er slått av (22.11.2026). varsleCrm beholdes
 * slik at eksisterende kall i CRM-et fungerer, men den sender ingenting.
 */
export type CrmHendelse =
  | "nytt_lead"
  | "prosjekt_tildelt"
  | "oppgave_tildelt"
  | "lead_konvertert"
  | "deal_vunnet"
  | "kontrakt_signert"
  | "kunde_live";

export interface CrmVarselPayload {
  hendelse: CrmHendelse;
  prosjekt_id?: string;
  oppgave_id?: string;
  salgsmulighet_id?: string;
  selskap_id?: string;
  lead_id?: string;
}

export const CRM_VARSEL_AKTIV = false;

export async function varsleCrm(_payload: CrmVarselPayload): Promise<void> {
  if (!CRM_VARSEL_AKTIV) return;
}
