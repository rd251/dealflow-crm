import { describe, expect, it } from "vitest";
import * as app from "@/lib/meta-capi";
import * as server from "../../supabase/functions/_shared/meta-capi";

describe("CRM → Meta: stegmapping", () => {
  it("appen og serveren har identisk mapping", () => {
    expect(app.STEG).toEqual(server.STEG);
    expect(app.SLUTTKONVERTERING).toBe(server.SLUTTKONVERTERING);
    expect(app.SIGNALER).toEqual(server.SIGNALER);
    expect(app.LEASE_SEKUNDER).toBe(server.LEASE_SEKUNDER);
  });

  it("eksakte Meta-signaler: Ny → LEADS, bare Kvalifisert → QUALIFIED, bare Vunnet → CONVERTED", () => {
    expect(app.metaCapiSteg("lead", "Ny")?.navn).toBe("LEADS");
    expect(app.metaCapiSteg("lead", "Kvalifisert")?.navn).toBe("QUALIFIED");
    expect(app.metaCapiSteg("salgsmulighet", "Vunnet")?.navn).toBe("CONVERTED");
    const alle = [...Object.entries(app.STEG.lead), ...Object.entries(app.STEG.salgsmulighet)];
    expect(alle.filter(([, s]) => s.navn === "LEADS").map(([st]) => st)).toEqual(["Ny"]);
    expect(alle.filter(([, s]) => s.navn === "QUALIFIED").map(([st]) => st)).toEqual(["Kvalifisert"]);
    expect(alle.filter(([, s]) => s.navn === "CONVERTED").map(([st]) => st)).toEqual(["Vunnet"]);
  });

  it("konvertert til salg er ikke kvalifisering og ikke vunnet, men eget steg", () => {
    const s = app.metaCapiSteg("lead", "Konvertert til salg");
    expect(s?.navn).toBe("Lead: Konvertert til salgsmulighet");
    expect(s?.key).not.toBe(app.SLUTTKONVERTERING);
  });

  it("negative steg og partner beholder egne navn og blir aldri positive signaler", () => {
    for (const [type, st] of [["lead", "Ikke aktuelt"], ["lead", "Svarte ikke telefon"], ["lead", "Konvertert til partner"], ["salgsmulighet", "Tapt"]] as const) {
      expect(["LEADS", "QUALIFIED", "CONVERTED"]).not.toContain(app.metaCapiSteg(type, st)?.navn);
      expect(app.metaCapiSteg(type, st)).not.toBeNull();
    }
    expect(app.metaCapiSteg("lead", "Konvertert til partner")?.navn).not.toMatch(/salg|vunnet/i);
  });

  it("lead-stegene er distinkte", () => {
    const keys = ["Ny", "Kontaktet", "Svarte ikke telefon", "Kvalifisert", "Ikke aktuelt", "Konvertert til salg", "Konvertert til partner"]
      .map((s) => app.metaCapiSteg("lead", s)?.key);
    expect(new Set(keys).size).toBe(7);
  });

  it("eldre «Behov avklart» og «Løsning presentert» teller som Demo gjennomført", () => {
    expect(app.metaCapiSteg("salgsmulighet", "Behov avklart")?.key).toBe("salg_demo_gjennomfort");
    expect(app.metaCapiSteg("salgsmulighet", "Løsning presentert")?.key).toBe("salg_demo_gjennomfort");
  });

  it("ukjent eller tom status gir ingen hendelse (ingen standardkolonne)", () => {
    expect(app.metaCapiSteg("salgsmulighet", null)).toBeNull();
    expect(app.metaCapiSteg("salgsmulighet", "")).toBeNull();
    expect(app.metaCapiSteg("lead", "Ikke fått tak i ennå")).toBeNull();
  });
});

describe("CRM → Meta: hendelse og tid", () => {
  it("sender bare lead-ID som streng, uten verdi eller kontaktdata", () => {
    const h = app.byggCapiHendelse({ event_id: "snakk-crm:12345678901234567:salg_vunnet", event_name: "CONVERTED", event_time: "2026-11-20T10:00:00Z", leadgen_id: "12345678901234567" });
    expect(h.user_data).toEqual({ lead_id: "12345678901234567" });
    expect(h.custom_data).toEqual({ event_source: "crm", lead_event_source: "Snakk CRM" });
    expect(h.action_source).toBe("system_generated");
    expect(JSON.stringify(h)).not.toMatch(/value|currency|email|phone|em"|ph"/);
  });

  it("samme steg gir samme hendelses-ID ved ny sending", () => {
    expect(app.eventId("900000000000001", "salg_vunnet")).toBe("snakk-crm:900000000000001:salg_vunnet");
    expect(app.eventId("900000000000001", "salg_vunnet")).toBe(app.eventId("900000000000001", "salg_vunnet"));
  });

  it("gamle, fremtidige og for tidlige hendelser sendes ikke", () => {
    const naa = new Date("2026-11-20T12:00:00Z");
    expect(app.vurderTid("2026-11-13T11:00:00Z", null, naa)).toEqual({ ok: false, grunn: "for_gammel" });
    expect(app.vurderTid("2026-11-20T12:30:00Z", null, naa)).toEqual({ ok: false, grunn: "fremtid" });
    expect(app.vurderTid("2026-11-20T09:00:00Z", "2026-11-20T10:00:00Z", naa)).toEqual({ ok: false, grunn: "for_lead" });
    expect(app.vurderTid("2026-11-14T13:00:00Z", "2026-11-01T10:00:00Z", naa)).toEqual({ ok: true });
  });

  it("manglende hemmeligheter lar køen vente", () => {
    const k = app.lesKonfig({ get: () => undefined });
    expect(app.driftsstatus(k, { produksjon_aktiv: true })).toBe("mangler_konfigurasjon");
    expect(app.kanAktiveres(k, { test_ok_at: "2026-11-20T10:00:00Z" })).toBe(false);
  });
});

describe("CRM → Meta: lease og side", () => {
  it("én kø-post per claim får lease med god margin over verste sendetid", () => {
    expect(app.LEASE_SEKUNDER * 1000).toBeGreaterThan(app.MAKS_RAD_MS * 3);
  });

  it("kjøringen slutter å hente nye poster før budsjettet er brukt opp", () => {
    const start = 0;
    expect(app.harTidTilNesteRad(start, 0)).toBe(true);
    expect(app.harTidTilNesteRad(start, (app.KJORING_BUDSJETT_SEKUNDER * 1000) - app.MAKS_RAD_MS)).toBe(false);
    expect(app.harTidTilNesteRad(start, 25 * 15_250)).toBe(false);
  });

  it("bare godkjente Meta-sider teller", () => {
    expect(app.sideGodkjent("493287300545561", ["493287300545561"])).toBe(true);
    expect(app.sideGodkjent("111", ["493287300545561"])).toBe(false);
    expect(app.sideGodkjent("493287300545561", [])).toBe(false);
    expect(app.sideGodkjent("", [""])).toBe(false);
  });
});
