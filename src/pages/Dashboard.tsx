import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { nb } from "date-fns/locale";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Activity, AlertTriangle, ArrowRight, Building2, CalendarDays, CheckSquare2,
  CircleDollarSign, FileSignature, Mail, MessageSquare, NotebookPen, Phone,
  TrendingDown, TrendingUp, UserRoundCheck, Users,
} from "lucide-react";
import PageShell from "@/components/PageShell";
import GlobalSearch from "@/components/GlobalSearch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCrmStore } from "@/hooks/use-crm-store";
import { supabase } from "@/integrations/supabase/client";
import { beregnTotalKontraktsverdi } from "@/data/crm-data";
import { kildeGruppe } from "@/lib/sales-flow";
import { nok } from "@/lib/utils";

interface ActivityRow {
  id: string;
  type: string;
  tittel: string | null;
  beskrivelse: string;
  dato: string;
  lead_id: string | null;
  salgsmulighet_id: string | null;
  selskap_id: string | null;
  kontakt_id: string | null;
}

interface ContractEvent {
  id: string;
  entity_id: string;
  entity_name: string;
  new_value: string | null;
  created_at: string;
}

interface TimelineItem {
  id: string;
  date: string;
  type: string;
  title: string;
  related?: string;
  href?: string;
}

const activityIcons: Record<string, typeof Phone> = {
  Telefonsamtale: Phone,
  "E-post": Mail,
  Møte: CalendarDays,
  SMS: MessageSquare,
  "LinkedIn-melding": MessageSquare,
  Notat: NotebookPen,
  Kontrakt: FileSignature,
};

function KpiCard({ label, value, detail, icon: Icon, onClick }: {
  label: string;
  value: string | number;
  detail?: string;
  icon: typeof Users;
  onClick: () => void;
}) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className="h-auto min-h-28 w-full justify-start rounded-lg bg-card p-4 text-left hover:border-primary/40 hover:bg-card"
    >
      <div className="flex w-full items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-medium text-muted-foreground">{label}</span>
          <span className="mt-1 block text-2xl font-semibold tracking-normal text-foreground">{value}</span>
          {detail && <span className="mt-1 block text-xs font-normal text-muted-foreground">{detail}</span>}
        </span>
      </div>
    </Button>
  );
}

