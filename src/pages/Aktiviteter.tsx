import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import PageShell from "@/components/PageShell";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCrmStore } from "@/hooks/use-crm-store";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Phone, Mail, MessageSquare, MessageCircle, Users, FileText, Search, Clock, Filter, Plus, MoreHorizontal, Pencil, Trash2, CalendarDays, Loader2, ArrowDown } from "lucide-react";
import { typeIcons, typeColors, typeOptions, type AktivitetType } from "@/components/ActivityLog";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

const API_URL = import.meta.env.VITE_SUPABASE_URL + '/rest/v1';
const API_HEADERS = {
  'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
  'Content-Type': 'application/json',
};

const PAGE_SIZE = 50;

interface AktivitetRow {
  id: string;
  type: AktivitetType;
  beskrivelse: string;
  dato: string;
  tittel: string | null;
  aktivitet_kilde: string | null;
  ekstern_provider: string | null;
  lead_id: string | null;
  salgsmulighet_id: string | null;
  selskap_id: string | null;
  partner_id: string | null;
  prosjekt_id: string | null;
  kontakt_id: string | null;
  user_id: string | null;
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

type EntityFilter = "alle" | "lead" | "salgsmulighet" | "selskap" | "partner" | "prosjekt" | "kontakt";

const entityLabels: Record<EntityFilter, string> = {
  alle: "Alle entiteter", lead: "Leads", salgsmulighet: "Salgsmuligheter",
  selskap: "Selskaper", partner: "Partnere", prosjekt: "Prosjekter", kontakt: "Kontakter",
};

const entityBadgeColor: Record<string, string> = {
  Lead: "bg-stage-new-lead/10 text-stage-new-lead border-stage-new-lead/20 hover:bg-stage-new-lead/20 cursor-pointer",
  Salgsmulighet: "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 cursor-pointer",
  Selskap: "bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20 cursor-pointer",
  Partner: "bg-violet-500/10 text-violet-600 border-violet-500/20 hover:bg-violet-500/20 cursor-pointer",
  Prosjekt: "bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20 cursor-pointer",
  Kontakt: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20 cursor-pointer",
};

export default function Aktiviteter() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { leads, salgsmuligheter, selskaper, partnere, prosjekter, kontakter } = useCrmStore();
  const [aktiviteter, setAktiviteter] = useState<AktivitetRow[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<AktivitetType | "alle">("alle");
  const [entityFilter, setEntityFilter] = useState<EntityFilter>("alle");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const loaderRef = useRef<HTMLDivElement>(null);

  // Edit/delete state
  const [editDialog, setEditDialog] = useState<AktivitetRow | null>(null);
  const [editType, setEditType] = useState<AktivitetType>("Telefonsamtale");
  const [editBeskrivelse, setEditBeskrivelse] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Create state
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<AktivitetType>("Telefonsamtale");
  const [createBeskrivelse, setCreateBeskrivelse] = useState("");
  const [createEntityType, setCreateEntityType] = useState<EntityFilter>("alle");
  const [createEntityId, setCreateEntityId] = useState<string>("");
  const [createLoading, setCreateLoading] = useState(false);

  const buildUrl = useCallback((currentOffset: number) => {
    let url = `${API_URL}/aktiviteter?order=dato.desc&select=id,type,beskrivelse,dato,tittel,aktivitet_kilde,ekstern_provider,lead_id,salgsmulighet_id,selskap_id,partner_id,prosjekt_id,kontakt_id&limit=${PAGE_SIZE}&offset=${currentOffset}`;
    if (dateFrom) url += `&dato=gte.${dateFrom.toISOString()}`;
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      url += `&dato=lte.${end.toISOString()}`;
    }
    return url;
  }, [dateFrom, dateTo]);

