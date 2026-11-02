const TIDSSONE = "Europe/Oslo";
import { TASK_DURATION_MINUTES, taskTime, taskTitle } from "./task-time.ts";
const CRM_URL = "https://snakk-ai.lovable.app/oppgaver";

interface CalendarTask {
  id: string;
  oppgave: string;
  frist?: string | null;
  frist_tid?: string | null;
  notater?: string | null;
  prioritet: string;
  google_event_id?: string | null;
}

export function taskCalendarEvent(task: CalendarTask, company = "") {
  const date = (task.frist || new Date().toISOString()).slice(0, 10);
  const time = taskTime(task.frist_tid);
  // Treat these as Oslo wall-clock values; Google resolves the time-zone offset.
  const end = new Date(`${date}T${time || "00:00"}:00Z`);
  end.setUTCMinutes(end.getUTCMinutes() + (time ? TASK_DURATION_MINUTES : 1440));
  return {
    summary: `${taskTitle(task.oppgave)}${company ? ` – ${company}` : ""}`,
    description: [task.notater, `Prioritet: ${task.prioritet}`, `Åpne i CRM: ${CRM_URL}`].filter(Boolean).join("\n\n"),
    start: time ? { dateTime: `${date}T${time}:00`, date: null, timeZone: TIDSSONE } : { date, dateTime: null, timeZone: null },
    end: time ? { dateTime: end.toISOString().slice(0, 19), date: null, timeZone: TIDSSONE } : { date: end.toISOString().slice(0, 10), dateTime: null, timeZone: null },
    transparency: "transparent",
    extendedProperties: { private: { snakk_oppgave_id: task.id } },
  };
}

export function saveTaskCalendarEvent(task: CalendarTask, token: string, company = "", send: typeof fetch = fetch) {
  const eventId = task.google_event_id;
  const url = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
    + (eventId ? `/${encodeURIComponent(eventId)}` : "");
  return send(url, {
    method: eventId ? "PATCH" : "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(taskCalendarEvent(task, company)),
  });
}