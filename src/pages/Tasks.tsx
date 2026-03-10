import { useState } from "react";
import PageShell from "@/components/PageShell";
import { useCrmStore } from "@/hooks/use-crm-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Bell, BellOff, Calendar, AlertTriangle } from "lucide-react";
import { Task, Priority } from "@/data/crm-data";

const priorityStyles: Record<Priority, string> = {
  Low: "bg-muted text-muted-foreground",
  Normal: "bg-primary/10 text-primary",
  High: "bg-warning/10 text-warning",
  Urgent: "bg-destructive/10 text-destructive",
};

export default function Tasks() {
  const { tasks, companies, deals, toggleTask, updateTasks } = useCrmStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", dueDate: "", priority: "Normal" as Priority, companyId: "", dealId: "", reminder: true });

  const today = new Date().toISOString().split("T")[0];

  const addTask = () => {
    const id = `TASK-${String(tasks.length + 1).padStart(4, "0")}`;
    const newTask: Task = { id, ...form, completed: false, contactId: undefined };
    updateTasks(prev => [...prev, newTask]);
    setDialogOpen(false);
    setForm({ title: "", description: "", dueDate: "", priority: "Normal", companyId: "", dealId: "", reminder: true });
  };

  const visibleTasks = tasks.filter(t => showCompleted || !t.completed);
  const overdue = tasks.filter(t => !t.completed && t.dueDate && t.dueDate < today);

  return (
    <PageShell
      title="Tasks"
      subtitle={`${tasks.filter(t => !t.completed).length} pending · ${overdue.length} overdue`}
      actions={
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setShowCompleted(!showCompleted)}>
            {showCompleted ? "Hide Completed" : "Show Completed"}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" />Add Task</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Task</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Task title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                <Textarea placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                <div className="grid grid-cols-2 gap-3">
                  <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
                  <select className="border rounded-lg px-3 py-2 text-sm bg-background" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority }))}>
                    {(["Low", "Normal", "High", "Urgent"] as Priority[]).map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <select className="w-full border rounded-lg px-3 py-2 text-sm bg-background" value={form.companyId} onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))}>
                  <option value="">Link to company (optional)</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <Button onClick={addTask} className="w-full" disabled={!form.title}>Create Task</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      <div className="space-y-2">
        {visibleTasks.map(task => {
          const isOverdue = !task.completed && task.dueDate && task.dueDate < today;
          const company = companies.find(c => c.id === task.companyId);
          return (
            <div
              key={task.id}
              className={`bg-card border rounded-xl p-4 flex items-start gap-3 animate-slide-in transition-opacity ${task.completed ? "opacity-50" : ""}`}
            >
              <Checkbox
                checked={task.completed}
                onCheckedChange={() => toggleTask(task.id)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`font-medium text-sm ${task.completed ? "line-through" : ""}`}>{task.title}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${priorityStyles[task.priority]}`}>
                    {task.priority}
                  </span>
                  {task.reminder ? <Bell className="w-3 h-3 text-primary" /> : <BellOff className="w-3 h-3 text-muted-foreground/40" />}
                </div>
                {task.description && <p className="text-xs text-muted-foreground mt-1">{task.description}</p>}
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  {task.dueDate && (
                    <span className={`flex items-center gap-1 ${isOverdue ? "text-destructive font-medium" : ""}`}>
                      {isOverdue && <AlertTriangle className="w-3 h-3" />}
                      <Calendar className="w-3 h-3" />
                      {task.dueDate}
                    </span>
                  )}
                  {company && <span>· {company.name}</span>}
                </div>
              </div>
            </div>
          );
        })}
        {visibleTasks.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-sm">No tasks to show</p>
          </div>
        )}
      </div>
    </PageShell>
  );
}
