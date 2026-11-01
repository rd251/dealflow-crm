import { describe, it, expect } from "vitest";
import { vurderMoete, salgsmulighetNavn, salgsmulighetAnsvarlig } from "@/lib/moete-kobling";

const lead = { id: "L1", e_post: "anna@autovest.no", status: "Ny" };

describe("booket møte → salgsmulighet", () => {
  it("lead med matchende e-post blir konvertert", () => {
    expect(vurderMoete({ type: "Møte", eksterne_deltakere: ["Anna@autovest.no", "rd@snakk.ai"] }, [lead], []))
      .toEqual({ type: "konverter", lead_id: "L1" });
  });
  it("lead som matcher på domene blir konvertert", () => {
    expect(vurderMoete({ type: "Møte", eksterne_deltakere: ["per@autovest.no"] }, [lead], []))
      .toEqual({ type: "konverter", lead_id: "L1" });
  });
  it("internt møte (kun @snakk.ai) gir ingenting", () => {
    expect(vurderMoete({ type: "Møte", eksterne_deltakere: ["rd@snakk.ai", "joakim@snakk.ai"] }, [lead], []).type).toBe("ingen");
  });
  it("lead med åpen salgsmulighet gir kun kobling", () => {
    expect(vurderMoete({ type: "Møte", eksterne_deltakere: ["anna@autovest.no"] }, [lead], [{ id: "S1", status: "Behov avklart", e_post: "anna@autovest.no" }]))
      .toEqual({ type: "koble", salgsmulighet_id: "S1" });
  });
  it("ny synk etter konvertering lager ingen duplikat", () => {
    const konvertert = { ...lead, status: "Konvertert til salg", konvertert_dato: "2026-11-01" };
    expect(vurderMoete({ type: "Møte", eksterne_deltakere: ["anna@autovest.no"], salgsmulighet_id: "S2" }, [konvertert], []).type).toBe("ingen");
    expect(vurderMoete({ type: "Møte", eksterne_deltakere: ["anna@autovest.no"] }, [konvertert], [{ id: "S2", status: "Møte booket", e_post: "anna@autovest.no" }]))
      .toEqual({ type: "koble", salgsmulighet_id: "S2" });
  });
  it("«Ikke aktuelt»-lead konverteres ikke", () => {
    expect(vurderMoete({ type: "Møte", lead_id: "L1" }, [{ ...lead, status: "Ikke aktuelt" }], []).type).toBe("ingen");
  });
  it("ekstern deltaker uten treff blir forslag", () => {
    expect(vurderMoete({ type: "Møte", eksterne_deltakere: ["ukjent@firma.no"] }, [lead], [])).toEqual({ type: "forslag" });
  });
  it("ekstern deltaker som er kjent kontakt blir ikke forslag", () => {
    expect(vurderMoete({ type: "Møte", eksterne_deltakere: ["kari@kunde.no"] }, [lead], [], new Set(["kari@kunde.no"])).type).toBe("ingen");
  });
  it("møte med kunde-domene gir ingen ny salgsmulighet", () => {
    const l = { id: "L2", e_post: "remi.mikalsen@consto.no", status: "Ny" };
    expect(vurderMoete({ type: "Møte", eksterne_deltakere: ["remi.mikalsen@consto.no"] }, [l], [], new Set(),
      [{ type: "kunde", id: "C1", navn: "Consto AS", domene: "consto.no" }]))
      .toEqual({ type: "koble_eksisterende", selskap_id: "C1", partner_id: null });
  });
  it("møte med partner-domene gir ingen ny salgsmulighet", () => {
    const l = { id: "L3", e_post: "ola@partner.no", status: "Ny" };
    expect(vurderMoete({ type: "Møte", eksterne_deltakere: ["ola@partner.no"] }, [l], [], new Set(),
      [{ type: "partner", id: "P1", navn: "Partner AS", domene: "partner.no", selskap_id: "S9" }]))
      .toEqual({ type: "koble_eksisterende", selskap_id: "S9", partner_id: "P1" });
  });
  it("lead uten firmanavn får fornuftig navn og ansvarlig", () => {
    const l = { id: "L4", e_post: "kari@bedrift.no", status: "Ny", firmanavn: "", kontaktperson: "Kari Nordmann", eier_id: "U2" };
    expect(salgsmulighetNavn(l)).toBe("Kari Nordmann");
    expect(salgsmulighetNavn({ ...l, kontaktperson: null })).toBe("bedrift.no");
    expect(salgsmulighetAnsvarlig("U1", l)).toBe("U1");
    expect(salgsmulighetAnsvarlig(null, l)).toBe("U2");
  });
});
