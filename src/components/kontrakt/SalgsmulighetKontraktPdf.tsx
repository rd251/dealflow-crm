import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Download, Eye, FileText, Loader2, Send, Sparkles, Trash2, Upload } from "lucide-react";
import KontraktInfoDialog from "@/components/kontrakt/KontraktInfoDialog";
import SendOpplastetKontraktDialog, { type OpplastetKontrakt } from "@/components/kontrakt/SendOpplastetKontraktDialog";
import { normaliserUttrekk, MAKS_KONTRAKT_BYTES, type KontraktUttrekk } from "@/lib/kontrakt-uttrekk";

interface Dok {
  id: string;
  fil_navn: string;
  fil_sti: string;
  created_at: string;
  status?: string | null;
  ai_uttrekk?: unknown;
  salgsmulighet_id?: string | null;
}

const lesUttrekk = (raw: unknown): KontraktUttrekk | null => (raw && typeof raw === "object" ? normaliserUttrekk(raw) : null);

/**
 * Ferdig kontrakt-PDF direkte på salgsmuligheten: last opp, les med AI og send til signering.
 * Gjenbruker de samme dialogene som Dokumenter på selskapet; filen kobles til salgsmuligheten.
 */
export default function SalgsmulighetKontraktPdf({ salgsmulighetId, selskapId }: { salgsmulighetId: string; selskapId: string | null | undefined }) {
  const { user, canEdit } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [doks, setDoks] = useState<Dok[]>([]);
  const [laster, setLaster] = useState(false);
  const [leserId, setLeserId] = useState<string | null>(null);
  const [info, setInfo] = useState<{ filNavn: string; uttrekk: KontraktUttrekk } | null>(null);
  const [sendDok, setSendDok] = useState<OpplastetKontrakt | null>(null);
  const [versjon, setVersjon] = useState(0);

  useEffect(() => {
    let aktiv = true;
    supabase
      .from("selskap_dokumenter")
      .select("id, fil_navn, fil_sti, created_at, status, ai_uttrekk, salgsmulighet_id, fil_type, kilde")
      .eq("salgsmulighet_id", salgsmulighetId)
      .eq("fil_type", "pdf")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (aktiv && data) setDoks((data as (Dok & { kilde?: string | null })[]).filter((d) => d.kilde !== "dealbuilder"));
      });
    return () => { aktiv = false; };
  }, [salgsmulighetId, versjon]);

  const lesKontrakt = async (doc: Dok) => {
    setLeserId(doc.id);
    try {
      const { data, error } = await supabase.functions.invoke("extract-contract-info", { body: { dokument_id: doc.id } });
      if (error) {
        let melding = "AI-lesingen feilet. Prøv igjen.";
        try { const j = await (error as { context?: Response }).context?.json(); if (j?.error) melding = j.error; } catch { /* standardmelding */ }
        throw new Error(melding);
      }
      const uttrekk = lesUttrekk(data?.uttrekk);
      if (!uttrekk) throw new Error("AI-en fant ingen kontraktsinfo i PDF-en.");
      setDoks((prev) => prev.map((d) => (d.id === doc.id ? { ...d, ai_uttrekk: uttrekk } : d)));
      setInfo({ filNavn: doc.fil_navn, uttrekk });
    } catch (e) {
      toast.error("Kunne ikke lese kontrakten", { description: (e as Error).message });
    } finally {
      setLeserId(null);
    }
  };

  const lastOpp = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fil = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!fil || !selskapId) return;
    if (!fil.name.toLowerCase().endsWith(".pdf")) { toast.error("Kun PDF kan lastes opp som kontrakt."); return; }
    if (fil.size > MAKS_KONTRAKT_BYTES) { toast.error("PDF-en er større enn 10 MB og kan ikke sendes til signering."); return; }
    setLaster(true);
    try {
      const sti = `${selskapId}/${crypto.randomUUID()}.pdf`;
      const { error: opErr } = await supabase.storage.from("company-documents").upload(sti, fil);
      if (opErr) throw new Error(opErr.message);
      const { data: rad, error } = await supabase.from("selskap_dokumenter").insert({
        selskap_id: selskapId,
        salgsmulighet_id: salgsmulighetId,
        fil_navn: fil.name,
        fil_type: "pdf",
        fil_sti: sti,
        opplastet_av: user?.email || "",
        opplastet_av_user_id: user?.id || null,
      }).select("id, fil_navn, fil_sti, created_at, status, ai_uttrekk, salgsmulighet_id").single();
      if (error || !rad) {
        await supabase.storage.from("company-documents").remove([sti]);
        throw new Error(error?.message || "Kunne ikke lagre dokumentet");
      }
      toast.success(`${fil.name} lastet opp`);
      setDoks((prev) => [rad as Dok, ...prev]);
      void lesKontrakt(rad as Dok);
    } catch (err) {
      toast.error("Opplasting feilet", { description: (err as Error).message?.slice(0, 140) });
    } finally {
      setLaster(false);
    }
  };

  const slett = async (doc: Dok) => {
    if (!window.confirm(`Slette ${doc.fil_navn}?`)) return;
    const { error: sErr } = await supabase.storage.from("company-documents").remove([doc.fil_sti]);
    const { error: dErr } = await supabase.from("selskap_dokumenter").delete().eq("id", doc.id);
    if (sErr || dErr) { toast.error("Kunne ikke slette dokumentet"); return; }
    setDoks((prev) => prev.filter((d) => d.id !== doc.id));
  };

  const lastNed = async (doc: Dok) => {
    const { data } = await supabase.storage.from("company-documents").createSignedUrl(doc.fil_sti, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Kunne ikke lage nedlastingslenke");
  };

  if (!selskapId) {
    return (
      <p className="text-xs text-muted-foreground">
        Koble salgsmuligheten til et selskap for å laste opp en ferdig kontrakt-PDF.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {canEdit && (
        <>
          <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={lastOpp} />
          <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => inputRef.current?.click()} disabled={laster}>
            {laster ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Last opp ferdig kontrakt (PDF)
          </Button>
        </>
      )}

      {doks.map((doc) => {
        const uttrekk = lesUttrekk(doc.ai_uttrekk);
        return (
          <div key={doc.id} className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{doc.fil_navn}</p>
                  <p className="text-[10px] text-muted-foreground tabular-nums">
                    {new Date(doc.created_at).toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                {doc.status && <Badge variant="secondary" className="text-[10px]">{doc.status}</Badge>}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => lastNed(doc)} aria-label={`Last ned ${doc.fil_navn}`}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
                {canEdit && (
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => slett(doc)} aria-label={`Slett ${doc.fil_navn}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
            {canEdit && (
              <div className="flex flex-wrap gap-1.5 pl-6">
                <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => lesKontrakt(doc)} disabled={leserId !== null}>
                  {leserId === doc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  {leserId === doc.id ? "Leser kontrakten …" : "Les kontrakt med AI"}
                </Button>
                {uttrekk && leserId !== doc.id && (
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => setInfo({ filNavn: doc.fil_navn, uttrekk })}>
                    <Eye className="h-3 w-3" /> Vis kontraktsinfo
                  </Button>
                )}
                {doc.status !== "Sendt" && doc.status !== "Signert" && (
                  <Button size="sm" className="h-7 gap-1 text-[11px]"
                    onClick={() => setSendDok({ id: doc.id, fil_navn: doc.fil_navn, fil_sti: doc.fil_sti, ai_uttrekk: uttrekk, salgsmulighet_id: salgsmulighetId })}>
                    <Send className="h-3 w-3" /> Send til signering
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })}

      <KontraktInfoDialog
        open={!!info}
        onOpenChange={(o) => { if (!o) setInfo(null); }}
        selskapId={selskapId}
        salgsmulighetId={salgsmulighetId}
        filNavn={info?.filNavn || ""}
        uttrekk={info?.uttrekk || null}
      />
      <SendOpplastetKontraktDialog
        open={!!sendDok}
        onOpenChange={(o) => { if (!o) setSendDok(null); }}
        selskapId={selskapId}
        dokument={sendDok}
        onSendt={() => setVersjon((n) => n + 1)}
      />
    </div>
  );
}
