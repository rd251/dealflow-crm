import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format, isTomorrow } from "date-fns";
import { nb } from "date-fns/locale";
import { CalendarDays, Check, ChevronRight, Link2, Pencil, Trash2, Users } from "lucide-react";
import PageShell from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useAuth } from "@/hooks/use-auth";
import { useProfiles } from "@/hooks/use-profiles";
import { gravatarUrl } from "@/lib/gravatar";
import { cn } from "@/lib/utils";
import { Oppgave, OppgaveStatus, Prioritet } from "@/data/crm-data";
import { toast } from "sonner";

const tabs = [
  ["idag", "I dag"],
  ["uke", "Denne uken"],
  ["aapne", "Alle åpne"],
  ["ferdig", "Ferdig"],
] as const;
type Filter = typeof tabs[number][0];

const priorityDot: Record<Prioritet, string> = {
  Høy: "bg-destructive",
  Medium: "bg-warning",
  Lav: "bg-muted-foreground",
};

const emptyForm = { oppgave: "", frist: "", prioritet: "Medium" as Prioritet, lead_id: "", selskap_id: "", salgsmulighet_id: "", kontakt_id: "", ansvarlig: "", notater: "" };

function initials(name: string) {
  return name.split(" ").map(part => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export default function Tasks() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialFilter = searchParams.get("filter") === "forfalte" ? "aapne" : "idag";
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickDue, setQuickDue] = useState("");
  const [quickLink, setQuickLink] = useState("");
  const [editingTask, setEditingTask] = useState<Oppgave | null>(null);
  const { user, isAdmin, canEdit } = useAuth();
  const { profiles } = useProfiles();
  const { oppgaver, selskaper, leads, salgsmuligheter, updateOppgaver, generateId } = useCrmStore();

  const today = format(new Date(), "yyyy-MM-dd");
  const weekEndDate = new Date();
  weekEndDate.setDate(weekEndDate.getDate() + 7);
  const weekEnd = format(weekEndDate, "yyyy-MM-dd");
  const currentProfile = profiles.find(profile => profile.user_id === user?.id);

  const profileMap = useMemo(() => new Map(profiles.map(profile => [profile.user_id, profile])), [profiles]);
  const companyMap = useMemo(() => new Map(selskaper.map(item => [item.id, item])), [selskaper]);
  const leadMap = useMemo(() => new Map(leads.map(item => [item.id, item])), [leads]);
  const dealMap = useMemo(() => new Map(salgsmuligheter.map(item => [item.id, item])), [salgsmuligheter]);

  const relationOptions = useMemo(() => [
    ...selskaper.map(item => ({ value: `selskap:${item.id}`, label: item.firmanavn })),
    ...leads.map(item => ({ value: `lead:${item.id}`, label: `${item.firmanavn} · lead` })),
    ...salgsmuligheter.map(item => ({ value: `deal:${item.id}`, label: `${item.navn} · salg` })),
  ].sort((a, b) => a.label.localeCompare(b.label, "nb")), [selskaper, leads, salgsmuligheter]);

  const createTask = () => {
    if (!quickTitle.trim() || !canEdit) return;
    const relation = quickLink ? quickLink.split(":") : [];
    const type = relation[0];
    const id = relation.slice(1).join(":");
    const task: Oppgave = {
      id: generateId("O", oppgaver),
      ...emptyForm,
      oppgave: quickTitle.trim(),
      frist: quickDue,
      ansvarlig: user?.id || "",
      selskap_id: type === "selskap" ? id : "",
      lead_id: type === "lead" ? id : "",
      salgsmulighet_id: type === "deal" ? id : "",
      status: "Åpen",
      paaminnelse: true,
    };
    updateOppgaver(previous => [task, ...previous]);
    setQuickTitle("");
    setQuickDue("");
    setQuickLink("");
    toast.success("Oppgave opprettet");
  };

  const completeTask = (id: string) => {
    updateOppgaver(previous => previous.map(item => item.id === id ? { ...item, status: "Ferdig" as OppgaveStatus } : item));
    toast.success("Oppgaven er ferdig");
  };

  const saveEdit = () => {
    if (!editingTask?.oppgave.trim()) return;
    updateOppgaver(previous => previous.map(item => item.id === editingTask.id ? editingTask : item));
    setEditingTask(null);
    toast.success("Oppgave oppdatert");
  };

  const deleteTask = (id: string) => {
    updateOppgaver(previous => previous.filter(item => item.id !== id));
    setEditingTask(null);
    toast.success("Oppgave slettet");
  };

  const myTasks = oppgaver.filter(item => item.ansvarlig === user?.id);
  const filteredTasks = myTasks.filter(item => {
    if (filter === "ferdig") return item.status === "Ferdig";
    if (item.status === "Ferdig") return false;
    if (filter === "idag") return !!item.frist && item.frist <= today;
    if (filter === "uke") return !!item.frist && item.frist <= weekEnd;
    return true;
  }).sort((a, b) => {
    const bucket = (item: Oppgave) => {
      if (item.status === "Ferdig") return 4;
      if (item.frist && item.frist < today) return 0;
      if (item.frist === today) return 1;
      if (item.frist && item.frist <= weekEnd) return 2;
      if (!item.frist) return 3;
      return 3;
    };
    const bucketDiff = bucket(a) - bucket(b);
    if (bucketDiff) return bucketDiff;
    return (a.frist || "9999").localeCompare(b.frist || "9999");
  });

  const relationFor = (task: Oppgave) => {
    if (task.selskap_id) return { label: companyMap.get(task.selskap_id)?.firmanavn, href: `/selskaper/${task.selskap_id}` };
    if (task.lead_id) return { label: leadMap.get(task.lead_id)?.firmanavn, href: `/leads?open=${task.lead_id}` };
    if (task.salgsmulighet_id) return { label: dealMap.get(task.salgsmulighet_id)?.navn, href: `/salgsmuligheter?open=${task.salgsmulighet_id}` };
    return null;
  };

  const dueLabel = (date: string) => {
    if (!date) return "Uten frist";
    if (date < today) {
      const days = Math.max(1, Math.round((new Date(today).getTime() - new Date(date).getTime()) / 86400000));
      return `${days} ${days === 1 ? "dag" : "dager"} siden`;
    }
    if (date === today) return "I dag";
    if (isTomorrow(new Date(`${date}T12:00:00`))) return "I morgen";
    return format(new Date(`${date}T12:00:00`), "d. MMM", { locale: nb });
  };

  const adminRows = profiles.map(profile => {
    const open = oppgaver.filter(item => item.ansvarlig === profile.user_id && item.status !== "Ferdig");
    return { profile, open: open.length, overdue: open.filter(item => item.frist && item.frist < today).length };
  }).filter(item => item.open > 0).sort((a, b) => b.open - a.open);
  const highestLoad = adminRows[0]?.open || 0;

  return (
    <PageShell title="Oppgaver" subtitle={`${myTasks.filter(item => item.status !== "Ferdig").length} åpne oppgaver i min liste`}>
      {canEdit && (
        <section className="mb-5 rounded-lg border bg-card p-3">
          <div className="flex flex-col gap-2 lg:flex-row">
            <Input
              value={quickTitle}
              onChange={event => setQuickTitle(event.target.value)}
              onKeyDown={event => { if (event.key === "Enter") createTask(); }}
              placeholder="Skriv en oppgave og trykk Enter"
              className="h-10 flex-1"
              aria-label="Ny oppgave"
            />
            <Input type="date" value={quickDue} onChange={event => setQuickDue(event.target.value)} className="h-10 lg:w-40" aria-label="Frist" />
            <select value={quickLink} onChange={event => setQuickLink(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm lg:w-64" aria-label="Tilknytning">
              <option value="">Ingen tilknytning</option>
              {relationOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <Button onClick={createTask} disabled={!quickTitle.trim()} className="h-10">Legg til</Button>
          </div>
        </section>
      )}

      <div className="mb-5 flex gap-1 overflow-x-auto border-b">
        {tabs.map(([key, label]) => (
          <Button key={key} variant="ghost" onClick={() => setFilter(key)} className={cn("shrink-0 rounded-none border-b-2 border-transparent px-3", filter === key && "border-primary text-primary")}>{label}</Button>
        ))}
      </div>

      <div className={cn("grid grid-cols-1 gap-5", isAdmin && "xl:grid-cols-[minmax(0,1fr)_340px]") }>
        <section>
          <h2 className="mb-3 text-sm font-semibold">Min liste</h2>
          <div className="space-y-2">
            {filteredTasks.length === 0 && <div className="rounded-lg border bg-card px-4 py-12 text-center text-sm text-muted-foreground">Ingen oppgaver å vise.</div>}
            {filteredTasks.map(task => {
              const overdue = task.status !== "Ferdig" && !!task.frist && task.frist < today;
              const dueToday = task.status !== "Ferdig" && task.frist === today;
              const profile = profileMap.get(task.ansvarlig) || currentProfile;
              const relation = relationFor(task);
              const avatarSource = profile ? profile.avatar_url || gravatarUrl(profile.email) || undefined : undefined;
              return (
                <article key={task.id} className={cn(
                  "rounded-lg border bg-card p-4",
                  overdue && "border-destructive/40 bg-destructive/5",
                  dueToday && "border-warning/50 bg-warning/5",
                  task.status === "Ferdig" && "bg-muted/40 opacity-70",
                )}>
                  <div className="flex items-start gap-3">
                    <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", priorityDot[task.prioritet])} title={`Prioritet: ${task.prioritet}`} />
                    <div className="min-w-0 flex-1">
                      <button type="button" onClick={() => canEdit && setEditingTask({ ...task })} className={cn("block max-w-full text-left text-sm font-semibold hover:text-primary", task.status === "Ferdig" && "line-through")}>{task.oppgave}</button>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        {relation?.label && <Button variant="link" size="sm" onClick={() => navigate(relation.href)} className="h-auto p-0 text-xs"><Link2 className="mr-1 h-3 w-3" />{relation.label}</Button>}
                        <span className={cn("flex items-center gap-1 text-muted-foreground", overdue && "font-medium text-destructive", dueToday && "font-medium text-warning-foreground")}><CalendarDays className="h-3 w-3" />{dueLabel(task.frist)}</span>
                      </div>
                    </div>
                    {profile && (
                      <Avatar className="h-8 w-8 shrink-0">
                        {avatarSource && <AvatarImage src={avatarSource} alt={profile.display_name} />}
                        <AvatarFallback className="text-[10px]">{initials(profile.display_name)}</AvatarFallback>
                      </Avatar>
                    )}
                    {canEdit && task.status !== "Ferdig" && <Button size="sm" variant="outline" onClick={() => completeTask(task.id)} className="shrink-0"><Check className="mr-1 h-4 w-4" /><span className="hidden sm:inline">Merk ferdig</span></Button>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {isAdmin && (
          <aside>
            <div className="sticky top-4 overflow-hidden rounded-lg border bg-card">
              <header className="border-b px-4 py-3"><h2 className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4 text-primary" />Oversikt</h2></header>
              {adminRows.length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted-foreground">Ingen åpne oppgaver.</p> : (
                <div className="divide-y">
                  {adminRows.map(({ profile, open, overdue }) => {
                    const avatarSource = profile.avatar_url || gravatarUrl(profile.email) || undefined;
                    return (
                      <div key={profile.user_id} className={cn("flex items-center gap-3 px-4 py-3", open === highestLoad && "bg-primary/5")}>
                        <Avatar className="h-8 w-8"><AvatarImage src={avatarSource} alt={profile.display_name} /><AvatarFallback className="text-[10px]">{initials(profile.display_name)}</AvatarFallback></Avatar>
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{profile.display_name}</p><p className="text-xs text-muted-foreground">{open} åpne</p></div>
                        {overdue > 0 && <span className="text-xs font-semibold text-destructive">{overdue} forfalt</span>}
                        {open === highestLoad && <ChevronRight className="h-4 w-4 text-primary" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      <Dialog open={!!editingTask} onOpenChange={open => { if (!open) setEditingTask(null); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="h-4 w-4" />Rediger oppgave</DialogTitle><DialogDescription>Endre detaljer for oppgaven.</DialogDescription></DialogHeader>
          {editingTask && (
            <div className="space-y-3">
              <Input value={editingTask.oppgave} onChange={event => setEditingTask({ ...editingTask, oppgave: event.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <Input type="date" value={editingTask.frist} onChange={event => setEditingTask({ ...editingTask, frist: event.target.value })} />
                <select className="rounded-md border bg-background px-3 text-sm" value={editingTask.prioritet} onChange={event => setEditingTask({ ...editingTask, prioritet: event.target.value as Prioritet })}>{(["Lav", "Medium", "Høy"] as Prioritet[]).map(value => <option key={value}>{value}</option>)}</select>
              </div>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={editingTask.ansvarlig} onChange={event => setEditingTask({ ...editingTask, ansvarlig: event.target.value })}><option value="">Ikke tildelt</option>{profiles.map(profile => <option key={profile.user_id} value={profile.user_id}>{profile.display_name}</option>)}</select>
              <Textarea value={editingTask.notater} onChange={event => setEditingTask({ ...editingTask, notater: event.target.value })} placeholder="Notater" />
              <div className="flex gap-2"><Button onClick={saveEdit} className="flex-1">Lagre</Button><Button variant="destructive" size="icon" onClick={() => deleteTask(editingTask.id)} aria-label="Slett oppgave"><Trash2 className="h-4 w-4" /></Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
