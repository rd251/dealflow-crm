import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, ListTodo, Clock, CheckCircle2 } from "lucide-react";
import { Oppgave, Prioritet, OppgaveStatus } from "@/data/crm-data";
import { useCrmStore } from "@/hooks/use-crm-store";
import { Badge } from "@/components/ui/badge";

const prioritetColors: Record<Prioritet, string> = {
  "Lav": "bg-muted text-muted-foreground",
  "Medium": "bg-primary/10 text-primary",
  "Høy": "bg-destructive/10 text-destructive",
};

interface InlineTaskFormProps {
  lead_id?: string;
  selskap_id?: string;
  salgsmulighet_id?: string;
}

export default function InlineTaskForm({ lead_id = "", selskap_id = "", salgsmulighet_id = "" }: InlineTaskFormProps) {
  const { oppgaver, updateOppgaver } = useCrmStore();
  const [showForm, setShowForm] = useState(false);
  const [oppgave, setOppgave] = useState("");
  const [frist, setFrist] = useState("");
  const [prioritet, setPrioritet] = useState<Prioritet>("Medium");

  const today = new Date().toISOString().split("T")[0];

  const relatedTasks = oppgaver.filter(o =>
    (lead_id && o.lead_id === lead_id) ||
    (salgsmulighet_id && o.salgsmulighet_id === salgsmulighet_id) ||
    (!lead_id && !salgsmulighet_id && selskap_id && o.selskap_id === selskap_id)
  );

  const addTask = () => {
    if (!oppgave.trim()) return;
    const id = `O-${String(oppgaver.length + 1).padStart(4, "0")}`;
    const ny: Oppgave = {
      id, oppgave, lead_id, selskap_id, salgsmulighet_id,
      ansvarlig: "", frist, prioritet, status: "Åpen", paaminnelse: true, notater: "",
    };
    updateOppgaver(prev => [...prev, ny]);
    setOppgave("");
    setFrist("");
    setPrioritet("Medium");
    setShowForm(false);
  };

  const toggleStatus = (id: string, current: OppgaveStatus) => {
    const next: OppgaveStatus = current === "Ferdig" ? "Åpen" : "Ferdig";
    updateOppgaver(prev => prev.map(o => o.id === id ? { ...o, status: next } : o));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <ListTodo className="w-3.5 h-3.5" />
          Oppgaver ({relatedTasks.length})
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-3 h-3" />{showForm ? "Avbryt" : "Ny oppgave"}
        </Button>
      </div>

      {showForm && (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
          <Input placeholder="Hva skal gjøres?" value={oppgave} onChange={e => setOppgave(e.target.value)} className="h-8 text-sm" />
          <div className="flex gap-2">
            <Input type="date" value={frist} onChange={e => setFrist(e.target.value)} className="h-8 text-sm flex-1" />
            <select className="border rounded-md px-2 py-1 text-xs bg-background h-8" value={prioritet} onChange={e => setPrioritet(e.target.value as Prioritet)}>
              <option value="Lav">Lav</option>
              <option value="Medium">Medium</option>
              <option value="Høy">Høy</option>
            </select>
            <Button size="sm" className="h-8 text-xs" onClick={addTask} disabled={!oppgave.trim()}>Legg til</Button>
          </div>
        </div>
      )}

      {relatedTasks.length > 0 && (
        <div className="space-y-1">
          {relatedTasks.map(task => {
            const overdue = task.frist && task.frist < today && task.status !== "Ferdig";
            return (
              <div
                key={task.id}
                className={`flex items-center gap-2 p-2 rounded-md text-sm border transition-colors ${
                  task.status === "Ferdig" ? "bg-muted/20 opacity-60" : overdue ? "bg-destructive/5 border-destructive/20" : "bg-card"
                }`}
              >
                <button
                  onClick={() => toggleStatus(task.id, task.status)}
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    task.status === "Ferdig" ? "border-primary bg-primary" : "border-muted-foreground/30 hover:border-primary"
                  }`}
                >
                  {task.status === "Ferdig" && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                </button>
                <span className={`flex-1 truncate text-xs ${task.status === "Ferdig" ? "line-through" : ""}`}>{task.oppgave}</span>
                {task.frist && (
                  <span className={`text-[10px] flex items-center gap-0.5 shrink-0 ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                    <Clock className="w-2.5 h-2.5" />
                    {task.frist === today ? "I dag" : new Date(task.frist).toLocaleDateString("nb-NO", { day: "numeric", month: "short" })}
                  </span>
                )}
                <Badge variant="outline" className={`text-[9px] shrink-0 py-0 ${prioritetColors[task.prioritet]}`}>{task.prioritet}</Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
