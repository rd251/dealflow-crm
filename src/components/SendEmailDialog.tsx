import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Send, Loader2, Sparkles, Pencil, Settings2, RefreshCw, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-filled recipient email */
  defaultTo?: string;
  /** Pre-filled subject */
  defaultSubject?: string;
  /** Pre-filled body content (e.g. from AI draft) */
  defaultBody?: string;
  /** Context for AI generation */
  context: {
    entityType: "lead" | "salgsmulighet" | "ringeliste";
    entityId: string;
    selskapNavn: string;
    kontaktperson?: string;
    selskapId?: string;
    kontaktId?: string;
    nesteSteg?: string;
    useCase?: string;
    status?: string;
  };
  /** Called after successful send (e.g. to update sist_aktivitet) */
  onSent?: () => void;
}

export default function SendEmailDialog({ open, onOpenChange, defaultTo, defaultSubject, context, onSent }: SendEmailDialogProps) {
  const [emailTo, setEmailTo] = useState(defaultTo || "");
  const [emailSubject, setEmailSubject] = useState(defaultSubject || "");
  const [emailBody, setEmailBody] = useState("");
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editMode, setEditMode] = useState(true);
  const [showPrompt, setShowPrompt] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");

  // Reset state when dialog opens
  const handleOpenChange = (val: boolean) => {
    if (val) {
      setEmailTo(defaultTo || "");
      setEmailSubject(defaultSubject || `Oppfølging – ${context.selskapNavn}`);
      setEmailBody("");
      setEditMode(true);
      setShowPrompt(false);
      setCustomPrompt(buildDefaultPrompt());
    }
    onOpenChange(val);
  };

  const buildDefaultPrompt = () => {
    const contactName = context.kontaktperson || "kontaktperson";
    return `Skriv en kort, profesjonell e-post på norsk (3-5 setninger).
Kontaktperson: ${contactName}
Selskap: ${context.selskapNavn}
${context.useCase ? `Use case: ${context.useCase}` : ""}
${context.nesteSteg ? `Neste steg: ${context.nesteSteg}` : ""}
${context.status ? `Status: ${context.status}` : ""}
Adresser meldingen til ${contactName.split(" ")[0]}. Vær direkte men høflig. Avslutt med et konkret forslag til neste steg.`;
  };

  const generateDraft = async (promptOverride?: string) => {
    setGenerating(true);
    try {
      const prompt = promptOverride || customPrompt || buildDefaultPrompt();
      const { data, error } = await supabase.functions.invoke("follow-up-ai", {
        body: {
          type: context.entityType === "lead" ? "lead_stale" : "sm_stale",
          navn: context.selskapNavn,
          kontaktperson: context.kontaktperson,
          selskapNavn: context.selskapNavn,
          anbefalHandling: context.nesteSteg || "Følg opp",
          hoursInactive: 0,
          entityType: context.entityType,
          customPrompt: prompt,
        },
      });
      if (error) throw error;
      const msg = data?.message || "Kunne ikke generere utkast.";
      setEmailBody(msg);
      setEditMode(true);
    } catch {
      toast.error("Kunne ikke generere AI-utkast");
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!emailTo || !emailSubject || !emailBody) {
      toast.error("Fyll inn mottaker, emne og innhold");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("gmail-send", {
        body: {
          to: emailTo,
          subject: emailSubject,
          body: emailBody,
          entity_id: context.entityId,
          entity_type: context.entityType,
          selskap_id: context.selskapId,
          kontakt_id: context.kontaktId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("E-post sendt via Gmail!");
      onSent?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Kunne ikke sende e-post");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-4 h-4" /> Send e-post
          </DialogTitle>
          <DialogDescription>
            Skriv manuelt eller generer AI-utkast for {context.selskapNavn}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Til</label>
            <Input value={emailTo} onChange={e => setEmailTo(e.target.value)} placeholder="e-post@eksempel.no" className="h-8 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Emne</label>
            <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} className="h-8 text-sm" />
          </div>

          {/* AI prompt section */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={() => generateDraft()}
              disabled={generating}
            >
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {emailBody ? "Generer på nytt" : "Generer AI-utkast"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="gap-1 text-xs text-muted-foreground"
              onClick={() => {
                if (!customPrompt) setCustomPrompt(buildDefaultPrompt());
                setShowPrompt(!showPrompt);
              }}
            >
              <Settings2 className="w-3.5 h-3.5" />
              AI-instruksjon
            </Button>
          </div>

          {showPrompt && (
            <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">AI-instruksjon</label>
              <Textarea
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                rows={4}
                className="text-xs"
                placeholder="Beskriv hva slags e-post du vil ha..."
              />
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5 text-xs"
                onClick={() => generateDraft(customPrompt)}
                disabled={generating}
              >
                {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Generer med instruksjon
              </Button>
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground">Innhold</label>
            <Textarea
              value={emailBody}
              onChange={e => setEmailBody(e.target.value)}
              rows={8}
              className="text-sm"
              placeholder="Skriv e-posten her, eller bruk AI-utkast..."
            />
          </div>

          <Button onClick={handleSend} disabled={sending || !emailTo || !emailBody} className="w-full gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send via Gmail
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
