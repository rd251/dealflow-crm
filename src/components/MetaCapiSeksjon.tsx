import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { STEG, SIGNALER, SLUTTKONVERTERING } from "@/lib/meta-capi";
import { Loader2, Pause, Play, RefreshCw, Send } from "lucide-react";

interface CapiStatus {
  driftsstatus: "mangler_konfigurasjon" | "deaktivert" | "pauset" | "aktiv";
  konfig: { token: boolean; datasett: boolean; sider: boolean };
  kan_aktiveres: boolean;
  tilstand: {
    produksjon_aktiv: boolean; pauset: boolean; aktivert_at: string | null;
    test_ok_at: string | null; test_sist_at: string | null; test_sist_resultat: string | null;
    last_run_at: string | null; last_sent_at: string | null;
    last_error: string | null; last_error_at: string | null;
  } | null;
  counts: Record<string, number>;
}

const DRIFT: Record<CapiStatus["driftsstatus"], string> = {
  mangler_konfigurasjon: "Mangler oppsett",
  deaktivert: "Avslått",
  pauset: "Pauset",
  aktiv: "Sender",
};

const KONFIG: Record<keyof CapiStatus["konfig"], string> = {
  token: "Tilgangstoken (META_CAPI_ACCESS_TOKEN)",
  datasett: "Datasett-ID (META_CAPI_DATASET_ID)",
  sider: "Godkjent side-ID",
};

const tid = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("nb-NO") : "—");

/** CRM-status → navnet Meta får, én rad per steg (eldre statuser som deler steg slås sammen). */
function unike(steg: Record<string, { key: string; navn: string }>) {
  const liste = Object.entries(steg).map(([status, s]) => ({ status, ...s }));
  return liste.filter((s, i) => liste.findIndex((x) => x.key === s.key) === i);
}

const ER_SIGNAL = new Set<string>(Object.values(SIGNALER));

