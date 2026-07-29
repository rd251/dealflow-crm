import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_activity",
  title: "Logg aktivitet",
  description: "Logg en aktivitet/notat på en lead, salgsmulighet, selskap eller kontakt.",
  inputSchema: {
    type: z.enum(["Notat", "Møte", "Samtale", "E-post", "Annet"]).describe("Aktivitetstype."),
    beskrivelse: z.string().min(1).describe("Beskrivelse / notat."),
    tittel: z.string().optional(),
    dato: z.string().optional().describe("ISO-timestamp. Default nå."),
    lead_id: z.string().uuid().optional(),
    salgsmulighet_id: z.string().uuid().optional(),
    selskap_id: z.string().uuid().optional(),
    kontakt_id: z.string().uuid().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const guard = requireAuth(ctx);
    if (guard) return guard;
    const sb = supabaseForUser(ctx);
    const row = {
      type: input.type,
      tittel: input.tittel || "",
      beskrivelse: input.beskrivelse,
      dato: input.dato || new Date().toISOString(),
      lead_id: input.lead_id || null,
      salgsmulighet_id: input.salgsmulighet_id || null,
      selskap_id: input.selskap_id || null,
      kontakt_id: input.kontakt_id || null,
      user_id: ctx.getUserId(),
      aktivitet_kilde: "mcp",
    };
    const { data, error } = await sb.from("aktiviteter").insert(row).select().single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Aktivitet loggført: ${data.id}` }],
      structuredContent: { aktivitet: data },
    };
  },
});
