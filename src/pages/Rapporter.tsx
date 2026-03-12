import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth, subMonths, isWithinInterval, startOfDay, endOfMonth } from "date-fns";
import { nb } from "date-fns/locale";
import PageShell from "@/components/PageShell";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, LineChart, Line, PieChart, Pie } from "recharts";
import { beregnTotalKontraktsverdi } from "@/data/crm-data";
import { ArrowLeft, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function getMonthsBetween(from: Date, to: Date) {
  const months: { date: Date; label: string }[] = [];
  let current = startOfMonth(from);
  const end = startOfMonth(to);
  while (current <= end) {
    months.push({
      date: new Date(current),
      label: format(current, "MMM yy", { locale: nb }),
    });
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }
  return months;
}

function isInRange(dateStr: string | null | undefined, from: Date, to: Date) {
  if (!dateStr) return false;
  const d = startOfDay(new Date(dateStr));
  return isWithinInterval(d, { start: startOfMonth(from), end: endOfMonth(to) });
}

export default function Rapporter() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { selskaper, salgsmuligheter, leads, partnere } = useCrmStore();

  const now = new Date();
  const [fromDate, setFromDate] = useState<Date>(subMonths(startOfMonth(now), 11));
  const [toDate, setToDate] = useState<Date>(startOfMonth(now));

  const nok = (v: number) => v.toLocaleString("no-NO");
  const months = getMonthsBetween(fromDate, toDate);

  // --- MRR over tid ---
  const mrrByMonth = months.map(({ date, label }) => {
    const m = date.getMonth(), y = date.getFullYear();
    const closed = selskaper.filter(s => {
      if (!s.lukkedato) return false;
      const dt = new Date(s.lukkedato);
      return dt.getMonth() === m && dt.getFullYear() === y;
    });
    return { mnd: label, mrr: closed.reduce((sum, s) => sum + s.mrr, 0) };
  });

  // --- Oppstartskostnader per måned ---
  const oppstartByMonth = months.map(({ date, label }) => {
    const m = date.getMonth(), y = date.getFullYear();
    const vunnet = salgsmuligheter.filter(s => s.status === "Vunnet" && s.vunnet_dato && new Date(s.vunnet_dato).getMonth() === m && new Date(s.vunnet_dato).getFullYear() === y);
    return { mnd: label, vunnet: vunnet.reduce((sum, s) => sum + (s.oppstartskostnad || 0), 0) };
  });

  // --- Pipeline per status (snapshot, not date-filtered) ---
  const openSm = salgsmuligheter.filter(s => s.status !== "Vunnet" && s.status !== "Tapt");
  const pipelineStatuses = ["Ny mulighet", "Møte booket", "Demo gjennomført", "Tilbud sendt", "Forhandling"];
  const pipelineColors = ["hsl(220, 70%, 55%)", "hsl(38, 92%, 50%)", "hsl(199, 89%, 48%)", "hsl(262, 60%, 55%)", "hsl(38, 70%, 50%)"];
  const pipelineData = pipelineStatuses.map(s => ({
    status: s.length > 12 ? s.substring(0, 12) + "…" : s,
    verdi: openSm.filter(sm => sm.status === s).reduce((sum, sm) => sum + beregnTotalKontraktsverdi(sm), 0),
  }));

  // --- Kanselleringsårsaker (filtered) ---
  const allCancelled = selskaper.filter(s => s.kundestatus === "Kansellert" && s.kanselleringsaarsak && isInRange(s.kansellert_dato, fromDate, toDate));
  const cancelReasons = ["Pris", "Lav bruk", "Teknisk utfordring", "Manglende verdi", "Byttet leverandør", "Midlertidig stopp", "Annet"];
  const cancelData = cancelReasons.map(r => ({
    aarsak: r.length > 12 ? r.substring(0, 12) + "…" : r,
    antall: allCancelled.filter(s => s.kanselleringsaarsak === r).length,
  })).filter(d => d.antall > 0);

  // --- Leads per måned ---
  const leadsByMonth = months.map(({ date, label }) => {
    const m = date.getMonth(), y = date.getFullYear();
    const count = leads.filter(l => {
      if (!l.opprettet_dato) return false;
      const dt = new Date(l.opprettet_dato);
      return dt.getMonth() === m && dt.getFullYear() === y;
    }).length;
    return { mnd: label, antall: count };
  });

  // --- Lukkede kunder per måned ---
  const closedByMonth = months.map(({ date, label }) => {
    const m = date.getMonth(), y = date.getFullYear();
    const closed = selskaper.filter(s => {
      if (!s.lukkedato) return false;
      const dt = new Date(s.lukkedato);
      return dt.getMonth() === m && dt.getFullYear() === y;
    });
    return { mnd: label, antall: closed.length, mrr: closed.reduce((sum, s) => sum + s.mrr, 0) };
  });

  // --- Kundestatus fordeling (snapshot) ---
  const kundestatuser = ["Ikke kunde", "Pilot", "Live", "Pause", "Kansellert"];
  const statusColors = ["hsl(220, 14%, 60%)", "hsl(38, 92%, 50%)", "hsl(142, 71%, 45%)", "hsl(262, 60%, 55%)", "hsl(0, 72%, 51%)"];
  const kundestatusData = kundestatuser.map((s, i) => ({
    name: s,
    value: selskaper.filter(sel => sel.kundestatus === s).length,
    fill: statusColors[i],
  })).filter(d => d.value > 0);

  // --- Vunnet/Tapt per måned ---
  const wonLostByMonth = months.map(({ date, label }) => {
    const m = date.getMonth(), y = date.getFullYear();
    return {
      mnd: label,
      vunnet: salgsmuligheter.filter(s => s.status === "Vunnet" && s.vunnet_dato && new Date(s.vunnet_dato).getMonth() === m && new Date(s.vunnet_dato).getFullYear() === y).length,
      tapt: salgsmuligheter.filter(s => s.status === "Tapt" && s.tapt_dato && new Date(s.tapt_dato).getMonth() === m && new Date(s.tapt_dato).getFullYear() === y).length,
    };
  });

  // --- Partner topp MRR (snapshot) ---
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

  const DatePicker = ({ label, date, onSelect }: { label: string; date: Date; onSelect: (d: Date) => void }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal gap-1.5", isMobile && "text-xs px-2")}>
          <CalendarIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{label}: </span>
          {format(date, "MMM yyyy", { locale: nb })}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => d && onSelect(startOfMonth(d))}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );

  const presetRange = (monthsBack: number) => {
    setFromDate(subMonths(startOfMonth(now), monthsBack - 1));
    setToDate(startOfMonth(now));
  };

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
      {/* Date range picker */}
      <div className="flex flex-wrap items-center gap-2 mb-6 bg-card border rounded-xl p-3 sm:p-4">
        <span className="text-sm font-medium text-muted-foreground mr-1">Periode:</span>
        <DatePicker label="Fra" date={fromDate} onSelect={setFromDate} />
        <span className="text-muted-foreground text-sm">→</span>
        <DatePicker label="Til" date={toDate} onSelect={setToDate} />
        <div className="flex gap-1.5 ml-auto">
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => presetRange(3)}>3 mnd</Button>
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => presetRange(6)}>6 mnd</Button>
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => presetRange(12)}>12 mnd</Button>
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => presetRange(24)}>24 mnd</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
        {chartCard("Oppstartskostnader per måned", (
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

        {chartCard("Ny MRR per måned", (
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

        {chartCard("Nye leads per måned", (
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

        {chartCard("Lukkede kunder per måned", (
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
