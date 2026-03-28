import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format, differenceInDays } from "date-fns";
import { nb } from "date-fns/locale";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2, TrendingUp, Clock, ExternalLink, Phone, Mail, MessageSquare,
  CalendarDays, AlertTriangle, ChevronRight, PenLine, Target, Lightbulb,
  Sparkles, ArrowRight, CheckCircle2, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PostMeetingDialog from "./PostMeetingDialog";

interface MeetingItem {
  id: string;
  tittel: string;
  beskrivelse: string;
  dato: string;
  start_tid: string | null;
  slutt_tid: string | null;
  selskap_id: string | null;
  salgsmulighet_id: string | null;
  ekstern_id?: string | null;
  ekstern_provider?: string | null;
}

interface Activity {
  id: string;
  type: string;
  beskrivelse: string;
  dato: string;
  tittel?: string;
}

interface SelskapData {
  id: string;
  firmanavn: string;
  kundestatus: string;
  mrr: number;
  sist_aktivitet: string | null;
}

interface SmData {
  id: string;
  navn: string;
  status: string;
  forventet_mrr: number;
  neste_steg: string;
  sist_aktivitet: string | null;
  forventet_lukkedato: string | null;
}

interface Props {
  meeting: MeetingItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const API_URL = import.meta.env.VITE_SUPABASE_URL + "/rest/v1";
const API_HEADERS = {
  apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
  "Content-Type": "application/json",
};

const activityIcon = (type: string) => {
  switch (type) {
    case "E-post": return <Mail className="w-3.5 h-3.5" />;
    case "Telefonsamtale": return <Phone className="w-3.5 h-3.5" />;
    case "Møte": return <CalendarDays className="w-3.5 h-3.5" />;
    case "LinkedIn-melding": return <MessageSquare className="w-3.5 h-3.5" />;
    default: return <PenLine className="w-3.5 h-3.5" />;
  }
};

const statusLabel = (kundestatus: string) => {
  switch (kundestatus) {
    case "Live": return { label: "Kunde", color: "bg-emerald-500/10 text-emerald-600 border-emerald-200" };
    case "Pilot": return { label: "Pilot", color: "bg-blue-500/10 text-blue-600 border-blue-200" };
    case "Kansellert": return { label: "Kansellert", color: "bg-destructive/10 text-destructive border-destructive/20" };
    default: return { label: "Ikke kunde", color: "bg-muted text-muted-foreground" };
  }
};

const formatDaysAgo = (days: number | null) => {
  if (days === null) return "Aldri";
  if (days === 0) return "I dag";
  if (days === 1) return "I går";
  return `${days} dager siden`;
};

export default function MeetingPrepPanel({ meeting, open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [selskap, setSelskap] = useState<SelskapData | null>(null);
  const [sm, setSm] = useState<SmData | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);

  // AI state
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiNextAction, setAiNextAction] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Post-meeting dialog
  const [postMeetingOpen, setPostMeetingOpen] = useState(false);

  const now = new Date();
  const nok = (v: number) => v.toLocaleString("no-NO");

  useEffect(() => {
    if (!meeting || !open) return;
    setLoading(true);
    setSelskap(null);
    setSm(null);
    setActivities([]);
    setAiSummary(null);
    setAiNextAction(null);

    let selskapData: SelskapData | null = null;
    let smData: SmData | null = null;
    let actData: Activity[] = [];

    const fetches: Promise<void>[] = [];

    if (meeting.selskap_id) {
      fetches.push(
        fetch(`${API_URL}/selskaper?id=eq.${meeting.selskap_id}&select=id,firmanavn,kundestatus,mrr,sist_aktivitet&limit=1`, { headers: API_HEADERS })
          .then(r => r.ok ? r.json() : [])
          .then((rows: SelskapData[]) => { if (rows[0]) { setSelskap(rows[0]); selskapData = rows[0]; } })
      );
    }

    if (meeting.salgsmulighet_id) {
      fetches.push(
        fetch(`${API_URL}/salgsmuligheter?id=eq.${meeting.salgsmulighet_id}&select=id,navn,status,forventet_mrr,neste_steg,sist_aktivitet,forventet_lukkedato&limit=1`, { headers: API_HEADERS })
          .then(r => r.ok ? r.json() : [])
          .then((rows: SmData[]) => { if (rows[0]) { setSm(rows[0]); smData = rows[0]; } })
      );
    }

    if (meeting.selskap_id) {
      fetches.push(
        fetch(`${API_URL}/aktiviteter?selskap_id=eq.${meeting.selskap_id}&order=dato.desc&limit=5&select=id,type,beskrivelse,dato,tittel`, { headers: API_HEADERS })
          .then(r => r.ok ? r.json() : [])
          .then((rows: Activity[]) => { setActivities(rows); actData = rows; })
      );
    } else if (meeting.salgsmulighet_id) {
      fetches.push(
        fetch(`${API_URL}/aktiviteter?salgsmulighet_id=eq.${meeting.salgsmulighet_id}&order=dato.desc&limit=5&select=id,type,beskrivelse,dato,tittel`, { headers: API_HEADERS })
          .then(r => r.ok ? r.json() : [])
          .then((rows: Activity[]) => { setActivities(rows); actData = rows; })
      );
    }

    Promise.all(fetches).then(() => {
      setLoading(false);
      // Trigger AI summary – even without activities, use meeting title/description
      fetchAiSummary(actData, selskapData, smData);
    });
  }, [meeting, open]);

