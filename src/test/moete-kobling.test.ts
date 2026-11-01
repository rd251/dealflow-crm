import { describe, it, expect } from "vitest";
import { vurderMoete } from "@/lib/moete-kobling";

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
});
