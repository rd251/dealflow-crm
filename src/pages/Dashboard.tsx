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
  BarChart3, ChevronRight, ListTodo, Activity, CheckCircle2,
} from "lucide-react";
import MeetingPrepPanel from "@/components/MeetingPrepPanel";
import FollowUpSection from "@/components/FollowUpSection";
import AiCommandBar from "@/components/AiCommandBar";
import { useFollowUps } from "@/hooks/use-follow-ups";
import { useProfiles } from "@/hooks/use-profiles";
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
  const { profiles } = useProfiles();
  const profileMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of profiles) map.set(p.user_id, p.display_name);
    return map;
  }, [profiles]);
  const today = now.toISOString().split("T")[0];
  const nok = (v: number) => v.toLocaleString("no-NO");

  // ─── MEETINGS STATE ───
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [entityNames, setEntityNames] = useState<Record<string, string>>({});
  const [prepMeeting, setPrepMeeting] = useState<MeetingItem | null>(null);
  const [oppgaver, setOppgaver] = useState<Tables<"oppgaver">[]>([]);
  const [crmEvents, setCrmEvents] = useState<Array<{ id: string; label: string; date: string; color: string }>>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      // Fetch upcoming tasks
      supabase
        .from("oppgaver")
        .select("*")
        .neq("status", "Ferdig")
        .order("frist", { ascending: true, nullsFirst: false })
        .limit(8)
        .then(({ data }) => { if (data) setOppgaver(data); });

      // Fetch CRM events: recent leads + salgsmuligheter status changes
      const events: Array<{ id: string; label: string; date: string; color: string }> = [];

      const [leadsRes, smRes] = await Promise.all([
        supabase.from("leads").select("id,firmanavn,status,created_at,konvertert_dato").order("created_at", { ascending: false }).limit(20),
        supabase.from("salgsmuligheter").select("id,navn,status,created_at,vunnet_dato,tapt_dato").order("created_at", { ascending: false }).limit(20),
      ]);

      if (leadsRes.data) {
        for (const l of leadsRes.data) {
          // Always show the "new lead" event
          events.push({ id: `l-new-${l.id}`, label: `Nytt lead: ${l.firmanavn}`, date: l.created_at, color: "bg-primary" });

          // Additionally show conversion/rejection as a separate event
          if (l.status === "Konvertert til salg") {
            const convDate = l.konvertert_dato || l.created_at;
            events.push({ id: `l-conv-${l.id}`, label: `${l.firmanavn} konvertert til salg`, date: convDate, color: "bg-emerald-500" });
          } else if (l.status === "Konvertert til partner") {
            const convDate = l.konvertert_dato || l.created_at;
            events.push({ id: `l-conv-${l.id}`, label: `${l.firmanavn} konvertert til partner`, date: convDate, color: "bg-emerald-500" });
          } else if (l.status === "Ikke aktuelt") {
            events.push({ id: `l-ia-${l.id}`, label: `Ikke aktuelt: ${l.firmanavn}`, date: l.created_at, color: "bg-muted-foreground" });
          }
        }
      }

      if (smRes.data) {
        for (const s of smRes.data) {
          if (s.status === "Vunnet") {
            events.push({ id: `sm-won-${s.id}`, label: `Vunnet: ${s.navn}`, date: s.vunnet_dato || s.created_at, color: "bg-emerald-500" });
          } else if (s.status === "Tapt") {
            events.push({ id: `sm-lost-${s.id}`, label: `Tapt: ${s.navn}`, date: s.tapt_dato || s.created_at, color: "bg-destructive" });
          } else {
            events.push({ id: `sm-new-${s.id}`, label: `Ny salgsmulighet: ${s.navn}`, date: s.created_at, color: "bg-amber-500" });
          }
        }
      }

      events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setCrmEvents(events.slice(0, 12));
    };
    fetchDashboardData();
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
      if (l.status === "Ikke aktuelt" || l.konvertert_til) return false;
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



  const formatDaysAgo = (dateStr: string) => {
    if (!dateStr) return "Aldri";
    const days = differenceInDays(now, new Date(dateStr));
    if (days === 0) return "I dag";
    if (days === 1) return "I går";
    return `${days}d siden`;
  };

  // ─── AI COMMAND CONTEXT ───
  const aiContext = useMemo(() => ({
    meetings: todayMeetings.map((m) => ({
      ...m,
      selskapNavn: m.selskap_id ? entityNames[m.selskap_id] || "—" : "—",
    })),
    followUps,
    salgsmuligheter: salgsmuligheter
      .filter((s) => s.status !== "Vunnet" && s.status !== "Tapt")
      .map((sm) => ({
        ...sm,
        selskapNavn: selskaper.find((s) => s.id === sm.selskap_id)?.firmanavn || "—",
      })),
    leads: leads.filter((l) => l.status !== "Ikke aktuelt" && l.status !== "Konvertert til salg" && l.status !== "Konvertert til partner"),
    oppgaver,
  }), [todayMeetings, followUps, salgsmuligheter, leads, oppgaver, selskaper, entityNames]);

  const { profiles: allProfiles } = useProfiles();
  const currentUserName = useMemo(() => {
    const userId = undefined; // will use auth
    return profiles.length > 0 ? profiles[0]?.display_name?.split(" ")[0] : undefined;
  }, [profiles]);

  return (
    <PageShell
      title=""
      subtitle=""
      actions={
        <button
          onClick={() => navigate("/rapporter")}
          className="flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
        >
          <BarChart3 className="w-4 h-4" /> Rapporter
        </button>
      }
    >

      {/* ─── AI COMMAND BAR (includes greeting) ─── */}
      <AiCommandBar context={aiContext} userName={currentUserName} />

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
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs hidden md:table-cell">Neste steg</th>
                </tr>
              </thead>
              <tbody>
                {nesteStegListe.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
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
                        <td className="px-4 py-2.5 hidden md:table-cell">
                          {sm.neste_steg ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/salgsmuligheter?open=${sm.id}`);
                              }}
                              className="text-xs font-medium text-primary hover:underline truncate max-w-[140px] block text-left"
                            >
                              {sm.neste_steg}
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
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
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        await supabase.from("oppgaver").update({ status: "Ferdig" }).eq("id", o.id);
                        setOppgaver((prev) => prev.filter((t) => t.id !== o.id));
                      }}
                      className="mt-0.5 shrink-0 w-4 h-4 rounded-full border-2 border-muted-foreground/40 hover:border-primary hover:bg-primary/10 transition-colors"
                      title="Merk som ferdig"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{o.oppgave}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {o.frist && (
                          <span className={`text-xs ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                            {isOverdue ? "Forfalt: " : ""}{format(new Date(o.frist), "d. MMM", { locale: nb })}
                          </span>
                        )}
                        {o.ansvarlig && (
                          <span className="text-xs text-muted-foreground">· {profileMap.get(o.ansvarlig) || o.ansvarlig}</span>
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
          {crmEvents.length === 0 ? (
            <p className="px-4 py-8 text-center text-muted-foreground text-sm">Ingen hendelser</p>
          ) : (
            <div className="divide-y">
              {crmEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="px-4 sm:px-6 py-3 flex items-start gap-3 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => {
                    const entityId = ev.id.replace(/^(l|sm)-[^-]+-/, "");
                    if (ev.id.startsWith("l-")) navigate(`/leads?open=${entityId}`);
                    else navigate(`/salgsmuligheter?open=${entityId}`);
                  }}
                >
                  <div className={`w-2.5 h-2.5 rounded-full ${ev.color} shrink-0 mt-1.5`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ev.label}</p>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(ev.date), "d. MMMM", { locale: nb })}
                    </span>
                  </div>
                </div>
              ))}
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
