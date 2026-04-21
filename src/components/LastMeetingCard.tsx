import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Mic, NotebookPen, Sparkles, Loader2, ListChecks, Plus, Check, Calendar, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import MeetingNotesRenderer from "@/components/MeetingNotesRenderer";

interface LastMeeting {
  id: string;
  tittel: string | null;
  dato: string;
  moetenotater: string;
  aktivitet_kilde: string | null;
  ai_oppsummering: any;
}

interface FollowupSuggestion {
  sammendrag: string;
  hovedpunkter: string[];
  kundesignal: "Høy" | "Medium" | "Lav" | "Ukjent";
  foreslatt_oppgave: {
    tittel: string;
    frist_dager: number;
    prioritet: "Lav" | "Medium" | "Høy";
  };
  generert_dato: string;
}

interface Props {
  salgsmulighetId: string;
  selskapId?: string | null;
  kontaktId?: string | null;
  ansvarlig?: string | null;
  ansvarligUserId?: string | null;
}

const signalStyles: Record<FollowupSuggestion["kundesignal"], string> = {
  "Høy": "bg-success/15 text-success border-success/30",
  "Medium": "bg-warning/15 text-warning border-warning/30",
  "Lav": "bg-destructive/15 text-destructive border-destructive/30",
  "Ukjent": "bg-muted text-muted-foreground border-border",
};

