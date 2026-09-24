import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { nok } from "@/lib/utils";
import { Building2, Download, Eye, Loader2, Mail, Package, Phone, User } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { standardKontraktType } from "@/components/SendContractModal";
import { toast } from "sonner";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export interface OfferData {
  salgsmulighet_id: string;
  firmanavn: string;
  orgnr: string;
  adresse: string;
  kontaktperson: string;
  telefon: string;
  e_post: string;
  valgt_pakke: string;
  pakke_pris: number;
  minutter: string;
  sla?: number | null;
  oppstartskostnad?: number | null;
}

const FILNAVN_UGYLDIGE_TEGN = /[^a-zA-Z0-9æøåÆØÅ-]+/g;

export default function OfferTab({ offerData }: { offerData: OfferData }) {
  const [lasterNed, setLasterNed] = useState(false);
  const [lasterVisning, setLasterVisning] = useState(false);
  const [visningUrl, setVisningUrl] = useState<string | null>(null);

  const hentPdf = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const token = session?.access_token || anonKey;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-contract-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
        },
        body: JSON.stringify({
          ...offerData,
          dokument_type: "tilbud",
          kontrakt_type: standardKontraktType(offerData.valgt_pakke),
        }),
      });

      if (!res.ok) {
        const feil = await res.json().catch(() => null);
        throw new Error(feil?.error || "Kunne ikke lage tilbudet");
      }

      return await res.blob();
  };

  const forhandsvis = async () => {
    setLasterVisning(true);
    try {
      const blob = await hentPdf();
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      const doc = await pdfjs.getDocument({ data: await blob.arrayBuffer() }).promise;
      const bilder: string[] = [];
      for (let n = 1; n <= doc.numPages; n++) {
        const side = await doc.getPage(n);
        const viewport = side.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await side.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
        bilder.push(canvas.toDataURL("image/png"));
      }
      setSider(bilder);
      setVisningUrl("vis");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunne ikke forhåndsvise tilbudet");
    } finally {
      setLasterVisning(false);
    }
  };

  const lukkVisning = () => {
    setVisningUrl(null);
    setSider([]);
  };

  const lastNedPdf = async () => {
    setLasterNed(true);
    try {
      const blob = await hentPdf();
      const url = URL.createObjectURL(blob);
      const lenke = document.createElement("a");
      lenke.href = url;
      lenke.download = `tilbud-${offerData.firmanavn.replace(FILNAVN_UGYLDIGE_TEGN, "-").replace(/^-|-$/g, "")}.pdf`;
      lenke.rel = "noopener";
      document.body.appendChild(lenke);
      lenke.click();
      document.body.removeChild(lenke);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast.success("Tilbudet er lastet ned som PDF");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunne ikke laste ned tilbudet");
    } finally {
      setLasterNed(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold">Tilbud</h3>
        <p className="mt-1 text-sm text-muted-foreground">Et pristilbud uten kontraktsvilkår eller signering. Gyldig i 14 dager.</p>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Building2 className="h-3.5 w-3.5" />Kunde</p>
            <p className="font-medium">{offerData.firmanavn || "Ikke registrert"}</p>
            {offerData.orgnr && <p className="text-xs text-muted-foreground">Org.nr. {offerData.orgnr}</p>}
            {offerData.adresse && <p className="text-xs text-muted-foreground">{offerData.adresse}</p>}
          </div>
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><User className="h-3.5 w-3.5" />Kontaktperson</p>
            <p className="font-medium">{offerData.kontaktperson || "Ikke registrert"}</p>
            {offerData.telefon && <p className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{offerData.telefon}</p>}
            {offerData.e_post && <p className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="h-3 w-3" />{offerData.e_post}</p>}
          </div>
        </div>

        <div className="border-t pt-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Package className="h-3.5 w-3.5" />Valgt løsning</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <Badge variant="secondary" className="text-sm">{offerData.valgt_pakke || "Ingen pakke valgt"}</Badge>
            <span className="font-semibold tabular-nums">{nok(offerData.pakke_pris)}/mnd</span>
          </div>
          {offerData.minutter && <p className="mt-2 text-sm text-muted-foreground">Inkludert: {offerData.minutter}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3 border-t pt-4">
          <div>
            <p className="text-xs text-muted-foreground">Fakturering</p>
            <p className="mt-1 text-sm font-medium">Månedlig</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Oppkobling</p>
            <p className="mt-1 text-sm font-medium tabular-nums">{nok(offerData.oppstartskostnad || 0)}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Alle priser er eks. mva.</p>
      </div>

      {!offerData.valgt_pakke && (
        <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">Velg en pakke under Detaljer før du laster ned tilbudet.</p>
      )}

      <Button variant="outline" className="w-full" onClick={forhandsvis} disabled={lasterVisning || !offerData.valgt_pakke || !offerData.firmanavn}>
        {lasterVisning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
        Forhåndsvis tilbud
      </Button>

      <Dialog open={!!visningUrl} onOpenChange={(o) => !o && lukkVisning()}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>Forhåndsvisning av tilbud</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto rounded border bg-muted p-4 space-y-4">
            {sider.map((src, i) => (
              <img key={i} src={src} alt={`Side ${i + 1} av tilbudet`} className="mx-auto w-full max-w-3xl bg-background shadow" />
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Button className="w-full" onClick={lastNedPdf} disabled={lasterNed || !offerData.valgt_pakke || !offerData.firmanavn}>
        {lasterNed ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
        Last ned tilbud som PDF
      </Button>
    </div>
  );
}