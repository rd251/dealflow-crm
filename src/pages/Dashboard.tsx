import PageShell from "@/components/PageShell";
import StatCard from "@/components/StatCard";
import { useCrmStore } from "@/hooks/use-crm-store";
import { DollarSign, TrendingUp, Users, Target, AlertTriangle, BarChart3, ArrowUpRight, ArrowDownRight, Zap, Trophy, XCircle, UserMinus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid } from "recharts";
import { beregnTotalKontraktsverdi } from "@/data/crm-data";

export default function Dashboard() {
  const { selskaper, salgsmuligheter, leads, oppgaver } = useCrmStore();

  const now = new Date();
  const thisMonth = (d: string) => {
    if (!d) return false;
    const dt = new Date(d);
    return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
  };
  const today = new Date().toISOString().split("T")[0];

  // MRR & ARR
  const liveSelskaper = selskaper.filter(s => s.kundestatus === "Live");
  const totalMRR = liveSelskaper.reduce((sum, s) => sum + s.mrr, 0);
  const arr = totalMRR * 12;
  const aktiveKunder = liveSelskaper.length;

  // Ny MRR (go_live this month)
  const nyMRR = selskaper.filter(s => thisMonth(s.go_live_dato)).reduce((sum, s) => sum + s.mrr, 0);

  // Tapt MRR (cancelled this month)
  const kansellerteIMnd = selskaper.filter(s => s.kundestatus === "Kansellert" && thisMonth(s.kansellert_dato));
  const taptMRR = kansellerteIMnd.reduce((sum, s) => sum + s.mrr, 0);
  const nettoMRR = nyMRR - taptMRR;

  // Leads
  const nyeLeads = leads.filter(l => thisMonth(l.opprettet_dato)).length;
  const kvalifiserteLeads = leads.filter(l => (l.status === "Kvalifisert" || l.status === "Konvertert til salg") && thisMonth(l.sist_aktivitet)).length;

  // Pipeline
  const openSm = salgsmuligheter.filter(s => s.status !== "Vunnet" && s.status !== "Tapt");
  const aapenPipeline = openSm.reduce((sum, s) => sum + beregnTotalKontraktsverdi(s), 0);

  // Won / Lost this month
  const vunnetIMnd = salgsmuligheter.filter(s => s.status === "Vunnet" && thisMonth(s.vunnet_dato));
  const taptIMnd = salgsmuligheter.filter(s => s.status === "Tapt" && thisMonth(s.tapt_dato));
  const winRate = (vunnetIMnd.length + taptIMnd.length) > 0
    ? Math.round((vunnetIMnd.length / (vunnetIMnd.length + taptIMnd.length)) * 100) : 0;

  // Churn
  const kansellerteKunder = kansellerteIMnd.length;
  const mrrStartManed = totalMRR + taptMRR; // approximate
  const churnRate = mrrStartManed > 0 ? ((taptMRR / mrrStartManed) * 100).toFixed(1) : "0";

  // Overdue tasks
  const forfaltOppgaver = oppgaver.filter(o => o.status !== "Ferdig" && o.frist && o.frist < today).length;

  // Pipeline chart
  const pipelineStatuses = ["Ny mulighet", "Møte booket", "Demo gjennomført", "Tilbud sendt", "Forhandling"];
  const pipelineColors = ["hsl(220, 70%, 55%)", "hsl(38, 92%, 50%)", "hsl(199, 89%, 48%)", "hsl(262, 60%, 55%)", "hsl(38, 70%, 50%)"];
  const pipelineData = pipelineStatuses.map(s => ({
    status: s.length > 12 ? s.substring(0, 12) + "…" : s,
    verdi: openSm.filter(sm => sm.status === s).reduce((sum, sm) => sum + beregnTotalKontraktsverdi(sm), 0),
  }));

  // Cancellation reasons
  const allCancelled = selskaper.filter(s => s.kundestatus === "Kansellert" && s.kanselleringsaarsak);
  const cancelReasons = ["Pris", "Lav bruk", "Teknisk utfordring", "Manglende verdi", "Byttet leverandør", "Midlertidig stopp", "Annet"];
  const cancelData = cancelReasons.map(r => ({
    aarsak: r.length > 12 ? r.substring(0, 12) + "…" : r,
    antall: allCancelled.filter(s => s.kanselleringsaarsak === r).length,
  })).filter(d => d.antall > 0);

  // MRR trend (simplified - just show current month)
  const mrrTrend = [
    { mnd: "Jan", mrr: 0 }, { mnd: "Feb", mrr: 0 }, { mnd: "Mar", mrr: totalMRR },
  ];

  const nok = (v: number) => v.toLocaleString("no-NO");

  return (
    <PageShell title="Dashboard" subtitle="Snakk CRM – SaaS-metrikker og salgsoversikt">
      {/* Row 1: MRR, ARR, Active */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <StatCard label="Totalt MRR" value={`${nok(totalMRR)} NOK`} icon={<DollarSign className="w-5 h-5" />} />
        <StatCard label="ARR" value={`${nok(arr)} NOK`} icon={<TrendingUp className="w-5 h-5" />} />
        <StatCard label="Aktive kunder" value={aktiveKunder} icon={<Users className="w-5 h-5" />} />
      </div>

      {/* Row 2: New MRR, Lost MRR, Net */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <StatCard label="Ny MRR denne mnd" value={`${nok(nyMRR)} NOK`} icon={<ArrowUpRight className="w-5 h-5" />} className={nyMRR > 0 ? "" : ""} />
        <StatCard label="Tapt MRR denne mnd" value={`${nok(taptMRR)} NOK`} icon={<ArrowDownRight className="w-5 h-5" />} />
        <StatCard label="Netto MRR vekst" value={`${nettoMRR >= 0 ? "+" : ""}${nok(nettoMRR)} NOK`} icon={<Zap className="w-5 h-5" />} />
      </div>

      {/* Row 3: Leads & Pipeline */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <StatCard label="Nye leads denne mnd" value={nyeLeads} icon={<Target className="w-5 h-5" />} />
        <StatCard label="Kvalifiserte leads" value={kvalifiserteLeads} icon={<Target className="w-5 h-5" />} />
        <StatCard label="Åpen pipeline" value={`${nok(aapenPipeline)} NOK`} icon={<BarChart3 className="w-5 h-5" />} />
      </div>

      {/* Row 4: Won/Lost/Win rate */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <StatCard label="Vunnet denne mnd" value={vunnetIMnd.length} icon={<Trophy className="w-5 h-5" />} />
        <StatCard label="Tapt denne mnd" value={taptIMnd.length} icon={<XCircle className="w-5 h-5" />} />
        <StatCard label="Win rate" value={`${winRate}%`} icon={<Target className="w-5 h-5" />} trend={`${vunnetIMnd.length} vunnet / ${vunnetIMnd.length + taptIMnd.length} avsluttet`} />
      </div>

      {/* Row 5: Churn */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard label="Kansellerte denne mnd" value={kansellerteKunder} icon={<UserMinus className="w-5 h-5" />} />
        <StatCard label="Churn-rate" value={`${churnRate}%`} icon={<AlertTriangle className="w-5 h-5" />} />
        <StatCard label="Forfalte oppgaver" value={forfaltOppgaver} icon={<AlertTriangle className="w-5 h-5" />} trend={forfaltOppgaver > 0 ? "Handling kreves" : "Alt på stell"} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Pipeline per status</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={pipelineData}>
              <XAxis dataKey="status" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => [`${nok(value)} NOK`, "Verdi"]} contentStyle={{ borderRadius: "8px", fontSize: "13px" }} />
              <Bar dataKey="verdi" radius={[6, 6, 0, 0]}>
                {pipelineData.map((_, i) => <Cell key={i} fill={pipelineColors[i % pipelineColors.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {cancelData.length > 0 && (
          <div className="bg-card border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Kanselleringsårsaker</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={cancelData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="aarsak" tick={{ fontSize: 11 }} width={100} />
                <Tooltip contentStyle={{ borderRadius: "8px", fontSize: "13px" }} />
                <Bar dataKey="antall" fill="hsl(0, 72%, 51%)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </PageShell>
  );
}
