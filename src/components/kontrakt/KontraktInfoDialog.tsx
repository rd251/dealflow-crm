import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn, nok } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCrmStore } from "@/hooks/use-crm-store";
import type { Salgsmulighet } from "@/data/crm-data";
import {
  NY_SALGSMULIGHET, UTTREKK_ETIKETTER, beregnArr, kontraktsinfoSammendrag, medKontraktsinfo,
  salgsmuligheterForSelskap, selskapMedKontraktsinfo, standardSalgsmulighet, sumPakker,
  type KontraktUttrekk,
} from "@/lib/kontrakt-uttrekk";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selskapId: string;
  filNavn: string;
  uttrekk: KontraktUttrekk | null;
  /** Forhåndsvelg denne salgsmuligheten (når dialogen åpnes fra salgsmuligheten selv). */
  salgsmulighetId?: string;
  onLagret?: (salgsmulighetId: string) => void;
}

const iDag = () => new Date().toISOString().split("T")[0];

function UsikkerMerke({ vis }: { vis: boolean }) {
  if (!vis) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning-foreground">
      <AlertTriangle className="h-3 w-3 text-warning" aria-hidden /> Usikker – sjekk
    </span>
  );
}

export default function KontraktInfoDialog({ open, onOpenChange, selskapId, filNavn, uttrekk, salgsmulighetId, onLagret }: Props) {
  const { user } = useAuth();
  const { salgsmuligheter, selskaper, updateSalgsmuligheter, updateSelskaper } = useCrmStore();
  const selskap = selskaper.find((s) => s.id === selskapId);
  const kandidater = useMemo(() => salgsmuligheterForSelskap(salgsmuligheter, selskapId), [salgsmuligheter, selskapId]);

  const [skjema, setSkjema] = useState<KontraktUttrekk | null>(uttrekk);
  const [maal, setMaal] = useState("");
  const [oppdaterMrr, setOppdaterMrr] = useState(false);
  const [fyllInn, setFyllInn] = useState(false);
  const [lagrer, setLagrer] = useState(false);

  useEffect(() => {
    if (!open || !uttrekk) return;
    setSkjema({ ...uttrekk, pakker: uttrekk.pakker.map((p) => ({ ...p })) });
    const standard = salgsmulighetId && kandidater.some((s) => s.id === salgsmulighetId) ? salgsmulighetId : standardSalgsmulighet(kandidater);
    setMaal(standard);
    const valgt = kandidater.find((s) => s.id === standard);
    setOppdaterMrr(selskap?.kundestatus === "Live" || selskap?.kundestatus === "Pilot" || valgt?.status === "Vunnet");
    setFyllInn(!!selskap && ((!selskap.orgnr && !!uttrekk.orgnr) || (!selskap.firmaadresse && !!uttrekk.adresse)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, uttrekk]);

  if (!skjema) return null;

  const usikker = (felt: string) => skjema.usikre_felt.includes(felt);
  const sett = <K extends keyof KontraktUttrekk>(felt: K, verdi: KontraktUttrekk[K]) =>
    setSkjema((s) => (s ? { ...s, [felt]: verdi } : s));
  const tallEllerNull = (v: string) => (v.trim() === "" ? null : Number(v));
  const pakkeSum = sumPakker(skjema.pakker);
  const mrrAvvik = skjema.pakker.length > 0 && Math.abs(pakkeSum - (Number(skjema.mrr) || 0)) > 0.5;

  const feltKlasse = (felt: string) => cn(usikker(felt) && "border-warning ring-1 ring-warning/40 bg-warning/5");

  const tekstFelt = (felt: "firmanavn" | "orgnr" | "adresse" | "kontaktperson" | "e_post" | "telefon" | "oppsigelsestid", type = "text") => (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`kf-${felt}`} className="text-xs text-muted-foreground">{UTTREKK_ETIKETTER[felt]}</Label>
        <UsikkerMerke vis={usikker(felt)} />
      </div>
      <Input id={`kf-${felt}`} type={type} value={skjema[felt]} onChange={(e) => sett(felt, e.target.value)} className={feltKlasse(felt)} />
    </div>
  );

  const tallFelt = (felt: "sla_per_mnd" | "oppstartskostnad" | "bindingstid_mnd", hjelp: string) => (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`kf-${felt}`} className="text-xs text-muted-foreground">{UTTREKK_ETIKETTER[felt]}</Label>
        <UsikkerMerke vis={usikker(felt)} />
      </div>
      <Input
        id={`kf-${felt}`} type="number" inputMode="decimal" min={0}
        value={skjema[felt] ?? ""} placeholder="Ikke oppgitt"
        onChange={(e) => sett(felt, tallEllerNull(e.target.value))}
        className={cn("tabular-nums", feltKlasse(felt))}
      />
      <p className="text-[11px] text-muted-foreground">{hjelp}</p>
    </div>
  );

  const datoFelt = (felt: "startdato" | "avtaledato") => (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`kf-${felt}`} className="text-xs text-muted-foreground">{UTTREKK_ETIKETTER[felt]}</Label>
        <UsikkerMerke vis={usikker(felt)} />
      </div>
      <Input id={`kf-${felt}`} type="date" value={skjema[felt]} onChange={(e) => sett(felt, e.target.value)} className={feltKlasse(felt)} />
    </div>
  );

  const lagre = async () => {
    if (!maal) { toast.error("Velg hvilken salgsmulighet kontraktsinfoen skal lagres på."); return; }
    if (!selskap) { toast.error("Fant ikke selskapet."); return; }
    setLagrer(true);
    try {
      const dag = iDag();
      let smId = maal;
      if (maal === NY_SALGSMULIGHET) {
        // Opprettes direkte først, slik at aktiviteten under kan kobles til den.
        const navn = skjema.pakker.length ? skjema.pakker.map((p) => p.navn).join(" + ") : (skjema.firmanavn || selskap.firmanavn);
        const { data: ny, error } = await supabase.from("salgsmuligheter").insert({
          navn, selskap_id: selskapId, ansvarlig: user?.id ?? null, status: "Tilbud sendt",
          sannsynlighet: 75, opprettet_dato: dag, sist_aktivitet: dag, kilde: selskap.kilde || "Direkte salg",
          kontrakt_status: "Ikke sendt", valgt_pakke: "", valgte_pakker: [],
        }).select("id").single();
        if (error || !ny) throw new Error(error?.message || "Kunne ikke opprette salgsmulighet");
        smId = ny.id;
        const basis: Salgsmulighet = {
          id: smId, navn, selskap_id: selskapId, kontakt_id: "", ansvarlig: user?.id ?? "", status: "Tilbud sendt",
          forventet_mrr: 0, sla: 0, oppstartskostnad: 0, kontraktslengde_mnd: 12, sannsynlighet: 75,
          forventet_lukkedato: "", vunnet_dato: "", tapt_dato: "", tapsaarsak: "", neste_steg: "", notater: "",
          opprettet_dato: dag, sist_aktivitet: dag, kilde: selskap.kilde || "Direkte salg", partner_id: "",
          partner_provisjon: 0, partner_kostnad: 0, netto_inntekt: 0, rolle_i_firma: "", use_case: "",
          kontaktperson: "", e_post: "", telefon: "", kontrakt_status: "Ikke sendt", kontrakt_signert_dato: "",
          dealbuilder_dokument_id: "", valgt_pakke: "", valgte_pakker: [],
        };
        updateSalgsmuligheter((prev) => [...prev, medKontraktsinfo(basis, skjema, dag)]);
      } else {
        updateSalgsmuligheter((prev) => prev.map((s) => (s.id === smId ? medKontraktsinfo(s, skjema, dag) : s)));
      }

      if (oppdaterMrr || fyllInn) {
        updateSelskaper((prev) => prev.map((s) => (s.id === selskapId ? selskapMedKontraktsinfo(s, skjema, { oppdaterMrr, fyllInnMangler: fyllInn }) : s)));
      }

      const { error: aktErr } = await supabase.from("aktiviteter").insert({
        type: "Notat",
        tittel: "Kontraktsinfo oppdatert fra PDF",
        beskrivelse: kontraktsinfoSammendrag(skjema, filNavn, nok),
        dato: new Date().toISOString(),
        salgsmulighet_id: smId,
        selskap_id: selskapId,
        user_id: user?.id ?? null,
        aktivitet_kilde: "kontrakt_pdf",
      });
      if (aktErr) console.error("Kunne ikke logge aktivitet", aktErr);

      toast.success("Kontraktsinfo lagret på kunden");
      onLagret?.(smId);
      onOpenChange(false);
    } catch (e) {
      toast.error("Kunne ikke lagre kontraktsinfo", { description: (e as Error).message?.slice(0, 140) });
    } finally {
      setLagrer(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !lagrer && onOpenChange(o)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" aria-hidden /> Kontraktsinfo fra PDF
          </DialogTitle>
          <DialogDescription>
            Hentet med AI fra «{filNavn}». Sjekk og rett feltene – ingenting lagres før du trykker «Lagre på kunden».
          </DialogDescription>
        </DialogHeader>

        {skjema.usikre_felt.length > 0 && (
          <div role="status" className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
            <p>
              AI-en er usikker på: <strong>{skjema.usikre_felt.map((f) => UTTREKK_ETIKETTER[f] || f).join(", ")}</strong>. Sjekk disse mot kontrakten.
            </p>
          </div>
        )}

        <div className="space-y-6">
          {/* Beløp */}
          <section className="rounded-xl border bg-muted/30 p-4" aria-label="Beløp">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="kf-mrr" className="text-xs font-medium">MRR (fast månedlig)</Label>
                  <UsikkerMerke vis={usikker("mrr")} />
                </div>
                <Input id="kf-mrr" type="number" inputMode="decimal" min={0} value={skjema.mrr || ""}
                  onChange={(e) => sett("mrr", Number(e.target.value) || 0)}
                  className={cn("text-lg font-semibold tabular-nums", feltKlasse("mrr"))} />
                <p className="text-[11px] text-muted-foreground">Uten SLA og oppstartskostnad.</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium">ARR (MRR × 12)</span>
                <p className="flex h-10 items-center text-lg font-semibold tabular-nums">{nok(beregnArr(skjema.mrr))}</p>
                {mrrAvvik && (
                  <p className="text-[11px] text-warning-foreground">
                    Sum pakker er {nok(pakkeSum)}.{" "}
                    <button type="button" className="underline underline-offset-2" onClick={() => sett("mrr", pakkeSum)}>Bruk summen</button>
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {tallFelt("sla_per_mnd", "Holdes utenfor MRR.")}
              {tallFelt("oppstartskostnad", "Engangsbeløp, utenfor MRR.")}
              {tallFelt("bindingstid_mnd", "Antall måneder.")}
            </div>
          </section>

          {/* Pakker */}
          <section aria-label="Pakker" className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">Pakker</h4>
              <UsikkerMerke vis={usikker("pakker")} />
            </div>
            {skjema.pakker.length === 0 && <p className="text-xs text-muted-foreground">Ingen pakker funnet i kontrakten.</p>}
            {skjema.pakker.map((p, i) => (
              <div key={i} className="grid grid-cols-[1fr_7rem_auto] gap-2 sm:grid-cols-[1fr_7rem_1fr_auto]">
                <Input aria-label="Pakkenavn" value={p.navn} placeholder="Pakkenavn"
                  onChange={(e) => sett("pakker", skjema.pakker.map((x, j) => (j === i ? { ...x, navn: e.target.value } : x)))} />
                <Input aria-label="Månedspris" type="number" min={0} className="tabular-nums" value={p.manedspris || ""} placeholder="kr/mnd"
                  onChange={(e) => sett("pakker", skjema.pakker.map((x, j) => (j === i ? { ...x, manedspris: Number(e.target.value) || 0 } : x)))} />
                <Input aria-label="Inkludert" className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto" value={p.minutter} placeholder="Inkludert (f.eks. 500 min)"
                  onChange={(e) => sett("pakker", skjema.pakker.map((x, j) => (j === i ? { ...x, minutter: e.target.value } : x)))} />
                <Button type="button" variant="ghost" size="icon" aria-label={`Fjern ${p.navn || "pakke"}`}
                  onClick={() => sett("pakker", skjema.pakker.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="gap-1"
              onClick={() => sett("pakker", [...skjema.pakker, { navn: "", manedspris: 0, minutter: "" }])}>
              <Plus className="h-3.5 w-3.5" /> Legg til pakke
            </Button>
          </section>

          {/* Kunde */}
          <section aria-label="Kunde" className="space-y-3">
            <h4 className="text-sm font-semibold">Kunde</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              {tekstFelt("firmanavn")}
              {tekstFelt("orgnr")}
              <div className="sm:col-span-2">{tekstFelt("adresse")}</div>
              {tekstFelt("kontaktperson")}
              {tekstFelt("e_post", "email")}
              {tekstFelt("telefon", "tel")}
            </div>
          </section>

          {/* Avtale */}
          <section aria-label="Avtale" className="space-y-3">
            <h4 className="text-sm font-semibold">Avtale</h4>
            <div className="grid gap-4 sm:grid-cols-3">
              {datoFelt("startdato")}
              {datoFelt("avtaledato")}
              {tekstFelt("oppsigelsestid")}
            </div>
          </section>

          {/* Mål */}
          <section aria-label="Lagre på" className="space-y-3 rounded-xl border p-4">
            <Label htmlFor="kf-maal" className="text-sm font-semibold">Lagre på salgsmulighet / kundeforhold</Label>
            <Select value={maal} onValueChange={setMaal}>
              <SelectTrigger id="kf-maal"><SelectValue placeholder="Velg salgsmulighet" /></SelectTrigger>
              <SelectContent>
                {kandidater.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.navn} · {s.status} · {nok(s.forventet_mrr)}/mnd
                  </SelectItem>
                ))}
                <SelectItem value={NY_SALGSMULIGHET}>+ Opprett ny salgsmulighet på {selskap?.firmanavn || "selskapet"}</SelectItem>
              </SelectContent>
            </Select>
            {kandidater.length === 0 && (
              <p className="text-xs text-muted-foreground">Selskapet har ingen salgsmuligheter ennå – en ny opprettes når du lagrer.</p>
            )}
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={oppdaterMrr} onCheckedChange={(v) => setOppdaterMrr(v === true)} className="mt-0.5" />
              <span>Oppdater også MRR, ARR og oppstart på kundeforholdet ({selskap?.firmanavn})</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={fyllInn} onCheckedChange={(v) => setFyllInn(v === true)} className="mt-0.5" />
              <span>Fyll inn manglende org.nr. og adresse på selskapet</span>
            </label>
          </section>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={lagrer}>Avbryt</Button>
          <Button onClick={lagre} disabled={lagrer || !maal}>
            {lagrer && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Lagre på kunden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
