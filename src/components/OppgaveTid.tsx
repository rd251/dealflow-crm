import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TASK_TIME_PRESETS, taskTime } from "@/lib/oppgave-tid";

export default function OppgaveTid({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <div className="min-w-0 space-y-2" onClick={e => e.stopPropagation()}>
      <label className="grid gap-1 text-xs text-muted-foreground">Klokkeslett (valgfritt)
        <Input type="time" step={900} value={taskTime(value)} onChange={e => onChange(e.target.value)} disabled={disabled} className="h-9 w-full tabular-nums" />
      </label>
      <div className="flex flex-wrap gap-1">
        {TASK_TIME_PRESETS.map(t => <Button key={t} type="button" size="sm" variant={taskTime(value) === t ? "default" : "outline"} disabled={disabled} className="h-7 px-2 text-xs tabular-nums" onClick={() => onChange(t)}>{t}</Button>)}
        <Button type="button" size="sm" variant={!value ? "secondary" : "ghost"} disabled={disabled} className="h-7 px-2 text-xs" onClick={() => onChange("")}>Uten tid</Button>
      </div>
    </div>
  );
}