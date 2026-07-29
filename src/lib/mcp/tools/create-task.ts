import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_task",
  title: "Opprett oppgave",
  description: "Opprett en ny oppgave for den innloggede brukeren.",
  inputSchema: {
    oppgave: z.string().min(1).describe("Oppgavetittel."),
    frist: z.string().optional().describe("Frist (ISO-dato eller ISO-timestamp)."),
    prioritet: z.enum(["Lav", "Medium", "Høy"]).optional().describe("Prioritet, default 'Medium'."),
    notater: z.string().optional().describe("Fritekst-notater."),
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
    const email = ctx.getUserEmail() ?? "";
    const { data: profile } = await sb
      .from("profiles")
      .select("display_name")
      .eq("user_id", ctx.getUserId()!)
      .maybeSingle();
    const row = {
      oppgave: input.oppgave,
      frist: input.frist || null,
      prioritet: input.prioritet || "Medium",
      status: "Åpen",
      ansvarlig: (profile as any)?.display_name || email,
      notater: input.notater || "",
      lead_id: input.lead_id || null,
      salgsmulighet_id: input.salgsmulighet_id || null,
      selskap_id: input.selskap_id || null,
      kontakt_id: input.kontakt_id || null,
      user_id: ctx.getUserId(),
    };
    const { data, error } = await sb.from("oppgaver").insert(row).select().single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Oppgave opprettet: ${data.id}` }],
      structuredContent: { oppgave: data },
    };
  },
});
