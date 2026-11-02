export const TASK_DURATION_MINUTES = 15;
export const TASK_TIME_PRESETS = ["08:00", "10:00", "12:00", "14:00", "16:00"] as const;

export function taskTime(value?: string | null): string {
  return value?.match(/^([01]\d|2[0-3]):[0-5]\d(?:$|:)/)?.[0].slice(0, 5) || "";
}

export function taskTitle(title: string): string {
  return /^ring\b/i.test(title.trim()) ? `📞 ${title}` : title;
}

export function compareTaskSchedule(a: { frist?: string | null; frist_tid?: string | null }, b: { frist?: string | null; frist_tid?: string | null }): number {
  return (a.frist || "9999").slice(0, 10).localeCompare((b.frist || "9999").slice(0, 10))
    || (taskTime(a.frist_tid) || "99:99").localeCompare(taskTime(b.frist_tid) || "99:99");
}