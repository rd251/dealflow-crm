import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, RefreshCw, AlertTriangle, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AiRecap {
  sammendrag: string;
  kundesignal: "Høy" | "Medium" | "Lav" | "Ukjent";
  neste_steg: string;
  risikofaktorer: string[];
  generert_dato: string;
  basert_paa_aktiviteter: number;
}

interface Props {
  salgsmulighetId: string;
  initialRecap?: AiRecap | null;
  /** Når true: be om regenerering automatisk hvis recap mangler eller er eldre enn siste aktivitet */
  autoGenerateIfStale?: { lastAktivitetDato?: string | null };
  currentNesteSteg?: string | null;
  onUpdated?: (recap: AiRecap) => void;
  onNesteStegUpdated?: (nesteSteg: string) => void;
}

const signalStyles: Record<AiRecap["kundesignal"], string> = {
  "Høy": "bg-success/15 text-success border-success/30",
  "Medium": "bg-warning/15 text-warning border-warning/30",
  "Lav": "bg-destructive/15 text-destructive border-destructive/30",
  "Ukjent": "bg-muted text-muted-foreground border-border",
};

export default function DealRecapCard({ salgsmulighetId, initialRecap, autoGenerateIfStale, currentNesteSteg, onUpdated, onNesteStegUpdated }: Props) {
  const [recap, setRecap] = useState<AiRecap | null>(initialRecap || null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  // Hold lokal state i sync når detaljpanelet bytter deal
  useEffect(() => {
    setRecap(initialRecap || null);
  }, [salgsmulighetId, initialRecap]);

  const generate = async (silent = false) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("deal-recap-ai", {
        body: { salgsmulighet_id: salgsmulighetId },
      });
      if (error) throw error;
      if (data?.ai_recap) {
        setRecap(data.ai_recap);
        onUpdated?.(data.ai_recap);
        if (!silent) toast.success("Recap oppdatert");
      } else if (data?.error) {
        if (!silent) toast.error(data.error);
      }
    } catch (e: any) {
      if (!silent) toast.error("Kunne ikke generere recap");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Auto-generer hvis stale (recap mangler eller eldre enn siste aktivitet)
  useEffect(() => {
    if (!autoGenerateIfStale) return;
    const lastAkt = autoGenerateIfStale.lastAktivitetDato;
    if (!recap) {
      generate(true);
      return;
    }
    if (lastAkt && recap.generert_dato && new Date(lastAkt) > new Date(recap.generert_dato)) {
      generate(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salgsmulighetId, autoGenerateIfStale?.lastAktivitetDato]);

  if (!recap && loading) {
    return (
      <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-primary/0 p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="w-4 h-4 animate-pulse text-primary" />
          Genererer AI-recap…
        </div>
      </div>
    );
  }

  if (!recap) {
    return (
      <div className="rounded-xl border bg-muted/30 p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Ingen AI-recap ennå</span>
          <Button size="sm" variant="outline" onClick={() => generate()} disabled={loading}>
            <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Generer
          </Button>
        </div>
      </div>
    );
  }

  const generertRel = (() => {
    const d = new Date(recap.generert_dato);
    const min = Math.floor((Date.now() - d.getTime()) / 60000);
    if (min < 1) return "akkurat nå";
    if (min < 60) return `${min} min siden`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}t siden`;
    return `${Math.floor(h / 24)}d siden`;
  })();

  return (
    <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-primary/0 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">AI Recap</h3>
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border", signalStyles[recap.kundesignal])}>
            {recap.kundesignal} interesse
          </Badge>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => generate()}
          disabled={loading}
          title="Oppdater recap"
        >
          <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
        </Button>
      </div>

      <p className="text-sm leading-relaxed">{recap.sammendrag}</p>

      <div className="rounded-lg bg-background/60 border p-2.5">
        <div className="flex items-center justify-between mb-1 gap-2">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Foreslått neste steg</div>
          {recap.neste_steg && (() => {
            const alreadyApplied = (currentNesteSteg || "").trim() === recap.neste_steg.trim();
            return (
              <Button
                size="sm"
                variant={alreadyApplied ? "ghost" : "outline"}
                className="h-6 px-2 text-[11px]"
                disabled={applying || alreadyApplied}
                onClick={async () => {
                  setApplying(true);
                  try {
                    const { error } = await supabase
                      .from("salgsmuligheter")
                      .update({ neste_steg: recap.neste_steg })
                      .eq("id", salgsmulighetId);
                    if (error) throw error;
                    onNesteStegUpdated?.(recap.neste_steg);
                    toast.success("Neste steg oppdatert");
                  } catch (e) {
                    console.error(e);
                    toast.error("Kunne ikke oppdatere neste steg");
                  } finally {
                    setApplying(false);
                  }
                }}
              >
                {alreadyApplied ? (
                  <><Check className="w-3 h-3 mr-1" /> Brukt</>
                ) : (
                  <>Bruk <ArrowRight className="w-3 h-3 ml-1" /></>
                )}
              </Button>
            );
          })()}
        </div>
        <div className="text-sm">{recap.neste_steg}</div>
      </div>

      {recap.risikofaktorer && recap.risikofaktorer.length > 0 && (
        <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-2.5">
          <div className="text-[11px] font-medium text-destructive uppercase tracking-wide mb-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Risiko
          </div>
          <ul className="text-xs space-y-0.5 list-disc list-inside text-foreground/80">
            {recap.risikofaktorer.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      <div className="text-[10px] text-muted-foreground flex items-center justify-between pt-1 border-t">
        <span>Basert på {recap.basert_paa_aktiviteter} aktiviteter</span>
        <span>Oppdatert {generertRel}</span>
      </div>
    </div>
  );
}
