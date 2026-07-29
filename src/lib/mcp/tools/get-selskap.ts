import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_selskap",
  title: "Hent selskap",
  description: "Selskap med tilhørende kontakter og salgsmuligheter.",
  inputSchema: { id: z.string().uuid().describe("Selskaps-ID.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    const guard = requireAuth(ctx);
    if (guard) return guard;
    const sb = supabaseForUser(ctx);
    const { data: s, error } = await sb.from("selskaper").select("*").eq("id", id).maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!s) return { content: [{ type: "text", text: "Ikke funnet" }], isError: true };
    const { data: kontakter } = await sb
      .from("kontakter")
      .select("id, navn, rolle, e_post, telefon")
      .eq("selskap_id", id);
    const { data: sm } = await sb
      .from("salgsmuligheter")
      .select("id, navn, status, forventet_mrr")
      .eq("selskap_id", id);
    const payload = { ...s, kontakter: kontakter || [], salgsmuligheter: sm || [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