export default function MetaCapiSeksjon() {
  const [status, setStatus] = useState<CapiStatus | null>(null);
  const [laster, setLaster] = useState(true);
  const [jobber, setJobber] = useState<string | null>(null);
  const [testkode, setTestkode] = useState("");
  const [bekreft, setBekreft] = useState(false);

  const kall = useCallback(async (action: string, ekstra: Record<string, unknown> = {}) => {
    setJobber(action);
    const { data, error } = await supabase.functions.invoke("meta-capi-worker", { body: { action, ...ekstra } });
    setJobber(null);
    setLaster(false);
    if (error) {
      let melding = "Kunne ikke hente status for CRM-tilbakemelding";
      try { const b = await (error as any).context?.json?.(); if (b?.error) melding = b.error; } catch { /* behold */ }
      toast.error(melding);
      return null;
    }
    const s = (data?.status ?? data) as CapiStatus;
    if (s?.driftsstatus) setStatus(s);
    return data;
  }, []);

  useEffect(() => { kall("status"); }, [kall]);

  const sendTest = async () => {
    const data = await kall("test", { test_event_code: testkode.trim() });
    if (data?.ok) toast.success("Testhendelsen ble mottatt av Meta");
    else if (data) toast.error("Meta bekreftet ikke testhendelsen");
  };

  const leadSteg = unike(STEG.lead);
  const salgSteg = unike(STEG.salgsmulighet);
  const t = status?.tilstand;

  return (
    <section aria-labelledby="capi-tittel" className="space-y-3 rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h3 id="capi-tittel" className="text-sm font-semibold">CRM-tilbakemelding til Meta</h3>
          <p className="text-xs text-muted-foreground">
            Forteller Meta hvor langt hvert Meta-lead kommer i CRM-et, slik at annonsene kan lære hvilke leads som blir kunder.
            Bare Meta lead-ID-en sendes – aldri navn, e-post, telefon, notater eller beløp.
          </p>
        </div>
        {status && (
          <Badge variant={status.driftsstatus === "aktiv" ? "default" : "secondary"}>{DRIFT[status.driftsstatus]}</Badge>
        )}
      </div>

      {laster && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Laster...
        </div>
      )}

      {status && (
        <>
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <p className="mb-1 font-medium text-foreground">Oppsett</p>
              <ul className="space-y-0.5 text-muted-foreground">
                {(Object.keys(KONFIG) as Array<keyof CapiStatus["konfig"]>).map((k) => (
                  <li key={k}>{status.konfig[k] ? "✓" : "—"} {KONFIG[k]}</li>
                ))}
                <li>{t?.test_ok_at ? "✓" : "—"} Godkjent testhendelse{t?.test_ok_at ? ` (${tid(t.test_ok_at)})` : ""}</li>
              </ul>
            </div>
            <div className="rounded-lg border p-3">
              <p className="mb-1 font-medium text-foreground">Kø</p>
              <ul className="space-y-0.5 text-muted-foreground tabular-nums">
                <li>{status.counts.pending + status.counts.processing} venter · {status.counts.sent} sendt · {status.counts.failed} feilet</li>
                <li>{status.counts.skipped} ikke sendt (for gamle eller utenfor godkjent side)</li>
                <li>Sist sendt: {tid(t?.last_sent_at)}</li>
                <li>Sist kjørt: {tid(t?.last_run_at)}</li>
                {t?.last_error && <li className="text-destructive">Siste feil ({tid(t.last_error_at)}): {t.last_error}</li>}
              </ul>
            </div>
          </div>

          {status.driftsstatus !== "aktiv" && (
            <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
              {status.driftsstatus === "mangler_konfigurasjon" && "Ingenting sendes før tilgangstoken og datasett-ID er lagt inn som serverhemmeligheter. "}
              {status.driftsstatus === "deaktivert" && "Sendingen er avslått. "}
              {status.driftsstatus === "pauset" && "Sendingen er pauset. "}
              Nye steg samles i køen imens og sendes når sendingen er på. Steg som blir eldre enn 7 dager før det, godtas ikke av Meta og blir stående som ikke sendt.
            </div>
          )}

          <details className="rounded-lg border p-3 text-xs">
            <summary className="cursor-pointer font-medium text-foreground">Hvilke steg rapporteres?</summary>
            <div className="mt-2 grid gap-3 text-muted-foreground sm:grid-cols-2">
              <div>
                <p className="mb-1 font-medium text-foreground">Lead</p>
                <ul className="space-y-0.5">
                  {leadSteg.map((s) => (
                    <li key={s.key}>{ER_SIGNAL.has(s.navn) ? <>{s.status} → <strong className="text-foreground">{s.navn}</strong></> : s.navn}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-1 font-medium text-foreground">Salgsmulighet</p>
                <ul className="space-y-0.5">
                  {salgSteg.map((s) => (
                    <li key={s.key}>
                      {ER_SIGNAL.has(s.navn) ? <>{s.status} → <strong className="text-foreground">{s.navn}</strong></> : s.navn}
                      {s.key === SLUTTKONVERTERING ? " – eneste sluttkonvertering" : ""}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <ul className="mt-3 list-disc space-y-0.5 pl-4 text-muted-foreground">
              <li>LEADS sendes når et nytt Meta-lead er importert, QUALIFIED bare når leadet settes til «Kvalifisert», og CONVERTED bare når salgsmuligheten er «Vunnet». Alle andre steg sendes med eget navn, første gang de faktisk nås og med tidspunktet for endringen.</li>
              <li>«Konvertert til salgsmulighet» betyr at det er opprettet en salgsmulighet – ikke at leadet er kvalifisert eller kunden vunnet. Negative steg og «Konvertert til partner» regnes aldri som positive.</li>
              <li>Salgsmuligheter rapporteres bare når de er koblet til leadet ved selve konverteringen (eldre salgsmuligheter: en entydig registrert aktivitet). Lik e-postadresse brukes aldri. Steg går til leadets opprinnelige Meta-skjema, ikke til senere duplikater.</li>
              <li>«Møte booket» sendes bare når et faktisk møte er koblet til salgsmuligheten, eller når noen velger steget selv – ikke fordi en ny salgsmulighet starter der.</li>
              <li>Ingenting sendes bakover i tid: eksisterende statuser og gamle kunder blir ikke meldt som nye.</li>
            </ul>
          </details>

          <div className="space-y-2 rounded-lg border p-3 text-xs">
            <Label htmlFor="capi-testkode" className="font-medium text-foreground">Testhendelse</Label>
            <p className="text-muted-foreground">
              Lim inn testkoden fra Meta Events Manager → Testhendelser. Testen går bare til Meta sin testvisning og holdes helt adskilt fra ekte hendelser.
            </p>
            <div className="flex flex-wrap gap-2">
              <Input id="capi-testkode" value={testkode} onChange={(e) => setTestkode(e.target.value)} placeholder="TEST12345" className="max-w-[12rem] font-mono text-xs" />
              <Button size="sm" variant="outline" className="gap-2" onClick={sendTest}
                disabled={!testkode.trim() || !status.konfig.token || !status.konfig.datasett || jobber !== null}>
                {jobber === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send testhendelse
              </Button>
            </div>
            {t?.test_sist_at && (
              <p className="text-muted-foreground">Siste test {tid(t.test_sist_at)}: {t.test_sist_resultat}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="gap-2" onClick={() => kall("status")} disabled={jobber !== null}>
              <RefreshCw className={`h-4 w-4 ${jobber === "status" ? "animate-spin" : ""}`} /> Oppdater
            </Button>
            <Button size="sm" variant="outline" className="gap-2" onClick={() => kall("retry")} disabled={jobber !== null || status.counts.failed === 0}>
              <RefreshCw className="h-4 w-4" /> Prøv feilede på nytt
            </Button>
            {t?.produksjon_aktiv && (
              <Button size="sm" variant="outline" className="gap-2" onClick={() => kall(t.pauset ? "fortsett" : "pause")} disabled={jobber !== null}>
                {t.pauset ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />} {t.pauset ? "Fortsett" : "Pause"}
              </Button>
            )}
            {t?.produksjon_aktiv ? (
              <Button size="sm" variant="outline" onClick={() => kall("deaktiver")} disabled={jobber !== null}>Slå av sending</Button>
            ) : (
              <Button size="sm" onClick={() => setBekreft(true)} disabled={!status.kan_aktiveres || jobber !== null}>Slå på sending</Button>
            )}
          </div>
        </>
      )}

      <AlertDialog open={bekreft} onOpenChange={setBekreft}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slå på CRM-tilbakemelding til Meta?</AlertDialogTitle>
            <AlertDialogDescription>
              Ekte CRM-steg for Meta-leads blir sendt til Meta fra nå av. Bare Meta lead-ID-en sendes. Du kan pause eller slå av når som helst.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={() => kall("aktiver", { bekreft: true })}>Slå på</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
