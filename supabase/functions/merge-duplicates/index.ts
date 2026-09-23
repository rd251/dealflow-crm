import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const BodySchema = z.object({
  type: z.enum(["kontakt", "selskap"]),
  behold_id: z.string().uuid(),
  fjern_id: z.string().uuid(),
});

// Tabeller/kolonner som peker på en kontakt eller et selskap
const RELASJONER: Record<"kontakt" | "selskap", Array<[string, string]>> = {
  kontakt: [
    ["aktiviteter", "kontakt_id"],
    ["oppgaver", "kontakt_id"],
    ["salgsmuligheter", "kontakt_id"],
    ["email_contacts", "kontakt_id"],
    ["ringeliste", "kontakt_id"],
    ["venter_pa_svar", "kontakt_id"],
  ],
  selskap: [
    ["aktiviteter", "selskap_id"],
    ["oppgaver", "selskap_id"],
    ["salgsmuligheter", "selskap_id"],
    ["prosjekter", "selskap_id"],
    ["prosjekt_timer", "selskap_id"],
    ["kontakter", "selskap_id"],
    ["email_contacts", "selskap_id"],
    ["ringeliste", "selskap_id"],
    ["venter_pa_svar", "selskap_id"],
    ["partnere", "selskap_id"],
    ["selskap_dokumenter", "selskap_id"],
  ],
};

const TABELL = { kontakt: "kontakter", selskap: "selskaper" } as const;
const NAVNEFELT = { kontakt: "navn", selskap: "firmanavn" } as const;
const IKKE_FLETT = new Set(["id", "created_at", "updated_at", "notater"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Mangler token" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const bruker = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: auth } = await bruker.auth.getUser();
  if (!auth?.user) return json({ error: "Ikke pålogget" }, 401);

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
  const { type, behold_id, fjern_id } = parsed.data;
  if (behold_id === fjern_id) return json({ error: "Samme post" }, 400);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const tabell = TABELL[type];
  const navnefelt = NAVNEFELT[type];

  const { data: rader, error: hentFeil } = await admin
    .from(tabell).select("*").in("id", [behold_id, fjern_id]);
  if (hentFeil) return json({ error: hentFeil.message }, 500);
  const behold = rader?.find((r: any) => r.id === behold_id);
  const fjern = rader?.find((r: any) => r.id === fjern_id);
  if (!behold || !fjern) return json({ error: "Fant ikke begge postene" }, 404);

  // 1. Flytt alt som peker på posten som fjernes
  for (const [rel, kol] of RELASJONER[type]) {
    const { error } = await admin.from(rel).update({ [kol]: behold_id }).eq(kol, fjern_id);
    if (error) console.error(`flytt ${rel}.${kol}:`, error.message);
  }
  if (type === "selskap") {
    await admin.from("salgsmuligheter").update({ selskap_id: behold_id }).eq("selskap_id", fjern_id);
  }

  // 2. Fyll tomme felt og slå sammen notater
  const oppdatering: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fjern as Record<string, unknown>)) {
    if (IKKE_FLETT.has(k)) continue;
    const eksisterende = (behold as Record<string, unknown>)[k];
    const tom = eksisterende === null || eksisterende === undefined || eksisterende === "";
    const harVerdi = v !== null && v !== undefined && v !== "";
    if (tom && harVerdi) oppdatering[k] = v;
  }
  const notatA = (behold as any).notater?.trim?.() ?? "";
  const notatB = (fjern as any).notater?.trim?.() ?? "";
  if (notatB && notatB !== notatA) {
    oppdatering.notater = notatA ? `${notatA}\n\n— Slått sammen —\n${notatB}` : notatB;
  }
  if (Object.keys(oppdatering).length) {
    const { error } = await admin.from(tabell).update(oppdatering).eq("id", behold_id);
    if (error) console.error("fyll felt:", error.message);
  }

  // 3. Arkiver og slett taperen
  await admin.from("deleted_items").insert({
    table_name: tabell,
    record_id: fjern_id,
    record_data: fjern,
    deleted_by: auth.user.id,
  });
  const { error: slettFeil } = await admin.from(tabell).delete().eq("id", fjern_id);
  if (slettFeil) return json({ error: slettFeil.message }, 500);

  // 4. Endringslogg
  await admin.from("crm_changelog").insert({
    event_type: "merged",
    entity_type: type,
    entity_id: behold_id,
    entity_name: (behold as any)[navnefelt] ?? "",
    field_name: "dublett",
    old_value: (fjern as any)[navnefelt] ?? "",
    new_value: (behold as any)[navnefelt] ?? "",
    user_id: auth.user.id,
  });

  return json({ ok: true, behold_id, fjern_id });
});
