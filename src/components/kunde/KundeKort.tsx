import { Badge } from "@/components/ui/badge";
import CompanyLogo from "@/components/CompanyLogo";
import { nok } from "@/lib/utils";
import { initialer, kundestatusFarge, relativTid, tilstandFarge } from "@/lib/kundeforhold";
import type { Selskap } from "@/data/crm-data";

interface Props {
  selskap: Selskap;
  pakkenavn?: string;
  kontaktEmails?: string[];
  /** Rød ramme ved risiko, gul ved usikker eller inaktivitet. */
  varsel?: "risiko" | "usikker" | null;
  onClick: () => void;
}

export default function KundeKort({ selskap: s, pakkenavn, kontaktEmails = [], varsel = null, onClick }: Props) {
  const ramme = varsel === "risiko" ? "border-destructive/60" : varsel === "usikker" ? "border-warning/60" : "";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left bg-card border rounded-xl p-4 shadow-card hover:shadow-md transition-shadow space-y-3 ${ramme}`}
    >
      <div className="flex items-start gap-3">
        {s.domene || kontaktEmails.length ? (
          <CompanyLogo domain={s.domene} firmanavn={s.firmanavn} kontaktEmails={kontaktEmails} size="sm" />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold">
            {initialer(s.firmanavn)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm truncate">{s.firmanavn}</p>
          <p className="text-xs text-muted-foreground truncate">{pakkenavn || s.bransje || "Ingen pakke"}</p>
        </div>
        <span className="text-sm font-semibold tabular-nums shrink-0">{nok(s.mrr)}</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge className={`text-[10px] ${kundestatusFarge[s.kundestatus]}`}>{s.kundestatus}</Badge>
        <Badge className={`text-[10px] ${tilstandFarge[s.kundetilstand]}`}>{s.kundetilstand}</Badge>
        <span className="text-[11px] text-muted-foreground ml-auto">{relativTid(s.sist_aktivitet)}</span>
      </div>
    </button>
  );
}
