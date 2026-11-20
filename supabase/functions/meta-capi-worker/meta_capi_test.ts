import { assert, assertEquals, assertFalse, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  byggCapiHendelse, driftsstatus, eventId, kanAktiveres, klassifiserSvar, lesKonfig, metaCapiSteg,
  metaFeiltekst, milestoneKey, redigerFeil, vurderTid, SLUTTKONVERTERING, STEG,
} from "../_shared/meta-capi.ts";

const env = (o: Record<string, string>) => ({ get: (k: string) => o[k] });

Deno.test("payload følger Conversion Leads-spesifikasjonen med lead-ID som streng", () => {
  const h = byggCapiHendelse({ event_id: eventId("12345678901234567", "lead_ny"), event_name: "Lead: Ny", event_time: "2026-11-20T10:00:00Z", leadgen_id: "12345678901234567" });
  assertEquals(h.action_source, "system_generated");
  assertEquals(h.custom_data, { event_source: "crm", lead_event_source: "Snakk CRM" });
  assertEquals(h.user_data, { lead_id: "12345678901234567" });
  assertEquals(typeof h.user_data.lead_id, "string");
  assertEquals(h.event_time, Date.parse("2026-11-20T10:00:00Z") / 1000);
  assertEquals(Number.isInteger(h.event_time), true);
  assertEquals(h.event_id, "snakk-crm:12345678901234567:lead_ny");
  assertEquals(Object.keys(h).sort(), ["action_source", "custom_data", "event_id", "event_name", "event_time", "user_data"]);
  assert(JSON.stringify(h).includes('"lead_id":"12345678901234567"'));
});

Deno.test("ugyldig lead-ID sendes aldri", () => {
  assertThrows(() => byggCapiHendelse({ event_id: "x", event_name: "x", event_time: "2026-11-20T10:00:00Z", leadgen_id: "abc" }));
});

Deno.test("bare Vunnet er sluttkonvertering, konvertert til salg er ikke vunnet", () => {
  assertEquals(SLUTTKONVERTERING, "salg_vunnet");
  assertEquals(metaCapiSteg("lead", "Konvertert til salg")?.key, "lead_til_salgsmulighet");
  assertEquals(metaCapiSteg("lead", "Konvertert til partner")?.key, "lead_til_partner");
  const vunnet = Object.values(STEG.lead).concat(Object.values(STEG.salgsmulighet)).filter((s) => s.key === SLUTTKONVERTERING);
  assertEquals(vunnet.length, 1);
});

Deno.test("milepælnøkkel er deterministisk", () => {
  assertEquals(milestoneKey("900000000000001", "salg_vunnet"), "900000000000001:salg_vunnet");
  assertEquals(eventId("900000000000001", "salg_vunnet"), eventId("900000000000001", "salg_vunnet"));
});

Deno.test("tidsregler: 7 dager, fremtid og før lead-generering", () => {
  const naa = new Date("2026-11-20T12:00:00Z");
  assertEquals(vurderTid("2026-11-20T11:00:00Z", "2026-11-20T10:00:00Z", naa), { ok: true });
  assertEquals(vurderTid("2026-11-12T11:00:00Z", null, naa), { ok: false, grunn: "for_gammel" });
  assertEquals(vurderTid("2026-11-20T13:00:00Z", null, naa), { ok: false, grunn: "fremtid" });
  assertEquals(vurderTid("2026-11-20T09:00:00Z", "2026-11-20T10:00:00Z", naa), { ok: false, grunn: "for_lead" });
});

Deno.test("svar: krever events_received, auth venter, rate/midlertidig prøves igjen", () => {
  assertEquals(klassifiserSvar(200, { events_received: 1, fbtrace_id: "x" }), "sendt");
  assertEquals(klassifiserSvar(200, { events_received: 0 }), "permanent");
  assertEquals(klassifiserSvar(200, {}), "permanent");
  assertEquals(klassifiserSvar(400, { error: { code: 190, message: "Error validating access token" } }), "auth");
  assertEquals(klassifiserSvar(401, null), "auth");
  assertEquals(klassifiserSvar(400, { error: { code: 17 } }), "rate");
  assertEquals(klassifiserSvar(429, null), "rate");
  assertEquals(klassifiserSvar(503, null), "midlertidig");
  assertEquals(klassifiserSvar(408, null), "midlertidig");
  assertEquals(klassifiserSvar(400, { error: { code: 100, message: "Invalid parameter" } }), "permanent");
});

Deno.test("feiltekster redigeres for token og kontaktdata", () => {
  const t = redigerFeil("access_token=EAABsbCS1iHgBAKZCZB123456 Bearer abcdefghijkl ola@firma.no +47 912 34 567 lead 1234567890123456");
  assertFalse(t.includes("EAAB"));
  assertFalse(t.includes("abcdefghijkl"));
  assertFalse(t.includes("ola@firma.no"));
  assertFalse(t.includes("912 34 567"));
  assert(t.includes("1234567890123456"));
  assertEquals(metaFeiltekst(400, { error: { code: 100, message: "bad", fbtrace_id: "x" } }), "HTTP 400 · kode 100 · bad");
});

Deno.test("manglende hemmeligheter gir venting, aktivering krever godkjent test", () => {
  const tom = lesKonfig(env({}));
  assertEquals(driftsstatus(tom, { produksjon_aktiv: true }), "mangler_konfigurasjon");
  const full = lesKonfig(env({ META_CAPI_ACCESS_TOKEN: "x", META_CAPI_DATASET_ID: "123456789", META_PAGE_IDS: "111" }));
  assertEquals(driftsstatus(full, null), "deaktivert");
  assertEquals(driftsstatus(full, { produksjon_aktiv: true, pauset: true }), "pauset");
  assertEquals(driftsstatus(full, { produksjon_aktiv: true }), "aktiv");
  assertFalse(kanAktiveres(full, {}));
  assert(kanAktiveres(full, { test_ok_at: "2026-11-20T10:00:00Z" }));
  assertEquals(lesKonfig(env({ META_CAPI_DATASET_ID: "ikke-tall" })).datasett, false);
});
