import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, isToday, isTomorrow, differenceInDays, differenceInHours } from "date-fns";
import { nb } from "date-fns/locale";
import PageShell from "@/components/PageShell";
import FocusCard from "@/components/FocusCard";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { beregnTotalKontraktsverdi } from "@/data/crm-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, CalendarDays, PhoneOff, Target, Clock, Building2,
  DollarSign, TrendingUp, PieChart, BarChart3, ChevronRight, ListTodo, Activity, CheckCircle2,
} from "lucide-react";
import MeetingPrepPanel from "@/components/MeetingPrepPanel";
import FollowUpSection from "@/components/FollowUpSection";
import { useFollowUps } from "@/hooks/use-follow-ups";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

const API_URL = import.meta.env.VITE_SUPABASE_URL + "/rest/v1";
const API_HEADERS = {
  apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
  "Content-Type": "application/json",
};

interface MeetingItem {
  id: string;
  tittel: string;
  beskrivelse: string;
  dato: string;
  start_tid: string | null;
  slutt_tid: string | null;
  selskap_id: string | null;
  salgsmulighet_id: string | null;
  ekstern_id: string | null;
  ekstern_provider: string | null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { selskaper, salgsmuligheter, leads } = useCrmStore();

  const now = new Date();
  const { followUps, loading: followUpsLoading, dismiss: dismissFollowUp } = useFollowUps(leads, salgsmuligheter, selskaper);
  const today = now.toISOString().split("T")[0];
  const nok = (v: number) => v.toLocaleString("no-NO");

  // ─── MEETINGS STATE ───
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [entityNames, setEntityNames] = useState<Record<string, string>>({});
  const [prepMeeting, setPrepMeeting] = useState<MeetingItem | null>(null);
  const [oppgaver, setOppgaver] = useState<Tables<"oppgaver">[]>([]);
  const [aktiviteter, setAktiviteter] = useState<Tables<"aktiviteter">[]>([]);
  const [activityNames, setActivityNames] = useState<Record<string, string>>({});

