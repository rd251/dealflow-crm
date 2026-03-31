import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Sparkles, Send, Loader2, ListChecks,
  ExternalLink, CheckCircle2, ArrowUp, PhoneCall,
  Mail, Pencil, SkipForward, Clock, ListTodo, X,
} from "lucide-react";
import { toast } from "sonner";

interface AiItem {
  navn: string;
  selskap: string;
  handling: string;
  prioritet: "høy" | "medium" | "lav";
  type: "deal" | "lead" | "meeting" | "task" | "general";
  entityId?: string;
  entityType?: "salgsmulighet" | "lead" | "selskap" | "oppgave";
}

interface SuggestedTask {
  oppgave: string;
  frist?: string;
  prioritet: "Høy" | "Medium" | "Lav";
  salgsmulighet_id?: string;
  selskap_id?: string;
  lead_id?: string;
}

interface SuggestedActivity {
  type: "Telefonsamtale" | "E-post" | "LinkedIn-melding" | "SMS" | "Møte" | "Notat";
  tittel: string;
  beskrivelse: string;
  salgsmulighet_id?: string;
  selskap_id?: string;
  lead_id?: string;
  kontakt_id?: string;
}

interface SuggestedEmail {
  to?: string;
  to_name: string;
  subject: string;
  body: string;
  reason: string;
  entity_id?: string;
  entity_type?: "salgsmulighet" | "lead";
  entity_name?: string;
  selskap_id?: string;
  selskap_navn?: string;
  kontakt_id?: string;
  prioritet: "høy" | "medium" | "lav";
}

interface AiResponse {
  summary: string;
  items: AiItem[];
  suggested_tasks: SuggestedTask[];
  suggested_activities: SuggestedActivity[];
  suggested_emails: SuggestedEmail[];
}

interface AiCommandBarProps {
  context: any;
  userName?: string;
}

const QUICK_PROMPTS = [
  { icon: "📋", label: "Prep neste møte" },
  { icon: "🔁", label: "Oppsummer siste samtaler" },
  { icon: "🎯", label: "Top 5 prioriteringer" },
  { icon: "📞", label: "Deals som trenger oppfølging" },
  { icon: "✉️", label: "Skriv oppfølging til disse" },
];

const prioritetColor: Record<string, string> = {
  "høy": "bg-destructive/10 text-destructive border-destructive/20",
  "medium": "bg-amber-500/10 text-amber-600 border-amber-200",
  "lav": "bg-muted text-muted-foreground border-border",
};

type EmailState = "pending" | "editing" | "sending" | "sent" | "skipped" | "task_created";

