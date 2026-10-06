import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, Building2, CircleDollarSign, Handshake, HeartHandshake, Layers3, PhoneCall, Target, TrendingUp, Users } from "lucide-react";
import { dagerSiden, KANBAN_STADIER, leadStatusFarge, stadiumFarge, tilKanbanStadium } from "@/lib/sales-flow";
import { RELASJON_KALD_DAGER, RELASJON_LUNKEN_DAGER, relasjonTilstand } from "@/lib/relationship";
import type { LeadStatus } from "@/data/crm-data";
import PageShell from "@/components/PageShell";
import CompanyLogo from "@/components/CompanyLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCrmStore } from "@/hooks/use-crm-store";
import { nok } from "@/lib/utils";

type Accent = "success" | "warning" | "pipeline" | "partner";

const accentStyles: Record<Accent, { icon: string; value: string }> = {
  success: { icon: "bg-success/10 text-success", value: "text-success" },
  warning: { icon: "bg-warning/10 text-warning", value: "text-warning" },
  pipeline: { icon: "bg-pipeline/10 text-pipeline", value: "text-pipeline" },
  partner: { icon: "bg-partner/10 text-partner", value: "text-partner" },
};

function MetricCard({ label, value, icon: Icon, accent = "pipeline", onClick }: {
  label: string;
  value: string | number;
  icon: typeof Building2;
  accent?: Accent;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className={`flex h-9 w-9 items-center justify-center rounded-md ${accentStyles[accent].icon}`}><Icon className="h-4 w-4" /></span>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-muted-foreground">{label}</span>
        <span data-metric className={`mt-1 block truncate text-xl font-semibold ${accentStyles[accent].value}`}>{value}</span>
      </span>
    </>
  );
  const erNull = value === 0 || value === "0" || (typeof value === "string" && /^0(\D|$)/.test(value.replace(/\s/g, "")));
  return onClick && !erNull ? (
    <Button variant="outline" onClick={onClick} className="h-auto min-h-24 w-full justify-start gap-3 rounded-lg bg-card p-4 text-left shadow-card hover:bg-card">{content}</Button>
  ) : <div className={`flex min-h-24 items-center gap-3 rounded-lg border bg-card p-4 shadow-card ${erNull ? "opacity-60" : ""}`}>{content}</div>;
}

