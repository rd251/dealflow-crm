import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCrmStore } from "@/hooks/use-crm-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, Link2 } from "lucide-react";
import { toast } from "sonner";

interface DealSuggestionsProps {
  selskapId: string | null;
  kontaktId: string | null;
  email: string;
  currentSalgsmulighetId: string | null;
  onLinked: () => void;
}

export default function DealSuggestions({ selskapId, kontaktId, email, currentSalgsmulighetId, onLinked }: DealSuggestionsProps) {
  const { salgsmuligheter, refresh } = useCrmStore();
  const [linking, setLinking] = useState(false);

  const openDeals = useMemo(() => {
    if (!selskapId) return [];
    return salgsmuligheter
      .filter(s =>
        s.selskap_id === selskapId &&
        s.status !== "Vunnet" &&
        s.status !== "Tapt"
      )
      .sort((a, b) => {
        // Prioritize by last activity, then by creation date
        const dateA = a.sist_aktivitet || a.opprettet_dato || "";
        const dateB = b.sist_aktivitet || b.opprettet_dato || "";
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
  }, [selskapId, salgsmuligheter]);

  if (!selskapId || openDeals.length === 0) return null;

  const linkToDeal = async (dealId: string) => {
    setLinking(true);
    try {
      // Update salgsmulighet with kontakt_id
      if (kontaktId) {
        await supabase
          .from("salgsmuligheter")
          .update({ kontakt_id: kontaktId, e_post: email })
          .eq("id", dealId);
      }

      // Update email_contacts with salgsmulighet_id
      await supabase
        .from("email_contacts")
        .update({ salgsmulighet_id: dealId })
        .eq("primary_email", email);

      toast.success("Koblet til salgsmulighet");
      refresh();
      onLinked();
    } catch (err: any) {
      toast.error("Kunne ikke koble: " + (err.message || "Ukjent feil"));
    } finally {
      setLinking(false);
    }
  };

  const STATUS_COLORS: Record<string, string> = {
    "Møte booket": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
    "Behov avklart": "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
    "Løsning presentert": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    "Kontrakt sendt": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Briefcase className="w-4 h-4 text-muted-foreground" />
        Åpne salgsmuligheter
      </div>
      <div className="space-y-1.5">
        {openDeals.map(deal => (
          <div
            key={deal.id}
            className="flex items-center gap-2 p-2 rounded-lg border hover:bg-muted/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{deal.navn}</div>
              <div className="text-xs text-muted-foreground">
                {deal.forventet_mrr ? `${deal.forventet_mrr.toLocaleString("nb-NO")} kr/mnd` : ""}
                {deal.ansvarlig ? ` · ${deal.ansvarlig}` : ""}
              </div>
            </div>
            <Badge variant="secondary" className={`text-[10px] shrink-0 ${STATUS_COLORS[deal.status || ""] || ""}`}>
              {deal.status}
            </Badge>
            {currentSalgsmulighetId === deal.id ? (
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 shrink-0">
                Koblet
              </Badge>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                onClick={() => linkToDeal(deal.id)}
                disabled={linking}
                title="Knytt til denne dealen"
              >
                <Link2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
