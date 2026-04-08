import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileSignature, Eye, Send, Loader2, Building2, User, Phone, Mail, Package } from "lucide-react";
import { toast } from "sonner";
import { nok } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { PAKKER } from "@/data/crm-data";

interface ContractData {
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

interface SendContractModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractData: ContractData;
  senderEmail: string;
  onContractSent: (dokumentId: string | null) => void;
}

export default function SendContractModal({
  open,
  onOpenChange,
  contractData,
  senderEmail,
  onContractSent,
}: SendContractModalProps) {
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const handlePreviewPdf = async () => {
    setPreviewing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || anonKey;

      const res = await fetch(`${supabaseUrl}/functions/v1/generate-contract-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
        },
        body: JSON.stringify({
          firmanavn: contractData.firmanavn,
          orgnr: contractData.orgnr,
          adresse: contractData.adresse,
          kontaktperson: contractData.kontaktperson,
          telefon: contractData.telefon,
          e_post: contractData.e_post,
          valgt_pakke: contractData.valgt_pakke,
          pakke_pris: contractData.pakke_pris,
          minutter: contractData.minutter,
          sla: contractData.sla ?? null,
          oppstartskostnad: contractData.oppstartskostnad ?? null,
        }),
      });

      if (!res.ok) {
        throw new Error("Kunne ikke generere PDF");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err: any) {
      toast.error(err.message || "Feil ved PDF-generering");
    } finally {
      setPreviewing(false);
    }
  };

  const handleSendContract = async () => {
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || anonKey;

      const res = await fetch(`${supabaseUrl}/functions/v1/dealbuilder-send-contract`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
        },
        body: JSON.stringify({
          ...contractData,
          sender_email: senderEmail,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Kunne ikke sende kontrakt");
      }

      const result = await res.json();
      toast.success(`Kontrakt sendt til ${contractData.kontaktperson}`);
      onContractSent(result.dokumentId || null);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Feil ved sending av kontrakt");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-destructive" />
            Send kontrakt
          </DialogTitle>
          <DialogDescription>
            Forhåndsvis og send kontrakt via DealBuilder
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Contract info preview */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Kontraktsinformasjon</h4>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  <Building2 className="w-3 h-3" /> Kunde
                </div>
                <p className="font-medium">{contractData.firmanavn}</p>
                <p className="text-xs text-muted-foreground">Org.nr: {contractData.orgnr}</p>
                <p className="text-xs text-muted-foreground">{contractData.adresse}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  <User className="w-3 h-3" /> Kontaktperson
                </div>
                <p className="font-medium">{contractData.kontaktperson}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Phone className="w-3 h-3" /> {contractData.telefon}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Mail className="w-3 h-3" /> {contractData.e_post}
                </div>
              </div>
            </div>

            <div className="border-t pt-3">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                <Package className="w-3 h-3" /> Valgt pakke
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="text-sm">
                  {contractData.valgt_pakke}
                </Badge>
                <span className="font-semibold text-sm">{nok(contractData.pakke_pris)}/mnd</span>
              </div>
              {contractData.minutter && (
                <p className="text-xs text-muted-foreground mt-1">📞 {contractData.minutter} inkludert</p>
              )}
            </div>
          </div>

          {/* Validation warnings */}
          {(!contractData.e_post || !contractData.kontaktperson || !contractData.valgt_pakke) && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              ⚠️ Manglende informasjon:
              <ul className="list-disc list-inside mt-1 text-xs">
                {!contractData.kontaktperson && <li>Kontaktperson mangler</li>}
                {!contractData.e_post && <li>E-postadresse mangler</li>}
                {!contractData.valgt_pakke && <li>Ingen pakke valgt</li>}
              </ul>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={handlePreviewPdf} disabled={previewing || sending}>
              {previewing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
              Forhåndsvis PDF
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleSendContract}
              disabled={sending || previewing || !contractData.e_post || !contractData.kontaktperson || !contractData.valgt_pakke}
            >
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Send til signering
            </Button>
          </div>

          <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => onOpenChange(false)} disabled={sending}>
            Avbryt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
