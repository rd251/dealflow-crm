import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageShell from "@/components/PageShell";
import PostMeetingDialog from "@/components/PostMeetingDialog";
import MeetingPrepPanel from "@/components/MeetingPrepPanel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, Clock, Users, CalendarDays, ListTodo, Pencil, Trash2, GripVertical, Check, X, Building2, ExternalLink, RefreshCw, Loader2, Sparkles } from "lucide-react";
import { format, startOfWeek, startOfMonth, addDays, addWeeks, subWeeks, addMonths, subMonths, isSameDay, getDaysInMonth, getDay } from "date-fns";
import { nb } from "date-fns/locale";
import MeetingFields from "@/components/MeetingFields";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface UserProfile {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
}

const USER_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500",
  "bg-violet-500", "bg-cyan-500", "bg-pink-500", "bg-indigo-500",
];
const getUserColor = (userId: string) => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
};

const API_URL = import.meta.env.VITE_SUPABASE_URL + '/rest/v1';
const API_HEADERS = {
  'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
  'Content-Type': 'application/json',
};

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  start: Date;
  end?: Date;
  type: "meeting" | "task" | "activity";
  color: string;
  raw: any;
  kontaktNavn?: string;
  ownerUserId?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MEETING_COLOR = "bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-300";
const TASK_COLOR = "bg-violet-500/15 border-violet-500 text-violet-800 dark:text-violet-300";
const TASK_HIGH_COLOR = "bg-destructive/15 border-destructive text-destructive";
const ACTIVITY_COLOR = "bg-sky-500/15 border-sky-500 text-sky-800 dark:text-sky-300";

