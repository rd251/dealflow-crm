import type { EierFilter } from "@/hooks/use-mine-filter";

/**
 * Bekvemmelighetsfilter. All CRM-data i Snakk er delt – dette skjuler bare
 * rader midlertidig, det begrenser ikke tilgang.
 */
export default function MineTeametToggle({
  verdi,
  onEndre,
  className = "",
}: {
  verdi: EierFilter;
  onEndre: (neste: EierFilter) => void;
  className?: string;
}) {
  const valg: { id: EierFilter; etikett: string }[] = [
    { id: "mine", etikett: "Mine" },
    { id: "teamet", etikett: "Teamet" },
  ];

  return (
    <div className={`inline-flex rounded-full border bg-background p-0.5 ${className}`} role="group" aria-label="Eierfilter">
      {valg.map(v => (
        <button
          key={v.id}
          type="button"
          aria-pressed={verdi === v.id}
          onClick={() => onEndre(v.id)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            verdi === v.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          {v.etikett}
        </button>
      ))}
    </div>
  );
}
