import { useState, useEffect, useCallback } from "react";
import PageShell from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, Building2, FileText, Save, ChevronDown, ChevronUp, Sparkles, ArrowRight, Loader2, Search, Filter } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

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
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [entities, setEntities] = useState<Record<string, RelatedEntity>>({});
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiSummaries, setAiSummaries] = useState<Record<string, AiSummary>>({});

  const fetchMeetings = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_URL}/aktiviteter?type=eq.Møte&order=dato.desc&select=id,tittel,beskrivelse,moetenotater,dato,start_tid,slutt_tid,deltakere,lead_id,salgsmulighet_id,selskap_id,partner_id,prosjekt_id,kontakt_id`,
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

  return (
    <PageShell title="Møtenotater" subtitle="Detaljerte notater fra møter for bedre AI-kontekst">
      <div className="space-y-3">
        {meetings.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-8 text-center">Ingen møter registrert ennå</p>
        ) : (
          meetings.map(m => {
            const linked = getLinkedEntity(m);
            const hasNotes = !!m.moetenotater?.trim();
            const isExpanded = expandedId === m.id;
            const summary = aiSummaries[m.id];
            const isLoadingAi = aiLoading === m.id;
            return (
              <div key={m.id} className="border rounded-lg bg-card">
                <div className="p-4 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-amber-500/10 text-amber-600">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{m.tittel || "Møte"}</span>
                      {linked && (
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <Building2 className="w-2.5 h-2.5" />
                          {linked.name}
                        </Badge>
                      )}
                      {hasNotes ? (
                        <Badge variant="default" className="text-[10px] gap-1 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-0">
                          <FileText className="w-2.5 h-2.5" /> Notater
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
                          <FileText className="w-2.5 h-2.5" /> Ingen notater
                        </Badge>
                      )}
                      {summary && (
                        <Badge variant="default" className="text-[10px] gap-1 bg-primary/10 text-primary hover:bg-primary/20 border-0">
                          <Sparkles className="w-2.5 h-2.5" /> AI
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(m.dato)}
                        {m.start_tid && ` kl. ${formatTime(m.start_tid)}`}
                        {m.slutt_tid && `–${formatTime(m.slutt_tid)}`}
                      </span>
                    </div>
                    {m.beskrivelse && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{m.beskrivelse}</p>
                    )}

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="mt-3 space-y-3">
                        {hasNotes && (
                          <div className="p-3 bg-muted/50 rounded-md">
                            <p className="text-xs whitespace-pre-line">{m.moetenotater}</p>
                          </div>
                        )}

                        {/* AI Summary */}
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
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
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
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => openNotes(m)}>
                      {hasNotes ? "Rediger" : "Legg til notater"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

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
              <div className="p-2 bg-muted/50 rounded text-xs text-muted-foreground">
                <span className="font-medium">Beskrivelse:</span> {selectedMeeting.beskrivelse}
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
