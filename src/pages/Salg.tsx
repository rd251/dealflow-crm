import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CalendarDays, Columns3, List, PhoneCall, Plus, Search, Tag } from "lucide-react";
import PageShell from "@/components/PageShell";
import CompanyLogo from "@/components/CompanyLogo";
import MineTeametToggle from "@/components/MineTeametToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useMineFilter } from "@/hooks/use-mine-filter";
import { useProfiles } from "@/hooks/use-profiles";
import { dagerSiden, idag, relativTid } from "@/lib/sales-flow";
import { nok } from "@/lib/utils";
import type { Lead, LeadKilde, LeadStatus, SalgsmulighetStatus } from "@/data/crm-data";
import { toast } from "sonner";

const SALGSSTEG = ["Nye", "Kontaktet", "Møte", "Behov avklart", "Tilbud sendt", "Avsluttet"] as const;
type Salgssteg = (typeof SALGSSTEG)[number];
type Visning = "kanban" | "tabell";

const LEAD_TIL_STEG: Record<LeadStatus, Salgssteg> = {
  "Ny": "Nye",
  "Kontaktet": "Kontaktet",
  "Svarte ikke telefon": "Kontaktet",
  "Ikke fått tak i ennå": "Kontaktet",
  "Kvalifisert": "Kontaktet",
  "Ikke aktuelt": "Avsluttet",
  "Konvertert til salg": "Avsluttet",
  "Konvertert til partner": "Avsluttet",
};

const DEAL_TIL_STEG: Record<SalgsmulighetStatus, Salgssteg> = {
  "Møte booket": "Møte",
  "Behov avklart": "Behov avklart",
  "Løsning presentert": "Behov avklart",
  "Demo gjennomført": "Behov avklart",
  "Demo-prosjekt": "Behov avklart",
  "Kontrakt sendt": "Tilbud sendt",
  "Vunnet": "Avsluttet",
  "Tapt": "Avsluttet",
};

const STEG_TIL_DEAL: Partial<Record<Salgssteg, SalgsmulighetStatus>> = {
  "Møte": "Møte booket",
  "Behov avklart": "Behov avklart",
  "Tilbud sendt": "Kontrakt sendt",
};

const STALE_DAGER = 7;
const GENERISKE_DOMENER = new Set(["gmail.com", "hotmail.com", "outlook.com", "live.no", "icloud.com", "yahoo.com"]);

interface Salgskort {
  id: string;
  kind: "lead" | "deal";
  selskap: string;
  kontakt: string;
  steg: Salgssteg;
  sluttstatus?: "Vunnet" | "Tapt" | "Ikke aktuelt";
  mrr: number;
  nesteSteg: string;
  ansvarlig: string;
  eierId?: string;
  sistAktivitet: string;
  pinnedNotat?: string;
}

function bedriftForLead(lead: Lead) {
  const firma = lead.firmanavn?.trim();
  const person = lead.kontaktperson?.trim();
  if (firma && firma.toLocaleLowerCase("nb") !== person?.toLocaleLowerCase("nb") && firma.toLocaleLowerCase("nb") !== "ukjent") return firma;
  const domene = lead.e_post?.split("@")[1]?.toLowerCase();
  return domene && !GENERISKE_DOMENER.has(domene) ? domene : "Bedrift ikke oppgitt";
}