export default function LastMeetingCard({ salgsmulighetId, selskapId, kontaktId, ansvarlig, ansvarligUserId }: Props) {
  const [meeting, setMeeting] = useState<LastMeeting | null>(null);
  const [suggestion, setSuggestion] = useState<FollowupSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskCreated, setTaskCreated] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  const fetchLatestMeeting = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("aktiviteter")
        .select("id, tittel, dato, moetenotater, aktivitet_kilde, ai_oppsummering")
        .eq("salgsmulighet_id", salgsmulighetId)
        .eq("type", "Møte")
        .not("moetenotater", "is", null)
        .order("dato", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data && data.moetenotater?.trim()) {
        setMeeting(data as LastMeeting);
        const ai = data.ai_oppsummering as unknown as FollowupSuggestion | null;
        if (ai && ai.foreslatt_oppgave) {
          setSuggestion(ai);
        } else {
          setSuggestion(null);
        }
      } else {
        setMeeting(null);
        setSuggestion(null);
      }
    } catch (e) {
      console.error("LastMeetingCard fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [salgsmulighetId]);

  useEffect(() => {
    setTaskCreated(false);
    fetchLatestMeeting();
  }, [fetchLatestMeeting]);

  // Auto-generer hvis møte har notater men ingen forslag
  useEffect(() => {
    if (meeting && !suggestion && !aiLoading && meeting.moetenotater.trim().length > 30) {
      generateSuggestion(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting?.id]);

  const generateSuggestion = async (silent = false) => {
    if (!meeting) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("meeting-followup-suggest", {
        body: { aktivitet_id: meeting.id, force: !silent },
      });
      if (error) throw error;
      if (data?.suggestion) {
        setSuggestion(data.suggestion);
        if (!silent) toast.success("Forslag oppdatert");
      } else if (data?.error) {
        if (!silent) toast.error(data.error);
      }
    } catch (e) {
      if (!silent) toast.error("Kunne ikke generere forslag");
      console.error(e);
    } finally {
      setAiLoading(false);
    }
  };

  const createTaskFromSuggestion = async () => {
    if (!suggestion || !meeting) return;
    setCreatingTask(true);
    try {
      // Beregn frist (virkedager)
      const frist = new Date();
      let added = 0;
      const target = Math.max(1, Math.min(14, suggestion.foreslatt_oppgave.frist_dager));
      while (added < target) {
        frist.setDate(frist.getDate() + 1);
        const day = frist.getDay();
        if (day !== 0 && day !== 6) added++;
      }
      const fristStr = frist.toISOString().split("T")[0];

      const { error } = await supabase.from("oppgaver").insert({
        oppgave: suggestion.foreslatt_oppgave.tittel,
        frist: fristStr,
        prioritet: suggestion.foreslatt_oppgave.prioritet,
        status: "Åpen",
        ansvarlig: ansvarlig || "",
        user_id: ansvarligUserId || null,
        salgsmulighet_id: salgsmulighetId,
        selskap_id: selskapId || null,
        kontakt_id: kontaktId || null,
        notater: `Foreslått av AI etter møte: ${meeting.tittel || "Møte"} (${formatDate(meeting.dato)})`,
      });
      if (error) throw error;
      setTaskCreated(true);
      toast.success("Oppgave opprettet");
    } catch (e) {
      console.error(e);
      toast.error("Kunne ikke opprette oppgave");
    } finally {
      setCreatingTask(false);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("no-NO", { day: "numeric", month: "short", year: "numeric" });
  const daysSince = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000);

  if (loading) {
    return (
      <div className="rounded-xl border bg-muted/20 p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Henter siste møte…
        </div>
      </div>
    );
  }

  if (!meeting) return null;

  const days = daysSince(meeting.dato);
  const isTrale = meeting.aktivitet_kilde === "trale";

  return (
    <>
      <div className="rounded-xl border bg-gradient-to-br from-warning/5 to-warning/0 p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <NotebookPen className="w-4 h-4 text-warning" />
            <h3 className="text-sm font-semibold">Siste møte</h3>
            {isTrale && (
              <Badge variant="outline" className="text-[10px] gap-1 bg-primary/10 text-primary border-primary/30 px-1.5 py-0">
                <Mic className="w-2.5 h-2.5" />Trale
              </Badge>
            )}
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(meeting.dato)} · {days === 0 ? "i dag" : `${days}d siden`}
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => setNotesOpen(true)}
          >
            Vis full notat <ChevronRight className="w-3 h-3 ml-0.5" />
          </Button>
        </div>

        {meeting.tittel && (
          <p className="text-xs font-medium text-foreground">{meeting.tittel}</p>
        )}

        {/* AI sammendrag */}
        {aiLoading && !suggestion && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
            <Sparkles className="w-3.5 h-3.5 animate-pulse text-primary" />
            Genererer sammendrag…
          </div>
        )}

        {suggestion && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <Sparkles className="w-3 h-3 text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">AI-sammendrag</span>
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border", signalStyles[suggestion.kundesignal])}>
                {suggestion.kundesignal} interesse
              </Badge>
            </div>
            <p className="text-sm leading-relaxed">{suggestion.sammendrag}</p>

            {suggestion.hovedpunkter && suggestion.hovedpunkter.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {suggestion.hovedpunkter.slice(0, 5).map((p, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px] font-normal px-1.5 py-0">{p}</Badge>
                ))}
              </div>
            )}

            {/* Foreslått oppgave */}
            <div className="rounded-lg bg-background/60 border p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <ListChecks className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    Foreslått oppfølgingsoppgave
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] px-1.5 py-0",
                    suggestion.foreslatt_oppgave.prioritet === "Høy" && "border-destructive/40 text-destructive",
                    suggestion.foreslatt_oppgave.prioritet === "Medium" && "border-warning/40 text-warning",
                    suggestion.foreslatt_oppgave.prioritet === "Lav" && "border-muted-foreground/30 text-muted-foreground",
                  )}
                >
                  {suggestion.foreslatt_oppgave.prioritet} · {suggestion.foreslatt_oppgave.frist_dager}d frist
                </Badge>
              </div>
              <p className="text-sm">{suggestion.foreslatt_oppgave.tittel}</p>
              <Button
                size="sm"
                variant={taskCreated ? "ghost" : "default"}
                className="h-7 px-2.5 text-xs w-full"
                disabled={creatingTask || taskCreated}
                onClick={createTaskFromSuggestion}
              >
                {taskCreated ? (
                  <><Check className="w-3 h-3 mr-1" /> Oppgave opprettet</>
                ) : creatingTask ? (
                  <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Oppretter…</>
                ) : (
                  <><Plus className="w-3 h-3 mr-1" /> Opprett oppgave</>
                )}
              </Button>
            </div>

            <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t">
              <button
                onClick={() => generateSuggestion(false)}
                disabled={aiLoading}
                className="hover:text-foreground transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                <Sparkles className={cn("w-2.5 h-2.5", aiLoading && "animate-pulse")} />
                Generer på nytt
              </button>
              <span>Generert {new Date(suggestion.generert_dato).toLocaleString("no-NO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          </>
        )}

        {!suggestion && !aiLoading && (
          <Button
            size="sm"
            variant="outline"
            className="w-full h-7 text-xs"
            onClick={() => generateSuggestion(false)}
          >
            <Sparkles className="w-3 h-3 mr-1" /> Generer AI-sammendrag og oppgaveforslag
          </Button>
        )}
      </div>

      {/* Full notat dialog */}
      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <NotebookPen className="w-4 h-4 text-amber-600" />
              {meeting.tittel || "Møtenotat"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {formatDate(meeting.dato)} · {days === 0 ? "i dag" : `${days}d siden`}
            </DialogDescription>
          </DialogHeader>
          <MeetingNotesRenderer notes={meeting.moetenotater} source={meeting.aktivitet_kilde} />
        </DialogContent>
      </Dialog>
    </>
  );
}
