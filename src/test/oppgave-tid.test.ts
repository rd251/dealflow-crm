import { describe, expect, it } from "vitest";
import { compareTaskSchedule, taskTitle, taskTime, TASK_TIME_PRESETS } from "@/lib/oppgave-tid";
import { folgOppNa } from "@/lib/i-dag";

describe("oppgavetider", () => {
  it("provides exactly the requested time presets", () => {
    expect(TASK_TIME_PRESETS).toEqual(["08:00", "10:00", "12:00", "14:00", "16:00"]);
  });
  it("keeps missing times missing", () => {
    expect(taskTime(null)).toBe("");
    expect(taskTime("14:15:00")).toBe("14:15");
  });
  it("marks Ring tasks, not other tasks", () => {
    expect(taskTitle("Ring Ajmal igjen")).toBe("📞 Ring Ajmal igjen");
    expect(taskTitle("Send tilbud")).toBe("Send tilbud");
  });
  it("sorts by date then time, with untimed tasks last that day", () => {
    const rows = [
      { id: "untimed", frist: "2026-11-02", frist_tid: "" },
      { id: "late", frist: "2026-11-02", frist_tid: "14:00" },
      { id: "older", frist: "2026-11-01", frist_tid: "" },
      { id: "early", frist: "2026-11-02", frist_tid: "08:00" },
    ];
    expect(rows.sort(compareTaskSchedule).map(r => r.id)).toEqual(["older", "early", "late", "untimed"]);
  });
  it("uses the same time order in Mine/Teamet follow-up lists", () => {
    const base = { oppgave: "Ring", frist: "2026-11-02", status: "Åpen", ansvarlig: "Robin" };
    const rows = folgOppNa([{ ...base, id: "no-time" }, { ...base, id: "late", frist_tid: "16:00" }, { ...base, id: "early", frist_tid: "10:00" }], [], new Date("2026-11-02T12:00:00"));
    expect(rows.map(r => r.id)).toEqual(["early", "late", "no-time"]);
  });
});