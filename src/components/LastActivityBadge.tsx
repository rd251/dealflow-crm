import { useState, useEffect } from "react";
import { Phone, Mail, MessageSquare, MessageCircle, Users, FileText, Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AktivitetType } from "@/components/ActivityLog";

const API_URL = import.meta.env.VITE_SUPABASE_URL + '/rest/v1';
const API_HEADERS = {
  'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
  'Content-Type': 'application/json',
};

const typeIcons: Record<AktivitetType, typeof Phone> = {
  "Telefonsamtale": Phone,
  "E-post": Mail,
  "LinkedIn-melding": MessageSquare,
  "SMS": MessageCircle,
  "Møte": Users,
  "Notat": FileText,
};

const typeColors: Record<AktivitetType, string> = {
  "Telefonsamtale": "text-emerald-600",
  "E-post": "text-blue-600",
  "LinkedIn-melding": "text-sky-600",
  "SMS": "text-violet-600",
  "Møte": "text-amber-600",
  "Notat": "text-muted-foreground",
};

interface LastActivityBadgeProps {
  lead_id?: string;
  salgsmulighet_id?: string;
  selskap_id?: string;
  partner_id?: string;
  prosjekt_id?: string;
  kontakt_id?: string;
  sist_aktivitet?: string;
}

export default function LastActivityBadge(props: LastActivityBadgeProps) {
  const [lastType, setLastType] = useState<AktivitetType | null>(null);

  useEffect(() => {
    const filters: string[] = [];
    if (props.lead_id) filters.push(`lead_id=eq.${props.lead_id}`);
    if (props.salgsmulighet_id) filters.push(`salgsmulighet_id=eq.${props.salgsmulighet_id}`);
    if (props.selskap_id) filters.push(`selskap_id=eq.${props.selskap_id}`);
    if (props.partner_id) filters.push(`partner_id=eq.${props.partner_id}`);
    if (props.prosjekt_id) filters.push(`prosjekt_id=eq.${props.prosjekt_id}`);
    if (props.kontakt_id) filters.push(`kontakt_id=eq.${props.kontakt_id}`);
    if (!filters.length) return;

    fetch(`${API_URL}/aktiviteter?${filters.join("&")}&order=dato.desc&limit=1&select=type`, { headers: API_HEADERS })
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (data.length) setLastType(data[0].type); })
      .catch(() => {});
  }, [props.lead_id, props.salgsmulighet_id, props.selskap_id, props.partner_id, props.prosjekt_id, props.kontakt_id]);

  if (!props.sist_aktivitet) return <span className="text-xs text-muted-foreground">—</span>;

  const formatDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diffD = Math.floor((now.getTime() - date.getTime()) / 86400000);
    if (diffD === 0) return "I dag";
    if (diffD === 1) return "I går";
    if (diffD < 7) return `${diffD}d siden`;
    return date.toLocaleDateString("no-NO", { day: "numeric", month: "short" });
  };

  const Icon = lastType ? typeIcons[lastType] : Clock;
  const color = lastType ? typeColors[lastType] : "text-muted-foreground";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center gap-1 text-xs ${color}`}>
          <Icon className="w-3.5 h-3.5" />
          {formatDate(props.sist_aktivitet)}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">{lastType || "Sist aktivitet"}: {props.sist_aktivitet}</p>
      </TooltipContent>
    </Tooltip>
  );
}
