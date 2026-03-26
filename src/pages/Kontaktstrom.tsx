import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, UserPlus, Mail, Phone, Calendar, MessageSquare, Building2, ExternalLink, Clock, RefreshCw } from "lucide-react";
import { format, formatDistanceToNow, isAfter } from "date-fns";
import { nb } from "date-fns/locale";
import { toast } from "sonner";
import ActivityLog from "@/components/ActivityLog";

// Unified person row
interface KontaktStromPerson {
  email: string;
  navn: string;
  firmanavn: string;
  type: "Lead" | "Salgsmulighet" | "Kunde" | "Partner" | "Ukjent";
  status: string;
  ansvarlig: string;
  sistKontaktetDato: string | null;
  sistKontaktetType: string;
  nesteSteg: string;
  aktivitetTekster: string[];
  // CRM refs
  kontaktId: string | null;
  leadId: string | null;
  salgsmulighetId: string | null;
  selskapId: string | null;
  partnerId: string | null;
  inCrm: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  Lead: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  Salgsmulighet: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  Kunde: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  Partner: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  Ukjent: "bg-muted text-muted-foreground",
};

const AKTIVITET_TYPE_ICONS: Record<string, typeof Mail> = {
  "E-post": Mail,
  "Møte": Calendar,
  "Telefonsamtale": Phone,
  "Notat": MessageSquare,
};

function formatAktivitetDato(dato: string | null) {
  if (!dato) return "–";
  const d = new Date(dato);
  const now = new Date();
  if (isAfter(d, now)) {
    return format(d, "d. MMM yyyy", { locale: nb });
  }
  return formatDistanceToNow(d, { addSuffix: true, locale: nb });
}

