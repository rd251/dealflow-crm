import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { nok } from "@/lib/utils";
import { Clock, Plus, FileText, Check, Loader2 } from "lucide-react";
import { STANDARD_TIMEPRIS, TIME_TYPER, iDag, type ProsjektTime } from "@/lib/kundeforhold";

interface Props {
  prosjektId: string;
  selskapId: string;
  firmanavn: string;
  /** Timepris satt på prosjektet. */
  timepris?: number;
}

const formaterTimer = (t: number) => t.toLocaleString("no-NO", { maximumFractionDigits: 2 });

export default function Timeregistrering({ prosjektId, selskapId, firmanavn, timepris }: Props) {
  const { user } = useAuth();
  const standardpris = timepris || STANDARD_TIMEPRIS;
  const [rader, setRader] = useState<ProsjektTime[]>([]);
  const [laster, setLaster] = useState(true);
  const [visSkjema, setVisSkjema] = useState(false);
  const [lagrer, setLagrer] = useState(false);
  const [valgte, setValgte] = useState<string[]>([]);
  const [fakturaApen, setFakturaApen] = useState(false);
  const [skjema, setSkjema] = useState({
    type: "Oppsett" as string,
    beskrivelse: "",
    dato: iDag(),
    timer: "",
    timepris: String(standardpris),
  });

  const hent = useCallback(async () => {
    setLaster(true);
    const { data, error } = await supabase
      .from("prosjekt_timer")
      .select("*")
      .eq("prosjekt_id", prosjektId)
      .order("dato", { ascending: false });
    if (error) {
      console.error(error);
      toast.error("Kunne ikke hente timer");
    }
    setRader((data as unknown as ProsjektTime[]) || []);
    setLaster(false);
  }, [prosjektId]);

  useEffect(() => { hent(); }, [hent]);

  const sum = useMemo(() => {
    const totaltTimer = rader.reduce((s, r) => s + Number(r.timer), 0);
    const totalt = rader.reduce((s, r) => s + Number(r.timer) * Number(r.timepris), 0);
    const fakturert = rader.filter(r => r.fakturert).reduce((s, r) => s + Number(r.timer) * Number(r.timepris), 0);
    return { totaltTimer, totalt, fakturert, gjenstar: totalt - fakturert };
  }, [rader]);

  const ufakturerte = rader.filter(r => !r.fakturert);

  const leggTil = async () => {
    const antall = Number(skjema.timer.replace(",", "."));
    if (!antall || antall <= 0) { toast.error("Fyll inn antall timer"); return; }
    setLagrer(true);
    const { error } = await supabase.from("prosjekt_timer").insert({
      prosjekt_id: prosjektId,
      selskap_id: selskapId || null,
      type: skjema.type,
      beskrivelse: skjema.beskrivelse.trim(),
      dato: skjema.dato,
      timer: antall,
      timepris: Number(skjema.timepris.replace(",", ".")) || standardpris,
      opprettet_av: user?.id ?? null,
    });
    setLagrer(false);
    if (error) { toast.error("Kunne ikke lagre timen"); return; }
    setSkjema({ type: "Oppsett", beskrivelse: "", dato: iDag(), timer: "", timepris: String(standardpris) });
    setVisSkjema(false);
    toast.success("Time registrert");
    hent();
  };

  const merkFakturert = async () => {
    if (valgte.length === 0) { toast.error("Velg timer som skal merkes"); return; }
    const { error } = await supabase
      .from("prosjekt_timer")
      .update({ fakturert: true, fakturert_dato: iDag() })
      .in("id", valgte);
    if (error) { toast.error("Kunne ikke merke som fakturert"); return; }
    toast.success(`${valgte.length} ${valgte.length === 1 ? "time" : "timer"} merket som fakturert`);
    setValgte([]);
    hent();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> Timeregistrering
        </h3>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setVisSkjema(v => !v)}>
          <Plus className="w-3 h-3" />{visSkjema ? "Avbryt" : "Ny time"}
        </Button>
      </div>

      {visSkjema && (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-xs text-muted-foreground">Type</span>
              <select
                className="w-full border rounded-md px-2 py-1.5 text-sm bg-background h-8 mt-0.5"
                value={skjema.type}
                onChange={e => setSkjema(s => ({ ...s, type: e.target.value }))}
              >
                {TIME_TYPER.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Dato</span>
              <Input type="date" className="h-8 text-sm mt-0.5" value={skjema.dato} onChange={e => setSkjema(s => ({ ...s, dato: e.target.value }))} />
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Antall timer</span>
              <Input inputMode="decimal" placeholder="f.eks. 1,5" className="h-8 text-sm mt-0.5 tabular-nums" value={skjema.timer} onChange={e => setSkjema(s => ({ ...s, timer: e.target.value }))} />
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Timepris (kr/t)</span>
              <Input inputMode="decimal" className="h-8 text-sm mt-0.5 tabular-nums" value={skjema.timepris} onChange={e => setSkjema(s => ({ ...s, timepris: e.target.value }))} />
            </div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Beskrivelse</span>
            <Input className="h-8 text-sm mt-0.5" placeholder="Hva ble gjort?" value={skjema.beskrivelse} onChange={e => setSkjema(s => ({ ...s, beskrivelse: e.target.value }))} />
          </div>
          <Button size="sm" className="w-full h-8 text-xs" onClick={leggTil} disabled={lagrer}>
            {lagrer ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Registrer time"}
          </Button>
        </div>
      )}

      {laster ? (
        <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
      ) : rader.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">Ingen timer registrert ennå.</p>
      ) : (
        <div className="space-y-1.5">
          {rader.map(r => (
            <div key={r.id} className="flex items-center gap-2.5 rounded-lg border bg-muted/30 px-3 py-2">
              <Checkbox
                checked={valgte.includes(r.id)}
                disabled={r.fakturert}
                onCheckedChange={c => setValgte(v => c ? [...v, r.id] : v.filter(i => i !== r.id))}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{r.beskrivelse || r.type}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0">{r.type}</Badge>
                  {r.fakturert && <Badge className="bg-success/10 text-success text-[10px] shrink-0">Fakturert</Badge>}
                </div>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {new Date(r.dato).toLocaleDateString("no-NO")} · {formaterTimer(Number(r.timer))} t × {nok(Number(r.timepris))}
                </p>
              </div>
              <span className="text-sm font-medium tabular-nums shrink-0">{nok(Number(r.timer) * Number(r.timepris))}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border bg-muted/50 p-3">
          <div className="font-display text-lg font-semibold tabular-nums">{formaterTimer(sum.totaltTimer)}</div>
          <div className="text-xs text-muted-foreground">Timer totalt</div>
        </div>
        <div className="rounded-lg border bg-muted/50 p-3">
          <div className="font-display text-lg font-semibold tabular-nums">{nok(sum.totalt)}</div>
          <div className="text-xs text-muted-foreground">Sum</div>
        </div>
        <div className="rounded-lg border bg-muted/50 p-3">
          <div className="font-display text-lg font-semibold tabular-nums">{nok(sum.fakturert)}</div>
          <div className="text-xs text-muted-foreground">Allerede fakturert</div>
        </div>
        <div className="rounded-lg border bg-muted/50 p-3">
          <div className="font-display text-lg font-semibold tabular-nums">{nok(sum.gjenstar)}</div>
          <div className="text-xs text-muted-foreground">Gjenstår å fakturere</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setFakturaApen(true)} disabled={ufakturerte.length === 0}>
          <FileText className="w-3 h-3" /> Forhåndsvis faktura
        </Button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled>
                  Eksporter til Tripletex
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Kommer snart — Tripletex-integrasjon settes opp</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button size="sm" className="h-7 text-xs gap-1" onClick={merkFakturert} disabled={valgte.length === 0}>
          <Check className="w-3 h-3" /> Merk som fakturert
        </Button>
      </div>

      <Dialog open={fakturaApen} onOpenChange={setFakturaApen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Faktureringsgrunnlag — {firmanavn}</DialogTitle>
            <DialogDescription>Timer som ikke er fakturert ennå.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {ufakturerte.map(r => (
              <div key={r.id} className="flex items-start justify-between gap-3 border-b pb-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{r.beskrivelse || r.type}</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {new Date(r.dato).toLocaleDateString("no-NO")} · {r.type} · {formaterTimer(Number(r.timer))} t × {nok(Number(r.timepris))}
                  </p>
                </div>
                <span className="text-sm tabular-nums shrink-0">{nok(Number(r.timer) * Number(r.timepris))}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-semibold">Sum å fakturere</span>
              <span className="font-display text-lg font-semibold tabular-nums">{nok(sum.gjenstar)}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
