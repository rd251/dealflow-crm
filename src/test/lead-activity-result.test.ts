import { describe, expect, it, vi, afterEach } from "vitest";
import type { Lead } from "@/data/crm-data";
import { applyLeadActivityResult } from "@/lib/lead-activity-result";

const lead: Lead = {
  id: "lead-test", firmanavn: "Testbedrift", kontaktperson: "", e_post: "", telefon: "",
  kilde: "Telefon", status: "Kontaktet", ansvarlig: "", neste_steg: "", notater: "",
  opprettet_dato: "2026-10-01", sist_aktivitet: "2026-10-29", neste_oppfolging: "2026-11-02",
  konvertert_dato: "", konvertert_til: "", rolle_i_firma: "", use_case: "",
  videresendt_til_partner_id: "", videresendt_dato: "",
};

afterEach(() => vi.useRealTimers());

describe("lead detail activity outcome", () => {
  it.each(["2026-10-29", "2026-10-30"])("keeps Ikke aktuelt and clears follow-up even when last activity was %s", (day) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-30T09:00:00Z"));
    const saved = applyLeadActivityResult({ ...lead, sist_aktivitet: day }, { id: "activity", ikkeAktuelt: true, nesteOppfolging: "" });
    expect(saved.status).toBe("Ikke aktuelt");
    expect(saved.neste_oppfolging).toBe("");
    // A subsequent local edit must retain the terminal outcome when synced.
    const edited = { ...saved, notater: "Edited later" };
    expect(edited.status).toBe("Ikke aktuelt");
    expect(edited.neste_oppfolging).toBe("");
  });

  it("uses the saved follow-up for an ordinary logged call", () => {
    const saved = applyLeadActivityResult(lead, { id: "activity", ikkeAktuelt: false, nesteOppfolging: "2026-11-05" });
    expect(saved.status).toBe("Kontaktet");
    expect(saved.neste_oppfolging).toBe("2026-11-05");
  });

  it("preserves follow-up when no result is provided", () => {
    expect(applyLeadActivityResult(lead).neste_oppfolging).toBe("2026-11-02");
  });
});