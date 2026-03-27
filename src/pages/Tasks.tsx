import { useState } from "react";
import PageShell from "@/components/PageShell";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/use-auth";
import { useProfiles } from "@/hooks/use-profiles";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Bell, BellOff, Calendar, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Oppgave, OppgaveStatus, Prioritet } from "@/data/crm-data";
import { toast } from "sonner";

const prioritetColors: Record<Prioritet, string> = {
  "Lav": "bg-muted text-muted-foreground",
  "Medium": "bg-primary/10 text-primary",
  "Høy": "bg-destructive/10 text-destructive",
};

const statusOptions: OppgaveStatus[] = ["Åpen", "Pågår", "Ferdig"];

export default function Tasks() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { profiles } = useProfiles();
  const { oppgaver, selskaper, updateOppgaver, generateId } = useCrmStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState<"alle" | "forfalte" | "idag" | "uke">("alle");
  const [form, setForm] = useState({ oppgave: "", frist: "", prioritet: "Medium" as Prioritet, lead_id: "", selskap_id: "", salgsmulighet_id: "", ansvarlig: "", notater: "" });

  const today = new Date().toISOString().split("T")[0];
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

  const sendNotification = async (assigneeUserId: string, taskName: string) => {
    if (!user || assigneeUserId === user.id) return;
    const senderProfile = profiles.find(p => p.user_id === user.id);
    const senderName = senderProfile?.display_name || user.email || "Noen";
    await supabase.from("varsler").insert({
      user_id: assigneeUserId,
      type: "oppgave_delegert",
      tittel: `Ny oppgave tildelt deg`,
      beskrivelse: `${senderName} har tildelt deg oppgaven: "${taskName}"`,
      fra_user_id: user.id,
      lenke: "/oppgaver",
    });
  };

  const addOppgave = async () => {
    const id = generateId("O", oppgaver);
    const ny: Oppgave = { id, ...form, status: "Åpen", paaminnelse: true };
    updateOppgaver(prev => [ny, ...prev]);
    setDialogOpen(false);

    // Send notification if assigned to someone else
    if (form.ansvarlig && form.ansvarlig !== user?.id) {
      await sendNotification(form.ansvarlig, form.oppgave);
      const assignee = profiles.find(p => p.user_id === form.ansvarlig);
      toast.success(`Oppgave delegert til ${assignee?.display_name || "bruker"}`);
    }

    setForm({ oppgave: "", frist: "", prioritet: "Medium", lead_id: "", selskap_id: "", salgsmulighet_id: "", ansvarlig: "", notater: "" });
  };

  const changeStatus = (id: string, status: OppgaveStatus) => {
    updateOppgaver(prev => prev.map(o => o.id === id ? { ...o, status } : o));
  };

  const changeAnsvarlig = async (taskId: string, newUserId: string) => {
    const task = oppgaver.find(o => o.id === taskId);
    if (!task) return;
    updateOppgaver(prev => prev.map(o => o.id === taskId ? { ...o, ansvarlig: newUserId } : o));
    if (newUserId && newUserId !== user?.id) {
      await sendNotification(newUserId, task.oppgave);
      const assignee = profiles.find(p => p.user_id === newUserId);
      toast.success(`Oppgave delegert til ${assignee?.display_name || "bruker"}`);
    }
  };

  const forfalte = oppgaver.filter(o => o.status !== "Ferdig" && o.frist && o.frist < today);
  const idagOppgaver = oppgaver.filter(o => o.status !== "Ferdig" && o.frist === today);
  const ukeOppgaver = oppgaver.filter(o => o.status !== "Ferdig" && o.frist >= today && o.frist <= weekEnd);

  const prioritetOrder: Record<Prioritet, number> = { "Høy": 0, "Medium": 1, "Lav": 2 };

  const sortTasks = (tasks: Oppgave[]) => {
    return [...tasks].sort((a, b) => {
      if (a.status === "Ferdig" && b.status !== "Ferdig") return 1;
      if (a.status !== "Ferdig" && b.status === "Ferdig") return -1;
      if (a.status === "Ferdig" && b.status === "Ferdig") return 0;
      const aOverdue = a.frist && a.frist < today ? 1 : 0;
      const bOverdue = b.frist && b.frist < today ? 1 : 0;
      if (aOverdue !== bOverdue) return bOverdue - aOverdue;
      const pDiff = prioritetOrder[a.prioritet] - prioritetOrder[b.prioritet];
      if (pDiff !== 0) return pDiff;
      if (a.frist && b.frist) return a.frist.localeCompare(b.frist);
      if (a.frist) return -1;
      if (b.frist) return 1;
      return 0;
    });
  };

  let visibleTasks = sortTasks(oppgaver);
  if (filter === "forfalte") visibleTasks = sortTasks(forfalte);
  else if (filter === "idag") visibleTasks = sortTasks(idagOppgaver);
  else if (filter === "uke") visibleTasks = sortTasks(ukeOppgaver);

  const getProfileName = (userId: string) => profiles.find(p => p.user_id === userId)?.display_name;

  return (
    <PageShell
      title="Oppgaver"
      subtitle={`${oppgaver.filter(o => o.status !== "Ferdig").length} åpne · ${forfalte.length} forfalte`}
      actions={
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />{!isMobile && "Ny oppgave"}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
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
              <select className="w-full border rounded-lg px-3 py-2 text-sm bg-background" value={form.ansvarlig} onChange={e => setForm(f => ({ ...f, ansvarlig: e.target.value }))}>
                <option value="">Velg ansvarlig (valgfritt)</option>
                {profiles.map(p => (
                  <option key={p.user_id} value={p.user_id}>
                    {p.display_name}{p.user_id === user?.id ? " (deg)" : ""}
                  </option>
                ))}
              </select>
              <Textarea placeholder="Notater" value={form.notater} onChange={e => setForm(f => ({ ...f, notater: e.target.value }))} />
              <Button onClick={addOppgave} className="w-full" disabled={!form.oppgave}>Opprett oppgave</Button>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="flex gap-2 mb-4 flex-wrap">
        {([["alle", "Alle"], ["forfalte", `Forfalte (${forfalte.length})`], ["idag", `I dag (${idagOppgaver.length})`], ["uke", `Uke (${ukeOppgaver.length})`]] as const).map(([key, label]) => (
          <Button key={key} size="sm" variant={filter === key ? "default" : "outline"} onClick={() => setFilter(key)} className="text-xs">{label}</Button>
        ))}
      </div>

      <div className="space-y-2">
        {visibleTasks.map(task => {
          const isOverdue = task.status !== "Ferdig" && task.frist && task.frist < today;
          const selskap = selskaper.find(s => s.id === task.selskap_id);
          const ansvarligNavn = task.ansvarlig ? getProfileName(task.ansvarlig) : null;
          return (
            <div key={task.id} className={`bg-card border rounded-xl p-4 flex items-start gap-3 animate-slide-in transition-opacity ${task.status === "Ferdig" ? "opacity-50" : ""}`}>
              <Checkbox checked={task.status === "Ferdig"} onCheckedChange={() => changeStatus(task.id, task.status === "Ferdig" ? "Åpen" : "Ferdig")} className="mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`font-medium text-sm ${task.status === "Ferdig" ? "line-through" : ""}`}>{task.oppgave}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${prioritetColors[task.prioritet]}`}>{task.prioritet}</span>
                  {!isMobile && (task.paaminnelse ? <Bell className="w-3 h-3 text-primary" /> : <BellOff className="w-3 h-3 text-muted-foreground/40" />)}
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
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
                  {selskap && <span className="truncate">· {selskap.firmanavn}</span>}
                  <span className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <User className="w-3 h-3" />
                    <select
                      className="text-xs border-0 bg-transparent cursor-pointer"
                      value={task.ansvarlig}
                      onChange={e => changeAnsvarlig(task.id, e.target.value)}
                    >
                      <option value="">Ikke tildelt</option>
                      {profiles.map(p => (
                        <option key={p.user_id} value={p.user_id}>
                          {p.display_name}{p.user_id === user?.id ? " (deg)" : ""}
                        </option>
                      ))}
                    </select>
                  </span>
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
