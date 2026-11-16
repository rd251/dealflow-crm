// Selskapsdata fra Brønnøysundregistrene. Ingen AI – leser brreg_*-feltene og kaller brreg-match.
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Lock, AlertTriangle, Building2, Check, CheckCircle2, Copy, Loader2, RefreshCw, Search, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useCrmStore } from "@/hooks/use-crm-store";
import { nok } from "@/lib/utils";
import { erProblem, type BrregData, type BrregKandidat, type BrregStatus } from "@/lib/brreg-match";

interface Props {
  leadId?: string;
  selskapId?: string;
  /** Lead: gjeldende firmanavn i skjemaet – endring kjører matching på nytt (1,5 s). */
  firmanavn?: string;
  kanEndre?: boolean;
}

interface Rad {
  orgnr: string | null;
  firmanavn: string | null;
  kontaktperson?: string | null;
  brreg_status: BrregStatus | null;
  brreg_kandidater: BrregKandidat[] | null;
  brreg_data: (Partial<BrregData> & { melding?: string | null; oppgitt_firmanavn?: string | null }) | null;
  brreg_hentet: string | null;
}

type SokTreff = Omit<BrregKandidat, "score" | "begrunnelse">;

export async function kallBrreg(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("brreg-match", { body });
  if (error) {
    let melding = "Kunne ikke kontakte Brønnøysundregistrene.";
    try { const j = await (error as any).context?.json?.(); if (j?.error) melding = j.error; } catch { /* behold */ }
    throw new Error(melding);
  }
  return data;
}

