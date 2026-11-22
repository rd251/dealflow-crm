import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { AUTO_EPOST_STOPPET, autoEpostAvslattSvar } from "../_shared/auto-epost-stopp.ts";
import { behandleHendelse, sendForfalteOppgaver } from "../_shared/crm-varsel/hendelser.ts";

// En klient som feiler hvis noe prøver å lese data eller sende e-post.
const forbudtKlient = new Proxy({}, {
  get() { throw new Error("Klienten skal ikke brukes når auto-e-post er slått av"); },
  // deno-lint-ignore no-explicit-any
}) as any;

Deno.test("automatiske e-poster er slått av", () => {
  assertEquals(AUTO_EPOST_STOPPET, true);
});

for (const hendelse of ["nytt_lead", "oppgave_tildelt", "deal_vunnet", "kontrakt_signert", "lead_konvertert", "kunde_live", "prosjekt_tildelt"] as const) {
  Deno.test(`interne varsler sender ingenting: ${hendelse}`, async () => {
    const r = await behandleHendelse(forbudtKlient, { hendelse, lead_id: "00000000-0000-0000-0000-000000000001" });
    assertEquals(r, []);
  });
}

Deno.test("daglig varsel om forfalte oppgaver sender ingenting", async () => {
  assertEquals(await sendForfalteOppgaver(forbudtKlient), []);
});

Deno.test("avslått funksjon svarer trygt med 200 og sendt: 0", async () => {
  const svar = autoEpostAvslattSvar("crm-varsel");
  assertEquals(svar.status, 200);
  const body = await svar.json();
  assertEquals(body.deaktivert, true);
  assertEquals(body.sendt, 0);
});
