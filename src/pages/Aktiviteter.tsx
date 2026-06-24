import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, Filter, CalendarDays, Loader2, Plus, ArrowRightLeft, Link2, CheckCircle2, Trash2, PenLine, GitBranch, Building2, User, Briefcase, Target, Handshake, FolderKanban, ListTodo, Mail, Users } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

const API_URL = import.meta.env.VITE_SUPABASE_URL + '/rest/v1';
const API_HEADERS = {
  'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
  'Content-Type': 'application/json',
};

const PAGE_SIZE = 100;

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
  related_entity_id: string | null;
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

// Event type config
const eventConfig: Record<string, { icon: typeof Plus; color: string; label: string }> = {
  created: { icon: Plus, color: "text-emerald-600 bg-emerald-500/10", label: "Opprettet" },
  updated: { icon: PenLine, color: "text-blue-600 bg-blue-500/10", label: "Endret" },
  converted: { icon: GitBranch, color: "text-violet-600 bg-violet-500/10", label: "Konvertert" },
  linked: { icon: Link2, color: "text-sky-600 bg-sky-500/10", label: "Koblet" },
  completed: { icon: CheckCircle2, color: "text-emerald-600 bg-emerald-500/10", label: "Fullført" },
  deleted: { icon: Trash2, color: "text-destructive bg-destructive/10", label: "Slettet" },
};

const entityIcons: Record<string, typeof Building2> = {
  selskap: Building2,
  kontakt: User,
  salgsmulighet: Target,
  lead: Briefcase,
  partner: Handshake,
  prosjekt: FolderKanban,
  oppgave: ListTodo,
  epost: Mail,
  møte: Users,
};

const entityLabels: Record<string, string> = {
  selskap: "Selskap",
  kontakt: "Kontakt",
  salgsmulighet: "Salgsmulighet",
  lead: "Lead",
  partner: "Partner",
  prosjekt: "Prosjekt",
  oppgave: "Oppgave",
  epost: "E-post",
  møte: "Møte",
};

const entityBadgeColor: Record<string, string> = {
  selskap: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  kontakt: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  salgsmulighet: "bg-primary/10 text-primary border-primary/20",
  lead: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  partner: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  prosjekt: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  oppgave: "bg-muted text-muted-foreground border-border",
  epost: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  møte: "bg-amber-500/10 text-amber-600 border-amber-500/20",
};

const fieldLabels: Record<string, string> = {
  status: "status",
  verdi: "verdi",
  ansvarlig: "ansvarlig",
  kundestatus: "kundestatus",
  partnerstatus: "partnerstatus",
};

function formatChangeDescription(entry: ChangelogEntry, profiles: Record<string, UserProfile>): string {
  const userName = entry.user_id && profiles[entry.user_id]
    ? profiles[entry.user_id].display_name.split(" ")[0]
    : null;
  const prefix = userName ? `${userName} ` : "";
  const entLabel = entityLabels[entry.entity_type] || entry.entity_type;

  switch (entry.event_type) {
    case "created":
      return `${prefix}opprettet ${entLabel.toLowerCase()} '${entry.entity_name}'`;
    case "updated": {
      const field = fieldLabels[entry.field_name || ""] || entry.field_name || "felt";
      if (entry.field_name === "verdi") {
        return `${prefix}endret ${field} på '${entry.entity_name}' fra ${entry.old_value} → ${entry.new_value}`;
      }
      return `${prefix}endret ${field} på '${entry.entity_name}' til '${entry.new_value}'`;
    }
    case "converted":
      return `${prefix}konverterte lead '${entry.entity_name}' til ${entry.new_value}`;
    case "linked": {
      const relLabel = entityLabels[entry.related_entity_type || ""] || entry.related_entity_type || "";
      return `${prefix}koblet ${entLabel.toLowerCase()} '${entry.entity_name}' til ${relLabel.toLowerCase()} '${entry.related_entity_name}'`;
    }
    case "completed":
      return `${prefix}fullførte oppgave '${entry.entity_name}'`;
    case "deleted":
      return `${prefix}slettet ${entLabel.toLowerCase()} '${entry.entity_name}'`;
    default:
      return `${entry.event_type} - ${entry.entity_name}`;
  }
}

