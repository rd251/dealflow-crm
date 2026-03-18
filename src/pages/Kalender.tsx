import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import PageShell from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Clock, Users, CalendarDays, ListTodo, Pencil, Trash2, GripVertical, Check, X } from "lucide-react";
import { format, startOfWeek, startOfMonth, addDays, addWeeks, subWeeks, addMonths, subMonths, isSameDay, getDaysInMonth, getDay } from "date-fns";
import { nb } from "date-fns/locale";
import MeetingFields from "@/components/MeetingFields";

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
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);
const MEETING_COLOR = "bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-300";
const TASK_COLOR = "bg-violet-500/15 border-violet-500 text-violet-800 dark:text-violet-300";
const TASK_HIGH_COLOR = "bg-destructive/15 border-destructive text-destructive";
const ACTIVITY_COLOR = "bg-sky-500/15 border-sky-500 text-sky-800 dark:text-sky-300";

export default function Kalender() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [kontakter, setKontakter] = useState<Record<string, string>>({});
  const [kontaktListe, setKontaktListe] = useState<{ id: string; navn: string }[]>([]);

  // Drawer state
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
  }, []);

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
        `${API_URL}/aktiviteter?type=eq.Møte&start_tid=gte.${from}&start_tid=lte.${to}&select=id,tittel,beskrivelse,start_tid,slutt_tid,type,deltakere,lead_id,salgsmulighet_id,selskap_id,kontakt_id`,
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
          });
        });
      }

      const tasksRes = await fetch(
        `${API_URL}/oppgaver?frist=gte.${fromDate}&frist=lte.${toDate}&status=neq.Ferdig&select=id,oppgave,frist,prioritet,ansvarlig,notater`,
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

      const activitiesRes = await fetch(
        `${API_URL}/aktiviteter?type=neq.Møte&dato=gte.${from}&dato=lte.${to}&select=id,type,beskrivelse,dato,kontakt_id`,
        { headers: API_HEADERS }
      );
      if (activitiesRes.ok) {
        const activities = await activitiesRes.json();
        activities.forEach((a: any) => {
          allEvents.push({
            id: a.id, title: `${a.type}: ${a.beskrivelse}`.substring(0, 50), description: a.beskrivelse || "",
            start: new Date(a.dato), type: "activity", color: ACTIVITY_COLOR, raw: a,
            kontaktNavn: a.kontakt_id ? kontakter[a.kontakt_id] : undefined,
          });
        });
      }

      setEvents(allEvents);
    } catch (e) {
      console.error("Error fetching calendar events:", e);
    }
  }, [viewMode, weekDays, monthDays, kontakter]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const getEventsForDay = (day: Date) => events.filter(e => isSameDay(e.start, day));

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

  // Event click -> open drawer
  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setEditing(false);
    setDrawerOpen(true);
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
  const EventCard = ({ event, compact = false }: { event: CalendarEvent; compact?: boolean }) => (
    <div
      onClick={(e) => { e.stopPropagation(); handleEventClick(event); }}
      draggable={event.type === "meeting"}
      onDragStart={(e) => handleDragStart(e, event)}
      onDragEnd={handleDragEnd}
      className={`rounded px-1.5 py-0.5 text-[10px] leading-tight border-l-2 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity ${event.color} ${
        event.type === "meeting" ? "cursor-grab active:cursor-grabbing" : ""
      } ${dragEvent?.id === event.id ? "opacity-40" : ""}`}
    >
      <div className="flex items-center gap-0.5">
        {event.type === "meeting" && !compact && <GripVertical className="w-2.5 h-2.5 shrink-0 opacity-40" />}
        <span className="font-medium truncate">{event.title}</span>
      </div>
      {!compact && event.kontaktNavn && (
        <span className="truncate block opacity-70 flex items-center gap-0.5">
          <Users className="w-2.5 h-2.5 inline shrink-0" /> {event.kontaktNavn}
        </span>
      )}
    </div>
  );

  return (
    <PageShell title="Kalender" subtitle="Oversikt over møter, oppgaver og aktiviteter">
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
        <div className="flex items-center gap-1 border rounded-lg p-0.5">
          <Button variant={viewMode === "week" ? "default" : "ghost"} size="sm" className="text-xs h-7 px-3" onClick={() => setViewMode("week")}>
            Uke
          </Button>
          <Button variant={viewMode === "month" ? "default" : "ghost"} size="sm" className="text-xs h-7 px-3" onClick={() => setViewMode("month")}>
            Måned
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 text-[11px]">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Møter</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-violet-500" /> Oppgaver</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-sky-500" /> Aktiviteter</span>
        {viewMode === "week" && <span className="text-muted-foreground ml-2">Dra møter for å flytte</span>}
      </div>

      {/* WEEK VIEW */}
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
            {HOURS.map(hour => {
              return (
              <div key={hour} className="contents">
                <div className="h-[60px] border-b border-r px-1 flex items-start justify-end pt-0.5">
                  <span className="text-[10px] text-muted-foreground">{String(hour).padStart(2, "0")}:00</span>
                </div>
                {weekDays.map((day, di) => {
                  const isToday = isSameDay(day, today);
                  const allDayEvents = getEventsForDay(day);
                  const dayEvents = allDayEvents.filter(e => e.start.getHours() === hour);
                  const overlapLayout = getOverlapLayout(allDayEvents);
                  const isDropTarget = dragOverSlot && isSameDay(dragOverSlot.day, day) && dragOverSlot.hour === hour;
                  return (
                    <div
                      key={di}
                      className={`h-[60px] border-b border-r last:border-r-0 relative cursor-pointer transition-colors ${
                        isDropTarget ? "bg-primary/10 ring-1 ring-inset ring-primary/30" : isToday ? "bg-primary/[0.02]" : "hover:bg-muted/30"
                      }`}
                      onClick={() => handleSlotClick(day, hour)}
                      onDragOver={(e) => handleDragOver(e, day, hour)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, day, hour)}
                    >
                      {dayEvents.map(event => {
                        const ol = overlapLayout.get(event.id) || { column: 0, totalColumns: 1 };
                        const widthPct = 100 / ol.totalColumns;
                        const leftPct = ol.column * widthPct;
                        return (
                        <div
                          key={event.id}
                          className="absolute"
                          style={{
                            top: `${event.start.getMinutes()}px`,
                            height: `${Math.min(getEventHeight(event), 60 - event.start.getMinutes())}px`,
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
        const taskEvents = events.filter(e => e.type === "task");
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
    </PageShell>
  );
}
