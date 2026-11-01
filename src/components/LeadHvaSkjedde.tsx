import { useState } from "react";
import { PhoneMissed, CalendarCheck, Clock, Ban, MoreHorizontal } from "lucide-react";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { idag, datoOm } from "@/lib/sales-flow";
import { QUICK_ACTIONS, loggAktivitet } from "@/lib/activity-logging";
import LogActivityDialog from "@/components/LogActivityDialog";
import { cn } from "@/lib/utils";
import type { Lead } from "@/data/crm-data";

interface Props {
  lead: Lead;
  /** Konverter leadet til salgsmulighet (status «Møte booket"). */
  onBooketMoete: (lead: Lead) => void;
}

export default function LeadHvaSkjedde({ lead, onBooketMoete }: Props) {
  const { updateLeads, updateOppgaver } = useCrmStore();
  const { canEdit, user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [dialogApen, setDialogApen] = useState(false);
  if (!canEdit) return null;
  const navn = lead.kontaktperson || lead.firmanavn;

  const hurtig = async (id: string) => {
    const h = QUICK_ACTIONS.find(q => q.id === id);
    if (!h) return null;
    const { nesteOppfolging } = await loggAktivitet({
      logg: h.logg, target: { lead_id: lead.id }, tittel: `${h.tittel} – ${navn}`, notat: h.beskrivelse, utfall: h.utfall,
    });
    return nesteOppfolging;
  };

  const kjør = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    try { await fn(); } catch (err) { console.error(err); toast.error("Kunne ikke logge utfallet"); } finally { setBusy(null); }
  };

  const svarteIkke = () => kjør("svarte-ikke", async () => {
    const neste = await hurtig("ringte-ikke-svar");
    updateLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: "Svarte ikke telefon", sist_aktivitet: idag(), neste_oppfolging: neste || datoOm(2) } : l));
    updateOppgaver(prev => [...prev, {
      id: crypto.randomUUID(), oppgave: `Ring ${navn} igjen`, lead_id: lead.id, selskap_id: "", salgsmulighet_id: "", kontakt_id: "",
      ansvarlig: lead.ansvarlig || user?.id || "", frist: datoOm(2), frist_tid: "", prioritet: "Medium", status: "Åpen", paaminnelse: true, notater: "",
    }]);
    toast("Svarte ikke – ny ring om 2 dager");
  });

  const booket = () => kjør("booket", async () => {
    const neste = await hurtig("ringte-booket-moete");
    updateLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: l.status === "Ny" ? "Kontaktet" : l.status, sist_aktivitet: idag(), neste_oppfolging: neste || l.neste_oppfolging } : l));
    onBooketMoete(lead);
  });

  const ikkeNaa = () => kjør("ikke-naa", async () => {
    const neste = await hurtig("ringte-ikke-naa");
    updateLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: l.status === "Ny" || l.status === "Svarte ikke telefon" ? "Kontaktet" : l.status, sist_aktivitet: idag(), neste_oppfolging: neste || datoOm(30) } : l));
    toast("Ikke nå – ny kontakt om 30 dager");
  });

  const ikkeInteressert = () => kjør("ikke-interessert", async () => {
    await loggAktivitet({ logg: "ringte", target: { lead_id: lead.id }, tittel: `Ringte ${navn}`, notat: "Ikke interessert" });
    updateLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: "Ikke aktuelt", sist_aktivitet: idag(), neste_oppfolging: "" } : l));
    toast("Ikke interessert – tatt ut av oppfølging");
  });

  const valg = [
    { id: "svarte-ikke", label: "Svarte ikke", hint: "Ny ring om 2 dager", icon: PhoneMissed, onClick: svarteIkke, primary: false },
    { id: "booket", label: "Booket møte", hint: "Blir salgsmulighet", icon: CalendarCheck, onClick: booket, primary: true },
    { id: "ikke-naa", label: "Ikke nå", hint: "Ny kontakt om 30 dager", icon: Clock, onClick: ikkeNaa, primary: false },
    { id: "ikke-interessert", label: "Ikke interessert", hint: "Ut av oppfølging", icon: Ban, onClick: ikkeInteressert, primary: false },
    { id: "annet", label: "Annet …", hint: "Logg aktivitet fritt", icon: MoreHorizontal, onClick: () => setDialogApen(true), primary: false },
  ];

  return (
    <section aria-labelledby="hva-skjedde" className="space-y-2">
      <h3 id="hva-skjedde" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hva skjedde?</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {valg.map(v => {
          const Icon = v.icon;
          return (
            <button
              key={v.id}
              type="button"
              disabled={busy !== null}
              onClick={v.onClick}
              className={cn(
                "flex min-h-[64px] flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                v.primary ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90" : "bg-card hover:bg-muted/60",
              )}
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold"><Icon className="h-4 w-4" />{v.label}</span>
              <span className={cn("text-[11px]", v.primary ? "text-primary-foreground/80" : "text-muted-foreground")}>{busy === v.id ? "Lagrer…" : v.hint}</span>
            </button>
          );
        })}
      </div>
      <LogActivityDialog
        open={dialogApen}
        onOpenChange={setDialogApen}
        target={{ lead_id: lead.id }}
        entityName={lead.firmanavn}
        onLogged={(res) => {
          if (res?.ikkeAktuelt) {
            updateLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: "Ikke aktuelt", sist_aktivitet: idag(), neste_oppfolging: "" } : l));
            return;
          }
          updateLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: l.status === "Ny" ? "Kontaktet" : l.status, sist_aktivitet: idag(), neste_oppfolging: res?.nesteOppfolging || l.neste_oppfolging } : l));
        }}
      />
    </section>
  );
}