function Panel({ title, subtitle, children, accent = "pipeline", onTitleClick, titleLinkLabel }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  accent?: Accent;
  onTitleClick?: () => void;
  titleLinkLabel?: string;
}) {
  return (
    <section className="overflow-hidden rounded-lg border bg-card shadow-card">
      <header className={`border-b px-5 py-4 ${accent === "partner" ? "bg-partner/5" : "bg-card"}`}>
        {onTitleClick ? (
          <Button variant="ghost" type="button" onClick={onTitleClick} aria-label={titleLinkLabel || title} className="h-auto flex-col items-start gap-0 p-0 text-left hover:bg-transparent hover:text-foreground whitespace-normal">
            <h2 className="font-display text-base font-semibold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </Button>
        ) : (
          <>
            <h2 className="font-display text-base font-semibold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </>
        )}
      </header>
      {children}
    </section>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { selskaper, salgsmuligheter, partnere, leads } = useCrmStore();

  const churnRisk = useMemo(() => selskaper.filter(company =>
    company.kundestatus === "Pause" || company.kundetilstand === "Risiko"
  ), [selskaper]);
  const churnRiskIds = useMemo(() => new Set(churnRisk.map(company => company.id)), [churnRisk]);
  const activeCustomers = useMemo(() => selskaper
    .filter(company => company.kundestatus === "Live" && !churnRiskIds.has(company.id))
    .sort((a, b) => b.mrr - a.mrr), [selskaper, churnRiskIds]);
  const openDeals = useMemo(() => salgsmuligheter.filter(deal => deal.status !== "Vunnet" && deal.status !== "Tapt"), [salgsmuligheter]);
  const aktiveLeads = useMemo(() => leads.filter(l => l.status !== "Ikke aktuelt" && l.status !== "Konvertert til salg" && l.status !== "Konvertert til partner"), [leads]);
  const leadsPerStatus = useMemo(() => {
    const order: LeadStatus[] = ["Ny", "Kontaktet", "Svarte ikke telefon", "Kvalifisert"];
    return order.map(status => ({ status, antall: aktiveLeads.filter(l => l.status === status).length })).filter(r => r.antall > 0);
  }, [aktiveLeads]);
  const leadsTrengerOppfoelging = useMemo(() => aktiveLeads.filter(l => {
    const d = dagerSiden(l.sist_aktivitet);
    return d === null || d >= 3;
  }).length, [aktiveLeads]);
  const stageStats = useMemo(() => KANBAN_STADIER.filter(s => s !== "Vunnet" && s !== "Tapt").map(stage => {
    const deals = openDeals.filter(d => tilKanbanStadium(d.status) === stage);
    return { stage, antall: deals.length, mrr: deals.reduce((sum, d) => sum + (d.forventet_mrr || 0), 0) };
  }), [openDeals]);
  const kaldeDeals = useMemo(() => openDeals.filter(d => {
    const dager = dagerSiden(d.sist_aktivitet);
    return dager === null || dager >= 7;
  }).length, [openDeals]);
  const totalPipelineMrr = openDeals.reduce((sum, d) => sum + (d.forventet_mrr || 0), 0);
  const relasjoner = useMemo(() => {
    const kunder = selskaper.filter(s => s.kundestatus === "Live" || s.kundestatus === "Pilot").map(s => s.sist_aktivitet);
    const parts = partnere.filter(p => p.partnerstatus === "Aktiv" || p.partnerstatus === "Under onboarding").map(p => p.sist_aktivitet);
    const alle = [...kunder, ...parts].map(relasjonTilstand);
    return {
      lunkne: alle.filter(t => t === "lunken").length,
      forsomte: alle.filter(t => t === "forsomt" || t === "ukjent").length,
    };
  }, [selskaper, partnere]);
  const inDialogCompanyIds = useMemo(() => new Set(openDeals.map(deal => deal.selskap_id).filter(Boolean)), [openDeals]);
  const totalMrr = activeCustomers.reduce((sum, company) => sum + company.mrr, 0);
  const riskMrr = churnRisk.reduce((sum, company) => sum + company.mrr, 0);
  const averageMrr = activeCustomers.length ? Math.round(totalMrr / activeCustomers.length) : 0;
  const maxMrr = activeCustomers[0]?.mrr || 1;

  const tiers = [
    { label: "Under 5 000 kr", min: 0, max: 4999 },
    { label: "5 000–9 999 kr", min: 5000, max: 9999 },
    { label: "10 000–19 999 kr", min: 10000, max: 19999 },
    { label: "20 000 kr eller mer", min: 20000, max: Number.POSITIVE_INFINITY },
  ].map(tier => {
    const customers = activeCustomers.filter(company => company.mrr >= tier.min && company.mrr <= tier.max);
    return { ...tier, count: customers.length, mrr: customers.reduce((sum, company) => sum + company.mrr, 0) };
  });

  return (
    <PageShell title="Porteføljeoversikt" subtitle="Kunder, inntekter og partneravtaler">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4 xl:grid-cols-6 bento-enter">
          <div className="bento-tile flex min-h-64 flex-col justify-between bg-card md:col-span-4 xl:col-span-4 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <span className="bg-primary px-3 py-1 text-xs font-bold text-primary-foreground rounded-sm">Årlig abonnementsinntekt · ARR</span>
              <Button variant="outline" size="icon" onClick={() => navigate("/selskaper")} title="Se kunder" aria-label="Se kunder"><ArrowUpRight /></Button>
            </div>
            <div className="mt-10">
              <p data-metric className="text-4xl font-bold leading-none sm:text-6xl lg:text-7xl break-words">{nok(totalMrr * 12)}</p>
              <p className="mt-4 text-sm text-muted-foreground">Årlig verdi fra {activeCustomers.length} aktive kunder</p>
            </div>
          </div>
          <div className="bento-tile flex min-h-64 flex-col justify-between border-contrast bg-contrast text-contrast-foreground md:col-span-2 xl:col-span-2 sm:p-8">
            <div>
              <p className="text-xs font-medium text-contrast-foreground/70">Aktiv månedlig inntekt</p>
              <h2 className="mt-3 text-2xl font-semibold leading-tight">Løpende abonnementsinntekter</h2>
            </div>
            <div className="mt-8">
              <p data-metric className="text-4xl font-bold break-words">{nok(totalMrr)}</p>
              <div className="mt-4 h-1 bg-primary" />
              <p className="mt-3 text-xs text-contrast-foreground/70">Pause og churn-risiko er ikke medregnet</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate("/selskaper")} className="bento-tile h-auto min-h-44 flex-col items-start justify-between bg-card text-left whitespace-normal md:col-span-2 xl:col-span-1">
            <span className="text-xs text-muted-foreground">Aktive kunder</span>
            <span data-metric className="text-5xl font-bold">{activeCustomers.length}</span>
            <span className="text-xs text-muted-foreground">Live</span>
          </Button>
          <Button variant="outline" onClick={() => navigate("/leads")} className="bento-tile h-auto min-h-44 flex-col items-start justify-between bg-card text-left whitespace-normal md:col-span-2 xl:col-span-1">
            <span className="text-xs text-muted-foreground">Leads</span>
            <span data-metric className="text-5xl font-bold">{aktiveLeads.length}</span>
            <span className="text-xs text-muted-foreground">Aktive leads</span>
          </Button>
          <div className="bento-tile flex min-h-44 flex-col justify-between border-primary bg-primary text-primary-foreground md:col-span-2 xl:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium">Trenger oppfølging</p>
                <p data-metric className="mt-3 text-6xl font-bold">{leadsTrengerOppfoelging}</p>
              </div>
              <PhoneCall className="h-7 w-7 shrink-0" />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button variant="contrast" size="sm" onClick={() => navigate("/ringemodus")}>Start ringemodus <ArrowUpRight /></Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/leads?filter=oppfolging")}>Se leads</Button>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate("/salgsmuligheter")} className="bento-tile h-auto min-h-44 flex-col items-start justify-between bg-card text-left whitespace-normal md:col-span-2 xl:col-span-2">
            <span className="text-xs text-muted-foreground">Forventet månedlig inntekt</span>
            <span data-metric className="text-3xl font-bold sm:text-4xl break-words">{nok(totalPipelineMrr)}</span>
            <span className="text-xs text-muted-foreground">Åpne salgsmuligheter</span>
          </Button>
          <Button variant="secondary" onClick={() => navigate("/salgsmuligheter")} className="bento-tile h-auto min-h-40 flex-col items-start justify-between bg-secondary text-left md:col-span-2 xl:col-span-2">
            <span className="text-xs text-secondary-foreground/70">Salgsmuligheter i prosess</span>
            <span className="flex items-baseline gap-3"><span data-metric className="text-6xl font-bold">{openDeals.length}</span><span className="text-sm">Åpne</span></span>
            <span className="flex items-center gap-2 text-xs">Se salgsmuligheter <ArrowUpRight className="h-3 w-3" /></span>
          </Button>
          <div className="bento-tile grid grid-cols-2 gap-5 bg-card md:col-span-2 xl:col-span-4">
            <div><p className="text-xs text-muted-foreground">Snitt-MRR</p><p data-metric className="mt-2 text-2xl font-bold">{nok(averageMrr)}</p></div>
            <div><p className="text-xs text-muted-foreground">Churn-risiko</p><p data-metric className="mt-2 text-2xl font-bold text-warning">{nok(riskMrr)}</p></div>
            <Button variant="link" onClick={() => navigate(`/relasjoner?filter=lunken`)} className="h-auto justify-start p-0 text-left whitespace-normal text-xs">{relasjoner.lunkne} uten kontakt på {RELASJON_LUNKEN_DAGER}+ dager <ArrowUpRight /></Button>
            <Button variant="link" onClick={() => navigate(`/relasjoner?filter=forsomt`)} className="h-auto justify-start p-0 text-left whitespace-normal text-xs">{relasjoner.forsomte} forsømte relasjoner <ArrowUpRight /></Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel
            title="Leads"
            subtitle={`${aktiveLeads.length} aktive · ${leadsTrengerOppfoelging} trenger oppfølging`}
            accent="pipeline"
            onTitleClick={aktiveLeads.length > 0 ? () => navigate("/leads") : undefined}
            titleLinkLabel="Se alle aktive leads"
          >
            <div className="divide-y">
              {leadsPerStatus.map(rad => (
                <Link
                  key={rad.status}
                  to={`/leads?status=${encodeURIComponent(rad.status)}`}
                  className="flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-muted/50 active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <Badge variant="outline" className={leadStatusFarge[rad.status]}>{rad.status}</Badge>
                  <span data-metric className="font-semibold">{rad.antall}</span>
                </Link>
              ))}
              {leadsPerStatus.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Ingen aktive leads.</p>}
            </div>
            {leadsTrengerOppfoelging > 0 ? (
              <Link to="/leads?filter=oppfolging" className="flex w-full items-center justify-between border-t bg-warning/5 px-5 py-4 text-left transition-colors hover:bg-warning/10 active:bg-warning/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                <span className="flex items-center gap-2.5 text-sm font-medium text-warning"><PhoneCall className="h-4 w-4" />Trenger oppfølging (3+ dager)</span>
                <span data-metric className="font-semibold text-warning">{leadsTrengerOppfoelging}</span>
              </Link>
            ) : null}
          </Panel>

          <Panel
            title="Salgsmuligheter"
            subtitle={`${openDeals.length} åpne · ${nok(totalPipelineMrr)} forventet MRR`}
            accent="pipeline"
            onTitleClick={openDeals.length > 0 ? () => navigate("/salgsmuligheter") : undefined}
            titleLinkLabel="Se alle åpne salgsmuligheter"
          >
            <div className="divide-y">
              {stageStats.map(rad => rad.antall > 0 ? (
                <Link
                  key={rad.stage}
                  to={`/salgsmuligheter?stadium=${encodeURIComponent(rad.stage)}`}
                  className="flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left transition-colors hover:bg-muted/50 active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Badge variant="outline" className={stadiumFarge[rad.stage]}>{rad.stage}</Badge>
                  </span>
                  <span className="flex shrink-0 items-baseline gap-3">
                    <span className="text-xs text-muted-foreground">{nok(rad.mrr)}</span>
                    <span data-metric className="font-semibold">{rad.antall}</span>
                  </span>
                </Link>
              ) : (
                <div key={rad.stage} className="flex w-full items-center justify-between gap-4 px-5 py-3.5 text-muted-foreground">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Badge variant="outline" className={stadiumFarge[rad.stage]}>{rad.stage}</Badge>
                  </span>
                  <span className="flex shrink-0 items-baseline gap-3">
                    <span className="text-xs text-muted-foreground">{nok(rad.mrr)}</span>
                    <span data-metric className="font-semibold">{rad.antall}</span>
                  </span>
                </div>
              ))}
            </div>
            {kaldeDeals > 0 ? (
              <Link to="/salgsmuligheter?filter=kalde" className="flex w-full items-center justify-between border-t bg-destructive/5 px-5 py-4 text-left transition-colors hover:bg-destructive/10 active:bg-destructive/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                <span className="flex items-center gap-2.5 text-sm font-medium text-destructive"><Target className="h-4 w-4" />Kalde deals (7+ dager uten aktivitet)</span>
                <span data-metric className="font-semibold text-destructive">{kaldeDeals}</span>
              </Link>
            ) : null}
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
          <Panel title="MRR per kunde" subtitle="Aktive kunder, høyeste MRR først" accent="success">
            {activeCustomers.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">Ingen aktive kunder.</p> : (
              <div className="divide-y">
                {activeCustomers.map(company => (
                  <Button variant="ghost" key={company.id} onClick={() => navigate(`/selskaper/${company.id}`)} className="grid h-auto rounded-none w-full grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3 px-5 py-4 text-left transition-colors hover:bg-muted/50">
                    <span className="flex min-w-0 items-center gap-3">
                      <CompanyLogo domain={company.domene} firmanavn={company.firmanavn} size="sm" />
                      <span className="min-w-0"><span className="block truncate text-sm font-medium">{company.firmanavn}</span><span className="block truncate text-xs text-muted-foreground">{company.bransje || "Bransje ikke registrert"}</span></span>
                    </span>
                    <span data-metric className="self-center text-sm font-semibold text-foreground">{nok(company.mrr)}</span>
                    <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-secondary"><span className="portfolio-bar block h-full rounded-full bg-contrast" style={{ width: `${Math.max(2, (company.mrr / maxMrr) * 100)}%` }} /></span>
                  </Button>
                ))}
              </div>
            )}
          </Panel>

          <div className="space-y-6">
            <Panel title="Status" subtitle="Fordeling i porteføljen">
              <div className="divide-y">
                <div className="flex items-center justify-between px-5 py-4"><Badge variant="success">Aktive</Badge><span data-metric className="font-semibold">{activeCustomers.length}</span></div>
                <div className="flex items-center justify-between px-5 py-4"><Badge variant="warning">Churn-risiko</Badge><span data-metric className="font-semibold">{churnRisk.length}</span></div>
                <div className="flex items-center justify-between px-5 py-4"><Badge variant="pipeline">I dialog</Badge><span data-metric className="font-semibold">{inDialogCompanyIds.size}</span></div>
              </div>
            </Panel>

            <Panel title="MRR-nivå" subtitle="Aktive kunder gruppert etter månedsverdi" accent="success">
              <div className="divide-y">
                {tiers.map(tier => (
                  <div key={tier.label} className="flex items-center justify-between gap-4 px-5 py-3.5">
                    <span><span className="block text-sm font-medium">{tier.label}</span><span className="text-xs text-muted-foreground">{tier.count} {tier.count === 1 ? "kunde" : "kunder"}</span></span>
                    <span data-metric className="text-sm font-semibold text-success">{nok(tier.mrr)}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>

        <Panel title="Partneravtaler" subtitle="Holdt adskilt fra kundeporteføljen" accent="partner">
          {partnere.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">Ingen partneravtaler registrert.</p> : (
            <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-3">
              {partnere.map(partner => (
                <Button variant="ghost" key={partner.id} onClick={() => navigate(`/partnere/${partner.id}`)} className="flex h-auto rounded-none items-center justify-between gap-4 bg-card p-5 text-left transition-colors hover:bg-partner/5">
                  <span className="min-w-0"><span className="block truncate font-medium">{partner.partnernavn}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{partner.partnertype}</span></span>
                  <Badge variant="partner">{partner.partnerstatus}</Badge>
                </Button>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </PageShell>
  );
}