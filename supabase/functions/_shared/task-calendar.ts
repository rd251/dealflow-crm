const TIDSSONE = "Europe/Oslo";
const STANDARD_STARTTID = "09:00";
const VARIGHET_MINUTTER = 30;
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
  const time = task.frist_tid?.match(/^\d{2}:\d{2}/)?.[0]
    || task.frist?.match(/T(\d{2}:\d{2})/)?.[1] || STANDARD_STARTTID;
  // Treat these as Oslo wall-clock values; Google resolves the time-zone offset.
  const end = new Date(`${date}T${time}:00Z`);
  end.setUTCMinutes(end.getUTCMinutes() + VARIGHET_MINUTTER);
  return {
    summary: `✅ ${task.oppgave}${company ? ` – ${company}` : ""}`,
    description: [task.notater, `Prioritet: ${task.prioritet}`, `Åpne i CRM: ${CRM_URL}`].filter(Boolean).join("\n\n"),
    start: { dateTime: `${date}T${time}:00`, timeZone: TIDSSONE },
    end: { dateTime: end.toISOString().slice(0, 19), timeZone: TIDSSONE },
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