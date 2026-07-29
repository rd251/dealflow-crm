import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_salgsmulighet",
  title: "Hent salgsmulighet",
  description: "Full info om en salgsmulighet inkludert de 10 siste aktivitetene.",
  inputSchema: { id: z.string().uuid().describe("ID på salgsmuligheten.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    const guard = requireAuth(ctx);
    if (guard) return guard;
    const sb = supabaseForUser(ctx);
    const { data: sm, error } = await sb.from("salgsmuligheter").select("*").eq("id", id).maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!sm) return { content: [{ type: "text", text: "Ikke funnet" }], isError: true };
    const { data: acts } = await sb
      .from("aktiviteter")
      .select("id, type, dato, tittel, beskrivelse, aktivitet_kilde")
      .eq("salgsmulighet_id", id)
      .order("dato", { ascending: false })
      .limit(10);
    const payload = { ...sm, siste_aktiviteter: acts || [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
