import { describe, it, expect } from "vitest";
import type { Lead, Salgsmulighet, Selskap } from "@/data/crm-data";
import { aktiveVed, iMaaned, leadRad, leadsI, taptI, vunnetI } from "@/lib/rapport-detaljer";

const lead = (id: string, opprettet_dato: string, firmanavn = "Firma " + id) => ({ id, opprettet_dato, firmanavn, kontaktperson: "Ola", kilde: "Nettside", status: "Ny" }) as unknown as Lead;
const sm = (id: string, p: Partial<Salgsmulighet>) => ({ id, navn: id, ...p }) as Salgsmulighet;
const nov = new Date(2026, 10, 1);
const okt = new Date(2026, 9, 1);

describe("Rapporter – nøyaktige lister bak grafene", () => {
  it("lista for en måned inneholder akkurat leadsene som telles i søylen", () => {
    const leads = [lead("a", "2026-11-01"), lead("b", "2026-11-30"), lead("c", "2026-10-31"), lead("d", "2026-12-01"), lead("e", "")];
    const iNov = leadsI(leads, [nov]);
    expect(iNov.map(l => l.id)).toEqual(["a", "b"]);
    expect(leadsI(leads, [okt, nov]).map(l => l.id)).toEqual(["a", "b", "c"]);
  });

  it("månedsgrensen følger kalendermåneden", () => {
    expect(iMaaned("2026-11-30", nov)).toBe(true);
    expect(iMaaned("2026-12-01", nov)).toBe(false);
    expect(iMaaned(null, nov)).toBe(false);
  });

  it("leadraden åpner leadkortet og viser firmanavn først", () => {
    const r = leadRad(lead("x", "2026-11-05", "Bryggeloftet"));
    expect(r.kunde).toEqual({ type: "lead", id: "x" });
    expect(r.navn).toBe("Bryggeloftet");
  });

  it("vunnet og tapt telles på riktig dato og status", () => {
    const liste = [
      sm("v1", { status: "Vunnet", vunnet_dato: "2026-11-10" }),
      sm("v2", { status: "Vunnet", vunnet_dato: "2026-10-10" }),
      sm("t1", { status: "Tapt", tapt_dato: "2026-11-02" }),
      sm("o1", { status: "Kontrakt sendt", vunnet_dato: "2026-11-10" }),
    ];
    expect(vunnetI(liste, [nov]).map(s => s.id)).toEqual(["v1"]);
    expect(taptI(liste, [nov]).map(s => s.id)).toEqual(["t1"]);
  });

  it("ARR-lista tar med kunder som var aktive ved månedsslutt, ikke kansellerte", () => {
    const sel = [
      { id: "1", lukkedato: "2026-09-01", kundestatus: "Live" },
      { id: "2", lukkedato: "2026-12-01", kundestatus: "Live" },
      { id: "3", lukkedato: "2026-08-01", kundestatus: "Kansellert", kansellert_dato: "2026-10-15" },
    ] as unknown as Selskap[];
    expect(aktiveVed(sel, nov).map(s => s.id)).toEqual(["1"]);
    expect(aktiveVed(sel, new Date(2026, 8, 1)).map(s => s.id)).toEqual(["1", "3"]);
  });
});
