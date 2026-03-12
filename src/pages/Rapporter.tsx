import { useNavigate } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, LineChart, Line, PieChart, Pie } from "recharts";
import { beregnTotalKontraktsverdi } from "@/data/crm-data";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Rapporter() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { selskaper, salgsmuligheter, leads, partnere } = useCrmStore();

  const now = new Date();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Des"];
  const nok = (v: number) => v.toLocaleString("no-NO");

  // --- MRR over tid (siste 6 mnd) ---
  const mrrByMonth: { mnd: string; mrr: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = d.getMonth();
    const y = d.getFullYear();
    const closed = selskaper.filter(s => {
      if (!s.lukkedato) return false;
      const dt = new Date(s.lukkedato);
      return dt.getMonth() === m && dt.getFullYear() === y;
    });
    mrrByMonth.push({
      mnd: `${monthNames[m]} ${y.toString().slice(2)}`,
      mrr: closed.reduce((sum, s) => sum + s.mrr, 0),
    });
  }

  // --- Oppstartskostnader per måned ---
  const oppstartByMonth: { mnd: string; vunnet: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = d.getMonth();
    const y = d.getFullYear();
    const vunnet = salgsmuligheter.filter(s => s.status === "Vunnet" && s.vunnet_dato && new Date(s.vunnet_dato).getMonth() === m && new Date(s.vunnet_dato).getFullYear() === y);
    oppstartByMonth.push({
      mnd: `${monthNames[m]} ${y.toString().slice(2)}`,
      vunnet: vunnet.reduce((sum, s) => sum + (s.oppstartskostnad || 0), 0),
    });
  }

  // --- Pipeline per status ---
  const openSm = salgsmuligheter.filter(s => s.status !== "Vunnet" && s.status !== "Tapt");
  const pipelineStatuses = ["Ny mulighet", "Møte booket", "Demo gjennomført", "Tilbud sendt", "Forhandling"];
  const pipelineColors = ["hsl(220, 70%, 55%)", "hsl(38, 92%, 50%)", "hsl(199, 89%, 48%)", "hsl(262, 60%, 55%)", "hsl(38, 70%, 50%)"];
  const pipelineData = pipelineStatuses.map(s => ({
    status: s.length > 12 ? s.substring(0, 12) + "…" : s,
    verdi: openSm.filter(sm => sm.status === s).reduce((sum, sm) => sum + beregnTotalKontraktsverdi(sm), 0),
  }));

  // --- Kanselleringsårsaker ---
  const allCancelled = selskaper.filter(s => s.kundestatus === "Kansellert" && s.kanselleringsaarsak);
  const cancelReasons = ["Pris", "Lav bruk", "Teknisk utfordring", "Manglende verdi", "Byttet leverandør", "Midlertidig stopp", "Annet"];
  const cancelData = cancelReasons.map(r => ({
    aarsak: r.length > 12 ? r.substring(0, 12) + "…" : r,
    antall: allCancelled.filter(s => s.kanselleringsaarsak === r).length,
  })).filter(d => d.antall > 0);

  // --- Leads per måned ---
  const leadsByMonth: { mnd: string; antall: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = d.getMonth();
    const y = d.getFullYear();
    const count = leads.filter(l => {
      if (!l.opprettet_dato) return false;
      const dt = new Date(l.opprettet_dato);
      return dt.getMonth() === m && dt.getFullYear() === y;
    }).length;
    leadsByMonth.push({ mnd: `${monthNames[m]} ${y.toString().slice(2)}`, antall: count });
  }

  // --- Lukkede kunder per måned ---
  const closedByMonth: { mnd: string; antall: number; mrr: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = d.getMonth();
    const y = d.getFullYear();
    const closed = selskaper.filter(s => {
      if (!s.lukkedato) return false;
      const dt = new Date(s.lukkedato);
      return dt.getMonth() === m && dt.getFullYear() === y;
    });
    closedByMonth.push({
      mnd: `${monthNames[m]} ${y.toString().slice(2)}`,
      antall: closed.length,
      mrr: closed.reduce((sum, s) => sum + s.mrr, 0),
    });
  }

  // --- Kundestatus fordeling ---
  const kundestatuser = ["Ikke kunde", "Pilot", "Live", "Pause", "Kansellert"];
  const statusColors = ["hsl(220, 14%, 60%)", "hsl(38, 92%, 50%)", "hsl(142, 71%, 45%)", "hsl(262, 60%, 55%)", "hsl(0, 72%, 51%)"];
  const kundestatusData = kundestatuser.map((s, i) => ({
    name: s,
    value: selskaper.filter(sel => sel.kundestatus === s).length,
    fill: statusColors[i],
  })).filter(d => d.value > 0);

  // --- Vunnet/Tapt per måned ---
  const wonLostByMonth: { mnd: string; vunnet: number; tapt: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = d.getMonth();
    const y = d.getFullYear();
    wonLostByMonth.push({
      mnd: `${monthNames[m]} ${y.toString().slice(2)}`,
      vunnet: salgsmuligheter.filter(s => s.status === "Vunnet" && s.vunnet_dato && new Date(s.vunnet_dato).getMonth() === m && new Date(s.vunnet_dato).getFullYear() === y).length,
      tapt: salgsmuligheter.filter(s => s.status === "Tapt" && s.tapt_dato && new Date(s.tapt_dato).getMonth() === m && new Date(s.tapt_dato).getFullYear() === y).length,
    });
  }

  // --- Partner topp MRR ---
  const topPartnere = partnere.map(p => {
    const kunder = selskaper.filter(s => s.partner_id === p.id && s.kundestatus === "Live");
    const mrr = kunder.reduce((sum, s) => sum + s.mrr, 0);
    return { navn: p.partnernavn.length > 15 ? p.partnernavn.substring(0, 15) + "…" : p.partnernavn, mrr };
  }).sort((a, b) => b.mrr - a.mrr).slice(0, 10).filter(p => p.mrr > 0);

  const chartCard = (title: string, children: React.ReactNode) => (
    <div className="bg-card border rounded-xl p-4 sm:p-6">
      <h2 className="text-base sm:text-lg font-semibold mb-4">{title}</h2>
      {children}
    </div>
  );

  return (
    <PageShell
      title="Rapporter"
      subtitle="Detaljerte grafer og innsikt"
      actions={
        <Button variant="outline" size="sm" onClick={() => navigate("/")} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
        {/* Oppstartskostnader per måned */}
        {chartCard("Oppstartskostnader per måned (12 mnd)", (
          <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
            <BarChart data={oppstartByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mnd" tick={{ fontSize: isMobile ? 8 : 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => [`${nok(value)} NOK`, "Vunnet"]} contentStyle={{ borderRadius: "8px", fontSize: "13px" }} />
              <Bar dataKey="vunnet" fill="hsl(142, 71%, 45%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ))}

        {/* MRR utvikling */}
        {chartCard("Ny MRR per måned (6 mnd)", (
          <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
            <LineChart data={mrrByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mnd" tick={{ fontSize: isMobile ? 8 : 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => [`${nok(value)} NOK`, "MRR"]} contentStyle={{ borderRadius: "8px", fontSize: "13px" }} />
              <Line type="monotone" dataKey="mrr" stroke="hsl(220, 70%, 55%)" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        ))}

        {/* Vunnet vs Tapt */}
        {chartCard("Vunnet vs Tapt per måned", (
          <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
            <BarChart data={wonLostByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mnd" tick={{ fontSize: isMobile ? 8 : 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: "8px", fontSize: "13px" }} />
              <Bar dataKey="vunnet" name="Vunnet" fill="hsl(142, 71%, 45%)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="tapt" name="Tapt" fill="hsl(0, 72%, 51%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ))}

        {/* Leads per måned */}
        {chartCard("Nye leads per måned (12 mnd)", (
          <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
            <BarChart data={leadsByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mnd" tick={{ fontSize: isMobile ? 8 : 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: "8px", fontSize: "13px" }} />
              <Bar dataKey="antall" name="Leads" fill="hsl(199, 89%, 48%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ))}

        {/* Pipeline per status */}
        {chartCard("Pipeline per status", (
          <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
            <BarChart data={pipelineData}>
              <XAxis dataKey="status" tick={{ fontSize: isMobile ? 8 : 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => [`${nok(value)} NOK`, "Verdi"]} contentStyle={{ borderRadius: "8px", fontSize: "13px" }} />
              <Bar dataKey="verdi" radius={[6, 6, 0, 0]}>
                {pipelineData.map((_, i) => <Cell key={i} fill={pipelineColors[i % pipelineColors.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ))}

        {/* Kundestatus fordeling */}
        {kundestatusData.length > 0 && chartCard("Kundestatus fordeling", (
          <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
            <PieChart>
              <Pie data={kundestatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={isMobile ? 70 : 100} label={({ name, value }) => `${name}: ${value}`}>
                {kundestatusData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: "8px", fontSize: "13px" }} />
            </PieChart>
          </ResponsiveContainer>
        ))}

        {/* Lukkede kunder per måned */}
        {chartCard("Lukkede kunder per måned (12 mnd)", (
          <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
            <BarChart data={closedByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mnd" tick={{ fontSize: isMobile ? 8 : 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  name === "antall" ? value : `${nok(value)} NOK`,
                  name === "antall" ? "Kunder" : "MRR"
                ]}
                contentStyle={{ borderRadius: "8px", fontSize: "13px" }}
              />
              <Bar dataKey="antall" name="antall" fill="hsl(220, 70%, 55%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ))}

        {/* Kanselleringsårsaker */}
        {cancelData.length > 0 && chartCard("Kanselleringsårsaker", (
          <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
            <BarChart data={cancelData} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="aarsak" tick={{ fontSize: isMobile ? 9 : 11 }} width={isMobile ? 70 : 100} />
              <Tooltip contentStyle={{ borderRadius: "8px", fontSize: "13px" }} />
              <Bar dataKey="antall" fill="hsl(0, 72%, 51%)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ))}

        {/* Topp partnere */}
        {topPartnere.length > 0 && chartCard("Topp partnere etter MRR", (
          <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
            <BarChart data={topPartnere} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="navn" tick={{ fontSize: isMobile ? 9 : 11 }} width={isMobile ? 80 : 120} />
              <Tooltip formatter={(value: number) => [`${nok(value)} NOK`, "MRR"]} contentStyle={{ borderRadius: "8px", fontSize: "13px" }} />
              <Bar dataKey="mrr" fill="hsl(3, 76%, 48%)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ))}
      </div>
    </PageShell>
  );
}
