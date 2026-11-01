import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { AlarmClock, CalendarDays, Check, ExternalLink, Mail, Phone, Sparkles, TrendingDown, UserPlus } from "lucide-react";
import { toast } from "sonner";
import PageShell from "@/components/PageShell";
import MoeteForslag from "@/components/MoeteForslag";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useAuth } from "@/hooks/use-auth";
import { useMineFilter } from "@/hooks/use-mine-filter";
import { eksterneDeltakere } from "@/lib/moete-kobling";
import { dagStr, dagerForfalt, erMin, filtrerVenter, folgOppNa, salgSomStarStille } from "@/lib/i-dag";
import { cn } from "@/lib/utils";

interface Moete {
  id: string; tittel: string | null; dato: string; start_tid: string | null; user_id: string | null;
  lead_id: string | null; salgsmulighet_id: string | null; selskap_id: string | null; kontakt_id: string | null;
  eksterne_deltakere: string[] | null; deltakere: string[] | null;
}
interface SisteAkt { type: string; tittel: string | null; beskrivelse: string; dato: string; lead_id: string | null; salgsmulighet_id: string | null; selskap_id: string | null; kontakt_id: string | null }
interface Venter { id: string; status: string; sendt_dato: string; user_id: string; e_post: string | null; emne: string | null; ai_begrunnelse: string | null; kontakt_id: string | null; lead_id: string | null; selskap_id: string | null; salgsmulighet_id: string | null }
interface Utkast { draft_id: string; til: string; emne: string; tekst: string }