  const fetchAll = useCallback(async (reset = true) => {
    const newOffset = reset ? 0 : offset;
    if (reset) {
      setLoading(true);
      setOffset(0);
    } else {
      setLoadingMore(true);
    }
    try {
      const res = await fetch(buildUrl(newOffset), { headers: API_HEADERS });
      if (res.ok) {
        const data: AktivitetRow[] = await res.json();
        if (reset) {
          setAktiviteter(data);
        } else {
          setAktiviteter(prev => [...prev, ...data]);
        }
        setHasMore(data.length === PAGE_SIZE);
        setOffset(newOffset + data.length);
      }
    } catch (e) {
      console.error("Error fetching aktiviteter:", e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [buildUrl, offset]);

  useEffect(() => { fetchAll(true); }, [dateFrom, dateTo]);

  const loadMore = () => {
    if (!loadingMore && hasMore) fetchAll(false);
  };

  // Infinite scroll observer
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
        loadMore();
      }
    }, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, offset]);

  const getEntityName = (a: AktivitetRow): { label: string; type: string; path: string | null } => {
    if (a.lead_id) {
      const l = leads.find(x => x.id === a.lead_id);
      return { label: l?.firmanavn || "Lead", type: "Lead", path: `/leads` };
    }
    if (a.salgsmulighet_id) {
      const s = salgsmuligheter.find(x => x.id === a.salgsmulighet_id);
      return { label: s?.navn || "Salgsmulighet", type: "Salgsmulighet", path: `/salgsmuligheter` };
    }
    if (a.selskap_id) {
      return { label: selskaper.find(x => x.id === a.selskap_id)?.firmanavn || "Selskap", type: "Selskap", path: `/selskaper/${a.selskap_id}` };
    }
    if (a.partner_id) {
      return { label: partnere.find(x => x.id === a.partner_id)?.partnernavn || "Partner", type: "Partner", path: `/partnere/${a.partner_id}` };
    }
    if (a.prosjekt_id) {
      return { label: prosjekter.find(x => x.id === a.prosjekt_id)?.prosjektnavn || "Prosjekt", type: "Prosjekt", path: `/prosjekter` };
    }
    if (a.kontakt_id) {
      return { label: kontakter.find(x => x.id === a.kontakt_id)?.navn || "Kontakt", type: "Kontakt", path: `/kontakter` };
    }
    return { label: "Ukjent", type: "", path: null };
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
      const title = a.tittel || "";
      return a.beskrivelse.toLowerCase().includes(q) || entity.label.toLowerCase().includes(q) || a.type.toLowerCase().includes(q) || title.toLowerCase().includes(q);
    }
    return true;
  });

  const formatDato = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) {
      // Future date
      return date.toLocaleDateString("no-NO", { day: "numeric", month: "short" });
    }
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Nå";
    if (diffMin < 60) return `${diffMin} min siden`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}t siden`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d siden`;
    return date.toLocaleDateString("no-NO", { day: "numeric", month: "short", year: diffD > 365 ? "numeric" : undefined });
  };

  const grouped: Record<string, AktivitetRow[]> = {};
  filtered.forEach(a => {
    const dateKey = new Date(a.dato).toLocaleDateString("no-NO", { day: "numeric", month: "long", year: "numeric" });
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(a);
  });

  const openEdit = (a: AktivitetRow) => {
    setEditDialog(a);
    setEditType(a.type);
    setEditBeskrivelse(a.beskrivelse);
  };

  const saveEdit = async () => {
    if (!editDialog || !editBeskrivelse.trim()) return;
    setEditLoading(true);
    try {
      await fetch(`${API_URL}/aktiviteter?id=eq.${editDialog.id}`, {
        method: 'PATCH',
        headers: { ...API_HEADERS, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ type: editType, beskrivelse: editBeskrivelse.trim() }),
      });
      await fetchAll(true);
      setEditDialog(null);
    } catch (e) {
      console.error("Error updating aktivitet:", e);
    } finally {
      setEditLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await fetch(`${API_URL}/aktiviteter?id=eq.${deleteId}`, {
        method: 'DELETE',
        headers: { ...API_HEADERS, 'Prefer': 'return=minimal' },
      });
      await fetchAll(true);
      setDeleteId(null);
    } catch (e) {
      console.error("Error deleting aktivitet:", e);
    }
  };

  const getEntityOptions = () => {
    switch (createEntityType) {
      case "lead": return leads.map(l => ({ id: l.id, label: l.firmanavn }));
      case "salgsmulighet": return salgsmuligheter.map(s => ({ id: s.id, label: s.navn }));
      case "selskap": return selskaper.map(s => ({ id: s.id, label: s.firmanavn }));
      case "partner": return partnere.map(p => ({ id: p.id, label: p.partnernavn }));
      case "prosjekt": return prosjekter.map(p => ({ id: p.id, label: p.prosjektnavn }));
      case "kontakt": return kontakter.map(k => ({ id: k.id, label: k.navn }));
      default: return [];
    }
  };

  const saveCreate = async () => {
    if (!createBeskrivelse.trim()) return;
    setCreateLoading(true);
    try {
      const body: Record<string, any> = { type: createType, beskrivelse: createBeskrivelse.trim(), user_id: user?.id || null };
      if (createEntityType !== "alle" && createEntityId) {
        const keyMap: Record<string, string> = {
          lead: "lead_id", salgsmulighet: "salgsmulighet_id", selskap: "selskap_id",
          partner: "partner_id", prosjekt: "prosjekt_id", kontakt: "kontakt_id",
        };
        body[keyMap[createEntityType]] = createEntityId;
      }
      await fetch(`${API_URL}/aktiviteter`, {
        method: 'POST',
        headers: { ...API_HEADERS, 'Prefer': 'return=minimal' },
        body: JSON.stringify(body),
      });
      await fetchAll(true);
      setCreateOpen(false);
      setCreateBeskrivelse("");
      setCreateEntityType("alle");
      setCreateEntityId("");
    } catch (e) {
      console.error("Error creating aktivitet:", e);
    } finally {
      setCreateLoading(false);
    }
  };

  const clearDateFilter = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const hasDateFilter = dateFrom || dateTo;

  return (
    <PageShell title="Aktivitetslogg" subtitle={`${filtered.length} aktiviteter`}>
      {/* Filters */}
      <div className={`flex ${isMobile ? "flex-col gap-2" : "items-center gap-3"} mb-6`}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Søk i aktiviteter..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={typeFilter} onValueChange={v => setTypeFilter(v as any)}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle typer</SelectItem>
            {typeOptions.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={entityFilter} onValueChange={v => setEntityFilter(v as EntityFilter)}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(entityLabels) as EntityFilter[]).map(key => (
              <SelectItem key={key} value={key}>{entityLabels[key]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date range filter */}
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
                <Button variant="ghost" size="sm" onClick={clearDateFilter} className="w-full text-xs">
                  Fjern datofilter
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <Button size="sm" className="h-9 gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" /> Logg aktivitet
        </Button>
      </div>

      {/* Activity list */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Laster aktiviteter...
        </div>
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
                  const isGmail = a.ekstern_provider === 'gmail';
                  const isSent = a.aktivitet_kilde === 'gmail_sendt';
                  const isExternal = a.ekstern_provider === 'gmail' || a.ekstern_provider === 'google_calendar';
                  const displayTitle = a.tittel || a.type;

                  return (
                    <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${typeColors[a.type]}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{displayTitle}</span>
                          {isGmail && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isSent ? 'bg-blue-500/10 text-blue-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
                              {isSent ? '↑ Sendt' : '↓ Mottatt'}
                            </span>
                          )}
                          {isExternal && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                              {a.ekstern_provider === 'gmail' ? 'Gmail' : 'GCal'}
                            </span>
                          )}
                          {entity.type && (
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 h-5 transition-colors ${entityBadgeColor[entity.type] || ""}`}
                              onClick={() => entity.path && navigate(entity.path)}
                            >
                              {entity.type}: {entity.label}
                            </Badge>
                          )}
                          <span className="text-[11px] text-muted-foreground flex items-center gap-0.5 ml-auto shrink-0">
                            <Clock className="w-3 h-3" />
                            {formatDato(a.dato)}
                          </span>
                          {!isExternal && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted">
                                  <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-32">
                                <DropdownMenuItem onClick={() => openEdit(a)} className="text-xs gap-2">
                                  <Pencil className="w-3 h-3" /> Rediger
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setDeleteId(a.id)} className="text-xs gap-2 text-destructive focus:text-destructive">
                                  <Trash2 className="w-3 h-3" /> Slett
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-line line-clamp-2">{a.beskrivelse}</p>
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
              <p className="text-xs text-muted-foreground">Alle aktiviteter er lastet</p>
            )}
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Logg aktivitet</DialogTitle>
            <DialogDescription>Registrer en ny aktivitet knyttet til en entitet</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-1.5">
              {typeOptions.map(t => {
                const TIcon = typeIcons[t];
                return (
                  <button
                    key={t}
                    onClick={() => setCreateType(t)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-colors ${
                      createType === t ? "border-primary bg-primary/5 text-primary font-medium" : "border-border hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <TIcon className="w-4 h-4" />
                    <span className="text-[10px] leading-tight text-center">{t}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Select value={createEntityType} onValueChange={v => { setCreateEntityType(v as EntityFilter); setCreateEntityId(""); }}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Entitet-type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alle">Ingen tilknytning</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="salgsmulighet">Salgsmulighet</SelectItem>
                  <SelectItem value="selskap">Selskap</SelectItem>
                  <SelectItem value="partner">Partner</SelectItem>
                  <SelectItem value="prosjekt">Prosjekt</SelectItem>
                  <SelectItem value="kontakt">Kontakt</SelectItem>
                </SelectContent>
              </Select>
              {createEntityType !== "alle" && (
                <Select value={createEntityId} onValueChange={setCreateEntityId}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Velg..." /></SelectTrigger>
                  <SelectContent>
                    {getEntityOptions().map(o => (
                      <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Textarea placeholder="Beskriv aktiviteten..." value={createBeskrivelse} onChange={e => setCreateBeskrivelse(e.target.value)} rows={3} autoFocus />
            <Button onClick={saveCreate} className="w-full" disabled={!createBeskrivelse.trim() || createLoading}>
              {createLoading ? "Lagrer..." : "Logg aktivitet"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editDialog} onOpenChange={open => !open && setEditDialog(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rediger aktivitet</DialogTitle>
            <DialogDescription>Endre type eller beskrivelse</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-1.5">
              {typeOptions.map(t => {
                const TIcon = typeIcons[t];
                return (
                  <button
                    key={t}
                    onClick={() => setEditType(t)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-colors ${
                      editType === t ? "border-primary bg-primary/5 text-primary font-medium" : "border-border hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <TIcon className="w-4 h-4" />
                    <span className="text-[10px] leading-tight text-center">{t}</span>
                  </button>
                );
              })}
            </div>
            <Textarea placeholder="Beskriv aktiviteten..." value={editBeskrivelse} onChange={e => setEditBeskrivelse(e.target.value)} rows={3} autoFocus />
            <Button onClick={saveEdit} className="w-full" disabled={!editBeskrivelse.trim() || editLoading}>
              {editLoading ? "Lagrer..." : "Lagre endringer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slett aktivitet</AlertDialogTitle>
            <AlertDialogDescription>Er du sikker på at du vil slette denne aktiviteten? Dette kan ikke angres.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Slett</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
