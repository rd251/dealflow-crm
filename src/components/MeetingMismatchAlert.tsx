import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Wand2, Loader2, X, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { nb } from "date-fns/locale";

interface Mismatch {
  aktivitet_id: string;
  tittel: string;
  dato: string;
  start_tid: string | null;
  current_selskap_navn: string | null;
  suggested_selskap_navn: string | null;
  suggested_salgsmulighet_navn: string | null;
  suggested_selskap_id: string | null;
  suggested_salgsmulighet_id: string | null;
  reasons: string[];
}

export default function MeetingMismatchAlert() {
  const [mismatches, setMismatches] = useState<Mismatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("meeting-mismatch-detect", {
        body: { action: "detect", horizon_days: 14, since_days: 3 },
      });
      if (error) throw error;
      setMismatches(data?.mismatches || []);
    } catch (e) {
      console.error("Mismatch load error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const autoFix = async (m: Mismatch) => {
    setFixingId(m.aktivitet_id);
    try {
      const { data, error } = await supabase.functions.invoke("meeting-mismatch-detect", {
        body: { action: "fix", aktivitet_id: m.aktivitet_id },
      });
      if (error) throw error;
      if (data?.ok) {
        toast.success("Møte korrigert");
        setMismatches(prev => prev.filter(x => x.aktivitet_id !== m.aktivitet_id));
      } else {
        toast.error(data?.error || "Ingen automatisk fix mulig");
      }
    } catch (e) {
      console.error("Auto-fix error:", e);
      toast.error("Kunne ikke korrigere automatisk");
    } finally {
      setFixingId(null);
    }
  };

  if (loading || dismissed || mismatches.length === 0) return null;

  return (
    <div className="rounded-lg border border-warning/40 bg-warning/5 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2">
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-2 text-sm font-medium text-warning hover:text-warning/80"
        >
          <AlertTriangle className="w-4 h-4" />
          {mismatches.length} {mismatches.length === 1 ? "møte trenger" : "møter trenger"} kontroll
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Lukk"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-warning/30 divide-y divide-warning/20">
          {mismatches.map(m => {
            const dateStr = (() => {
              try { return format(parseISO(m.dato), "d. MMM HH:mm", { locale: nb }); }
              catch { return m.dato; }
            })();
            const canAutoFix = !!(m.suggested_selskap_id || m.suggested_salgsmulighet_id);
            return (
              <div key={m.aktivitet_id} className="px-3 py-2.5 space-y-1.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      {m.tittel || "Møte"}
                      <span className="text-xs text-muted-foreground font-normal">· {dateStr}</span>
                    </p>
                    <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      {m.reasons.map((r, i) => (
                        <li key={i}>• {r}</li>
                      ))}
                    </ul>
                    {(m.suggested_selskap_navn || m.suggested_salgsmulighet_navn) && (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Foreslått:</span>
                        {m.suggested_selskap_navn && (
                          <Badge variant="secondary" className="text-[10px]">{m.suggested_selskap_navn}</Badge>
                        )}
                        {m.suggested_salgsmulighet_navn && (
                          <Badge variant="outline" className="text-[10px]">{m.suggested_salgsmulighet_navn}</Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canAutoFix || fixingId === m.aktivitet_id}
                    onClick={() => autoFix(m)}
                    className="shrink-0 h-7 text-xs"
                  >
                    {fixingId === m.aktivitet_id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <><Wand2 className="w-3 h-3 mr-1" />Fiks</>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
