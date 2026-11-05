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
    expect(oppsummer(rader)).toEqual({ samtaler: 3, snakket: 1, booket: 1, meldinger: 1, oppgaver: 1, eposter: 0 });
  });
});

import { byggEposter as _byggEposter, oppsummer as _oppsummer } from "@/lib/gjort-i-dag";
describe("E-poster i Gjort i dag", () => {
  const fra = "2026-11-04T23:00:00.000Z";
  const e = (id: string, dato: string, extra: Record<string, unknown> = {}) => ({ id, type: "E-post", tittel: "→ Re: Hei", beskrivelse: "[threadId:abc] [kunde@firma.no] Hei", dato, user_id: null, ...extra });
  it("teller sendte e-post i dag, tilskriver Gmail-eier og viser mottaker", () => {
    const r = _byggEposter([e("1", "2026-11-05T07:00:00Z"), e("2", "2026-11-04T22:00:00Z")], [], fra, "u1");
    expect(r).toHaveLength(1);
    expect(r[0].user_id).toBe("u1");
    expect(r[0].notat).toBe("til kunde@firma.no · Re: Hei");
    expect(_oppsummer(r).eposter).toBe(1);
  });
  it("hopper over CRM-systemvarsler", () => {
    expect(_byggEposter([e("1", "2026-11-05T07:00:00Z", { tittel: "→ [Snakk CRM] Morgenrapport" })], [], fra)).toHaveLength(0);
  });
  it("dobbelttelles ikke når samme e-post er logget manuelt", () => {
    const manuell = { id: "m", type: "E-post", tittel: "Sendte e-post", beskrivelse: null, dato: "2026-11-05T07:05:00Z", user_id: "u1", lead_id: "L" };
    expect(_byggEposter([e("1", "2026-11-05T07:00:00Z", { lead_id: "L" })], [manuell], fra)).toHaveLength(0);
  });
});
