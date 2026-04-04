import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Clock, Building2, Sparkles, X, Send, Loader2, Pencil, ChevronRight, RefreshCw, Settings2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FollowUpItem } from "@/hooks/use-follow-ups";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface FollowUpSectionProps {
  items: FollowUpItem[];
  loading: boolean;
  onDismiss: (id: string) => void;
}

const typeLabel: Record<string, string> = {
  lead_stale: "Lead inaktiv",
  sm_stale: "Salg inaktiv",
  post_meeting: "Etter møte",
  email_no_reply: "Ubesvart e-post",
  email_awaiting_reply: "Venter på svar",
  email_needs_reply: "Må svare",
};

const typeColor: Record<string, string> = {
  lead_stale: "bg-amber-500/10 text-amber-600 border-amber-200",
  sm_stale: "bg-destructive/10 text-destructive border-destructive/20",
  post_meeting: "bg-primary/10 text-primary border-primary/20",
  email_no_reply: "bg-amber-500/10 text-amber-600 border-amber-200",
  email_awaiting_reply: "bg-amber-500/10 text-amber-600 border-amber-200",
  email_needs_reply: "bg-destructive/10 text-destructive border-destructive/20",
};

const formatInactive = (hours: number) => {
  if (hours >= 24) return `${Math.floor(hours / 24)}d`;
  return `${hours}t`;
};

