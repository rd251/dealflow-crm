import { useState, useEffect, useCallback, useMemo } from "react";
import PageShell from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Clock, MapPin, Users } from "lucide-react";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO } from "date-fns";
import { nb } from "date-fns/locale";

const API_URL = import.meta.env.VITE_SUPABASE_URL + '/rest/v1';
const API_HEADERS = {
  'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
  'Content-Type': 'application/json',
};

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end?: Date;
  type: "meeting" | "task" | "activity";
  color: string;
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 07:00 - 20:00

export default function Kalender() {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const weekStart = useMemo(() => startOfWeek(currentWeek, { weekStartsOn: 1 }), [currentWeek]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const fetchEvents = useCallback(async () => {
    const from = days[0].toISOString();
    const to = addDays(days[6], 1).toISOString();
    const allEvents: CalendarEvent[] = [];

    try {
      // Fetch meetings (aktiviteter with type Møte and start_tid)
      const meetingsRes = await fetch(
        `${API_URL}/aktiviteter?type=eq.Møte&start_tid=gte.${from}&start_tid=lte.${to}&select=id,tittel,beskrivelse,start_tid,slutt_tid,type`,
        { headers: API_HEADERS }
      );
      if (meetingsRes.ok) {
        const meetings = await meetingsRes.json();
        meetings.forEach((m: any) => {
          allEvents.push({
            id: m.id,
            title: m.tittel || m.beskrivelse || "Møte",
            start: new Date(m.start_tid),
            end: m.slutt_tid ? new Date(m.slutt_tid) : undefined,
            type: "meeting",
            color: "bg-amber-500/20 border-amber-500 text-amber-700",
          });
        });
      }

      // Fetch tasks with deadlines
      const tasksRes = await fetch(
        `${API_URL}/oppgaver?frist=gte.${days[0].toISOString().split('T')[0]}&frist=lte.${days[6].toISOString().split('T')[0]}&status=neq.Ferdig&select=id,oppgave,frist,prioritet`,
        { headers: API_HEADERS }
      );
      if (tasksRes.ok) {
        const tasks = await tasksRes.json();
        tasks.forEach((t: any) => {
          if (t.frist) {
            allEvents.push({
              id: t.id,
              title: t.oppgave,
              start: new Date(t.frist + "T09:00:00"),
              type: "task",
              color: t.prioritet === "Høy"
                ? "bg-destructive/20 border-destructive text-destructive"
                : "bg-primary/20 border-primary text-primary",
            });
          }
        });
      }

      // Fetch other upcoming activities
      const activitiesRes = await fetch(
        `${API_URL}/aktiviteter?type=neq.Møte&dato=gte.${from}&dato=lte.${to}&select=id,type,beskrivelse,dato`,
        { headers: API_HEADERS }
      );
      if (activitiesRes.ok) {
        const activities = await activitiesRes.json();
        activities.forEach((a: any) => {
          allEvents.push({
            id: a.id,
            title: `${a.type}: ${a.beskrivelse}`.substring(0, 50),
            start: new Date(a.dato),
            type: "activity",
            color: "bg-blue-500/20 border-blue-500 text-blue-700",
          });
        });
      }

      setEvents(allEvents);
    } catch (e) {
      console.error("Error fetching calendar events:", e);
    }
  }, [days]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const getEventsForDay = (day: Date) => events.filter(e => isSameDay(e.start, day));

  const getEventTop = (event: CalendarEvent) => {
    const h = event.start.getHours();
    const m = event.start.getMinutes();
    return ((h - 7) * 60 + m);
  };

  const getEventHeight = (event: CalendarEvent) => {
    if (!event.end) return 30;
    const diffMs = event.end.getTime() - event.start.getTime();
    return Math.max(30, diffMs / 60000);
  };

  const today = new Date();

  return (
    <PageShell title="Kalender" subtitle="Ukeoversikt over møter, oppgaver og aktiviteter">
      {/* Week navigation */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setCurrentWeek(new Date())}>
            I dag
          </Button>
        </div>
        <span className="text-sm font-medium">
          {format(days[0], "d. MMM", { locale: nb })} – {format(days[6], "d. MMM yyyy", { locale: nb })}
        </span>
      </div>

      {/* Week grid */}
      <div className="border rounded-xl overflow-hidden bg-card">
        {/* Day headers */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b">
          <div className="p-2 border-r bg-muted/30" />
          {days.map((day, i) => {
            const isToday = isSameDay(day, today);
            return (
              <div key={i} className={`p-2 text-center border-r last:border-r-0 ${isToday ? "bg-primary/5" : "bg-muted/30"}`}>
                <div className="text-[10px] uppercase text-muted-foreground">
                  {format(day, "EEE", { locale: nb })}
                </div>
                <div className={`text-sm font-semibold ${isToday ? "text-primary" : ""}`}>
                  {format(day, "d")}
                </div>
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] max-h-[600px] overflow-y-auto">
          {/* Time labels + slots */}
          {HOURS.map(hour => (
            <div key={hour} className="contents">
              <div className="h-[60px] border-b border-r px-1 flex items-start justify-end pt-0.5">
                <span className="text-[10px] text-muted-foreground">{String(hour).padStart(2, "0")}:00</span>
              </div>
              {days.map((day, di) => {
                const isToday = isSameDay(day, today);
                const dayEvents = getEventsForDay(day).filter(e => {
                  const h = e.start.getHours();
                  return h === hour;
                });
                return (
                  <div key={di} className={`h-[60px] border-b border-r last:border-r-0 relative ${isToday ? "bg-primary/[0.02]" : ""}`}>
                    {dayEvents.map(event => (
                      <div
                        key={event.id}
                        className={`absolute left-0.5 right-0.5 rounded px-1 py-0.5 text-[10px] leading-tight border-l-2 overflow-hidden ${event.color}`}
                        style={{
                          top: `${event.start.getMinutes()}px`,
                          height: `${Math.min(getEventHeight(event), 60 - event.start.getMinutes())}px`,
                        }}
                      >
                        <span className="font-medium truncate block">{event.title}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* All-day / task events (no specific time) */}
      {(() => {
        const allDayEvents = events.filter(e => e.type === "task");
        if (allDayEvents.length === 0) return null;
        return (
          <div className="mt-4 border rounded-xl p-4 bg-card">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Oppgaver med frist denne uken
            </h3>
            <div className="space-y-2">
              {allDayEvents.sort((a, b) => a.start.getTime() - b.start.getTime()).map(event => (
                <div key={event.id} className={`flex items-center gap-3 p-2 rounded-lg border-l-2 ${event.color}`}>
                  <span className="text-xs font-medium">{format(event.start, "EEE d. MMM", { locale: nb })}</span>
                  <span className="text-xs">{event.title}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </PageShell>
  );
}
