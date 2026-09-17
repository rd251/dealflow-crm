import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, Building2, CircleDollarSign, Handshake, Layers3, PhoneCall, Target, TrendingUp, Users } from "lucide-react";
import { dagerSiden, KANBAN_STADIER, leadStatusFarge, stadiumFarge, tilKanbanStadium } from "@/lib/sales-flow";
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
  return onClick ? (
    <Button variant="outline" onClick={onClick} className="h-auto min-h-24 w-full justify-start gap-3 rounded-lg bg-card p-4 text-left shadow-card hover:bg-card">{content}</Button>
  ) : <div className="flex min-h-24 items-center gap-3 rounded-lg border bg-card p-4 shadow-card">{content}</div>;
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
          <button type="button" onClick={onTitleClick} aria-label={titleLinkLabel || title} className="text-left transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <h2 className="font-display text-base font-semibold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </button>
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
        <section className="relative overflow-hidden rounded-lg border border-primary/20 bg-primary p-6 text-primary-foreground shadow-card sm:p-8">
          <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-primary-foreground/15"><TrendingUp className="h-5 w-5" /></div>
              <p className="text-sm font-medium opacity-80">Aktiv månedlig inntekt</p>
              <h2 data-metric className="mt-1 text-4xl font-semibold sm:text-5xl">{nok(totalMrr)}</h2>
              <p className="mt-2 max-w-xl text-sm opacity-75">Samlet MRR fra {activeCustomers.length} aktive kunder. Kunder i pause eller med churn-risiko er ikke medregnet.</p>
            </div>
            <Button variant="secondary" onClick={() => navigate("/selskaper")} className="self-start bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25 sm:self-auto">
              Se kunder <ArrowUpRight className="h-4 w-4" />
            </Button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <MetricCard label="ARR" value={nok(totalMrr * 12)} icon={CircleDollarSign} accent="success" onClick={() => navigate("/selskaper")} />
          <MetricCard label="Snitt-MRR" value={nok(averageMrr)} icon={TrendingUp} accent="success" onClick={() => navigate("/selskaper")} />
          <MetricCard label="Aktive kunder" value={activeCustomers.length} icon={Building2} accent="success" onClick={() => navigate("/selskaper")} />
          <MetricCard label="Churn-risiko" value={nok(riskMrr)} icon={Layers3} accent="warning" onClick={() => navigate("/selskaper")} />
          <MetricCard label="I dialog" value={inDialogCompanyIds.size} icon={Users} accent="pipeline" onClick={() => navigate("/salgsmuligheter")} />
          <MetricCard label="Partnere" value={partnere.length} icon={Handshake} accent="partner" onClick={() => navigate("/partnere")} />
        </section>

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
                  <button key={company.id} onClick={() => navigate(`/selskaper/${company.id}`)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3 px-5 py-4 text-left transition-colors hover:bg-muted/50">
                    <span className="flex min-w-0 items-center gap-3">
                      <CompanyLogo domain={company.domene} firmanavn={company.firmanavn} size="sm" />
                      <span className="min-w-0"><span className="block truncate text-sm font-medium">{company.firmanavn}</span><span className="block truncate text-xs text-muted-foreground">{company.bransje || "Bransje ikke registrert"}</span></span>
                    </span>
                    <span data-metric className="self-center text-sm font-semibold text-success">{nok(company.mrr)}</span>
                    <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-success/10"><span className="portfolio-bar block h-full rounded-full bg-success" style={{ width: `${Math.max(2, (company.mrr / maxMrr) * 100)}%` }} /></span>
                  </button>
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
                <button key={partner.id} onClick={() => navigate(`/partnere/${partner.id}`)} className="flex items-center justify-between gap-4 bg-card p-5 text-left transition-colors hover:bg-partner/5">
                  <span className="min-w-0"><span className="block truncate font-medium">{partner.partnernavn}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{partner.partnertype}</span></span>
                  <Badge variant="partner">{partner.partnerstatus}</Badge>
                </button>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </PageShell>
  );
}