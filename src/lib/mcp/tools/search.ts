import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "search",
  title: "Søk i CRM",
  description:
    "Søk på tvers av leads, salgsmuligheter, selskaper og kontakter. Returnerer maks 10 treff per entitetstype.",
  inputSchema: {
    query: z.string().min(2).describe("Søketekst (min. 2 tegn) – firmanavn, kontaktperson eller e-post."),
    type: z
      .enum(["lead", "salgsmulighet", "selskap", "kontakt"])
      .optional()
      .describe("Begrens til én entitetstype. Utelat for å søke alt."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, type }, ctx) => {
    const guard = requireAuth(ctx);
    if (guard) return guard;
    const sb = supabaseForUser(ctx);
    const q = `%${query}%`;
    const wanted = (t: string) => !type || type === t;
    const results: any[] = [];

    if (wanted("lead")) {
      const { data } = await sb
        .from("leads")
        .select("id, firmanavn, kontaktperson, status, ansvarlig, e_post, sist_aktivitet")
        .or(`firmanavn.ilike.${q},kontaktperson.ilike.${q},e_post.ilike.${q}`)
        .limit(10);
      for (const r of data || []) results.push({ type: "lead", ...r });
    }
    if (wanted("salgsmulighet")) {
      const { data } = await sb
        .from("salgsmuligheter")
        .select("id, navn, status, forventet_mrr, ansvarlig, kontaktperson, e_post, sist_aktivitet")
        .or(`navn.ilike.${q},kontaktperson.ilike.${q},e_post.ilike.${q}`)
        .limit(10);
      for (const r of data || []) results.push({ type: "salgsmulighet", ...r });
    }
    if (wanted("selskap")) {
      const { data } = await sb
        .from("selskaper")
        .select("id, firmanavn, kundestatus, mrr, kundeansvarlig, sist_aktivitet")
        .or(`firmanavn.ilike.${q},domene.ilike.${q}`)
        .limit(10);
      for (const r of data || []) results.push({ type: "selskap", ...r });
    }
    if (wanted("kontakt")) {
      const { data } = await sb
        .from("kontakter")
        .select("id, navn, rolle, e_post, telefon, selskap_id")
        .or(`navn.ilike.${q},e_post.ilike.${q}`)
        .limit(10);
      for (const r of data || []) results.push({ type: "kontakt", ...r });
    }

    return {
      content: [{ type: "text", text: JSON.stringify({ count: results.length, results }, null, 2) }],
      structuredContent: { results },
    };
  },
});
