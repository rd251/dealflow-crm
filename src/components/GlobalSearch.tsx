import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Building2, User, Briefcase, Users, Handshake, X, Loader2, Mail, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface SearchResult {
  id: string;
  type: "selskap" | "kontakt" | "lead" | "salgsmulighet" | "partner";
  title: string;
  subtitle?: string;
  meta?: string;
  email?: string;
  phone?: string;
  status?: string;
}

const typeConfig = {
  selskap: { icon: Building2, label: "Selskap", color: "text-primary bg-primary/10", path: (id: string) => `/selskaper/${id}` },
  kontakt: { icon: User, label: "Kontakt", color: "text-blue-600 bg-blue-500/10", path: () => `/kontakter` },
  lead: { icon: Users, label: "Lead", color: "text-amber-600 bg-amber-500/10", path: () => `/leads` },
  salgsmulighet: { icon: Briefcase, label: "Salg", color: "text-emerald-600 bg-emerald-500/10", path: () => `/salgsmuligheter` },
  partner: { icon: Handshake, label: "Partner", color: "text-violet-600 bg-violet-500/10", path: (id: string) => `/partnere/${id}` },
} as const;

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl + K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounced search
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const ilike = `%${q}%`;
        const [selskRes, kontRes, leadRes, salgRes, partRes] = await Promise.all([
          supabase.from("selskaper").select("id, firmanavn, bransje, domene, kundestatus")
            .or(`firmanavn.ilike.${ilike},domene.ilike.${ilike},orgnr.ilike.${ilike}`).limit(5),
          supabase.from("kontakter").select("id, navn, e_post, telefon, rolle, selskap_id")
            .or(`navn.ilike.${ilike},e_post.ilike.${ilike},telefon.ilike.${ilike}`).limit(5),
          supabase.from("leads").select("id, firmanavn, kontaktperson, e_post, telefon, status")
            .or(`firmanavn.ilike.${ilike},kontaktperson.ilike.${ilike},e_post.ilike.${ilike},telefon.ilike.${ilike}`).limit(5),
          supabase.from("salgsmuligheter").select("id, navn, kontaktperson, e_post, status, forventet_mrr")
            .or(`navn.ilike.${ilike},kontaktperson.ilike.${ilike},e_post.ilike.${ilike}`).limit(5),
          supabase.from("partnere").select("id, partnernavn, kontaktperson, e_post, partnerstatus")
            .or(`partnernavn.ilike.${ilike},kontaktperson.ilike.${ilike},e_post.ilike.${ilike}`).limit(5),
        ]);

        const out: SearchResult[] = [];
        (selskRes.data || []).forEach((s: any) => out.push({
          id: s.id, type: "selskap", title: s.firmanavn,
          subtitle: s.bransje || s.domene, status: s.kundestatus,
        }));
        (kontRes.data || []).forEach((k: any) => out.push({
          id: k.id, type: "kontakt", title: k.navn,
          subtitle: k.rolle, email: k.e_post, phone: k.telefon,
        }));
        (leadRes.data || []).forEach((l: any) => out.push({
          id: l.id, type: "lead", title: l.firmanavn,
          subtitle: l.kontaktperson, email: l.e_post, phone: l.telefon, status: l.status,
        }));
        (salgRes.data || []).forEach((s: any) => out.push({
          id: s.id, type: "salgsmulighet", title: s.navn,
          subtitle: s.kontaktperson, email: s.e_post, status: s.status,
          meta: s.forventet_mrr ? `${Math.round(s.forventet_mrr).toLocaleString("no-NO")} kr/mnd` : undefined,
        }));
        (partRes.data || []).forEach((p: any) => out.push({
          id: p.id, type: "partner", title: p.partnernavn,
          subtitle: p.kontaktperson, email: p.e_post, status: p.partnerstatus,
        }));

        setResults(out);
        setActiveIdx(0);
      } catch (e) {
        console.error("Global search error:", e);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const grouped = useMemo(() => {
    const map: Record<string, SearchResult[]> = {};
    results.forEach(r => { (map[r.type] = map[r.type] || []).push(r); });
    return map;
  }, [results]);

  const orderedTypes = ["selskap", "kontakt", "salgsmulighet", "lead", "partner"] as const;
  const flatResults = useMemo(() => {
    return orderedTypes.flatMap(t => grouped[t] || []);
  }, [grouped]);

  const handleSelect = (r: SearchResult) => {
    const cfg = typeConfig[r.type];
    navigate(cfg.path(r.id));
    setOpen(false);
    setQuery("");
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (!open || flatResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = flatResults[activeIdx];
      if (r) handleSelect(r);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full mb-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          placeholder="Søk på tvers – navn, selskap, e-post, telefon… (⌘K)"
          className="pl-9 pr-9 h-11 bg-card"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setResults([]); inputRef.current?.focus(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted"
            aria-label="Nullstill søk"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute z-50 mt-2 w-full bg-popover border rounded-xl shadow-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Søker…
            </div>
          ) : flatResults.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Ingen treff for "{query}"
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto py-1">
              {orderedTypes.map(type => {
                const items = grouped[type];
                if (!items || items.length === 0) return null;
                const cfg = typeConfig[type];
                return (
                  <div key={type}>
                    <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                      {cfg.label}
                    </div>
                    {items.map(r => {
                      const Icon = cfg.icon;
                      const idx = flatResults.indexOf(r);
                      const isActive = idx === activeIdx;
                      return (
                        <button
                          key={`${r.type}-${r.id}`}
                          onClick={() => handleSelect(r)}
                          onMouseEnter={() => setActiveIdx(idx)}
                          className={`w-full flex items-start gap-3 px-3 py-2 text-left transition-colors ${
                            isActive ? "bg-muted" : "hover:bg-muted/50"
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.color}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-medium truncate">{r.title}</span>
                              {r.status && (
                                <Badge variant="outline" className="text-[10px] shrink-0 px-1.5 py-0">
                                  {r.status}
                                </Badge>
                              )}
                              {r.meta && (
                                <span className="text-[10px] text-muted-foreground shrink-0 ml-auto">{r.meta}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground min-w-0">
                              {r.subtitle && <span className="truncate">{r.subtitle}</span>}
                              {r.email && (
                                <span className="flex items-center gap-1 truncate">
                                  <Mail className="w-3 h-3 shrink-0" />{r.email}
                                </span>
                              )}
                              {r.phone && (
                                <span className="flex items-center gap-1 shrink-0">
                                  <Phone className="w-3 h-3" />{r.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
          <div className="px-3 py-1.5 border-t bg-muted/30 text-[10px] text-muted-foreground flex items-center justify-between">
            <span>↑↓ for å navigere · ⏎ for å åpne</span>
            <span>{flatResults.length} treff</span>
          </div>
        </div>
      )}
    </div>
  );
}
