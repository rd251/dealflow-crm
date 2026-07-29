import { defineTool } from "@lovable.dev/mcp-js";
import { requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "pipeline_summary",
  title: "Pipeline-sammendrag",
  description:
    "Aggregert oversikt over aktiv MRR, pipeline-verdi, vektet pipeline, vunnet/tapt denne måneden, og fordeling per fase.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const guard = requireAuth(ctx);
    if (guard) return guard;
    const sb = supabaseForUser(ctx);
    const now = new Date();
    const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    const { data: deals } = await sb
      .from("salgsmuligheter")
      .select("status, forventet_mrr, sannsynlighet, vunnet_dato, tapt_dato");
    const { data: companies } = await sb.from("selskaper").select("mrr, kundestatus");

    const open = (deals || []).filter((d: any) => !["Vunnet", "Tapt"].includes(d.status));
    const byStage: Record<string, { count: number; mrr: number }> = {};
    for (const d of open) {
      const s = d.status || "Ukjent";
      if (!byStage[s]) byStage[s] = { count: 0, mrr: 0 };
      byStage[s].count++;
      byStage[s].mrr += d.forventet_mrr || 0;
    }
    const totalPipelineMrr = open.reduce((s: number, d: any) => s + (d.forventet_mrr || 0), 0);
    const weighted = open.reduce(
      (s: number, d: any) => s + ((d.forventet_mrr || 0) * (d.sannsynlighet || 50)) / 100,
      0,
    );
    const wonMonth = (deals || []).filter((d: any) => d.vunnet_dato && d.vunnet_dato >= firstOfMonth);
    const lostMonth = (deals || []).filter((d: any) => d.tapt_dato && d.tapt_dato >= firstOfMonth);

    const liveMrr = (companies || [])
      .filter((c: any) => c.kundestatus === "Live")
      .reduce((s: number, c: any) => s + (c.mrr || 0), 0);
    const pilotMrr = (companies || [])
      .filter((c: any) => c.kundestatus === "Pilot")
      .reduce((s: number, c: any) => s + (c.mrr || 0), 0);

    const summary = {
      aktiv_mrr: liveMrr + pilotMrr,
      live_mrr: liveMrr,
      pilot_mrr: pilotMrr,
      pipeline_mrr: totalPipelineMrr,
      vektet_pipeline_mrr: Math.round(weighted),
      aapne_salgsmuligheter: open.length,
      vunnet_denne_maaned: {
        antall: wonMonth.length,
        mrr: wonMonth.reduce((s: number, d: any) => s + (d.forventet_mrr || 0), 0),
      },
      tapt_denne_maaned: {
        antall: lostMonth.length,
        mrr: lostMonth.reduce((s: number, d: any) => s + (d.forventet_mrr || 0), 0),
      },
      per_fase: byStage,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});
