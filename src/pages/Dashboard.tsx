import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { format, isToday, isTomorrow, differenceInDays, differenceInHours } from "date-fns";

import { nb } from "date-fns/locale";
import PageShell from "@/components/PageShell";
import FocusCard from "@/components/FocusCard";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { beregnTotalKontraktsverdi } from "@/data/crm-data";
import { nok } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, CalendarDays, PhoneOff, Target, Clock, Building2,
  BarChart3, ChevronRight, ListTodo, Activity, CheckCircle2, NotebookPen, Save, Plus,
  Users, Briefcase, Mail, AlertCircle, FileText, Sparkles, Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight } from "lucide-react";
import MeetingPrepPanel from "@/components/MeetingPrepPanel";
import DealHoverCard from "@/components/DealHoverCard";
import FollowUpSection from "@/components/FollowUpSection";
import AiCommandBar from "@/components/AiCommandBar";
import { useFollowUps } from "@/hooks/use-follow-ups";
import { useProfiles } from "@/hooks/use-profiles";
import { useAuth } from "@/hooks/use-auth";
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
  kontakt_id: string | null;
  ekstern_id: string | null;
  ekstern_provider: string | null;
  moetenotater: string | null;
  deltakere: string[] | null;
  ai_oppsummering?: AiSummary | null;
}

interface AiSummary { oppsummering: string; neste_steg: string[]; kundesignal: string; foreslatt_neste_steg_tekst: string; }

