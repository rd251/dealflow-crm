import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useProfiles } from "@/hooks/use-profiles";
import { useCrmStore } from "@/hooks/use-crm-store";
import { loggAktivitet } from "@/lib/activity-logging";
import {
  ONBOARDING_TYPER, STANDARD_TIMEPRIS, STANDARD_PROSJEKTANSVARLIG, harTimeregistrering, iDag,
  type OnboardingType,
} from "@/lib/kundeforhold";
import type { Integrasjon, Oppgave, Prosjekt } from "@/data/crm-data";

const INTEGRASJONER: Integrasjon[] = ["Ingen", "GastroPlanner", "HubSpot", "Lime", "Salesforce", "API", "Annet"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selskapId: string;
  firmanavn: string;
  salgsmulighetId?: string;
}

export default function OpprettProsjektDialog({ open, onOpenChange, selskapId, firmanavn, salgsmulighetId = "" }: Props) {
  const { user } = useAuth();
  const { profiles } = useProfiles();
  const { prosjekter, updateProsjekter, oppgaver, updateOppgaver, generateId, varsleProsjektTildelt, varsleOppgaveTildelt } = useCrmStore();
  const [lagrer, setLagrer] = useState(false);
  const [form, setForm] = useState({
    prosjektnavn: "",
    ansvarligUserId: "",
    onboarding_type: "Selvbetjening" as OnboardingType,
    timepris: String(STANDARD_TIMEPRIS),
    startdato: iDag(),
    forventet_go_live: "",
    integrasjon: "Ingen" as Integrasjon,
    notater_ansvarlig: "",
  });

  useEffect(() => {
    if (!open) return;
    const standard = profiles.find(p => p.display_name === STANDARD_PROSJEKTANSVARLIG);
    setForm(f => ({
      ...f,
      prosjektnavn: `Onboarding — ${firmanavn}`,
      ansvarligUserId: standard?.user_id || profiles[0]?.user_id || "",
      startdato: iDag(),
    }));
  }, [open, firmanavn, profiles]);

  const ansvarligProfil = profiles.find(p => p.user_id === form.ansvarligUserId);

  const opprett = async () => {
    if (!form.prosjektnavn.trim()) { toast.error("Fyll inn prosjektnavn"); return; }
    setLagrer(true);
    const nyttProsjekt: Prosjekt = {
      id: generateId("p", prosjekter),
      prosjektnavn: form.prosjektnavn.trim(),
      selskap_id: selskapId,
      salgsmulighet_id: salgsmulighetId,
      ansvarlig: ansvarligProfil?.display_name || "",
      status: "Ny",
      startdato: form.startdato,
      forventet_go_live: form.forventet_go_live,
      go_live_dato: "",
      oppstartskostnad: 0,
      oppstart_fakturert: false,
      oppstart_faktura_dato: "",
      oppstart_betalt: false,
      integrasjon: form.integrasjon,
      notater: "",
      onboarding_type: form.onboarding_type,
      onboarding_steg: [],
      timepris: Number(form.timepris.replace(",", ".")) || STANDARD_TIMEPRIS,
      notater_ansvarlig: form.notater_ansvarlig.trim(),
    };
    updateProsjekter(prev => [...prev, nyttProsjekt]);

    const oppgave: Oppgave = {
      id: generateId("O", oppgaver),
      oppgave: `Start onboarding — ${firmanavn}`,
      lead_id: "",
      selskap_id: selskapId,
      salgsmulighet_id: salgsmulighetId,
      kontakt_id: "",
      ansvarlig: form.ansvarligUserId,
      frist: form.startdato,
      prioritet: "Høy",
      status: "Åpen",
      paaminnelse: true,
      notater: form.notater_ansvarlig.trim(),
    };
    updateOppgaver(prev => [...prev, oppgave]);

    varsleProsjektTildelt(nyttProsjekt.id);
    varsleOppgaveTildelt(oppgave.id);

    if (form.ansvarligUserId) {
      await supabase.from("varsler").insert({
        user_id: form.ansvarligUserId,
        type: "prosjekt_tildelt",
        tittel: "Nytt prosjekt tildelt",
        beskrivelse: `Nytt prosjekt tildelt: ${firmanavn} — ${form.onboarding_type}`,
        fra_user_id: user?.id ?? null,
        lenke: "/prosjekter",
      });
    }

    const utforer = profiles.find(p => p.user_id === user?.id)?.display_name || user?.email || "en kollega";
    await loggAktivitet({
      logg: "notat",
      target: { selskap_id: selskapId, prosjekt_id: nyttProsjekt.id },
      tittel: "Prosjekt opprettet",
      notat: `Prosjekt opprettet av ${utforer} — ${form.onboarding_type}`,
    });

    setLagrer(false);
    onOpenChange(false);
    toast.success("Prosjekt opprettet");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Opprett prosjekt</DialogTitle>
          <DialogDescription>Onboardingprosjekt for {firmanavn}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <span className="text-xs text-muted-foreground">Prosjektnavn</span>
            <Input className="h-9 text-sm mt-0.5" value={form.prosjektnavn} onChange={e => setForm(f => ({ ...f, prosjektnavn: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs text-muted-foreground">Ansvarlig</span>
              <select className="w-full border rounded-md px-2 py-1.5 text-sm bg-background h-9 mt-0.5"
                value={form.ansvarligUserId} onChange={e => setForm(f => ({ ...f, ansvarligUserId: e.target.value }))}>
                <option value="">Velg ansvarlig</option>
                {profiles.map(p => <option key={p.user_id} value={p.user_id}>{p.display_name}</option>)}
              </select>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Onboarding-type</span>
              <select className="w-full border rounded-md px-2 py-1.5 text-sm bg-background h-9 mt-0.5"
                value={form.onboarding_type} onChange={e => setForm(f => ({ ...f, onboarding_type: e.target.value as OnboardingType }))}>
                {ONBOARDING_TYPER.map(t => <option key={t.verdi} value={t.verdi}>{t.verdi}</option>)}
              </select>
            </div>
            {harTimeregistrering(form.onboarding_type) && (
              <div>
                <span className="text-xs text-muted-foreground">Timepris (kr/t)</span>
                <Input inputMode="decimal" className="h-9 text-sm mt-0.5 tabular-nums" value={form.timepris} onChange={e => setForm(f => ({ ...f, timepris: e.target.value }))} />
              </div>
            )}
            <div>
              <span className="text-xs text-muted-foreground">Startdato</span>
              <Input type="date" className="h-9 text-sm mt-0.5" value={form.startdato} onChange={e => setForm(f => ({ ...f, startdato: e.target.value }))} />
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Forventet go-live</span>
              <Input type="date" className="h-9 text-sm mt-0.5" value={form.forventet_go_live} onChange={e => setForm(f => ({ ...f, forventet_go_live: e.target.value }))} />
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Integrasjon</span>
              <select className="w-full border rounded-md px-2 py-1.5 text-sm bg-background h-9 mt-0.5"
                value={form.integrasjon} onChange={e => setForm(f => ({ ...f, integrasjon: e.target.value as Integrasjon }))}>
                {INTEGRASJONER.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Notater til ansvarlig</span>
            <Textarea rows={3} className="text-sm mt-0.5" placeholder="Viktig info om kunden, spesielle ønsker …"
              value={form.notater_ansvarlig} onChange={e => setForm(f => ({ ...f, notater_ansvarlig: e.target.value }))} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button onClick={opprett} disabled={lagrer}>
            <Rocket className="w-3.5 h-3.5 mr-1.5" />Opprett prosjekt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
