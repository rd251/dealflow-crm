import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
                      className="group cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => (hasNotes || summary) && setExpandedId(isExpanded ? null : m.id)}
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

      <Dialog open={!!selectedMeeting} onOpenChange={open => !open && setSelectedMeeting(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Møtenotater – {selectedMeeting?.tittel || "Møte"}</DialogTitle>
            <DialogDescription>
              {selectedMeeting && formatDate(selectedMeeting.dato)}
              {selectedMeeting?.start_tid && ` kl. ${formatTime(selectedMeeting.start_tid)}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {selectedMeeting?.beskrivelse && (
              <div className="p-2 bg-muted/50 rounded text-xs text-muted-foreground overflow-hidden">
                <span className="font-medium">Beskrivelse:</span>
                <p className="mt-0.5 break-all line-clamp-3">{selectedMeeting.beskrivelse}</p>
              </div>
            )}
            <Textarea
              placeholder="Skriv detaljerte møtenotater her... F.eks. hva ble diskutert, neste steg, kundens behov, beslutninger tatt..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={10}
              autoFocus
            />
            <Button onClick={saveNotes} className="w-full gap-2" disabled={saving}>
              <Save className="w-4 h-4" />
              {saving ? "Lagrer..." : "Lagre møtenotater"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
