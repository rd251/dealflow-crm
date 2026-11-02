import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { toast } from "sonner";
import { Ban, CalendarCheck, Clock, FileText, MessageSquare, Phone, PhoneCall, PhoneMissed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import OppgaveTid from "@/components/OppgaveTid";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { loggAktivitet, type ActivityTarget } from "@/lib/activity-logging";
import {
  LOGG_VALG, RING_TILBAKE_VALG, erGjeldendeOppfolging, forslagOppfolging, leadStatusEtterValg, lokalDato, lukkerOppgave,
  oppfolgingTittel, ringTilbakeTid, type LoggValg, type RingTilbake,
} from "@/lib/logg-utfall";
import { cn } from "@/lib/utils";
import type { Lead } from "@/data/crm-data";

export interface LoggResultat { id: string | null; nesteOppfolging: string; ikkeAktuelt: boolean }

interface Props {
  target: ActivityTarget;
  /** Navn brukt i titler. Hentes fra CRM-et hvis tomt. */
  navn?: string;
  /** Oppgaven kortet er åpnet fra – lukkes ved lagring. */
  oppgaveId?: string;
  ansvarlig?: string;
  /** Egen konvertering ved «Booket møte» (ellers brukes standard konvertering). */
  onBooketMoete?: (lead: Lead) => void;
  onLogged?: (res: LoggResultat) => void;
  className?: string;
}

const IKON: Record<LoggValg, typeof Phone> = {
  snakket: PhoneCall, svarte_ikke: PhoneMissed, ring_tilbake: Phone, booket: CalendarCheck,
  ikke_naa: Clock, ikke_interessert: Ban, melding: MessageSquare, notat: FileText,
};

/** Den eneste måten å logge et utfall på i CRM-et. */
export default function LoggUtfall({ target, navn: navnProp, oppgaveId, ansvarlig: ansvarligProp, onBooketMoete, onLogged, className }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { leads, salgsmuligheter, kontakter, selskaper, oppgaver, updateLeads, updateOppgaver, updateSalgsmuligheter, konverterLead } = useCrmStore();

  const lead = leads.find(l => l.id === target.lead_id);
  const sm = salgsmuligheter.find(s => s.id === target.salgsmulighet_id);
  const kontakt = kontakter.find(k => k.id === target.kontakt_id);
  const selskap = selskaper.find(s => s.id === target.selskap_id);
  const navn = (navnProp || kontakt?.navn || lead?.kontaktperson || sm?.kontaktperson || lead?.firmanavn || sm?.navn || selskap?.firmanavn || "").trim();
  const ansvarlig = ansvarligProp || lead?.ansvarlig || sm?.ansvarlig || user?.id || "";

  const [valg, setValg] = useState<LoggValg | null>(null);
  const [notat, setNotat] = useState("");
  const [dato, setDato] = useState("");
  const [tid, setTid] = useState("");
  const [tittel, setTittel] = useState("");
  const [tittelRedigert, setTittelRedigert] = useState(false);
  const [ringValg, setRingValg] = useState<RingTilbake>("1t");
  const [kanal, setKanal] = useState<"SMS" | "E-post">("SMS");
  const [moeteDato, setMoeteDato] = useState("");
  const [moeteTid, setMoeteTid] = useState("10:00");
  const [lagrer, setLagrer] = useState(false);
  const [bekreft, setBekreft] = useState(false);

  const velg = (v: LoggValg) => {
    setValg(v);
    const f = forslagOppfolging(v);
    setDato(f.dato); setTid(f.tid);
    if (!tittelRedigert) setTittel(oppfolgingTittel(v, navn));
    if (v === "ring_tilbake") setRingValg("1t");
    if (v === "booket") { setMoeteDato(f.dato); setMoeteTid(f.tid); }
  };

  const velgRing = (r: RingTilbake) => {
    setRingValg(r);
    if (r !== "egen") { const t = ringTilbakeTid(r); setDato(t.dato); setTid(t.tid); }
  };

  const settMoete = (d: string, t: string) => { setMoeteDato(d); setMoeteTid(t); setDato(d); setTid(t); };

  const aktivitetTittel = useMemo(() => {
    const n = navn ? ` – ${navn}` : "";
    const naar = dato ? ` ${format(new Date(`${dato}T12:00`), "d. MMM", { locale: nb })}${tid ? ` ${tid}` : ""}` : "";
    switch (valg) {
      case "snakket": return `Snakket med${n}`;
      case "svarte_ikke": return `Ringte – svarte ikke${n}`;
      case "ring_tilbake": return `Ring tilbake${naar}${n}`;
      case "booket": return `Booket møte${moeteDato ? ` ${format(new Date(`${moeteDato}T12:00`), "d. MMM", { locale: nb })}${moeteTid ? ` ${moeteTid}` : ""}` : ""}${n}`;
      case "ikke_naa": return `Ikke nå${n}`;
      case "ikke_interessert": return `Ikke interessert${n}`;
      case "melding": return `Sendte ${kanal === "SMS" ? "SMS" : "e-post"}${n}`;
      default: return `Notat${n}`;
    }
  }, [valg, navn, dato, tid, moeteDato, moeteTid, kanal]);

  const nullstill = () => { setValg(null); setNotat(""); setDato(""); setTid(""); setTittel(""); setTittelRedigert(false); };

  const lagre = async () => {
    if (!valg) return;
    if (valg === "ikke_interessert" && !bekreft) { setBekreft(true); return; }
    setBekreft(false);
    setLagrer(true);
    const v = valg;
    const nyDato = v === "ikke_interessert" ? "" : dato;
    try {
      const res = await loggAktivitet({
        logg: v === "svarte_ikke" ? "ikke_svar" : v === "notat" ? "notat" : v === "melding" ? "epost" : "ringte",
        dbType: v === "melding" ? kanal : undefined,
        target, tittel: aktivitetTittel, notat: notat.trim() || undefined, ansvarlig,
        nesteOppfolging: nyDato || undefined,
        fjernOppfolging: !nyDato && v !== "notat",
        beholdOppfolging: !nyDato && v === "notat",
        markerIkkeAktuelt: v === "ikke_interessert",
      });

      // Lukk gjeldende oppfølging
      if (lukkerOppgave(v)) {
        const dag = lokalDato(new Date());
        updateOppgaver(prev => prev.map(o => {
          const gjelder = o.id === oppgaveId || (
            ((target.lead_id && o.lead_id === target.lead_id) || (target.salgsmulighet_id && o.salgsmulighet_id === target.salgsmulighet_id) || (target.kontakt_id && o.kontakt_id === target.kontakt_id))
            && erGjeldendeOppfolging(o, dag));
          return gjelder && o.status !== "Ferdig" ? { ...o, status: "Ferdig" } : o;
        }));
      }

      // Ny oppgave fra «Neste oppfølging»
      if (nyDato) {
        updateOppgaver(prev => [...prev, {
          id: crypto.randomUUID(), oppgave: tittel.trim() || oppfolgingTittel(v, navn),
          lead_id: target.lead_id || "", selskap_id: target.selskap_id || "", salgsmulighet_id: target.salgsmulighet_id || "", kontakt_id: target.kontakt_id || "",
          ansvarlig, frist: nyDato, frist_tid: tid, prioritet: "Medium", status: "Åpen", paaminnelse: true, notater: "",
        }]);
      }

      if (lead) {
        const id = lead.id;
        updateLeads(prev => prev.map(l => l.id === id ? {
          ...l, status: leadStatusEtterValg(l.status, v) as typeof l.status, sist_aktivitet: lokalDato(new Date()),
          neste_oppfolging: v === "notat" && !nyDato ? l.neste_oppfolging : nyDato,
        } : l));
      }
      if (v === "ikke_interessert" && sm && sm.status !== "Vunnet" && sm.status !== "Tapt") {
        const id = sm.id;
        updateSalgsmuligheter(prev => prev.map(s => s.id === id ? { ...s, status: "Tapt", tapt_dato: lokalDato(new Date()), tapsaarsak: s.tapsaarsak || "Ikke behov" } : s));
      }

      if (v === "booket" && lead && !sm && lead.status !== "Konvertert til salg") {
        if (onBooketMoete) onBooketMoete(lead);
        else {
          const smId = konverterLead(lead.id, lead.use_case || lead.firmanavn || lead.kontaktperson);
          if (smId) {
            toast.success(`${lead.firmanavn || lead.kontaktperson} er nå salgsmulighet (Møte booket)`, { action: { label: "Åpne", onClick: () => navigate(`?kunde=sm:${smId}`) } });
            void (async () => {
              for (let i = 0; i < 20; i++) {
                const { data } = await supabase.from("salgsmuligheter").select("id").eq("id", smId).maybeSingle();
                if (data) break;
                await new Promise(r => setTimeout(r, 500));
              }
              updateOppgaver(prev => prev.map(o => o.lead_id === lead.id && o.status !== "Ferdig" ? { ...o, salgsmulighet_id: smId } : o));
            })();
          }
        }
      } else {
        toast.success(v === "ikke_interessert" ? "Logget – tatt ut av oppfølging" : nyDato ? `Logget · ny oppfølging ${format(new Date(`${nyDato}T12:00`), "d. MMM", { locale: nb })}${tid ? ` ${tid}` : ""}` : "Logget");
      }

      onLogged?.(res);
      nullstill();
    } catch (err) {
      console.error(err);
      toast.error("Kunne ikke lagre loggen");
    } finally { setLagrer(false); }
  };

  const visOppfolging = valg && valg !== "ikke_interessert";

  return (
    <section aria-labelledby="hva-skjedde" className={cn("space-y-3", className)}>
      <h3 id="hva-skjedde" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hva skjedde?</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {LOGG_VALG.map(o => {
          const Icon = IKON[o.id];
          const aktiv = valg === o.id;
          return (
            <button key={o.id} type="button" aria-pressed={aktiv} onClick={() => velg(o.id)}
              className={cn("flex min-h-[64px] flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                aktiv ? "border-primary bg-primary text-primary-foreground" : o.id === "ikke_interessert" ? "bg-card hover:bg-destructive/5" : "bg-card hover:bg-muted/60")}>
              <span className="flex items-center gap-1.5 text-sm font-semibold">{o.id !== "snakket" && <Icon className="h-4 w-4" />}{o.label}</span>
              <span className={cn("text-xs", aktiv ? "text-primary-foreground/80" : "text-muted-foreground")}>{o.hint}</span>
            </button>
          );
        })}
      </div>

      {valg && (
        <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
          {valg === "ring_tilbake" && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Når skal du ringe tilbake?">
              {RING_TILBAKE_VALG.map(r => (
                <Button key={r.id} type="button" size="sm" variant={ringValg === r.id ? "default" : "outline"} className="h-8" onClick={() => velgRing(r.id)}>{r.label}</Button>
              ))}
            </div>
          )}
          {valg === "booket" && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Når er møtet?</p>
              <div className="flex flex-wrap items-center gap-2">
                <Input type="date" aria-label="Møtedato" value={moeteDato} onChange={e => settMoete(e.target.value, moeteTid)} className="h-9 w-auto" />
                <Input type="time" aria-label="Møtetid" step={900} value={moeteTid} onChange={e => settMoete(moeteDato, e.target.value)} className="h-9 w-auto tabular-nums" />
              </div>
              {lead && !sm && <p className="text-xs text-muted-foreground">Leadet blir salgsmulighet («Møte booket») når du lagrer.</p>}
            </div>
          )}
          {valg === "melding" && (
            <div className="flex gap-1.5" role="group" aria-label="Kanal">
              {(["SMS", "E-post"] as const).map(k => <Button key={k} type="button" size="sm" variant={kanal === k ? "default" : "outline"} className="h-8" onClick={() => setKanal(k)}>{k}</Button>)}
            </div>
          )}

          <label className="grid gap-1 text-xs font-medium text-muted-foreground">Notat (valgfritt)
            <Textarea rows={2} value={notat} onChange={e => setNotat(e.target.value)} placeholder="Hva ble sagt?" className="text-sm font-normal text-foreground" />
          </label>

          {visOppfolging && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Neste oppfølging <span className="font-normal">(tom = ingen ny oppgave)</span></p>
              <div className="flex flex-wrap items-center gap-2">
                <Input type="date" aria-label="Dato for neste oppfølging" value={dato} onChange={e => setDato(e.target.value)} className="h-9 w-auto" />
                {dato && <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => { setDato(""); setTid(""); }}>Ingen</Button>}
              </div>
              {dato && (
                <>
                  <OppgaveTid value={tid} onChange={setTid} />
                  <Input aria-label="Tittel på oppfølgingsoppgaven" value={tittel} onChange={e => { setTittel(e.target.value); setTittelRedigert(true); }} className="h-8 text-sm" />
                </>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={lagre} disabled={lagrer} variant={valg === "ikke_interessert" ? "destructive" : "default"}>{lagrer ? "Lagrer…" : "Lagre"}</Button>
            <Button variant="ghost" onClick={nullstill}>Avbryt</Button>
          </div>
        </div>
      )}

      <AlertDialog open={bekreft} onOpenChange={setBekreft}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ikke interessert?</AlertDialogTitle>
            <AlertDialogDescription>
              {navn || "Kunden"} tas ut av oppfølging{sm && sm.status !== "Vunnet" && sm.status !== "Tapt" ? ` og salgsmuligheten «${sm.navn}» flyttes til Tapt` : lead ? " og leadet settes til «Ikke aktuelt»" : ""}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={() => { void lagre(); }}>Ja, logg</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
