import { defineTool } from "@lovable.dev/mcp-js";
import { requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "overdue_followups",
  title: "Utgått oppfølging",
  description:
    "Leads (>48t uten aktivitet) og salgsmuligheter (>72t uten aktivitet) som trenger oppfølging.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const guard = requireAuth(ctx);
    if (guard) return guard;
    const sb = supabaseForUser(ctx);
    const now = Date.now();
    const lead48 = new Date(now - 48 * 3600 * 1000).toISOString().split("T")[0];
    const sm72 = new Date(now - 72 * 3600 * 1000).toISOString().split("T")[0];

    const { data: leads } = await sb
      .from("leads")
      .select("id, firmanavn, kontaktperson, status, ansvarlig, sist_aktivitet")
      .not("status", "in", '("Ikke aktuelt","Konvertert til salg","Konvertert til partner")')
      .lt("sist_aktivitet", lead48)
      .order("sist_aktivitet", { ascending: true })
      .limit(50);

    const { data: sm } = await sb
      .from("salgsmuligheter")
      .select("id, navn, status, ansvarlig, forventet_mrr, sist_aktivitet")
      .not("status", "in", '("Vunnet","Tapt")')
      .lt("sist_aktivitet", sm72)
      .order("sist_aktivitet", { ascending: true })
      .limit(50);

    const payload = {
      leads_stale: leads || [],
      salgsmuligheter_stale: sm || [],
      thresholds: { lead_hours: 48, salgsmulighet_hours: 72 },
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
