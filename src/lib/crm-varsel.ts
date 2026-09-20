import { supabase } from "@/integrations/supabase/client";

/**
 * Interne driftsvarsler på e-post. Kallene er «fire and forget» – en e-post som
 * ikke går gjennom skal aldri stoppe handlingen brukeren utførte i CRM-et.
 */
export type CrmHendelse =
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

export async function varsleCrm(payload: CrmVarselPayload): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke("crm-varsel", { body: payload });
    if (error) console.warn("Kunne ikke sende internt varsel", payload.hendelse, error.message);
  } catch (err) {
    console.warn("Kunne ikke sende internt varsel", payload.hendelse, err);
  }
}
