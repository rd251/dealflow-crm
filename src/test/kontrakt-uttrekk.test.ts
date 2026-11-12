import { describe, it, expect } from "vitest";
import {
  normaliserUttrekk, medKontraktsinfo, selskapMedKontraktsinfo, standardSalgsmulighet, NY_SALGSMULIGHET,
} from "@/lib/kontrakt-uttrekk";
import type { Salgsmulighet, Selskap } from "@/data/crm-data";

const sm = (id: string, status: Salgsmulighet["status"], extra: Partial<Salgsmulighet> = {}) =>
  ({ id, status, selskap_id: "S1", navn: id, forventet_mrr: 0, sla: 500, oppstartskostnad: 1000, kontraktslengde_mnd: 12,
     valgte_pakker: [], valgt_pakke: "", kontaktperson: "", e_post: "", telefon: "", sist_aktivitet: "", ...extra }) as Salgsmulighet;

describe("kontraktsuttrekk fra PDF", () => {
  it("beregner ARR som MRR × 12 i kode, ikke fra AI", () => {
    const u = normaliserUttrekk({ mrr: 7594, arr: 1, pakker: [] });
    expect(u.arr).toBe(91128);
  });

  it("holder SLA og oppstart utenfor MRR og ARR", () => {
    const u = normaliserUttrekk({ mrr: 3480, sla_per_mnd: 990, oppstartskostnad: 3800, pakker: [] });
    expect(u.mrr).toBe(3480);
    expect(u.arr).toBe(41760);
    expect(u.sla_per_mnd).toBe(990);
    expect(u.oppstartskostnad).toBe(3800);
  });

  it("bruker summen av pakker og markerer MRR som usikker når AI ikke ga MRR", () => {
    const u = normaliserUttrekk({ pakker: [{ navn: "Telefon Start", manedspris: 2490, minutter: "200 min" }, { navn: "Kun chat Start", manedspris: 990, minutter: "" }] });
    expect(u.mrr).toBe(3480);
    expect(u.usikre_felt).toContain("mrr");
  });

  it("forhåndsvelger den eneste åpne salgsmuligheten", () => {
    expect(standardSalgsmulighet([sm("A", "Tilbud sendt"), sm("B", "Tapt")])).toBe("A");
  });

  it("forhåndsvelger det eneste aktive kundeforholdet når ingen er åpne", () => {
    expect(standardSalgsmulighet([sm("A", "Vunnet"), sm("B", "Tapt")])).toBe("A");
  });

  it("lar brukeren velge når flere er åpne, og tilbyr ny når ingen finnes", () => {
    expect(standardSalgsmulighet([sm("A", "Tilbud sendt"), sm("B", "Møte booket")])).toBe("");
    expect(standardSalgsmulighet([])).toBe(NY_SALGSMULIGHET);
  });

  it("lagrer bekreftet MRR, pakker, binding og startdato på salgsmuligheten", () => {
    const u = normaliserUttrekk({
      mrr: 7594, sla_per_mnd: null, oppstartskostnad: 3800, bindingstid_mnd: 3, startdato: "2026-12-01",
      pakker: [{ navn: "Telefon Pro", manedspris: 7594, minutter: "1 000 min" }],
    });
    const ny = medKontraktsinfo(sm("A", "Tilbud sendt"), u, "2026-11-12");
    expect(ny.forventet_mrr).toBe(7594);
    expect(ny.valgt_pakke).toBe("Telefon Pro");
    expect(ny.oppstartskostnad).toBe(3800);
    expect(ny.sla).toBe(500); // ikke oppgitt i kontrakten → beholdes
    expect(ny.kontraktslengde_mnd).toBe(3);
    expect(ny.kontrakt_startdato).toBe("2026-12-01");
  });

  it("oppdaterer kundeforholdets ARR som MRR × 12 uten oppstart", () => {
    const u = normaliserUttrekk({ mrr: 3480, oppstartskostnad: 5000, orgnr: "938345686", pakker: [] });
    const s = { id: "S1", mrr: 0, arr: 0, oppstartskostnad: 0, orgnr: "", firmaadresse: "" } as Selskap;
    const neste = selskapMedKontraktsinfo(s, u, { oppdaterMrr: true, fyllInnMangler: true });
    expect(neste.mrr).toBe(3480);
    expect(neste.arr).toBe(41760);
    expect(neste.oppstartskostnad).toBe(5000);
    expect(neste.orgnr).toBe("938345686");
  });
});
