import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { Copy, FileText, Loader2, Mail, Plus, RefreshCw, BarChart3, Trash2, UserMinus, UserPlus } from "lucide-react";
import PageShell from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { hentMottakere, type Mottaker } from "@/lib/nyhetsbrev-mottakere";
import { toast } from "sonner";

interface Nyhetsbrev {
  id: string;
  tittel: string;
  emne: string;
  status: string;
  mottaker_antall: number | null;
  aapnet_antall: number;
  klikk_antall: number;
  sendt_dato: string | null;
  planlagt_dato: string | null;
  opprettet_dato: string;
  innhold_html: string | null;
  innhold_json: any;
  preheader: string | null;
  brevo_campaign_id: number | null;
}

const STATUS_STYLE: Record<string, string> = {
  utkast: "bg-muted text-muted-foreground",
  planlagt: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  test: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",

  sendt: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  feilet: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export default function Nyhetsbrev() {
  const navigate = useNavigate();
  const [kampanjer, setKampanjer] = useState<Nyhetsbrev[]>([]);
  const [loading, setLoading] = useState(true);
  const [mottakere, setMottakere] = useState<Mottaker[]>([]);
  const [mottakereLoading, setMottakereLoading] = useState(false);
  const [sok, setSok] = useState("");
  const [rapport, setRapport] = useState<Nyhetsbrev | null>(null);
  const [syncing, setSyncing] = useState(false);

  const lastKampanjer = async () => {
    const { data, error } = await supabase
      .from("nyhetsbrev")
      .select("*")
      .order("opprettet_dato", { ascending: false });
    if (error) toast.error("Kunne ikke laste nyhetsbrev");
    setKampanjer((data as any) || []);
    setLoading(false);
  };

  const lastMottakere = async () => {
    setMottakereLoading(true);
    try {
      setMottakere(await hentMottakere());
    } catch {
      toast.error("Kunne ikke laste mottakere");
    } finally {
      setMottakereLoading(false);
    }
  };

  useEffect(() => {
    lastKampanjer();
    lastMottakere();
  }, []);

  const nyttNyhetsbrev = async () => {
    const { data: userRes } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("nyhetsbrev")
      .insert({
        tittel: "Nytt nyhetsbrev",
        emne: "",
        status: "utkast",
        opprettet_av: userRes.user?.id ?? null,
      })
      .select("id")
      .single();
    if (error || !data) return toast.error("Kunne ikke opprette nyhetsbrev");
    navigate(`/nyhetsbrev/${data.id}/rediger`);
  };

  const dupliser = async (n: Nyhetsbrev) => {
    const { data: userRes } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("nyhetsbrev")
      .insert({
        tittel: `${n.tittel} (kopi)`,
        emne: n.emne,
        preheader: n.preheader,
        innhold_html: n.innhold_html,
        innhold_json: n.innhold_json,
        status: "utkast",
        opprettet_av: userRes.user?.id ?? null,
      })
      .select("id")
      .single();
    if (error || !data) return toast.error("Kunne ikke duplisere");
    toast.success("Duplisert");
    navigate(`/nyhetsbrev/${data.id}/rediger`);
  };

  const slett = async (n: Nyhetsbrev) => {
    const { error } = await supabase.from("nyhetsbrev").delete().eq("id", n.id);
    if (error) return toast.error("Kunne ikke slette");
    toast.success("Slettet");
    lastKampanjer();
  };

  const oppdaterStatistikk = async (n: Nyhetsbrev) => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-nyhetsbrev", {
        body: { action: "sync_stats", nyhetsbrev_id: n.id },
      });
      if (error) throw error;
      toast.success("Statistikk oppdatert");
      await lastKampanjer();
      setRapport({ ...n, ...(data as any) });
    } catch (e: any) {
      toast.error("Kunne ikke hente statistikk fra Brevo");
    } finally {
      setSyncing(false);
    }
  };

  const toggleAvmeldt = async (m: Mottaker) => {
    if (m.avmeldt) {
      await supabase.from("nyhetsbrev_avmeldte").delete().eq("e_post", m.e_post);
      toast.success("Meldt på igjen");
    } else {
      await supabase.from("nyhetsbrev_avmeldte").insert({ e_post: m.e_post });
      toast.success("Markert som avmeldt");
    }
    lastMottakere();
  };

  const filtrerte = useMemo(() => {
    const q = sok.trim().toLowerCase();
    if (!q) return mottakere;
    return mottakere.filter(
      (m) => m.e_post.includes(q) || (m.firmanavn || "").toLowerCase().includes(q)
    );
  }, [mottakere, sok]);

  const aktive = mottakere.filter((m) => !m.avmeldt).length;

  const aapningsrate = (n: Nyhetsbrev) =>
    n.mottaker_antall ? Math.round((n.aapnet_antall / n.mottaker_antall) * 100) : 0;

  return (
    <PageShell
      title="Nyhetsbrev"
      subtitle={`${aktive} aktive mottakere · ${kampanjer.length} kampanjer`}
      actions={
        <Button onClick={nyttNyhetsbrev} size="sm">
          <Plus className="w-4 h-4 mr-1.5" /> Nytt nyhetsbrev
        </Button>
      }
    >
      <Tabs defaultValue="kampanjer">
        <TabsList>
          <TabsTrigger value="kampanjer">Kampanjer</TabsTrigger>
          <TabsTrigger value="mottakere">Mottakere ({mottakere.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="kampanjer" className="mt-4">
          <div className="bg-card border rounded-xl overflow-x-auto">
            {loading ? (
              <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : kampanjer.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground text-sm">
                <Mail className="w-8 h-8 mx-auto mb-2 opacity-40" />
                Ingen nyhetsbrev ennå.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tittel / emne</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Mottakere</TableHead>
                    <TableHead className="text-right">Åpningsrate</TableHead>
                    <TableHead>Sendt</TableHead>
                    <TableHead className="text-right">Handlinger</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kampanjer.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell>
                        <div className="font-medium">{n.tittel}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[280px]">{n.emne || "Uten emne"}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={STATUS_STYLE[n.status] || ""}>{n.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{n.mottaker_antall ?? "–"}</TableCell>
                      <TableCell className="text-right">
                        {n.status === "sendt" ? `${aapningsrate(n)} %` : "–"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {n.sendt_dato
                          ? format(new Date(n.sendt_dato), "d. MMM yyyy HH:mm", { locale: nb })
                          : n.planlagt_dato
                          ? `Planlagt ${format(new Date(n.planlagt_dato), "d. MMM HH:mm", { locale: nb })}`
                          : "–"}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {n.status === "utkast" && (
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/nyhetsbrev/${n.id}/rediger`)}>
                            <FileText className="w-4 h-4 mr-1" /> Rediger
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => dupliser(n)} title="Dupliser">
                          <Copy className="w-4 h-4" />
                        </Button>
                        {n.status === "sendt" && (
                          <Button variant="ghost" size="sm" onClick={() => setRapport(n)} title="Se rapport">
                            <BarChart3 className="w-4 h-4" />
                          </Button>
                        )}
                        {n.status !== "sendt" && (
                          <Button variant="ghost" size="sm" onClick={() => slett(n)} title="Slett">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="mottakere" className="mt-4 space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Søk e-post eller firma…"
              value={sok}
              onChange={(e) => setSok(e.target.value)}
              className="max-w-sm"
            />
            <Button variant="outline" size="icon" onClick={lastMottakere} title="Oppdater">
              <RefreshCw className={`w-4 h-4 ${mottakereLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <div className="bg-card border rounded-xl overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-post</TableHead>
                  <TableHead>Firmanavn</TableHead>
                  <TableHead>Kilde</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrerte.slice(0, 500).map((m) => (
                  <TableRow key={m.e_post}>
                    <TableCell className="font-medium">{m.e_post}</TableCell>
                    <TableCell className="text-muted-foreground">{m.firmanavn || "–"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{m.kilde}</Badge>
                    </TableCell>
                    <TableCell>
                      {m.avmeldt ? (
                        <span className="text-xs text-destructive">Avmeldt</span>
                      ) : (
                        <span className="text-xs text-green-600">Aktiv</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => toggleAvmeldt(m)}>
                        {m.avmeldt ? <UserPlus className="w-4 h-4" /> : <UserMinus className="w-4 h-4" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filtrerte.length > 500 && (
              <p className="p-3 text-xs text-muted-foreground">Viser 500 av {filtrerte.length}</p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!rapport} onOpenChange={(o) => !o && setRapport(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{rapport?.tittel}</DialogTitle>
          </DialogHeader>
          {rapport && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Sendt til</p>
                  <p className="text-xl font-bold">{rapport.mottaker_antall ?? 0}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Åpningsrate</p>
                  <p className="text-xl font-bold">{aapningsrate(rapport)} %</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Klikk</p>
                  <p className="text-xl font-bold">{rapport.klikk_antall}</p>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                disabled={syncing}
                onClick={() => oppdaterStatistikk(rapport)}
              >
                {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Oppdater statistikk
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
