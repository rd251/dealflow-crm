import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, PenLine, GitBranch, Link2, CheckCircle2, Trash2, Clock } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

const API_URL = import.meta.env.VITE_SUPABASE_URL + '/rest/v1';
const API_HEADERS = {
  'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
  'Content-Type': 'application/json',
};

interface ChangelogEntry {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  related_entity_type: string | null;
  related_entity_name: string | null;
  user_id: string | null;
  created_at: string;
}

interface UserProfile {
  user_id: string;
  display_name: string;
}

const USER_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500",
  "bg-violet-500", "bg-cyan-500", "bg-pink-500", "bg-indigo-500",
];
const getUserColor = (userId: string) => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
};

const eventConfig: Record<string, { icon: typeof Plus; color: string }> = {
  created: { icon: Plus, color: "text-emerald-600 bg-emerald-500/10" },
  updated: { icon: PenLine, color: "text-blue-600 bg-blue-500/10" },
  converted: { icon: GitBranch, color: "text-violet-600 bg-violet-500/10" },
  linked: { icon: Link2, color: "text-sky-600 bg-sky-500/10" },
  completed: { icon: CheckCircle2, color: "text-emerald-600 bg-emerald-500/10" },
  deleted: { icon: Trash2, color: "text-destructive bg-destructive/10" },
};

const entityLabels: Record<string, string> = {
  selskap: "selskap", kontakt: "kontakt", salgsmulighet: "deal",
  lead: "lead", partner: "partner", prosjekt: "prosjekt",
  oppgave: "oppgave", epost: "e-post", møte: "møte",
};

const fieldLabels: Record<string, string> = {
  status: "status", verdi: "verdi", ansvarlig: "ansvarlig",
  kundestatus: "kundestatus", partnerstatus: "partnerstatus",
};

function formatDesc(e: ChangelogEntry, profiles: Record<string, UserProfile>): string {
  const who = e.user_id && profiles[e.user_id] ? profiles[e.user_id].display_name.split(" ")[0] : null;
  const p = who ? `${who} ` : "";
  const ent = entityLabels[e.entity_type] || e.entity_type;

  switch (e.event_type) {
    case "created": return `${p}opprettet ${ent}`;
    case "updated": {
      const f = fieldLabels[e.field_name || ""] || e.field_name || "felt";
      if (e.field_name === "verdi") return `${p}endret ${f} fra ${e.old_value} → ${e.new_value}`;
      return `${p}endret ${f} til '${e.new_value}'`;
    }
    case "converted": return `${p}konverterte til ${e.new_value}`;
    case "linked": return `${p}koblet til ${entityLabels[e.related_entity_type || ""] || ""} '${e.related_entity_name}'`;
    case "completed": return `${p}fullførte oppgave`;
    case "deleted": return `${p}slettet ${ent}`;
    default: return `${e.event_type}`;
  }
}

interface EntityChangelogProps {
  entity_type: string;
  entity_id: string;
}

export default function EntityChangelog({ entity_type, entity_id }: EntityChangelogProps) {
  const { isAdmin } = useAuth();
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    // Endringslogg er låst til admin-rollen i databasen — skip nettverkskall ellers.
    if (!isAdmin) return;
    const fetchEntries = async () => {
      // Fetch entries where this entity is the subject OR related entity
      const [mainRes, relatedRes, profilesRes] = await Promise.all([
        fetch(`${API_URL}/crm_changelog?entity_type=eq.${entity_type}&entity_id=eq.${entity_id}&order=created_at.desc&limit=20`, { headers: API_HEADERS }),
        fetch(`${API_URL}/crm_changelog?related_entity_type=eq.${entity_type}&related_entity_id=eq.${entity_id}&order=created_at.desc&limit=20`, { headers: API_HEADERS }),
        fetch(`${API_URL}/profiles?select=user_id,display_name`, { headers: API_HEADERS }),
      ]);

      const mainData: ChangelogEntry[] = mainRes.ok ? await mainRes.json() : [];
      const relatedData: ChangelogEntry[] = relatedRes.ok ? await relatedRes.json() : [];
      const profileData: UserProfile[] = profilesRes.ok ? await profilesRes.json() : [];

      // Merge and deduplicate
      const allMap = new Map<string, ChangelogEntry>();
      [...mainData, ...relatedData].forEach(e => allMap.set(e.id, e));
      const merged = Array.from(allMap.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setEntries(merged);

      const pMap: Record<string, UserProfile> = {};
      profileData.forEach(p => { pMap[p.user_id] = p; });
      setProfiles(pMap);
    };
    if (entity_id) fetchEntries();
  }, [entity_type, entity_id]);

  if (entries.length === 0) return null;

  // Group consecutive duplicate entries (same event/related/user/field) within 24h
  type Grouped = ChangelogEntry & { count: number; lastAt: string };
  const grouped: Grouped[] = [];
  for (const e of entries) {
    const last = grouped[grouped.length - 1];
    const sameKey = last
      && last.event_type === e.event_type
      && last.entity_type === e.entity_type
      && last.related_entity_type === e.related_entity_type
      && last.related_entity_name === e.related_entity_name
      && last.field_name === e.field_name
      && last.new_value === e.new_value
      && last.user_id === e.user_id;
    const within24h = last && Math.abs(new Date(last.lastAt).getTime() - new Date(e.created_at).getTime()) < 24 * 60 * 60 * 1000;
    if (sameKey && within24h) {
      last.count += 1;
      last.lastAt = e.created_at < last.lastAt ? e.created_at : last.lastAt;
    } else {
      grouped.push({ ...e, count: 1, lastAt: e.created_at });
    }
  }

  const visible = showAll ? grouped : grouped.slice(0, 5);

  return (
    <div className="border-t pt-3 mt-3 space-y-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Endringslogg</span>
      <div className="space-y-1">
        {visible.map(entry => {
          const config = eventConfig[entry.event_type] || eventConfig.updated;
          const Icon = config.icon;
          const desc = formatDesc(entry, profiles);
          const time = format(new Date(entry.created_at), "d. MMM HH:mm", { locale: nb });

          return (
            <div key={entry.id} className="flex items-start gap-2 py-1">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${config.color}`}>
                <Icon className="w-3 h-3" />
              </div>
              <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                {entry.user_id && profiles[entry.user_id] && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white shrink-0 ${getUserColor(entry.user_id)}`}>
                        {profiles[entry.user_id].display_name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">{profiles[entry.user_id].display_name}</TooltipContent>
                  </Tooltip>
                )}
                <span className="text-xs">{desc}</span>
                {entry.count > 1 && (
                  <Badge variant="secondary" className="text-[9px] h-4 px-1.5">×{entry.count}</Badge>
                )}
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 ml-auto shrink-0">
                  <Clock className="w-2.5 h-2.5" />{time}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {grouped.length > 5 && (
        <button onClick={() => setShowAll(!showAll)} className="text-xs text-primary hover:underline">
          {showAll ? "Vis mindre" : `Vis alle (${grouped.length})`}
        </button>
      )}
    </div>
  );
}
