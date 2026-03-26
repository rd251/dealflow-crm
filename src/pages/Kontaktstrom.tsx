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
import CompanyLinker from "@/components/CompanyLinker";

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
  totalSent: number;
  totalReceived: number;
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
  const { kontakter, leads, salgsmuligheter, selskaper, partnere, refresh } = useCrmStore();

  const [emailContacts, setEmailContacts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("alle");
  const [filterAnsvarlig, setFilterAnsvarlig] = useState<string>("alle");
  const [selected, setSelected] = useState<KontaktStromPerson | null>(null);
  const [creatingLead, setCreatingLead] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchEmailContacts = async () => {
    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let keepFetching = true;

    while (keepFetching) {
      const { data } = await supabase
        .from("email_contacts")
        .select("*")
        .order("last_contacted_at", { ascending: false, nullsFirst: false })
        .range(from, from + pageSize - 1);

      const rows = data || [];
      allData = allData.concat(rows);
      if (rows.length < pageSize) {
        keepFetching = false;
      } else {
        from += pageSize;
      }
    }
    setEmailContacts(allData);
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
      await fetchEmailContacts();
      refresh();
    } catch (e: any) {
      if (!silent) toast.error("Synkronisering feilet: " + (e.message || "Ukjent feil"));
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchEmailContacts();
    handleGmailSync(true);
  }, []);

  // Build unified list: merge email_contacts with CRM data
  const persons = useMemo(() => {
    const map = new Map<string, KontaktStromPerson>();

    const getSelskapNavn = (id: string) => selskaper.find(s => s.id === id)?.firmanavn || "";
    const getSelskapStatus = (id: string) => selskaper.find(s => s.id === id)?.kundestatus || "";
    const getTypeFromSelskap = (selskapId: string): KontaktStromPerson["type"] => {
      const selskap = selskaper.find(s => s.id === selskapId);
      if (!selskap) return "Ukjent";
      if (selskap.kundestatus === "Live" || selskap.kundestatus === "Pilot") return "Kunde";
      return "Ukjent";
    };

    // 1. Add CRM kontakter
    for (const k of kontakter) {
      if (!k.e_post) continue;
      const email = k.e_post.toLowerCase();
      const lead = leads.find(l => l.e_post?.toLowerCase() === email);
      const sm = salgsmuligheter.find(s => s.e_post?.toLowerCase() === email || s.kontakt_id === k.id);
      const partner = partnere.find(p => p.e_post?.toLowerCase() === email);

      let type: KontaktStromPerson["type"] = "Ukjent";
      let status = "";
      let ansvarlig = "";
      let nesteSteg = "";

      if (sm) { type = "Salgsmulighet"; status = sm.status; ansvarlig = sm.ansvarlig; nesteSteg = sm.neste_steg; }
      if (lead) { type = "Lead"; status = lead.status; ansvarlig = lead.ansvarlig; nesteSteg = lead.neste_steg; }
      if (partner) { type = "Partner"; status = partner.partnerstatus; ansvarlig = partner.ansvarlig; }
      if (k.selskap_id && getTypeFromSelskap(k.selskap_id) === "Kunde") {
        type = "Kunde"; status = getSelskapStatus(k.selskap_id);
      }

      map.set(email, {
        email,
        navn: k.navn,
        firmanavn: k.selskap_id ? getSelskapNavn(k.selskap_id) : (lead?.firmanavn || ""),
        type, status, ansvarlig,
        sistKontaktetDato: null,
        sistKontaktetType: "",
        nesteSteg,
        totalSent: 0,
        totalReceived: 0,
        kontaktId: k.id,
        leadId: lead?.id || null,
        salgsmulighetId: sm?.id || null,
        selskapId: k.selskap_id || sm?.selskap_id || null,
        partnerId: partner?.id || null,
        inCrm: true,
      });
    }

    // 2. Add leads not present
    for (const l of leads) {
      if (!l.e_post) continue;
      const email = l.e_post.toLowerCase();
      if (map.has(email)) continue;
      map.set(email, {
        email, navn: l.kontaktperson || l.firmanavn, firmanavn: l.firmanavn,
        type: "Lead", status: l.status, ansvarlig: l.ansvarlig,
        sistKontaktetDato: null, sistKontaktetType: "",
        nesteSteg: l.neste_steg, totalSent: 0, totalReceived: 0,
        kontaktId: null, leadId: l.id, salgsmulighetId: null,
        selskapId: null, partnerId: null, inCrm: true,
      });
    }

    // 3. Add salgsmuligheter not present
    for (const s of salgsmuligheter) {
      if (!s.e_post) continue;
      const email = s.e_post.toLowerCase();
      if (map.has(email)) continue;
      map.set(email, {
        email, navn: s.kontaktperson || s.navn,
        firmanavn: s.selskap_id ? getSelskapNavn(s.selskap_id) : "",
        type: "Salgsmulighet", status: s.status, ansvarlig: s.ansvarlig,
        sistKontaktetDato: null, sistKontaktetType: "",
        nesteSteg: s.neste_steg, totalSent: 0, totalReceived: 0,
        kontaktId: s.kontakt_id || null, leadId: null, salgsmulighetId: s.id,
        selskapId: s.selskap_id || null, partnerId: null, inCrm: true,
      });
    }

    // 4. Add partnere not present
    for (const p of partnere) {
      if (!p.e_post) continue;
      const email = p.e_post.toLowerCase();
      if (map.has(email)) continue;
      map.set(email, {
        email, navn: p.kontaktperson || p.partnernavn, firmanavn: p.partnernavn,
        type: "Partner", status: p.partnerstatus, ansvarlig: p.ansvarlig,
        sistKontaktetDato: null, sistKontaktetType: "",
        nesteSteg: "", totalSent: 0, totalReceived: 0,
        kontaktId: null, leadId: null, salgsmulighetId: null,
        selskapId: p.selskap_id || null, partnerId: p.id, inCrm: true,
      });
    }

    // 5. Merge email_contacts data (structured Gmail data)
    const SYSTEM_EMAIL_PATTERNS = /^(noreply|no-reply|no\.reply|donotreply|do-not-reply|notifications?|alert[s]?|info@|support@|admin@|postmaster@|mailer-daemon|bounce[s]?|feedback@|newsletter|updates?@|billing@|receipts?@|hello@|team@|marketing@|sales@|press@|media@|contact@|webmaster@|hostmaster@|abuse@)/i;
    const SYSTEM_DOMAINS = /\.(google|facebook|linkedin|twitter|github|apple|microsoft|amazon|stripe|paypal|shopify|slack|zoom|calendly|hubspot|mailchimp|sendgrid|intercom|zendesk|atlassian|notion|figma|canva|vercel|netlify|cloudflare)\.(com|io|co|net)$/i;

    const isSystemEmail = (email: string) => {
      const local = email.split("@")[0];
      return SYSTEM_EMAIL_PATTERNS.test(local) || SYSTEM_DOMAINS.test("@" + email.split("@")[1]);
    };

    for (const ec of emailContacts) {
      const email = ec.primary_email?.toLowerCase();
      if (!email || isSystemEmail(email)) continue;

      const existing = map.get(email);
      if (existing) {
        // Merge: update last contacted and counts
        if (ec.last_contacted_at) {
          if (!existing.sistKontaktetDato || new Date(ec.last_contacted_at) > new Date(existing.sistKontaktetDato)) {
            existing.sistKontaktetDato = ec.last_contacted_at;
            existing.sistKontaktetType = ec.last_activity_type || "E-post";
          }
        }
        existing.totalSent += ec.total_emails_sent || 0;
        existing.totalReceived += ec.total_emails_received || 0;
      } else {
        // New person from Gmail, not in CRM
        map.set(email, {
          email,
          navn: ec.display_name || email,
          firmanavn: ec.domain || "",
          type: "Ukjent",
          status: "",
          ansvarlig: "",
          sistKontaktetDato: ec.last_contacted_at,
          sistKontaktetType: ec.last_activity_type || "E-post",
          nesteSteg: "",
          totalSent: ec.total_emails_sent || 0,
          totalReceived: ec.total_emails_received || 0,
          kontaktId: ec.kontakt_id || null,
          leadId: ec.lead_id || null,
          salgsmulighetId: ec.salgsmulighet_id || null,
          selskapId: ec.selskap_id || null,
          partnerId: ec.partner_id || null,
          inCrm: false,
        });
      }
    }

    // Sort by last contacted
    const result = Array.from(map.values());
    result.sort((a, b) => {
      if (!a.sistKontaktetDato && !b.sistKontaktetDato) return 0;
      if (!a.sistKontaktetDato) return 1;
      if (!b.sistKontaktetDato) return -1;
      return new Date(b.sistKontaktetDato).getTime() - new Date(a.sistKontaktetDato).getTime();
    });

    return result;
  }, [kontakter, leads, salgsmuligheter, selskaper, partnere, emailContacts]);

  const ansvarlige = useMemo(() => {
    const set = new Set<string>();
    persons.forEach(p => { if (p.ansvarlig) set.add(p.ansvarlig); });
    return Array.from(set).sort();
  }, [persons]);

  const filtered = useMemo(() => {
    return persons.filter(p => {
      if (search) {
        const q = search.toLowerCase();
        if (!p.navn.toLowerCase().includes(q) && !p.email.includes(q) && !p.firmanavn.toLowerCase().includes(q)) return false;
      }
      if (filterType !== "alle" && p.type !== filterType) return false;
      if (filterAnsvarlig !== "alle" && p.ansvarlig !== filterAnsvarlig) return false;
      return true;
    });
  }, [persons, search, filterType, filterAnsvarlig]);

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
              {!isMobile && <th className="text-left px-4 py-3 font-medium">E-poster</th>}
              <th className="text-left px-4 py-3 font-medium">Sist kontaktet</th>
              {!isMobile && <th className="text-left px-4 py-3 font-medium">I CRM</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const AktIcon = AKTIVITET_TYPE_ICONS[p.sistKontaktetType] || Clock;
              const totalEmails = p.totalSent + p.totalReceived;
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
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {totalEmails > 0 ? (
                        <span title={`${p.totalSent} sendt, ${p.totalReceived} mottatt`}>
                          ↑{p.totalSent} ↓{p.totalReceived}
                        </span>
                      ) : "–"}
                    </td>
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
                    <td className="px-4 py-3">
                      {p.inCrm ? (
                        <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800">
                          Ja
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">
                          Nei
                        </Badge>
                      )}
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
                  {selected.inCrm ? (
                    <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400">
                      I CRM
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">Ikke i CRM</Badge>
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
                {(selected.totalSent > 0 || selected.totalReceived > 0) && (
                  <div className="text-xs text-muted-foreground">
                    E-poster: {selected.totalSent} sendt, {selected.totalReceived} mottatt
                  </div>
                )}
                {selected.nesteSteg && (
                  <div className="text-xs text-muted-foreground">
                    Neste steg: <span className="font-medium text-foreground">{selected.nesteSteg}</span>
                  </div>
                )}
              </div>

              {/* Company linker */}
              <CompanyLinker
                email={selected.email}
                kontaktId={selected.kontaktId}
                currentSelskapId={selected.selskapId}
                personNavn={selected.navn}
                onLinked={() => {
                  fetchEmailContacts();
                  refresh();
                  setSelected(null);
                }}
              />
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
