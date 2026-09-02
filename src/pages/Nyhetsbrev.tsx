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
  brevo_status: string | null;
  brevo_stats: any;
  brevo_synk_dato: string | null;
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

  const synkAlleBrevo = async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke("send-nyhetsbrev", {
        body: { action: "sync_stats" },
      });
      if (error) throw error;
      toast.success("Brevo-data synkronisert");
      await lastKampanjer();
    } catch {
      toast.error("Kunne ikke synkronisere fra Brevo");
    } finally {
      setSyncing(false);
    }
  };

  const [brevoSetupLaster, setBrevoSetupLaster] = useState(false);
  const synkTilBrevo = async () => {
    setBrevoSetupLaster(true);
    try {
      const { data, error } = await supabase.functions.invoke("brevo-setup", {});
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const res = data as { antall_importert: number; liste_id: number };
      toast.success(
        `${res.antall_importert} kontakter importert til Brevo-liste #${res.liste_id}`
      );
    } catch (e: any) {
      toast.error(e?.message || "Kunne ikke synkronisere til Brevo");
    } finally {
      setBrevoSetupLaster(false);
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

  const brevoKampanjer = useMemo(
    () => kampanjer.filter((n) => !!n.brevo_campaign_id),
    [kampanjer]
  );

  const sisteSynk = useMemo(() => {
    const datoer = brevoKampanjer
      .map((n) => n.brevo_synk_dato)
      .filter(Boolean) as string[];
    if (!datoer.length) return null;
    return datoer.sort().slice(-1)[0];
  }, [brevoKampanjer]);


  const aapningsrate = (n: Nyhetsbrev) =>
    n.mottaker_antall ? Math.round((n.aapnet_antall / n.mottaker_antall) * 100) : 0;

  return (
    <PageShell
      title="Nyhetsbrev"
      subtitle={`${aktive} aktive mottakere · ${kampanjer.length} kampanjer`}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={brevoSetupLaster} onClick={synkTilBrevo}>
            {brevoSetupLaster ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-1.5" />
            )}
            Synk til Brevo
          </Button>
          <Button onClick={nyttNyhetsbrev} size="sm">
            <Plus className="w-4 h-4 mr-1.5" /> Nytt nyhetsbrev
          </Button>
        </div>
      }
    >
      <Tabs defaultValue="kampanjer">
        <TabsList>
          <TabsTrigger value="kampanjer">Kampanjer</TabsTrigger>
          <TabsTrigger value="mottakere">Mottakere ({mottakere.length})</TabsTrigger>
          <TabsTrigger value="brevo">Brevo ({brevoKampanjer.length})</TabsTrigger>

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
                        {(n.status === "utkast" || n.status === "test") && (
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

        <TabsContent value="brevo" className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs text-muted-foreground">
              Lagrede Brevo-data{" "}
              {sisteSynk
                ? `· sist synkronisert ${format(new Date(sisteSynk), "d. MMM yyyy HH:mm", { locale: nb })}`
                : "· aldri synkronisert"}
            </p>
            <Button variant="outline" size="sm" disabled={syncing} onClick={synkAlleBrevo}>
              {syncing ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-1.5" />
              )}
              Synkroniser fra Brevo
            </Button>
          </div>

          <div className="bg-card border rounded-xl overflow-x-auto">
            {brevoKampanjer.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground text-sm">
                <Mail className="w-8 h-8 mx-auto mb-2 opacity-40" />
                Ingen kampanjer er opprettet i Brevo ennå.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kampanje-ID</TableHead>
                    <TableHead>Tittel</TableHead>
                    <TableHead>Brevo-status</TableHead>
                    <TableHead className="text-right">Levert</TableHead>
                    <TableHead className="text-right">Unike åpninger</TableHead>
                    <TableHead className="text-right">Klikk (unike)</TableHead>
                    <TableHead className="text-right">Klikkrate</TableHead>
                    <TableHead className="text-right">Bounce / avmeldt</TableHead>
                    <TableHead>Synket</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brevoKampanjer.map((n) => {
                    const s = (n.brevo_stats || {}) as any;
                    const levert = s.levert ?? n.mottaker_antall ?? 0;
                    const unikeKlikk = s.unike_klikk ?? n.klikk_antall ?? 0;
                    const klikkrate = levert ? Math.round((unikeKlikk / levert) * 100) : 0;
                    const bounces = (s.harde_bounces ?? 0) + (s.myke_bounces ?? 0);
                    return (
                      <TableRow key={n.id}>
                        <TableCell className="font-mono text-xs">#{n.brevo_campaign_id}</TableCell>
                        <TableCell>
                          <div className="font-medium">{n.tittel}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[220px]">
                            {n.emne || "Uten emne"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={STATUS_STYLE[n.status] || ""}>
                            {n.brevo_status || n.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{levert}</TableCell>
                        <TableCell className="text-right">{s.unike_aapninger ?? n.aapnet_antall ?? 0}</TableCell>
                        <TableCell className="text-right">{unikeKlikk}</TableCell>
                        <TableCell className="text-right">{klikkrate} %</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {bounces} / {s.avmeldinger ?? 0}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {n.brevo_synk_dato
                            ? format(new Date(n.brevo_synk_dato), "d. MMM HH:mm", { locale: nb })
                            : "–"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
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
