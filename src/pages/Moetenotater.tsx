import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, Building2, FileText, Save, ChevronDown, ChevronUp, Sparkles, ArrowRight, Loader2, Search, Filter, CalendarDays, Mic, MoreVertical, CheckCircle2, AlertCircle } from "lucide-react";
import MeetingNotesRenderer from "@/components/MeetingNotesRenderer";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const API_URL = import.meta.env.VITE_SUPABASE_URL + '/rest/v1';
const API_HEADERS = {
  'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
  'Content-Type': 'application/json',
};

interface Meeting {
  id: string;
  tittel: string | null;
  beskrivelse: string;
  moetenotater: string | null;
  dato: string;
  start_tid: string | null;
  slutt_tid: string | null;
  deltakere: string[] | null;
  lead_id: string | null;
  salgsmulighet_id: string | null;
  selskap_id: string | null;
  partner_id: string | null;
  prosjekt_id: string | null;
  kontakt_id: string | null;
  aktivitet_kilde: string | null;
}

interface RelatedEntity {
  id: string;
  name: string;
  type: string;
}

interface AiSummary {
  oppsummering: string;
  neste_steg: string[];
  kundesignal: string;
  foreslatt_neste_steg_tekst: string;
}

export default function Moetenotater() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [entities, setEntities] = useState<Record<string, RelatedEntity>>({});
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiSummaries, setAiSummaries] = useState<Record<string, AiSummary>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [noteFilter, setNoteFilter] = useState<"all" | "with" | "without">("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today">("all");

  const fetchMeetings = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_URL}/aktiviteter?type=eq.Møte&order=dato.desc&select=id,tittel,beskrivelse,moetenotater,dato,start_tid,slutt_tid,deltakere,lead_id,salgsmulighet_id,selskap_id,partner_id,prosjekt_id,kontakt_id,aktivitet_kilde`,
        { headers: API_HEADERS }
      );
      if (res.ok) setMeetings(await res.json());
    } catch (e) {
      console.error("Error fetching meetings:", e);
    }
  }, []);

  const fetchEntities = useCallback(async () => {
    const map: Record<string, RelatedEntity> = {};
    try {
      const [selskaper, leads, salg, partnere] = await Promise.all([
        fetch(`${API_URL}/selskaper?select=id,firmanavn`, { headers: API_HEADERS }).then(r => r.json()),
        fetch(`${API_URL}/leads?select=id,firmanavn`, { headers: API_HEADERS }).then(r => r.json()),
        fetch(`${API_URL}/salgsmuligheter?select=id,navn`, { headers: API_HEADERS }).then(r => r.json()),
        fetch(`${API_URL}/partnere?select=id,partnernavn`, { headers: API_HEADERS }).then(r => r.json()),
      ]);
      selskaper.forEach((s: any) => { map[s.id] = { id: s.id, name: s.firmanavn, type: "Selskap" }; });
      leads.forEach((l: any) => { map[l.id] = { id: l.id, name: l.firmanavn, type: "Lead" }; });
      salg.forEach((s: any) => { map[s.id] = { id: s.id, name: s.navn, type: "Salgsmulighet" }; });
      partnere.forEach((p: any) => { map[p.id] = { id: p.id, name: p.partnernavn, type: "Partner" }; });
      setEntities(map);
    } catch (e) {
      console.error("Error fetching entities:", e);
    }
  }, []);

  useEffect(() => { fetchMeetings(); fetchEntities(); }, [fetchMeetings, fetchEntities]);

  // Auto-åpne møte fra ?meeting=ID (fra globalt søk)
  useEffect(() => {
    const mid = searchParams.get("meeting");
    const action = searchParams.get("action"); // "notes" eller default expand
    if (!mid || meetings.length === 0) return;
    const m = meetings.find(x => x.id === mid);
    if (!m) return;
    if (action === "notes") {
      setSelectedMeeting(m);
      setNotes(m.moetenotater || "");
    } else {
      setExpandedId(m.id);
      // scroll til raden
      setTimeout(() => {
        document.getElementById(`meeting-row-${m.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
    // fjern query-param så den ikke trigger på nytt
    searchParams.delete("meeting");
    searchParams.delete("action");
    setSearchParams(searchParams, { replace: true });
  }, [meetings, searchParams, setSearchParams]);

  const getLinkedEntity = (m: Meeting): RelatedEntity | null => {
    const id = m.selskap_id || m.salgsmulighet_id || m.lead_id || m.partner_id;
    return id ? entities[id] || null : null;
  };

  const openNotes = (m: Meeting) => {
    setSelectedMeeting(m);
    setNotes(m.moetenotater || "");
  };

  const saveNotes = async () => {
    if (!selectedMeeting) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/aktiviteter?id=eq.${selectedMeeting.id}`, {
        method: 'PATCH',
        headers: { ...API_HEADERS, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ moetenotater: notes }),
      });
      if (res.ok) {
        toast.success("Møtenotater lagret");
        setMeetings(prev => prev.map(m => m.id === selectedMeeting.id ? { ...m, moetenotater: notes } : m));
        setSelectedMeeting(null);
      }
    } catch (e) {
      toast.error("Kunne ikke lagre notater");
    } finally {
      setSaving(false);
    }
  };

  const generateSummary = async (meeting: Meeting) => {
    if (!meeting.moetenotater?.trim()) {
      toast.error("Legg til møtenotater først");
      return;
    }
    setAiLoading(meeting.id);
    const linked = getLinkedEntity(meeting);
    try {
      const { data, error } = await supabase.functions.invoke("meeting-summary", {
        body: {
          meetingNotes: meeting.moetenotater,
          meetingTitle: meeting.tittel,
          dealName: linked?.type === "Salgsmulighet" ? linked.name : undefined,
          companyName: linked?.type === "Selskap" ? linked.name : undefined,
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setAiSummaries(prev => ({ ...prev, [meeting.id]: data as AiSummary }));
      setExpandedId(meeting.id);
      toast.success("AI-oppsummering klar");
    } catch (e: any) {
      console.error("AI summary error:", e);
      toast.error("Kunne ikke generere oppsummering");
    } finally {
      setAiLoading(null);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("no-NO", { day: "numeric", month: "short", year: "numeric" });
  const formatTime = (d: string | null) => d ? new Date(d).toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" }) : null;

  const entityOptions = Array.from(new Set(
    meetings.map(m => {
      const linked = getLinkedEntity(m);
      return linked ? linked.name : null;
    }).filter(Boolean) as string[]
  )).sort();

  const filteredMeetings = meetings.filter(m => {
    const linked = getLinkedEntity(m);
    const hasNotes = !!m.moetenotater?.trim();
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (m.tittel || "").toLowerCase().includes(q);
      const matchEntity = linked?.name.toLowerCase().includes(q);
      const matchNotes = (m.moetenotater || "").toLowerCase().includes(q);
      const matchBeskrivelse = (m.beskrivelse || "").toLowerCase().includes(q);
      if (!matchTitle && !matchEntity && !matchNotes && !matchBeskrivelse) return false;
    }
    if (noteFilter === "with" && !hasNotes) return false;
    if (noteFilter === "without" && hasNotes) return false;
    if (entityFilter !== "all") {
      if (!linked || linked.name !== entityFilter) return false;
    }
    if (dateFilter === "today") {
      const today = new Date().toISOString().split("T")[0];
      const meetingDate = new Date(m.dato).toISOString().split("T")[0];
      if (meetingDate !== today) return false;
    }
    return true;
  });

  const getStatusBadge = (m: Meeting) => {
    const hasNotes = !!m.moetenotater?.trim();
    const isTrale = m.aktivitet_kilde === "trale";
    const hasSummary = !!aiSummaries[m.id];
    const meetingStarted = m.start_tid
      ? new Date(m.start_tid) < new Date()
      : new Date(m.dato) < new Date();

    if (hasSummary) {
      return (
        <Badge className="text-[10px] gap-1 bg-primary/10 text-primary border-0 hover:bg-primary/20">
          <Sparkles className="w-2.5 h-2.5" /> AI-oppsummert
        </Badge>
      );
    }
    if (hasNotes) {
      return (
        <Badge variant="outline" className="text-[10px] gap-1 h-5 px-1.5">
          <FileText className="w-2.5 h-2.5" /> Notat
        </Badge>
      );
    }
    if (meetingStarted) {
      return (
        <Badge variant="destructive" className="text-[10px] gap-1 h-5 px-1.5">
          <AlertCircle className="w-2.5 h-2.5" /> Mangler notat
        </Badge>
      );
    }
    if (isTrale) {
      return (
        <Badge variant="outline" className="text-[10px] gap-1 bg-violet-500/10 text-violet-600 border-violet-200">
          <Mic className="w-2.5 h-2.5" /> Trale
        </Badge>
      );
    }
    return null;
  };

  return (
    <PageShell title="Møtenotater" subtitle="Oversikt over alle møter med notater og AI-oppsummeringer">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Søk i møter..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Select value={noteFilter} onValueChange={(v) => setNoteFilter(v as any)}>
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <Filter className="w-3 h-3 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Alle møter</SelectItem>
            <SelectItem value="with" className="text-xs">Med notater</SelectItem>
            <SelectItem value="without" className="text-xs">Uten notater</SelectItem>
          </SelectContent>
        </Select>
        {entityOptions.length > 0 && (
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <Building2 className="w-3 h-3 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Alle selskaper</SelectItem>
              {entityOptions.map(name => (
                <SelectItem key={name} value={name} className="text-xs">{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          size="sm"
          variant={dateFilter === "today" ? "default" : "outline"}
          className="h-8 text-xs gap-1.5"
          onClick={() => setDateFilter(dateFilter === "today" ? "all" : "today")}
        >
          <CalendarDays className="w-3 h-3" />
          I dag
        </Button>
        {(searchQuery || noteFilter !== "all" || entityFilter !== "all" || dateFilter !== "all") && (
          <span className="text-[10px] text-muted-foreground">{filteredMeetings.length} av {meetings.length} møter</span>
        )}
      </div>

      {filteredMeetings.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-8 text-center">
          {meetings.length === 0 ? "Ingen møter registrert ennå" : "Ingen møter matcher filteret"}
        </p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Møte</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground w-[160px]">Dato</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground w-[120px]">Status</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground w-[140px] text-right">Handlinger</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMeetings.map(m => {
                const linked = getLinkedEntity(m);
                const hasNotes = !!m.moetenotater?.trim();
                const isExpanded = expandedId === m.id;
                const summary = aiSummaries[m.id];
                const isLoadingAi = aiLoading === m.id;
                const isTrale = m.aktivitet_kilde === "trale";

                return (
                  <>
                    <TableRow
                      key={m.id}
                      id={`meeting-row-${m.id}`}
                      className="group cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => openNotes(m)}
                    >
                      <TableCell className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-medium truncate">{m.tittel || "Møte"}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {m.selskap_id && entities[m.selskap_id] && (
                            <Badge variant="secondary" className="text-[10px] gap-1 cursor-pointer hover:bg-secondary/80" onClick={(e) => { e.stopPropagation(); navigate(`/selskaper/${m.selskap_id}`); }}>
                              <Building2 className="w-2.5 h-2.5" />
                              {entities[m.selskap_id].name}
                            </Badge>
                          )}
                          {m.salgsmulighet_id && entities[m.salgsmulighet_id] && (
                            <Badge variant="outline" className="text-[10px] gap-1 bg-blue-500/10 text-blue-600 border-blue-200 cursor-pointer hover:bg-blue-500/20" onClick={(e) => { e.stopPropagation(); navigate(`/salgsmuligheter?id=${m.salgsmulighet_id}`); }}>
                              <ArrowRight className="w-2.5 h-2.5" />
                              {entities[m.salgsmulighet_id].name}
                            </Badge>
                          )}
                          {!m.selskap_id && !m.salgsmulighet_id && linked && (
                            <Badge variant="secondary" className="text-[10px] gap-1 cursor-pointer hover:bg-secondary/80" onClick={(e) => { e.stopPropagation(); navigate(linked.type === "selskap" ? `/selskaper/${linked.id}` : linked.type === "salgsmulighet" ? `/salgsmuligheter?id=${linked.id}` : `/leads?id=${linked.id}`); }}>
                              <Building2 className="w-2.5 h-2.5" />
                              {linked.name}
                            </Badge>
                          )}
                          {isTrale && (
                            <Badge variant="outline" className="text-[10px] gap-1 bg-violet-500/10 text-violet-600 border-violet-200">
                              <Mic className="w-2.5 h-2.5" /> Trale
                            </Badge>
                          )}
                          {m.deltakere && m.deltakere.length > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              {m.deltakere.length} deltaker{m.deltakere.length > 1 ? "e" : ""}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="text-xs font-medium">{formatDate(m.dato)}</div>
                        {m.start_tid && (
                          <div className="text-[11px] text-muted-foreground">
                            {formatTime(m.start_tid)}
                            {m.slutt_tid && ` – ${formatTime(m.slutt_tid)}`}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        {getStatusBadge(m)}
                      </TableCell>
                      <TableCell className="py-3 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {hasNotes && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              disabled={isLoadingAi}
                              onClick={() => generateSummary(m)}
                              title="AI-oppsummering"
                            >
                              {isLoadingAi ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> : <Sparkles className="w-3.5 h-3.5 text-primary" />}
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={() => openNotes(m)}>
                            {hasNotes ? "Rediger" : "+ Notat"}
                          </Button>
                          {(hasNotes || summary) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => setExpandedId(isExpanded ? null : m.id)}
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow key={`${m.id}-expanded`}>
                        <TableCell colSpan={4} className="p-0 border-b">
                          <div className="px-6 py-4 bg-muted/20 space-y-3">
                            {hasNotes && (
                              <div className="p-3 bg-background rounded-md border">
                                <MeetingNotesRenderer notes={m.moetenotater!} source={m.aktivitet_kilde} />
                              </div>
                            )}

                            {isLoadingAi && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                                <span>Genererer AI-oppsummering...</span>
                              </div>
                            )}

                            {summary && (
                              <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-2">
                                <div className="flex items-center gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                                  <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">AI-oppsummering</span>
                                  {summary.kundesignal && (
                                    <Badge variant="secondary" className="text-[10px] ml-auto">{summary.kundesignal}</Badge>
                                  )}
                                </div>
                                <p className="text-xs">{summary.oppsummering}</p>
                                {summary.neste_steg.length > 0 && (
                                  <div className="space-y-1">
                                    <span className="text-[10px] font-medium text-muted-foreground uppercase">Foreslåtte neste steg:</span>
                                    {summary.neste_steg.map((step, i) => (
                                      <div key={i} className="flex items-start gap-1.5 text-xs">
                                        <ArrowRight className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                                        <span>{step}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <MeetingDetailsDialog
        meeting={selectedMeeting}
        onClose={() => setSelectedMeeting(null)}
        notes={notes}
        setNotes={setNotes}
        saving={saving}
        onSave={saveNotes}
        linked={selectedMeeting ? getLinkedEntity(selectedMeeting) : null}
        summary={selectedMeeting ? aiSummaries[selectedMeeting.id] : undefined}
        isLoadingAi={selectedMeeting ? aiLoading === selectedMeeting.id : false}
        onGenerateSummary={() => selectedMeeting && generateSummary(selectedMeeting)}
        formatDate={formatDate}
        formatTime={formatTime}
      />
    </PageShell>
  );
}

// ---------- Trale-style meeting details dialog ----------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanParticipants(deltakere: string[] | null): string[] {
  if (!Array.isArray(deltakere)) return [];
  return deltakere
    .filter(d => d && typeof d === "string")
    .map(d => d.trim())
    .filter(d => d && d.toLowerCase() !== "null" && !UUID_RE.test(d));
}

function participantInitials(p: string): string {
  // email -> first letter of local part; "Name Surname" -> initials
  if (p.includes("@")) return p[0]?.toUpperCase() || "?";
  const parts = p.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

function participantLabel(p: string): string {
  if (p.includes("@")) return p.split("@")[0];
  return p;
}

function durationMinutes(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (isNaN(ms) || ms <= 0) return null;
  return Math.round(ms / 60000);
}

interface MeetingDetailsDialogProps {
  meeting: Meeting | null;
  onClose: () => void;
  notes: string;
  setNotes: (v: string) => void;
  saving: boolean;
  onSave: () => void;
  linked: RelatedEntity | null;
  summary?: AiSummary;
  isLoadingAi: boolean;
  onGenerateSummary: () => void;
  formatDate: (d: string) => string;
  formatTime: (d: string | null) => string | null;
}

function MeetingDetailsDialog({
  meeting, onClose, notes, setNotes, saving, onSave,
  linked, summary, isLoadingAi, onGenerateSummary, formatDate, formatTime,
}: MeetingDetailsDialogProps) {
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    // when opening a new meeting, reset editing state based on whether notes exist
    if (meeting) setEditing(!meeting.moetenotater?.trim());
  }, [meeting?.id]);

  if (!meeting) return null;

  const participants = cleanParticipants(meeting.deltakere);
  const isTrale = meeting.aktivitet_kilde === "trale";
  const duration = durationMinutes(meeting.start_tid, meeting.slutt_tid);
  const hasNotes = !!meeting.moetenotater?.trim();

  return (
    <Dialog open={!!meeting} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-xl font-semibold leading-tight pr-8">
              {meeting.tittel || "Møte"}
            </DialogTitle>
            <DialogDescription className="sr-only">Detaljer og notater for møtet</DialogDescription>

            {/* Participant avatars */}
            {participants.length > 0 && (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex -space-x-2">
                  {participants.slice(0, 5).map((p, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full bg-primary/10 border-2 border-background flex items-center justify-center text-[11px] font-semibold text-primary"
                      title={p}
                    >
                      {participantInitials(p)}
                    </div>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {participants.slice(0, 3).map(participantLabel).join(", ")}
                  {participants.length > 3 && ` +${participants.length - 3}`}
                </div>
              </div>
            )}

            {/* Meta row */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" />
                {formatDate(meeting.dato)}
                {meeting.start_tid && ` kl. ${formatTime(meeting.start_tid)}`}
              </span>
              {duration && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {duration} min
                </span>
              )}
              {participants.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {participants.length} deltaker{participants.length > 1 ? "e" : ""}
                </span>
              )}
              {linked && (
                <Badge variant="secondary" className="text-[10px] gap-1 h-5">
                  <Building2 className="w-2.5 h-2.5" />
                  {linked.name}
                </Badge>
              )}
              {isTrale && (
                <Badge variant="outline" className="text-[10px] gap-1 h-5 bg-violet-500/10 text-violet-600 border-violet-200">
                  <Mic className="w-2.5 h-2.5" /> Trale
                </Badge>
              )}
            </div>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* AI summary panel */}
          {summary && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wide text-primary">AI-oppsummering</span>
                {summary.kundesignal && (
                  <Badge variant="secondary" className="text-[10px] ml-auto">{summary.kundesignal}</Badge>
                )}
              </div>
              <p className="text-sm leading-relaxed">{summary.oppsummering}</p>
              {summary.neste_steg.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase">Foreslåtte neste steg</span>
                  {summary.neste_steg.map((step, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notes view or editor */}
          {hasNotes && !editing ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Møtenotater</h4>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1.5"
                    onClick={onGenerateSummary}
                    disabled={isLoadingAi}
                  >
                    {isLoadingAi
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                      : <Sparkles className="w-3.5 h-3.5 text-primary" />}
                    AI-oppsummering
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing(true)}>
                    Rediger
                  </Button>
                </div>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <MeetingNotesRenderer notes={meeting.moetenotater!} source={meeting.aktivitet_kilde} />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {hasNotes ? "Rediger møtenotater" : "Skriv møtenotater"}
              </h4>
              <Textarea
                placeholder="Skriv detaljerte møtenotater her... F.eks. hva ble diskutert, neste steg, kundens behov, beslutninger tatt..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={12}
                autoFocus
                className="text-sm leading-relaxed"
              />
              <div className="flex items-center gap-2">
                <Button onClick={onSave} className="gap-2 flex-1" disabled={saving}>
                  <Save className="w-4 h-4" />
                  {saving ? "Lagrer..." : "Lagre møtenotater"}
                </Button>
                {hasNotes && (
                  <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                    Avbryt
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
