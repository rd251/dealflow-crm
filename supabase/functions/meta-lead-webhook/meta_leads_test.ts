import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildNotes,
  extractLeadgenEvents,
  handleChallenge,
  isAllowedPage,
  isRetryableStatus,
  mapLeadFields,
  parsePageAllowlist,
  retryDelaySeconds,
  verifyMetaSignature,
  callerFromRoleRow,
} from "../_shared/meta-leads.ts";

const SECRET = "test-app-secret";

async function sign(body: string, secret = SECRET): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return "sha256=" + Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.test("GET challenge returns hub.challenge on correct verify token", () => {
  const url = new URL("https://x/meta-lead-webhook?hub.mode=subscribe&hub.verify_token=tok&hub.challenge=12345");
  assertEquals(handleChallenge(url, "tok"), { status: 200, body: "12345" });
});

Deno.test("GET challenge rejects wrong verify token and missing config", () => {
  const url = new URL("https://x/?hub.mode=subscribe&hub.verify_token=bad&hub.challenge=1");
  assertEquals(handleChallenge(url, "tok").status, 403);
  assertEquals(handleChallenge(url, null).status, 503);
  assertEquals(handleChallenge(new URL("https://x/?hub.mode=unsubscribe"), "tok").status, 400);
});

Deno.test("signature verification accepts a valid signature over the raw body", async () => {
  const body = JSON.stringify({ object: "page", entry: [] });
  assert(await verifyMetaSignature(body, await sign(body), SECRET));
});

Deno.test("signature verification rejects tampered body, wrong secret, missing header", async () => {
  const body = JSON.stringify({ object: "page", entry: [] });
  const header = await sign(body);
  assertFalse(await verifyMetaSignature(body + " ", header, SECRET));
  assertFalse(await verifyMetaSignature(body, await sign(body, "other"), SECRET));
  assertFalse(await verifyMetaSignature(body, null, SECRET));
  assertFalse(await verifyMetaSignature(body, "sha256=zz", SECRET));
  assertFalse(await verifyMetaSignature(body, header, undefined));
});

Deno.test("batch payload: every leadgen change in every entry is extracted", () => {
  const payload = {
    object: "page",
    entry: [
      {
        id: "493287300545561",
        changes: [
          { field: "leadgen", value: { leadgen_id: "1", page_id: "493287300545561", form_id: "f1", created_time: 1700000000 } },
          { field: "leadgen", value: { leadgen_id: "2", page_id: "493287300545561", ad_id: "a2" } },
          { field: "feed", value: { leadgen_id: "ignored", page_id: "493287300545561" } },
        ],
      },
      { id: "999", changes: [{ field: "leadgen", value: { leadgen_id: "3", page_id: "999" } }] },
    ],
  };
  const events = extractLeadgenEvents(payload);
  assertEquals(events.map((e) => e.leadgenId), ["1", "2", "3"]);
  assertEquals(events[0].createdTime, new Date(1700000000 * 1000).toISOString());
  assertEquals(extractLeadgenEvents({ object: "instagram", entry: [] }).length, 0);
  assertEquals(extractLeadgenEvents(null).length, 0);
});

Deno.test("page allowlist only accepts configured pages", () => {
  const list = parsePageAllowlist("493287300545561, 123");
  assertEquals(list, ["493287300545561", "123"]);
  assert(isAllowedPage("493287300545561", list));
  assertFalse(isAllowedPage("999", list));
  assertFalse(isAllowedPage("493287300545561", parsePageAllowlist("")));
});

Deno.test("field mapping handles Norwegian and English aliases and keeps all answers", () => {
  const mapped = mapLeadFields([
    { name: "first_name", values: ["Ola"] },
    { name: "last_name", values: ["Nordmann"] },
    { name: "email", values: ["ola@acme.no"] },
    { name: "telefonnummer", values: ["+4791234567"] },
    { name: "bedriftsnavn", values: ["Acme AS"] },
    { name: "stilling", values: ["Daglig leder"] },
    { name: "produktinteresse", values: ["AI-telefonagent"] },
    { name: "hvor_mange_samtaler_per_uke", values: ["over 100"] },
    { name: "tomt_felt", values: [] },
  ]);
  assertEquals(mapped.kontaktperson, "Ola Nordmann");
  assertEquals(mapped.e_post, "ola@acme.no");
  assertEquals(mapped.telefon, "+4791234567");
  assertEquals(mapped.firmanavn, "Acme AS");
  assertEquals(mapped.rolle_i_firma, "Daglig leder");
  assertEquals(mapped.use_case, "AI-telefonagent");
  assertEquals(mapped.qa.length, 8);
  assert(mapped.qa.some((q) => q.question === "hvor_mange_samtaler_per_uke" && q.answer === "over 100"));
});

Deno.test("field mapping invents nothing when fields are absent", () => {
  const mapped = mapLeadFields([{ name: "full_name", values: ["Kari"] }]);
  assertEquals(mapped.firmanavn, "");
  assertEquals(mapped.e_post, "");
  assertEquals(mapped.kontaktperson, "Kari");
  assertEquals(mapLeadFields(undefined).qa.length, 0);
});

Deno.test("notes keep qualification answers and Meta metadata", () => {
  const notes = buildNotes(mapLeadFields([{ name: "behov", values: ["Kundeservice"] }]), {
    formName: "Snakk demo", formId: "f1", adName: "Video A", adId: "a1",
    campaignName: "Q3", campaignId: "c1", leadgenId: "L1", createdTime: "2026-09-18T08:00:00.000Z",
  });
  assert(notes.includes("behov: Kundeservice"));
  assert(notes.includes("Skjema: Snakk demo (f1)"));
  assert(notes.includes("Annonse: Video A (a1)"));
  assert(notes.includes("Kampanje: Q3 (c1)"));
  assert(notes.includes("Meta lead-ID: L1"));
  assert(notes.includes("2026-09-18T08:00:00.000Z"));
});

Deno.test("retry policy: 429/5xx retried with capped backoff, 4xx permanent", () => {
  assert(isRetryableStatus(429));
  assert(isRetryableStatus(500));
  assert(isRetryableStatus(503));
  assertFalse(isRetryableStatus(400));
  assertFalse(isRetryableStatus(403));
  assertEquals(retryDelaySeconds(1), 60);
  assertEquals(retryDelaySeconds(2), 120);
  assertEquals(retryDelaySeconds(10), 3600);
});

Deno.test("kun admin-rolle slipper gjennom worker-autorisering", () => {
  assertEquals(callerFromRoleRow({ role: "admin" }), "admin");
  assertEquals(callerFromRoleRow({ role: "user" }), null);
  assertEquals(callerFromRoleRow({ role: "viewer" }), null);
  assertEquals(callerFromRoleRow(null), null);
  assertEquals(callerFromRoleRow(undefined), null);
});
