import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles, Send, Loader2, ChevronRight, ListChecks,
  Activity, ExternalLink, CheckCircle2, AlertTriangle,
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

interface AiResponse {
  summary: string;
  items: AiItem[];
  suggested_tasks: SuggestedTask[];
}

interface AiCommandBarProps {
  context: any;
}

const QUICK_PROMPTS = [
  "Hva bør jeg gjøre i dag?",
  "Hvilke deals trenger oppfølging?",
  "Prep møtene mine i dag",
  "Top 5 prioriteringer",
];

const prioritetColor: Record<string, string> = {
  "høy": "bg-destructive/10 text-destructive border-destructive/20",
  "medium": "bg-amber-500/10 text-amber-600 border-amber-200",
  "lav": "bg-muted text-muted-foreground border-border",
};

export default function AiCommandBar({ context }: AiCommandBarProps) {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AiResponse | null>(null);
  const [creatingTasks, setCreatingTasks] = useState(false);
  const [createdTaskIds, setCreatedTaskIds] = useState<Set<number>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (prompt?: string) => {
    const msg = prompt || input.trim();
    if (!msg || loading) return;

    setInput("");
    setLoading(true);
    setResponse(null);
    setCreatedTaskIds(new Set());

    try {
      const { data, error } = await supabase.functions.invoke("ai-command", {
        body: { message: msg, context },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

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

  const handleNavigate = (item: AiItem) => {
    if (!item.entityId || !item.entityType) return;
    switch (item.entityType) {
      case "salgsmulighet":
        navigate(`/salgsmuligheter?open=${item.entityId}`);
        break;
      case "lead":
        navigate(`/leads`);
        break;
      case "selskap":
        navigate(`/selskaper/${item.entityId}`);
        break;
      default:
        break;
    }
  };

  return (
    <div className="bg-card border rounded-xl mb-6 overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 border-b flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">AI-assistent</h2>
      </div>

      {/* Input */}
      <div className="px-4 sm:px-6 py-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="flex gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Spør meg om noe... f.eks. «Hva bør jeg gjøre i dag?»"
            className="flex-1 px-4 py-2.5 rounded-lg border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            disabled={loading}
          />
          <Button type="submit" size="sm" disabled={loading || !input.trim()} className="gap-1.5 h-10 px-4">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Spør
          </Button>
        </form>

        {/* Quick prompts */}
        {!response && !loading && (
          <div className="flex flex-wrap gap-2 mt-3">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSubmit(prompt)}
                className="text-xs px-3 py-1.5 rounded-full border bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="px-4 sm:px-6 py-8 text-center border-t">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-sm text-muted-foreground">Analyserer CRM-data...</p>
        </div>
      )}

      {/* Response */}
      {response && !loading && (
        <div className="border-t">
          {/* Summary */}
          <div className="px-4 sm:px-6 py-4">
            <div className="prose prose-sm max-w-none text-sm text-foreground [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_p]:leading-relaxed [&_ul]:my-1 [&_li]:my-0.5">
              <ReactMarkdown>{response.summary}</ReactMarkdown>
            </div>
          </div>

          {/* Action items */}
          {response.items.length > 0 && (
            <div className="border-t">
              <div className="px-4 sm:px-6 py-3 bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Handlingsliste</p>
              </div>
              <div className="divide-y">
                {response.items.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-4 sm:px-6 py-3 hover:bg-muted/30 transition-colors group"
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      item.prioritet === "høy" ? "bg-destructive" : item.prioritet === "medium" ? "bg-amber-500" : "bg-muted-foreground"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{item.navn}</p>
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${prioritetColor[item.prioritet]}`}>
                          {item.prioritet}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{item.selskap}</p>
                      <p className="text-xs text-primary mt-0.5 font-medium">{item.handling}</p>
                    </div>
                    {item.entityId && item.entityType && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleNavigate(item)}
                      >
                        <ExternalLink className="w-3 h-3" />
                        Åpne
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggested tasks */}
          {response.suggested_tasks.length > 0 && (
            <div className="border-t">
              <div className="px-4 sm:px-6 py-3 bg-muted/30 flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Foreslåtte oppgaver</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 gap-1"
                  onClick={handleCreateAllTasks}
                  disabled={creatingTasks || createdTaskIds.size === response.suggested_tasks.length}
                >
                  {creatingTasks ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <ListChecks className="w-3 h-3" />
                  )}
                  {createdTaskIds.size === response.suggested_tasks.length ? "Alle opprettet" : "Opprett alle"}
                </Button>
              </div>
              <div className="divide-y">
                {response.suggested_tasks.map((task, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-4 sm:px-6 py-3 hover:bg-muted/30 transition-colors"
                  >
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
                        }`}>
                          {task.prioritet}
                        </Badge>
                        {task.frist && (
                          <span className="text-[10px] text-muted-foreground">Frist: {task.frist}</span>
                        )}
                      </div>
                    </div>
                    {!createdTaskIds.has(i) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 gap-1 shrink-0"
                        onClick={() => handleCreateTask(task, i)}
                      >
                        Opprett
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reset */}
          <div className="px-4 sm:px-6 py-3 border-t bg-muted/20 flex justify-end">
            <button
              onClick={() => {
                setResponse(null);
                inputRef.current?.focus();
              }}
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