function Seksjon({ id, tittel, antall, children, lenke }: { id?: string; tittel: string; antall?: number; children: ReactNode; lenke?: ReactNode }) {
  return (
    <section id={id} aria-label={tittel} className="scroll-mt-24 overflow-hidden rounded-lg border bg-card shadow-card">
      <header className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <h2 className="font-display text-base font-semibold">{tittel}{antall !== undefined && <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">{antall}</span>}</h2>
        {lenke}
      </header>
      <div className="p-2 sm:p-3">{children}</div>
    </section>
  );
}
const Tom = ({ children }: { children: ReactNode }) => <p className="px-3 py-4 text-sm text-muted-foreground">{children}</p>;
const dagerTekst = (d: number) => d <= 0 ? "i dag" : d === 1 ? "1 dag siden" : `${d} dager siden`;
const tid = (iso: string) => format(new Date(iso), "HH:mm");

export default function IDag() {
  const navigate = useNavigate();
  const { user, canEdit } = useAuth();
  const { leads, oppgaver, salgsmuligheter, selskaper, kontakter, updateOppgaver } = useCrmStore();
  const { filter, setFilter, mittNavn } = useMineFilter("idag", "mine");
  const [moeter, setMoeter] = useState<Moete[]>([]);
  const [sisteAkt, setSisteAkt] = useState<SisteAkt[]>([]);
  const [venter, setVenter] = useState<Venter[]>([]);
  const [visAlleFolg, setVisAlleFolg] = useState(false);
  const [visAlleVenter, setVisAlleVenter] = useState(false);
  const [visAlleStille, setVisAlleStille] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [utkast, setUtkast] = useState<Utkast | null>(null);

  const now = new Date();
  const iDag = dagStr(now);
  const epost = (user?.email || "").toLowerCase();
  const meg = useMemo(() => ({ userId: user?.id || "", navn: [mittNavn, epost, epost.split("@")[0]].filter(Boolean) }), [user, mittNavn, epost]);
  const min = useCallback((f: { ansvarlig?: string | null; eier_id?: string | null; user_id?: string | null }) => erMin(filter, meg, f), [filter, meg]);

  useEffect(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const slutt = new Date(start); slutt.setDate(slutt.getDate() + 2);
    supabase.from("aktiviteter")
      .select("id, tittel, dato, start_tid, user_id, lead_id, salgsmulighet_id, selskap_id, kontakt_id, eksterne_deltakere, deltakere")
      .eq("type", "Møte").gte("dato", start.toISOString()).lt("dato", slutt.toISOString())
      .order("dato", { ascending: true }).limit(100)
      .then(async ({ data }) => {
        const m = (data as Moete[]) || [];
        setMoeter(m);
        const ider = (k: keyof Moete) => Array.from(new Set(m.map(x => x[k]).filter(Boolean))) as string[];
        const deler = (["lead_id", "salgsmulighet_id", "selskap_id", "kontakt_id"] as const)
          .map(k => [k, ider(k)] as const).filter(([, v]) => v.length).map(([k, v]) => `${k}.in.(${v.join(",")})`);
        if (!deler.length) return;
        const { data: a } = await supabase.from("aktiviteter")
          .select("type, tittel, beskrivelse, dato, lead_id, salgsmulighet_id, selskap_id, kontakt_id")
          .neq("type", "Møte").lte("dato", new Date().toISOString()).or(deler.join(","))
          .order("dato", { ascending: false }).limit(300);
        setSisteAkt((a as SisteAkt[]) || []);
      });
    supabase.from("venter_pa_svar")
      .select("id, status, sendt_dato, user_id, e_post, emne, ai_begrunnelse, kontakt_id, lead_id, selskap_id, salgsmulighet_id")
      .in("status", ["venter", "varslet"]).order("sendt_dato", { ascending: true }).limit(200)
      .then(({ data }) => setVenter(filtrerVenter((data as Venter[]) || [])));
  }, []);

  // ---------- Møter ----------
  const synligeMoeter = useMemo(() => moeter.filter(m => {
    const eksterne = eksterneDeltakere({ type: "Møte", eksterne_deltakere: m.eksterne_deltakere });
    const koblet = m.lead_id || m.salgsmulighet_id || m.selskap_id || m.kontakt_id;
    if (!koblet && eksterne.length === 0) return false; // interne møter og huskelapper
    if (filter === "mine") return m.user_id === meg.userId || (m.deltakere || []).some(d => d.toLowerCase() === epost);
    return true;
  }), [moeter, filter, meg, epost]);
  const moeterIDag = synligeMoeter.filter(m => dagStr(new Date(m.start_tid || m.dato)) === iDag);

  const hvemMed = (m: Moete) => {
    const sm = salgsmuligheter.find(s => s.id === m.salgsmulighet_id);
    if (sm) return { navn: sm.navn, lenke: `/salgsmuligheter?open=${sm.id}` };
    const l = leads.find(x => x.id === m.lead_id);
    if (l) return { navn: [l.kontaktperson, l.firmanavn].filter(Boolean).join(" · "), lenke: `/leads?open=${l.id}` };
    const s = selskaper.find(x => x.id === m.selskap_id);
    if (s) return { navn: s.firmanavn, lenke: `/selskaper/${s.id}` };
    const k = kontakter.find(x => x.id === m.kontakt_id);
    if (k) return { navn: k.navn, lenke: `/kontakter?open=${k.id}` };
    return { navn: eksterneDeltakere({ type: "Møte", eksterne_deltakere: m.eksterne_deltakere }).join(", "), lenke: "" };
  };
  const sisteFor = (m: Moete) => sisteAkt.find(a =>
    (m.salgsmulighet_id && a.salgsmulighet_id === m.salgsmulighet_id) || (m.lead_id && a.lead_id === m.lead_id) ||
    (m.selskap_id && a.selskap_id === m.selskap_id) || (m.kontakt_id && a.kontakt_id === m.kontakt_id));

  const gjorTilSalg = async (m: Moete) => {
    setBusy(m.id);
    const { data, error } = await supabase.rpc("moete_forslag_til_salgsmulighet", { _moete_id: m.id });
    setBusy(null);
    if (error) { toast.error(`Kunne ikke opprette: ${error.message}`); return; }
    setMoeter(prev => prev.map(x => x.id === m.id ? { ...x, salgsmulighet_id: data as string } : x));
    toast.success("Salgsmulighet opprettet (Møte booket)", { action: { label: "Åpne", onClick: () => navigate(`/salgsmuligheter?open=${data}`) } });
  };

  // ---------- Følg opp nå ----------
  const folgOpp = useMemo(() => folgOppNa(
    oppgaver.filter(o => min({ ansvarlig: o.ansvarlig })),
    leads.filter(l => min({ ansvarlig: l.ansvarlig })),
    now,
    o => leads.find(l => l.id === o.lead_id)?.telefon || kontakter.find(k => k.id === o.kontakt_id)?.telefon || "",
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [oppgaver, leads, kontakter, min, iDag]);
  const forfalt = folgOpp.filter(r => r.dagerForfalt > 0).length;
  const fullforOppgave = (id: string) => {
    updateOppgaver(prev => prev.map(o => o.id === id ? { ...o, status: "Ferdig" } : o));
    toast.success("Oppgaven er fullført");
  };

  // ---------- Venter på svar ----------
  const mineVenter = venter.filter(v => min({ user_id: v.user_id }));
  const venterInfo = (v: Venter) => {
    const k = kontakter.find(x => x.id === v.kontakt_id);
    const l = leads.find(x => x.id === v.lead_id);
    const s = selskaper.find(x => x.id === (v.selskap_id || k?.selskap_id));
    const dom = (v.e_post || "").split("@")[1] || "";
    return { navn: k?.navn || l?.kontaktperson || v.e_post || "Ukjent", firma: s?.firmanavn || l?.firmanavn || dom, telefon: l?.telefon || k?.telefon || "" };
  };
  const lagUtkast = async (v: Venter) => {
    setBusy(v.id);
    const { data, error } = await supabase.functions.invoke("gmail-utkast", { body: { venter_id: v.id } });
    setBusy(null);
    if (error || data?.error) { toast.error(data?.error || "Kunne ikke lage utkast"); return; }
    setUtkast(data as Utkast);
  };
  const slettUtkast = async () => {
    if (!utkast) return;
    await supabase.functions.invoke("gmail-utkast", { body: { action: "slett", draft_id: utkast.draft_id } });
    setUtkast(null);
    toast.success("Utkastet er slettet");
  };
  const avslutt = async (v: Venter) => {
    const { error } = await supabase.from("venter_pa_svar").update({ status: "avsluttet" }).eq("id", v.id);
    if (error) { toast.error("Kunne ikke oppdatere"); return; }
    setVenter(prev => prev.filter(x => x.id !== v.id));
  };

  // ---------- Salg som står stille ----------
  const stille = useMemo(() => salgSomStarStille(salgsmuligheter.filter(s => min({ ansvarlig: s.ansvarlig }))),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [salgsmuligheter, min, iDag]);
  const utenNesteSteg = stille.filter(s => s.mangler === "Mangler neste steg").length;

  const igaar = new Date(now); igaar.setDate(igaar.getDate() - 1);
  const nyeLeads = leads.filter(l => (l.opprettet_dato || "").slice(0, 10) >= dagStr(igaar)).length;

  const dato = format(now, "EEEE d. MMMM", { locale: nb });
  const time = now.getHours();
  const hilsen = time < 10 ? "God morgen" : time < 18 ? "God dag" : "God kveld";
  const fornavn = (mittNavn || "").split(/\s+/)[0];
  const scroll = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  const tall = [
    { label: "Møter i dag", verdi: moeterIDag.length, ikon: CalendarDays, onClick: () => scroll("moeter") },
    { label: "Forfalt", verdi: forfalt, ikon: AlarmClock, onClick: () => scroll("folg-opp"), haster: forfalt > 0 },
    { label: "Nye leads siden i går", verdi: nyeLeads, ikon: UserPlus, onClick: () => navigate("/leads?status=Ny") },
    { label: "Salg uten neste steg", verdi: utenNesteSteg, ikon: TrendingDown, onClick: () => scroll("stille") },
  ];

  return (
    <PageShell
      title={`${hilsen}${fornavn ? `, ${fornavn}` : ""}`}
      subtitle={dato.charAt(0).toUpperCase() + dato.slice(1)}
      actions={
        <div role="group" aria-label="Vis" className="inline-flex rounded-md border bg-card p-0.5">
          {(["mine", "teamet"] as const).map(v => (
            <Button key={v} size="sm" variant={filter === v ? "default" : "ghost"} aria-pressed={filter === v} onClick={() => setFilter(v)} className="h-8">
              {v === "mine" ? "Mine" : "Teamet"}
            </Button>
          ))}
        </div>
      }
    >
      <div className="mx-auto max-w-[1300px] space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tall.map(t => (
            <Button key={t.label} variant="outline" onClick={t.onClick} className="h-auto min-h-20 justify-start gap-3 whitespace-normal rounded-lg bg-card p-4 text-left shadow-card hover:bg-card">
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", t.haster ? "bg-warning/15 text-warning" : "bg-primary/15 text-foreground")}><t.ikon className="h-4 w-4" /></span>
              <span className="min-w-0">
                <span className="block text-xs font-medium text-muted-foreground">{t.label}</span>
                <span className="mt-0.5 block text-xl font-semibold tabular-nums">{t.verdi}</span>
              </span>
            </Button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Seksjon id="moeter" tittel="Dagens møter" antall={synligeMoeter.length} lenke={<Link to="/kalender" className="text-xs font-medium text-muted-foreground hover:text-foreground">Kalender</Link>}>
            {synligeMoeter.length === 0 ? <Tom>Ingen eksterne møter i dag eller i morgen.</Tom> : (
              <ul className="divide-y">
                {synligeMoeter.map(m => {
                  const start = m.start_tid || m.dato;
                  const iMorgen = dagStr(new Date(start)) !== iDag;
                  const med = hvemMed(m);
                  const siste = sisteFor(m);
                  const koblet = m.lead_id || m.salgsmulighet_id || m.selskap_id || m.kontakt_id;
                  return (
                    <li key={m.id} className="flex gap-3 px-3 py-3">
                      <div className="w-14 shrink-0 text-sm font-semibold tabular-nums">{tid(start)}{iMorgen && <span className="block text-xs font-normal text-muted-foreground">i morgen</span>}</div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate text-sm font-medium">{m.tittel || "Møte"}</p>
                        <p className="truncate text-xs text-muted-foreground">Med {med.navn || "ukjent"}</p>
                        {siste && <p className="truncate text-xs text-muted-foreground">Sist: {siste.tittel || siste.type} · {dagerTekst(dagerForfalt(siste.dato, now))}</p>}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {med.lenke && <Button size="sm" variant="outline" className="h-7" onClick={() => navigate(med.lenke)}>Åpne kort</Button>}
                          {!koblet && canEdit && <Button size="sm" className="h-7" disabled={busy === m.id} onClick={() => gjorTilSalg(m)}>{busy === m.id ? "Oppretter…" : "Gjør til salgsmulighet"}</Button>}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Seksjon>

          <Seksjon id="folg-opp" tittel="Følg opp nå" antall={folgOpp.length}>
            {folgOpp.length === 0 ? <Tom>Ingen forfalte oppfølginger.</Tom> : (
              <>
                <ul className="divide-y">
                  {(visAlleFolg ? folgOpp : folgOpp.slice(0, 8)).map(r => (
                    <li key={r.key} className="flex flex-wrap items-center gap-3 px-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.navn}</p>
                        <p className={cn("text-xs tabular-nums", r.dagerForfalt > 0 ? "text-warning" : "text-muted-foreground")}>
                          {r.hva} · {r.dagerForfalt > 0 ? `${r.dagerForfalt} ${r.dagerForfalt === 1 ? "dag" : "dager"} forfalt` : "i dag"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {r.telefon && <Button asChild size="sm" variant="outline" className="h-8 gap-1"><a href={`tel:${r.telefon.replace(/\s/g, "")}`}><Phone className="h-3.5 w-3.5" />Ring</a></Button>}
                        {canEdit && <Button size="sm" className="h-8 gap-1" onClick={() => r.type === "oppgave" ? fullforOppgave(r.id) : navigate(`/leads?open=${r.id}`)}><Check className="h-3.5 w-3.5" />Ferdig</Button>}
                      </div>
                    </li>
                  ))}
                </ul>
                {folgOpp.length > 8 && <Button variant="link" size="sm" className="px-3" onClick={() => setVisAlleFolg(v => !v)}>{visAlleFolg ? "Vis færre" : `Vis alle ${folgOpp.length}`}</Button>}
              </>
            )}
          </Seksjon>

          <Seksjon tittel="Venter på svar" antall={mineVenter.length}>
            {mineVenter.length === 0 ? <Tom>Ingen e-poster venter på svar.</Tom> : (
              <>
                <ul className="divide-y">
                  {(visAlleVenter ? mineVenter : mineVenter.slice(0, 5)).map(v => {
                    const info = venterInfo(v);
                    return (
                      <li key={v.id} className="space-y-2 px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{info.navn}{info.firma && <span className="font-normal text-muted-foreground"> · {info.firma}</span>}</p>
                            <p className="truncate text-xs">{v.emne || "(uten emne)"}</p>
                            {v.ai_begrunnelse && <p className="line-clamp-1 text-xs text-muted-foreground">{v.ai_begrunnelse}</p>}
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{dagerTekst(dagerForfalt(v.sendt_dato, now))}</span>
                        </div>
                        {canEdit && (
                          <div className="flex flex-wrap gap-2">
                            {v.user_id === meg.userId && <Button size="sm" className="h-7 gap-1" disabled={busy === v.id} onClick={() => lagUtkast(v)}><Mail className="h-3.5 w-3.5" />{busy === v.id ? "Lager utkast…" : "Følg opp"}</Button>}
                            {info.telefon && <Button asChild size="sm" variant="outline" className="h-7 gap-1"><a href={`tel:${info.telefon.replace(/\s/g, "")}`}><Phone className="h-3.5 w-3.5" />Ring</a></Button>}
                            <Button size="sm" variant="ghost" className="h-7" onClick={() => avslutt(v)}>Ikke aktuelt</Button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {mineVenter.length > 5 && <Button variant="link" size="sm" className="px-3" onClick={() => setVisAlleVenter(v => !v)}>{visAlleVenter ? "Vis færre" : `Vis alle ${mineVenter.length}`}</Button>}
              </>
            )}
          </Seksjon>

          <Seksjon tittel="Nytt i Innboks" lenke={<Link to="/innboks" className="text-xs font-medium text-muted-foreground hover:text-foreground">Åpne Innboks</Link>}>
            <MoeteForslag kompakt />
          </Seksjon>

          <Seksjon id="stille" tittel="Salg som står stille" antall={stille.length}>
            {stille.length === 0 ? <Tom>Alle åpne salg har neste steg og nylig aktivitet.</Tom> : (
              <>
                <ul className="divide-y">
                  {(visAlleStille ? stille : stille.slice(0, 6)).map(s => (
                    <li key={s.id}>
                      <button type="button" onClick={() => navigate(`/salgsmuligheter?open=${s.id}`)} className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-3 text-left hover:bg-muted/50">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{s.navn}</span>
                          <span className="block text-xs text-warning tabular-nums">{s.mangler}</span>
                        </span>
                        <Badge variant="outline" className="shrink-0">{s.status}</Badge>
                      </button>
                    </li>
                  ))}
                </ul>
                {stille.length > 6 && <Button variant="link" size="sm" className="px-3" onClick={() => setVisAlleStille(v => !v)}>{visAlleStille ? "Vis færre" : `Vis alle ${stille.length}`}</Button>}
              </>
            )}
          </Seksjon>
        </div>
      </div>

      <Dialog open={!!utkast} onOpenChange={o => { if (!o) setUtkast(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" />Utkast lagret i Gmail</DialogTitle>
            <DialogDescription>Ingenting er sendt. Se over og send fra Gmail når du er fornøyd.</DialogDescription>
          </DialogHeader>
          {utkast && (
            <div className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Til:</span> {utkast.til}</p>
              <p><span className="text-muted-foreground">Emne:</span> {utkast.emne}</p>
              <pre className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 font-sans text-sm">{utkast.tekst}</pre>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={slettUtkast}>Slett utkast</Button>
            <Button asChild><a href="https://mail.google.com/mail/u/0/#drafts" target="_blank" rel="noreferrer" className="gap-1"><ExternalLink className="h-4 w-4" />Åpne i Gmail</a></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
