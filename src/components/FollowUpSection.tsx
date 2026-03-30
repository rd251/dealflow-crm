import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { differenceInHours, differenceInDays, format } from "date-fns";
import { nb } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronRight, Mail, Phone, MessageSquare, Clock, Building2,
  Sparkles, X, Send, Loader2, AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FollowUpItem } from "@/hooks/use-follow-ups";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface FollowUpSectionProps {
  items: FollowUpItem[];
  loading: boolean;
  onDismiss: (id: string) => void;
}

export default function FollowUpSection({ items, loading, onDismiss }: FollowUpSectionProps) {
  const navigate = useNavigate();
  const [messageDialog, setMessageDialog] = useState<FollowUpItem | null>(null);
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const typeLabel: Record<string, string> = {
    lead_stale: "Lead inaktiv",
    sm_stale: "Salg inaktiv",
    post_meeting: "Etter møte",
    email_no_reply: "Ubesvart e-post",
  };

  const typeColor: Record<string, string> = {
    lead_stale: "bg-amber-500/10 text-amber-600 border-amber-200",
    sm_stale: "bg-destructive/10 text-destructive border-destructive/20",
    post_meeting: "bg-primary/10 text-primary border-primary/20",
    email_no_reply: "bg-amber-500/10 text-amber-600 border-amber-200",
  };

  const priorityIcon: Record<string, string> = {
    high: "text-destructive",
    medium: "text-amber-500",
    low: "text-muted-foreground",
  };

  const formatInactive = (hours: number) => {
    if (hours >= 24) return `${Math.floor(hours / 24)}d`;
    return `${hours}t`;
  };

  const generateMessage = async (item: FollowUpItem) => {
    setMessageDialog(item);
    setGeneratedMessage("");
    setGenerating(true);
    setCopied(false);

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
        },
      });

      if (error) throw error;
      setGeneratedMessage(data?.message || "Kunne ikke generere melding.");
    } catch {
      setGeneratedMessage("Kunne ikke generere melding. Prøv igjen.");
    } finally {
      setGenerating(false);
    }
  };

  const copyMessage = () => {
    navigator.clipboard.writeText(generatedMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  const [showAll, setShowAll] = useState(false);
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
              {/* Priority dot */}
              <div className={`w-2 h-2 rounded-full shrink-0 ${
                item.priority === "high" ? "bg-destructive" : item.priority === "medium" ? "bg-amber-500" : "bg-muted-foreground"
              }`} />

              {/* Main content */}
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

              {/* Actions */}
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
            <span className="text-xs text-muted-foreground">
              +{items.length - 10} flere oppfølginger
            </span>
          </div>
        )}
      </div>

      {/* Message generation dialog */}
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
              <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed border">
                {generatedMessage}
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={copyMessage}>
                  {copied ? "Kopiert!" : "Kopier"}
                </Button>
                <Button
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
