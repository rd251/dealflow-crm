import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { Mail, MessageSquare, Pencil, Phone, Plus } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { loggAktivitet } from "@/lib/activity-logging";
import { datoOm, idag } from "@/lib/sales-flow";
import {
  EPOST_MALER, SAMTALE_UTFALL, SMS_MALER, forslagDager, fyllMal, leadStatusEtterUtfall, mailtoLenke, smsLenke,
  type MeldingMal, type SamtaleUtfall,
} from "@/lib/kundekort";
import { cn } from "@/lib/utils";
import type { FolgOppRad } from "@/lib/i-dag";

interface Hist { id: string; type: string; tittel: string | null; beskrivelse: string; dato: string }
type Kanal = "SMS" | "E-post";

export default function KundeKort({ rad, onClose }: { rad: FolgOppRad | null; onClose: () => void }) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { user, canEdit } = useAuth();
  const { leads, oppgaver, kontakter, salgsmuligheter, selskaper, updateLeads, updateKontakter, updateSalgsmuligheter, updateOppgaver, konverterLead } = useCrmStore();

  // ---------- Kontekst ----------
  const ctx = useMemo(() => {
    if (!rad) return null;
    const oppgave = rad.type === "oppgave" ? oppgaver.find(o => o.id === rad.id) : undefined;
    const lead = leads.find(l => l.id === (rad.type === "lead" ? rad.id : oppgave?.lead_id));
    const sm = salgsmuligheter.find(s => s.id === oppgave?.salgsmulighet_id);
    const kontakt = kontakter.find(k => k.id === (oppgave?.kontakt_id || sm?.kontakt_id));
    const selskap = selskaper.find(s => s.id === (oppgave?.selskap_id || sm?.selskap_id || kontakt?.selskap_id));
    return { oppgave, lead, sm, kontakt, selskap };
  }, [rad, oppgaver, leads, salgsmuligheter, kontakter, selskaper]);

  const info = useMemo(() => {
    const c = ctx;
    if (!c) return { navn: "", firma: "", rolle: "", telefon: "", epost: "" };
    return {
      navn: c.kontakt?.navn || c.lead?.kontaktperson || c.sm?.kontaktperson || "",
      firma: c.selskap?.firmanavn || c.lead?.firmanavn || c.sm?.navn || "",
      rolle: c.kontakt?.rolle || c.lead?.rolle_i_firma || c.sm?.rolle_i_firma || "",
      telefon: c.kontakt?.telefon || c.lead?.telefon || c.sm?.telefon || "",
      epost: c.kontakt?.e_post || c.lead?.e_post || c.sm?.e_post || "",
    };
  }, [ctx]);
  const fornavn = info.navn.split(/\s+/)[0];
  const target = useMemo(() => ({
    lead_id: ctx?.lead?.id || null, salgsmulighet_id: ctx?.sm?.id || null,
    kontakt_id: ctx?.kontakt?.id || null, selskap_id: ctx?.selskap?.id || null,
  }), [ctx]);
  const ansvarlig = ctx?.oppgave?.ansvarlig || ctx?.lead?.ansvarlig || ctx?.sm?.ansvarlig || user?.id || "";

  // ---------- Tilstand ----------
  const [redigerer, setRedigerer] = useState(false);
  const [form, setForm] = useState(info);
  const [utfall, setUtfall] = useState<SamtaleUtfall | null>(null);
  const [notat, setNotat] = useState("");
  const [lagrer, setLagrer] = useState(false);
  const [bekreftTapt, setBekreftTapt] = useState(false);
  const [nesteForslag, setNesteForslag] = useState<{ dager: number | null } | null>(null);
  const [egenDato, setEgenDato] = useState("");
  const [malKanal, setMalKanal] = useState<Kanal | null>(null);
  const [ventende, setVentende] = useState<{ kanal: Kanal; mal: MeldingMal } | null>(null);
  const [bekreftMelding, setBekreftMelding] = useState<{ kanal: Kanal; mal?: MeldingMal } | null>(null);
  const [meldingNotat, setMeldingNotat] = useState("");
  const [hist, setHist] = useState<Hist[]>([]);

  useEffect(() => {
    setForm(info); setRedigerer(false); setBekreftTapt(false);
    setUtfall(null); setNotat(""); setNesteForslag(null); setMalKanal(null); setVentende(null); setBekreftMelding(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rad?.key]);

  const hentHistorikk = useCallback(async () => {
    const deler = Object.entries(target).filter(([k, v]) => v && k !== "selskap_id").map(([k, v]) => `${k}.eq.${v}`);
    if (!deler.length) { setHist([]); return; }
    const { data } = await supabase.from("aktiviteter").select("id, type, tittel, beskrivelse, dato").or(deler.join(",")).order("dato", { ascending: false }).limit(15);
    setHist((data as Hist[]) || []);
  }, [target]);
  useEffect(() => { if (rad) void hentHistorikk(); }, [rad, hentHistorikk]);

  // Når brukeren kommer tilbake fra SMS-/e-postappen: spør om meldingen ble sendt.
  useEffect(() => {
    if (!ventende) return;
    let borte = false;
    const onVis = () => {
      if (document.visibilityState === "hidden") { borte = true; return; }
      if (borte) { setBekreftMelding(ventende); setVentende(null); }
    };
    const onFocus = () => { if (borte) { setBekreftMelding(ventende); setVentende(null); } };
    const onBlur = () => { borte = true; };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", onFocus); window.removeEventListener("blur", onBlur); };
  }, [ventende]);

  if (!rad || !ctx) return null;

  // ---------- Kontaktinfo ----------
  const lagreKontakt = () => {
    const f = { navn: form.navn.trim(), firma: form.firma.trim(), rolle: form.rolle.trim(), telefon: form.telefon.trim(), epost: form.epost.trim() };
    if (ctx.kontakt) {
      const id = ctx.kontakt.id;
      updateKontakter(prev => prev.map(k => k.id === id ? { ...k, navn: f.navn || k.navn, rolle: f.rolle, telefon: f.telefon, e_post: f.epost } : k));
    }
    if (ctx.lead) {
      const id = ctx.lead.id;
      updateLeads(prev => prev.map(l => l.id === id ? { ...l, kontaktperson: f.navn, firmanavn: f.firma || l.firmanavn, rolle_i_firma: f.rolle, telefon: f.telefon, e_post: f.epost } : l));
    } else if (ctx.sm && !ctx.kontakt) {
      const id = ctx.sm.id;
      updateSalgsmuligheter(prev => prev.map(s => s.id === id ? { ...s, kontaktperson: f.navn, rolle_i_firma: f.rolle, telefon: f.telefon, e_post: f.epost } : s));
    }
    if (!ctx.kontakt && !ctx.lead && !ctx.sm) { toast.error("Oppgaven er ikke koblet til en kontakt"); return; }
    setRedigerer(false);
    toast.success("Kontaktinfo lagret");
  };

  // ---------- Logg samtale ----------
  const fullforGjeldende = () => {
    if (ctx.oppgave && ctx.oppgave.status !== "Ferdig") {
      const id = ctx.oppgave.id;
      updateOppgaver(prev => prev.map(o => o.id === id ? { ...o, status: "Ferdig" } : o));
    }
  };

  const loggSamtale = async () => {
    if (!utfall) return;
    if (utfall === "ikke_interessert" && !bekreftTapt) { setBekreftTapt(true); return; }
    setBekreftTapt(false);
    setLagrer(true);
    const label = SAMTALE_UTFALL.find(u => u.id === utfall)!.label;
    const dager = forslagDager(utfall);
    try {
      await loggAktivitet({
        logg: utfall === "ikke_svar" || utfall === "beskjed" ? "ikke_svar" : "ringte",
        target, tittel: `Ringte – ${label.toLowerCase()} – ${info.navn || info.firma}`,
        notat: notat.trim() || label, ansvarlig,
        utfall: utfall === "ikke_svar" || utfall === "beskjed" ? "svarte_ikke" : "snakket",
        nesteOppfolging: dager ? datoOm(dager) : undefined,
        markerIkkeAktuelt: utfall === "ikke_interessert",
      });
      fullforGjeldende();
      if (ctx.lead) {
        const id = ctx.lead.id;
        updateLeads(prev => prev.map(l => l.id === id ? {
          ...l, status: leadStatusEtterUtfall(l.status, utfall) as typeof l.status, sist_aktivitet: idag(),
          neste_oppfolging: utfall === "ikke_interessert" ? "" : dager ? datoOm(dager) : l.neste_oppfolging,
        } : l));
      }
      if (utfall === "ikke_interessert" && ctx.sm && ctx.sm.status !== "Vunnet" && ctx.sm.status !== "Tapt") {
        const id = ctx.sm.id;
        updateSalgsmuligheter(prev => prev.map(s => s.id === id ? { ...s, status: "Tapt", tapt_dato: idag(), tapsaarsak: s.tapsaarsak || "Ikke behov" } : s));
      }
      if (utfall === "booket" && ctx.lead && !ctx.sm) {
        const lead = ctx.lead;
        const smId = konverterLead(lead.id, lead.use_case || lead.firmanavn || lead.kontaktperson);
        if (smId) {
          toast.success(`${lead.firmanavn || lead.kontaktperson} er nå salgsmulighet (Møte booket)`, { action: { label: "Åpne", onClick: () => navigate(`/salgsmuligheter?open=${smId}`) } });
          void (async () => {
            for (let i = 0; i < 20; i++) {
              const { data } = await supabase.from("salgsmuligheter").select("id").eq("id", smId).maybeSingle();
              if (data) break;
              await new Promise(r => setTimeout(r, 500));
            }
            updateOppgaver(prev => [...prev, {
              id: crypto.randomUUID(), oppgave: "Gjennomfør demo", lead_id: "", selskap_id: "", salgsmulighet_id: smId, kontakt_id: "",
              ansvarlig: lead.ansvarlig || user?.id || "", frist: datoOm(7), frist_tid: "", prioritet: "Høy", status: "Åpen", paaminnelse: true, notater: "",
            }]);
          })();
        }
      } else {
        toast.success(utfall === "ikke_interessert" ? "Logget – tatt ut av oppfølging" : "Samtalen er logget");
      }
      setNesteForslag(dager !== null || utfall === "fikk_svar" ? { dager } : null);
      setEgenDato("");
      setUtfall(null); setNotat("");
      void hentHistorikk();
    } catch (err) {
      console.error(err); toast.error("Kunne ikke logge samtalen");
    } finally { setLagrer(false); }
  };

  const lagNesteOppgave = (frist: string) => {
    if (!frist) return;
    const navn = info.navn || info.firma;
    updateOppgaver(prev => [...prev, {
      id: crypto.randomUUID(), oppgave: `Ring ${navn} igjen`, lead_id: ctx.lead?.id || "", selskap_id: ctx.selskap?.id || "",
      salgsmulighet_id: ctx.sm?.id || "", kontakt_id: ctx.kontakt?.id || "",
      ansvarlig, frist, frist_tid: "", prioritet: "Medium", status: "Åpen", paaminnelse: true, notater: "",
    }]);
    if (ctx.lead) { const id = ctx.lead.id; updateLeads(prev => prev.map(l => l.id === id ? { ...l, neste_oppfolging: frist } : l)); }
    setNesteForslag(null);
    toast.success(`Ny oppfølging ${format(new Date(frist), "d. MMM", { locale: nb })}`);
  };

  // ---------- Meldinger ----------
  const aapneMal = (kanal: Kanal, mal: MeldingMal) => {
    const tekst = fyllMal(mal.tekst, { fornavn, firma: info.firma });
    const url = kanal === "SMS" ? smsLenke(info.telefon, tekst) : mailtoLenke(info.epost, fyllMal(mal.emne || "", { fornavn, firma: info.firma }), tekst);
    setVentende({ kanal, mal }); setMalKanal(null);
    window.location.href = url;
  };

  const loggMelding = async (kanal: Kanal, mal?: MeldingMal) => {
    const { data: s } = await supabase.auth.getSession();
    const tittel = `Sendte ${kanal === "SMS" ? "SMS" : "e-post"}${mal ? ` – ${mal.navn}` : ""} – ${info.navn || info.firma}`;
    const { error } = await supabase.from("aktiviteter").insert({
      type: kanal, tittel, beskrivelse: meldingNotat.trim() || (mal ? fyllMal(mal.tekst, { fornavn, firma: info.firma }) : tittel),
      dato: new Date().toISOString(), user_id: s.session?.user.id ?? null, aktivitet_kilde: "manuell",
      lead_id: target.lead_id, salgsmulighet_id: target.salgsmulighet_id, kontakt_id: target.kontakt_id, selskap_id: target.selskap_id,
    } as never);
    if (error) { toast.error("Kunne ikke logge meldingen"); return; }
    setBekreftMelding(null); setMeldingNotat("");
    toast.success("Meldingen er logget");
    void hentHistorikk();
  };

  const tel = info.telefon.replace(/\s/g, "");
  const dagerValg = [{ l: "I morgen", d: 1 }, { l: "3 dager", d: 3 }, { l: "1 uke", d: 7 }];

  return (
    <>
      <Sheet open={!!rad} onOpenChange={o => !o && onClose()}>
        <SheetContent side={isMobile ? "bottom" : "right"} className={cn("overflow-y-auto", isMobile ? "max-h-[90vh] rounded-t-xl" : "w-full sm:max-w-md")}>
          <SheetHeader className="text-left">
            <SheetTitle className="font-display">{info.navn || info.firma || rad.navn}</SheetTitle>
            <SheetDescription>{[info.firma, info.rolle].filter(Boolean).join(" · ") || rad.hva}</SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-6">
            {/* 1. Kontaktinfo */}
            <section aria-labelledby="kk-kontakt" className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 id="kk-kontakt" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Kontaktinfo</h3>
                {canEdit && !redigerer && <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => { setForm(info); setRedigerer(true); }}><Pencil className="h-3.5 w-3.5" />Rediger</Button>}
              </div>
              {redigerer ? (
                <div className="grid gap-2">
                  {([["navn", "Navn"], ["firma", "Firma"], ["rolle", "Rolle"], ["telefon", "Telefon"], ["epost", "E-post"]] as const).map(([k, l]) => (
                    <label key={k} className="grid gap-1 text-xs text-muted-foreground">{l}
                      <Input value={form[k]} type={k === "telefon" ? "tel" : k === "epost" ? "email" : "text"} disabled={k === "firma" && !ctx.lead}
                        onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} autoFocus={k === "telefon" && !info.telefon} />
                    </label>
                  ))}
                  <div className="flex gap-2 pt-1"><Button size="sm" onClick={lagreKontakt}>Lagre</Button><Button size="sm" variant="ghost" onClick={() => setRedigerer(false)}>Avbryt</Button></div>
                </div>
              ) : (
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  <dt className="text-muted-foreground">Telefon</dt>
                  <dd>{info.telefon ? <a className="tabular-nums underline-offset-2 hover:underline" href={`tel:${tel}`}>{info.telefon}</a> : <span className="text-muted-foreground">Mangler</span>}</dd>
                  <dt className="text-muted-foreground">E-post</dt>
                  <dd className="min-w-0 truncate">{info.epost ? <a className="underline-offset-2 hover:underline" href={`mailto:${info.epost}`}>{info.epost}</a> : <span className="text-muted-foreground">Mangler</span>}</dd>
                </dl>
              )}
              {!redigerer && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {info.telefon
                    ? <Button asChild size="sm" className="gap-1"><a href={`tel:${tel}`}><Phone className="h-3.5 w-3.5" />Ring</a></Button>
                    : canEdit && <Button size="sm" variant="outline" className="gap-1" onClick={() => { setForm(info); setRedigerer(true); }}><Plus className="h-3.5 w-3.5" />Legg til nummer</Button>}
                  {info.telefon && <Button size="sm" variant="outline" className="gap-1" onClick={() => setMalKanal(malKanal === "SMS" ? null : "SMS")}><MessageSquare className="h-3.5 w-3.5" />Send SMS</Button>}
                  {info.epost && <Button size="sm" variant="outline" className="gap-1" onClick={() => setMalKanal(malKanal === "E-post" ? null : "E-post")}><Mail className="h-3.5 w-3.5" />Send e-post</Button>}
                  {canEdit && <Button size="sm" variant="ghost" onClick={() => setBekreftMelding({ kanal: info.telefon ? "SMS" : "E-post" })}>Logg melding</Button>}
                </div>
              )}
              {malKanal && (
                <div className="space-y-1.5 rounded-lg border bg-muted/30 p-2">
                  <p className="px-1 text-xs text-muted-foreground">Velg mal – åpner {malKanal === "SMS" ? "SMS-appen" : "e-postappen"} din</p>
                  {(malKanal === "SMS" ? SMS_MALER : EPOST_MALER).map(m => (
                    <button key={m.id} type="button" onClick={() => aapneMal(malKanal, m)} className="block w-full rounded-md bg-card px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <span className="font-medium">{m.navn}</span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{fyllMal(m.tekst, { fornavn, firma: info.firma })}</span>
                    </button>
                  ))}
                </div>
              )}
              {bekreftMelding && (
                <div className="space-y-2 rounded-lg border border-primary/60 bg-primary/10 p-3">
                  {bekreftMelding.mal ? (
                    <p className="text-sm font-medium">Sendte du {bekreftMelding.kanal === "SMS" ? "SMS" : "e-post"}?</p>
                  ) : (
                    <div className="flex items-center gap-2 text-sm font-medium">Logg melding:
                      {(["SMS", "E-post"] as const).map(k => <Button key={k} size="sm" variant={bekreftMelding.kanal === k ? "default" : "outline"} className="h-7" onClick={() => setBekreftMelding({ kanal: k })}>{k}</Button>)}
                    </div>
                  )}
                  <Input placeholder="Notat (valgfritt)" value={meldingNotat} onChange={e => setMeldingNotat(e.target.value)} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => loggMelding(bekreftMelding.kanal, bekreftMelding.mal)}>{bekreftMelding.mal ? "Ja" : "Logg"}</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setBekreftMelding(null); setMeldingNotat(""); }}>{bekreftMelding.mal ? "Nei" : "Avbryt"}</Button>
                  </div>
                </div>
              )}
            </section>

            {/* 2. Logg samtale */}
            {canEdit && (
              <section aria-labelledby="kk-logg" className="space-y-2">
                <h3 id="kk-logg" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Logg samtale</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {SAMTALE_UTFALL.map(u => (
                    <button key={u.id} type="button" aria-pressed={utfall === u.id} onClick={() => setUtfall(u.id)}
                      className={cn("min-h-11 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        utfall === u.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted/60")}>
                      {u.label}
                    </button>
                  ))}
                </div>
                <Textarea placeholder="Notat fra samtalen (valgfritt)" value={notat} onChange={e => setNotat(e.target.value)} rows={2} />
                <Button disabled={!utfall || lagrer} onClick={loggSamtale} className="w-full sm:w-auto">{lagrer ? "Lagrer…" : "Logg samtale"}</Button>
                {ctx.oppgave && ctx.oppgave.status !== "Ferdig" && <p className="text-xs text-muted-foreground">Oppgaven «{ctx.oppgave.oppgave}» markeres som ferdig når du logger.</p>}
              </section>
            )}

            {/* 3. Neste steg */}
            {nesteForslag && (
              <section aria-labelledby="kk-neste" className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <h3 id="kk-neste" className="text-sm font-semibold">Neste steg: ny oppfølging?</h3>
                {nesteForslag.dager && <p className="text-xs text-muted-foreground">Forslag: ring igjen om {nesteForslag.dager} dager ({format(new Date(datoOm(nesteForslag.dager)), "d. MMM", { locale: nb })})</p>}
                <div className="flex flex-wrap gap-2">
                  {dagerValg.map(v => (
                    <Button key={v.d} size="sm" variant={nesteForslag.dager === v.d ? "default" : "outline"} onClick={() => lagNesteOppgave(datoOm(v.d))}>{v.l}</Button>
                  ))}
                  {nesteForslag.dager && !dagerValg.some(v => v.d === nesteForslag.dager) && (
                    <Button size="sm" onClick={() => lagNesteOppgave(datoOm(nesteForslag.dager!))}>Om {nesteForslag.dager} dager</Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Input type="date" aria-label="Egendefinert dato" value={egenDato} min={idag()} onChange={e => setEgenDato(e.target.value)} className="h-8 w-auto" />
                  <Button size="sm" variant="outline" disabled={!egenDato} onClick={() => lagNesteOppgave(egenDato)}>Lag oppgave</Button>
                  <Button size="sm" variant="ghost" onClick={() => setNesteForslag(null)}>Hopp over</Button>
                </div>
              </section>
            )}

            {/* 5. Historikk */}
            <section aria-labelledby="kk-hist" className="space-y-2">
              <h3 id="kk-hist" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Historikk</h3>
              {hist.length === 0 ? <p className="text-sm text-muted-foreground">Ingen aktiviteter ennå.</p> : (
                <ul className="divide-y rounded-lg border">
                  {hist.map(h => (
                    <li key={h.id} className="px-3 py-2">
                      <p className="flex justify-between gap-2 text-sm font-medium"><span className="truncate">{h.tittel || h.type}</span><span className="shrink-0 text-xs font-normal text-muted-foreground tabular-nums">{format(new Date(h.dato), "d. MMM HH:mm", { locale: nb })}</span></p>
                      {h.beskrivelse && h.beskrivelse !== h.tittel && <p className="line-clamp-2 text-xs text-muted-foreground">{h.beskrivelse}</p>}
                    </li>
                  ))}
                </ul>
              )}
              {(ctx.kontakt?.notater || ctx.lead?.notater || ctx.sm?.notater) && (
                <div className="rounded-lg border bg-muted/30 px-3 py-2">
                  <p className="text-xs font-medium text-muted-foreground">Notater</p>
                  <p className="line-clamp-4 whitespace-pre-line text-sm">{ctx.kontakt?.notater || ctx.lead?.notater || ctx.sm?.notater}</p>
                </div>
              )}
            </section>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={bekreftTapt} onOpenChange={setBekreftTapt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ikke interessert?</AlertDialogTitle>
            <AlertDialogDescription>
              Oppgaven lukkes{ctx.sm ? ` og salgsmuligheten «${ctx.sm.navn}» flyttes til Tapt` : ctx.lead ? " og leadet tas ut av oppfølging" : ""}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={() => { void loggSamtale(); }}>Ja, logg</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
