import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCrmStore } from "@/hooks/use-crm-store";
import { LOGG_TYPER, loggAktivitet, loggTypeDef, type LoggType } from "@/lib/activity-logging";
import type { Kontakt, Selskap } from "@/data/crm-data";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (kontaktId: string) => void;
}

const idag = () => new Date().toISOString().split("T")[0];

/** Ny person + første interaksjon i én flyt. Kun navn er påkrevd. */
export default function QuickAddPersonDialog({ open, onOpenChange, onCreated }: Props) {
  const { selskaper, kontakter, updateKontakter, updateSelskaper } = useCrmStore();

  const [navn, setNavn] = useState("");
  const [ePost, setEPost] = useState("");
  const [telefon, setTelefon] = useState("");
  const [rolle, setRolle] = useState("");
  const [selskapSøk, setSelskapSøk] = useState("");
  const [valgtSelskap, setValgtSelskap] = useState<Selskap | null>(null);

  const [loggFørste, setLoggFørste] = useState(true);
  const [type, setType] = useState<LoggType>("ringte");
  const [notat, setNotat] = useState("");
  const [lagrer, setLagrer] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNavn(""); setEPost(""); setTelefon(""); setRolle("");
    setSelskapSøk(""); setValgtSelskap(null);
    setLoggFørste(true); setType("ringte"); setNotat("");
  }, [open]);

  const treff = useMemo(() => {
    const q = selskapSøk.trim().toLowerCase();
    if (!q) return [];
    return selskaper.filter(s => s.firmanavn.toLowerCase().includes(q)).slice(0, 6);
  }, [selskaper, selskapSøk]);

  const lagre = async () => {
    if (!navn.trim()) return;
    setLagrer(true);
    try {
      let selskapId = valgtSelskap?.id || "";
      const nyttNavn = selskapSøk.trim();

      if (!selskapId && nyttNavn) {
        const finnes = selskaper.find(s => s.firmanavn.toLowerCase() === nyttNavn.toLowerCase());
        if (finnes) {
          selskapId = finnes.id;
        } else {
          selskapId = crypto.randomUUID();
          const nyttSelskap: Selskap = {
            id: selskapId, firmanavn: nyttNavn, bransje: "", kundeansvarlig: "",
            kundestatus: "Ikke kunde", live_status: false, onboarding_status: "Ikke startet",
            mrr: 0, arr: 0, oppstartskostnad: 0, go_live_dato: "", kansellert_dato: "",
            kanselleringsaarsak: "", kanselleringsnotat: "", kundetilstand: "Bra",
            sist_aktivitet: idag(), neste_steg: "", notater: "",
            kilde: "Direkte salg", partner_id: "", lukkedato: "", domene: "", orgnr: "",
            firmaadresse: "", postadresse: "",
          };
          updateSelskaper(prev => [...prev, nyttSelskap]);
        }
      }

      const kontaktId = crypto.randomUUID();
      const nyKontakt: Kontakt = {
        id: kontaktId,
        navn: navn.trim(),
        selskap_id: selskapId,
        rolle: rolle.trim(),
        e_post: ePost.trim(),
        telefon: telefon.trim(),
        linkedin: "",
        notater: "",
      };
      updateKontakter(prev => [...prev, nyKontakt]);

      if (loggFørste) {
        await loggAktivitet({
          logg: type,
          target: { kontakt_id: kontaktId, selskap_id: selskapId || null },
          notat,
        });
      }

      toast.success(loggFørste ? "Person lagt til og aktivitet logget" : "Person lagt til");
      onOpenChange(false);
      onCreated?.(kontaktId);
    } catch (err) {
      console.error(err);
      toast.error("Kunne ikke lagre personen");
    } finally {
      setLagrer(false);
    }
  };

  const duplikat = useMemo(() => {
    const e = ePost.trim().toLowerCase();
    if (!e) return null;
    return kontakter.find(k => k.e_post.toLowerCase() === e) || null;
  }, [kontakter, ePost]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ny person</DialogTitle>
          <DialogDescription>Navn holder — resten er valgfritt.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="person-navn" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Navn</Label>
            <Input id="person-navn" autoFocus value={navn} onChange={e => setNavn(e.target.value)} placeholder="Fornavn Etternavn" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="person-epost" className="text-xs text-muted-foreground">E-post</Label>
              <Input id="person-epost" type="email" value={ePost} onChange={e => setEPost(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="person-tlf" className="text-xs text-muted-foreground">Telefon</Label>
              <Input id="person-tlf" type="tel" value={telefon} onChange={e => setTelefon(e.target.value)} />
            </div>
          </div>
          {duplikat && (
            <p className="text-xs text-warning">Finnes allerede: {duplikat.navn}. Du kan fortsatt lagre.</p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="person-rolle" className="text-xs text-muted-foreground">Rolle</Label>
            <Input id="person-rolle" value={rolle} onChange={e => setRolle(e.target.value)} placeholder="Daglig leder" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Selskap</Label>
            {valgtSelskap ? (
              <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
                <span className="truncate text-sm font-medium">{valgtSelskap.firmanavn}</span>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setValgtSelskap(null); setSelskapSøk(""); }}>Bytt</Button>
              </div>
            ) : (
              <div className="rounded-lg border">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={selskapSøk}
                    onChange={e => setSelskapSøk(e.target.value)}
                    placeholder="Søk eller skriv nytt firmanavn"
                    className="h-9 border-0 pl-8 text-sm focus-visible:ring-0"
                  />
                </div>
                {treff.length > 0 && (
                  <div className="max-h-36 overflow-y-auto border-t">
                    {treff.map(s => (
                      <button key={s.id} type="button" onClick={() => setValgtSelskap(s)} className="block w-full truncate px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60">
                        {s.firmanavn}
                      </button>
                    ))}
                  </div>
                )}
                {selskapSøk.trim() && treff.length === 0 && (
                  <p className="border-t px-3 py-2 text-xs text-muted-foreground">Nytt selskap «{selskapSøk.trim()}» opprettes.</p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <input type="checkbox" checked={loggFørste} onChange={e => setLoggFørste(e.target.checked)} className="h-3.5 w-3.5 accent-[hsl(var(--primary))]" />
              Logg første interaksjon
            </label>
            {loggFørste && (
              <>
                <div className="grid grid-cols-3 gap-1.5">
                  {LOGG_TYPER.map(t => {
                    const Icon = t.icon;
                    const aktiv = type === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setType(t.value)}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-lg border p-2 text-xs transition-colors",
                          aktiv ? "border-primary bg-primary/5 font-medium text-primary" : "border-border text-muted-foreground hover:bg-muted/50"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-[11px] leading-tight text-center">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
                <Textarea rows={2} value={notat} onChange={e => setNotat(e.target.value)} placeholder={loggTypeDef(type).defaultTittel + "…"} />
              </>
            )}
          </div>

          <Button className="w-full" onClick={lagre} disabled={!navn.trim() || lagrer}>
            {lagrer ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <UserPlus className="mr-1.5 h-4 w-4" />}
            Lagre person
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
