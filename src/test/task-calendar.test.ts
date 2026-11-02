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
    expect(body.start).toEqual({ dateTime: "2026-11-03T14:00:00", date: null, timeZone: "Europe/Oslo" });
    expect(body.end.dateTime).toBe("2026-11-03T14:15:00");
    expect(body.extendedProperties.private.snakk_oppgave_id).toBe("task-test");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("creates a transparent all-day event when no time is set, never 09:00", async () => {
    const send = vi.fn().mockResolvedValue(new Response('{"id":"new-event"}'));
    await saveTaskCalendarEvent(task, "test-token", "", send);
    expect(send.mock.calls[0][1].method).toBe("POST");
    expect(taskCalendarEvent(task).start).toEqual({ date: "2026-11-02", dateTime: null, timeZone: null });
    expect(taskCalendarEvent(task).end.date).toBe("2026-11-03");
    expect(taskCalendarEvent(task).transparency).toBe("transparent");
  });

  it("keeps the 15-minute duration when the new time crosses midnight", () => {
    const event = taskCalendarEvent({ ...task, frist_tid: "23:55" });
    expect(event.end.dateTime).toBe("2026-11-03T00:10:00");
  });

  it("clears dateTime when PATCH changes a timed task to untimed", async () => {
    const send = vi.fn().mockResolvedValue(new Response('{}'));
    await saveTaskCalendarEvent({ ...task, google_event_id: "existing", frist_tid: "" }, "test-token", "", send);
    const body = JSON.parse(send.mock.calls[0][1].body);
    expect(body.start.dateTime).toBeNull();
    expect(body.start.date).toBe("2026-11-02");
    expect(send.mock.calls[0][1].method).toBe("PATCH");
  });
});