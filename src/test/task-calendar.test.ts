import { describe, expect, it, vi } from "vitest";
import { saveTaskCalendarEvent, taskCalendarEvent } from "../../supabase/functions/_shared/task-calendar";

const task = { id: "task-test", oppgave: "Test", frist: "2026-11-02", prioritet: "Medium" };

describe("task calendar scheduling", () => {
  it("moves the existing event to the changed date and 14:00 without creating another", async () => {
    const send = vi.fn().mockResolvedValue(new Response('{"id":"existing-event"}'));
    await saveTaskCalendarEvent({ ...task, google_event_id: "existing-event", frist: "2026-11-03", frist_tid: "14:00" }, "test-token", "", send);
    const [url, options] = send.mock.calls[0];
    expect(url).toBe("https://www.googleapis.com/calendar/v3/calendars/primary/events/existing-event");
    expect(options.method).toBe("PATCH");
    const body = JSON.parse(options.body);
    expect(body.start).toEqual({ dateTime: "2026-11-03T14:00:00", timeZone: "Europe/Oslo" });
    expect(body.end.dateTime).toBe("2026-11-03T14:30:00");
    expect(body.extendedProperties.private.snakk_oppgave_id).toBe("task-test");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("creates a timed 09:00–09:30 event when no time or event ID is set", async () => {
    const send = vi.fn().mockResolvedValue(new Response('{"id":"new-event"}'));
    await saveTaskCalendarEvent(task, "test-token", "", send);
    expect(send.mock.calls[0][1].method).toBe("POST");
    expect(taskCalendarEvent(task).start.dateTime).toBe("2026-11-02T09:00:00");
    expect(taskCalendarEvent(task).end.dateTime).toBe("2026-11-02T09:30:00");
  });

  it("keeps the 30-minute duration when the new time crosses midnight", () => {
    const event = taskCalendarEvent({ ...task, frist_tid: "23:45" });
    expect(event.end.dateTime).toBe("2026-11-03T00:15:00");
  });
});