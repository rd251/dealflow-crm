import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KundeNavn, SelskapNavn } from "@/components/KortLenker";
import { nok } from "@/lib/utils";
import type { RapportRad } from "@/lib/rapport-detaljer";

const visDato = (d?: string) => {
  if (!d) return "";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? "" : format(dt, "d. MMM yyyy", { locale: nb });
};

/** Nøyaktig liste over postene bak en søyle/periode i en rapportgraf. */
export default function RapportDetaljer({ tittel, enhet, rader, onClose }: {
  tittel: string; enhet: string; rader: RapportRad[]; onClose: () => void;
}) {
  const [sok, setSok] = useState("");
  const synlige = useMemo(() => {
    const q = sok.trim().toLowerCase();
    if (!q) return rader;
    return rader.filter(r => [r.navn, r.under, r.status].some(v => v?.toLowerCase().includes(q)));
  }, [rader, sok]);
  const sum = rader.reduce((s, r) => s + (r.verdi || 0), 0);
  const harVerdi = rader.some(r => r.verdi != null);

  return (
    <section aria-label={`Detaljer: ${tittel}`} className="mt-4 border-t pt-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{tittel}</p>
          <p className="text-sm text-muted-foreground tabular-nums">
            {rader.length} {enhet}{harVerdi && sum > 0 ? ` · ${nok(sum)}` : ""}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose} aria-label="Lukk liste">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {rader.length > 8 && (
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={sok} onChange={e => setSok(e.target.value)} placeholder="Søk i listen" className="h-9 pl-8" aria-label="Søk i listen" />
        </div>
      )}

      {rader.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Ingen {enhet} i denne perioden.</p>
      ) : (
        <ul className="mt-3 max-h-96 divide-y overflow-y-auto rounded-lg border">
          {synlige.map(r => (
            <li key={r.id} className="flex items-start gap-3 px-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                  {r.kunde ? <KundeNavn r={r.kunde}>{r.navn}</KundeNavn>
                    : r.selskapId ? <SelskapNavn id={r.selskapId}>{r.navn}</SelskapNavn>
                    : r.partnerId ? <Link to={`/partnere/${r.partnerId}`} className="rounded-sm underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{r.navn}</Link>
                    : r.navn}
                </div>
                {r.under && (
                  <div className="truncate text-xs text-muted-foreground">
                    {r.kunde && r.selskapId ? <SelskapNavn id={r.selskapId}>{r.under}</SelskapNavn> : r.under}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                {r.verdi != null && <div className="font-medium tabular-nums">{nok(r.verdi)}</div>}
                {r.dato && <div className="text-xs text-muted-foreground tabular-nums">{visDato(r.dato)}</div>}
                {r.status && <div className="text-xs text-muted-foreground">{r.status}</div>}
              </div>
            </li>
          ))}
          {synlige.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">Ingen treff.</li>}
        </ul>
      )}
    </section>
  );
}
