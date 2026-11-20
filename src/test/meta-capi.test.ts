import { describe, expect, it } from "vitest";
import * as app from "@/lib/meta-capi";
import * as server from "../../supabase/functions/_shared/meta-capi";

describe("CRM → Meta: stegmapping", () => {
  it("appen og serveren har identisk mapping", () => {
    expect(app.STEG).toEqual(server.STEG);
    expect(app.SLUTTKONVERTERING).toBe(server.SLUTTKONVERTERING);
  });

  it("lead-stegene er distinkte, og konvertert til salg er salgsmulighet – ikke vunnet", () => {
    const keys = ["Ny", "Kontaktet", "Svarte ikke telefon", "Kvalifisert", "Ikke aktuelt", "Konvertert til salg", "Konvertert til partner"]
      .map((s) => app.metaCapiSteg("lead", s)?.key);
    expect(new Set(keys).size).toBe(7);
    expect(app.metaCapiSteg("lead", "Konvertert til salg")?.key).toBe("lead_til_salgsmulighet");
    expect(app.metaCapiSteg("lead", "Konvertert til salg")?.key).not.toBe(app.SLUTTKONVERTERING);
  });

  it("partnerkonvertering regnes aldri som salg", () => {
    const partner = app.metaCapiSteg("lead", "Konvertert til partner");
    expect(partner?.key).toBe("lead_til_partner");
    expect(partner?.navn).not.toMatch(/salg|vunnet/i);
  });

  it("eldre «Behov avklart» og «Løsning presentert» teller som Demo gjennomført", () => {
    expect(app.metaCapiSteg("salgsmulighet", "Behov avklart")?.key).toBe("salg_demo_gjennomfort");
    expect(app.metaCapiSteg("salgsmulighet", "Løsning presentert")?.key).toBe("salg_demo_gjennomfort");
    expect(app.metaCapiSteg("salgsmulighet", "Demo gjennomført")?.key).toBe("salg_demo_gjennomfort");
  });

  it("bare Vunnet er sluttkonvertering", () => {
    const alle = [...Object.values(app.STEG.lead), ...Object.values(app.STEG.salgsmulighet)];
    expect(alle.filter((s) => s.key === app.SLUTTKONVERTERING).map((s) => s.navn)).toEqual(["Salgsmulighet: Vunnet"]);
    expect(app.metaCapiSteg("salgsmulighet", "Tapt")?.key).toBe("salg_tapt");
  });

  it("ukjent eller tom status gir ingen hendelse (ingen standardkolonne)", () => {
    expect(app.metaCapiSteg("salgsmulighet", null)).toBeNull();
    expect(app.metaCapiSteg("salgsmulighet", "")).toBeNull();
    expect(app.metaCapiSteg("lead", "Ikke fått tak i ennå")).toBeNull();
  });
});

describe("CRM → Meta: hendelse og tid", () => {
  it("sender bare lead-ID som streng, uten verdi eller kontaktdata", () => {
    const h = app.byggCapiHendelse({ event_id: "snakk-crm:12345678901234567:salg_vunnet", event_name: "Salgsmulighet: Vunnet", event_time: "2026-11-20T10:00:00Z", leadgen_id: "12345678901234567" });
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
