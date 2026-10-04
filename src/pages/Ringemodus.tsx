import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import CompanyLogo from "@/components/CompanyLogo";
import LogActivityDialog from "@/components/LogActivityDialog";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { loggAktivitet, type LoggType } from "@/lib/activity-logging";
import { effektivOppfolging, nesteOppfolgingFraUtfall, type LeadUtfallNokkel } from "@/lib/follow-up-rules";
import { idag, relativTid } from "@/lib/sales-flow";
import { toast } from "sonner";
import { X, Phone, Mail, ChevronLeft, ChevronRight, PhoneMissed, MessageSquare, CalendarCheck, Clock, Ban, ExternalLink, Check, Pencil, ListPlus } from "lucide-react";
import type { Lead, LeadStatus } from "@/data/crm-data";

/** Hvor mange aktiviteter som vises i historikken for hver lead. */
const HISTORIKK_ANTALL = 6;

interface Utfall {
  id: string;
  tast: string;
  label: string;
  hint: string;
  icon: typeof Phone;
  tone: string;
  logg: LoggType;
  utfall?: LeadUtfallNokkel;
  status?: LeadStatus;
}

/** Utfallene i ringemodus. Ett trykk = logget, ny oppfølgingsdato satt, videre til neste. */
const UTFALL: Utfall[] = [
  { id: "svarte_ikke", tast: "1", label: "Svarte ikke", hint: "Ringer igjen om 2 dager", icon: PhoneMissed, tone: "text-warning", logg: "ikke_svar", utfall: "svarte_ikke", status: "Svarte ikke telefon" },
  { id: "snakket", tast: "2", label: "Snakket", hint: "Følger opp om 5 dager", icon: MessageSquare, tone: "text-success", logg: "ringte", utfall: "snakket", status: "Kontaktet" },
  { id: "moete", tast: "3", label: "Booket møte", hint: "Blir salgsmulighet", icon: CalendarCheck, tone: "text-primary", logg: "ringte" },
  { id: "ikke_naa", tast: "4", label: "Ikke nå", hint: "Følger opp om 30 dager", icon: Clock, tone: "text-muted-foreground", logg: "ringte", utfall: "ikke_naa", status: "Kontaktet" },
  { id: "ikke_aktuelt", tast: "5", label: "Ikke aktuelt", hint: "Fjernes fra listen", icon: Ban, tone: "text-destructive", logg: "ringte", status: "Ikke aktuelt" },
];

interface Historikk { id: string; type: string; tittel: string | null; beskrivelse: string; dato: string }

const erAktiv = (l: Lead) =>
  !l.konvertert_dato && !l.konvertert_til &&
  !["Ikke aktuelt", "Konvertert til salg", "Konvertert til partner"].includes(l.status);