  const fetchAiSummary = async (acts: Activity[], s: SelskapData | null, sm: SmData | null) => {
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("meeting-prep-ai", {
        body: {
          activities: acts.map(a => ({ type: a.type, dato: a.dato, tittel: a.tittel, beskrivelse: a.beskrivelse })),
          selskapNavn: s?.firmanavn || null,
          smNavn: sm?.navn || null,
          smStatus: sm?.status || null,
          smNesteSteg: sm?.neste_steg || null,
          meetingTitle: meeting?.tittel || meeting?.beskrivelse || null,
          meetingDate: meeting?.dato || null,
        },
      });
      if (!error && data) {
        setAiSummary(data.summary || null);
        setAiNextAction(data.nextAction || null);
      }
    } catch (err) {
      console.error("AI summary error:", err);
    } finally {
      setAiLoading(false);
    }
  };

  if (!meeting) return null;

  const selskapDaysAgo = selskap?.sist_aktivitet
    ? differenceInDays(now, new Date(selskap.sist_aktivitet))
    : null;
  const smDaysAgo = sm?.sist_aktivitet
    ? differenceInDays(now, new Date(sm.sist_aktivitet))
    : null;

  // Warnings
  const warnings: string[] = [];
  if (selskapDaysAgo !== null && selskapDaysAgo > 7) warnings.push(`Ingen aktivitet siste ${selskapDaysAgo} dager`);
  else if (selskapDaysAgo === null && selskap) warnings.push("Ingen registrert aktivitet");
  if (sm && (!sm.neste_steg || sm.neste_steg.trim() === "")) warnings.push("Ingen neste steg definert");

  const googleCalUrl = meeting.ekstern_id && meeting.ekstern_provider === "google"
    ? `https://calendar.google.com/calendar/event?eid=${meeting.ekstern_id}`
    : null;

  // Check if meeting is in the past (for post-meeting flow)
  const meetingEnd = meeting.slutt_tid ? new Date(meeting.slutt_tid) : new Date(meeting.dato);
  const isMeetingPast = meetingEnd < now;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto p-0">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b">
            <SheetHeader>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <CalendarDays className="w-3.5 h-3.5" />
                {meeting.start_tid
                  ? format(new Date(meeting.start_tid), "EEEE d. MMMM – HH:mm", { locale: nb })
                  : format(new Date(meeting.dato), "EEEE d. MMMM", { locale: nb })}
                {meeting.slutt_tid && ` – ${format(new Date(meeting.slutt_tid), "HH:mm")}`}
              </div>
              <SheetTitle className="text-lg">{meeting.tittel || meeting.beskrivelse || "Møte"}</SheetTitle>
            </SheetHeader>
          </div>

          <div className="px-6 py-4 space-y-5">
            {loading && <p className="text-sm text-muted-foreground">Laster...</p>}

            {/* AI Summary */}
            {(aiLoading || aiSummary) && (
              <section className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                <h3 className="text-xs font-semibold text-primary uppercase tracking-wide flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Oppsummering
                </h3>
                {aiLoading ? (
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-4/5" />
                  </div>
                ) : (
                  <p className="text-xs text-foreground leading-relaxed">{aiSummary}</p>
                )}
              </section>
            )}

            {/* Next Best Action */}
            {(aiLoading || aiNextAction) && (
              <section className="rounded-lg border border-emerald-200 bg-emerald-500/5 p-3">
                <h3 className="text-xs font-semibold text-emerald-700 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                  <ArrowRight className="w-3.5 h-3.5" /> Anbefalt handling
                </h3>
                {aiLoading ? (
                  <Skeleton className="h-3 w-3/4" />
                ) : (
                  <p className="text-xs text-foreground font-medium">{aiNextAction}</p>
                )}
              </section>
            )}

            {/* Warnings */}
            {warnings.length > 0 && (
              <div className="space-y-2">
                {warnings.map((w, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-amber-500/10 text-amber-700 border border-amber-200">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    {w}
                  </div>
                ))}
              </div>
            )}

            {/* Selskap */}
            {selskap && (
              <section>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Selskap</h3>
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      {selskap.firmanavn}
                    </span>
                    <Badge variant="outline" className={`text-[10px] ${statusLabel(selskap.kundestatus).color}`}>
                      {statusLabel(selskap.kundestatus).label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>MRR: <strong className="text-foreground">{nok(selskap.mrr)}</strong></span>
                    <span>Sist aktiv: <strong className="text-foreground">{formatDaysAgo(selskapDaysAgo)}</strong></span>
                  </div>
                </div>
              </section>
            )}

            {/* Salgsmulighet */}
            {sm && (
              <section>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Salgsmulighet</h3>
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{sm.navn}</span>
                    <Badge variant="outline" className="text-[10px]">{sm.status}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>MRR: <strong className="text-foreground">{nok(sm.forventet_mrr)}</strong></span>
                    <span>Sist aktiv: <strong className="text-foreground">{formatDaysAgo(smDaysAgo)}</strong></span>
                    {sm.forventet_lukkedato && (
                      <span>Lukkedato: <strong className="text-foreground">{format(new Date(sm.forventet_lukkedato), "d. MMM yyyy", { locale: nb })}</strong></span>
                    )}
                  </div>
                  {sm.neste_steg && sm.neste_steg.trim() !== "" && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Neste steg: </span>
                      <span className="font-medium">{sm.neste_steg}</span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Historikk */}
            {activities.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Siste aktiviteter</h3>
                <div className="space-y-1.5">
                  {activities.map((a) => (
                    <div key={a.id} className="flex items-start gap-2.5 py-1.5 text-xs">
                      <span className="text-muted-foreground mt-0.5">{activityIcon(a.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground truncate">{a.tittel || a.beskrivelse || a.type}</p>
                        <p className="text-muted-foreground">
                          {format(new Date(a.dato), "d. MMM – HH:mm", { locale: nb })}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] shrink-0">{a.type}</Badge>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <Separator />

            {/* Post-meeting CTA */}
            {isMeetingPast && (
              <Button
                className="w-full gap-2"
                onClick={() => setPostMeetingOpen(true)}
              >
                <CheckCircle2 className="w-4 h-4" /> Møtet er ferdig – logg resultat
              </Button>
            )}

            {/* Actions */}
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Handlinger</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs justify-start gap-1.5 h-9"
                  onClick={() => { onOpenChange(false); navigate("/aktiviteter"); }}
                >
                  <PenLine className="w-3.5 h-3.5" /> Logg aktivitet
                </Button>
                {sm && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs justify-start gap-1.5 h-9"
                    onClick={() => { onOpenChange(false); navigate(`/salgsmuligheter?open=${sm.id}`); }}
                  >
                    <Target className="w-3.5 h-3.5" /> Sett neste steg
                  </Button>
                )}
                {selskap && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs justify-start gap-1.5 h-9"
                    onClick={() => { onOpenChange(false); navigate(`/selskaper/${selskap.id}`); }}
                  >
                    <Building2 className="w-3.5 h-3.5" /> Åpne selskap
                  </Button>
                )}
                {sm && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs justify-start gap-1.5 h-9"
                    onClick={() => { onOpenChange(false); navigate(`/salgsmuligheter?open=${sm.id}`); }}
                  >
                    <TrendingUp className="w-3.5 h-3.5" /> Åpne salgsmulighet
                  </Button>
                )}
              </div>
            </section>

            {/* Google Calendar link */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground justify-center gap-1.5 h-9"
              onClick={() => {
                if (googleCalUrl) window.open(googleCalUrl, "_blank");
                else window.open("https://calendar.google.com", "_blank");
              }}
            >
              <ExternalLink className="w-3.5 h-3.5" /> Åpne i Google Kalender
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Post-meeting dialog */}
      <PostMeetingDialog
        open={postMeetingOpen}
        onOpenChange={setPostMeetingOpen}
        meetingTitle={meeting?.tittel || meeting?.beskrivelse || "Møte"}
        salgsmulighet_id={meeting?.salgsmulighet_id || null}
        selskap_id={meeting?.selskap_id || null}
      />
    </>
  );
}