export default function FollowUpSection({ items, loading, onDismiss }: FollowUpSectionProps) {
  const navigate = useNavigate();
  const [messageDialog, setMessageDialog] = useState<FollowUpItem | null>(null);
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [generating, setGenerating] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Email send state
  const [editMode, setEditMode] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sending, setSending] = useState(false);

  // Prompt editing
  const [showPrompt, setShowPrompt] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");

  const buildDefaultPrompt = (item: FollowUpItem) => {
    const contactName = item.kontaktperson || item.navn;
    const daysInactive = Math.floor(item.hoursInactive / 24);
    return `Skriv en kort, profesjonell oppfølgings-epost på norsk (3-5 setninger).
Kontaktperson: ${contactName}
Selskap: ${item.selskapNavn}
Situasjon: ${item.anbefalHandling}
Dager inaktiv: ${daysInactive}
Adresser meldingen til ${contactName.split(' ')[0]}. Vær direkte men høflig. Avslutt med et konkret forslag til neste steg.`;
  };

  const generateMessage = async (item: FollowUpItem, promptOverride?: string) => {
    setMessageDialog(item);
    setGeneratedMessage("");
    setGenerating(true);
    setEditMode(false);

    const prompt = promptOverride || customPrompt || undefined;

    try {
      const { data, error } = await supabase.functions.invoke("follow-up-ai", {
        body: {
          type: item.type,
          navn: item.navn,
          kontaktperson: item.kontaktperson,
          selskapNavn: item.selskapNavn,
          sistAktivitetType: item.sistAktivitetType,
          anbefalHandling: item.anbefalHandling,
          hoursInactive: item.hoursInactive,
          entityType: item.entityType,
          customPrompt: prompt,
        },
      });
      if (error) throw error;
      const msg = data?.message || "Kunne ikke generere melding.";
      setGeneratedMessage(msg);

      setEmailTo(item.ePost || "");
      setEmailSubject(`Oppfølging – ${item.selskapNavn}`);
      setEmailBody(msg);
    } catch {
      setGeneratedMessage("Kunne ikke generere melding. Prøv igjen.");
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenDialog = (item: FollowUpItem) => {
    const defaultPrompt = buildDefaultPrompt(item);
    setCustomPrompt(defaultPrompt);
    setShowPrompt(false);
    generateMessage(item, defaultPrompt);
  };

  const handleSendEmail = async () => {
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
          entity_id: messageDialog?.entityId,
          entity_type: messageDialog?.entityType,
          selskap_id: messageDialog?.selskapId,
          kontakt_id: messageDialog?.kontaktId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Update sist_aktivitet on the entity so it no longer shows as inactive
      if (messageDialog) {
        const today = new Date().toISOString().split("T")[0];
        const table = messageDialog.entityType === "lead" ? "leads" : "salgsmuligheter";
        await supabase.from(table).update({ sist_aktivitet: today }).eq("id", messageDialog.entityId);
      }

      toast.success("E-post sendt via Gmail!");
      setMessageDialog(null);
      if (messageDialog) onDismiss(messageDialog.id);
    } catch (e: any) {
      toast.error(e?.message || "Kunne ikke sende e-post");
    } finally {
      setSending(false);
    }
  };

  const handleNavigate = (item: FollowUpItem) => {
    if (item.entityType === "lead") {
      navigate(`/leads`);
    } else {
      navigate(`/salgsmuligheter?open=${item.entityId}`);
    }
  };

  if (loading) {
    return (
      <div className="bg-card border rounded-xl mb-6 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Oppfølging</h2>
        </div>
        <div className="px-4 py-8 text-center text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
          Laster...
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  const displayed = showAll ? items : items.slice(0, 10);
  const remaining = items.length - 10;

  return (
    <>
      <div className="bg-card border rounded-xl mb-6 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Oppfølging</h2>
            <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">
              {items.length}
            </Badge>
          </div>
        </div>

        <div className="divide-y">
          {displayed.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 px-4 sm:px-6 py-3 hover:bg-muted/30 transition-colors group"
            >
              <div className={`w-2 h-2 rounded-full shrink-0 ${
                item.priority === "high" ? "bg-destructive" : item.priority === "medium" ? "bg-amber-500" : "bg-muted-foreground"
              }`} />

              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleNavigate(item)}>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">
                    {item.navn}
                    {item.kontaktperson && item.kontaktperson !== item.navn && (
                      <span className="text-muted-foreground font-normal"> · {item.kontaktperson}</span>
                    )}
                  </p>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${typeColor[item.type]}`}>
                    {typeLabel[item.type]}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 truncate">
                    <Building2 className="w-3 h-3 shrink-0" />
                    {item.selskapNavn}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 shrink-0" />
                    {formatInactive(item.hoursInactive)} siden
                  </span>
                  {item.verdi > 0 && (
                    <span className="hidden sm:inline tabular-nums">
                      {item.verdi.toLocaleString("no-NO")} kr
                    </span>
                  )}
                </div>
                <p className="text-xs text-primary mt-0.5 font-medium">{item.anbefalHandling}</p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 gap-1 hidden sm:flex"
                  onClick={(e) => {
                    e.stopPropagation();
                    generateMessage(item);
                  }}
                >
                  <Sparkles className="w-3 h-3" />
                  Send oppfølging
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss(item.id);
                  }}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {items.length > 10 && (
          <div className="px-4 py-2 border-t text-center">
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {showAll ? "Vis færre" : `+${remaining} flere oppfølginger`}
            </button>
          </div>
        )}
      </div>

      {/* Send email dialog */}
      <Dialog open={!!messageDialog} onOpenChange={(open) => { if (!open) setMessageDialog(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Oppfølgingsmelding
            </DialogTitle>
            <DialogDescription>
              {messageDialog?.navn} – {messageDialog?.selskapNavn}
            </DialogDescription>
          </DialogHeader>

          {generating ? (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Genererer melding...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Recipient */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Til</label>
                <Input
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="e-post@eksempel.no"
                  disabled={!editMode}
                  className="h-8 text-sm"
                />
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Emne</label>
                <Input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Emne"
                  disabled={!editMode}
                  className="h-8 text-sm"
                />
              </div>

              {/* Body */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Innhold</label>
                {editMode ? (
                  <Textarea
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    rows={8}
                    className="text-sm"
                  />
                ) : (
                  <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed border min-h-[120px]">
                    {generatedMessage}
                  </div>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground">
                Din Gmail-signatur legges automatisk til ved sending.
              </p>

              <div className="flex gap-2 justify-between">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => {
                      if (!editMode) {
                        setEmailBody(generatedMessage);
                      }
                      setEditMode(!editMode);
                    }}
                  >
                    <Pencil className="w-3 h-3" />
                    {editMode ? "Forhåndsvis" : "Rediger"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                    onClick={() => {
                      if (messageDialog) handleNavigate(messageDialog);
                      setMessageDialog(null);
                    }}
                  >
                    <ChevronRight className="w-3 h-3" />
                    Åpne {messageDialog?.entityType === "lead" ? "lead" : "salgsmulighet"}
                  </Button>
                </div>
                <Button
                  size="sm"
                  className="gap-1"
                  onClick={handleSendEmail}
                  disabled={sending || !emailTo}
                >
                  {sending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Send className="w-3 h-3" />
                  )}
                  Send via Gmail
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
