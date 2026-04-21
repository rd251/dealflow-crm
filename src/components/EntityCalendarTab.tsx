import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Clock, Users, ChevronDown, ChevronUp, FileText, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, isPast, isToday, parseISO } from "date-fns";
import { nb } from "date-fns/locale";

interface EntityCalendarTabProps {
  selskap_id?: string;
  kontakt_id?: string;
  salgsmulighet_id?: string;
  lead_id?: string;
  partner_id?: string;
  prosjekt_id?: string;
}

interface Meeting {
  id: string;
  tittel: string | null;
  beskrivelse: string;
  dato: string;
  start_tid: string | null;
  slutt_tid: string | null;
  deltakere: string[] | null;
  moetenotater: string | null;
  type: string;
  no_show: boolean;
}

export default function EntityCalendarTab(props: EntityCalendarTabProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMeetings = async () => {
      setLoading(true);
      let query = supabase
        .from("aktiviteter")
        .select("id, tittel, beskrivelse, dato, start_tid, slutt_tid, deltakere, moetenotater, type, no_show")
        .eq("type", "Møte")
        .order("dato", { ascending: false })
        .order("start_tid", { ascending: false })
        .limit(50);

      if (props.selskap_id) query = query.eq("selskap_id", props.selskap_id);
      if (props.kontakt_id) query = query.eq("kontakt_id", props.kontakt_id);
      if (props.salgsmulighet_id) query = query.eq("salgsmulighet_id", props.salgsmulighet_id);
      if (props.lead_id) query = query.eq("lead_id", props.lead_id);
      if (props.partner_id) query = query.eq("partner_id", props.partner_id);
      if (props.prosjekt_id) query = query.eq("prosjekt_id", props.prosjekt_id);

      const { data } = await query;
      setMeetings(data || []);
      setLoading(false);
    };
    fetchMeetings();
  }, [props.selskap_id, props.kontakt_id, props.salgsmulighet_id, props.lead_id, props.partner_id, props.prosjekt_id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
        <Clock className="w-4 h-4 mr-2 animate-spin" />
        Laster møter…
      </div>
    );
  }

  const upcoming = meetings.filter(m => !isPast(parseISO(m.dato)) || isToday(parseISO(m.dato)));
  const past = meetings.filter(m => isPast(parseISO(m.dato)) && !isToday(parseISO(m.dato)));

  upcoming.sort((a, b) => a.dato.localeCompare(b.dato) || (a.start_tid || "").localeCompare(b.start_tid || ""));

  if (meetings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
        <Calendar className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-sm">Ingen møter registrert</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {upcoming.length > 0 && (
        <MeetingGroup label="Kommende" meetings={upcoming} variant="upcoming" />
      )}
      {past.length > 0 && (
        <MeetingGroup label="Tidligere" meetings={past} variant="past" />
      )}
    </div>
  );
}

function MeetingGroup({ label, meetings, variant }: { label: string; meetings: Meeting[]; variant: "upcoming" | "past" }) {
  return (
    <div className="space-y-2">
      <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        <Calendar className="w-3.5 h-3.5" />
        {label}
        <Badge variant="secondary" className="text-[10px] ml-1">{meetings.length}</Badge>
      </h4>
      <div className="space-y-1.5">
        {meetings.map(m => (
          <MeetingRow key={m.id} meeting={m} variant={variant} />
        ))}
      </div>
    </div>
  );
}

function MeetingRow({ meeting, variant }: { meeting: Meeting; variant: "upcoming" | "past" }) {
  const [expanded, setExpanded] = useState(false);
  const hasNotes = !!meeting.moetenotater?.trim();
  const hasDescription = !!meeting.beskrivelse?.trim() && meeting.beskrivelse !== meeting.tittel;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const cleanDeltakere = (meeting.deltakere || []).filter(d => d && !UUID_RE.test(d.trim()));
  const hasDeltakere = cleanDeltakere.length > 0;
  const canExpand = hasNotes || hasDescription || hasDeltakere;

  const dateStr = (() => {
    try {
      const d = parseISO(meeting.dato);
      if (isToday(d)) return "I dag";
      return format(d, "d. MMM yyyy", { locale: nb });
    } catch {
      return meeting.dato;
    }
  })();

  const timeStr = meeting.start_tid
    ? meeting.start_tid.slice(0, 5) + (meeting.slutt_tid ? `–${meeting.slutt_tid.slice(0, 5)}` : "")
    : null;

  return (
    <div
      className={`rounded-lg border transition-colors ${variant === "upcoming" ? "bg-primary/5 border-primary/20" : "bg-muted/30"} ${canExpand ? "cursor-pointer hover:bg-muted/40" : ""}`}
      onClick={() => canExpand && setExpanded(prev => !prev)}
    >
      <div className="p-3 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-tight truncate">
            {meeting.tittel || meeting.beskrivelse || "Møte"}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            {meeting.no_show && (
              <Badge variant="destructive" className="text-[10px] shrink-0 gap-0.5 bg-orange-500/15 text-orange-700 border-orange-300 hover:bg-orange-500/20">
                <UserX className="w-2.5 h-2.5" />
                No-show
              </Badge>
            )}
            {hasNotes && (
              <Badge variant="outline" className="text-[10px] shrink-0 gap-0.5">
                <FileText className="w-2.5 h-2.5" />
                Notater
              </Badge>
            )}
            {canExpand && (
              expanded
                ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {dateStr}
          </span>
          {timeStr && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeStr}
            </span>
          )}
          {hasDeltakere && (
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {cleanDeltakere.length}
            </span>
          )}
        </div>
        {hasDeltakere && !expanded && (
          <p className="text-[11px] text-muted-foreground truncate">
            {cleanDeltakere.slice(0, 3).map(d => d.split("@")[0]).join(", ")}
            {cleanDeltakere.length > 3 && ` +${cleanDeltakere.length - 3}`}
          </p>
        )}
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t border-border/50 pt-2 space-y-2">
          {hasDescription && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Beskrivelse</p>
              <p className="text-xs text-foreground/80 whitespace-pre-line leading-relaxed">{meeting.beskrivelse}</p>
            </div>
          )}
          {hasDeltakere && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
                Deltakere ({cleanDeltakere.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {cleanDeltakere.map((d, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px] font-normal">{d}</Badge>
                ))}
              </div>
            </div>
          )}
          {hasNotes ? (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Møtenotater</p>
              <p className="text-xs text-foreground/90 whitespace-pre-line bg-muted/50 rounded p-2 leading-relaxed">
                {meeting.moetenotater}
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground italic">Ingen møtenotater registrert</p>
          )}
        </div>
      )}
    </div>
  );
}