const dato = (s?: string | null) => (s ? new Date(s).toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric" }) : "");

export default function SelskapInnsikt({ leadId, selskapId, firmanavn, kanEndre = true }: Props) {
  const { refresh } = useCrmStore();
  const [rad, setRad] = useState<Rad | null>(null);
  const [laster, setLaster] = useState(false);
  const [jobber, setJobber] = useState(false);
  const [visSok, setVisSok] = useState(false);
  const [copied, setCopied] = useState(false);
  const forrigeNavn = useRef<string | undefined>(undefined);
  const tabell = leadId ? "leads" : "selskaper";
  const id = leadId || selskapId;

  const hentRad = useCallback(async () => {
    if (!id) return null;
    const kol = leadId
      ? "orgnr, firmanavn, kontaktperson, brreg_status, brreg_kandidater, brreg_data, brreg_hentet"
      : "orgnr, firmanavn, brreg_status, brreg_kandidater, brreg_data, brreg_hentet";
    const { data } = await supabase.from(tabell as "leads").select(kol).eq("id", id).maybeSingle();
    setRad((data as unknown as Rad) ?? null);
    return data as unknown as Rad | null;
  }, [id, leadId, tabell]);

  const kjor = useCallback(async (body: Record<string, unknown>, stille = false) => {
    setJobber(true);
    try {
      await kallBrreg(body);
      await hentRad();
      refresh(true);
    } catch (e) {
      if (!stille) toast({ title: "Brønnøysund", description: (e as Error).message, variant: "destructive" });
    } finally {
      setJobber(false);
    }
  }, [hentRad, refresh]);

  const idKey = leadId ? { lead_id: leadId } : { selskap_id: selskapId };

  // Last inn, og kjør matching automatisk hvis den aldri er kjørt
  useEffect(() => {
    let avbrutt = false;
    setLaster(true); setVisSok(false); forrigeNavn.current = undefined;
    hentRad().then((r) => {
      if (avbrutt) return;
      setLaster(false);
      if (leadId && r && !r.brreg_status && kanEndre) kjor({ lead_id: leadId }, true);
    });
    return () => { avbrutt = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Firmanavn endret manuelt → ny matching etter 1,5 s (ikke ved manuelt valgt selskap)
  useEffect(() => {
    if (!leadId || firmanavn === undefined) return;
    if (forrigeNavn.current === undefined) { forrigeNavn.current = firmanavn; return; }
    if (forrigeNavn.current === firmanavn) return;
    forrigeNavn.current = firmanavn;
    if (!kanEndre || rad?.brreg_status === "manuell") return;
    const t = setTimeout(() => kjor({ lead_id: leadId, firmanavn }, true), 1500);
    return () => clearTimeout(t);
  }, [firmanavn, leadId, kanEndre, rad?.brreg_status, kjor]);

  if (!id) return null;
  if (laster) {
    return (
      <div className="rounded-lg border bg-muted/30 p-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Henter fra Brønnøysund…
      </div>
    );
  }

  const status = rad?.brreg_status ?? null;
  const d = rad?.brreg_data ?? null;
  const oppgitt = leadId ? (d?.oppgitt_firmanavn ?? rad?.firmanavn) : null;
  const velg = (orgnr: string) => kjor({ ...idKey, velg: orgnr }).then(() => setVisSok(false));

  const kopier = (v: string) => {
    navigator.clipboard.writeText(v);
    setCopied(true);
    toast({ title: "Org.nr kopiert", description: v });
    setTimeout(() => setCopied(false), 2000);
  };

  const harData = (status === "sikker" || status === "manuell") && d?.orgnr;

  return (
    <section className="rounded-lg border bg-card p-3 space-y-3" aria-label="Selskap i Brønnøysund">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          <Building2 className="w-3 h-3" /> Brønnøysundregistrene
        </div>
        {jobber && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" aria-label="Jobber" />}
      </div>

      {oppgitt !== null && oppgitt !== undefined && (
        <p className="text-xs text-muted-foreground">Oppgitt i skjemaet: «{oppgitt || "—"}»</p>
      )}

      {harData && d && (
        <div className="space-y-2.5">
          {erProblem(d as BrregData) && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 text-destructive px-2.5 py-2 text-xs font-medium">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {d.status ?? "Avvikling"} registrert i Brønnøysund{d.slettedato ? ` (slettet ${dato(d.slettedato)})` : ""}
            </div>
          )}
          <div>
            <div className="text-sm font-semibold">{d.navn}</div>
            <button type="button" onClick={() => kopier(d.orgnr!)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground tabular-nums" title="Kopier org.nr">
              Org.nr {d.orgnr} {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
          {d.kontakt_rolle && rad?.kontaktperson && (
            <div className="flex items-center gap-1.5 text-xs text-success">
              <CheckCircle2 className="w-3.5 h-3.5" /> {rad.kontaktperson} står som {d.kontakt_rolle.rolle.toLowerCase()} i registeret
            </div>
          )}
          <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs">
            <Felt t="Organisasjonsform" v={d.organisasjonsform?.beskrivelse} />
            <Felt t="Bransje" v={d.naeringskode1 ? `${d.naeringskode1.beskrivelse} (${d.naeringskode1.kode})` : null} />
            <Felt t="Ansatte" v={d.antallAnsatte != null ? String(d.antallAnsatte) : null} />
            <Felt t="Adresse" v={d.forretningsadresse} />
            {d.postadresse && d.postadresse !== d.forretningsadresse && <Felt t="Postadresse" v={d.postadresse} />}
            <Felt t="Kommune" v={d.kommune} />
            <Felt t="Nettside" v={d.hjemmeside} />
            <Felt t="Telefon" v={[d.telefon, d.mobil].filter(Boolean).join(" · ")} />
            <Felt t="E-post" v={d.epostadresse} />
            <Felt t="Daglig leder" v={d.daglig_leder} />
            <Felt t="Styreleder" v={d.styreleder} />
            <Felt t="Stiftet" v={dato(d.stiftelsesdato)} />
          </dl>
          {d.regnskap ? (
            <div className="rounded-md bg-muted/40 px-2.5 py-2 text-xs space-y-0.5">
              <div className="font-medium">Regnskap {d.regnskap.aar}</div>
              <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 tabular-nums">
                <Felt t="Driftsinntekter" v={d.regnskap.driftsinntekter != null ? nok(d.regnskap.driftsinntekter) : null} />
                <Felt t="Driftsresultat" v={d.regnskap.driftsresultat != null ? nok(d.regnskap.driftsresultat) : null} />
                <Felt t="Årsresultat" v={d.regnskap.aarsresultat != null ? nok(d.regnskap.aarsresultat) : null} />
                <Felt t="Egenkapital" v={d.regnskap.egenkapital != null ? nok(d.regnskap.egenkapital) : null} />
              </dl>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Ingen regnskap levert.</p>
          )}
          <p className="text-[11px] text-muted-foreground">Kilde: Brønnøysundregistrene · hentet {dato(rad?.brreg_hentet)}</p>
          {kanEndre && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={jobber} onClick={() => kjor({ ...idKey, velg: d.orgnr })}>
                <RefreshCw className="w-3 h-3 mr-1" /> {selskapId ? "Oppdater fra Brønnøysund" : "Oppdater"}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setVisSok((v) => !v)}>
                <ArrowLeftRight className="w-3 h-3 mr-1" /> Bytt selskap
              </Button>
            </div>
          )}
        </div>
      )}

      {status === "usikker" && !harData && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Velg riktig selskap</div>
          <ul className="space-y-1.5">
            {(rad?.brreg_kandidater ?? []).map((k) => (
              <li key={k.orgnr} className="rounded-md border px-2.5 py-2 text-xs flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-0.5">
                  <div className="font-medium">{k.navn} <span className="text-muted-foreground tabular-nums font-normal">· {k.orgnr}</span></div>
                  <div className="text-muted-foreground">
                    {[k.organisasjonsform, k.kommune, k.bransje, k.ansatte != null ? `${k.ansatte} ansatte` : null].filter(Boolean).join(" · ")}
                  </div>
                  {k.status && <div className="text-destructive font-medium">{k.status}</div>}
                  <div className="text-muted-foreground tabular-nums">{k.score} poeng · {k.begrunnelse.join(" · ")}</div>
                </div>
                {kanEndre && <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" disabled={jobber} onClick={() => velg(k.orgnr)}>Velg</Button>}
              </li>
            ))}
          </ul>
          {kanEndre && !visSok && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setVisSok(true)}>Ingen av disse – søk selv</Button>
          )}
        </div>
      )}

      {(status === "ingen" || (status === null && selskapId)) && !harData && (
        <div className="space-y-1">
          <div className="text-sm font-medium">{status === "ingen" ? "Fant ikke firmaet i Brønnøysund" : "Ikke koblet til Brønnøysund ennå"}</div>
          {d?.melding && <p className="text-xs text-muted-foreground">{d.melding}</p>}
        </div>
      )}

      {status === null && leadId && !jobber && (
        <p className="text-xs text-muted-foreground">Ikke sjekket ennå.{kanEndre && <> <button className="underline" onClick={() => kjor({ lead_id: leadId })}>Sjekk nå</button></>}</p>
      )}

      {kanEndre && (visSok || ((status === "ingen" || (status === null && selskapId)) && !harData)) && (
        <BrregSok onVelg={velg} opptatt={jobber} />
      )}
    </section>
  );
}

function Felt({ t, v }: { t: string; v?: string | null }) {
  if (!v) return null;
  return (<><dt className="text-muted-foreground">{t}</dt><dd className="min-w-0 break-words">{v}</dd></>);
}

export function BrregSok({ onVelg, opptatt }: { onVelg: (orgnr: string) => void; opptatt?: boolean }) {
  const [q, setQ] = useState("");
  const [treff, setTreff] = useState<SokTreff[]>([]);
  const [soker, setSoker] = useState(false);
  useEffect(() => {
    const s = q.trim();
    if (s.length < 3) { setTreff([]); return; }
    const t = setTimeout(async () => {
      setSoker(true);
      try { const r = await kallBrreg({ sok: s }); setTreff(r?.treff ?? []); }
      catch { setTreff([]); }
      finally { setSoker(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk på firmanavn eller org.nr" className="h-8 text-xs pl-7" aria-label="Søk i Brønnøysundregistrene" />
        {soker && <Loader2 className="w-3.5 h-3.5 animate-spin absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />}
      </div>
      {treff.length > 0 && (
        <ul className="max-h-60 overflow-y-auto rounded-md border divide-y">
          {treff.map((k) => (
            <li key={k.orgnr}>
              <button type="button" disabled={opptatt} onClick={() => onVelg(k.orgnr)} className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-muted/50 disabled:opacity-50">
                <div className="font-medium">{k.navn} <span className="text-muted-foreground tabular-nums font-normal">· {k.orgnr}</span></div>
                <div className="text-muted-foreground">{[k.organisasjonsform, k.kommune, k.bransje].filter(Boolean).join(" · ")}{k.status ? ` · ${k.status}` : ""}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 3 && !soker && treff.length === 0 && <p className="text-xs text-muted-foreground">Ingen treff.</p>}
    </div>
  );
}

/** Liten merkelapp: lead → «✓ Navn · org.nr» / «Velg selskap» / «Firma ikke funnet»; selskap → «✓ Bekreftet i Brønnøysund». */
export function BrregMerke({ brreg, variant = "lead" }: { brreg?: { status: string | null; data: Record<string, any> | null } | null; variant?: "lead" | "selskap" }) {
  if (!brreg?.status) return null;
  const d = brreg.data;
  const ok = (brreg.status === "sikker" || brreg.status === "manuell") && d?.orgnr;
  if (ok && erProblem(d as BrregData)) {
    return <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-[11px] font-medium"><AlertTriangle className="w-3 h-3" />{d!.status}</span>;
  }
  if (ok) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 text-success px-2 py-0.5 text-[11px] font-medium tabular-nums">
        <Check className="w-3 h-3" />{variant === "lead" ? `${d!.navn} · ${d!.orgnr}` : "Bekreftet i Brønnøysund"}
      </span>
    );
  }
  if (variant === "selskap") return null;
  return (
    <span className="inline-flex items-center rounded-full bg-warning/15 text-warning px-2 py-0.5 text-[11px] font-medium">
      {brreg.status === "usikker" ? "Velg selskap" : "Firma ikke funnet"}
    </span>
  );
}

/** Selskapet er koblet til Brønnøysund → org.nr, adresser og bransje er skrivebeskyttet. */
export function erBrregLaast(s?: { brreg?: { status: string | null; data: Record<string, any> | null } | null } | null): boolean {
  return !!s?.brreg?.data?.orgnr && (s.brreg.status === "sikker" || s.brreg.status === "manuell");
}

export function LaastInput({ laast, readOnly, className = "", ...rest }: React.ComponentProps<typeof Input> & { laast: boolean }) {
  return (
    <div className="relative">
      <Input {...rest} readOnly={readOnly || laast} className={`${className} ${laast ? "pr-7 bg-muted/40" : ""}`} title={laast ? "Hentet fra Brønnøysundregistrene" : rest.title} />
      {laast && <Lock className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label="Låst – hentet fra Brønnøysund" />}
    </div>
  );
}
