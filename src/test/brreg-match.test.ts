import { describe, it, expect } from "vitest";
import { avgjoer, erOrgnr, erTullesvar, finnRolle, firmadomene, normaliserNavn, personNoekkel, scorKandidat, selskapsfelterFraBrreg, type BrregKandidat, type BrregData } from "@/lib/brreg-match";

const k = (navn: string, score: number, extra: Partial<BrregKandidat> = {}): BrregKandidat => ({
  orgnr: String(100000000 + score), navn, organisasjonsform: "AS", kommune: null, bransje: null, ansatte: null, hjemmeside: null, status: null, score, begrunnelse: [], ...extra,
});

describe("brreg-match regler", () => {
  it("tullesvar gir ingen søk", () => {
    expect(erTullesvar("noting")).toBe(true);
    expect(erTullesvar("  Privatperson ")).toBe(true);
    expect(erTullesvar("")).toBe(true);
    expect(erTullesvar("Ola Nordmann", "Ola Nordmann")).toBe(true);
    expect(erTullesvar("Snakk Teknologi", "Robin")).toBe(false);
  });
  it("normaliserer selskapsform og tegnsetting", () => {
    expect(normaliserNavn("Snakk Teknologi AS.")).toBe("snakk teknologi");
    expect(normaliserNavn("BRYGGESTUEN - BRYGGELOFTET AS")).toBe("bryggestuen bryggeloftet");
  });
  it("9 sifre er org.nr", () => {
    expect(erOrgnr("986 658 645")).toBe("986658645");
    expect(erOrgnr("98665864")).toBeNull();
  });
  it("generiske e-postdomener ignoreres", () => {
    expect(firmadomene("tmrabben@gmail.com")).toBeNull();
    expect(firmadomene("rd@snakk.ai")).toBe("snakk.ai");
  });
  it("poeng: eksakt navn 90, delvis 5, domene 40, konkurs −50", () => {
    expect(scorKandidat("Snakk Teknologi", { navn: "SNAKK TEKNOLOGI AS" }, null).score).toBe(90);
    expect(scorKandidat("Halsa Kommune", { navn: "HALSA SAUEHOLD" }, null).score).toBe(5);
    expect(scorKandidat("Tine", { navn: "TINE SA", hjemmeside: "www.tine.no" }, "tine.no").score).toBe(130);
    expect(scorKandidat("Snakk Teknologi", { navn: "SNAKK TEKNOLOGI AS", status: "Konkurs" }, null).score).toBe(40);
  });
  it("sikker krever ≥80 og 25 poeng forsprang", () => {
    expect(avgjoer([k("A", 90), k("B", 70)]).status).toBe("usikker");
    expect(avgjoer([k("A", 90), k("B", 65)]).status).toBe("sikker");
    expect(avgjoer([k("A", 79)]).status).toBe("usikker");
    expect(avgjoer([]).status).toBe("ingen");
  });
  it("kommune uten aktivt KOMM-treff gir ingen med melding", () => {
    const a = avgjoer([k("HALSA SAUEHOLD", 5)], true);
    expect(a.status).toBe("ingen");
    expect(a.melding).toBe("Kommunen finnes ikke i registeret, kan være sammenslått");
  });
  it("rollematch ignorerer mellomnavn og prioriterer daglig leder", () => {
    const roller = [
      { type: "MEDL", beskrivelse: "Styremedlem", noekkel: personNoekkel("Robin", "Diallo"), navn: "Robin Sæter Diallo" },
      { type: "DAGL", beskrivelse: "Daglig leder", noekkel: personNoekkel("Robin", "Diallo"), navn: "Robin Sæter Diallo" },
    ];
    expect(finnRolle(roller, "robin sæter diallo")?.beskrivelse).toBe("Daglig leder");
    expect(finnRolle(roller, "Robin Hansen")).toBeNull();
  });
  it("låste felt alltid, kontaktfelt bare når tomme, aldri firmanavn", () => {
    const d = { orgnr: "986658645", forretningsadresse: "Gate 1, 3700 SKIEN", postadresse: null, naeringskode1: { kode: "95.310", beskrivelse: "Reparasjon" }, telefon: "123", mobil: null, epostadresse: "a@b.no", hjemmeside: "www.b.no" } as unknown as BrregData;
    const f = selskapsfelterFraBrreg(d, { telefon: "999", e_post: "", domene: "" });
    expect(f).toEqual({ orgnr: "986658645", firmaadresse: "Gate 1, 3700 SKIEN", postadresse: "Gate 1, 3700 SKIEN", bransje: "Reparasjon", e_post: "a@b.no", domene: "b.no" });
    expect("firmanavn" in f).toBe(false);
  });
});
