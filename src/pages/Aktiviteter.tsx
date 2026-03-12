import { useState, useEffect, useCallback } from "react";
import PageShell from "@/components/PageShell";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCrmStore } from "@/hooks/use-crm-store";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, Mail, MessageSquare, MessageCircle, Users, FileText, Search, Clock, Filter, Building2, UserPlus, Handshake, FolderKanban, Users2 } from "lucide-react";
import type { AktivitetType } from "@/components/ActivityLog";

const API_URL = import.meta.env.VITE_SUPABASE_URL + '/rest/v1';
const API_HEADERS = {
  'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
  'Content-Type': 'application/json',
};

interface AktivitetRow {
  id: string;
  type: AktivitetType;
  beskrivelse: string;
  dato: string;
  lead_id: string | null;
  salgsmulighet_id: string | null;
  selskap_id: string | null;
  partner_id: string | null;
  prosjekt_id: string | null;
  kontakt_id: string | null;
}

const typeIcons: Record<AktivitetType, typeof Phone> = {
  "Telefonsamtale": Phone,
  "E-post": Mail,
  "LinkedIn-melding": MessageSquare,
  "SMS": MessageCircle,
  "Møte": Users,
  "Notat": FileText,
};

const typeColors: Record<AktivitetType, string> = {
  "Telefonsamtale": "text-emerald-600 bg-emerald-500/10",
  "E-post": "text-blue-600 bg-blue-500/10",
  "LinkedIn-melding": "text-sky-600 bg-sky-500/10",
  "SMS": "text-violet-600 bg-violet-500/10",
  "Møte": "text-amber-600 bg-amber-500/10",
  "Notat": "text-muted-foreground bg-muted",
};

const typeOptions: AktivitetType[] = ["Telefonsamtale", "E-post", "LinkedIn-melding", "SMS", "Møte", "Notat"];

type EntityFilter = "alle" | "lead" | "salgsmulighet" | "selskap" | "partner" | "prosjekt" | "kontakt";

const entityLabels: Record<EntityFilter, string> = {
  alle: "Alle entiteter",
  lead: "Leads",
  salgsmulighet: "Salgsmuligheter",
  selskap: "Selskaper",
  partner: "Partnere",
  prosjekt: "Prosjekter",
  kontakt: "Kontakter",
};

const entityIcons: Record<EntityFilter, typeof Phone> = {
  alle: Filter,
  lead: UserPlus,
  salgsmulighet: Handshake,
  selskap: Building2,
  partner: Users2,
  prosjekt: FolderKanban,
  kontakt: Users,
};