export default function Dashboard() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { selskaper, salgsmuligheter, leads, kontakter } = useCrmStore();
  const { user } = useAuth();

  const now = new Date();
  const { followUps, loading: followUpsLoading, dismiss: dismissFollowUp } = useFollowUps(leads, salgsmuligheter, selskaper);
  const { profiles } = useProfiles();
  const profileMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of profiles) map.set(p.user_id, p.display_name);
    return map;
  }, [profiles]);
  const today = now.toISOString().split("T")[0];
  

  // ─── MEETINGS STATE ───
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [entityNames, setEntityNames] = useState<Record<string, string>>({});
  const [prepMeeting, setPrepMeeting] = useState<MeetingItem | null>(null);
  const [notesMeeting, setNotesMeeting] = useState<MeetingItem | null>(null);
  const [notesText, setNotesText] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [oppgaver, setOppgaver] = useState<Tables<"oppgaver">[]>([]);
  const [changelogEntries, setChangelogEntries] = useState<Array<{ id: string; event_type: string; entity_type: string; entity_id: string; entity_name: string; field_name: string | null; old_value: string | null; new_value: string | null; related_entity_type: string | null; related_entity_name: string | null; user_id: string | null; created_at: string }>>([]);

  // ─── AI SUMMARY STATE ───
  const [aiSummaries, setAiSummaries] = useState<Record<string, AiSummary>>({});
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [expandedMeetingId, setExpandedMeetingId] = useState<string | null>(null);
  const [createdStepKeys, setCreatedStepKeys] = useState<Set<string>>(new Set());
  const [creatingStepKey, setCreatingStepKey] = useState<string | null>(null);

  const createTaskFromStep = useCallback(async (m: MeetingItem, step: string, idx: number) => {
    const key = `${m.id}-${idx}`;
    setCreatingStepKey(key);
    try {
      const { error } = await supabase.from("oppgaver").insert({
        oppgave: step,
        status: "Åpen",
        prioritet: "Medium",
        frist: new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0],
        selskap_id: m.selskap_id || null,
        salgsmulighet_id: m.salgsmulighet_id || null,
        user_id: user?.id || null,
      });
      if (error) throw error;
      setCreatedStepKeys(prev => new Set([...prev, key]));
      toast.success("Oppgave opprettet");
    } catch (e) {
      console.error("Create task error:", e);
      toast.error("Kunne ikke opprette oppgave");
    } finally {
      setCreatingStepKey(null);
    }
  }, [user?.id]);

  const generateMeetingSummary = useCallback(async (m: MeetingItem) => {
    if (!m.moetenotater?.trim()) {
      toast.error("Legg til møtenotater først");
      return;
    }
    setAiLoading(m.id);
    try {
      const { data, error } = await supabase.functions.invoke("meeting-summary", {
        body: {
          meetingNotes: m.moetenotater,
          meetingTitle: m.tittel,
          dealName: m.salgsmulighet_id ? entityNames[m.salgsmulighet_id] : undefined,
          companyName: m.selskap_id ? entityNames[m.selskap_id] : undefined,
        },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      const summary = data as AiSummary;
      setAiSummaries(prev => ({ ...prev, [m.id]: summary }));
      setExpandedMeetingId(m.id);
      // Persist to database so it survives reloads
      const { error: persistError } = await supabase
        .from("aktiviteter")
        .update({ ai_oppsummering: summary as any })
        .eq("id", m.id);
      if (persistError) console.error("Persist AI summary error:", persistError);
      toast.success("AI-oppsummering klar");
    } catch (e) {
      console.error("AI summary error:", e);
      toast.error("Kunne ikke generere oppsummering");
    } finally {
      setAiLoading(null);
    }
  }, [entityNames]);

  // ─── NEW MEETING STATE ───
  const [showNewMeeting, setShowNewMeeting] = useState(false);
  const [newMeeting, setNewMeeting] = useState({ tittel: "", dato: today, startTid: "09:00", sluttTid: "10:00", selskapId: "", salgsmulId: "" });
  const [creatingSaving, setCreatingSaving] = useState(false);

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

      // Fetch CRM changelog
      fetch(`${API_URL}/crm_changelog?order=created_at.desc&limit=5`, { headers: API_HEADERS })
        .then(r => r.ok ? r.json() : [])
        .then(data => setChangelogEntries(data))
        .catch(() => {});
    };
    fetchDashboardData();
  }, []);

  useEffect(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    fetch(
      `${API_URL}/aktiviteter?type=eq.Møte&dato=gte.${todayStart.toISOString()}&dato=lt.${weekEnd.toISOString()}&order=dato.asc,start_tid.asc&limit=20&select=id,tittel,beskrivelse,dato,start_tid,slutt_tid,selskap_id,salgsmulighet_id,kontakt_id,ekstern_id,ekstern_provider,moetenotater,deltakere,ai_oppsummering`,
      { headers: API_HEADERS }
    )
      .then((r) => (r.ok ? r.json() : []))
      .then((data: MeetingItem[]) => {
        setMeetings(data);
        // Hydrate cached AI summaries from database
        const cached: Record<string, AiSummary> = {};
        for (const m of data) {
          if (m.ai_oppsummering && typeof m.ai_oppsummering === "object") {
            cached[m.id] = m.ai_oppsummering as AiSummary;
          }
        }
        if (Object.keys(cached).length) setAiSummaries(prev => ({ ...cached, ...prev }));
        const sIds = [...new Set(data.map((d) => d.selskap_id).filter(Boolean))] as string[];
        const smIds = [...new Set(data.map((d) => d.salgsmulighet_id).filter(Boolean))] as string[];
        const kIds = [...new Set(data.map((d) => d.kontakt_id).filter(Boolean))] as string[];
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
            fetch(`${API_URL}/salgsmuligheter?id=in.(${smIds.join(",")})&select=id,navn,e_post,kontaktperson`, { headers: API_HEADERS })
              .then((r) => (r.ok ? r.json() : []))
              .then((rows: any[]) => rows.forEach((r) => (names[r.id] = r.navn)))
          );
        if (kIds.length)
          fetches.push(
            fetch(`${API_URL}/kontakter?id=in.(${kIds.join(",")})&select=id,navn,e_post`, { headers: API_HEADERS })
              .then((r) => (r.ok ? r.json() : []))
              .then((rows: any[]) => rows.forEach((r) => { names[`k_${r.id}`] = r.navn; if (r.e_post) names[`ke_${r.id}`] = r.e_post; }))
          );
        Promise.all(fetches).then(() => setEntityNames(names));
      })
      .catch(() => {});
  }, []);

  const saveNotes = useCallback(async () => {
    if (!notesMeeting) return;
    setNotesSaving(true);
    try {
      const res = await fetch(`${API_URL}/aktiviteter?id=eq.${notesMeeting.id}`, {
        method: 'PATCH',
        headers: { ...API_HEADERS, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ moetenotater: notesText }),
      });
      if (res.ok) {
        const { toast } = await import("sonner");
        toast.success("Møtenotater lagret");
        setMeetings(prev => prev.map(m => m.id === notesMeeting.id ? { ...m, moetenotater: notesText } : m));
        setNotesMeeting(null);
      }
    } catch {
      const { toast } = await import("sonner");
      toast.error("Kunne ikke lagre notater");
    } finally {
      setNotesSaving(false);
    }
  }, [notesMeeting, notesText]);

  const createMeeting = useCallback(async () => {
    if (!newMeeting.tittel.trim()) { toast.error("Legg til en tittel"); return; }
    setCreatingSaving(true);
    try {
      const datoStr = newMeeting.dato + "T00:00:00";
      const startStr = newMeeting.dato + "T" + newMeeting.startTid + ":00";
      const sluttStr = newMeeting.dato + "T" + newMeeting.sluttTid + ":00";
      const body: Record<string, any> = {
        type: "Møte",
        tittel: newMeeting.tittel,
        beskrivelse: "",
        dato: datoStr,
        start_tid: startStr,
        slutt_tid: sluttStr,
        user_id: user?.id || null,
      };
      if (newMeeting.selskapId) body.selskap_id = newMeeting.selskapId;
      if (newMeeting.salgsmulId) body.salgsmulighet_id = newMeeting.salgsmulId;
      const res = await fetch(`${API_URL}/aktiviteter`, {
        method: "POST",
        headers: { ...API_HEADERS, Prefer: "return=representation" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const [created] = await res.json();
        toast.success("Møte opprettet");
        setMeetings(prev => [...prev, created].sort((a, b) => new Date(a.dato).getTime() - new Date(b.dato).getTime()));
        setShowNewMeeting(false);
        setNewMeeting({ tittel: "", dato: today, startTid: "09:00", sluttTid: "10:00", selskapId: "", salgsmulId: "" });
      } else {
        toast.error("Kunne ikke opprette møte");
      }
    } catch {
      toast.error("Feil ved opprettelse");
    } finally {
      setCreatingSaving(false);
    }
  }, [newMeeting, user, today]);


  const leadsUtenOppfolging = useMemo(() => {
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return leads.filter((l) => {
      if (l.status === "Ikke aktuelt" || l.konvertert_til || l.konvertert_dato || l.status === "Konvertert til salg" || l.status === "Konvertert til partner") return false;
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

  // ─── SALGSMULIGHET-FOKUS ───
  const openSalg = useMemo(
    () => salgsmuligheter.filter((s) => s.status !== "Vunnet" && s.status !== "Tapt"),
    [salgsmuligheter]
  );

  const hotDeals = useMemo(() => {
    const cutoff30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return openSalg
      .filter((s) => s.forventet_lukkedato && new Date(s.forventet_lukkedato) <= cutoff30)
      .map((s) => ({
        ...s,
        selskapNavn: selskaper.find((x) => x.id === s.selskap_id)?.firmanavn || "—",
        verdi: beregnTotalKontraktsverdi(s),
      }))
      .sort((a, b) => b.verdi - a.verdi)
      .slice(0, 5);
  }, [openSalg, selskaper]);

  const trengerHandling = useMemo(() => {
    const cutoff48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    return openSalg
      .filter((s) => !s.sist_aktivitet || new Date(s.sist_aktivitet) < cutoff48h)
      .map((s) => ({
        ...s,
        selskapNavn: selskaper.find((x) => x.id === s.selskap_id)?.firmanavn || "—",
        daysSince: s.sist_aktivitet ? differenceInDays(now, new Date(s.sist_aktivitet)) : 999,
      }))
      .sort((a, b) => b.daysSince - a.daysSince)
      .slice(0, 5);
  }, [openSalg, selskaper]);

  const kontraktSendt = useMemo(
    () =>
      openSalg
        .filter((s) => s.status === "Kontrakt sendt")
        .map((s) => ({
          ...s,
          selskapNavn: selskaper.find((x) => x.id === s.selskap_id)?.firmanavn || "—",
          verdi: beregnTotalKontraktsverdi(s),
        }))
        .sort((a, b) => b.verdi - a.verdi),
    [openSalg, selskaper]
  );

  const pipelineByStage = useMemo(() => {
    const stages: Array<"Møte booket" | "Behov avklart" | "Løsning presentert" | "Kontrakt sendt"> = [
      "Møte booket", "Behov avklart", "Løsning presentert", "Kontrakt sendt",
    ];
    return stages.map((stage) => {
      const items = openSalg.filter((s) => s.status === stage);
      const verdi = items.reduce((sum, s) => sum + beregnTotalKontraktsverdi(s), 0);
      return { stage, count: items.length, verdi };
    });
  }, [openSalg]);

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



  const currentUserName = useMemo(() => {
    if (!user) return undefined;
    const profile = profiles.find((p) => p.user_id === user.id);
    return profile?.display_name?.split(" ")[0];
  }, [profiles, user]);

  // ─── AI COMMAND CONTEXT ───
  const aiContext = useMemo(() => ({
    user_id: user?.id,
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
    leads: leads.filter((l) => l.status !== "Ikke aktuelt" && l.status !== "Konvertert til salg" && l.status !== "Konvertert til partner" && !l.konvertert_til && !l.konvertert_dato),
    oppgaver,
    kontakter: kontakter.map((k) => ({ id: k.id, navn: k.navn, e_post: k.e_post, selskap_id: k.selskap_id })),
    selskaper: selskaper.map((s) => ({ id: s.id, firmanavn: s.firmanavn, kundestatus: s.kundestatus })),
  }), [user, todayMeetings, followUps, salgsmuligheter, leads, oppgaver, selskaper, entityNames, kontakter]);

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
                      onClick={() => navigate("/salgsmuligheter?filter=uten-aktivitet")}
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

        {/* ─── SALGSMULIGHET-FOKUS ─── */}
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Hot deals */}
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-destructive" />
                <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Hot deals</h3>
              </div>
              <Badge variant="secondary" className="text-[10px] h-5">{hotDeals.length}</Badge>
            </div>
            {hotDeals.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted-foreground">Ingen deals nær closing</p>
            ) : (
              <ul className="divide-y">
                {hotDeals.map((d) => (
                  <li
                    key={d.id}
                    className="px-4 py-2.5 hover:bg-muted/40 cursor-pointer transition-colors"
                    onClick={() => navigate(`/salgsmuligheter?open=${d.id}`)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{d.selskapNavn}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {d.navn} · {d.forventet_lukkedato ? format(new Date(d.forventet_lukkedato), "d. MMM", { locale: nb }) : "—"}
                        </div>
                      </div>
                      <div className="text-xs font-semibold text-foreground shrink-0">{nok(d.verdi)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Trenger handling */}
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Trenger handling</h3>
              </div>
              <Badge variant="secondary" className="text-[10px] h-5">{trengerHandling.length}</Badge>
            </div>
            {trengerHandling.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted-foreground">Alle deals er aktive</p>
            ) : (
              <ul className="divide-y">
                {trengerHandling.map((d) => (
                  <li
                    key={d.id}
                    className="px-4 py-2.5 hover:bg-muted/40 cursor-pointer transition-colors"
                    onClick={() => navigate(`/salgsmuligheter?open=${d.id}`)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{d.selskapNavn}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{d.status}</div>
                      </div>
                      <Badge variant="outline" className="text-[10px] h-5 shrink-0 border-amber-300 text-amber-700 dark:text-amber-400">
                        {d.daysSince >= 999 ? "Aldri" : `${d.daysSince}d`}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Kontrakt sendt */}
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Kontrakt sendt</h3>
              </div>
              <Badge variant="secondary" className="text-[10px] h-5">{kontraktSendt.length}</Badge>
            </div>
            {kontraktSendt.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted-foreground">Ingen kontrakter ute</p>
            ) : (
              <ul className="divide-y">
                {kontraktSendt.slice(0, 5).map((d) => (
                  <li
                    key={d.id}
                    className="px-4 py-2.5 hover:bg-muted/40 cursor-pointer transition-colors"
                    onClick={() => navigate(`/salgsmuligheter?open=${d.id}`)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{d.selskapNavn}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{d.navn}</div>
                      </div>
                      <div className="text-xs font-semibold text-foreground shrink-0">{nok(d.verdi)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ─── PIPELINE PER STADIUM ─── */}
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
          {pipelineByStage.map((p) => (
            <button
              key={p.stage}
              onClick={() => navigate(`/salgsmuligheter?status=${encodeURIComponent(p.stage)}`)}
              className="bg-card border rounded-xl px-4 py-3 text-left hover:border-primary/40 hover:shadow-sm transition-all"
            >
              <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground truncate">{p.stage}</div>
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <span className="text-xl font-semibold text-foreground">{p.count}</span>
                <span className="text-[11px] text-muted-foreground truncate">{nok(p.verdi)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ─── SECTION: OPPFØLGING ─── */}
      <FollowUpSection items={followUps} loading={followUpsLoading} onDismiss={dismissFollowUp} />

      {/* ─── KOMMENDE OPPGAVER (full width) ─── */}
      <div className="bg-card border rounded-xl overflow-hidden mb-6">
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
                      {o.selskap_id && selskaper.find(s => s.id === o.selskap_id) && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          · <Building2 className="w-3 h-3" /> {selskaper.find(s => s.id === o.selskap_id)?.firmanavn}
                        </span>
                      )}
                      {o.salgsmulighet_id && salgsmuligheter.find(sm => sm.id === o.salgsmulighet_id) && (
                        <span className="text-xs text-muted-foreground">· {salgsmuligheter.find(sm => sm.id === o.salgsmulighet_id)?.navn}</span>
                      )}
                      {o.lead_id && leads.find(l => l.id === o.lead_id) && (
                        <span className="text-xs text-muted-foreground">· {leads.find(l => l.id === o.lead_id)?.firmanavn}</span>
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

      {/* ─── NESTE STEG + ENDRINGSLOGG SIDE-BY-SIDE ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 items-start">
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

        {/* RIGHT: ENDRINGSLOGG */}
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Activity className="w-4 h-4" /> Endringslogg
            </h2>
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate("/aktiviteter")}>
              Se alle <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
          {changelogEntries.length === 0 ? (
            <p className="px-4 py-8 text-center text-muted-foreground text-sm">Ingen hendelser ennå</p>
          ) : (
            <div className="divide-y">
              {changelogEntries.map((entry) => {
                const eventColors: Record<string, string> = {
                  created: "bg-emerald-500", updated: "bg-blue-500", converted: "bg-violet-500",
                  linked: "bg-sky-500", completed: "bg-emerald-500", deleted: "bg-destructive",
                };
                const eventVerbs: Record<string, string> = {
                  created: "opprettet", updated: "endret", converted: "konverterte",
                  linked: "koblet", completed: "fullførte", deleted: "slettet",
                };
                const entLabels: Record<string, string> = {
                  selskap: "selskap", kontakt: "kontakt", salgsmulighet: "deal",
                  lead: "lead", partner: "partner", prosjekt: "prosjekt", oppgave: "oppgave",
                  epost: "e-post", møte: "møte",
                };
                const userName = entry.user_id && profileMap.get(entry.user_id)
                  ? profileMap.get(entry.user_id)!.split(" ")[0]
                  : null;
                const verb = eventVerbs[entry.event_type] || entry.event_type;
                const entType = entLabels[entry.entity_type] || entry.entity_type;
                let desc = `${userName ? userName + " " : ""}${verb} ${entType} '${entry.entity_name}'`;
                if (entry.event_type === "updated" && entry.field_name) {
                  desc = `${userName ? userName + " " : ""}${verb} ${entry.field_name} på '${entry.entity_name}'`;
                  if (entry.new_value) desc += ` → ${entry.new_value}`;
                }
                if (entry.event_type === "linked" && entry.related_entity_name) {
                  desc += ` → ${entry.related_entity_name}`;
                }

                let contextSelskap: string | null = null;
                let contextKontakt: string | null = null;
                if (entry.entity_type === "salgsmulighet") {
                  const sm = salgsmuligheter.find(s => s.id === entry.entity_id);
                  if (sm?.selskap_id) contextSelskap = selskaper.find(s => s.id === sm.selskap_id)?.firmanavn || null;
                  if (sm?.kontaktperson) contextKontakt = sm.kontaktperson;
                } else if (entry.entity_type === "lead") {
                  const lead = leads.find(l => l.id === entry.entity_id);
                  if (lead?.kontaktperson) contextKontakt = lead.kontaktperson;
                }
                const contextStr = [contextSelskap, contextKontakt].filter(Boolean).join(" · ");
                if (contextStr) desc += ` (${contextStr})`;

                return (
                  <div
                    key={entry.id}
                    className="px-4 sm:px-6 py-3 flex items-start gap-3 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => {
                      const path = entry.entity_type === "selskap" ? `/selskaper/${entry.entity_id}`
                        : entry.entity_type === "partner" ? `/partnere/${entry.entity_id}`
                        : entry.entity_type === "lead" ? `/leads`
                        : entry.entity_type === "salgsmulighet" ? `/salgsmuligheter`
                        : entry.entity_type === "kontakt" ? `/kontakter`
                        : entry.entity_type === "prosjekt" ? `/prosjekter`
                        : `/aktiviteter`;
                      navigate(path);
                    }}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full ${eventColors[entry.event_type] || "bg-muted-foreground"} shrink-0 mt-1.5`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{desc}</p>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(entry.created_at), "d. MMMM HH:mm", { locale: nb })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── MØTER (flyttet ned – salgsmuligheter er hovedfokus) ─── */}
      <div className="bg-card border rounded-xl overflow-hidden mb-6 mt-6">
        <div className="px-4 sm:px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <CalendarDays className="w-4 h-4" /> Møter
          </h2>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="text-xs gap-1 h-7" onClick={() => setShowNewMeeting(true)}>
              <Plus className="w-3 h-3" /> Møte
            </Button>
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate("/kalender")}>
              Kalender <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {meetings.length === 0 ? (
          <p className="px-4 py-8 text-center text-muted-foreground text-sm">Ingen kommende møter</p>
        ) : (
          <ul className="divide-y">
            {meetings.map((m) => {
              const meetDate = new Date(m.dato);
              const hasNotes = !!m.moetenotater?.trim();
              const meetingStarted = m.start_tid ? new Date(m.start_tid) < now : meetDate < now;
              const missingNotes = meetingStarted && !hasNotes;
              const summary = aiSummaries[m.id];
              const dateLabel = isToday(meetDate)
                ? "I dag"
                : isTomorrow(meetDate)
                  ? "I morgen"
                  : format(meetDate, "d. MMM", { locale: nb });
              const timeLabel = m.start_tid ? format(new Date(m.start_tid), "HH:mm") : null;

              return (
                <li
                  key={m.id}
                  className="flex items-center gap-3 px-4 sm:px-6 py-2 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => { setNotesMeeting(m); setNotesText(m.moetenotater || ""); }}
                >
                  <span className="text-sm font-medium truncate flex-1 min-w-0">
                    {m.tittel || m.beskrivelse || "Møte"}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                    {dateLabel}{timeLabel && ` · ${timeLabel}`}
                  </span>
                  <div className="shrink-0 w-[110px] flex justify-end">
                    {summary ? (
                      <Badge className="text-[10px] gap-1 bg-primary/10 text-primary border-0 hover:bg-primary/20">
                        <Sparkles className="w-2.5 h-2.5" /> AI
                      </Badge>
                    ) : missingNotes ? (
                      <Badge variant="destructive" className="text-[10px] gap-1 h-5 px-2 whitespace-nowrap">
                        <AlertCircle className="w-2.5 h-2.5 shrink-0" /> Mangler notat
                      </Badge>
                    ) : hasNotes ? (
                      <Badge variant="outline" className="text-[10px] gap-1 h-5 px-1.5">
                        <FileText className="w-2.5 h-2.5" /> Notat
                      </Badge>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>


      <MeetingPrepPanel
        meeting={prepMeeting}
        open={!!prepMeeting}
        onOpenChange={(open) => { if (!open) setPrepMeeting(null); }}
      />

      <Dialog open={!!notesMeeting} onOpenChange={open => { if (!open) setNotesMeeting(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Møtenotater – {notesMeeting?.tittel || "Møte"}</DialogTitle>
            <DialogDescription className="text-xs">
              {notesMeeting && format(new Date(notesMeeting.dato), "EEEE d. MMMM", { locale: nb })}
              {notesMeeting?.start_tid && ` kl. ${format(new Date(notesMeeting.start_tid), "HH:mm")}`}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Skriv detaljerte møtenotater..."
            value={notesText}
            onChange={e => setNotesText(e.target.value)}
            rows={8}
            autoFocus
          />
          <Button onClick={saveNotes} className="w-full gap-2" size="sm" disabled={notesSaving}>
            <Save className="w-3.5 h-3.5" />
            {notesSaving ? "Lagrer..." : "Lagre"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* ─── NEW MEETING DIALOG ─── */}
      <Dialog open={showNewMeeting} onOpenChange={setShowNewMeeting}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Nytt møte</DialogTitle>
            <DialogDescription className="text-xs">Opprett et nytt møte direkte fra dashboardet</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Tittel *</Label>
              <Input
                placeholder="F.eks. Demo med kunde"
                value={newMeeting.tittel}
                onChange={e => setNewMeeting(prev => ({ ...prev, tittel: e.target.value }))}
                className="h-8 text-sm"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Dato</Label>
                <Input
                  type="date"
                  value={newMeeting.dato}
                  onChange={e => setNewMeeting(prev => ({ ...prev, dato: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Fra</Label>
                <Input
                  type="time"
                  value={newMeeting.startTid}
                  onChange={e => setNewMeeting(prev => ({ ...prev, startTid: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Til</Label>
                <Input
                  type="time"
                  value={newMeeting.sluttTid}
                  onChange={e => setNewMeeting(prev => ({ ...prev, sluttTid: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Selskap (valgfritt)</Label>
              <Select value={newMeeting.selskapId} onValueChange={v => setNewMeeting(prev => ({ ...prev, selskapId: v }))}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Velg selskap" />
                </SelectTrigger>
                <SelectContent>
                  {selskaper.map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-sm">{s.firmanavn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Salgsmulighet (valgfritt)</Label>
              <Select value={newMeeting.salgsmulId} onValueChange={v => setNewMeeting(prev => ({ ...prev, salgsmulId: v }))}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Velg salgsmulighet" />
                </SelectTrigger>
                <SelectContent>
                  {salgsmuligheter.filter(s => s.status !== "Vunnet" && s.status !== "Tapt").map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-sm">{s.navn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={createMeeting} className="w-full gap-2" size="sm" disabled={creatingSaving}>
              <Plus className="w-3.5 h-3.5" />
              {creatingSaving ? "Oppretter..." : "Opprett møte"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