  useEffect(() => {
    // Fetch upcoming tasks
    supabase
      .from("oppgaver")
      .select("*")
      .neq("status", "Ferdig")
      .order("frist", { ascending: true, nullsFirst: false })
      .limit(8)
      .then(({ data }) => { if (data) setOppgaver(data); });

    // Fetch recent activities (exclude meetings – shown in Møter section)
    supabase
      .from("aktiviteter")
      .select("*")
      .neq("type", "Møte")
      .order("dato", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) {
          setAktiviteter(data);
          // Resolve selskap names for activities
          const actSelskapIds = [...new Set(data.map(a => a.selskap_id).filter(Boolean))] as string[];
          const actLeadIds = [...new Set(data.map(a => a.lead_id).filter(Boolean))] as string[];
          const actSmIds = [...new Set(data.map(a => a.salgsmulighet_id).filter(Boolean))] as string[];
          const fetches: Array<Promise<void> | PromiseLike<void>> = [];
          const names: Record<string, string> = {};
          if (actSelskapIds.length)
            fetches.push(
              supabase.from("selskaper").select("id,firmanavn").in("id", actSelskapIds)
                .then(({ data: rows }) => rows?.forEach(r => names[r.id] = r.firmanavn))
            );
          if (actLeadIds.length)
            fetches.push(
              supabase.from("leads").select("id,firmanavn").in("id", actLeadIds)
                .then(({ data: rows }) => rows?.forEach(r => names[r.id] = r.firmanavn))
            );
          if (actSmIds.length)
            fetches.push(
              supabase.from("salgsmuligheter").select("id,navn").in("id", actSmIds)
                .then(({ data: rows }) => rows?.forEach(r => names[r.id] = r.navn))
            );
          Promise.all(fetches).then(() => setActivityNames(names));
        }
      });
  }, []);

  useEffect(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    fetch(
      `${API_URL}/aktiviteter?type=eq.Møte&dato=gte.${todayStart.toISOString()}&dato=lt.${weekEnd.toISOString()}&order=dato.asc,start_tid.asc&limit=20&select=id,tittel,beskrivelse,dato,start_tid,slutt_tid,selskap_id,salgsmulighet_id,ekstern_id,ekstern_provider`,
      { headers: API_HEADERS }
    )
      .then((r) => (r.ok ? r.json() : []))
      .then((data: MeetingItem[]) => {
        setMeetings(data);
        const sIds = [...new Set(data.map((d) => d.selskap_id).filter(Boolean))] as string[];
        const smIds = [...new Set(data.map((d) => d.salgsmulighet_id).filter(Boolean))] as string[];
        const names: Record<string, string> = {};
        const fetches: Promise<void>[] = [];
        if (sIds.length)
          fetches.push(
            fetch(`${API_URL}/selskaper?id=in.(${sIds.join(",")})&select=id,firmanavn`, { headers: API_HEADERS })
              .then((r) => (r.ok ? r.json() : []))
              .then((rows: any[]) => rows.forEach((r) => (names[r.id] = r.firmanavn)))
          );
        if (smIds.length)
          fetches.push(
            fetch(`${API_URL}/salgsmuligheter?id=in.(${smIds.join(",")})&select=id,navn`, { headers: API_HEADERS })
              .then((r) => (r.ok ? r.json() : []))
              .then((rows: any[]) => rows.forEach((r) => (names[r.id] = r.navn)))
          );
        Promise.all(fetches).then(() => setEntityNames(names));
      })
      .catch(() => {});
  }, []);

  // ─── SECTION 1: FOKUS I DAG ───
  const leadsUtenOppfolging = useMemo(() => {
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return leads.filter((l) => {
      if (l.status === "Ikke aktuelt" || l.status === "Konvertert til salg" || l.status === "Konvertert til partner") return false;
      if (!l.sist_aktivitet) return true;
      return new Date(l.sist_aktivitet) < cutoff;
    });
  }, [leads]);

  const smUtenAktivitet = useMemo(() => {
    const cutoff = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    return salgsmuligheter.filter((s) => {
      if (s.status === "Vunnet" || s.status === "Tapt") return false;
      if (!s.sist_aktivitet) return true;
      return new Date(s.sist_aktivitet) < cutoff;
    });
  }, [salgsmuligheter]);

  const moterIdag = useMemo(() => meetings.filter((m) => isToday(new Date(m.dato))), [meetings]);

  const smNearClosing = useMemo(() => {
    const cutoff14 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const cutoff3days = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    return salgsmuligheter.filter((s) => {
      if (s.status === "Vunnet" || s.status === "Tapt") return false;
      if (!s.forventet_lukkedato) return false;
      const closeDate = new Date(s.forventet_lukkedato);
      if (closeDate > cutoff14) return false;
      if (!s.sist_aktivitet) return true;
      return new Date(s.sist_aktivitet) < cutoff3days;
    });
  }, [salgsmuligheter]);

  // ─── SECTION 2: NESTE STEG ───
  const nesteStegListe = useMemo(() => {
    const open = salgsmuligheter.filter((s) => s.status !== "Vunnet" && s.status !== "Tapt");
    return open
      .map((sm) => {
        const selskap = selskaper.find((s) => s.id === sm.selskap_id);
        return { ...sm, selskapNavn: selskap?.firmanavn || "—" };
      })
      .sort((a, b) => {
        // Least recent activity first
        const aDate = a.sist_aktivitet ? new Date(a.sist_aktivitet).getTime() : 0;
        const bDate = b.sist_aktivitet ? new Date(b.sist_aktivitet).getTime() : 0;
        if (aDate !== bDate) return aDate - bDate;
        // Then highest value
        return beregnTotalKontraktsverdi(b) - beregnTotalKontraktsverdi(a);
      })
      .slice(0, 15);
  }, [salgsmuligheter, selskaper]);

  // ─── SECTION 3: MØTER ───
  const todayMeetings = useMemo(() => meetings.filter((m) => isToday(new Date(m.dato))), [meetings]);
  const upcomingMeetings = useMemo(
    () => meetings.filter((m) => !isToday(new Date(m.dato))),
    [meetings]
  );

  const getMeetingStatus = (m: MeetingItem) => {
    // Check if selskap has recent activity
    if (m.selskap_id) {
      const selskap = selskaper.find((s) => s.id === m.selskap_id);
      if (selskap?.sist_aktivitet) {
        const days = differenceInDays(now, new Date(selskap.sist_aktivitet));
        if (days <= 3) return { label: "Klar", color: "bg-emerald-500/10 text-emerald-600 border-emerald-200" };
      }
    }
    return { label: "Trenger oppfølging", color: "bg-amber-500/10 text-amber-600 border-amber-200" };
  };

  // ─── SECTION 4: KPI ───
  const liveSelskaper = selskaper.filter((s) => s.kundestatus === "Live");
  const totalMRR = liveSelskaper.reduce((sum, s) => sum + s.mrr, 0);
  const openSm = salgsmuligheter.filter((s) => s.status !== "Vunnet" && s.status !== "Tapt");
  const pipelineVerdi = openSm.reduce((sum, s) => sum + beregnTotalKontraktsverdi(s), 0);

  const allClosed = salgsmuligheter.filter((s) => s.status === "Vunnet" || s.status === "Tapt");
  const wonCount = salgsmuligheter.filter((s) => s.status === "Vunnet").length;
  const winRate = allClosed.length > 0 ? Math.round((wonCount / allClosed.length) * 100) : 0;

  const kansellert = selskaper.filter((s) => s.kundestatus === "Kansellert").length;
  const totalKunder = selskaper.filter((s) => ["Live", "Kansellert"].includes(s.kundestatus)).length;
  const churnRate = totalKunder > 0 ? Math.round((kansellert / totalKunder) * 100) : 0;

  const formatDaysAgo = (dateStr: string) => {
    if (!dateStr) return "Aldri";
    const days = differenceInDays(now, new Date(dateStr));
    if (days === 0) return "I dag";
    if (days === 1) return "I går";
    return `${days}d siden`;
  };

  return (
    <PageShell
      title="Dashboard"
      subtitle="Hva bør du gjøre nå?"
      actions={
        <button
          onClick={() => navigate("/rapporter")}
          className="flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
        >
          <BarChart3 className="w-4 h-4" /> Rapporter
        </button>
      }
    >
      {/* ─── SECTION 4: KPI MINIMAL ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "MRR", value: `${nok(totalMRR)}`, icon: <DollarSign className="w-4 h-4" /> },
          { label: "Pipeline", value: `${nok(pipelineVerdi)}`, icon: <TrendingUp className="w-4 h-4" /> },
          { label: "Win rate", value: `${winRate}%`, icon: <Target className="w-4 h-4" /> },
          { label: "Churn", value: `${churnRate}%`, icon: <PieChart className="w-4 h-4" /> },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card border rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="text-muted-foreground">{kpi.icon}</div>
            <div>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="text-lg font-bold tracking-tight">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ─── SECTION 1: FOKUS I DAG ─── */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Fokus i dag</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <FocusCard
            icon={<PhoneOff className="w-5 h-5" />}
            label="Leads uten oppfølging"
            count={leadsUtenOppfolging.length}
            color={leadsUtenOppfolging.length > 0 ? "text-destructive" : "text-muted-foreground"}
            onClick={() => navigate("/leads?filter=uten-oppfolging")}
          />
          <FocusCard
            icon={<AlertTriangle className="w-5 h-5" />}
            label="Salg uten aktivitet"
            count={smUtenAktivitet.length}
            color={smUtenAktivitet.length > 0 ? "text-amber-600" : "text-muted-foreground"}
                      onClick={() => navigate("/salgsmuligheter")}
          />
          <FocusCard
            icon={<CalendarDays className="w-5 h-5" />}
            label="Møter i dag"
            count={moterIdag.length}
            color="text-primary"
            onClick={() => navigate("/kalender")}
          />
          <FocusCard
            icon={<Target className="w-5 h-5" />}
            label="Nær closing uten aktivitet"
            count={smNearClosing.length}
            color={smNearClosing.length > 0 ? "text-destructive" : "text-muted-foreground"}
            onClick={() => navigate("/salgsmuligheter")}
          />
        </div>
      </div>

      {/* ─── SECTION: OPPFØLGING ─── */}
      <FollowUpSection items={followUps} loading={followUpsLoading} onDismiss={dismissFollowUp} />

      {/* ─── TWO-COLUMN LAYOUT ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* LEFT: NESTE STEG */}
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Neste steg</h2>
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate("/salgsmuligheter")}>
              Se alle <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Selskap</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Salgsmulighet</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs hidden sm:table-cell">MRR</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Sist aktiv</th>
                </tr>
              </thead>
              <tbody>
                {nesteStegListe.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      Ingen åpne salgsmuligheter
                    </td>
                  </tr>
                ) : (
                  nesteStegListe.slice(0, 10).map((sm) => {
                    const daysAgo = sm.sist_aktivitet ? differenceInDays(now, new Date(sm.sist_aktivitet)) : 999;
                    const isStale = daysAgo >= 3;
                    return (
                      <tr
                        key={sm.id}
                        onClick={() => navigate(`/salgsmuligheter?open=${sm.id}`)}
                        className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-2.5 font-medium truncate max-w-[140px]">{sm.selskapNavn}</td>
                        <td className="px-4 py-2.5 truncate max-w-[140px]">{sm.navn}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums hidden sm:table-cell">
                          {nok(sm.forventet_mrr)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs font-medium ${isStale ? "text-destructive" : "text-muted-foreground"}`}>
                            {formatDaysAgo(sm.sist_aktivitet)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT: MØTER */}
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Møter</h2>
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate("/kalender")}>
              Kalender <ChevronRight className="w-3 h-3" />
            </Button>
          </div>

          {meetings.length === 0 ? (
            <p className="px-4 py-8 text-center text-muted-foreground text-sm">Ingen kommende møter</p>
          ) : (
            <div className="divide-y">
              {todayMeetings.length > 0 && (
                <div className="px-4 sm:px-6 py-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    I dag – {format(now, "EEEE d. MMMM", { locale: nb })}
                  </p>
                  <div className="space-y-2">
                    {todayMeetings.map((m) => {
                      const status = getMeetingStatus(m);
                      return (
                        <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{m.tittel || m.beskrivelse || "Møte"}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {m.selskap_id && entityNames[m.selskap_id] && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Building2 className="w-3 h-3" />
                                  {entityNames[m.selskap_id]}
                                </span>
                              )}
                              {m.start_tid && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {format(new Date(m.start_tid), "HH:mm")}
                                  {m.slutt_tid && ` – ${format(new Date(m.slutt_tid), "HH:mm")}`}
                                </span>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline" className={`text-[10px] shrink-0 ${status.color}`}>
                            {status.label}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7 shrink-0 hidden sm:flex"
                            onClick={(e) => { e.stopPropagation(); setPrepMeeting(m); }}
                          >
                            Prep
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {upcomingMeetings.length > 0 && (
                <div className="px-4 sm:px-6 py-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Kommende</p>
                  <div className="space-y-2">
                    {upcomingMeetings.map((m) => {
                      const status = getMeetingStatus(m);
                      const meetDate = new Date(m.dato);
                      return (
                        <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{m.tittel || m.beskrivelse || "Møte"}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {m.selskap_id && entityNames[m.selskap_id] && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Building2 className="w-3 h-3" />
                                  {entityNames[m.selskap_id]}
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {isTomorrow(meetDate)
                                  ? "I morgen"
                                  : format(meetDate, "EEEE d. MMM", { locale: nb })}
                              </span>
                              {m.start_tid && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {format(new Date(m.start_tid), "HH:mm")}
                                </span>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline" className={`text-[10px] shrink-0 ${status.color}`}>
                            {status.label}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7 shrink-0 hidden sm:flex"
                            onClick={(e) => { e.stopPropagation(); setPrepMeeting(m); }}
                          >
                            Prep
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── ROW 2: OPPGAVER + AKTIVITET SIDE-BY-SIDE ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* LEFT: KOMMENDE OPPGAVER */}
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <ListTodo className="w-4 h-4" /> Kommende oppgaver
            </h2>
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate("/oppgaver")}>
              Se alle <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
          {oppgaver.length === 0 ? (
            <p className="px-4 py-8 text-center text-muted-foreground text-sm">Ingen åpne oppgaver</p>
          ) : (
            <div className="divide-y">
              {oppgaver.map((o) => {
                const isOverdue = o.frist && new Date(o.frist) < now;
                const prioritetColor = o.prioritet === "Høy" ? "text-destructive" : o.prioritet === "Medium" ? "text-amber-600" : "text-muted-foreground";
                return (
                  <div
                    key={o.id}
                    onClick={() => navigate("/oppgaver")}
                    className="px-4 sm:px-6 py-3 flex items-start gap-3 hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${prioritetColor}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{o.oppgave}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {o.frist && (
                          <span className={`text-xs ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                            {isOverdue ? "Forfalt: " : ""}{format(new Date(o.frist), "d. MMM", { locale: nb })}
                          </span>
                        )}
                        {o.ansvarlig && (
                          <span className="text-xs text-muted-foreground">· {o.ansvarlig}</span>
                        )}
                        {o.prioritet && (
                          <Badge variant="outline" className={`text-[10px] ${prioritetColor}`}>
                            {o.prioritet}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: SISTE AKTIVITET */}
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Activity className="w-4 h-4" /> Siste aktivitet
            </h2>
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate("/aktiviteter")}>
              Se alle <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
          {aktiviteter.length === 0 ? (
            <p className="px-4 py-8 text-center text-muted-foreground text-sm">Ingen aktiviteter</p>
          ) : (
            <div className="divide-y">
              {aktiviteter.map((a) => {
                const entityName = a.lead_id ? activityNames[a.lead_id]
                  : a.selskap_id ? activityNames[a.selskap_id]
                  : a.salgsmulighet_id ? activityNames[a.salgsmulighet_id]
                  : null;
                const label = a.tittel || a.beskrivelse || "Aktivitet";
                const displayText = entityName ? `${label}: ${entityName}` : label;
                return (
                  <div
                    key={a.id}
                    onClick={() => navigate("/aktiviteter")}
                    className="px-4 sm:px-6 py-3 flex items-start gap-3 hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 mt-1.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{displayText}</p>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(a.dato), "d. MMMM", { locale: nb })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <MeetingPrepPanel
        meeting={prepMeeting}
        open={!!prepMeeting}
        onOpenChange={(open) => { if (!open) setPrepMeeting(null); }}
      />
    </PageShell>
  );
}