function Section({ title, icon: Icon, children, action }: {
  title: string;
  icon: typeof Users;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <header className="flex min-h-14 items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="h-4 w-4 text-primary" />{title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { selskaper, salgsmuligheter, leads, kontakter, oppgaver } = useCrmStore();
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [contractEvents, setContractEvents] = useState<ContractEvent[]>([]);

  const now = new Date();
  const todayStart = useMemo(() => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    return value;
  }, []);
  const tomorrowStart = useMemo(() => new Date(todayStart.getTime() + 86400000), [todayStart]);
  const nextWeek = useMemo(() => new Date(todayStart.getTime() + 7 * 86400000), [todayStart]);
  const weekStart = useMemo(() => {
    const value = new Date(todayStart);
    value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
    return value;
  }, [todayStart]);
  const monthStart = startOfMonth(now);

  useEffect(() => {
    const loadActivity = async () => {
      const [{ data: activityData }, { data: changeData }] = await Promise.all([
        supabase.from("aktiviteter")
          .select("id,type,tittel,beskrivelse,dato,lead_id,salgsmulighet_id,selskap_id,kontakt_id")
          .gte("dato", todayStart.toISOString())
          .lt("dato", nextWeek.toISOString())
          .order("dato", { ascending: true }),
        supabase.from("crm_changelog")
          .select("id,entity_id,entity_name,new_value,created_at")
          .eq("entity_type", "salgsmulighet")
          .eq("field_name", "kontrakt_status")
          .in("new_value", ["Sendt", "Signert"])
          .gte("created_at", todayStart.toISOString())
          .lt("created_at", tomorrowStart.toISOString())
          .order("created_at", { ascending: false }),
      ]);
      setActivities((activityData || []) as ActivityRow[]);
      setContractEvents((changeData || []) as ContractEvent[]);
    };
    loadActivity();
  }, [todayStart, tomorrowStart, nextWeek]);

  const companyMap = useMemo(() => new Map(selskaper.map(item => [item.id, item])), [selskaper]);
  const leadMap = useMemo(() => new Map(leads.map(item => [item.id, item])), [leads]);
  const dealMap = useMemo(() => new Map(salgsmuligheter.map(item => [item.id, item])), [salgsmuligheter]);
  const contactMap = useMemo(() => new Map(kontakter.map(item => [item.id, item])), [kontakter]);

  const openDeals = salgsmuligheter.filter(item => item.status !== "Vunnet" && item.status !== "Tapt");
  const wonThisMonth = salgsmuligheter.filter(item => item.status === "Vunnet" && item.vunnet_dato && new Date(item.vunnet_dato) >= monthStart);
  const lostThisMonth = salgsmuligheter.filter(item => item.status === "Tapt" && item.tapt_dato && new Date(item.tapt_dato) >= monthStart);
  const closedThisMonth = wonThisMonth.length + lostThisMonth.length;
  const liveCompanies = selskaper.filter(item => item.kundestatus === "Live");
  const cancelledThisMonth = selskaper.filter(item => item.kundestatus === "Kansellert" && item.kansellert_dato && new Date(item.kansellert_dato) >= monthStart);
  const activeAtMonthStart = selskaper.filter(item => {
    const wentLive = item.go_live_dato ? new Date(item.go_live_dato) < monthStart : item.kundestatus === "Live";
    const cancelledLater = !item.kansellert_dato || new Date(item.kansellert_dato) >= monthStart;
    return wentLive && cancelledLater;
  }).length;

  const salesKpis = [
    { label: "Nye leads denne uken", value: leads.filter(item => item.opprettet_dato && new Date(item.opprettet_dato) >= weekStart).length, icon: Users, href: "/leads" },
    { label: "Åpen pipeline", value: nok(openDeals.reduce((sum, item) => sum + beregnTotalKontraktsverdi(item), 0)), icon: TrendingUp, href: "/salgsmuligheter" },
    { label: "Vunnet denne måneden", value: nok(wonThisMonth.reduce((sum, item) => sum + item.forventet_mrr, 0)), detail: "MRR", icon: CircleDollarSign, href: "/salgsmuligheter?status=Vunnet" },
    { label: "Win rate denne måneden", value: `${closedThisMonth ? Math.round((wonThisMonth.length / closedThisMonth) * 100) : 0} %`, icon: UserRoundCheck, href: "/salgsmuligheter" },
  ];
  const customerKpis = [
    { label: "Aktive kunder", value: liveCompanies.length, icon: Building2, href: "/selskaper" },
    { label: "Total MRR", value: nok(liveCompanies.reduce((sum, item) => sum + item.mrr, 0)), icon: CircleDollarSign, href: "/selskaper" },
    { label: "Kansellerte denne måneden", value: cancelledThisMonth.length, icon: TrendingDown, href: "/selskaper" },
    { label: "Churn-rate denne måneden", value: `${activeAtMonthStart ? Math.round((cancelledThisMonth.length / activeAtMonthStart) * 100) : 0} %`, icon: AlertTriangle, href: "/selskaper" },
  ];

  const staleLeads = leads.filter(item => {
    if (["Ikke aktuelt", "Konvertert til salg", "Konvertert til partner"].includes(item.status)) return false;
    return !item.sist_aktivitet || new Date(item.sist_aktivitet).getTime() < todayStart.getTime() - 5 * 86400000;
  });
  const dealsWithoutNext = openDeals.filter(item => !item.neste_steg?.trim());
  const overdueTasks = oppgaver.filter(item => item.status !== "Ferdig" && item.frist && item.frist < format(now, "yyyy-MM-dd"));
  const unsignedContracts = openDeals.filter(item => item.status === "Kontrakt sendt" && item.sist_aktivitet && new Date(item.sist_aktivitet).getTime() < todayStart.getTime() - 7 * 86400000);
  const attention = [
    { label: "Leads uten aktivitet siste 5 dager", count: staleLeads.length, href: "/ringeliste", icon: Phone },
    { label: "Salgsmuligheter uten neste steg", count: dealsWithoutNext.length, href: "/salgsmuligheter", icon: ArrowRight },
    { label: "Forfalte oppgaver", count: overdueTasks.length, href: "/oppgaver?filter=forfalte", icon: CheckSquare2 },
    { label: "Kontrakter usignert etter 7 dager", count: unsignedContracts.length, href: "/salgsmuligheter?status=Kontrakt%20sendt", icon: FileSignature },
  ];

  const upcoming = useMemo(() => {
    const meetingItems = activities
      .filter(item => item.type === "Møte" && new Date(item.dato) >= now)
      .map(item => ({ id: `a-${item.id}`, date: item.dato, title: item.tittel || "Møte", related: item.selskap_id ? companyMap.get(item.selskap_id)?.firmanavn : undefined, href: "/kalender" }));
    const taskItems = oppgaver
      .filter(item => item.status !== "Ferdig" && item.frist && item.frist >= format(now, "yyyy-MM-dd"))
      .map(item => ({ id: `o-${item.id}`, date: `${item.frist}T12:00:00`, title: item.oppgave, related: item.selskap_id ? companyMap.get(item.selskap_id)?.firmanavn : item.lead_id ? leadMap.get(item.lead_id)?.firmanavn : undefined, href: "/oppgaver" }));
    return [...meetingItems, ...taskItems].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  }, [activities, oppgaver, companyMap, leadMap]);

  const timeline = useMemo<TimelineItem[]>(() => {
    const normal = activities.filter(item => new Date(item.dato) < tomorrowStart).map(item => {
      const company = item.selskap_id ? companyMap.get(item.selskap_id)?.firmanavn : undefined;
      const lead = item.lead_id ? leadMap.get(item.lead_id) : undefined;
      const deal = item.salgsmulighet_id ? dealMap.get(item.salgsmulighet_id) : undefined;
      const contact = item.kontakt_id ? contactMap.get(item.kontakt_id) : undefined;
      const related = company || contact?.navn || lead?.firmanavn || deal?.navn;
      const href = item.selskap_id ? `/selskaper/${item.selskap_id}` : item.lead_id ? `/leads?open=${item.lead_id}` : item.salgsmulighet_id ? `/salgsmuligheter?open=${item.salgsmulighet_id}` : item.kontakt_id ? `/kontakter?open=${item.kontakt_id}` : "/aktiviteter";
      return { id: item.id, date: item.dato, type: item.type, title: item.tittel || item.beskrivelse || item.type, related, href };
    });
    const contracts = contractEvents.map(item => ({
      id: `contract-${item.id}`,
      date: item.created_at,
      type: "Kontrakt",
      title: `Kontrakt ${item.new_value === "Signert" ? "signert" : "sendt"} — ${item.entity_name}`,
      related: item.entity_name,
      href: `/salgsmuligheter?open=${item.entity_id}`,
    }));
    return [...normal, ...contracts].sort((a, b) => b.date.localeCompare(a.date));
  }, [activities, contractEvents, companyMap, contactMap, leadMap, dealMap, tomorrowStart]);

  const mrrData = useMemo(() => Array.from({ length: 6 }, (_, index) => {
    const month = subMonths(startOfMonth(now), 5 - index);
    const monthEnd = endOfMonth(month);
    const mrr = selskaper.filter(item => {
      const started = item.go_live_dato ? new Date(item.go_live_dato) <= monthEnd : false;
      const notCancelled = !item.kansellert_dato || new Date(item.kansellert_dato) > monthEnd;
      return started && notCancelled;
    }).reduce((sum, item) => sum + item.mrr, 0);
    return { month: format(month, "MMM", { locale: nb }), mrr };
  }), [selskaper]);

  const sourceData = useMemo(() => ["Inbound", "Outbound", "Partner", "Referanse"].map(source => ({
    source,
    count: leads.filter(item => kildeGruppe(item.kilde) === source).length,
  })), [leads]);

  return (
    <PageShell title="Dashboard" subtitle="Salg og kunder i sanntid">
      <GlobalSearch />

      <div className="space-y-6">
        <section>
          <h2 className="mb-3 text-sm font-semibold">Salg</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {salesKpis.map(item => <KpiCard key={item.label} {...item} onClick={() => navigate(item.href)} />)}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold">Kunder</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {customerKpis.map(item => <KpiCard key={item.label} {...item} onClick={() => navigate(item.href)} />)}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Section title="Krever handling nå" icon={AlertTriangle}>
            <div className="divide-y">
              {attention.map(item => (
                <Button key={item.label} variant="ghost" onClick={() => navigate(item.href)} className="h-auto w-full justify-between rounded-none px-4 py-3 text-left">
                  <span className="flex min-w-0 items-center gap-3"><item.icon className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="truncate font-normal">{item.label}</span></span>
                  <Badge variant={item.count > 0 ? "destructive" : "secondary"}>{item.count}</Badge>
                </Button>
              ))}
            </div>
          </Section>

          <div className="space-y-4">
            <Section title="Kommende aktiviteter" icon={CalendarDays} action={<Button variant="ghost" size="sm" onClick={() => navigate("/kalender")}>Se kalender</Button>}>
              {upcoming.length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted-foreground">Ingen kommende aktiviteter.</p> : (
                <div className="divide-y">
                  {upcoming.map(item => (
                    <Button key={item.id} variant="ghost" onClick={() => navigate(item.href)} className="h-auto w-full justify-start rounded-none px-4 py-3 text-left">
                      <span className="w-20 shrink-0 text-xs font-medium text-primary">{format(new Date(item.date), "d. MMM", { locale: nb })}</span>
                      <span className="min-w-0"><span className="block truncate font-medium">{item.title}</span>{item.related && <span className="block truncate text-xs font-normal text-muted-foreground">{item.related}</span>}</span>
                    </Button>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Dagens aktivitet" icon={Activity} action={<Button variant="ghost" size="sm" onClick={() => navigate("/aktiviteter")}>Se alle</Button>}>
              {timeline.length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted-foreground">Ingen aktiviteter registrert ennå i dag.</p> : (
                <div className="max-h-80 divide-y overflow-y-auto">
                  {timeline.map(item => {
                    const Icon = activityIcons[item.type] || Activity;
                    return (
                      <Button key={item.id} variant="ghost" onClick={() => item.href && navigate(item.href)} className="h-auto w-full justify-start rounded-none px-4 py-3 text-left">
                        <span className="w-12 shrink-0 text-xs tabular-nums text-muted-foreground">{format(new Date(item.date), "HH:mm")}</span>
                        <span className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-primary"><Icon className="h-4 w-4" /></span>
                        <span className="min-w-0"><span className="block truncate font-medium">{item.title}</span>{item.related && <span className="block truncate text-xs font-normal text-muted-foreground">{item.related}</span>}</span>
                      </Button>
                    );
                  })}
                </div>
              )}
            </Section>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Section title="MRR-utvikling siste 6 måneder" icon={TrendingUp}>
            <div className="h-72 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mrrData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={value => `${Math.round(value / 1000)}k`} />
                  <Tooltip formatter={(value: number) => [nok(value), "MRR"]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="mrr" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <Section title="Leads per kilde" icon={Users}>
            <div className="h-72 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sourceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="source" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" name="Leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
        </div>
      </div>
    </PageShell>
  );
}
