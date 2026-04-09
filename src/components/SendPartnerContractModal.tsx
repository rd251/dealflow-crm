import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileSignature, Send, Loader2, Building2, User, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface PartnerContractData {
  partner_id: string;
  firmanavn: string;
  orgnr: string;
  adresse: string;
  kontaktperson: string;
  telefon: string;
  e_post: string;
}

import { Input } from "@/components/ui/input";

interface SendPartnerContractModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractData: PartnerContractData;
  senderEmail: string;
  onContractSent: () => void;
}

export default function SendPartnerContractModal({
  open,
  onOpenChange,
  contractData,
  senderEmail,
  onContractSent,
}: SendPartnerContractModalProps) {
  const [sending, setSending] = useState(false);
  const [editOrgnr, setEditOrgnr] = useState(contractData.orgnr || "");
  const missingOrgnr = !editOrgnr?.trim();

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const handleSendContract = async () => {
    if (missingOrgnr) {
      toast.error("Org.nr mangler. Fyll inn org.nr på selskapet før du sender avtale.");
      return;
    }
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || anonKey;

      const res = await fetch(`${supabaseUrl}/functions/v1/dealbuilder-send-partner-contract`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
        },
        body: JSON.stringify({
          ...contractData,
          orgnr: editOrgnr.trim(),
          sender_email: senderEmail,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Kunne ikke sende samarbeidsavtale");
      }

      toast.success(`Samarbeidsavtale sendt til ${contractData.kontaktperson}`);
      onContractSent();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Feil ved sending av samarbeidsavtale");
    } finally {
      setSending(false);
    }
  };

  const missingFields = !contractData.e_post || !contractData.kontaktperson;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-destructive" />
            Send samarbeidsavtale
          </DialogTitle>
          <DialogDescription>
            Send samarbeidsavtale til signering via DealBuilder
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Avtaleinformasjon</h4>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  <Building2 className="w-3 h-3" /> Partner / Selskap
                </div>
                <p className="font-medium">{contractData.firmanavn}</p>
                {contractData.orgnr && (
                  <p className="text-xs text-muted-foreground">Org.nr: {contractData.orgnr}</p>
                )}
                {contractData.adresse && (
                  <p className="text-xs text-muted-foreground">{contractData.adresse}</p>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  <User className="w-3 h-3" /> Kontaktperson
                </div>
                <p className="font-medium">{contractData.kontaktperson || "–"}</p>
                {contractData.telefon && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="w-3 h-3" /> {contractData.telefon}
                  </div>
                )}
                {contractData.e_post && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Mail className="w-3 h-3" /> {contractData.e_post}
                  </div>
                )}
              </div>
            </div>
          </div>

          {missingOrgnr && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              ⚠️ Org.nr mangler — fyll inn org.nr på selskapet før du sender avtale.
            </div>
          )}

          {missingFields && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              ⚠️ Manglende informasjon:
              <ul className="list-disc list-inside mt-1 text-xs">
                {!contractData.kontaktperson && <li>Kontaktperson mangler</li>}
                {!contractData.e_post && <li>E-postadresse mangler</li>}
              </ul>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleSendContract}
              disabled={sending || missingFields || missingOrgnr}
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
