import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2, Search } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import MeetingFields from "@/components/MeetingFields";
import {
  LOGG_TYPER,
  loggAktivitet,
  loggTypeDef,
  type ActivityTarget,
  type LoggType,
} from "@/lib/activity-logging";

interface KontaktOption { id: string; navn: string }

interface TargetOption {
  key: string;
  label: string;
  sublabel: string;
  target: ActivityTarget;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fast tilknytning når dialogen åpnes fra et kort. */
  target?: ActivityTarget;
  /** Lar brukeren velge tilknytning i dialogen (global hurtigknapp). */
  allowTargetPick?: boolean;
  entityName?: string;
  kontaktListe?: KontaktOption[];
  defaultType?: LoggType;
  onLogged?: (res?: { id: string | null; nesteOppfolging: string }) => void;
}

export default function LogActivityDialog({
  open,
  onOpenChange,
  target,
  allowTargetPick,
  entityName,
  kontaktListe,
  defaultType = "ringte",
  onLogged,
}: Props) {
  const [type, setType] = useState<LoggType>(defaultType);
  const [notat, setNotat] = useState("");
  const [nesteSteg, setNesteSteg] = useState("");
  const [nesteStegDato, setNesteStegDato] = useState<Date | undefined>();
  const [saving, setSaving] = useState(false);

  const [meetingTittel, setMeetingTittel] = useState("");
  const [meetingDato, setMeetingDato] = useState("");
  const [meetingStartTid, setMeetingStartTid] = useState("09:00");
  const [meetingSluttTid, setMeetingSluttTid] = useState("10:00");
  const [meetingDeltakere, setMeetingDeltakere] = useState<string[]>([]);

  const [options, setOptions] = useState<TargetOption[]>([]);
  const [søk, setSøk] = useState("");
  const [valgt, setValgt] = useState<TargetOption | null>(null);

  useEffect(() => {
    if (!open) return;
    setType(defaultType);
    setNotat("");
    setNesteSteg("");
    setNesteStegDato(undefined);
    setValgt(null);
    setSøk("");
    setMeetingTittel("");
    setMeetingDato(new Date().toISOString().split("T")[0]);
    setMeetingStartTid("09:00");
    setMeetingSluttTid("10:00");
    setMeetingDeltakere([]);
  }, [open, defaultType]);

  useEffect(() => {
    if (!open || !allowTargetPick || options.length) return;
    let avbrutt = false;
    (async () => {
      const [sel, lead, sm] = await Promise.all([
        supabase.from("selskaper").select("id, firmanavn").order("firmanavn").limit(300),
        supabase.from("leads").select("id, firmanavn, kontaktperson").order("sist_aktivitet", { ascending: false }).limit(300),
        supabase.from("salgsmuligheter").select("id, navn, selskap_id").order("sist_aktivitet", { ascending: false }).limit(300),
      ]);
      if (avbrutt) return;
      const liste: TargetOption[] = [
        ...(sm.data || []).map(s => ({ key: `sm-${s.id}`, label: s.navn, sublabel: "Salgsmulighet", target: { salgsmulighet_id: s.id, selskap_id: s.selskap_id } })),
        ...(lead.data || []).map(l => ({ key: `lead-${l.id}`, label: l.firmanavn, sublabel: l.kontaktperson ? `Lead · ${l.kontaktperson}` : "Lead", target: { lead_id: l.id } })),
        ...(sel.data || []).map(s => ({ key: `sel-${s.id}`, label: s.firmanavn, sublabel: "Kunde", target: { selskap_id: s.id } })),
      ];
      setOptions(liste);
    })();
    return () => { avbrutt = true; };
  }, [open, allowTargetPick, options.length]);

  const filtrerte = useMemo(() => {
    const q = søk.trim().toLowerCase();
    if (!q) return options.slice(0, 8);
    return options.filter(o => o.label.toLowerCase().includes(q) || o.sublabel.toLowerCase().includes(q)).slice(0, 8);
  }, [options, søk]);

  const effektivtTarget = allowTargetPick ? valgt?.target : target;
  const kanLagre = Boolean(effektivtTarget) && !saving;

  const lagre = async () => {
    if (!effektivtTarget) return;
    setSaving(true);
    try {
      const res = await loggAktivitet({
        logg: type,
        target: effektivtTarget,
        notat,
        nesteSteg,
        nesteStegDato: nesteStegDato ? format(nesteStegDato, "yyyy-MM-dd") : undefined,
        meeting: type === "moete"
          ? { tittel: meetingTittel, dato: meetingDato, startTid: meetingStartTid, sluttTid: meetingSluttTid, deltakere: meetingDeltakere }
          : undefined,
      });
      toast.success("Aktivitet logget");
      onOpenChange(false);
      onLogged?.();
    } catch (err) {
      console.error(err);
      toast.error("Kunne ikke logge aktiviteten");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Logg aktivitet</DialogTitle>
          <DialogDescription>
            {entityName ? entityName : "Registrer det som skjedde"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {allowTargetPick && (
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Gjelder</Label>
              {valgt ? (
                <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{valgt.label}</p>
                    <p className="text-xs text-muted-foreground">{valgt.sublabel}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setValgt(null)}>Bytt</Button>
                </div>
              ) : (
                <div className="rounded-lg border">
                  <div className="relative border-b">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      autoFocus
                      value={søk}
                      onChange={e => setSøk(e.target.value)}
                      placeholder="Søk etter selskap, lead eller salgsmulighet"
                      className="h-9 border-0 pl-8 text-sm focus-visible:ring-0"
                    />
                  </div>
                  <div className="max-h-44 overflow-y-auto">
                    {filtrerte.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">Ingen treff</p>}
                    {filtrerte.map(o => (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => setValgt(o)}
                        className="w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors"
                      >
                        <span className="text-sm block truncate">{o.label}</span>
                        <span className="text-[11px] text-muted-foreground">{o.sublabel}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

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
                    aktiv ? "border-primary bg-primary/5 text-primary font-medium" : "border-border text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[11px] leading-tight text-center">{t.label}</span>
                </button>
              );
            })}
          </div>

          {type === "moete" && (
            <MeetingFields
              tittel={meetingTittel}
              dato={meetingDato}
              startTid={meetingStartTid}
              sluttTid={meetingSluttTid}
              onTittelChange={setMeetingTittel}
              onDatoChange={setMeetingDato}
              onStartTidChange={setMeetingStartTid}
              onSluttTidChange={setMeetingSluttTid}
              deltakere={meetingDeltakere}
              onDeltakereChange={setMeetingDeltakere}
              kontaktListe={kontaktListe}
            />
          )}

          <div className="space-y-1.5">
            <Label htmlFor="logg-notat" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Notat <span className="normal-case font-normal">(valgfritt)</span>
            </Label>
            <Textarea
              id="logg-notat"
              rows={3}
              value={notat}
              onChange={e => setNotat(e.target.value)}
              placeholder={loggTypeDef(type).defaultTittel + "…"}
            />
          </div>

          <div className="space-y-1.5 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
            <Label htmlFor="logg-neste-steg" className="text-xs font-medium uppercase tracking-wide text-blue-600">
              Neste steg <span className="normal-case font-normal text-muted-foreground">(valgfritt)</span>
            </Label>
            <Input
              id="logg-neste-steg"
              value={nesteSteg}
              onChange={e => setNesteSteg(e.target.value)}
              placeholder="Hva skjer videre?"
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("w-full justify-start text-left font-normal", !nesteStegDato && "text-muted-foreground")}
                >
                  <CalendarIcon className="w-3.5 h-3.5 mr-2" />
                  {nesteStegDato ? format(nesteStegDato, "d. MMMM yyyy", { locale: nb }) : "Velg frist"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={nesteStegDato}
                  onSelect={setNesteStegDato}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <Button className="w-full" onClick={lagre} disabled={!kanLagre}>
            {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            Logg aktivitet
          </Button>
          {allowTargetPick && !valgt && (
            <p className="text-xs text-muted-foreground text-center">Velg hva aktiviteten gjelder for å lagre.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