export default function Aktiviteter() {
  const isMobile = useIsMobile();
  const { leads, salgsmuligheter, selskaper, partnere, prosjekter, kontakter } = useCrmStore();
  const [aktiviteter, setAktiviteter] = useState<AktivitetRow[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<AktivitetType | "alle">("alle");
  const [entityFilter, setEntityFilter] = useState<EntityFilter>("alle");
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/aktiviteter?order=dato.desc&select=id,type,beskrivelse,dato,lead_id,salgsmulighet_id,selskap_id,partner_id,prosjekt_id,kontakt_id&limit=500`,
        { headers: API_HEADERS }
      );
      if (res.ok) setAktiviteter(await res.json());
    } catch (e) {
      console.error("Error fetching aktiviteter:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const getEntityName = (a: AktivitetRow): { label: string; type: string } => {
    if (a.lead_id) {
      const l = leads.find(x => x.id === a.lead_id);
      return { label: l?.firmanavn || "Lead", type: "Lead" };
    }
    if (a.salgsmulighet_id) {
      const s = salgsmuligheter.find(x => x.id === a.salgsmulighet_id);
      return { label: s?.navn || "Salgsmulighet", type: "Salgsmulighet" };
    }
    if (a.selskap_id) {
      const s = selskaper.find(x => x.id === a.selskap_id);
      return { label: s?.firmanavn || "Selskap", type: "Selskap" };
    }
    if (a.partner_id) {
      const p = partnere.find(x => x.id === a.partner_id);
      return { label: p?.partnernavn || "Partner", type: "Partner" };
    }
    if (a.prosjekt_id) {
      const p = prosjekter.find(x => x.id === a.prosjekt_id);
      return { label: p?.prosjektnavn || "Prosjekt", type: "Prosjekt" };
    }
    if (a.kontakt_id) {
      const k = kontakter.find(x => x.id === a.kontakt_id);
      return { label: k?.navn || "Kontakt", type: "Kontakt" };
    }
    return { label: "Ukjent", type: "" };
  };

  const filtered = aktiviteter.filter(a => {
    if (typeFilter !== "alle" && a.type !== typeFilter) return false;
    if (entityFilter !== "alle") {
      const map: Record<EntityFilter, string | null> = {
        alle: null, lead: a.lead_id, salgsmulighet: a.salgsmulighet_id,
        selskap: a.selskap_id, partner: a.partner_id, prosjekt: a.prosjekt_id, kontakt: a.kontakt_id,
      };
      if (!map[entityFilter]) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const entity = getEntityName(a);
      return a.beskrivelse.toLowerCase().includes(q) || entity.label.toLowerCase().includes(q) || a.type.toLowerCase().includes(q);
    }
    return true;
  });

  const formatDato = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Nå";
    if (diffMin < 60) return `${diffMin} min siden`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}t siden`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d siden`;
    return date.toLocaleDateString("no-NO", { day: "numeric", month: "short", year: diffD > 365 ? "numeric" : undefined });
  };

  const formatFullDate = (d: string) => {
    return new Date(d).toLocaleDateString("no-NO", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  // Group by date
  const grouped: Record<string, AktivitetRow[]> = {};
  filtered.forEach(a => {
    const dateKey = new Date(a.dato).toLocaleDateString("no-NO", { day: "numeric", month: "long", year: "numeric" });
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(a);
  });

  const entityBadgeColor: Record<string, string> = {
    Lead: "bg-stage-new-lead/10 text-stage-new-lead border-stage-new-lead/20",
    Salgsmulighet: "bg-primary/10 text-primary border-primary/20",
    Selskap: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    Partner: "bg-violet-500/10 text-violet-600 border-violet-500/20",
    Prosjekt: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    Kontakt: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  };

  return (
    <PageShell title="Aktivitetslogg" subtitle={`${filtered.length} aktiviteter`}>
      {/* Filters */}
      <div className={`flex ${isMobile ? "flex-col gap-2" : "items-center gap-3"} mb-6`}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Søk i aktiviteter..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={v => setTypeFilter(v as any)}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle typer</SelectItem>
            {typeOptions.map(t => {
              const Icon = typeIcons[t];
              return <SelectItem key={t} value={t}>{t}</SelectItem>;
            })}
          </SelectContent>
        </Select>
        <Select value={entityFilter} onValueChange={v => setEntityFilter(v as EntityFilter)}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(entityLabels) as EntityFilter[]).map(key => (
              <SelectItem key={key} value={key}>{entityLabels[key]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Activity list */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Laster aktiviteter...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Filter className="w-8 h-8 mb-2 opacity-40" />
          <p className="text-sm">Ingen aktiviteter funnet</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 py-2 mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{dateLabel}</h3>
              </div>
              <div className="space-y-1">
                {items.map(a => {
                  const Icon = typeIcons[a.type] || FileText;
                  const entity = getEntityName(a);
                  return (
                    <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${typeColors[a.type]}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{a.type}</span>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${entityBadgeColor[entity.type] || ""}`}>
                            {entity.type}: {entity.label}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-0.5 ml-auto shrink-0">
                            <Clock className="w-3 h-3" />
                            {formatDato(a.dato)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-line line-clamp-2">{a.beskrivelse}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