export default function Kalender() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [kontakter, setKontakter] = useState<Record<string, string>>({});
  const [kontaktListe, setKontaktListe] = useState<{ id: string; navn: string }[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [userFilter, setUserFilter] = useState<string>("all"); // "all" | "mine" | user_id

  // Google Calendar connection state
  const [gcalConnected, setGcalConnected] = useState<boolean | null>(null);
  const [gcalConnecting, setGcalConnecting] = useState(false);
  const [gcalSyncing, setGcalSyncing] = useState(false);
  const [gcalLastSynced, setGcalLastSynced] = useState<string | null>(null);

  // Handle Google Calendar OAuth callback
  useEffect(() => {
    if (searchParams.get("gcal_connected") === "true") {
      toast.success("Google Calendar koblet til!");
      setGcalConnected(true);
    }
    if (searchParams.get("gcal_error")) {
      toast.error("Feil ved tilkobling: " + searchParams.get("gcal_error"));
    }
  }, [searchParams]);


  const [postMeetingOpen, setPostMeetingOpen] = useState(false);
  const [prepPanelOpen, setPrepPanelOpen] = useState(false);

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTittel, setEditTittel] = useState("");
  const [editBeskrivelse, setEditBeskrivelse] = useState("");
  const [editDato, setEditDato] = useState("");
  const [editStartTid, setEditStartTid] = useState("");
  const [editSluttTid, setEditSluttTid] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editDeltakere, setEditDeltakere] = useState<string[]>([]);

  // Linked entity details for drawer
  const [linkedSelskap, setLinkedSelskap] = useState<any>(null);

  // Entity lists for linking (selskap only for display)
  const [selskapListe, setSelskapListe] = useState<{ id: string; firmanavn: string }[]>([]);

  // Create meeting dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newMeetingTittel, setNewMeetingTittel] = useState("");
  const [newMeetingDato, setNewMeetingDato] = useState("");
  const [newMeetingStartTid, setNewMeetingStartTid] = useState("09:00");
  const [newMeetingSluttTid, setNewMeetingSluttTid] = useState("10:00");
  const [newMeetingBeskrivelse, setNewMeetingBeskrivelse] = useState("");
  const [newMeetingDeltakere, setNewMeetingDeltakere] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Drag state
  const [dragEvent, setDragEvent] = useState<CalendarEvent | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{ day: Date; hour: number } | null>(null);
  const weekGridRef = useRef<HTMLDivElement>(null);

  const today = new Date();

  // Week view data
  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // Month view data
  const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate]);
  const monthDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDayOfWeek = (getDay(monthStart) + 6) % 7;
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
    for (let i = 0; i < daysInMonth; i++) cells.push(addDays(monthStart, i));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [currentDate, monthStart]);

  useEffect(() => {
    fetch(`${API_URL}/kontakter?select=id,navn`, { headers: API_HEADERS })
      .then(r => r.ok ? r.json() : [])
      .then((data: any[]) => {
        const map: Record<string, string> = {};
        data.forEach(k => { map[k.id] = k.navn; });
        setKontakter(map);
        setKontaktListe(data.map(k => ({ id: k.id, navn: k.navn })));
      })
      .catch(() => {});

    // Fetch user profiles for ownership display
    fetch(`${API_URL}/profiles?select=user_id,display_name,avatar_url`, { headers: API_HEADERS })
      .then(r => r.ok ? r.json() : [])
      .then((data: UserProfile[]) => {
        const map: Record<string, UserProfile> = {};
        data.forEach(p => { map[p.user_id] = p; });
        setProfiles(map);
      })
      .catch(() => {});
  }, []);

  // Fetch entity lists for linking
  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/selskaper?select=id,firmanavn&order=firmanavn`, { headers: API_HEADERS }).then(r => r.ok ? r.json() : []),
    ]).then(([s]) => {
      setSelskapListe(s);
    }).catch(() => {});
  }, []);

  // Check Google Calendar connection
  useEffect(() => {
    if (!user) return;
    supabase
      .from("google_calendar_connections" as any)
      .select("last_synced_at")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }: any) => {
        setGcalConnected(!!data);
        setGcalLastSynced(data?.last_synced_at || null);
      });
  }, [user]);

  const connectGoogleCalendar = async () => {
    setGcalConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-auth", {
        body: { redirect_uri: window.location.origin + "/kalender" },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast.error("Kunne ikke starte Google-tilkobling: " + e.message);
      setGcalConnecting(false);
    }
  };

  const syncNow = async () => {
    setGcalSyncing(true);
    try {
      const { error } = await supabase.functions.invoke("google-calendar-sync");
      if (error) throw error;
      toast.success("Kalender synkronisert!");
      setGcalLastSynced(new Date().toISOString());
      fetchEvents();
    } catch (e: any) {
      toast.error("Synkronisering feilet: " + e.message);
    } finally {
      setGcalSyncing(false);
    }
  };

  const fetchEvents = useCallback(async () => {
    let from: string, to: string;
    if (viewMode === "week") {
      from = weekDays[0].toISOString();
      to = addDays(weekDays[6], 1).toISOString();
    } else {
      const validDays = monthDays.filter(Boolean) as Date[];
      from = validDays[0].toISOString();
      to = addDays(validDays[validDays.length - 1], 1).toISOString();
    }
    const fromDate = from.split('T')[0];
    const toDate = to.split('T')[0];
    const allEvents: CalendarEvent[] = [];

    try {
      const meetingsRes = await fetch(
        `${API_URL}/aktiviteter?type=eq.Møte&start_tid=gte.${from}&start_tid=lte.${to}&select=id,tittel,beskrivelse,start_tid,slutt_tid,type,deltakere,lead_id,salgsmulighet_id,selskap_id,kontakt_id,user_id`,
        { headers: API_HEADERS }
      );
      if (meetingsRes.ok) {
        const meetings = await meetingsRes.json();
        meetings.forEach((m: any) => {
          const deltakereNavn = (m.deltakere || []).map((id: string) => kontakter[id] || "").filter(Boolean);
          allEvents.push({
            id: m.id, title: m.tittel || m.beskrivelse || "Møte", description: m.beskrivelse || "",
            start: new Date(m.start_tid), end: m.slutt_tid ? new Date(m.slutt_tid) : undefined,
            type: "meeting", color: MEETING_COLOR, raw: m,
            kontaktNavn: deltakereNavn.length > 0 ? deltakereNavn.join(", ") : (m.kontakt_id ? kontakter[m.kontakt_id] : undefined),
            ownerUserId: m.user_id,
          });
        });
      }

      const tasksRes = await fetch(
        `${API_URL}/oppgaver?frist=gte.${fromDate}&frist=lte.${toDate}&status=neq.Ferdig&select=id,oppgave,frist,prioritet,ansvarlig,notater,selskap_id,lead_id,salgsmulighet_id`,
        { headers: API_HEADERS }
      );
      if (tasksRes.ok) {
        const tasks = await tasksRes.json();
        tasks.forEach((t: any) => {
          if (t.frist) {
            allEvents.push({
              id: t.id, title: t.oppgave, description: t.notater || "",
              start: new Date(t.frist + "T09:00:00"), type: "task",
              color: t.prioritet === "Høy" ? TASK_HIGH_COLOR : TASK_COLOR, raw: t,
            });
          }
        });
      }

      // Activities excluded from calendar view

      setEvents(allEvents);
    } catch (e) {
      console.error("Error fetching calendar events:", e);
    }
  }, [viewMode, weekDays, monthDays, kontakter]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const filteredEvents = useMemo(() => {
    if (userFilter === "all") return events;
    if (userFilter === "mine" && user) return events.filter(e => e.ownerUserId === user.id);
    // Specific user_id
    return events.filter(e => e.ownerUserId === userFilter);
  }, [events, userFilter, user]);

  const getEventsForDay = (day: Date) => filteredEvents.filter(e => isSameDay(e.start, day));

  const getEventHeight = (event: CalendarEvent) => {
    if (!event.end) return 28;
    const diffMs = event.end.getTime() - event.start.getTime();
    return Math.max(28, diffMs / 60000);
  };

  // Calculate overlap layout for events in a day
  const getOverlapLayout = (dayEvents: CalendarEvent[]) => {
    const DEFAULT_DURATION_MS = 30 * 60 * 1000; // 30 min for untimed events
    const layout: Map<string, { column: number; totalColumns: number }> = new Map();

    // Normalize: give every event a virtual end for layout purposes
    const normalized = dayEvents
      .map(e => ({
        event: e,
        start: e.start.getTime(),
        end: e.end ? e.end.getTime() : e.start.getTime() + DEFAULT_DURATION_MS,
      }))
      .sort((a, b) => a.start - b.start);

    // Group overlapping events into clusters
    const clusters: typeof normalized = [];
    const clusterGroups: (typeof normalized)[] = [];

    for (const item of normalized) {
      let placed = false;
      for (const group of clusterGroups) {
        if (group.some(c => c.start < item.end && c.end > item.start)) {
          group.push(item);
          placed = true;
          break;
        }
      }
      if (!placed) clusterGroups.push([item]);
    }

    // Assign columns within each cluster
    for (const group of clusterGroups) {
      const columns: (typeof normalized)[] = [];
      for (const item of group) {
        let placed = false;
        for (let col = 0; col < columns.length; col++) {
          const last = columns[col][columns[col].length - 1];
          if (last.end <= item.start) {
            columns[col].push(item);
            layout.set(item.event.id, { column: col, totalColumns: 0 });
            placed = true;
            break;
          }
        }
        if (!placed) {
          layout.set(item.event.id, { column: columns.length, totalColumns: 0 });
          columns.push([item]);
        }
      }
      const total = columns.length;
      for (const item of group) {
        const l = layout.get(item.event.id)!;
        l.totalColumns = total;
      }
    }

    return layout;
  };

  // Fetch linked entity details
  const fetchLinkedEntities = useCallback(async (raw: any) => {
    setLinkedSelskap(null);

    if (raw.selskap_id) {
      fetch(`${API_URL}/selskaper?id=eq.${raw.selskap_id}&select=id,firmanavn,kundestatus,bransje`, { headers: API_HEADERS })
        .then(r => r.ok ? r.json() : []).then(d => { if (d[0]) setLinkedSelskap(d[0]); });
    }
  }, []);


  // Event click -> open drawer
  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setEditing(false);
    setDrawerOpen(true);
    fetchLinkedEntities(event.raw);
  };

  // Start editing in drawer
  const startEditing = () => {
    if (!selectedEvent) return;
    if (selectedEvent.type === "meeting") {
      const raw = selectedEvent.raw;
      setEditTittel(raw.tittel || "");
      setEditBeskrivelse(raw.beskrivelse || "");
      setEditDato(raw.start_tid ? format(new Date(raw.start_tid), "yyyy-MM-dd") : "");
      setEditStartTid(raw.start_tid ? format(new Date(raw.start_tid), "HH:mm") : "09:00");
      setEditSluttTid(raw.slutt_tid ? format(new Date(raw.slutt_tid), "HH:mm") : "10:00");
      setEditDeltakere(raw.deltakere || []);
      setEditTittel(selectedEvent.raw.oppgave || "");
      setEditBeskrivelse(selectedEvent.raw.notater || "");
      setEditDato(selectedEvent.raw.frist || "");
    } else {
      setEditBeskrivelse(selectedEvent.raw.beskrivelse || "");
    }
    setEditing(true);
  };

  // Save edit
  const saveEdit = async () => {
    if (!selectedEvent) return;
    setEditSaving(true);
    try {
      if (selectedEvent.type === "meeting") {
        await fetch(`${API_URL}/aktiviteter?id=eq.${selectedEvent.id}`, {
          method: 'PATCH',
          headers: { ...API_HEADERS, 'Prefer': 'return=minimal' },
          body: JSON.stringify({
            tittel: editTittel.trim(),
            beskrivelse: editBeskrivelse.trim(),
            start_tid: `${editDato}T${editStartTid}:00`,
            slutt_tid: `${editDato}T${editSluttTid}:00`,
            deltakere: editDeltakere,
          }),
        });
      } else if (selectedEvent.type === "task") {
        await fetch(`${API_URL}/oppgaver?id=eq.${selectedEvent.id}`, {
          method: 'PATCH',
          headers: { ...API_HEADERS, 'Prefer': 'return=minimal' },
          body: JSON.stringify({
            oppgave: editTittel.trim(),
            notater: editBeskrivelse.trim(),
            frist: editDato || null,
          }),
        });
      } else {
        await fetch(`${API_URL}/aktiviteter?id=eq.${selectedEvent.id}`, {
          method: 'PATCH',
          headers: { ...API_HEADERS, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ beskrivelse: editBeskrivelse.trim() }),
        });
      }
      setEditing(false);
      setDrawerOpen(false);
      await fetchEvents();
    } catch (e) {
      console.error("Error saving edit:", e);
    } finally {
      setEditSaving(false);
    }
  };

  // Slot click -> create
  const handleSlotClick = (day: Date, hour: number) => {
    setNewMeetingDato(format(day, "yyyy-MM-dd"));
    setNewMeetingStartTid(`${String(hour).padStart(2, "0")}:00`);
    setNewMeetingSluttTid(`${String(Math.min(hour + 1, 20)).padStart(2, "0")}:00`);
    setNewMeetingTittel("");
    setNewMeetingBeskrivelse("");
    setNewMeetingDeltakere([]);
    setCreateOpen(true);
  };

  const handleCreateMeeting = async () => {
    if (!newMeetingTittel.trim()) return;
    setSaving(true);
    try {
      await fetch(`${API_URL}/aktiviteter`, {
        method: 'POST',
        headers: { ...API_HEADERS, 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          type: "Møte",
          tittel: newMeetingTittel.trim(),
          beskrivelse: newMeetingBeskrivelse.trim(),
          start_tid: `${newMeetingDato}T${newMeetingStartTid}:00`,
          slutt_tid: `${newMeetingDato}T${newMeetingSluttTid}:00`,
          deltakere: newMeetingDeltakere,
          user_id: user?.id || null,
        }),
      });
      setCreateOpen(false);
      await fetchEvents();
    } catch (e) {
      console.error("Error creating meeting:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;
    const table = selectedEvent.type === "task" ? "oppgaver" : "aktiviteter";
    try {
      await fetch(`${API_URL}/${table}?id=eq.${selectedEvent.id}`, {
        method: 'DELETE',
        headers: { ...API_HEADERS, 'Prefer': 'return=minimal' },
      });
      setDrawerOpen(false);
      setSelectedEvent(null);
      await fetchEvents();
    } catch (e) {
      console.error("Error deleting event:", e);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, event: CalendarEvent) => {
    if (event.type !== "meeting") return;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", event.id);
    setDragEvent(event);
  };

  const handleDragOver = (e: React.DragEvent, day: Date, hour: number) => {
    if (!dragEvent) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverSlot({ day, hour });
  };

  const handleDragLeave = () => {
    setDragOverSlot(null);
  };

  const handleDrop = async (e: React.DragEvent, day: Date, hour: number) => {
    e.preventDefault();
    setDragOverSlot(null);
    if (!dragEvent || dragEvent.type !== "meeting") { setDragEvent(null); return; }

    const oldStart = dragEvent.start;
    const durationMs = dragEvent.end ? dragEvent.end.getTime() - oldStart.getTime() : 3600000;

    const newStartDate = format(day, "yyyy-MM-dd");
    const newStartTime = `${String(hour).padStart(2, "0")}:00`;
    const newEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0);
    newEnd.setTime(newEnd.getTime() + durationMs);
    const newEndTime = format(newEnd, "HH:mm");

    try {
      await fetch(`${API_URL}/aktiviteter?id=eq.${dragEvent.id}`, {
        method: 'PATCH',
        headers: { ...API_HEADERS, 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          start_tid: `${newStartDate}T${newStartTime}:00`,
          slutt_tid: `${newStartDate}T${newEndTime}:00`,
        }),
      });
      await fetchEvents();
    } catch (e) {
      console.error("Error moving event:", e);
    } finally {
      setDragEvent(null);
    }
  };

  const handleDragEnd = () => {
    setDragEvent(null);
    setDragOverSlot(null);
  };

  // Navigation
  const navigatePrev = () => {
    if (viewMode === "week") setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subMonths(currentDate, 1));
  };
  const navigateNext = () => {
    if (viewMode === "week") setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addMonths(currentDate, 1));
  };

  const dateLabel = viewMode === "week"
    ? `${format(weekDays[0], "d. MMM", { locale: nb })} – ${format(weekDays[6], "d. MMM yyyy", { locale: nb })}`
    : format(currentDate, "MMMM yyyy", { locale: nb });

  // Event card component
  const EventCard = ({ event, compact = false }: { event: CalendarEvent; compact?: boolean }) => {
    const ownerProfile = event.ownerUserId ? profiles[event.ownerUserId] : null;
    const initials = ownerProfile
      ? ownerProfile.display_name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()
      : null;

    return (
      <div
        onClick={(e) => { e.stopPropagation(); handleEventClick(event); }}
        draggable={event.type === "meeting"}
        onDragStart={(e) => handleDragStart(e, event)}
        onDragEnd={handleDragEnd}
        className={`rounded px-1.5 py-0.5 text-[10px] leading-tight border-l-2 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity h-full ${event.color} ${
          event.type === "meeting" ? "cursor-grab active:cursor-grabbing" : ""
        } ${dragEvent?.id === event.id ? "opacity-40" : ""}`}
      >
        <div className="flex items-center gap-0.5">
          {event.type === "meeting" && !compact && <GripVertical className="w-2.5 h-2.5 shrink-0 opacity-40" />}
          <span className="font-medium truncate flex-1">{event.title}</span>
          {ownerProfile && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white shrink-0 ${getUserColor(event.ownerUserId!)}`}>
                  {initials}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {ownerProfile.display_name}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {!compact && (
          <span className="truncate block opacity-70 text-[9px]">
            {format(event.start, "HH:mm")}
            {event.end ? `–${format(event.end, "HH:mm")}` : ""}
            {event.kontaktNavn && <> · <Users className="w-2.5 h-2.5 inline shrink-0" /> {event.kontaktNavn}</>}
          </span>
        )}
      </div>
    );
  };

  return (
    <PageShell title="Kalender" subtitle="Oversikt over møter og oppgaver">
      {/* Navigation bar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={navigatePrev}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={navigateNext}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setCurrentDate(new Date())}>
            I dag
          </Button>
        </div>
        <span className="text-sm font-semibold capitalize">{dateLabel}</span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 border rounded-lg p-0.5">
            <Button variant={viewMode === "week" ? "default" : "ghost"} size="sm" className="text-xs h-7 px-3" onClick={() => setViewMode("week")}>
              Uke
            </Button>
            <Button variant={viewMode === "month" ? "default" : "ghost"} size="sm" className="text-xs h-7 px-3" onClick={() => setViewMode("month")}>
              Måned
            </Button>
          </div>
          <div className="flex items-center gap-1 border rounded-lg p-0.5">
            <Button variant={userFilter === "all" ? "default" : "ghost"} size="sm" className="text-xs h-7 px-3" onClick={() => setUserFilter("all")}>
              Alle
            </Button>
            <Button variant={userFilter === "mine" ? "default" : "ghost"} size="sm" className="text-xs h-7 px-3" onClick={() => setUserFilter("mine")}>
              Mine
            </Button>
            <Select value={userFilter !== "all" && userFilter !== "mine" ? userFilter : ""} onValueChange={(val) => setUserFilter(val)}>
              <SelectTrigger className={cn("h-7 text-xs w-auto min-w-[110px] border-0 shadow-none", userFilter !== "all" && userFilter !== "mine" ? "bg-primary text-primary-foreground" : "")}>
                <SelectValue placeholder="Velg bruker" />
              </SelectTrigger>
              <SelectContent>
                {Object.values(profiles).map(p => (
                  <SelectItem key={p.user_id} value={p.user_id}>
                    <span className="flex items-center gap-2">
                      <span className={cn("w-2 h-2 rounded-full", getUserColor(p.user_id))} />
                      {p.display_name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 text-[11px]">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Møter</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-violet-500" /> Oppgaver</span>
        {viewMode === "week" && <span className="text-muted-foreground ml-2">Dra møter for å flytte</span>}
      </div>

      {/* Google Calendar connection banner */}
      {gcalConnected === false && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-4 py-3">
          <CalendarDays className="w-5 h-5 text-primary shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Koble til Google Calendar</p>
            <p className="text-xs text-muted-foreground">Synkroniser møtene dine automatisk med kalenderen</p>
          </div>
          <Button size="sm" onClick={connectGoogleCalendar} disabled={gcalConnecting}>
            {gcalConnecting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Koble til
          </Button>
        </div>
      )}
      {gcalConnected === true && (
        <div className="mb-3 flex items-center gap-3 text-xs text-muted-foreground">
          <CalendarDays className="w-4 h-4 text-primary" />
          <span>Google Calendar tilkoblet</span>
          {gcalLastSynced && (
            <span>· Sist synkronisert {format(new Date(gcalLastSynced), "dd.MM.yyyy HH:mm")}</span>
          )}
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={syncNow} disabled={gcalSyncing}>
            {gcalSyncing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
            Synk nå
          </Button>
        </div>
      )}

      {viewMode === "week" && (
        <div className="border rounded-xl overflow-hidden bg-card">
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b">
            <div className="p-2 border-r bg-muted/30" />
            {weekDays.map((day, i) => {
              const isToday = isSameDay(day, today);
              return (
                <div key={i} className={`p-2 text-center border-r last:border-r-0 ${isToday ? "bg-primary/5" : "bg-muted/30"}`}>
                  <div className="text-[10px] uppercase text-muted-foreground">{format(day, "EEE", { locale: nb })}</div>
                  <div className={`text-sm font-semibold ${isToday ? "text-primary" : ""}`}>{format(day, "d")}</div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-[60px_repeat(7,1fr)] max-h-[600px] overflow-y-auto">
            {/* Hour labels column */}
            <div className="row-span-1">
              {HOURS.map(hour => (
                <div key={hour} className="h-[60px] border-b border-r px-1 flex items-start justify-end pt-0.5">
                  <span className="text-[10px] text-muted-foreground">{String(hour).padStart(2, "0")}:00</span>
                </div>
              ))}
            </div>
            {/* Day columns with events overlay */}
            {weekDays.map((day, di) => {
              const isToday = isSameDay(day, today);
              const dayEvents = getEventsForDay(day);
              const overlapLayout = getOverlapLayout(dayEvents);
              const firstHour = HOURS[0];
              return (
                <div key={di} className="relative border-r last:border-r-0" style={{ height: `${HOURS.length * 60}px` }}>
                  {/* Hour grid lines + click targets */}
                  {HOURS.map(hour => {
                    const isDropTarget = dragOverSlot && isSameDay(dragOverSlot.day, day) && dragOverSlot.hour === hour;
                    return (
                      <div
                        key={hour}
                        className={`h-[60px] border-b cursor-pointer transition-colors ${
                          isDropTarget ? "bg-primary/10 ring-1 ring-inset ring-primary/30" : isToday ? "bg-primary/[0.02]" : "hover:bg-muted/30"
                        }`}
                        onClick={() => handleSlotClick(day, hour)}
                        onDragOver={(e) => handleDragOver(e, day, hour)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, day, hour)}
                      />
                    );
                  })}
                  {/* Events overlay */}
                  {dayEvents.map(event => {
                    const eventHour = event.start.getHours();
                    const eventMinute = event.start.getMinutes();
                    const topPx = (eventHour - firstHour) * 60 + eventMinute;
                    // Skip events outside visible range
                    if (topPx < 0 || topPx >= HOURS.length * 60) return null;
                    const ol = overlapLayout.get(event.id) || { column: 0, totalColumns: 1 };
                    const widthPct = 100 / ol.totalColumns;
                    const leftPct = ol.column * widthPct;
                    return (
                      <div
                        key={event.id}
                        className="absolute z-10"
                        style={{
                          top: `${topPx}px`,
                          height: `${getEventHeight(event)}px`,
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                          paddingLeft: '1px',
                          paddingRight: '1px',
                        }}
                      >
                        <EventCard event={event} />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MONTH VIEW */}
      {viewMode === "month" && (
        <div className="border rounded-xl overflow-hidden bg-card">
          <div className="grid grid-cols-7 border-b">
            {["man", "tir", "ons", "tor", "fre", "lør", "søn"].map(d => (
              <div key={d} className="p-2 text-center text-[10px] uppercase text-muted-foreground bg-muted/30 border-r last:border-r-0">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthDays.map((day, i) => {
              if (!day) return <div key={i} className="min-h-[100px] border-b border-r last:border-r-0 bg-muted/10" />;
              const isToday = isSameDay(day, today);
              const dayEvents = getEventsForDay(day);
              return (
                <div
                  key={i}
                  className={`min-h-[100px] border-b border-r last:border-r-0 p-1 cursor-pointer hover:bg-muted/20 transition-colors ${isToday ? "bg-primary/5" : ""}`}
                  onClick={() => {
                    setNewMeetingDato(format(day, "yyyy-MM-dd"));
                    setNewMeetingStartTid("09:00");
                    setNewMeetingSluttTid("10:00");
                    setNewMeetingTittel("");
                    setNewMeetingBeskrivelse("");
                    setNewMeetingDeltakere([]);
                    setCreateOpen(true);
                  }}
                >
                  <div className={`text-xs font-medium mb-1 ${isToday ? "text-primary" : "text-muted-foreground"}`}>{format(day, "d")}</div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map(event => (
                      <EventCard key={event.id} event={event} compact />
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[9px] text-muted-foreground pl-1">+{dayEvents.length - 3} mer</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tasks list */}
      {(() => {
        const taskEvents = filteredEvents.filter(e => e.type === "task");
        if (taskEvents.length === 0) return null;
        return (
          <div className="mt-4 border rounded-xl p-4 bg-card">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-violet-500" />
              Oppgaver med frist
            </h3>
            <div className="space-y-2">
              {taskEvents.sort((a, b) => a.start.getTime() - b.start.getTime()).map(event => (
                <div key={event.id} className={`flex items-center gap-3 p-2 rounded-lg border-l-2 cursor-pointer hover:opacity-80 transition-opacity ${event.color}`} onClick={() => handleEventClick(event)}>
                  <span className="text-xs font-medium">{format(event.start, "EEE d. MMM", { locale: nb })}</span>
                  <span className="text-xs flex-1 truncate">{event.title}</span>
                  {event.raw?.prioritet && <Badge variant="outline" className="text-[9px]">{event.raw.prioritet}</Badge>}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Event detail drawer with edit mode */}
      <Sheet open={drawerOpen} onOpenChange={(open) => { setDrawerOpen(open); if (!open) setEditing(false); }}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {selectedEvent?.type === "meeting" && <CalendarDays className="w-5 h-5 text-amber-500" />}
              {selectedEvent?.type === "task" && <ListTodo className="w-5 h-5 text-violet-500" />}
              {selectedEvent?.type === "activity" && <Clock className="w-5 h-5 text-sky-500" />}
              {editing ? "Rediger" : selectedEvent?.title}
            </SheetTitle>
            <SheetDescription>
              {selectedEvent?.type === "meeting" ? "Møtedetaljer" : selectedEvent?.type === "task" ? "Oppgavedetaljer" : "Aktivitetsdetaljer"}
            </SheetDescription>
          </SheetHeader>

          {selectedEvent && !editing && (
            <div className="space-y-4 mt-4">
              {/* Owner */}
              {selectedEvent.ownerUserId && profiles[selectedEvent.ownerUserId] && (
                <div className="flex items-center gap-2 text-sm">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${getUserColor(selectedEvent.ownerUserId)}`}>
                    {profiles[selectedEvent.ownerUserId].display_name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                  </div>
                  <span>{profiles[selectedEvent.ownerUserId].display_name}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
                <span>{format(selectedEvent.start, "EEEE d. MMMM yyyy", { locale: nb })}</span>
              </div>
              {selectedEvent.end && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span>{format(selectedEvent.start, "HH:mm")} – {format(selectedEvent.end, "HH:mm")}</span>
                </div>
              )}
              {selectedEvent.kontaktNavn && (
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span>{selectedEvent.kontaktNavn}</span>
                </div>
              )}
              {selectedEvent.description && (
                <div className="border rounded-lg p-3 bg-muted/30">
                  <p className="text-sm whitespace-pre-line">{selectedEvent.description}</p>
                </div>
              )}
              {selectedEvent.type === "task" && selectedEvent.raw && (
                <div className="space-y-2">
                  {selectedEvent.raw.prioritet && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Prioritet:</span>
                      <Badge variant="outline">{selectedEvent.raw.prioritet}</Badge>
                    </div>
                  )}
                  {selectedEvent.raw.ansvarlig && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Ansvarlig:</span>
                      <span>{selectedEvent.raw.ansvarlig}</span>
                    </div>
                  )}
                </div>
              )}
              <Badge variant="secondary" className="text-xs">
                {selectedEvent.type === "meeting" ? "Møte" : selectedEvent.type === "task" ? "Oppgave" : "Aktivitet"}
              </Badge>

              {/* Auto-linked selskap (read-only) */}
              {linkedSelskap && (
                <div className="pt-3 border-t">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
                    <Building2 className="w-3.5 h-3.5" /> Selskap
                  </div>
                  <button
                    className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
                    onClick={() => { setDrawerOpen(false); navigate(`/kundeforhold/${linkedSelskap.id}`); }}
                  >
                    {linkedSelskap.firmanavn}
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Prep meeting button for future meetings */}
              {selectedEvent.type === "meeting" && selectedEvent.start >= new Date() && (
                <div className="pt-3 border-t">
                  <Button
                    className="w-full gap-2"
                    onClick={() => { setDrawerOpen(false); setPrepPanelOpen(true); }}
                  >
                    <Sparkles className="w-4 h-4" />
                    Prep møte
                  </Button>
                </div>
              )}

              {/* Post-meeting button for past meetings */}
              {selectedEvent.type === "meeting" && selectedEvent.start < new Date() && (
                <div className="pt-3 border-t">
                  <Button
                    variant="destructive"
                    className="w-full gap-2"
                    onClick={() => setPostMeetingOpen(true)}
                  >
                    <Check className="w-4 h-4" />
                    Møtet er ferdig – logg resultat
                  </Button>
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={startEditing}>
                  <Pencil className="w-3.5 h-3.5" /> Rediger
                </Button>
                <Button variant="destructive" size="sm" className="gap-1.5" onClick={handleDeleteEvent}>
                  <Trash2 className="w-3.5 h-3.5" /> Slett
                </Button>
              </div>
            </div>
          )}

          {/* Edit mode */}
          {selectedEvent && editing && (
            <div className="space-y-4 mt-4">
              {selectedEvent.type === "meeting" && (
                <MeetingFields
                  tittel={editTittel}
                  dato={editDato}
                  startTid={editStartTid}
                  sluttTid={editSluttTid}
                  onTittelChange={setEditTittel}
                  onDatoChange={setEditDato}
                  onStartTidChange={setEditStartTid}
                  onSluttTidChange={setEditSluttTid}
                  deltakere={editDeltakere}
                  onDeltakereChange={setEditDeltakere}
                  kontaktListe={kontaktListe}
                />
              )}
              {selectedEvent.type === "task" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium">Oppgave</label>
                    <input
                      className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm mt-1"
                      value={editTittel}
                      onChange={e => setEditTittel(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Frist</label>
                    <input
                      type="date"
                      className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm mt-1"
                      value={editDato}
                      onChange={e => setEditDato(e.target.value)}
                    />
                  </div>
                </div>
              )}
              <Textarea
                placeholder="Beskrivelse / notater..."
                value={editBeskrivelse}
                onChange={e => setEditBeskrivelse(e.target.value)}
                rows={3}
              />
              <div className="flex gap-2 pt-4 border-t">
                <Button size="sm" className="gap-1.5" onClick={saveEdit} disabled={editSaving}>
                  <Check className="w-3.5 h-3.5" /> {editSaving ? "Lagrer..." : "Lagre"}
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditing(false)}>
                  <X className="w-3.5 h-3.5" /> Avbryt
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Create meeting dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Opprett møte</DialogTitle>
            <DialogDescription>Legg til et nytt møte i kalenderen</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <MeetingFields
              tittel={newMeetingTittel}
              dato={newMeetingDato}
              startTid={newMeetingStartTid}
              sluttTid={newMeetingSluttTid}
              onTittelChange={setNewMeetingTittel}
              onDatoChange={setNewMeetingDato}
              onStartTidChange={setNewMeetingStartTid}
              onSluttTidChange={setNewMeetingSluttTid}
              deltakere={newMeetingDeltakere}
              onDeltakereChange={setNewMeetingDeltakere}
              kontaktListe={kontaktListe}
            />
            <Textarea
              placeholder="Beskrivelse..."
              value={newMeetingBeskrivelse}
              onChange={e => setNewMeetingBeskrivelse(e.target.value)}
              rows={3}
            />
            <Button onClick={handleCreateMeeting} className="w-full" disabled={!newMeetingTittel.trim() || saving}>
              {saving ? "Oppretter..." : "Opprett møte"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Post-meeting dialog */}
      {selectedEvent?.type === "meeting" && (
        <PostMeetingDialog
          open={postMeetingOpen}
          onOpenChange={(open) => {
            setPostMeetingOpen(open);
            if (!open) {
              fetchEvents();
            }
          }}
          meetingTitle={selectedEvent.title}
          salgsmulighet_id={selectedEvent.raw?.salgsmulighet_id || null}
          selskap_id={selectedEvent.raw?.selskap_id || null}
        />
      )}

      {/* Meeting Prep Panel */}
      {selectedEvent?.type === "meeting" && (
        <MeetingPrepPanel
          meeting={{
            id: selectedEvent.id,
            tittel: selectedEvent.title,
            beskrivelse: selectedEvent.description,
            dato: selectedEvent.start.toISOString(),
            start_tid: selectedEvent.start.toISOString(),
            slutt_tid: selectedEvent.end?.toISOString() || null,
            selskap_id: selectedEvent.raw?.selskap_id || null,
            salgsmulighet_id: selectedEvent.raw?.salgsmulighet_id || null,
            ekstern_id: selectedEvent.raw?.ekstern_id || null,
            ekstern_provider: selectedEvent.raw?.ekstern_provider || null,
          }}
          open={prepPanelOpen}
          onOpenChange={setPrepPanelOpen}
        />
      )}
    </PageShell>
  );
}
