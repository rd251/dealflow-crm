import { describe, it, expect } from "vitest";
import { byggGjort, klassifiser, midnattOslo, oppsummer, type GjortAkt } from "@/lib/gjort-i-dag";

const akt = (id: string, tittel: string, dato: string, type = "Telefonsamtale"): GjortAkt =>
  ({ id, type, tittel, beskrivelse: tittel, dato, user_id: "u1" });

describe("Gjort i dag", () => {
  it("klassifiserer utfall fra loggkomponentens titler", () => {
    expect(klassifiser({ type: "Telefonsamtale", tittel: "Ringte – svarte ikke – Ola" })).toBe("svarte_ikke");
    expect(klassifiser({ type: "Telefonsamtale", tittel: "Booket møte 3. nov – Ola" })).toBe("booket");
    expect(klassifiser({ type: "SMS", tittel: "Sendte SMS – Ola" })).toBe("melding");
    expect(klassifiser({ type: "Notat", tittel: "Notat – Ola" })).toBe("notat");
  });

  it("midnatt norsk tid er 23:00 UTC om vinteren", () => {
    expect(midnattOslo(new Date("2026-11-02T12:00:00Z"))).toBe("2026-11-01T23:00:00.000Z");
  });

  it("teller kun i dag, nyeste først, og oppsummerer", () => {
    const fra = "2026-11-01T23:00:00.000Z";
    const rader = byggGjort([
      akt("1", "Snakket med – A", "2026-11-02T08:00:00Z"),
      akt("2", "Ringte – svarte ikke – B", "2026-11-02T09:00:00Z"),
      akt("3", "Booket møte – C", "2026-11-02T10:00:00Z"),
      akt("4", "Sendte e-post – D", "2026-11-02T11:00:00Z", "E-post"),
      akt("5", "Snakket med – i går", "2026-11-01T22:00:00Z"),
      akt("6", "Kundemøte", "2026-11-02T09:30:00Z", "Møte"),
    ], [{ id: "o1", oppgave: "Ring A", updated_at: "2026-11-02T08:30:00Z", user_id: "u1" }], fra);
    expect(rader.map(r => r.key)).toEqual(["a-4", "a-3", "a-2", "o-o1", "a-1"]);
    expect(oppsummer(rader)).toEqual({ samtaler: 3, snakket: 1, booket: 1, meldinger: 1, oppgaver: 1 });
  });
});