export default function AiCommandBar({ context, userName }: AiCommandBarProps) {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AiResponse | null>(null);
  const [creatingTasks, setCreatingTasks] = useState(false);
  const [createdTaskIds, setCreatedTaskIds] = useState<Set<number>>(new Set());
  const [createdActivityIds, setCreatedActivityIds] = useState<Set<number>>(new Set());
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Email draft states
  const [emailStates, setEmailStates] = useState<Map<number, EmailState>>(new Map());
  const [editingEmails, setEditingEmails] = useState<Map<number, { subject: string; body: string; to: string }>>(new Map());

  const handleSubmit = async (prompt?: string) => {
    const msg = prompt || input.trim();
    if (!msg || loading) return;
    setInput("");
    setLoading(true);
    setResponse(null);
    setCreatedTaskIds(new Set());
    setCreatedActivityIds(new Set());
    setEmailStates(new Map());
    setEditingEmails(new Map());

    try {
      const { data, error } = await supabase.functions.invoke("ai-command", {
        body: { message: msg, context },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      setResponse(data as AiResponse);
    } catch (e: any) {
      console.error("AI command error:", e);
      toast.error("Kunne ikke kontakte AI. Prøv igjen.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (task: SuggestedTask, index: number) => {
    try {
      const { error } = await supabase.from("oppgaver").insert({
        oppgave: task.oppgave,
        frist: task.frist || null,
        prioritet: task.prioritet,
        status: "Åpen",
        salgsmulighet_id: task.salgsmulighet_id || null,
        selskap_id: task.selskap_id || null,
        lead_id: task.lead_id || null,
      });
      if (error) throw error;
      setCreatedTaskIds((prev) => new Set([...prev, index]));
      toast.success("Oppgave opprettet");
    } catch {
      toast.error("Kunne ikke opprette oppgave");
    }
  };

  const handleCreateAllTasks = async () => {
    if (!response?.suggested_tasks?.length) return;
    setCreatingTasks(true);
    let success = 0;
    for (let i = 0; i < response.suggested_tasks.length; i++) {
      if (createdTaskIds.has(i)) continue;
      try {
        const task = response.suggested_tasks[i];
        const { error } = await supabase.from("oppgaver").insert({
          oppgave: task.oppgave,
          frist: task.frist || null,
          prioritet: task.prioritet,
          status: "Åpen",
          salgsmulighet_id: task.salgsmulighet_id || null,
          selskap_id: task.selskap_id || null,
          lead_id: task.lead_id || null,
        });
        if (!error) {
          success++;
          setCreatedTaskIds((prev) => new Set([...prev, i]));
        }
      } catch {}
    }
    setCreatingTasks(false);
    toast.success(`${success} oppgaver opprettet`);
  };

  const handleLogActivity = async (activity: SuggestedActivity, index: number) => {
    try {
      const { error } = await supabase.from("aktiviteter").insert({
        type: activity.type,
        tittel: activity.tittel,
        beskrivelse: activity.beskrivelse,
        dato: new Date().toISOString(),
        salgsmulighet_id: activity.salgsmulighet_id || null,
        selskap_id: activity.selskap_id || null,
        lead_id: activity.lead_id || null,
        kontakt_id: activity.kontakt_id || null,
        aktivitet_kilde: "ai-assistent",
      });
      if (error) throw error;
      setCreatedActivityIds((prev) => new Set([...prev, index]));
      toast.success("Aktivitet logget");
    } catch {
      toast.error("Kunne ikke logge aktivitet");
    }
  };

  const handleNavigate = (item: AiItem) => {
    if (!item.entityId || !item.entityType) return;
    switch (item.entityType) {
      case "salgsmulighet": navigate(`/salgsmuligheter?open=${item.entityId}`); break;
      case "lead": navigate(`/leads`); break;
      case "selskap": navigate(`/selskaper/${item.entityId}`); break;
    }
  };

  // ─── EMAIL ACTIONS ───
  const setEmailState = (index: number, state: EmailState) => {
    setEmailStates((prev) => new Map(prev).set(index, state));
  };

  const handleEditEmail = (index: number, email: SuggestedEmail) => {
    setEditingEmails((prev) => new Map(prev).set(index, {
      subject: email.subject,
      body: email.body,
      to: email.to || "",
    }));
    setEmailState(index, "editing");
  };

  const handleCancelEdit = (index: number) => {
    setEditingEmails((prev) => {
      const next = new Map(prev);
      next.delete(index);
      return next;
    });
    setEmailState(index, "pending");
  };

  const handleSendEmail = async (index: number, email: SuggestedEmail) => {
    const edited = editingEmails.get(index);
    const to = edited?.to || email.to;
    const subject = edited?.subject || email.subject;
    const body = edited?.body || email.body;

    if (!to) {
      toast.error("Mangler e-postadresse. Klikk Rediger for å legge til.");
      return;
    }

    setEmailState(index, "sending");

    try {
      const { data, error } = await supabase.functions.invoke("gmail-send", {
        body: {
          to,
          subject,
          body,
          entity_id: email.entity_id || null,
          entity_type: email.entity_type || null,
          selskap_id: email.selskap_id || null,
          kontakt_id: email.kontakt_id || null,
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        setEmailState(index, "pending");
        return;
      }

      setEmailState(index, "sent");
      toast.success(`E-post sendt til ${email.to_name}`);
    } catch (e: any) {
      console.error("Send email error:", e);
      toast.error("Kunne ikke sende e-post. Sjekk at Gmail er tilkoblet.");
      setEmailState(index, "pending");
    }
  };

  const handleCreateTaskFromEmail = async (index: number, email: SuggestedEmail) => {
    try {
      const { error } = await supabase.from("oppgaver").insert({
        oppgave: `Følg opp ${email.to_name}: ${email.reason}`,
        frist: new Date(Date.now() + 86400000).toISOString().split("T")[0],
        prioritet: email.prioritet === "høy" ? "Høy" : email.prioritet === "medium" ? "Medium" : "Lav",
        status: "Åpen",
        salgsmulighet_id: email.entity_type === "salgsmulighet" ? email.entity_id : null,
        selskap_id: email.selskap_id || null,
        lead_id: email.entity_type === "lead" ? email.entity_id : null,
      });
      if (error) throw error;
      setEmailState(index, "task_created");
      toast.success("Oppgave opprettet i stedet");
    } catch {
      toast.error("Kunne ikke opprette oppgave");
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "God morgen";
    if (hour < 17) return "God ettermiddag";
    return "God kveld";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="mb-8 max-w-3xl mx-auto">
      {/* Greeting */}
      <h1 className="text-2xl sm:text-3xl font-semibold text-foreground mb-6 text-center">
        {getGreeting()}{userName ? `, ${userName}` : ""}.
      </h1>

      {/* Input area */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Spør om noe..."
            rows={2}
            className="w-full px-5 pt-4 pb-2 bg-transparent text-sm placeholder:text-muted-foreground resize-none focus:outline-none"
            disabled={loading}
          />
          <div className="flex items-center justify-end px-4 pb-3 gap-2">
            <span className="text-[11px] text-muted-foreground mr-auto">Auto</span>
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-30 hover:opacity-90 transition-opacity"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
            </button>
          </div>
        </form>

        {/* Quick prompts */}
        {!response && !loading && (
          <div className="flex items-center gap-2 px-5 pb-4 flex-wrap">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p.label}
                onClick={() => handleSubmit(p.label)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-all whitespace-nowrap cursor-pointer"
              >
                <span>{p.icon}</span>
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          Analyserer CRM-data...
        </div>
      )}

      {/* Response */}
      {response && !loading && (
        <div className="mt-4 bg-card border rounded-xl overflow-hidden">
          {/* Summary */}
          <div className="px-5 py-4">
            <div className="prose prose-sm max-w-none text-sm text-foreground [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_p]:leading-relaxed [&_ul]:my-1 [&_li]:my-0.5">
              <ReactMarkdown>{response.summary}</ReactMarkdown>
            </div>
          </div>

          {/* Action items */}
          {response.items.length > 0 && (
            <div className="border-t">
              <div className="px-5 py-3 bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Handlingsliste</p>
              </div>
              <div className="divide-y">
                {response.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors group">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      item.prioritet === "høy" ? "bg-destructive" : item.prioritet === "medium" ? "bg-amber-500" : "bg-muted-foreground"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{item.navn}</p>
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${prioritetColor[item.prioritet]}`}>{item.prioritet}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{item.selskap}</p>
                      <p className="text-xs text-primary mt-0.5 font-medium">{item.handling}</p>
                    </div>
                    {item.entityId && item.entityType && (
                      <Button variant="ghost" size="sm" className="text-xs gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleNavigate(item)}>
                        <ExternalLink className="w-3 h-3" /> Åpne
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggested emails */}
          {response.suggested_emails?.length > 0 && (
            <div className="border-t">
              <div className="px-5 py-3 bg-muted/30 flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Oppfølgings-e-poster</p>
              </div>
              <div className="divide-y">
                {response.suggested_emails.map((email, i) => {
                  const state = emailStates.get(i) || "pending";
                  const editing = editingEmails.get(i);

                  if (state === "sent") {
                    return (
                      <div key={i} className="flex items-center gap-3 px-5 py-3 bg-emerald-50 dark:bg-emerald-950/20">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                            Sendt til {email.to_name}
                          </p>
                          <p className="text-xs text-emerald-600/70 dark:text-emerald-500/70">{email.subject}</p>
                        </div>
                      </div>
                    );
                  }

                  if (state === "skipped") return null;

                  if (state === "task_created") {
                    return (
                      <div key={i} className="flex items-center gap-3 px-5 py-3 bg-muted/30">
                        <ListTodo className="w-4 h-4 text-primary shrink-0" />
                        <p className="text-sm text-muted-foreground">Oppgave opprettet for {email.to_name}</p>
                      </div>
                    );
                  }

                  return (
                    <div key={i} className="px-5 py-4">
                      {/* Header */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${
                          email.prioritet === "høy" ? "bg-destructive" : email.prioritet === "medium" ? "bg-amber-500" : "bg-muted-foreground"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium">{email.to_name}</p>
                            {email.selskap_navn && (
                              <span className="text-xs text-muted-foreground">· {email.selskap_navn}</span>
                            )}
                            <Badge variant="outline" className={`text-[10px] ${prioritetColor[email.prioritet]}`}>{email.prioritet}</Badge>
                          </div>
                          <p className="text-xs text-primary mt-0.5">{email.reason}</p>
                        </div>
                      </div>

                      {/* Email content */}
                      {state === "editing" ? (
                        <div className="ml-5 space-y-2 mb-3">
                          <div>
                            <label className="text-[10px] font-medium text-muted-foreground uppercase">Til</label>
                            <Input
                              value={editing?.to || ""}
                              onChange={(e) => setEditingEmails((prev) => {
                                const next = new Map(prev);
                                const cur = next.get(i) || { subject: email.subject, body: email.body, to: email.to || "" };
                                next.set(i, { ...cur, to: e.target.value });
                                return next;
                              })}
                              placeholder="e-post@eksempel.no"
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-medium text-muted-foreground uppercase">Emne</label>
                            <Input
                              value={editing?.subject || ""}
                              onChange={(e) => setEditingEmails((prev) => {
                                const next = new Map(prev);
                                const cur = next.get(i) || { subject: email.subject, body: email.body, to: email.to || "" };
                                next.set(i, { ...cur, subject: e.target.value });
                                return next;
                              })}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-medium text-muted-foreground uppercase">Innhold</label>
                            <Textarea
                              value={editing?.body || ""}
                              onChange={(e) => setEditingEmails((prev) => {
                                const next = new Map(prev);
                                const cur = next.get(i) || { subject: email.subject, body: email.body, to: email.to || "" };
                                next.set(i, { ...cur, body: e.target.value });
                                return next;
                              })}
                              rows={5}
                              className="text-sm"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="ml-5 mb-3">
                          <div className="bg-muted/40 rounded-lg p-3 border">
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              {email.to ? `Til: ${email.to}` : "Mangler e-postadresse"}
                            </p>
                            <p className="text-xs font-medium mb-2">Emne: {email.subject}</p>
                            <p className="text-xs text-foreground/80 whitespace-pre-line leading-relaxed">{email.body}</p>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="ml-5 flex items-center gap-2 flex-wrap">
                        {state === "editing" ? (
                          <>
                            <Button
                              size="sm"
                              className="text-xs h-7 gap-1"
                              onClick={() => handleSendEmail(i, email)}
                              disabled={!editingEmails.get(i)?.to}
                            >
                              <Send className="w-3 h-3" /> Send
                            </Button>
                            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => handleCancelEdit(i)}>
                              <X className="w-3 h-3" /> Avbryt
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              className="text-xs h-7 gap-1"
                              onClick={() => handleSendEmail(i, email)}
                              disabled={state === "sending" || !email.to}
                            >
                              {state === "sending" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                              {state === "sending" ? "Sender..." : "Send"}
                            </Button>
                            <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => handleEditEmail(i, email)}>
                              <Pencil className="w-3 h-3" /> Rediger
                            </Button>
                            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => setEmailState(i, "skipped")}>
                              <SkipForward className="w-3 h-3" /> Hopp over
                            </Button>
                            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => handleCreateTaskFromEmail(i, email)}>
                              <ListTodo className="w-3 h-3" /> Oppgave
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Suggested tasks */}
          {response.suggested_tasks.length > 0 && (
            <div className="border-t">
              <div className="px-5 py-3 bg-muted/30 flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Foreslåtte oppgaver</p>
                <Button
                  variant="outline" size="sm" className="text-xs h-7 gap-1"
                  onClick={handleCreateAllTasks}
                  disabled={creatingTasks || createdTaskIds.size === response.suggested_tasks.length}
                >
                  {creatingTasks ? <Loader2 className="w-3 h-3 animate-spin" /> : <ListChecks className="w-3 h-3" />}
                  {createdTaskIds.size === response.suggested_tasks.length ? "Alle opprettet" : "Opprett alle"}
                </Button>
              </div>
              <div className="divide-y">
                {response.suggested_tasks.map((task, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                    {createdTaskIds.has(i) ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{task.oppgave}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className={`text-[10px] ${
                          task.prioritet === "Høy" ? prioritetColor["høy"] :
                          task.prioritet === "Medium" ? prioritetColor["medium"] : prioritetColor["lav"]
                        }`}>{task.prioritet}</Badge>
                        {task.frist && <span className="text-[10px] text-muted-foreground">Frist: {task.frist}</span>}
                      </div>
                    </div>
                    {!createdTaskIds.has(i) && (
                      <Button variant="outline" size="sm" className="text-xs h-7 gap-1 shrink-0" onClick={() => handleCreateTask(task, i)}>
                        Opprett
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggested activities */}
          {response.suggested_activities?.length > 0 && (
            <div className="border-t">
              <div className="px-5 py-3 bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Foreslåtte aktiviteter å logge</p>
              </div>
              <div className="divide-y">
                {response.suggested_activities.map((activity, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                    {createdActivityIds.has(i) ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <PhoneCall className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{activity.tittel}</p>
                      <p className="text-xs text-muted-foreground truncate">{activity.beskrivelse}</p>
                      <Badge variant="outline" className="text-[10px] mt-0.5">{activity.type}</Badge>
                    </div>
                    {!createdActivityIds.has(i) && (
                      <Button variant="outline" size="sm" className="text-xs h-7 gap-1 shrink-0" onClick={() => handleLogActivity(activity, i)}>
                        Logg
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reset */}
          <div className="px-5 py-3 border-t bg-muted/20 flex justify-end">
            <button
              onClick={() => { setResponse(null); inputRef.current?.focus(); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Nytt spørsmål
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
