import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSignature, FileText, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { nok } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCrmStore } from "@/hooks/use-crm-store";
import {
  MAKS_KONTRAKT_BYTES, salgsmuligheterForSelskap, standardSalgsmulighet, NY_SALGSMULIGHET,
  type KontraktUttrekk,
} from "@/lib/kontrakt-uttrekk";

export interface OpplastetKontrakt {
  id: string;
  fil_navn: string;
  fil_sti: string;
  ai_uttrekk: KontraktUttrekk | null;
  salgsmulighet_id?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selskapId: string;
  dokument: OpplastetKontrakt | null;
  onSendt?: () => void;
}

const erEpost = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim());

function tilBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(new Error("Kunne ikke lese PDF-filen"));
    r.readAsDataURL(blob);
  });
}

export default function SendOpplastetKontraktDialog({ open, onOpenChange, selskapId, dokument, onSendt }: Props) {
  const { user } = useAuth();
  const { salgsmuligheter, selskaper, kontakter, updateSalgsmuligheter } = useCrmStore();
  const selskap = selskaper.find((s) => s.id === selskapId);
  const kandidater = useMemo(() => salgsmuligheterForSelskap(salgsmuligheter, selskapId), [salgsmuligheter, selskapId]);

  const [smId, setSmId] = useState("");
  const [kontaktperson, setKontaktperson] = useState("");
  const [ePost, setEPost] = useState("");
  const [telefon, setTelefon] = useState("");
  const [firmanavn, setFirmanavn] = useState("");
  const [orgnr, setOrgnr] = useState("");
  const [adresse, setAdresse] = useState("");
  const [tittel, setTittel] = useState("");
  const [bekreft, setBekreft] = useState(false);
  const [sender, setSender] = useState(false);

  useEffect(() => {
    if (!open || !dokument) return;
    const u = dokument.ai_uttrekk;
    const kontakt = kontakter.find((k) => k.selskap_id === selskapId && k.e_post) || kontakter.find((k) => k.selskap_id === selskapId);
    const standard = dokument.salgsmulighet_id && kandidater.some((s) => s.id === dokument.salgsmulighet_id)
      ? dokument.salgsmulighet_id
      : standardSalgsmulighet(kandidater);
    const sm = kandidater.find((s) => s.id === standard);
    const navn = u?.firmanavn || selskap?.firmanavn || "";
    setSmId(standard === NY_SALGSMULIGHET ? "" : standard);
    setKontaktperson(u?.kontaktperson || sm?.kontaktperson || kontakt?.navn || "");
    setEPost(u?.e_post || sm?.e_post || kontakt?.e_post || "");
    setTelefon(u?.telefon || sm?.telefon || kontakt?.telefon || "");
    setFirmanavn(navn);
    setOrgnr(u?.orgnr || selskap?.orgnr || "");
    setAdresse(u?.adresse || selskap?.firmaadresse || "");
    setTittel(`Avtale om bruk av Snakk Teknologi AS - ${navn}`.slice(0, 200));
    setBekreft(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dokument?.id]);

  if (!dokument) return null;

  const mangler = [
    !smId && "salgsmulighet",
    !kontaktperson.trim() && "kontaktperson",
    !erEpost(ePost) && "gyldig e-post",
    !firmanavn.trim() && "firmanavn",
    !tittel.trim() && "tittel",
  ].filter(Boolean) as string[];

  const send = async () => {
    const sm = salgsmuligheter.find((s) => s.id === smId);
    if (!sm || !user?.email) return;
    setSender(true);
    try {
      const { data: blob, error: lastErr } = await supabase.storage.from("company-documents").download(dokument.fil_sti);
      if (lastErr || !blob) throw new Error("Kunne ikke hente PDF-filen fra lagringen.");
      if (blob.size > MAKS_KONTRAKT_BYTES) throw new Error("PDF-en er større enn 10 MB og kan ikke sendes.");
      const start = new TextDecoder().decode(new Uint8Array(await blob.slice(0, 5).arrayBuffer()));
      if (start !== "%PDF-") throw new Error("Filen er ikke en gyldig PDF.");
      const pdf_base64 = await tilBase64(blob);

      const u = dokument.ai_uttrekk;
      const valgtPakke = sm.valgt_pakke || u?.pakker.map((p) => p.navn).join(" + ") || "Ferdig kontrakt";
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dealbuilder-send-contract`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          salgsmulighet_id: sm.id,
          firmanavn: firmanavn.trim(),
          orgnr: orgnr.trim(),
          adresse: adresse.trim(),
          kontaktperson: kontaktperson.trim(),
          telefon: telefon.trim(),
          e_post: ePost.trim(),
          valgt_pakke: valgtPakke,
          pakke_pris: sm.forventet_mrr || u?.mrr || 0,
          minutter: "",
          sender_email: user.email,
          pdf_base64,
          tittel: tittel.trim(),
          selskap_dokument_id: dokument.id,
        }),
      });
      const svar = await res.json().catch(() => ({}));
      if (!res.ok) {
        const feil = typeof svar.error === "string" ? svar.error : "Ugyldige felt i utsendingen";
        throw new Error(res.status === 401 ? "Du må være logget inn med en @snakk.ai-konto." : feil);
      }

      updateSalgsmuligheter((prev) => prev.map((s) => (s.id === sm.id ? {
        ...s, status: "Kontrakt sendt", kontrakt_status: "Sendt",
        dealbuilder_dokument_id: svar.dokumentId || s.dealbuilder_dokument_id,
        sist_aktivitet: new Date().toISOString().split("T")[0],
      } : s)));
      toast.success(`Kontrakten er sendt til ${kontaktperson} for signering`);
      onSendt?.();
      onOpenChange(false);
    } catch (e) {
      toast.error("Kunne ikke sende kontrakten", { description: (e as Error).message?.slice(0, 200) });
      setBekreft(false);
    } finally {
      setSender(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !sender && onOpenChange(o)}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-primary" aria-hidden /> Send til signering
          </DialogTitle>
          <DialogDescription>Sender den opplastede PDF-en uendret via DealBuilder.</DialogDescription>
        </DialogHeader>

        {!bekreft ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
              <span className="truncate font-medium">{dokument.fil_navn}</span>
            </div>

            <div className="space-y-1">
              <Label htmlFor="sk-sm" className="text-xs text-muted-foreground">Salgsmulighet</Label>
              <Select value={smId} onValueChange={setSmId}>
                <SelectTrigger id="sk-sm"><SelectValue placeholder="Velg salgsmulighet" /></SelectTrigger>
                <SelectContent>
                  {kandidater.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.navn} · {s.status} · {nok(s.forventet_mrr)}/mnd</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {kandidater.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Selskapet har ingen salgsmulighet. Bruk «Les kontrakt med AI» og lagre for å opprette en først.
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="sk-kp" className="text-xs text-muted-foreground">Mottaker</Label>
                <Input id="sk-kp" value={kontaktperson} onChange={(e) => setKontaktperson(e.target.value)} placeholder="Navn" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sk-ep" className="text-xs text-muted-foreground">E-post</Label>
                <Input id="sk-ep" type="email" value={ePost} onChange={(e) => setEPost(e.target.value)} placeholder="navn@firma.no" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sk-tlf" className="text-xs text-muted-foreground">Telefon (valgfritt)</Label>
                <Input id="sk-tlf" type="tel" value={telefon} onChange={(e) => setTelefon(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sk-fn" className="text-xs text-muted-foreground">Firmanavn</Label>
                <Input id="sk-fn" value={firmanavn} onChange={(e) => setFirmanavn(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sk-org" className="text-xs text-muted-foreground">Org.nr.</Label>
                <Input id="sk-org" value={orgnr} onChange={(e) => setOrgnr(e.target.value)} className="tabular-nums" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sk-adr" className="text-xs text-muted-foreground">Adresse</Label>
                <Input id="sk-adr" value={adresse} onChange={(e) => setAdresse(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="sk-tittel" className="text-xs text-muted-foreground">Tittel i DealBuilder</Label>
              <Input id="sk-tittel" maxLength={200} value={tittel} onChange={(e) => setTittel(e.target.value)} />
            </div>

            {mangler.length > 0 && (
              <p role="status" className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
                Mangler: {mangler.join(", ")}.
              </p>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Avbryt</Button>
              <Button onClick={() => setBekreft(true)} disabled={mangler.length > 0} className="gap-2">
                <Send className="h-4 w-4" /> Gå videre
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-1">
              <p>Er du sikker på at du vil sende kontrakten til signering?</p>
              <p className="text-muted-foreground">
                <strong className="text-foreground">{dokument.fil_navn}</strong> sendes til{" "}
                <strong className="text-foreground">{kontaktperson}</strong> ({ePost}) fra {user?.email}.
                Salgsmuligheten settes til «Kontrakt sendt».
              </p>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={() => setBekreft(false)} disabled={sender}>Nei, gå tilbake</Button>
              <Button onClick={send} disabled={sender} className="gap-2">
                {sender ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Ja, send til signering
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