export default function Ringemodus() {
  const navigate = useNavigate();
  const { canEdit } = useAuth();
  const { leads, updateLeads, konverterLead } = useCrmStore();

  // Køen fryses når siden åpnes, så leads ikke hopper rundt mens du ringer.
  const [ko, setKo] = useState<string[] | null>(null);
  const [index, setIndex] = useState(0);
  const [ferdige, setFerdige] = useState<Record<string, string>>({});
  const [notat, setNotat] = useState("");
  const [busy, setBusy] = useState(false);
  const [historikk, setHistorikk] = useState<Historikk[]>([]);
  const [redigerApen, setRedigerApen] = useState(false);
  const [loggDialogApen, setLoggDialogApen] = useState(false);
  const [redigering, setRedigering] = useState({ kontaktperson: "", telefon: "", e_post: "", rolle_i_firma: "", neste_steg: "" });
  const notatRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ko || leads.length === 0) return;
    const dagens = idag();
    const ids = leads
      .filter(erAktiv)
      .map(l => ({ l, dato: effektivOppfolging(l) }))
      .filter(x => x.dato <= dagens)
      .sort((a, b) => a.dato.localeCompare(b.dato))
      .map(x => x.l.id);
    setKo(ids);
  }, [leads, ko]);

  const lead = useMemo(() => (ko ? leads.find(l => l.id === ko[index]) : undefined), [ko, index, leads]);

  const hentHistorikk = useCallback(async (leadId: string) => {
    const { data } = await supabase
      .from("aktiviteter")
      .select("id, type, tittel, beskrivelse, dato")
      .eq("lead_id", leadId)
      .order("dato", { ascending: false })
      .limit(HISTORIKK_ANTALL);
    setHistorikk((data as Historikk[]) || []);
  }, []);

  useEffect(() => {
    setNotat("");
    setHistorikk([]);
    setRedigerApen(false);
    if (!lead) return;
    setRedigering({
      kontaktperson: lead.kontaktperson || "",
      telefon: lead.telefon || "",
      e_post: lead.e_post || "",
      rolle_i_firma: lead.rolle_i_firma || "",
      neste_steg: lead.neste_steg || "",
    });
    hentHistorikk(lead.id);
  }, [lead?.id, hentHistorikk]);

  const lagreRedigering = useCallback(() => {
    if (!lead || !canEdit) return;
    const tomTilNull = (v: string) => v.trim() || "";
    updateLeads(prev => prev.map(l => l.id === lead.id ? {
      ...l,
      kontaktperson: tomTilNull(redigering.kontaktperson),
      telefon: tomTilNull(redigering.telefon),
      e_post: tomTilNull(redigering.e_post),
      rolle_i_firma: tomTilNull(redigering.rolle_i_firma),
      neste_steg: tomTilNull(redigering.neste_steg),
    } : l));
    setRedigerApen(false);
    toast.success("Lead oppdatert");
  }, [lead, canEdit, redigering, updateLeads]);

  const neste = useCallback(() => setIndex(i => Math.min(i + 1, (ko?.length ?? 1))), [ko]);
  const forrige = useCallback(() => setIndex(i => Math.max(i - 1, 0)), []);

  const registrer = useCallback(async (u: Utfall) => {
    if (!lead || busy || !canEdit) return;
    setBusy(true);
    const navn = lead.kontaktperson || lead.firmanavn;
    try {
      const { nesteOppfolging } = await loggAktivitet({
        logg: u.logg,
        target: { lead_id: lead.id },
        tittel: `${u.id === "svarte_ikke" ? "Ringte – svarte ikke" : `Ringte – ${u.label.toLowerCase()}`} – ${navn}`,
        notat: notat.trim() || undefined,
        utfall: u.utfall,
      });
      if (u.id === "moete") {
        updateLeads(prev => prev.map(l => l.id === lead.id ? { ...l, sist_aktivitet: idag() } : l));
        const smId = konverterLead(lead.id);
        toast.success(`${lead.firmanavn} er nå en salgsmulighet`, smId ? { action: { label: "Åpne", onClick: () => navigate(`/salgsmuligheter?open=${smId}`) } } : undefined);
      } else {
        updateLeads(prev => prev.map(l => l.id === lead.id ? {
          ...l,
          status: u.status ?? l.status,
          sist_aktivitet: idag(),
          neste_oppfolging: u.utfall ? (nesteOppfolging || nesteOppfolgingFraUtfall(u.utfall)) : l.neste_oppfolging,
        } : l));
      }
      setFerdige(f => ({ ...f, [lead.id]: u.label }));
      neste();
    } catch (err) {
      console.error(err);
      toast.error("Kunne ikke lagre – prøv igjen");
    } finally {
      setBusy(false);
    }
  }, [lead, busy, canEdit, notat, updateLeads, konverterLead, navigate, neste]);

  // Hurtigtaster: 1–5 = utfall, piler = bla, N = notat, Esc = avslutt.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ikke fang hurtigtaster mens en dialog er åpen eller fokus er i et skjemafelt.
      if (loggDialogApen) return;
      const el = document.activeElement as HTMLElement | null;
      const iFelt = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      const iTekst = el === notatRef.current;
      if (e.key === "Escape") { if (iFelt) (el as HTMLElement).blur(); else navigate("/leads"); return; }
      if (iFelt && !(e.metaKey || e.ctrlKey)) return;
      const u = UTFALL.find(x => x.tast === e.key);
      if (u) { e.preventDefault(); registrer(u); return; }
      if (iTekst) return;
      if (e.key === "ArrowRight") neste();
      else if (e.key === "ArrowLeft") forrige();
      else if (e.key.toLowerCase() === "n") { e.preventDefault(); notatRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [registrer, neste, forrige, navigate, loggDialogApen]);

  const totalt = ko?.length ?? 0;
  const antallFerdig = Object.keys(ferdige).length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center gap-3 border-b px-4 py-3 sm:px-6">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Ringemodus</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {totalt === 0 ? "Ingen å ringe" : `${Math.min(index + 1, totalt)} av ${totalt} · ${antallFerdig} ringt`}
          </p>
        </div>
        <div className="hidden sm:block w-48 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${totalt ? (antallFerdig / totalt) * 100 : 0}%` }} />
        </div>
        <Button variant="ghost" size="icon" onClick={() => navigate("/leads")} aria-label="Avslutt ringemodus">
          <X className="w-5 h-5" />
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto">
        {ko === null ? (
          <p className="p-10 text-center text-sm text-muted-foreground">Laster…</p>
        ) : !lead ? (
          <div className="mx-auto max-w-md p-10 text-center">
            <Check className="w-8 h-8 mx-auto mb-3 text-success" />
            <p className="text-lg font-semibold">Ferdig for i dag</p>
            <p className="text-sm text-muted-foreground mt-1 tabular-nums">Du ringte {antallFerdig} av {totalt}.</p>
            <div className="mt-5 flex justify-center gap-2">
              {totalt > 0 && <Button variant="outline" onClick={() => setIndex(0)}>Gå gjennom igjen</Button>}
              <Button onClick={() => navigate("/leads")}>Tilbake til leads</Button>
            </div>
          </div>
        ) : (
          <div className="mx-auto grid max-w-5xl gap-6 p-4 sm:p-6 lg:grid-cols-[1fr_320px]">
            <section className="space-y-5">
              <div className="flex items-start gap-4">
                <CompanyLogo firmanavn={lead.firmanavn} kontaktEmails={lead.e_post ? [lead.e_post] : undefined} size="md" />
                <div className="min-w-0 flex-1">
                  <h1 className="text-2xl font-semibold leading-tight">{lead.kontaktperson || lead.firmanavn}</h1>
                  <p className="text-sm text-muted-foreground">
                    {[lead.rolle_i_firma, lead.firmanavn].filter(Boolean).join(" · ")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="secondary">{lead.status}</Badge>
                    {lead.kilde && <Badge variant="outline">{lead.kilde}</Badge>}
                    {ferdige[lead.id] && <Badge className="bg-success/10 text-success border-0">Logget: {ferdige[lead.id]}</Badge>}
                  </div>
                </div>
                <div className="flex gap-1">
                  {canEdit && (
                    <Button variant="ghost" size="sm" onClick={() => setRedigerApen(a => !a)}>
                      <Pencil className="w-4 h-4 mr-1" />Rediger
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/leads?open=${lead.id}`)}>
                    <ExternalLink className="w-4 h-4 mr-1" />Åpne
                  </Button>
                </div>
              </div>

              {redigerApen && (
                <div className="space-y-3 rounded-xl border bg-card p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Kontaktperson</Label>
                      <Input value={redigering.kontaktperson} onChange={e => setRedigering(r => ({ ...r, kontaktperson: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Rolle</Label>
                      <Input value={redigering.rolle_i_firma} onChange={e => setRedigering(r => ({ ...r, rolle_i_firma: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Telefon</Label>
                      <Input value={redigering.telefon} onChange={e => setRedigering(r => ({ ...r, telefon: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">E-post</Label>
                      <Input type="email" value={redigering.e_post} onChange={e => setRedigering(r => ({ ...r, e_post: e.target.value }))} />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Neste steg</Label>
                      <Input value={redigering.neste_steg} onChange={e => setRedigering(r => ({ ...r, neste_steg: e.target.value }))} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={lagreRedigering}>Lagre endringer</Button>
                    <Button size="sm" variant="ghost" onClick={() => setRedigerApen(false)}>Avbryt</Button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {lead.telefon ? (
                  <a href={`tel:${lead.telefon}`} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-lg font-semibold text-primary-foreground tabular-nums hover:opacity-90">
                    <Phone className="w-5 h-5" />{lead.telefon}
                  </a>
                ) : (
                  <span className="rounded-xl border border-dashed px-5 py-3 text-sm text-muted-foreground">Mangler telefonnummer</span>
                )}
                {lead.e_post && (
                  <a href={`mailto:${lead.e_post}`} className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm hover:bg-muted">
                    <Mail className="w-4 h-4" />{lead.e_post}
                  </a>
                )}
              </div>

              {lead.pinned_notat && (
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">{lead.pinned_notat}</div>
              )}

              {(lead.produkt_oppsummering || lead.use_case || lead.neste_steg) && (
                <dl className="grid gap-3 rounded-xl border bg-card p-4 text-sm sm:grid-cols-2">
                  {lead.produkt_oppsummering && <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Ønsker</dt><dd>{lead.produkt_oppsummering}</dd></div>}
                  {lead.use_case && <div><dt className="text-xs text-muted-foreground">Behov</dt><dd>{lead.use_case}</dd></div>}
                  {lead.neste_steg && <div><dt className="text-xs text-muted-foreground">Neste steg</dt><dd>{lead.neste_steg}</dd></div>}
                </dl>
              )}

              <div className="space-y-3 rounded-xl border bg-card p-4">
                <Textarea
                  ref={notatRef}
                  value={notat}
                  onChange={e => setNotat(e.target.value)}
                  rows={2}
                  placeholder="Notat fra samtalen (valgfritt) – trykk N for å skrive"
                />
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => setLoggDialogApen(true)}>
                    <ListPlus className="w-3.5 h-3.5 mr-1.5" />Logg e-post, møte eller annet
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {UTFALL.map(u => {
                    const Icon = u.icon;
                    return (
                      <button
                        key={u.id}
                        disabled={busy || !canEdit}
                        onClick={() => registrer(u)}
                        className="group flex flex-col items-start gap-1 rounded-lg border bg-background p-3 text-left transition-colors hover:border-primary hover:bg-muted disabled:opacity-50"
                      >
                        <span className="flex w-full items-center justify-between">
                          <Icon className={`w-4 h-4 ${u.tone}`} />
                          <kbd className="rounded border px-1.5 text-[10px] text-muted-foreground tabular-nums">{u.tast}</kbd>
                        </span>
                        <span className="text-sm font-medium">{u.label}</span>
                        <span className="text-[11px] text-muted-foreground">{u.hint}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={forrige} disabled={index === 0}><ChevronLeft className="w-4 h-4 mr-1" />Forrige</Button>
                <span className="hidden sm:block text-xs text-muted-foreground">1–5 logger · ← → blar · N notat · Esc avslutter</span>
                <Button variant="outline" onClick={neste}>Hopp over<ChevronRight className="w-4 h-4 ml-1" /></Button>
              </div>
            </section>

            <aside className="space-y-4">
              <div className="rounded-xl border bg-card p-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Historikk</p>
                {historikk.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ingen aktivitet ennå.</p>
                ) : (
                  <ul className="space-y-3">
                    {historikk.map(h => (
                      <li key={h.id} className="text-sm">
                        <p className="font-medium leading-snug">{h.tittel || h.type}</p>
                        {h.beskrivelse && h.beskrivelse !== h.tittel && <p className="text-muted-foreground line-clamp-3">{h.beskrivelse}</p>}
                        <p className="text-[11px] text-muted-foreground">{relativTid(h.dato)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {lead.notater && (
                <div className="rounded-xl border bg-card p-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Notater</p>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground line-clamp-[12]">{lead.notater}</p>
                </div>
              )}
            </aside>
          </div>
        )}
      </main>

      {lead && (
        <LogActivityDialog
          open={loggDialogApen}
          onOpenChange={setLoggDialogApen}
          target={{ lead_id: lead.id }}
          entityName={lead.firmanavn}
          onLogged={(res) => {
            updateLeads(prev => prev.map(l => l.id === lead.id ? {
              ...l,
              status: l.status === "Ny" ? "Kontaktet" : l.status,
              sist_aktivitet: idag(),
              neste_oppfolging: res?.nesteOppfolging || l.neste_oppfolging,
            } : l));
            setFerdige(f => ({ ...f, [lead.id]: "Logget" }));
            hentHistorikk(lead.id);
          }}
        />
      )}
    </div>
  );
}