export default function Salg() {
  const navigate = useNavigate();
  const { canEdit, user } = useAuth();
  const { profiles } = useProfiles();
  const { filter: eierVisning, setFilter: setEierVisning, tilhorerFilter } = useMineFilter("salg", "teamet");
  const { leads, salgsmuligheter, selskaper, updateLeads, updateSalgsmuligheter, konverterLead, vinnSalgsmulighet, tapSalgsmulighet, generateId } = useCrmStore();
  const [visning, setVisning] = useState<Visning>("kanban");
  const [search, setSearch] = useState("");
  const [owner, setOwner] = useState("alle");
  const [kunOppfolging, setKunOppfolging] = useState(false);
  const [dragged, setDragged] = useState<Salgskort | null>(null);
  const [konvertering, setKonvertering] = useState<{ kort: Salgskort; steg: Salgssteg } | null>(null);
  const [konverterNavn, setKonverterNavn] = useState("");
  const [nyLeadOpen, setNyLeadOpen] = useState(false);
  const [nyLead, setNyLead] = useState({ firmanavn: "", kontaktperson: "", e_post: "", telefon: "" });

  const kort = useMemo<Salgskort[]>(() => {
    const leadKort = leads
      .filter(lead => lead.status !== "Konvertert til salg" && lead.status !== "Konvertert til partner" && !lead.konvertert_dato)
      .map(lead => ({
        id: lead.id,
        kind: "lead" as const,
        selskap: bedriftForLead(lead),
        kontakt: lead.kontaktperson || "",
        steg: LEAD_TIL_STEG[lead.status],
        sluttstatus: lead.status === "Ikke aktuelt" ? "Ikke aktuelt" as const : undefined,
        mrr: 0,
        nesteSteg: lead.neste_steg || "",
        ansvarlig: lead.ansvarlig || "",
        eierId: (lead as Lead & { eier_id?: string }).eier_id,
        sistAktivitet: lead.sist_aktivitet || lead.opprettet_dato || "",
        pinnedNotat: lead.pinned_notat,
      }));
    const dealKort = salgsmuligheter.map(deal => ({
      id: deal.id,
      kind: "deal" as const,
      selskap: selskaper.find(selskap => selskap.id === deal.selskap_id)?.firmanavn || deal.navn,
      kontakt: deal.kontaktperson || "",
      steg: DEAL_TIL_STEG[deal.status],
      sluttstatus: deal.status === "Vunnet" || deal.status === "Tapt" ? deal.status : undefined,
      mrr: deal.forventet_mrr || 0,
      nesteSteg: deal.neste_steg || "",
      ansvarlig: deal.ansvarlig || "",
      eierId: (deal as typeof deal & { eier_id?: string }).eier_id,
      sistAktivitet: deal.sist_aktivitet || deal.opprettet_dato || "",
      pinnedNotat: deal.pinned_notat,
    }));
    return [...leadKort, ...dealKort];
  }, [leads, salgsmuligheter, selskaper]);

  const ownerName = (value: string) => profiles.find(profile => profile.user_id === value)?.display_name || value || "Ikke fordelt";
  const today = idag();
  const trengerOppfolging = (item: Salgskort) => {
    if (item.steg === "Avsluttet") return false;
    if (item.kind === "lead") {
      const lead = leads.find(value => value.id === item.id);
      return !!lead && (!lead.neste_oppfolging || lead.neste_oppfolging <= today);
    }
    const dager = dagerSiden(item.sistAktivitet);
    return dager === null || dager >= STALE_DAGER;
  };

  const synlige = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("nb");
    return kort.filter(item => {
      if (!tilhorerFilter(item.ansvarlig, item.eierId)) return false;
      if (owner !== "alle" && item.ansvarlig !== owner && item.eierId !== owner) return false;
      if (kunOppfolging && !trengerOppfolging(item)) return false;
      return !query || [item.selskap, item.kontakt, item.nesteSteg, ownerName(item.ansvarlig)].some(value => value.toLocaleLowerCase("nb").includes(query));
    });
  }, [kort, eierVisning, owner, kunOppfolging, search, profiles]);

  const aktive = kort.filter(item => item.steg !== "Avsluttet");
  const antallOppfolging = aktive.filter(trengerOppfolging).length;
  const antallMoter = kort.filter(item => item.steg === "Møte").length;
  const antallTilbud = kort.filter(item => item.steg === "Tilbud sendt").length;
  const pipelineMrr = aktive.reduce((sum, item) => sum + item.mrr, 0);

  const openCard = (item: Salgskort) => navigate(item.kind === "lead" ? `/leads?open=${item.id}` : `/salgsmuligheter?open=${item.id}`);

  const requestMove = (item: Salgskort, steg: Salgssteg) => {
    if (!canEdit || item.steg === steg) return;
    if (item.kind === "lead") {
      if (steg === "Nye" || steg === "Kontaktet" || steg === "Avsluttet") {
        const status: LeadStatus = steg === "Nye" ? "Ny" : steg === "Kontaktet" ? "Kontaktet" : "Ikke aktuelt";
        updateLeads(current => current.map(lead => lead.id === item.id ? { ...lead, status, sist_aktivitet: today } : lead));
        return;
      }
      setKonverterNavn(item.selskap === "Bedrift ikke oppgitt" ? item.kontakt : item.selskap);
      setKonvertering({ kort: item, steg });
      return;
    }
    if (steg === "Avsluttet") {
      setKonvertering({ kort: item, steg });
      return;
    }
    const status = STEG_TIL_DEAL[steg];
    if (!status) return;
    updateSalgsmuligheter(current => current.map(deal => deal.id === item.id ? { ...deal, status, sist_aktivitet: today } : deal));
  };

  const bekreftFlytting = (utfall?: "Vunnet" | "Tapt") => {
    if (!konvertering) return;
    const { kort: item, steg } = konvertering;
    if (item.kind === "lead") {
      const dealId = konverterLead(item.id, konverterNavn.trim() || undefined);
      const status = STEG_TIL_DEAL[steg];
      if (dealId && status && status !== "Møte booket") {
        updateSalgsmuligheter(current => current.map(deal => deal.id === dealId ? { ...deal, status, sist_aktivitet: today } : deal));
      }
      if (dealId) toast.success(`${item.selskap} er flyttet til ${steg}`);
    } else if (utfall === "Vunnet") {
      vinnSalgsmulighet(item.id);
    } else if (utfall === "Tapt") {
      tapSalgsmulighet(item.id, "Annet");
    }
    setKonvertering(null);
    setKonverterNavn("");
  };

  const addLead = () => {
    if (!nyLead.firmanavn.trim() && !nyLead.kontaktperson.trim()) return;
    const id = generateId("L", leads);
    const lead: Lead = {
      id,
      firmanavn: nyLead.firmanavn.trim(),
      kontaktperson: nyLead.kontaktperson.trim(),
      e_post: nyLead.e_post.trim(),
      telefon: nyLead.telefon.trim(),
      kilde: "Annet" as LeadKilde,
      status: "Ny",
      ansvarlig: user?.id || "",
      neste_steg: "Ta første kontakt",
      notater: "",
      opprettet_dato: today,
      sist_aktivitet: today,
      neste_oppfolging: today,
      konvertert_dato: "",
      konvertert_til: "",
      rolle_i_firma: "",
      use_case: "",
      videresendt_til_partner_id: "",
      videresendt_dato: "",
    };
    updateLeads(current => [...current, lead]);
    setNyLeadOpen(false);
    setNyLead({ firmanavn: "", kontaktperson: "", e_post: "", telefon: "" });
    toast.success("Lead opprettet");
  };

  return (
    <PageShell
      title="Salg"
      subtitle="Fra første kontakt til vunnet kunde"
      actions={
        <div className="flex w-full flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setNyLeadOpen(true)} disabled={!canEdit}><Plus className="h-4 w-4" />Nytt lead</Button>
          <Button size="sm" variant="contrast" onClick={() => navigate("/ringemodus")}><PhoneCall className="h-4 w-4" />Start ringemodus</Button>
        </div>
      }
    >
      <div className="mx-auto max-w-[1800px] space-y-5">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="bento-tile col-span-2 flex min-h-36 flex-col justify-between bg-primary lg:col-span-1"><span className="text-xs font-medium">Aktive løp</span><strong className="text-5xl tabular-nums">{aktive.length}</strong><span className="text-xs">Leads og salgsmuligheter</span></div>
          <button type="button" onClick={() => setKunOppfolging(value => !value)} className="bento-tile flex min-h-36 flex-col items-start justify-between bg-card text-left transition-colors hover:bg-muted"><span className="text-xs text-muted-foreground">Trenger oppfølging</span><strong className="text-4xl tabular-nums">{antallOppfolging}</strong><span className="text-xs text-muted-foreground">Vis disse</span></button>
          <div className="bento-tile flex min-h-36 flex-col justify-between bg-card"><span className="text-xs text-muted-foreground">Møter</span><strong className="text-4xl tabular-nums">{antallMoter}</strong><CalendarDays className="h-4 w-4 text-muted-foreground" /></div>
          <div className="bento-tile flex min-h-36 flex-col justify-between bg-card"><span className="text-xs text-muted-foreground">Tilbud ute</span><strong className="text-4xl tabular-nums">{antallTilbud}</strong><Tag className="h-4 w-4 text-muted-foreground" /></div>
          <div className="bento-tile col-span-2 flex min-h-36 flex-col justify-between bg-contrast text-contrast-foreground lg:col-span-1"><span className="text-xs text-contrast-foreground/70">Pipeline-MRR</span><strong className="text-3xl tabular-nums">{nok(pipelineMrr)}</strong><span className="text-xs text-contrast-foreground/70">Aktive salgsmuligheter</span></div>
        </section>

        <section className="flex flex-wrap items-center gap-2 border-y py-3">
          <div className="relative min-w-[220px] flex-1 lg:max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Søk bedrift, kontakt eller neste steg" className="pl-9" /></div>
          <MineTeametToggle verdi={eierVisning} onEndre={setEierVisning} />
          <Select value={owner} onValueChange={setOwner}><SelectTrigger className="w-[170px]"><SelectValue placeholder="Alle ansvarlige" /></SelectTrigger><SelectContent><SelectItem value="alle">Alle ansvarlige</SelectItem>{profiles.map(profile => <SelectItem key={profile.user_id} value={profile.user_id}>{profile.display_name}</SelectItem>)}</SelectContent></Select>
          <Button variant={kunOppfolging ? "default" : "outline"} size="sm" onClick={() => setKunOppfolging(value => !value)}><PhoneCall className="h-4 w-4" />Oppfølging</Button>
          <div className="ml-auto inline-flex rounded-md border bg-card p-0.5">
            <Button size="icon" variant={visning === "kanban" ? "secondary" : "ghost"} onClick={() => setVisning("kanban")} title="Kanban"><Columns3 className="h-4 w-4" /></Button>
            <Button size="icon" variant={visning === "tabell" ? "secondary" : "ghost"} onClick={() => setVisning("tabell")} title="Tabell"><List className="h-4 w-4" /></Button>
          </div>
        </section>

        {visning === "kanban" ? (
          <div className="overflow-x-auto pb-4">
            <div className="grid min-w-[1500px] grid-cols-6 gap-3">
              {SALGSSTEG.map(steg => {
                const items = synlige.filter(item => item.steg === steg).sort((a, b) => (b.sistAktivitet || "").localeCompare(a.sistAktivitet || ""));
                const total = items.reduce((sum, item) => sum + item.mrr, 0);
                return (
                  <section key={steg} onDragOver={event => event.preventDefault()} onDrop={() => { if (dragged) requestMove(dragged, steg); setDragged(null); }} className="min-h-[420px] rounded-lg border bg-muted/35 p-2">
                    <header className="mb-2 flex min-h-12 items-start justify-between gap-2 px-1 py-1"><div><h2 className="font-display text-sm font-bold">{steg}</h2><p className="mt-0.5 text-[11px] text-muted-foreground">{items.length} {items.length === 1 ? "kort" : "kort"}{total > 0 ? ` · ${nok(total)}` : ""}</p></div><span className="flex h-6 min-w-6 items-center justify-center rounded-sm bg-secondary px-1.5 text-xs font-semibold tabular-nums">{items.length}</span></header>
                    <div className="space-y-2">
                      {items.map(item => (
                        <article key={`${item.kind}-${item.id}`} draggable={canEdit} onDragStart={() => setDragged(item)} onDragEnd={() => setDragged(null)} onClick={() => openCard(item)} className="cursor-pointer rounded-md border bg-card p-3 shadow-sm transition-colors hover:border-primary/60 hover:bg-background">
                          <div className="flex items-start gap-2"><CompanyLogo firmanavn={item.selskap} size="sm" /><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold">{item.selskap}</h3><p className="truncate text-xs text-muted-foreground">{item.kontakt || (item.kind === "lead" ? "Kontakt ikke oppgitt" : "Ingen kontakt")}</p></div>{item.mrr > 0 && <span className="shrink-0 text-xs font-semibold tabular-nums">{nok(item.mrr)}</span>}</div>
                          {item.pinnedNotat && <p className="mt-2 line-clamp-2 rounded-sm bg-primary/25 px-2 py-1.5 text-xs">{item.pinnedNotat}</p>}
                          <div className="mt-3 flex items-center justify-between gap-2"><span className="min-w-0 truncate text-xs text-muted-foreground">{item.nesteSteg || "Mangler neste steg"}</span>{trengerOppfolging(item) && item.steg !== "Avsluttet" && <span className="h-2 w-2 shrink-0 rounded-full bg-warning" title="Trenger oppfølging" />}</div>
                          <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2 text-[11px] text-muted-foreground"><span className="truncate">{ownerName(item.ansvarlig)}</span><span className="shrink-0">{relativTid(item.sistAktivitet)}</span></div>
                          {item.sluttstatus && <Badge variant={item.sluttstatus === "Vunnet" ? "success" : "secondary"} className="mt-2">{item.sluttstatus}</Badge>}
                        </article>
                      ))}
                      {items.length === 0 && <div className="rounded-md border border-dashed px-3 py-8 text-center text-xs text-muted-foreground">Ingen her</div>}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground"><th className="px-4 py-3">Bedrift</th><th className="px-4 py-3">Kontakt</th><th className="px-4 py-3">Steg</th><th className="px-4 py-3">Neste steg</th><th className="px-4 py-3">Ansvarlig</th><th className="px-4 py-3 text-right">MRR</th><th className="w-12" /></tr></thead><tbody className="divide-y">{synlige.map(item => <tr key={`${item.kind}-${item.id}`} className="hover:bg-muted/40"><td className="px-4 py-3 font-medium">{item.selskap}</td><td className="px-4 py-3 text-muted-foreground">{item.kontakt || "—"}</td><td className="px-4 py-3"><Badge variant="outline">{item.steg}</Badge></td><td className="max-w-[260px] truncate px-4 py-3 text-muted-foreground">{item.nesteSteg || "—"}</td><td className="px-4 py-3 text-muted-foreground">{ownerName(item.ansvarlig)}</td><td className="px-4 py-3 text-right tabular-nums">{item.mrr ? nok(item.mrr) : "—"}</td><td className="px-2"><Button variant="ghost" size="icon" onClick={() => openCard(item)} title="Åpne"><ArrowRight className="h-4 w-4" /></Button></td></tr>)}</tbody></table>
          </div>
        )}
      </div>

      <Dialog open={nyLeadOpen} onOpenChange={setNyLeadOpen}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Nytt lead</DialogTitle><DialogDescription>Legg inn det viktigste nå. Resten kan fylles ut på kortet.</DialogDescription></DialogHeader><div className="space-y-3"><Input placeholder="Bedrift" value={nyLead.firmanavn} onChange={event => setNyLead(value => ({ ...value, firmanavn: event.target.value }))} /><Input placeholder="Kontaktperson" value={nyLead.kontaktperson} onChange={event => setNyLead(value => ({ ...value, kontaktperson: event.target.value }))} /><div className="grid gap-3 sm:grid-cols-2"><Input placeholder="E-post" value={nyLead.e_post} onChange={event => setNyLead(value => ({ ...value, e_post: event.target.value }))} /><Input placeholder="Telefon" value={nyLead.telefon} onChange={event => setNyLead(value => ({ ...value, telefon: event.target.value }))} /></div><Button className="w-full" onClick={addLead} disabled={!nyLead.firmanavn.trim() && !nyLead.kontaktperson.trim()}>Opprett lead</Button></div></DialogContent></Dialog>

      <Dialog open={!!konvertering} onOpenChange={open => { if (!open) setKonvertering(null); }}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{konvertering?.kort.kind === "lead" ? `Flytt til ${konvertering.steg}` : "Avslutt salgsløpet"}</DialogTitle><DialogDescription>{konvertering?.kort.kind === "lead" ? "Leadet blir en salgsmulighet. Kontakt, historikk og notater blir med videre." : "Velg om salgsmuligheten ble vunnet eller tapt."}</DialogDescription></DialogHeader>{konvertering?.kort.kind === "lead" ? <div className="space-y-3"><Input value={konverterNavn} onChange={event => setKonverterNavn(event.target.value)} placeholder="Navn på salgsmuligheten" /><Button className="w-full" onClick={() => bekreftFlytting()}>Bekreft og flytt</Button></div> : <div className="grid grid-cols-2 gap-3"><Button variant="outline" onClick={() => bekreftFlytting("Tapt")}>Tapt</Button><Button onClick={() => bekreftFlytting("Vunnet")}>Vunnet</Button></div>}</DialogContent></Dialog>
    </PageShell>
  );
}