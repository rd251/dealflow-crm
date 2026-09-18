import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Phone, CalendarDays, Ban } from "lucide-react";
import { idag, datoOm } from "@/lib/sales-flow";
import { QUICK_ACTIONS, loggAktivitet } from "@/lib/activity-logging";
import LogActivityDialog from "@/components/LogActivityDialog";
import type { Lead } from "@/data/crm-data";

export type LeadUtfall = "ringt" | "ikke-svar" | "ikke-aktuelt";

interface Props {
  lead: Lead;
  /** Kalles etter at et utfall er registrert (og notat lagret/hoppet over for «Ringt»). */
  onHandled?: (utfall: LeadUtfall) => void;
  /** Kalles når brukeren vil booke møte. */
  onBookMoete?: () => void;
  size?: "sm" | "default";
  className?: string;
}

export default function LeadQuickActions({ lead, onBookMoete, onHandled, size = "sm", className }: Props) {
  const { updateLeads, updateOppgaver } = useCrmStore();
  const { canEdit, user } = useAuth();
  const [notatApen, setNotatApen] = useState(false);
  const [notat, setNotat] = useState("");
  const [dialogApen, setDialogApen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  if (!canEdit) return null;

  const navn = lead.kontaktperson || lead.firmanavn;

  const nyRingeoppgave = (tekst: string) => {
    updateOppgaver(prev => [...prev, {
      id: crypto.randomUUID(),
      oppgave: tekst,
      lead_id: lead.id,
      selskap_id: "",
      salgsmulighet_id: "",
      kontakt_id: "",
      ansvarlig: lead.ansvarlig || user?.id || "",
      frist: datoOm(2),
      prioritet: "Medium",
      status: "Åpen",
      paaminnelse: true,
      notater: "",
    }]);
  };

  /** Hurtighandlinger med ett trykk — lista defineres i src/lib/activity-logging.ts */
  const kjørHurtig = async (id: string) => {
    const handling = QUICK_ACTIONS.find(q => q.id === id);
    if (!handling) return;
    setBusy(id);
    try {
      const { nesteOppfolging } = await loggAktivitet({
        logg: handling.logg,
        target: { lead_id: lead.id },
        tittel: `${handling.tittel} – ${navn}`,
        notat: handling.beskrivelse,
        utfall: handling.utfall,
      });
      if (handling.id === "ringte-ikke-svar") {
        updateLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: "Svarte ikke telefon", sist_aktivitet: idag(), neste_oppfolging: nesteOppfolging } : l));
        nyRingeoppgave(`Ring ${navn} igjen`);
        toast("Ikke svart – ny ringeoppgave om 2 dager");
        onHandled?.("ikke-svar");
      } else {
        updateLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: l.status === "Ny" ? "Kontaktet" : l.status, sist_aktivitet: idag(), neste_oppfolging: nesteOppfolging } : l));
        toast.success(`${handling.label} · logget`);
        if (handling.id === "ringte-booket-moete") {
          setNotat("");
          setNotatApen(true);
          onBookMoete?.();
        } else {
          onHandled?.("ringt");
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Kunne ikke logge aktiviteten");
    } finally {
      setBusy(null);
    }
  };

  const ikkeAktuelt = async () => {
    try {
      await loggAktivitet({
        logg: "ringte",
        target: { lead_id: lead.id },
        tittel: `Ringte ${navn}`,
        notat: "Ikke aktuelt",
      });
    } catch (err) {
      console.warn("Kunne ikke logge aktivitet", err);
    }
    updateLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: "Ikke aktuelt", sist_aktivitet: idag() } : l));
    toast("Markert som ikke aktuelt");
    onHandled?.("ikke-aktuelt");
  };

  const lagreNotat = async () => {
    if (notat.trim()) {
      try {
        await loggAktivitet({ logg: "notat", target: { lead_id: lead.id }, tittel: "Samtalenotat", notat: notat.trim() });
        updateLeads(prev => prev.map(l => l.id === lead.id ? { ...l, neste_steg: l.neste_steg || notat.trim().slice(0, 120) } : l));
        toast.success("Notat lagret");
      } catch (err) {
        console.error(err);
        toast.error("Kunne ikke lagre notatet");
      }
    }
    setNotatApen(false);
    setNotat("");
    onHandled?.("ringt");
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map(q => {
          const Icon = q.icon;
          return (
            <Button key={q.id} size={size} variant="outline" disabled={busy !== null} onClick={() => kjørHurtig(q.id)}>
              <Icon className={`w-3.5 h-3.5 mr-1.5 ${q.tone}`} />{q.label}
            </Button>
          );
        })}
        <Button size={size} onClick={() => setDialogApen(true)}>
          <Phone className="w-3.5 h-3.5 mr-1.5" />Logg aktivitet
        </Button>
        <Button size={size} variant="outline" onClick={ikkeAktuelt}>
          <Ban className="w-3.5 h-3.5 mr-1.5" />Ikke aktuelt
        </Button>
        {onBookMoete && (
          <Button size={size} variant="secondary" onClick={onBookMoete}>
            <CalendarDays className="w-3.5 h-3.5 mr-1.5" />Book møte
          </Button>
        )}
      </div>

      {notatApen && (
        <div className="mt-3 space-y-2 rounded-lg border bg-muted/30 p-3">
          <p className="text-xs font-medium">Hva kom ut av samtalen?</p>
          <Textarea value={notat} onChange={e => setNotat(e.target.value)} rows={3} placeholder="Notat fra samtalen…" />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={lagreNotat}>Lagre notat</Button>
            <Button size="sm" variant="ghost" onClick={() => { setNotatApen(false); setNotat(""); onHandled?.("ringt"); }}>Hopp over</Button>
          </div>
        </div>
      )}

      <LogActivityDialog
        open={dialogApen}
        onOpenChange={setDialogApen}
        target={{ lead_id: lead.id }}
        entityName={lead.firmanavn}
      onLogged={(res) => {
          updateLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: l.status === "Ny" ? "Kontaktet" : l.status, sist_aktivitet: idag(), neste_oppfolging: res?.nesteOppfolging || l.neste_oppfolging } : l));
          onHandled?.("ringt");
        }}
      />
    </div>
  );
}
