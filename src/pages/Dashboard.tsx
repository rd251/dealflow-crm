import { useNavigate } from "react-router-dom";
import PageShell from "@/components/PageShell";
import UpcomingMeetings from "@/components/UpcomingMeetings";
import StatCard from "@/components/StatCard";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { DollarSign, TrendingUp, Users, BarChart3, ListTodo, Clock, Activity, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";
import { beregnTotalKontraktsverdi } from "@/data/crm-data";
import { Badge } from "@/components/ui/badge";

const prioritetBadge: Record<string, string> = {
  "Høy": "bg-destructive/10 text-destructive border-destructive/20",
  "Medium": "bg-primary/10 text-primary border-primary/20",
  "Lav": "bg-muted text-muted-foreground border-border",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { selskaper, salgsmuligheter, leads, oppgaver, prosjekter } = useCrmStore();

  const now = new Date();
  const today = now.toISOString().split("T")[0];

  // Core metrics
  const liveSelskaper = selskaper.filter(s => s.kundestatus === "Live");
  const totalMRR = liveSelskaper.reduce((sum, s) => sum + s.mrr, 0);
  const arr = totalMRR * 12;
  const aktiveKunder = liveSelskaper.length;

  // Pipeline
  const openSm = salgsmuligheter.filter(s => s.status !== "Vunnet" && s.status !== "Tapt");
  const aapenPipeline = openSm.reduce((sum, s) => sum + beregnTotalKontraktsverdi(s), 0);

  // Overdue tasks
  const forfaltOppgaver = oppgaver.filter(o => o.status !== "Ferdig" && o.frist && o.frist < today).length;

  // Pipeline chart
  const pipelineStatuses = ["Ny mulighet", "Møte booket", "Demo gjennomført", "Tilbud sendt", "Forhandling"];
  const pipelineColors = ["hsl(220, 70%, 55%)", "hsl(38, 92%, 50%)", "hsl(199, 89%, 48%)", "hsl(262, 60%, 55%)", "hsl(38, 70%, 50%)"];
  const pipelineData = pipelineStatuses.map(s => ({
    status: s.length > 12 ? s.substring(0, 12) + "…" : s,
    verdi: openSm.filter(sm => sm.status === s).reduce((sum, sm) => sum + beregnTotalKontraktsverdi(sm), 0),
  }));

  const nok = (v: number) => v.toLocaleString("no-NO");

  // Upcoming tasks
  const activeTasks = oppgaver
    .filter(o => o.status !== "Ferdig")
    .sort((a, b) => {
      if (!a.frist) return 1;
      if (!b.frist) return -1;
      return a.frist.localeCompare(b.frist);
    })
    .slice(0, isMobile ? 5 : 8);

  // Activity feed
  type ActivityItem = { dato: string; tekst: string; type: "lead" | "deal" | "prosjekt" | "selskap"; route: string };
  const activityItems: ActivityItem[] = [];

  leads.forEach(l => {
    if (l.opprettet_dato) activityItems.push({ dato: l.opprettet_dato, tekst: `Nytt lead: ${l.firmanavn}`, type: "lead", route: "/leads" });
    if (l.konvertert_dato) activityItems.push({ dato: l.konvertert_dato, tekst: `Lead konvertert: ${l.firmanavn}`, type: "lead", route: "/leads" });
  });
  salgsmuligheter.forEach(s => {
    if (s.opprettet_dato) activityItems.push({ dato: s.opprettet_dato, tekst: `Ny salgsmulighet: ${s.navn}`, type: "deal", route: "/salgsmuligheter" });
    if (s.vunnet_dato) activityItems.push({ dato: s.vunnet_dato, tekst: `Deal vunnet: ${s.navn}`, type: "deal", route: "/salgsmuligheter" });
    if (s.tapt_dato) activityItems.push({ dato: s.tapt_dato, tekst: `Deal tapt: ${s.navn}`, type: "deal", route: "/salgsmuligheter" });
  });
  prosjekter.forEach(p => {
    if (p.go_live_dato) activityItems.push({ dato: p.go_live_dato, tekst: `Prosjekt live: ${p.prosjektnavn}`, type: "prosjekt", route: "/prosjekter" });
  });
  selskaper.forEach(s => {
    if (s.go_live_dato) activityItems.push({ dato: s.go_live_dato, tekst: `Kunde live: ${s.firmanavn}`, type: "selskap", route: "/selskaper" });
    if (s.kansellert_dato) activityItems.push({ dato: s.kansellert_dato, tekst: `Kunde kansellert: ${s.firmanavn}`, type: "selskap", route: "/selskaper" });
  });

  const recentActivity = activityItems
    .sort((a, b) => b.dato.localeCompare(a.dato))
    .slice(0, isMobile ? 6 : 10);

  const activityTypeColors: Record<string, string> = {
    lead: "bg-blue-500",
    deal: "bg-emerald-500",
    prosjekt: "bg-violet-500",
    selskap: "bg-amber-500",
  };

  const formatDate = (d: string) => {
    if (!d) return "";
    const date = new Date(d);
    return date.toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
  };

  const isOverdue = (frist: string) => frist && frist < today;
  const isToday = (frist: string) => frist === today;

  return (
    <PageShell title="Dashboard" subtitle="Oversikt og daglige oppgaver" actions={
      <button onClick={() => navigate("/rapporter")} className="flex items-center gap-1.5 text-sm text-primary hover:underline font-medium">
        <BarChart3 className="w-4 h-4" /> Rapporter
      </button>
    }>
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4 mb-6">
        <StatCard label="MRR" value={`${nok(totalMRR)} NOK`} icon={<DollarSign className="w-5 h-5" />} />
        <StatCard label="ARR" value={`${nok(arr)} NOK`} icon={<TrendingUp className="w-5 h-5" />} />
        <StatCard label="Aktive kunder" value={aktiveKunder} icon={<Users className="w-5 h-5" />} />
        <StatCard label="Åpen pipeline" value={`${nok(aapenPipeline)} NOK`} icon={<BarChart3 className="w-5 h-5" />} />
        <StatCard
          label="Forfalte oppgaver"
          value={forfaltOppgaver}
          icon={<AlertTriangle className="w-5 h-5" />}
          trend={forfaltOppgaver > 0 ? "Handling kreves" : "Alt på stell"}
          className={isMobile ? "col-span-2" : ""}
        />
      </div>

      {/* Upcoming meetings & activities */}
      <UpcomingMeetings />

      {/* Tasks & Activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
        {/* Upcoming tasks */}
        <div className="bg-card border rounded-xl p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <ListTodo className="w-5 h-5 text-primary" />
            <h2 className="text-base sm:text-lg font-semibold">Kommende oppgaver</h2>
            <Badge variant="secondary" className="ml-auto text-xs">
              {activeTasks.length} aktive
            </Badge>
          </div>
          {activeTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Ingen aktive oppgaver</p>
          ) : (
            <div className="space-y-2">
              {activeTasks.map(task => {
                const selskap = selskaper.find(s => s.id === task.selskap_id);
                const overdue = isOverdue(task.frist);
                const todayTask = isToday(task.frist);
                return (
                  <div
                    key={task.id}
                    onClick={() => navigate("/oppgaver")}
                    className={`flex items-start gap-3 p-2.5 sm:p-3 rounded-lg border transition-colors cursor-pointer group hover:shadow-sm ${
                      overdue ? "bg-destructive/5 border-destructive/20 hover:bg-destructive/10" : todayTask ? "bg-primary/5 border-primary/20 hover:bg-primary/10" : "bg-muted/30 border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${overdue ? "bg-destructive" : todayTask ? "bg-primary" : "bg-muted-foreground/40"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:underline">{task.oppgave}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {selskap && <span className="text-xs text-muted-foreground truncate">{selskap.firmanavn}</span>}
                        {task.frist && (
                          <span className={`text-xs flex items-center gap-1 ${overdue ? "text-destructive font-medium" : todayTask ? "text-primary font-medium" : "text-muted-foreground"}`}>
                            <Clock className="w-3 h-3" />
                            {overdue ? "Forfalt" : todayTask ? "I dag" : formatDate(task.frist)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${prioritetBadge[task.prioritet] || ""}`}>
                      {task.prioritet}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Activity feed */}
        <div className="bg-card border rounded-xl p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-primary" />
            <h2 className="text-base sm:text-lg font-semibold">Siste aktivitet</h2>
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Ingen aktivitet ennå</p>
          ) : (
            <div className="relative">
              <div className="absolute left-[7px] top-3 bottom-3 w-px bg-border" />
              <div className="space-y-3">
                {recentActivity.map((item, i) => (
                  <div
                    key={i}
                    onClick={() => navigate(item.route)}
                    className="flex items-start gap-3 relative cursor-pointer group hover:bg-muted/30 rounded-lg p-1.5 -ml-1.5 transition-colors"
                  >
                    <div className={`w-[15px] h-[15px] rounded-full shrink-0 mt-0.5 border-2 border-card ${activityTypeColors[item.type]}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate group-hover:underline">{item.tekst}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(item.dato)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pipeline chart */}
      <div className="bg-card border rounded-xl p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-semibold mb-4">Pipeline per status</h2>
        <ResponsiveContainer width="100%" height={isMobile ? 200 : 260}>
          <BarChart data={pipelineData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="status" tick={{ fontSize: isMobile ? 9 : 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(value: number) => [`${nok(value)} NOK`, "Verdi"]} contentStyle={{ borderRadius: "8px", fontSize: "13px" }} />
            <Bar dataKey="verdi" radius={[6, 6, 0, 0]}>
              {pipelineData.map((_, i) => <Cell key={i} fill={pipelineColors[i % pipelineColors.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </PageShell>
  );
}
