import { varsleLogget } from "@/lib/gjort-i-dag";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { Mail, MessageSquare, Pencil, Phone, Plus } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import LoggUtfall from "@/components/LoggUtfall";
import { erSenere } from "@/lib/logg-utfall";
import { taActivNaa } from "@/lib/senere";
import { Badge } from "@/components/ui/badge";
import {
  EPOST_MALER, SMS_MALER, fyllMal, mailtoLenke, smsLenke,
  type MeldingMal,
} from "@/lib/kundekort";
import { cn } from "@/lib/utils";
import { kundeParam, type KundeRef } from "@/hooks/use-kort";
import KobleSelskap from "@/components/KobleSelskap";
import { ArrowLeft } from "lucide-react";
import type { Selskap } from "@/data/crm-data";
import OppgaveTid from "@/components/OppgaveTid";
import { compareTaskSchedule, taskTitle } from "@/lib/oppgave-tid";
import EpostTraadDialog, { type EpostForVisning } from "@/components/EpostTraadDialog";
import { epostKontaktTekst, epostTraadId, renAktivitetstekst } from "@/lib/aktivitet-visning";

interface Hist { id: string; type: string; tittel: string | null; beskrivelse: string; dato: string; aktivitet_kilde?: string | null }
type Kanal = "SMS" | "E-post";

interface Props { r: KundeRef; onClose: () => void; onSelskap: (id: string) => void; onTilbake?: () => void }

