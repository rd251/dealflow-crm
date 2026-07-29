import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "my_tasks",
  title: "Mine oppgaver",
  description: "Hent åpne oppgaver for den innloggede brukeren (eller inkluder ferdige).",
  inputSchema: {
    include_completed: z.boolean().optional().describe("Ta med oppgaver med status 'Ferdig'. Default false."),
    limit: z.number().int().min(1).max(200).optional().describe("Maks antall oppgaver. Default 50."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ include_completed, limit }, ctx) => {
    const guard = requireAuth(ctx);
    if (guard) return guard;
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId();
    let q = sb
      .from("oppgaver")
      .select("id, oppgave, frist, prioritet, status, ansvarlig, lead_id, salgsmulighet_id, selskap_id")
      .eq("user_id", userId!)
      .order("frist", { ascending: true })
      .limit(limit ?? 50);
    if (!include_completed) q = q.neq("status", "Ferdig");
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify({ count: data?.length ?? 0, tasks: data ?? [] }, null, 2) }],
      structuredContent: { tasks: data ?? [] },
    };
  },
});
