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
import DetailPanelShell, { DetailSection, DetailField as SharedDetailField, DetailDivider, DetailStatGrid, DetailStatCard } from "@/components/DetailPanelShell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, UserPlus, Mail, Phone, Calendar, MessageSquare, Building2, ExternalLink, Clock, RefreshCw } from "lucide-react";
import { format, formatDistanceToNow, isAfter } from "date-fns";
import { nb } from "date-fns/locale";
import { toast } from "sonner";
import ActivityLog from "@/components/ActivityLog";
import CompanyLinker from "@/components/CompanyLinker";
import DealSuggestions from "@/components/DealSuggestions";

interface KontaktStromPerson {
  email: string;
  navn: string;
  firmanavn: string;
  type: "Lead" | "Salgsmulighet" | "Kunde" | "Partner" | "Kontakt" | "Ukjent";
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
  suggestedSelskapId: string | null;
  suggestedSelskapNavn: string;
  connectionStatus: "linked" | "suggested" | "unlinked";
}

const TYPE_COLORS: Record<string, string> = {
  Lead: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  Salgsmulighet: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  Kunde: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  Partner: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  Kontakt: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
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

// Using shared DetailField from DetailPanelShell

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
    const { data } = await supabase
      .from("email_contacts")
      .select("*")
      .order("last_contacted_at", { ascending: false, nullsFirst: false })
      .limit(500);

    setEmailContacts(data || []);
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
      return "Kontakt";
    };

    // Smart match helpers
    const findSelskapByDomain = (email: string): { id: string; firmanavn: string } | null => {
      const domain = email.split("@")[1] || "";
      const domainBase = domain.split(".")[0] || "";
      if (!domainBase || domainBase.length < 2) return null;
      const q = domainBase.toLowerCase();
      const match = selskaper.find(s => s.firmanavn.toLowerCase().includes(q));
      return match ? { id: match.id, firmanavn: match.firmanavn } : null;
    };

    const findSelskapByName = (firmanavn: string): { id: string; firmanavn: string } | null => {
      if (!firmanavn || firmanavn.length < 2) return null;
      const q = firmanavn.toLowerCase();
      const match = selskaper.find(s => s.firmanavn.toLowerCase() === q);
      return match ? { id: match.id, firmanavn: match.firmanavn } : null;
    };

    const findKontaktByNameAndCompany = (navn: string, firmanavn: string) => {
      if (!navn || !firmanavn) return null;
      const nLow = navn.toLowerCase();
      const fLow = firmanavn.toLowerCase();
      return kontakter.find(k => {
        if (k.navn.toLowerCase() !== nLow || !k.selskap_id) return false;
        const s = selskaper.find(s => s.id === k.selskap_id);
        return s && s.firmanavn.toLowerCase() === fLow;
      }) || null;
    };

    const resolveConnectionStatus = (selskapId: string | null, suggestedId: string | null): KontaktStromPerson["connectionStatus"] => {
      if (selskapId) return "linked";
      if (suggestedId) return "suggested";
      return "unlinked";
    };

    // 1. Add CRM kontakter
    for (const k of kontakter) {
      if (!k.e_post) continue;
      const email = k.e_post.toLowerCase();
      const lead = leads.find(l => l.e_post?.toLowerCase() === email);
      const sm = salgsmuligheter.find(s => s.e_post?.toLowerCase() === email || s.kontakt_id === k.id);
      const partner = partnere.find(p => p.e_post?.toLowerCase() === email);

      let type: KontaktStromPerson["type"] = k.selskap_id ? getTypeFromSelskap(k.selskap_id) : "Ukjent";
      let status = k.selskap_id ? getSelskapStatus(k.selskap_id) : "";
      let ansvarlig = "";
      let nesteSteg = "";

      if (sm) { type = "Salgsmulighet"; status = sm.status; ansvarlig = sm.ansvarlig; nesteSteg = sm.neste_steg; }
      if (lead) { type = "Lead"; status = lead.status; ansvarlig = lead.ansvarlig; nesteSteg = lead.neste_steg; }
      if (partner) { type = "Partner"; status = partner.partnerstatus; ansvarlig = partner.ansvarlig; }
      if (k.selskap_id) {
        const selskapType = getTypeFromSelskap(k.selskap_id);
        if (selskapType === "Kunde") { type = "Kunde"; status = getSelskapStatus(k.selskap_id); }
      }

      const resolvedSelskapId = k.selskap_id || sm?.selskap_id || null;
      const suggested = !resolvedSelskapId ? findSelskapByDomain(email) : null;
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
        selskapId: resolvedSelskapId,
        partnerId: partner?.id || null,
        inCrm: true,
        suggestedSelskapId: suggested?.id || null,
        suggestedSelskapNavn: suggested?.firmanavn || "",
        connectionStatus: resolveConnectionStatus(resolvedSelskapId, suggested?.id || null),
      });
    }

    // 2. Add leads not present
    for (const l of leads) {
      if (!l.e_post) continue;
      const email = l.e_post.toLowerCase();
      if (map.has(email)) continue;
      const sugL = findSelskapByName(l.firmanavn) || findSelskapByDomain(email);
      map.set(email, {
        email, navn: l.kontaktperson || l.firmanavn, firmanavn: l.firmanavn,
        type: "Lead", status: l.status, ansvarlig: l.ansvarlig,
        sistKontaktetDato: null, sistKontaktetType: "",
        nesteSteg: l.neste_steg, totalSent: 0, totalReceived: 0,
        kontaktId: null, leadId: l.id, salgsmulighetId: null,
        selskapId: null, partnerId: null, inCrm: true,
        suggestedSelskapId: sugL?.id || null, suggestedSelskapNavn: sugL?.firmanavn || "",
        connectionStatus: resolveConnectionStatus(null, sugL?.id || null),
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
        suggestedSelskapId: null, suggestedSelskapNavn: "",
        connectionStatus: resolveConnectionStatus(s.selskap_id || null, null),
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
        suggestedSelskapId: null, suggestedSelskapNavn: "",
        connectionStatus: resolveConnectionStatus(p.selskap_id || null, null),
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
        // New person from Gmail, not in CRM — smart matching
        let ecType: KontaktStromPerson["type"] = "Ukjent";
        let ecStatus = "";
        let ecAnsvarlig = "";
        let ecNesteSteg = "";
        let ecFirmanavn = ec.domain || "";
        let ecSelskapId = ec.selskap_id || null;
        let ecKontaktId = ec.kontakt_id || null;
        let ecSuggestedSelskapId: string | null = null;
        let ecSuggestedSelskapNavn = "";

        // Step 1: Exact email match against kontakter
        const kontaktByEmail = kontakter.find(k => k.e_post?.toLowerCase() === email);
        if (kontaktByEmail) {
          ecKontaktId = kontaktByEmail.id;
          if (kontaktByEmail.selskap_id) {
            ecSelskapId = kontaktByEmail.selskap_id;
            ecType = getTypeFromSelskap(kontaktByEmail.selskap_id);
            ecStatus = getSelskapStatus(kontaktByEmail.selskap_id);
            ecFirmanavn = getSelskapNavn(kontaktByEmail.selskap_id) || ecFirmanavn;
          } else {
            ecType = "Kontakt";
          }
        }

        // Step 2: Name + company match (if no kontakt found)
        if (!ecKontaktId && ec.display_name && ecFirmanavn) {
          const nameCompanyMatch = findKontaktByNameAndCompany(ec.display_name, ecFirmanavn);
          if (nameCompanyMatch) {
            ecKontaktId = nameCompanyMatch.id;
            if (nameCompanyMatch.selskap_id) {
              ecSelskapId = nameCompanyMatch.selskap_id;
              ecType = getTypeFromSelskap(nameCompanyMatch.selskap_id);
              ecStatus = getSelskapStatus(nameCompanyMatch.selskap_id);
              ecFirmanavn = getSelskapNavn(nameCompanyMatch.selskap_id) || ecFirmanavn;
            }
          }
        }

        // Step 3: Company name match (suggest selskap)
        if (!ecSelskapId && ecFirmanavn) {
          const selskapByName = findSelskapByName(ecFirmanavn);
          if (selskapByName) {
            ecSuggestedSelskapId = selskapByName.id;
            ecSuggestedSelskapNavn = selskapByName.firmanavn;
          }
        }

        // Step 4: Domain fallback (suggest selskap)
        if (!ecSelskapId && !ecSuggestedSelskapId) {
          const selskapByDomain = findSelskapByDomain(email);
          if (selskapByDomain) {
            ecSuggestedSelskapId = selskapByDomain.id;
            ecSuggestedSelskapNavn = selskapByDomain.firmanavn;
          }
        }

        // Resolve kontakt -> selskap link (existing logic for linked IDs)
        if (ec.kontakt_id && !ecKontaktId) {
          const kontakt = kontakter.find(k => k.id === ec.kontakt_id);
          if (kontakt) {
            ecKontaktId = kontakt.id;
            if (kontakt.selskap_id) {
              ecSelskapId = kontakt.selskap_id;
              ecType = getTypeFromSelskap(kontakt.selskap_id);
              ecStatus = getSelskapStatus(kontakt.selskap_id);
              ecFirmanavn = getSelskapNavn(kontakt.selskap_id) || ecFirmanavn;
            } else {
              ecType = "Kontakt";
            }
          }
        }

        if (ec.partner_id) {
          const partner = partnere.find(p => p.id === ec.partner_id);
          if (partner) { ecType = "Partner"; ecStatus = partner.partnerstatus || ""; ecAnsvarlig = partner.ansvarlig || ""; ecFirmanavn = partner.partnernavn || ecFirmanavn; }
        }
        if (ec.salgsmulighet_id) {
          const sm = salgsmuligheter.find(s => s.id === ec.salgsmulighet_id);
          if (sm) { ecType = "Salgsmulighet"; ecStatus = sm.status || ""; ecAnsvarlig = sm.ansvarlig || ""; ecNesteSteg = sm.neste_steg || ""; ecFirmanavn = sm.selskap_id ? (selskaper.find(s => s.id === sm.selskap_id)?.firmanavn || ecFirmanavn) : ecFirmanavn; }
        }
        if (ec.lead_id) {
          const lead = leads.find(l => l.id === ec.lead_id);
          if (lead) { ecType = "Lead"; ecStatus = lead.status || ""; ecAnsvarlig = lead.ansvarlig || ""; ecNesteSteg = lead.neste_steg || ""; ecFirmanavn = lead.firmanavn || ecFirmanavn; }
        }
        if (ecSelskapId) {
          const selskap = selskaper.find(s => s.id === ecSelskapId);
          if (selskap) {
            ecFirmanavn = selskap.firmanavn || ecFirmanavn;
            if (selskap.kundestatus === "Live" || selskap.kundestatus === "Pilot") {
              ecType = "Kunde"; ecStatus = selskap.kundestatus;
            }
          }
        }

        map.set(email, {
          email,
          navn: ec.display_name || email,
          firmanavn: ecFirmanavn,
          type: ecType,
          status: ecStatus,
          ansvarlig: ecAnsvarlig,
          sistKontaktetDato: ec.last_contacted_at,
          sistKontaktetType: ec.last_activity_type || "E-post",
          nesteSteg: ecNesteSteg,
          totalSent: ec.total_emails_sent || 0,
          totalReceived: ec.total_emails_received || 0,
          kontaktId: ecKontaktId,
          leadId: ec.lead_id || null,
          salgsmulighetId: ec.salgsmulighet_id || null,
          selskapId: ecSelskapId || null,
          partnerId: ec.partner_id || null,
          inCrm: !!(ecKontaktId || ec.lead_id || ec.salgsmulighet_id || ec.partner_id),
          suggestedSelskapId: ecSuggestedSelskapId,
          suggestedSelskapNavn: ecSuggestedSelskapNavn,
          connectionStatus: resolveConnectionStatus(ecSelskapId, ecSuggestedSelskapId),
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
      subtitle={`${persons.length} personer`}
      actions={
        <div className="flex flex-wrap items-center gap-3">
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
          <div className="relative min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Søk navn, e-post, selskap..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle typer</SelectItem>
              <SelectItem value="Lead">Lead</SelectItem>
              <SelectItem value="Salgsmulighet">Salgsmulighet</SelectItem>
              <SelectItem value="Kunde">Kunde</SelectItem>
              <SelectItem value="Partner">Partner</SelectItem>
              <SelectItem value="Kontakt">Kontakt</SelectItem>
              <SelectItem value="Ukjent">Ukjent</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterAnsvarlig} onValueChange={setFilterAnsvarlig}>
            <SelectTrigger className="w-[140px]">
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
      }
    >
      {/* Table */}
      <div className="bg-card border rounded-xl overflow-auto max-h-[calc(100vh-180px)]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-[5]">
            <tr className="bg-muted border-b">
              <th className="text-left px-4 py-3 font-medium">Navn</th>
              {!isMobile && <th className="text-left px-4 py-3 font-medium">Selskap</th>}
              {!isMobile && <th className="text-left px-4 py-3 font-medium">E-post</th>}
              <th className="text-left px-4 py-3 font-medium">Type</th>
              {!isMobile && <th className="text-left px-4 py-3 font-medium">Status</th>}
              {!isMobile && <th className="text-left px-4 py-3 font-medium">E-poster</th>}
              <th className="text-left px-4 py-3 font-medium">Sist kontaktet</th>
              {!isMobile && <th className="text-left px-4 py-3 font-medium">Kobling</th>}
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
                      ) : p.suggestedSelskapId ? (
                        <span className="text-xs italic text-muted-foreground">
                          {p.suggestedSelskapNavn} <span className="opacity-60">(forslag)</span>
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
                      {p.status || "–"}
                    </td>
                  )}
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
                      {p.connectionStatus === "linked" ? (
                        <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800">
                          Koblet
                        </Badge>
                      ) : p.connectionStatus === "suggested" ? (
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
                          Foreslått
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">
                          Ikke koblet
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

      <DetailPanelShell
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.navn || selected?.email || ""}
        subtitle={selected?.firmanavn && selected?.selskapId ? undefined : selected?.firmanavn || undefined}
        badges={selected ? (
          <>
            <Badge variant="secondary" className={`text-xs ${TYPE_COLORS[selected.type]}`}>
              {selected.type}
            </Badge>
            {selected.status && (
              <Badge variant="outline" className="text-xs">{selected.status}</Badge>
            )}
            {selected.connectionStatus === "linked" ? (
              <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400">
                Koblet
              </Badge>
            ) : selected.connectionStatus === "suggested" ? (
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400">
                Foreslått selskap
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">Ikke koblet</Badge>
            )}
          </>
        ) : undefined}
        actions={selected ? (
          <>
            {(!selected.inCrm || (!selected.leadId && !selected.salgsmulighetId && selected.type === "Ukjent")) && (
              <Button size="sm" onClick={() => handleCreateLead(selected)} disabled={creatingLead}>
                <UserPlus className="w-4 h-4 mr-1.5" />
                {creatingLead ? "Oppretter..." : "Opprett lead"}
              </Button>
            )}
            {selected.leadId && (
              <Button size="sm" variant="outline" onClick={() => { navigate("/leads"); setSelected(null); }}>
                <ExternalLink className="w-4 h-4 mr-1.5" />Lead
              </Button>
            )}
            {selected.salgsmulighetId && (
              <Button size="sm" variant="outline" onClick={() => { navigate("/salgsmuligheter"); setSelected(null); }}>
                <ExternalLink className="w-4 h-4 mr-1.5" />Salgsmulighet
              </Button>
            )}
            {selected.partnerId && (
              <Button size="sm" variant="outline" onClick={() => { navigate(`/partnere/${selected.partnerId}`); setSelected(null); }}>
                <ExternalLink className="w-4 h-4 mr-1.5" />Partner
              </Button>
            )}
          </>
        ) : undefined}
        tabContent={selected ? {
          detaljer: (
            <>
              {selected.firmanavn && selected.selskapId && (
                <SharedDetailField label="Selskap">
                  <span
                    className="text-sm text-primary hover:underline cursor-pointer"
                    onClick={() => { navigate(`/selskaper/${selected.selskapId}`); setSelected(null); }}
                  >
                    {selected.firmanavn}
                  </span>
                </SharedDetailField>
              )}

              <DetailSection title="Kontaktdetaljer">
                <SharedDetailField label="E-post" value={selected.email} />
                {selected.ansvarlig && (
                  <SharedDetailField label="Ansvarlig" value={selected.ansvarlig} />
                )}
                {selected.nesteSteg && (
                  <SharedDetailField label="Neste steg" value={selected.nesteSteg} />
                )}
              </DetailSection>

              <DetailDivider />

              {(selected.totalSent > 0 || selected.totalReceived > 0 || selected.sistKontaktetDato) && (
                <>
                  <DetailSection title="E-poststatistikk">
                    {(selected.totalSent > 0 || selected.totalReceived > 0) && (
                      <SharedDetailField
                        label="Totalt interaksjoner"
                        value={`${selected.totalSent + selected.totalReceived}`}
                      />
                    )}
                    {selected.sistKontaktetDato && (
                      <SharedDetailField
                        label="Siste interaksjon"
                        value={format(new Date(selected.sistKontaktetDato), "d. MMM yyyy, HH:mm", { locale: nb })}
                      />
                    )}
                    {(selected.totalSent > 0 || selected.totalReceived > 0) && (
                      <DetailStatGrid>
                        <DetailStatCard label="Sendt" value={selected.totalSent} />
                        <DetailStatCard label="Mottatt" value={selected.totalReceived} />
                      </DetailStatGrid>
                    )}
                  </DetailSection>
                  <DetailDivider />
                </>
              )}

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

              <DetailDivider />

              <DealSuggestions
                selskapId={selected.selskapId || selected.suggestedSelskapId}
                kontaktId={selected.kontaktId}
                email={selected.email}
                currentSalgsmulighetId={selected.salgsmulighetId}
                onLinked={() => {
                  fetchEmailContacts();
                  refresh();
                  setSelected(null);
                }}
              />
            </>
          ),
          interaksjoner: (
            <>
              {selected.kontaktId && (
                <ActivityLog kontakt_id={selected.kontaktId} />
              )}
              {selected.leadId && !selected.kontaktId && (
                <ActivityLog lead_id={selected.leadId} />
              )}
              {!selected.kontaktId && !selected.leadId && (
                <ActivityLog email={selected.email} />
              )}
            </>
          ),
        } : undefined}
      />
    </PageShell>
  );
}