export default function KundeKort({ r, onClose, onSelskap, onTilbake }: Props) {
  const rad = r;
  const isMobile = useIsMobile();
  const { user, canEdit } = useAuth();
  const { leads, oppgaver, kontakter, salgsmuligheter, selskaper, updateLeads, updateKontakter, updateSalgsmuligheter, updateOppgaver } = useCrmStore();

  // ---------- Kontekst ----------
  const ctx = useMemo(() => {
    const oppgave = r.type === "oppgave" ? oppgaver.find(o => o.id === r.id) : undefined;
    const lead = leads.find(l => l.id === (r.type === "lead" ? r.id : oppgave?.lead_id));
    const sm = salgsmuligheter.find(s => s.id === (r.type === "sm" ? r.id : oppgave?.salgsmulighet_id));
    const kontakt = kontakter.find(k => k.id === (r.type === "kontakt" ? r.id : oppgave?.kontakt_id || sm?.kontakt_id));
    const firmaLc = (lead?.firmanavn || "").trim().toLowerCase();
    const selskap = selskaper.find(s => s.id === (oppgave?.selskap_id || sm?.selskap_id || kontakt?.selskap_id))
      || (firmaLc ? selskaper.find(s => s.firmanavn.trim().toLowerCase() === firmaLc) : undefined);
    if (!oppgave && !lead && !sm && !kontakt) return null;
    return { oppgave, lead, sm, kontakt, selskap };
  }, [r, oppgaver, leads, salgsmuligheter, kontakter, selskaper]);

  const kobleSelskap = (s: Selskap) => {
    if (!ctx) return;
    if (ctx.kontakt) { const id = ctx.kontakt.id; updateKontakter(p => p.map(k => k.id === id ? { ...k, selskap_id: s.id } : k)); }
    if (ctx.sm) { const id = ctx.sm.id; updateSalgsmuligheter(p => p.map(x => x.id === id ? { ...x, selskap_id: s.id } : x)); }
    if (ctx.lead) { const id = ctx.lead.id; updateLeads(p => p.map(l => l.id === id ? { ...l, firmanavn: s.firmanavn } : l)); }
    if (ctx.oppgave && !ctx.kontakt && !ctx.sm && !ctx.lead) { const id = ctx.oppgave.id; updateOppgaver(p => p.map(o => o.id === id ? { ...o, selskap_id: s.id } : o)); }
    toast.success(`Koblet til ${s.firmanavn}`);
  };

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
  const [malKanal, setMalKanal] = useState<Kanal | null>(null);
  const [ventende, setVentende] = useState<{ kanal: Kanal; mal: MeldingMal } | null>(null);
  const [bekreftMelding, setBekreftMelding] = useState<{ kanal: Kanal; mal?: MeldingMal } | null>(null);
  const [meldingNotat, setMeldingNotat] = useState("");
  const [hist, setHist] = useState<Hist[]>([]);
  const [visEpost, setVisEpost] = useState<EpostForVisning | null>(null);

  useEffect(() => {
    setForm(info); setRedigerer(false);
    setMalKanal(null); setVentende(null); setBekreftMelding(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kundeParam(r)]);

  const hentHistorikk = useCallback(async () => {
    const deler = Object.entries(target).filter(([k, v]) => v && k !== "selskap_id").map(([k, v]) => `${k}.eq.${v}`);
    if (!deler.length) { setHist([]); return; }
    const { data } = await supabase.from("aktiviteter").select("id, type, tittel, beskrivelse, dato, aktivitet_kilde").or(deler.join(",")).order("dato", { ascending: false }).limit(15);
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

  if (!ctx) return null;

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
    varsleLogget();
    setBekreftMelding(null); setMeldingNotat("");
    toast.success("Meldingen er logget");
    void hentHistorikk();
  };

  const tel = info.telefon.replace(/\s/g, "");

  return (
    <>
      <Sheet open onOpenChange={o => !o && onClose()}>
        <SheetContent side={isMobile ? "bottom" : "right"} className={cn("overflow-y-auto", isMobile ? "max-h-[90vh] rounded-t-xl" : "w-full sm:max-w-md")}>
          <SheetHeader className="text-left">
            {onTilbake && ctx.selskap && (
              <Button variant="ghost" size="sm" className="-ml-2 h-7 w-fit gap-1 text-muted-foreground" onClick={onTilbake}><ArrowLeft className="h-3.5 w-3.5" />Tilbake til {ctx.selskap.firmanavn}</Button>
            )}
            <SheetTitle className="font-display">{info.navn || info.firma || ctx.oppgave?.oppgave || "Kunde"}</SheetTitle>
            <SheetDescription asChild>
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
                {ctx.selskap
                  ? <Button variant="link" className="h-auto p-0 font-medium text-foreground" onClick={() => { if (ctx.selskap) onSelskap(ctx.selskap.id); }}>{ctx.selskap.firmanavn}</Button>
                  : <>{info.firma && <span>{info.firma}</span>}{canEdit && <KobleSelskap forslag={info.firma} onVelg={kobleSelskap} />}</>}
                {info.rolle && <span>· {info.rolle}</span>}
              </div>
            </SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-6">
            {ctx.lead && erSenere(ctx.lead.senere_til) && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                <Badge variant="secondary" className="tabular-nums">Senere · tilbake {format(new Date(`${ctx.lead.senere_til}T12:00`), "d. MMM", { locale: nb })}</Badge>
                {canEdit && <Button size="sm" variant="outline" onClick={() => { if (ctx.lead) { taActivNaa(ctx.lead, updateLeads, updateOppgaver); toast.success("Tatt opp igjen – ligger i Følg opp nå"); } }}>Ta opp nå</Button>}
              </div>
            )}
            {(ctx.oppgave || ctx.lead || ctx.sm || ctx.kontakt) && (
              <section aria-label="Oppgavetid" className="space-y-3">
                {(ctx.oppgave ? [ctx.oppgave] : oppgaver.filter(o => o.status !== "Ferdig" && (
                  (ctx.lead && o.lead_id === ctx.lead.id) || (ctx.sm && o.salgsmulighet_id === ctx.sm.id) || (ctx.kontakt && o.kontakt_id === ctx.kontakt.id)
                )).sort(compareTaskSchedule)).map(o => (
                  <div key={o.id} className="space-y-2 border-b pb-3">
                    <h3 className="text-sm font-semibold">{taskTitle(o.oppgave)}</h3>
                    <label className="grid gap-1 text-xs text-muted-foreground">Dato
                      <Input type="date" value={o.frist} disabled={!canEdit} onChange={e => updateOppgaver(p => p.map(x => x.id === o.id ? { ...x, frist: e.target.value } : x))} />
                    </label>
                    <OppgaveTid value={o.frist_tid} disabled={!canEdit} onChange={v => updateOppgaver(p => p.map(x => x.id === o.id ? { ...x, frist_tid: v } : x))} />
                  </div>
                ))}
              </section>
            )}
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

            {/* 2. Hva skjedde? – felles loggkomponent */}
            {canEdit && (
              <div className="space-y-1">
                <LoggUtfall target={target} navn={info.navn || info.firma} oppgaveId={ctx.oppgave?.id} ansvarlig={ansvarlig} onLogged={() => void hentHistorikk()} />
                {ctx.oppgave && ctx.oppgave.status !== "Ferdig" && <p className="text-xs text-muted-foreground">Oppgaven «{ctx.oppgave.oppgave}» markeres som ferdig når du lagrer.</p>}
              </div>
            )}

            {/* 5. Historikk */}
            <section aria-labelledby="kk-hist" className="space-y-2">
              <h3 id="kk-hist" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Historikk</h3>
              {hist.length === 0 ? <p className="text-sm text-muted-foreground">Ingen aktiviteter ennå.</p> : (
                <ul className="divide-y rounded-lg border">
                  {hist.map(h => {
                    const kropp = renAktivitetstekst(h.beskrivelse);
                    const kontakt = epostKontaktTekst(h.beskrivelse, h.aktivitet_kilde === "gmail_sendt");
                    const innhald = (
                      <>
                        <p className="flex justify-between gap-2 text-sm font-medium"><span className="min-w-0 flex-1 truncate">{h.tittel || h.type}</span><span className="shrink-0 text-xs font-normal text-muted-foreground tabular-nums">{kontakt && <span>{kontakt} · </span>}{format(new Date(h.dato), "d. MMM HH:mm", { locale: nb })}</span></p>
                        {kropp && kropp !== (h.tittel || "").trim() && <p className="line-clamp-2 text-xs text-muted-foreground">{kropp}</p>}
                      </>
                    );
                    return (
                      <li key={h.id} className="px-3 py-2">
                        {epostTraadId(h.beskrivelse) ? (
                          <button type="button" onClick={() => setVisEpost(h)} className="-mx-3 -my-2 block w-full rounded-lg px-3 py-2 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{innhald}</button>
                        ) : innhald}
                      </li>
                    );
                  })}
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

      <EpostTraadDialog epost={visEpost} onOpenChange={o => !o && setVisEpost(null)} />
    </>
  );
}
