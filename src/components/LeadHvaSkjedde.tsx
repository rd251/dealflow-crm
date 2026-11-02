import { useAuth } from "@/hooks/use-auth";
import LoggUtfall from "@/components/LoggUtfall";
import type { Lead } from "@/data/crm-data";

interface Props {
  lead: Lead;
  /** Konverter leadet til salgsmulighet (status «Møte booket»). */
  onBooketMoete: (lead: Lead) => void;
}

/** «Hva skjedde?» i lead-panelet – bruker den felles loggkomponenten. */
export default function LeadHvaSkjedde({ lead, onBooketMoete }: Props) {
  const { canEdit } = useAuth();
  if (!canEdit) return null;
  return <LoggUtfall target={{ lead_id: lead.id }} navn={lead.kontaktperson || lead.firmanavn} onBooketMoete={onBooketMoete} />;
}