function getEntityPath(entityType: string, entityId: string): string | null {
  switch (entityType) {
    case "selskap": return `/selskaper/${entityId}`;
    case "lead": return `/leads`;
    case "salgsmulighet": return `/salgsmuligheter`;
    case "kontakt": return `/kontakter`;
    case "partner": return `/partnere/${entityId}`;
    case "prosjekt": return `/prosjekter`;
    default: return null;
  }
}

type EventFilter = "alle" | "created" | "updated" | "converted" | "linked" | "completed" | "deleted";
type EntityTypeFilter = "alle" | "selskap" | "kontakt" | "salgsmulighet" | "lead" | "partner" | "prosjekt" | "oppgave";

export default function Aktiviteter() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [selskapLookup, setSelskapLookup] = useState<Record<string, string>>({});
  const [entitySelskapMap, setEntitySelskapMap] = useState<Record<string, string>>({});
  const [entityKontaktMap, setEntityKontaktMap] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState<EventFilter>("alle");
  const [entityTypeFilter, setEntityTypeFilter] = useState<EntityTypeFilter>("alle");
  const [userFilter, setUserFilter] = useState<string>("alle");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const loaderRef = useRef<HTMLDivElement>(null);

  const buildUrl = useCallback((currentOffset: number) => {
    let url = `${API_URL}/crm_changelog?order=created_at.desc&limit=${PAGE_SIZE}&offset=${currentOffset}`;
    if (dateFrom) url += `&created_at=gte.${dateFrom.toISOString()}`;
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      url += `&created_at=lte.${end.toISOString()}`;
    }
    if (eventFilter !== "alle") url += `&event_type=eq.${eventFilter}`;
    if (entityTypeFilter !== "alle") url += `&entity_type=eq.${entityTypeFilter}`;
    if (userFilter !== "alle") url += `&user_id=eq.${userFilter}`;
    return url;
  }, [dateFrom, dateTo, eventFilter, entityTypeFilter, userFilter]);

  const fetchAll = useCallback(async (reset = true) => {
    if (!isAdmin) { setLoading(false); return; }
    const newOffset = reset ? 0 : offset;
    if (reset) { setLoading(true); setOffset(0); } else { setLoadingMore(true); }
    try {
      const res = await fetch(buildUrl(newOffset), { headers: API_HEADERS });
      if (res.ok) {
        const data: ChangelogEntry[] = await res.json();
        if (reset) setEntries(data); else setEntries(prev => [...prev, ...data]);
        setHasMore(data.length === PAGE_SIZE);
        setOffset(newOffset + data.length);
      }
    } catch (e) {
      console.error("Error fetching changelog:", e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [buildUrl, offset, isAdmin]);

  useEffect(() => { fetchAll(true); }, [dateFrom, dateTo, eventFilter, entityTypeFilter, userFilter, isAdmin]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('crm_changelog_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_changelog' }, (payload) => {
        setEntries(prev => [payload.new as ChangelogEntry, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Profiles
  useEffect(() => {
    supabase.from('profiles').select('user_id,display_name')
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, UserProfile> = {};
        data.forEach(p => { map[p.user_id] = p; });
        setProfiles(map);
      });

    // Fetch selskaper for name lookup
    fetch(`${API_URL}/selskaper?select=id,firmanavn`, { headers: API_HEADERS })
      .then(r => r.ok ? r.json() : [])
      .then((data: { id: string; firmanavn: string }[]) => {
        const map: Record<string, string> = {};
        data.forEach(s => { map[s.id] = s.firmanavn; });
        setSelskapLookup(map);
      })
      .catch(() => {});

    // Fetch salgsmuligheter for selskap_id + kontaktperson mapping
    fetch(`${API_URL}/salgsmuligheter?select=id,selskap_id,kontaktperson`, { headers: API_HEADERS })
      .then(r => r.ok ? r.json() : [])
      .then((data: { id: string; selskap_id: string | null; kontaktperson: string | null }[]) => {
        const sMap: Record<string, string> = {};
        const kMap: Record<string, string> = {};
        data.forEach(sm => {
          if (sm.selskap_id) sMap[`salgsmulighet:${sm.id}`] = sm.selskap_id;
          if (sm.kontaktperson) kMap[`salgsmulighet:${sm.id}`] = sm.kontaktperson;
        });
        setEntitySelskapMap(prev => ({ ...prev, ...sMap }));
        setEntityKontaktMap(prev => ({ ...prev, ...kMap }));
      })
      .catch(() => {});

    // Fetch leads for kontaktperson mapping
    fetch(`${API_URL}/leads?select=id,kontaktperson`, { headers: API_HEADERS })
      .then(r => r.ok ? r.json() : [])
      .then((data: { id: string; kontaktperson: string | null }[]) => {
        const kMap: Record<string, string> = {};
        data.forEach(l => {
          if (l.kontaktperson) kMap[`lead:${l.id}`] = l.kontaktperson;
        });
        setEntityKontaktMap(prev => ({ ...prev, ...kMap }));
      })
      .catch(() => {});
  }, []);

  // Infinite scroll
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
        fetchAll(false);
      }
    }, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, offset]);

  // Client-side search filter
  const filtered = search
    ? entries.filter(e => {
        const q = search.toLowerCase();
        return e.entity_name.toLowerCase().includes(q) ||
          (e.related_entity_name || "").toLowerCase().includes(q) ||
          formatChangeDescription(e, profiles).toLowerCase().includes(q);
      })
    : entries;

  // Group by day
  const grouped: Record<string, ChangelogEntry[]> = {};
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const todayStr = today.toISOString().split("T")[0];
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  filtered.forEach(e => {
    const dateStr = new Date(e.created_at).toISOString().split("T")[0];
    let label: string;
    if (dateStr === todayStr) label = "I dag";
    else if (dateStr === yesterdayStr) label = "I går";
    else label = new Date(e.created_at).toLocaleDateString("no-NO", { day: "numeric", month: "long", year: "numeric" });
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(e);
  });

  const clearDateFilter = () => { setDateFrom(undefined); setDateTo(undefined); };
  const hasDateFilter = dateFrom || dateTo;

  return (
    <PageShell title="Endringslogg" subtitle={`${filtered.length} hendelser`}>
      {/* Filters */}
      <div className={`flex ${isMobile ? "flex-col gap-2" : "items-center gap-3"} mb-6`}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Søk i endringslogg..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={eventFilter} onValueChange={v => setEventFilter(v as EventFilter)}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle hendelser</SelectItem>
            <SelectItem value="created">Opprettet</SelectItem>
            <SelectItem value="updated">Endringer</SelectItem>
            <SelectItem value="converted">Konverteringer</SelectItem>
            <SelectItem value="linked">Koblinger</SelectItem>
            <SelectItem value="completed">Fullført</SelectItem>
            <SelectItem value="deleted">Slettet</SelectItem>
          </SelectContent>
        </Select>
        <Select value={entityTypeFilter} onValueChange={v => setEntityTypeFilter(v as EntityTypeFilter)}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle entiteter</SelectItem>
            <SelectItem value="selskap">Selskaper</SelectItem>
            <SelectItem value="salgsmulighet">Salgsmuligheter</SelectItem>
            <SelectItem value="lead">Leads</SelectItem>
            <SelectItem value="kontakt">Kontakter</SelectItem>
            <SelectItem value="partner">Partnere</SelectItem>
            <SelectItem value="prosjekt">Prosjekter</SelectItem>
            <SelectItem value="oppgave">Oppgaver</SelectItem>
          </SelectContent>
        </Select>
        <Select value={userFilter} onValueChange={v => setUserFilter(v)}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle brukere</SelectItem>
            {Object.values(profiles).map(p => (
              <SelectItem key={p.user_id} value={p.user_id}>{p.display_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant={hasDateFilter ? "default" : "outline"} size="sm" className="h-9 gap-2 text-xs">
              <CalendarDays className="w-4 h-4" />
              {hasDateFilter
                ? `${dateFrom ? format(dateFrom, "d. MMM", { locale: nb }) : "..."} – ${dateTo ? format(dateTo, "d. MMM", { locale: nb }) : "..."}`
                : "Datofilter"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4" align="end">
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Fra</label>
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={nb} className="rounded-md border" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Til</label>
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} locale={nb} className="rounded-md border" />
              </div>
              {hasDateFilter && (
                <Button variant="ghost" size="sm" onClick={clearDateFilter} className="w-full text-xs">Fjern datofilter</Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Changelog list */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Laster endringslogg...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Filter className="w-8 h-8 mb-2 opacity-40" />
          <p className="text-sm">Ingen hendelser funnet</p>
          <p className="text-xs mt-1">Endringer i CRM-et vil dukke opp her automatisk</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 py-2 mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{dateLabel}</h3>
              </div>
              <div className="space-y-1">
                {items.map(entry => {
                  const config = eventConfig[entry.event_type] || eventConfig.updated;
                  const Icon = config.icon;
                  const EntityIcon = entityIcons[entry.entity_type] || Briefcase;
                  const description = formatChangeDescription(entry, profiles);
                  const entityPath = getEntityPath(entry.entity_type, entry.entity_id);
                  const time = new Date(entry.created_at).toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" });

                  return (
                    <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group">
                      {/* Event icon */}
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${config.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* User avatar */}
                          {entry.user_id && profiles[entry.user_id] && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0 ${getUserColor(entry.user_id)}`}>
                                  {profiles[entry.user_id].display_name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                {profiles[entry.user_id].display_name}
                              </TooltipContent>
                            </Tooltip>
                          )}

                          {/* Description */}
                          <span className="text-sm">{description}</span>

                          {/* Entity badge */}
                          {entityPath && (
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 h-5 cursor-pointer transition-colors hover:opacity-80 ${entityBadgeColor[entry.entity_type] || ""}`}
                              onClick={() => navigate(entityPath)}
                            >
                              <EntityIcon className="w-3 h-3 mr-1" />
                              {entry.entity_name}
                            </Badge>
                          )}

                          {/* Company context for salgsmulighet/lead */}
                          {(entry.entity_type === "salgsmulighet" || entry.entity_type === "lead") && (() => {
                            const selskapId = entitySelskapMap[`${entry.entity_type}:${entry.entity_id}`];
                            const selskapName = selskapId ? selskapLookup[selskapId] : null;
                            const kontaktperson = entityKontaktMap[`${entry.entity_type}:${entry.entity_id}`];
                            return (
                              <>
                                {selskapName && (
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] px-1.5 py-0 h-5 cursor-pointer transition-colors hover:opacity-80 ${entityBadgeColor.selskap}`}
                                    onClick={() => navigate(`/selskaper/${selskapId}`)}
                                  >
                                    <Building2 className="w-3 h-3 mr-1" />
                                    {selskapName}
                                  </Badge>
                                )}
                                {kontaktperson && (
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                    <User className="w-3 h-3" />
                                    {kontaktperson}
                                  </span>
                                )}
                              </>
                            );
                          })()}

                          {/* Related entity badge */}
                          {entry.related_entity_type && entry.related_entity_name && (() => {
                            const relPath = getEntityPath(entry.related_entity_type, entry.related_entity_id || "");
                            return (
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 h-5 transition-colors ${relPath ? "cursor-pointer hover:opacity-80" : ""} ${entityBadgeColor[entry.related_entity_type] || ""}`}
                                onClick={() => relPath && navigate(relPath)}
                              >
                                {entry.related_entity_name}
                              </Badge>
                            );
                          })()}

                          {/* Old → New for updates */}
                          {entry.event_type === "updated" && entry.old_value && entry.new_value && entry.field_name !== "verdi" && (
                            <span className="text-[11px] text-muted-foreground">
                              <span className="line-through opacity-60">{entry.old_value}</span>
                              {" → "}
                              <span className="font-medium text-foreground">{entry.new_value}</span>
                            </span>
                          )}

                          {/* Time */}
                          <span className="text-[11px] text-muted-foreground ml-auto shrink-0">{time}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Infinite scroll loader */}
          <div ref={loaderRef} className="py-4 flex items-center justify-center">
            {loadingMore && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Laster flere...
              </div>
            )}
            {!hasMore && filtered.length > 0 && (
              <p className="text-xs text-muted-foreground">Alle hendelser er lastet</p>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}