export default function Kontaktstrom() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { kontakter, leads, salgsmuligheter, selskaper, partnere, updateLeads, refresh } = useCrmStore();

  const [aktiviteter, setAktiviteter] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("alle");
  const [filterAnsvarlig, setFilterAnsvarlig] = useState<string>("alle");
  const [selected, setSelected] = useState<KontaktStromPerson | null>(null);
  const [creatingLead, setCreatingLead] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const refreshAktiviteter = async () => {
    // Fetch all aktiviteter, paginating past the 1000-row default limit
    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let keepFetching = true;

    while (keepFetching) {
      const { data } = await supabase
        .from("aktiviteter")
        .select("id, type, dato, tittel, beskrivelse, kontakt_id, lead_id, salgsmulighet_id, selskap_id, partner_id, ekstern_provider, aktivitet_kilde")
        .order("dato", { ascending: false })
        .range(from, from + pageSize - 1);
      
      const rows = data || [];
      allData = allData.concat(rows);
      if (rows.length < pageSize) {
        keepFetching = false;
      } else {
        from += pageSize;
      }
    }
    setAktiviteter(allData);
  };

  const handleGmailSync = async (silent = false) => {
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (!silent) toast.error("Du må være logget inn for å synkronisere");
        return;
      }
      const res = await supabase.functions.invoke("gmail-sync", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.error) throw res.error;
      if (!silent) toast.success("Gmail-synkronisering fullført");
      await refreshAktiviteter();
      refresh();
    } catch (e: any) {
      if (!silent) toast.error("Synkronisering feilet: " + (e.message || "Ukjent feil"));
    } finally {
      setSyncing(false);
    }
  };

  // Fetch aktiviteter and auto-sync Gmail on mount
  useEffect(() => {
    refreshAktiviteter();
    handleGmailSync(true);
  }, []);

  // Build unified list
  const persons = useMemo(() => {
    const map = new Map<string, KontaktStromPerson>();

    // Helper: get selskap name
    const getSelskapNavn = (id: string) => selskaper.find(s => s.id === id)?.firmanavn || "";

    // Helper: get selskap kundestatus
    const getSelskapStatus = (id: string) => selskaper.find(s => s.id === id)?.kundestatus || "";

    // Helper: determine type from selskap
    const getTypeFromSelskap = (selskapId: string): KontaktStromPerson["type"] => {
      const selskap = selskaper.find(s => s.id === selskapId);
      if (!selskap) return "Ukjent";
      if (selskap.kundestatus === "Live" || selskap.kundestatus === "Pilot") return "Kunde";
      return "Ukjent";
    };

    // 1. Add kontakter
    for (const k of kontakter) {
      if (!k.e_post) continue;
      const email = k.e_post.toLowerCase();
      // Check if linked to lead
      const lead = leads.find(l => l.e_post?.toLowerCase() === email);
      const sm = salgsmuligheter.find(s => s.e_post?.toLowerCase() === email || s.kontakt_id === k.id);
      const partner = partnere.find(p => p.e_post?.toLowerCase() === email);

      let type: KontaktStromPerson["type"] = "Ukjent";
      let status = "";
      let ansvarlig = "";
      let nesteSteg = "";

      if (sm) {
        type = "Salgsmulighet";
        status = sm.status;
        ansvarlig = sm.ansvarlig;
        nesteSteg = sm.neste_steg;
      }
      if (lead) {
        type = "Lead";
        status = lead.status;
        ansvarlig = lead.ansvarlig;
        nesteSteg = lead.neste_steg;
      }
      if (partner) {
        type = "Partner";
        status = partner.partnerstatus;
        ansvarlig = partner.ansvarlig;
      }
      if (k.selskap_id) {
        const selskapType = getTypeFromSelskap(k.selskap_id);
        if (selskapType === "Kunde") {
          type = "Kunde";
          status = getSelskapStatus(k.selskap_id);
        }
      }

      map.set(email, {
        email,
        navn: k.navn,
        firmanavn: k.selskap_id ? getSelskapNavn(k.selskap_id) : (lead?.firmanavn || ""),
        type,
        status,
        ansvarlig,
        sistKontaktetDato: null,
        sistKontaktetType: "",
        nesteSteg,
        aktivitetTekster: [],
        kontaktId: k.id,
        leadId: lead?.id || null,
        salgsmulighetId: sm?.id || null,
        selskapId: k.selskap_id || sm?.selskap_id || null,
        partnerId: partner?.id || null,
        inCrm: true,
      });
    }

    // 2. Add leads not already present
    for (const l of leads) {
      if (!l.e_post) continue;
      const email = l.e_post.toLowerCase();
      if (map.has(email)) continue;
      map.set(email, {
        email,
        navn: l.kontaktperson || l.firmanavn,
        firmanavn: l.firmanavn,
        type: "Lead",
        status: l.status,
        ansvarlig: l.ansvarlig,
        sistKontaktetDato: null,
        sistKontaktetType: "",
        aktivitetTekster: [],
        nesteSteg: l.neste_steg,
        kontaktId: null,
        leadId: l.id,
        salgsmulighetId: null,
        selskapId: null,
        partnerId: null,
        inCrm: true,
      });
    }

    // 3. Add salgsmuligheter not already present
    for (const s of salgsmuligheter) {
      if (!s.e_post) continue;
      const email = s.e_post.toLowerCase();
      if (map.has(email)) continue;
      map.set(email, {
        email,
        navn: s.kontaktperson || s.navn,
        firmanavn: s.selskap_id ? getSelskapNavn(s.selskap_id) : "",
        type: "Salgsmulighet",
        status: s.status,
        ansvarlig: s.ansvarlig,
        sistKontaktetDato: null,
        sistKontaktetType: "",
        nesteSteg: s.neste_steg,
        aktivitetTekster: [],
        kontaktId: s.kontakt_id || null,
        leadId: null,
        salgsmulighetId: s.id,
        selskapId: s.selskap_id || null,
        partnerId: null,
        inCrm: true,
      });
    }

    // 4. Add partnere not already present
    for (const p of partnere) {
      if (!p.e_post) continue;
      const email = p.e_post.toLowerCase();
      if (map.has(email)) continue;
      map.set(email, {
        email,
        navn: p.kontaktperson || p.partnernavn,
        firmanavn: p.partnernavn,
        type: "Partner",
        status: p.partnerstatus,
        ansvarlig: p.ansvarlig,
        sistKontaktetDato: null,
        sistKontaktetType: "",
        nesteSteg: "",
        aktivitetTekster: [],
        kontaktId: null,
        leadId: null,
        salgsmulighetId: null,
        selskapId: p.selskap_id || null,
        partnerId: p.id,
        inCrm: true,
      });
    }

    // 5. Match aktiviteter to find "sist kontaktet" and add unknown emails
    // Build kontakt_id → email map
    const kontaktIdToEmail = new Map<string, string>();
    for (const k of kontakter) {
      if (k.e_post) kontaktIdToEmail.set(k.id, k.e_post.toLowerCase());
    }
    const leadIdToEmail = new Map<string, string>();
    for (const l of leads) {
      if (l.e_post) leadIdToEmail.set(l.id, l.e_post.toLowerCase());
    }
    const smIdToEmail = new Map<string, string>();
    for (const s of salgsmuligheter) {
      if (s.e_post) smIdToEmail.set(s.id, s.e_post.toLowerCase());
    }
    const partnerIdToEmail = new Map<string, string>();
    for (const p of partnere) {
      if (p.e_post) partnerIdToEmail.set(p.id, p.e_post.toLowerCase());
    }

    // For each aktivitet, find the email and update sist kontaktet
    // Also extract unmatched email contacts from gmail aktiviteter
    const emailRegex = /[\w.+-]+@[\w.-]+\.\w+/g;

    for (const akt of aktiviteter) {
      let email: string | null = null;

      if (akt.kontakt_id && kontaktIdToEmail.has(akt.kontakt_id)) {
        email = kontaktIdToEmail.get(akt.kontakt_id)!;
      } else if (akt.lead_id && leadIdToEmail.has(akt.lead_id)) {
        email = leadIdToEmail.get(akt.lead_id)!;
      } else if (akt.ekstern_provider === "gmail" && akt.beskrivelse) {
        // Extract email from beskrivelse format: [email@example.com] snippet
        const match = akt.beskrivelse.match(/^\[([^\]]+)\]/);
        if (match) {
          const extractedEmail = match[1].toLowerCase();
          email = extractedEmail;
          // Create person entry for unmatched email if not already in map
          if (!map.has(extractedEmail)) {
            // Try to extract a name from the tittel (→/← Subject)
            const subject = (akt.tittel || "").replace(/^[→←]\s*/, "");
            map.set(extractedEmail, {
              email: extractedEmail,
              navn: extractedEmail,
              firmanavn: extractedEmail.split("@")[1]?.replace(/\.\w+$/, "") || "",
              type: "Ukjent",
              status: "",
              ansvarlig: "",
              sistKontaktetDato: akt.dato,
              sistKontaktetType: akt.type,
              nesteSteg: "",
              aktivitetTekster: [subject],
              kontaktId: null,
              leadId: null,
              salgsmulighetId: null,
              selskapId: null,
              partnerId: null,
              inCrm: false,
            });
            continue;
          }
        }
      }

      if (!email) continue;

      const person = map.get(email);
      if (person) {
        // Collect aktivitet text for search
        const txt = (akt.tittel || akt.beskrivelse || "").trim();
        if (txt) person.aktivitetTekster.push(txt);
        // Only update sist kontaktet if this is more recent
        if (!person.sistKontaktetDato || new Date(akt.dato) > new Date(person.sistKontaktetDato)) {
          person.sistKontaktetDato = akt.dato;
          person.sistKontaktetType = akt.type;
        }
      }
    }

    // Convert to array and sort by sist kontaktet
    const result = Array.from(map.values());
    result.sort((a, b) => {
      if (!a.sistKontaktetDato && !b.sistKontaktetDato) return 0;
      if (!a.sistKontaktetDato) return 1;
      if (!b.sistKontaktetDato) return -1;
      return new Date(b.sistKontaktetDato).getTime() - new Date(a.sistKontaktetDato).getTime();
    });

    return result;
  }, [kontakter, leads, salgsmuligheter, selskaper, partnere, aktiviteter]);

  // Get unique ansvarlige
  const ansvarlige = useMemo(() => {
    const set = new Set<string>();
    persons.forEach(p => { if (p.ansvarlig) set.add(p.ansvarlig); });
    return Array.from(set).sort();
  }, [persons]);

  // Filter
  const filtered = useMemo(() => {
    return persons.filter(p => {
      if (search) {
        const q = search.toLowerCase();
        const matchesAktivitet = p.aktivitetTekster.some(t => t.toLowerCase().includes(q));
        if (!p.navn.toLowerCase().includes(q) && !p.email.includes(q) && !p.firmanavn.toLowerCase().includes(q) && !matchesAktivitet) return false;
      }
      if (filterType !== "alle" && p.type !== filterType) return false;
      if (filterAnsvarlig !== "alle" && p.ansvarlig !== filterAnsvarlig) return false;
      return true;
    });
  }, [persons, search, filterType, filterAnsvarlig]);

  // Create lead from person
  const handleCreateLead = async (person: KontaktStromPerson) => {
    setCreatingLead(true);
    try {
      const { data, error } = await supabase.from("leads").insert({
        firmanavn: person.firmanavn || person.navn,
        kontaktperson: person.navn !== person.email ? person.navn : "",
        e_post: person.email,
        kilde: "E-post" as any,
        status: "Ny" as any,
      }).select().single();

      if (error) throw error;

      toast.success(`Lead opprettet for ${person.navn}`);
      refresh();
      setSelected(null);
    } catch (err: any) {
      toast.error("Kunne ikke opprette lead: " + (err.message || "Ukjent feil"));
    } finally {
      setCreatingLead(false);
    }
  };

  return (
    <PageShell
      title="Søk"
      subtitle={`${filtered.length} av ${persons.length} personer`}
    >
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleGmailSync()}
          disabled={syncing}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Synkroniserer..." : "Synk Gmail"}
        </Button>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Søk navn, e-post, selskap..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle typer</SelectItem>
            <SelectItem value="Lead">Lead</SelectItem>
            <SelectItem value="Salgsmulighet">Salgsmulighet</SelectItem>
            <SelectItem value="Kunde">Kunde</SelectItem>
            <SelectItem value="Partner">Partner</SelectItem>
            <SelectItem value="Ukjent">Ukjent</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterAnsvarlig} onValueChange={setFilterAnsvarlig}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Ansvarlig" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle ansvarlige</SelectItem>
            {ansvarlige.map(a => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-3 font-medium">Navn</th>
              {!isMobile && <th className="text-left px-4 py-3 font-medium">Selskap</th>}
              {!isMobile && <th className="text-left px-4 py-3 font-medium">E-post</th>}
              <th className="text-left px-4 py-3 font-medium">Type</th>
              {!isMobile && <th className="text-left px-4 py-3 font-medium">Status</th>}
              <th className="text-left px-4 py-3 font-medium">Sist kontaktet</th>
              {!isMobile && <th className="text-left px-4 py-3 font-medium">Neste steg</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const AktIcon = AKTIVITET_TYPE_ICONS[p.sistKontaktetType] || Clock;
              return (
                <tr
                  key={p.email}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setSelected(p)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.navn || p.email}</div>
                    {isMobile && p.firmanavn && (
                      <div className="text-xs text-muted-foreground">{p.firmanavn}</div>
                    )}
                  </td>
                  {!isMobile && (
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.selskapId ? (
                        <span
                          className="hover:text-primary hover:underline cursor-pointer"
                          onClick={e => { e.stopPropagation(); navigate(`/selskaper/${p.selskapId}`); }}
                        >
                          {p.firmanavn}
                        </span>
                      ) : (
                        p.firmanavn || "–"
                      )}
                    </td>
                  )}
                  {!isMobile && (
                    <td className="px-4 py-3 text-muted-foreground text-xs">{p.email}</td>
                  )}
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className={`text-xs font-medium ${TYPE_COLORS[p.type] || ""}`}>
                      {p.type}
                    </Badge>
                  </td>
                  {!isMobile && (
                    <td className="px-4 py-3 text-muted-foreground text-xs">{p.status || "–"}</td>
                  )}
                  <td className="px-4 py-3">
                    {p.sistKontaktetDato ? (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <AktIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>{formatAktivitetDato(p.sistKontaktetDato)}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">–</span>
                    )}
                  </td>
                  {!isMobile && (
                    <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px] truncate">
                      {p.nesteSteg || "–"}
                    </td>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-sm text-muted-foreground py-12">
                  Ingen personer funnet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail panel */}
      <Sheet open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <SheetContent className="w-full sm:w-[440px] sm:max-w-[500px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selected?.navn || selected?.email}</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="mt-4 space-y-5">
              {/* Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span>{selected.email}</span>
                </div>
                {selected.firmanavn && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    {selected.selskapId ? (
                      <span
                        className="text-primary hover:underline cursor-pointer"
                        onClick={() => { navigate(`/selskaper/${selected.selskapId}`); setSelected(null); }}
                      >
                        {selected.firmanavn}
                      </span>
                    ) : (
                      <span>{selected.firmanavn}</span>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={`text-xs ${TYPE_COLORS[selected.type]}`}>
                    {selected.type}
                  </Badge>
                  {selected.status && (
                    <Badge variant="outline" className="text-xs">{selected.status}</Badge>
                  )}
                </div>
                {selected.ansvarlig && (
                  <div className="text-xs text-muted-foreground">
                    Ansvarlig: <span className="font-medium text-foreground">{selected.ansvarlig}</span>
                  </div>
                )}
                {selected.sistKontaktetDato && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Sist kontaktet: {selected.sistKontaktetType} – {format(new Date(selected.sistKontaktetDato), "d. MMM yyyy", { locale: nb })}
                  </div>
                )}
                {selected.nesteSteg && (
                  <div className="text-xs text-muted-foreground">
                    Neste steg: <span className="font-medium text-foreground">{selected.nesteSteg}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {!selected.inCrm || (!selected.leadId && !selected.salgsmulighetId && selected.type === "Ukjent") ? (
                  <Button size="sm" onClick={() => handleCreateLead(selected)} disabled={creatingLead}>
                    <UserPlus className="w-4 h-4 mr-1" />
                    {creatingLead ? "Oppretter..." : "Opprett lead"}
                  </Button>
                ) : null}
                {selected.leadId && (
                  <Button size="sm" variant="outline" onClick={() => { navigate("/leads"); setSelected(null); }}>
                    <ExternalLink className="w-4 h-4 mr-1" />Lead
                  </Button>
                )}
                {selected.salgsmulighetId && (
                  <Button size="sm" variant="outline" onClick={() => { navigate("/salgsmuligheter"); setSelected(null); }}>
                    <ExternalLink className="w-4 h-4 mr-1" />Salgsmulighet
                  </Button>
                )}
                {selected.partnerId && (
                  <Button size="sm" variant="outline" onClick={() => { navigate(`/partnere/${selected.partnerId}`); setSelected(null); }}>
                    <ExternalLink className="w-4 h-4 mr-1" />Partner
                  </Button>
                )}
              </div>

              {/* Activity log */}
              {selected.kontaktId && (
                <ActivityLog kontakt_id={selected.kontaktId} />
              )}
              {selected.leadId && !selected.kontaktId && (
                <ActivityLog lead_id={selected.leadId} />
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}
