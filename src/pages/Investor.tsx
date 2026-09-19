import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { nok } from "@/lib/utils";
import { Loader2, LogOut, TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Noekkeltall {
  total_mrr: number;
  total_arr: number;
  antall_aktive: number;
  antall_pause: number;
  antall_churn_12m: number;
  partner_mrr: number;
}

interface PortefoljeRad {
  id: string;
  firmanavn: string;
  bransje: string | null;
  status: string;
  mrr: number;
  kunde_siden: string | null;
}

interface TrendRad {
  mnd: string;
  mrr: number;
  ny_mrr: number;
  churn_mrr: number;
}

const MANEDER = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];

function mndEtikett(dato: string): string {
  const d = new Date(dato);
  if (isNaN(d.getTime())) return dato;
  return `${MANEDER[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

function datoKort(dato: string | null): string {
  if (!dato) return "–";
  const d = new Date(dato);
  if (isNaN(d.getTime())) return "–";
  return d.toLocaleDateString("no-NO", { month: "short", year: "numeric" });
}

function andel(del: number, helhet: number): string {
  if (!helhet) return "0 %";
  return `${Math.round((del / helhet) * 100)} %`;
}

export default function Investor() {
  const { user } = useAuth();
  const [laster, setLaster] = useState(true);
  const [noekkeltall, setNoekkeltall] = useState<Noekkeltall | null>(null);
  const [portefolje, setPortefolje] = useState<PortefoljeRad[]>([]);
  const [trend, setTrend] = useState<TrendRad[]>([]);

  useEffect(() => {
    (async () => {
      const [n, p, t] = await Promise.all([
        supabase.from("investor_noekkeltall").select("*").maybeSingle(),
        supabase.from("investor_portefolje").select("*"),
        supabase.from("investor_mrr_trend").select("*").order("mnd"),
      ]);
      setNoekkeltall((n.data as unknown as Noekkeltall) ?? null);
      setPortefolje(((p.data as unknown as PortefoljeRad[]) ?? []).sort((a, b) => Number(b.mrr) - Number(a.mrr)));
      setTrend(((t.data as unknown as TrendRad[]) ?? []).map((r) => ({
        ...r,
        mrr: Number(r.mrr),
        ny_mrr: Number(r.ny_mrr),
        churn_mrr: Number(r.churn_mrr),
      })));
      setLaster(false);
    })();
  }, []);

  const totalMrr = Number(noekkeltall?.total_mrr ?? 0);

  const konsentrasjon = useMemo(() => {
    const aktive = portefolje.filter((r) => r.status === "Aktiv").map((r) => Number(r.mrr)).sort((a, b) => b - a);
    const sum = (n: number) => aktive.slice(0, n).reduce((a, b) => a + b, 0);
    return [
      { etikett: "Største kunde", verdi: sum(1) },
      { etikett: "Topp 3", verdi: sum(3) },
      { etikett: "Topp 5", verdi: sum(5) },
    ];
  }, [portefolje]);

  const sisteMnd = trend.at(-1);
  const nettoNy = (sisteMnd?.ny_mrr ?? 0) - (sisteMnd?.churn_mrr ?? 0);

  const trendData = trend.map((r) => ({ ...r, navn: mndEtikett(r.mnd) }));

  if (laster) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Snakk</p>
            <h1 className="text-xl font-semibold">Investoroversikt</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user?.email}</span>
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => supabase.auth.signOut()}>
              <LogOut className="h-4 w-4" /> Logg ut
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-8">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>MRR</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{nok(Math.round(totalMrr))}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>ARR</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{nok(Math.round(Number(noekkeltall?.total_arr ?? 0)))}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Aktive kunder</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{noekkeltall?.antall_aktive ?? 0}</p>
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">{noekkeltall?.antall_pause ?? 0} på pause</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Netto ny MRR (siste måned)</CardDescription>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-semibold tabular-nums ${nettoNy < 0 ? "text-destructive" : "text-success"}`}>
                {nettoNy >= 0 ? "+" : ""}{nok(Math.round(nettoNy))}
              </p>
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                {nok(Math.round(sisteMnd?.churn_mrr ?? 0))} churn
              </p>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" /> MRR-utvikling
            </CardTitle>
            <CardDescription>Siste 12 måneder</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trendData} margin={{ left: 8, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="navn" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} width={70}
                  tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v: number) => nok(Math.round(v))} labelClassName="text-foreground" />
                <Area type="monotone" dataKey="mrr" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.12)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Inntektskonsentrasjon</CardTitle>
              <CardDescription>Andel av samlet MRR fra de største kundene</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {konsentrasjon.map((k) => (
                <div key={k.etikett} className="space-y-1.5">
                  <div className="flex items-baseline justify-between text-sm">
                    <span>{k.etikett}</span>
                    <span className="font-medium tabular-nums">{andel(k.verdi, totalMrr)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: totalMrr ? `${Math.min(100, (k.verdi / totalMrr) * 100)}%` : "0%" }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums">{nok(Math.round(k.verdi))} av {nok(Math.round(totalMrr))}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Partnerinntekt</CardTitle>
              <CardDescription>Samlet månedlig inntekt fra kunder som kommer via partner</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-2xl font-semibold tabular-nums">{nok(Math.round(Number(noekkeltall?.partner_mrr ?? 0)))}</p>
              <p className="text-sm text-muted-foreground tabular-nums">
                {andel(Number(noekkeltall?.partner_mrr ?? 0), totalMrr)} av samlet MRR
              </p>
              <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                Churn siste 12 måneder: <span className="tabular-nums font-medium text-foreground">{noekkeltall?.antall_churn_12m ?? 0}</span> kunder
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kundeportefølje</CardTitle>
            <CardDescription>{portefolje.length} kunder</CardDescription>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Selskap</TableHead>
                  <TableHead>Bransje</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">MRR</TableHead>
                  <TableHead className="text-right">Kunde siden</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {portefolje.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.firmanavn}</TableCell>
                    <TableCell className="text-muted-foreground">{r.bransje || "–"}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "Aktiv" ? "default" : "secondary"}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{nok(Math.round(Number(r.mrr)))}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{datoKort(r.kunde_siden)}</TableCell>
                  </TableRow>
                ))}
                {portefolje.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      Ingen kunder å vise ennå.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <p className="pb-8 text-xs text-muted-foreground">
          Tallene oppdateres direkte fra Snakks kundebase. Visningen er skrivebeskyttet og inneholder ingen kundedialog.
        </p>
      </main>
    </div>
  );
}
