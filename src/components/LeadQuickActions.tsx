import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Phone, CalendarDays, X, Ban, PhoneMissed } from "lucide-react";
import { idag, datoOm } from "@/lib/sales-flow";
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

export default function LeadQuickActions({ lead, onHandled, onBookMoete, size = "sm", className }: Props) {
  const { updateLeads, updateOppgaver } = useCrmStore();
  const { canEdit, user } = useAuth();
  const [notatApen, setNotatApen] = useState(false);
  const [notat, setNotat] = useState("");

  if (!canEdit) return null;

  const navn = lead.kontaktperson || lead.firmanavn;

  const loggAktivitet = async (tittel: string, beskrivelse: string) => {
    try {
      await supabase.from("aktiviteter").insert({
        type: "Telefonsamtale",
        tittel,
        beskrivelse,
        dato: new Date().toISOString(),
        lead_id: lead.id,
        aktivitet_kilde: "manuell",
      });
    } catch (err) {
      console.warn("Kunne ikke logge aktivitet", err);
    }
  };

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

  const ringt = async () => {
    await loggAktivitet(`Ringt ${navn}`, "Samtale gjennomført");
    updateLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: l.status === "Ny" ? "Kontaktet" : l.status, sist_aktivitet: idag() } : l));
    setNotat("");
    setNotatApen(true);
    toast.success("Samtale logget");
  };

  const ikkeSvar = async () => {
    await loggAktivitet(`Forsøkte å ringe ${navn}`, "Ikke svart");
    updateLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: "Svarte ikke telefon", sist_aktivitet: idag() } : l));
    nyRingeoppgave(`Ring ${navn} igjen`);
    toast("Ikke svar – ny ringeoppgave om 2 dager");
    onHandled?.("ikke-svar");
  };


  const ikkeAktuelt = async () => {
    await loggAktivitet(`Ringt ${navn}`, "Ikke aktuelt");
    updateLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: "Ikke aktuelt", sist_aktivitet: idag() } : l));
    toast("Markert som ikke aktuelt");
    onHandled?.("ikke-aktuelt");
  };

  const lagreNotat = async () => {
    if (notat.trim()) {
      await loggAktivitet("Samtalenotat", notat.trim());
      updateLeads(prev => prev.map(l => l.id === lead.id ? { ...l, neste_steg: l.neste_steg || notat.trim().slice(0, 120) } : l));
      toast.success("Notat lagret");
    }
    setNotatApen(false);
    setNotat("");
    onHandled?.("ringt");
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        <Button size={size} onClick={ringt}>
          <Phone className="w-3.5 h-3.5 mr-1.5" />Ringt ✓
        </Button>
        <Button size={size} variant="outline" onClick={ikkeSvar}>
          <PhoneMissed className="w-3.5 h-3.5 mr-1.5" />Ikke svart
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
            {onBookMoete && (
              <Button size="sm" variant="secondary" onClick={() => { lagreNotat(); onBookMoete(); }}>
                <CalendarDays className="w-3.5 h-3.5 mr-1.5" />Book møte nå
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => { setNotatApen(false); setNotat(""); onHandled?.("ringt"); }}>Hopp over</Button>
          </div>
        </div>
      )}
    </div>
  );
}
