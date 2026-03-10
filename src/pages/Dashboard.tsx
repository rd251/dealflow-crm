import PageShell from "@/components/PageShell";
import StatCard from "@/components/StatCard";
import { useCrmStore } from "@/hooks/use-crm-store";
import { Building2, TrendingUp, DollarSign, CheckCircle2, AlertTriangle, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const stageColors: Record<string, string> = {
  "New Lead": "hsl(220, 70%, 55%)",
  "Contacted": "hsl(38, 92%, 50%)",
  "Proposal Sent": "hsl(262, 60%, 55%)",
  "Won": "hsl(142, 71%, 45%)",
  "Lost": "hsl(0, 72%, 51%)",
};

export default function Dashboard() {
  const { companies, deals, tasks } = useCrmStore();

  const totalPipeline = deals.filter(d => d.status === "Open").reduce((s, d) => s + d.expectedMRR, 0);
  const weightedPipeline = deals.filter(d => d.status === "Open").reduce((s, d) => s + d.weightedMRR, 0);
  const liveMRR = companies.reduce((s, c) => s + c.liveMRR, 0);
  const liveCustomers = companies.filter(c => c.status === "Live").length;
  const wonDeals = deals.filter(d => d.status === "Won").length;
  const closedDeals = deals.filter(d => d.status === "Won" || d.status === "Lost").length;
  const winRate = closedDeals > 0 ? Math.round((wonDeals / closedDeals) * 100) : 0;
  const overdueTasks = tasks.filter(t => !t.completed && new Date(t.dueDate) < new Date()).length;

  const stages = ["New Lead", "Contacted", "Proposal Sent", "Won", "Lost"] as const;
  const pipelineData = stages.map(stage => ({
    stage,
    count: deals.filter(d => d.stage === stage).length,
    value: deals.filter(d => d.stage === stage).reduce((s, d) => s + d.expectedMRR, 0),
  }));

  return (
    <PageShell title="Dashboard" subtitle="Snakk CRM Overview">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard label="Live MRR" value={`${liveMRR.toLocaleString("no-NO")} NOK`} icon={<DollarSign className="w-5 h-5" />} />
        <StatCard label="Open Pipeline" value={`${totalPipeline.toLocaleString("no-NO")} NOK`} icon={<TrendingUp className="w-5 h-5" />} trend={`Weighted: ${weightedPipeline.toLocaleString("no-NO")} NOK`} />
        <StatCard label="Live Customers" value={liveCustomers} icon={<Building2 className="w-5 h-5" />} trend={`${companies.length} total companies`} />
        <StatCard label="Win Rate" value={`${winRate}%`} icon={<CheckCircle2 className="w-5 h-5" />} trend={`${wonDeals} won / ${closedDeals} closed`} />
        <StatCard label="Total Companies" value={companies.length} icon={<Users className="w-5 h-5" />} />
        <StatCard label="Overdue Tasks" value={overdueTasks} icon={<AlertTriangle className="w-5 h-5" />} trend={overdueTasks > 0 ? "Action needed" : "All on track"} />
      </div>

      <div className="bg-card border rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Pipeline by Stage</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={pipelineData}>
            <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(value: number) => [`${value.toLocaleString("no-NO")} NOK`, "Value"]}
              contentStyle={{ borderRadius: "8px", border: "1px solid hsl(220, 13%, 91%)", fontSize: "13px" }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {pipelineData.map((entry) => (
                <Cell key={entry.stage} fill={stageColors[entry.stage]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </PageShell>
  );
}
