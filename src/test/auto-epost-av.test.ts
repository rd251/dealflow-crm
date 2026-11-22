import { describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));

import { CRM_VARSEL_AKTIV, varsleCrm } from "@/lib/crm-varsel";

describe("interne auto-e-poster fra CRM-et", () => {
  it("er slått av", () => {
    expect(CRM_VARSEL_AKTIV).toBe(false);
  });

  it("varsleCrm kaller ikke varselfunksjonen for nytt lead, vunnet deal eller tildelt oppgave", async () => {
    await varsleCrm({ hendelse: "nytt_lead", lead_id: "l1" });
    await varsleCrm({ hendelse: "deal_vunnet", salgsmulighet_id: "s1" });
    await varsleCrm({ hendelse: "oppgave_tildelt", oppgave_id: "o1" });
    expect(invoke).not.toHaveBeenCalled();
  });
});
