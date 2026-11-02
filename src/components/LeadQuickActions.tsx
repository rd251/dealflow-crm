import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Phone } from "lucide-react";
import LogActivityDialog from "@/components/LogActivityDialog";
import type { Lead } from "@/data/crm-data";

export type LeadUtfall = "ringt" | "ikke-svar" | "ikke-aktuelt";

interface Props {
  lead: Lead;
  /** Kalles etter at et utfall er registrert. */
  onHandled?: (utfall: LeadUtfall) => void;
  /** Beholdt for bakoverkompatibilitet – «Booket møte» ligger nå i loggen. */
  onBookMoete?: () => void;
  size?: "sm" | "default";
  className?: string;
}

/** Ring + én «Logg utfall»-knapp som åpner den felles loggkomponenten. */
export default function LeadQuickActions({ lead, onHandled, size = "sm", className }: Props) {
  const { canEdit } = useAuth();
  const [apen, setApen] = useState(false);
  if (!canEdit) return null;
  const tel = (lead.telefon || "").replace(/\s/g, "");

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        {tel && <Button asChild size={size}><a href={`tel:${tel}`}><Phone className="mr-1.5 h-3.5 w-3.5" />Ring</a></Button>}
        <Button size={size} variant="outline" onClick={() => setApen(true)}>Logg utfall</Button>
      </div>
      <LogActivityDialog open={apen} onOpenChange={setApen} target={{ lead_id: lead.id }} entityName={lead.kontaktperson || lead.firmanavn}
        onLogged={res => onHandled?.(res?.ikkeAktuelt ? "ikke-aktuelt" : "ringt")} />
    </div>
  );
}
