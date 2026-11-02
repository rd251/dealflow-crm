import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useAuth } from "@/hooks/use-auth";
import { KundeNavn } from "@/components/KortLenker";
import { taActivNaa } from "@/lib/senere";
import type { Lead } from "@/data/crm-data";

/** Leads parkert med «Ikke nå», sortert på når de skal tas opp igjen. */
export default function SenereListe({ leads }: { leads: Lead[] }) {
  const { oppgaver, updateLeads, updateOppgaver } = useCrmStore();
  const { canEdit } = useAuth();
  const rader = [...leads].sort((a, b) => (a.senere_til || "").localeCompare(b.senere_til || ""));
  if (!rader.length) return <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Ingen leads er satt til senere.</p>;
  return (
    <ul className="divide-y rounded-lg border bg-card">
      {rader.map(l => {
        const oppg = oppgaver.find(o => o.lead_id === l.id && o.status !== "Ferdig" && o.frist?.slice(0, 10) === l.senere_til?.slice(0, 10));
        return (
          <li key={l.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium"><KundeNavn r={{ type: "lead", id: l.id }}>{l.kontaktperson || l.firmanavn}</KundeNavn>
                {l.kontaktperson && l.firmanavn && <span className="font-normal text-muted-foreground"> · {l.firmanavn}</span>}</p>
              {oppg?.notater && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">«{oppg.notater}»</p>}
            </div>
            <span className="shrink-0 text-sm tabular-nums text-muted-foreground">Tilbake {format(new Date(`${l.senere_til}T12:00`), "d. MMM yyyy", { locale: nb })}</span>
            {canEdit && <Button size="sm" variant="outline" onClick={() => taActivNaa(l, updateLeads, updateOppgaver)}>Ta opp nå</Button>}
          </li>
        );
      })}
    </ul>
  );
}
