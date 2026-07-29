import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "complete_task",
  title: "Fullfør oppgave",
  description: "Marker en oppgave som ferdig.",
  inputSchema: { id: z.string().uuid().describe("Oppgave-ID.") },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    const guard = requireAuth(ctx);
    if (guard) return guard;
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("oppgaver")
      .update({ status: "Ferdig" })
      .eq("id", id)
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Oppgave ${id} markert som ferdig.` }],
      structuredContent: { oppgave: data },
    };
  },
});
