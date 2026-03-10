import { useState } from "react";
import PageShell from "@/components/PageShell";
import { useCrmStore } from "@/hooks/use-crm-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Bell, BellOff, Calendar, AlertTriangle } from "lucide-react";
import { Oppgave, OppgaveStatus, Prioritet } from "@/data/crm-data";

const prioritetColors: Record<Prioritet, string> = {
  "Lav": "bg-muted text-muted-foreground",
  "Medium": "bg-primary/10 text-primary",
  "Høy": "bg-destructive/10 text-destructive",
};

const statusOptions: OppgaveStatus[] = ["Åpen", "Pågår", "Ferdig"];

export default function Tasks() {
  const { oppgaver, selskaper, updateOppgaver, generateId } = useCrmStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState<"alle" | "forfalte" | "idag" | "uke">("alle");
  const [form, setForm] = useState({ oppgave: "", frist: "", prioritet: "Medium" as Prioritet, lead_id: "", selskap_id: "", salgsmulighet_id: "", ansvarlig: "", notater: "" });

  const today = new Date().toISOString().split("T")[0];
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

  const addOppgave = () => {
    const id = generateId("O", oppgaver);
    const ny: Oppgave = { id, ...form, status: "Åpen", paaminnelse: true };
    updateOppgaver(prev => [...prev, ny]);
    setDialogOpen(false);
    setForm({ oppgave: "", frist: "", prioritet: "Medium", lead_id: "", selskap_id: "", salgsmulighet_id: "", ansvarlig: "", notater: "" });
  };

  const changeStatus = (id: string, status: OppgaveStatus) => {
    updateOppgaver(prev => prev.map(o => o.id === id ? { ...o, status } : o));
  };

  const forfalte = oppgaver.filter(o => o.status !== "Ferdig" && o.frist && o.frist < today);
  const idagOppgaver = oppgaver.filter(o => o.status !== "Ferdig" && o.frist === today);
  const ukeOppgaver = oppgaver.filter(o => o.status !== "Ferdig" && o.frist >= today && o.frist <= weekEnd);

  let visibleTasks = oppgaver;
  if (filter === "forfalte") visibleTasks = forfalte;
  else if (filter === "idag") visibleTasks = idagOppgaver;
  else if (filter === "uke") visibleTasks = ukeOppgaver;

  return (
    <PageShell
      title="Oppgaver"
      subtitle={`${oppgaver.filter(o => o.status !== "Ferdig").length} åpne · ${forfalte.length} forfalte`}
      actions={
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />Ny oppgave</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Ny oppgave</DialogTitle><DialogDescription>Fyll inn detaljer for den nye oppgaven.</DialogDescription></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Oppgave" value={form.oppgave} onChange={e => setForm(f => ({ ...f, oppgave: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <Input type="date" value={form.frist} onChange={e => setForm(f => ({ ...f, frist: e.target.value }))} />
                <select className="border rounded-lg px-3 py-2 text-sm bg-background" value={form.prioritet} onChange={e => setForm(f => ({ ...f, prioritet: e.target.value as Prioritet }))}>
                  {(["Lav", "Medium", "Høy"] as Prioritet[]).map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <select className="w-full border rounded-lg px-3 py-2 text-sm bg-background" value={form.selskap_id} onChange={e => setForm(f => ({ ...f, selskap_id: e.target.value }))}>
                <option value="">Knytt til selskap (valgfritt)</option>
                {selskaper.map(s => <option key={s.id} value={s.id}>{s.firmanavn}</option>)}
              </select>
              <Input placeholder="Ansvarlig" value={form.ansvarlig} onChange={e => setForm(f => ({ ...f, ansvarlig: e.target.value }))} />
              <Textarea placeholder="Notater" value={form.notater} onChange={e => setForm(f => ({ ...f, notater: e.target.value }))} />
              <Button onClick={addOppgave} className="w-full" disabled={!form.oppgave}>Opprett oppgave</Button>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="flex gap-2 mb-4">
        {([["alle", "Alle"], ["forfalte", `Forfalte (${forfalte.length})`], ["idag", `I dag (${idagOppgaver.length})`], ["uke", `Denne uken (${ukeOppgaver.length})`]] as const).map(([key, label]) => (
          <Button key={key} size="sm" variant={filter === key ? "default" : "outline"} onClick={() => setFilter(key)}>{label}</Button>
        ))}
      </div>

      <div className="space-y-2">
        {visibleTasks.map(task => {
          const isOverdue = task.status !== "Ferdig" && task.frist && task.frist < today;
          const selskap = selskaper.find(s => s.id === task.selskap_id);
          return (
            <div key={task.id} className={`bg-card border rounded-xl p-4 flex items-start gap-3 animate-slide-in transition-opacity ${task.status === "Ferdig" ? "opacity-50" : ""}`}>
              <Checkbox checked={task.status === "Ferdig"} onCheckedChange={() => changeStatus(task.id, task.status === "Ferdig" ? "Åpen" : "Ferdig")} className="mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`font-medium text-sm ${task.status === "Ferdig" ? "line-through" : ""}`}>{task.oppgave}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${prioritetColors[task.prioritet]}`}>{task.prioritet}</span>
                  {task.paaminnelse ? <Bell className="w-3 h-3 text-primary" /> : <BellOff className="w-3 h-3 text-muted-foreground/40" />}
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span onClick={e => e.stopPropagation()}>
                    <select className="text-xs border-0 bg-transparent cursor-pointer" value={task.status} onChange={e => changeStatus(task.id, e.target.value as OppgaveStatus)}>
                      {statusOptions.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </span>
                  {task.frist && (
                    <span className={`flex items-center gap-1 ${isOverdue ? "text-destructive font-medium" : ""}`}>
                      {isOverdue && <AlertTriangle className="w-3 h-3" />}
                      <Calendar className="w-3 h-3" />
                      {task.frist}
                    </span>
                  )}
                  {selskap && <span>· {selskap.firmanavn}</span>}
                </div>
              </div>
            </div>
          );
        })}
        {visibleTasks.length === 0 && (
          <div className="text-center py-16 text-muted-foreground"><p className="text-sm">Ingen oppgaver å vise</p></div>
        )}
      </div>
    </PageShell>
  );
}
