import { ReactNode } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Sparkles, ArrowRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AiRecap {
  sammendrag?: string;
  kundesignal?: "Høy" | "Medium" | "Lav" | "Ukjent" | string;
  neste_steg?: string;
  risikofaktorer?: string[];
  generert_dato?: string;
}

interface Props {
  recap?: AiRecap | null;
  nesteSteg?: string | null;
  children: ReactNode;
}

const signalStyles: Record<string, string> = {
  "høy": "bg-success/15 text-success border-success/30",
  "medium": "bg-warning/15 text-warning border-warning/30",
  "lav": "bg-destructive/15 text-destructive border-destructive/30",
};

export default function DealHoverCard({ recap, nesteSteg, children }: Props) {
  const hasContent = !!(recap?.sammendrag || recap?.neste_steg || nesteSteg);
  if (!hasContent) return <>{children}</>;

  const sigKey = (recap?.kundesignal || "").toLowerCase();
  const sigClass = signalStyles[sigKey] || "bg-muted text-muted-foreground border-border";

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side="right" align="start" className="w-80 p-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold">AI Recap</span>
          {recap?.kundesignal && (
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", sigClass)}>
              {recap.kundesignal} interesse
            </span>
          )}
        </div>

        {recap?.sammendrag && (
          <p className="text-xs leading-relaxed text-foreground/90">{recap.sammendrag}</p>
        )}

        {(recap?.neste_steg || nesteSteg) && (
          <div className="rounded-md bg-muted/50 border p-2">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1 mb-0.5">
              <ArrowRight className="w-3 h-3" /> Foreslått neste steg
            </div>
            <div className="text-xs">{recap?.neste_steg || nesteSteg}</div>
          </div>
        )}

        {recap?.risikofaktorer && recap.risikofaktorer.length > 0 && (
          <div className="rounded-md bg-destructive/5 border border-destructive/20 p-2">
            <div className="text-[10px] font-medium text-destructive uppercase tracking-wide flex items-center gap-1 mb-0.5">
              <AlertTriangle className="w-3 h-3" /> Risiko
            </div>
            <ul className="text-[11px] space-y-0.5 list-disc list-inside text-foreground/80">
              {recap.risikofaktorer.slice(0, 3).map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        )}

        {!recap?.sammendrag && !recap?.neste_steg && nesteSteg && (
          <div className="text-[10px] text-muted-foreground pt-1">Ingen AI-recap ennå – åpne kortet for å generere.</div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
