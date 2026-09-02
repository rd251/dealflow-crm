import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowDown, ArrowUp, Loader2, Plus, Save, Send, Sparkles, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { BLOKK_LABELS, nyBlokk, renderNewsletterHtml, type Blokk, type BlokkType } from "@/lib/nyhetsbrev";
import { hentMottakere } from "@/lib/nyhetsbrev-mottakere";
import { toast } from "sonner";


export default function NyhetsbrevEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [lagrer, setLagrer] = useState(false);
  const [tittel, setTittel] = useState("");
  const [emne, setEmne] = useState("");
  const [preheader, setPreheader] = useState("");
  const [planlagt, setPlanlagt] = useState("");
  const [status, setStatus] = useState("utkast");
  const [blokker, setBlokker] = useState<Blokk[]>([]);

  const [sendDialog, setSendDialog] = useState(false);
  const [steg, setSteg] = useState<1 | 2>(1);
  const [antall, setAntall] = useState<number | null>(null);
  const [sender, setSender] = useState(false);
  const [testSender, setTestSender] = useState(false);

  const [aiOpen, setAiOpen] = useState(false);
  const [aiBrief, setAiBrief] = useState("");
  const [aiTone, setAiTone] = useState("Profesjonell og vennlig");
  const [aiLengde, setAiLengde] = useState("medium");
  const [aiCrm, setAiCrm] = useState(false);
  const [aiByggVidere, setAiByggVidere] = useState(false);
  const [aiLaster, setAiLaster] = useState(false);

  const byggMedAi = async () => {
    if (!aiBrief.trim() && !aiCrm) {
      toast.error("Beskriv hva nyhetsbrevet skal handle om");
      return;
    }
    setAiLaster(true);
    try {
      const { data, error } = await supabase.functions.invoke("nyhetsbrev-ai", {
        body: {
          brief: aiBrief,
          tone: aiTone,
          lengde: aiLengde,
          bruk_crm: aiCrm,
          eksisterende_blokker: aiByggVidere ? blokker : undefined,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const res = data as { emne?: string; preheader?: string; blokker: Blokk[] };
      if (!res.blokker?.length) throw new Error("Tomt svar fra AI");
      setBlokker(res.blokker);
      if (res.emne) setEmne(res.emne);
      if (res.preheader) setPreheader(res.preheader);
      setAiOpen(false);
      toast.success("Utkast generert – husk å lagre");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Klarte ikke generere nyhetsbrev");
    } finally {
      setAiLaster(false);
    }
  };


  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("nyhetsbrev").select("*").eq("id", id).maybeSingle();
      if (error || !data) {
        toast.error("Fant ikke nyhetsbrevet");
        navigate("/nyhetsbrev");
        return;
      }
      setTittel(data.tittel);
      setEmne(data.emne || "");
      setPreheader((data as any).preheader || "");
      setStatus(data.status);
      setPlanlagt(data.planlagt_dato ? new Date(data.planlagt_dato).toISOString().slice(0, 16) : "");
      const json = data.innhold_json as any;
      setBlokker(Array.isArray(json?.blokker) ? json.blokker : [nyBlokk("header"), nyBlokk("tekst")]);
      setLoading(false);
    })();
  }, [id, navigate]);

  const html = useMemo(() => renderNewsletterHtml(blokker, preheader), [blokker, preheader]);

  const lagre = async (stille = false) => {
    setLagrer(true);
    const { error } = await supabase
      .from("nyhetsbrev")
      .update({
        tittel,
        emne,
        preheader,
        innhold_json: { blokker } as any,
        innhold_html: html,
        planlagt_dato: planlagt ? new Date(planlagt).toISOString() : null,
      })
      .eq("id", id);
    setLagrer(false);
    if (error) {
      toast.error("Kunne ikke lagre");
      return false;
    }
    if (!stille) toast.success("Lagret");
    return true;
  };

  const oppdater = (bid: string, patch: Partial<Blokk>) =>
    setBlokker((bs) => bs.map((b) => (b.id === bid ? { ...b, ...patch } : b)));

  const flytt = (index: number, retning: -1 | 1) =>
    setBlokker((bs) => {
      const ny = [...bs];
      const mål = index + retning;
      if (mål < 0 || mål >= ny.length) return bs;
      [ny[index], ny[mål]] = [ny[mål], ny[index]];
      return ny;
    });

  const aapneSend = async () => {
    if (!emne.trim()) return toast.error("E-post-emne må fylles ut");
    if (!(await lagre(true))) return;
    setSteg(1);
    setSendDialog(true);
    setAntall(null);
    try {
      const m = await hentMottakere();
      setAntall(m.filter((x) => !x.avmeldt).length);
    } catch {
      setAntall(0);
    }
  };

  const sendTest = async () => {
    if (!emne.trim()) return toast.error("E-post-emne må fylles ut");
    if (!(await lagre(true))) return;
    const { data: session } = await supabase.auth.getUser();
    const forslag = session?.user?.email ?? "";
    const epost = window.prompt("Send testnyhetsbrev til:", forslag);
    if (!epost) return;
    setTestSender(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-nyhetsbrev", {
        body: { action: "send_test", nyhetsbrev_id: id, test_epost: epost },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setStatus((s) => (s === "sendt" ? s : "test"));
      toast.success(`Test sendt til ${(data as any)?.test_epost ?? epost}`);
    } catch (e: any) {
      console.error(e);
      toast.error("Testsending feilet. Sjekk logg for detaljer.");
    } finally {
      setTestSender(false);
    }
  };

  const send = async () => {

    setSender(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-nyhetsbrev", {
        body: { action: "send", nyhetsbrev_id: id },
      });
      if (error) throw error;
      toast.success(
        (data as any)?.planlagt
          ? "Nyhetsbrevet er planlagt i Brevo"
          : `Nyhetsbrevet er sendt til ${(data as any)?.antall} mottakere`
      );
      navigate("/nyhetsbrev");
    } catch (e: any) {
      toast.error("Sending feilet. Sjekk logg for detaljer.");
      console.error(e);
    } finally {
      setSender(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const laast = status === "sendt";

  return (
    <div className="min-h-screen bg-background lg:ml-60">
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-sm border-b px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate("/nyhetsbrev")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="font-semibold truncate">{tittel || "Nyhetsbrev"}</h1>
            <p className="text-xs text-muted-foreground">Snakk AI · robin@snakk.ai</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => lagre()} disabled={lagrer || laast}>
            {lagrer ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            Lagre
          </Button>
          <Button variant="outline" size="sm" onClick={sendTest} disabled={testSender || laast}>
            {testSender ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
            Send test
          </Button>
          <Button size="sm" onClick={aapneSend} disabled={laast}>
            <Send className="w-4 h-4 mr-1.5" /> {planlagt ? "Planlegg" : "Send"}
          </Button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[320px_1fr] gap-6 p-4 sm:p-6">
        {/* Innstillinger */}
        <div className="space-y-4">
          <div className="bg-card border rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-semibold">Innstillinger</h2>
            <div className="space-y-1.5">
              <Label className="text-xs">Internt navn</Label>
              <Input value={tittel} onChange={(e) => setTittel(e.target.value)} disabled={laast} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">E-post-emne</Label>
              <Input value={emne} onChange={(e) => setEmne(e.target.value)} disabled={laast} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Forhåndsvisningstekst</Label>
              <Input value={preheader} onChange={(e) => setPreheader(e.target.value)} disabled={laast} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Avsender</Label>
              <Input value="Snakk AI <robin@snakk.ai>" disabled />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Planlagt sending (tom = send nå)</Label>
              <Input
                type="datetime-local"
                value={planlagt}
                onChange={(e) => setPlanlagt(e.target.value)}
                disabled={laast}
              />
            </div>
          </div>
        </div>

        {/* Innholdsbygger + preview */}
        <div className="space-y-6">
          <div className="bg-card border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Innhold</h2>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" disabled={laast}>
                    <Plus className="w-4 h-4 mr-1.5" /> Legg til blokk
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {(Object.keys(BLOKK_LABELS) as BlokkType[]).map((t) => (
                    <DropdownMenuItem key={t} onClick={() => setBlokker((bs) => [...bs, nyBlokk(t)])}>
                      {BLOKK_LABELS[t]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {blokker.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">Ingen blokker ennå.</p>
            )}

            {blokker.map((b, i) => (
              <div key={b.id} className="border rounded-lg p-3 space-y-2 bg-background">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {BLOKK_LABELS[b.type]}
                  </span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => flytt(i, -1)} disabled={laast}>
                      <ArrowUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => flytt(i, 1)} disabled={laast}>
                      <ArrowDown className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={laast}
                      onClick={() => setBlokker((bs) => bs.filter((x) => x.id !== b.id))}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>

                {b.type === "nyhet" && (
                  <Input
                    placeholder="Emoji"
                    className="w-20"
                    value={b.emoji || ""}
                    onChange={(e) => oppdater(b.id, { emoji: e.target.value })}
                    disabled={laast}
                  />
                )}
                {(b.type === "header" || b.type === "nyhet" || b.type === "deler") && (
                  <Input
                    placeholder="Overskrift"
                    value={b.overskrift || ""}
                    onChange={(e) => oppdater(b.id, { overskrift: e.target.value })}
                    disabled={laast}
                  />
                )}
                {(b.type === "tekst" || b.type === "nyhet") && (
                  <Textarea
                    placeholder="Tekst – **fet**, *kursiv*, [lenke](https://…)"
                    rows={b.type === "tekst" ? 5 : 3}
                    value={b.tekst || ""}
                    onChange={(e) => oppdater(b.id, { tekst: e.target.value })}
                    disabled={laast}
                  />
                )}
                {(b.type === "nyhet" || b.type === "cta") && (
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Lenketekst"
                      value={b.lenke_tekst || ""}
                      onChange={(e) => oppdater(b.id, { lenke_tekst: e.target.value })}
                      disabled={laast}
                    />
                    <Input
                      placeholder="https://…"
                      value={b.lenke_url || ""}
                      onChange={(e) => oppdater(b.id, { lenke_url: e.target.value })}
                      disabled={laast}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Forhåndsvisning</h2>
            <iframe
              title="Forhåndsvisning"
              srcDoc={html}
              className="w-full h-[700px] border rounded-xl bg-white"
            />
          </div>
        </div>
      </div>

      <Dialog open={sendDialog} onOpenChange={(o) => !o && setSendDialog(false)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{steg === 1 ? "Forhåndsvis utsending" : "Bekreft sending"}</DialogTitle>
          </DialogHeader>

          {steg === 1 ? (
            <div className="space-y-4">
              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">Emne:</span> <strong>{emne}</strong></p>
                <p><span className="text-muted-foreground">Avsender:</span> Snakk AI &lt;robin@snakk.ai&gt;</p>
                <p className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  {antall === null ? "Teller mottakere…" : `${antall} mottakere`}
                </p>
                {planlagt && (
                  <p><span className="text-muted-foreground">Planlagt:</span> {new Date(planlagt).toLocaleString("nb-NO")}</p>
                )}
              </div>
              <iframe title="E-post" srcDoc={html} className="w-full h-[400px] border rounded-lg bg-white" />
              <DialogFooter>
                <Button variant="outline" onClick={() => setSendDialog(false)}>Avbryt</Button>
                <Button onClick={() => setSteg(2)} disabled={antall === null || antall === 0}>Neste</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm">
                Nyhetsbrevet «{tittel}» sendes {planlagt ? "planlagt " : "nå "} til <strong>{antall}</strong> mottakere via Brevo.
                Dette kan ikke angres.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSteg(1)} disabled={sender}>Tilbake</Button>
                <Button onClick={send} disabled={sender}>
                  {sender ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  {planlagt ? "Planlegg sending" : `Send til ${antall} mottakere nå`}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
