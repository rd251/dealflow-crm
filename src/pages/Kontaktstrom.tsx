import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { useProfiles } from "@/hooks/use-profiles";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import DetailPanelShell, { DetailSection, DetailField as SharedDetailField, DetailDivider, DetailStatGrid, DetailStatCard } from "@/components/DetailPanelShell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, UserPlus, Mail, Phone, Calendar, MessageSquare, Building2, ExternalLink, Clock, RefreshCw, Users, Plus } from "lucide-react";
import { format, formatDistanceToNow, isAfter } from "date-fns";
import { nb } from "date-fns/locale";
import { toast } from "sonner";
import ActivityLog from "@/components/ActivityLog";
import CompanyLinker from "@/components/CompanyLinker";
import DealSuggestions from "@/components/DealSuggestions";
import { gravatarUrl } from "@/lib/gravatar";

interface KontaktStromPerson {
  email: string;
  navn: string;
  firmanavn: string;
  domain: string;
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
  ownerUserId: string | null;
}

interface CompanyGroup {
  domain: string;
  firmanavn: string;
  selskapId: string | null;
  personCount: number;
  lastContactedAt: string | null;
  persons: KontaktStromPerson[];
  type: KontaktStromPerson["type"];
}

const TYPE_COLORS: Record<string, string> = {
  Lead: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  Salgsmulighet: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  Kunde: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  Partner: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  Kontakt: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  Ukjent: "bg-muted text-muted-foreground",
};

// Noise email patterns to filter out
const SYSTEM_EMAIL_PATTERNS = /^(noreply|no-reply|no\.reply|donotreply|do-not-reply|notifications?|alert[s]?|info@|support@|admin@|postmaster@|mailer-daemon|bounce[s]?|feedback@|newsletter|updates?@|billing@|receipts?@|hello@|team@|marketing@|sales@|press@|media@|contact@|webmaster@|hostmaster@|abuse@|daemon@|root@|system@|automated|auto-reply|auto\.reply|unsubscribe|opt-?out|calendar-notification|invitations?@)/i;
const SYSTEM_DOMAINS = /(@|\.)?(google|facebook|linkedin|twitter|github|apple|microsoft|amazon|stripe|paypal|shopify|slack|zoom|calendly|hubspot|mailchimp|sendgrid|intercom|zendesk|atlassian|notion|figma|canva|vercel|netlify|cloudflare|dropbox|trello|asana|monday|jira|confluence|bitbucket|heroku|twilio|postmark|sparkpost|mailgun|mandrill|amazonaws|googlemail)\.(com|io|co|net|org|no|se|dk)$/i;
const THROWAWAY_PATTERNS = /\+(bounce|tag|sub|unsub|verify|confirm|test|spam|junk)/i;

function isNoiseEmail(email: string): boolean {
  if (!email) return true;
  const local = email.split("@")[0];
  const domain = email.split("@")[1] || "";
  if (SYSTEM_EMAIL_PATTERNS.test(local)) return true;
  if (SYSTEM_DOMAINS.test("@" + domain)) return true;
  if (THROWAWAY_PATTERNS.test(local)) return true;
  // Filter very short local parts that are likely automated
  if (local.length <= 1) return true;
  return false;
}

function getDomain(email: string): string {
  return (email.split("@")[1] || "").toLowerCase();
}

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
  const { profiles } = useProfiles();

  const [emailContacts, setEmailContacts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterEier, setFilterEier] = useState<string>("alle");
  const [activeTab, setActiveTab] = useState<"people" | "companies">("people");
  const [selected, setSelected] = useState<KontaktStromPerson | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<CompanyGroup | null>(null);
  const [creatingLead, setCreatingLead] = useState(false);
  const [creatingCompany, setCreatingCompany] = useState(false);
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

  // Build unified person list
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

    // 1. CRM kontakter
    for (const k of kontakter) {
      if (!k.e_post) continue;
      const email = k.e_post.toLowerCase();
      if (isNoiseEmail(email)) continue;
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
        domain: getDomain(email),
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
        ownerUserId: null,
      });
    }

    // 2. Leads
    for (const l of leads) {
      if (!l.e_post) continue;
      const email = l.e_post.toLowerCase();
      if (map.has(email) || isNoiseEmail(email)) continue;
      const sugL = findSelskapByName(l.firmanavn) || findSelskapByDomain(email);
      map.set(email, {
        email, navn: l.kontaktperson || l.firmanavn, firmanavn: l.firmanavn,
        domain: getDomain(email),
        type: "Lead", status: l.status, ansvarlig: l.ansvarlig,
        sistKontaktetDato: null, sistKontaktetType: "",
        nesteSteg: l.neste_steg, totalSent: 0, totalReceived: 0,
        kontaktId: null, leadId: l.id, salgsmulighetId: null,
        selskapId: null, partnerId: null, inCrm: true,
        suggestedSelskapId: sugL?.id || null, suggestedSelskapNavn: sugL?.firmanavn || "",
        connectionStatus: resolveConnectionStatus(null, sugL?.id || null),
        ownerUserId: null,
      });
    }

    // 3. Salgsmuligheter
    for (const s of salgsmuligheter) {
      if (!s.e_post) continue;
      const email = s.e_post.toLowerCase();
      if (map.has(email) || isNoiseEmail(email)) continue;
      map.set(email, {
        email, navn: s.kontaktperson || s.navn,
        firmanavn: s.selskap_id ? getSelskapNavn(s.selskap_id) : "",
        domain: getDomain(email),
        type: "Salgsmulighet", status: s.status, ansvarlig: s.ansvarlig,
        sistKontaktetDato: null, sistKontaktetType: "",
        nesteSteg: s.neste_steg, totalSent: 0, totalReceived: 0,
        kontaktId: s.kontakt_id || null, leadId: null, salgsmulighetId: s.id,
        selskapId: s.selskap_id || null, partnerId: null, inCrm: true,
        suggestedSelskapId: null, suggestedSelskapNavn: "",
        connectionStatus: resolveConnectionStatus(s.selskap_id || null, null),
        ownerUserId: null,
      });
    }

    // 4. Partnere
    for (const p of partnere) {
      if (!p.e_post) continue;
      const email = p.e_post.toLowerCase();
      if (map.has(email) || isNoiseEmail(email)) continue;
      map.set(email, {
        email, navn: p.kontaktperson || p.partnernavn, firmanavn: p.partnernavn,
        domain: getDomain(email),
        type: "Partner", status: p.partnerstatus, ansvarlig: p.ansvarlig,
        sistKontaktetDato: null, sistKontaktetType: "",
        nesteSteg: "", totalSent: 0, totalReceived: 0,
        kontaktId: null, leadId: null, salgsmulighetId: null,
        selskapId: p.selskap_id || null, partnerId: p.id, inCrm: true,
        suggestedSelskapId: null, suggestedSelskapNavn: "",
        connectionStatus: resolveConnectionStatus(p.selskap_id || null, null),
        ownerUserId: null,
      });
    }

    // 5. Email contacts
    for (const ec of emailContacts) {
      const email = ec.primary_email?.toLowerCase();
      if (!email || isNoiseEmail(email)) continue;

      const existing = map.get(email);
      if (existing) {
        if (ec.last_contacted_at) {
          if (!existing.sistKontaktetDato || new Date(ec.last_contacted_at) > new Date(existing.sistKontaktetDato)) {
            existing.sistKontaktetDato = ec.last_contacted_at;
            existing.sistKontaktetType = ec.last_activity_type || "E-post";
          }
        }
        existing.totalSent += ec.total_emails_sent || 0;
        existing.totalReceived += ec.total_emails_received || 0;
        if (ec.user_id && !existing.ownerUserId) existing.ownerUserId = ec.user_id;
      } else {
        let ecType: KontaktStromPerson["type"] = "Ukjent";
        let ecStatus = "";
        let ecAnsvarlig = "";
        let ecNesteSteg = "";
        let ecFirmanavn = ec.domain || "";
        let ecSelskapId = ec.selskap_id || null;
        let ecKontaktId = ec.kontakt_id || null;
        let ecSuggestedSelskapId: string | null = null;
        let ecSuggestedSelskapNavn = "";

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

        if (!ecSelskapId && ecFirmanavn) {
          const selskapByName = findSelskapByName(ecFirmanavn);
          if (selskapByName) {
            ecSuggestedSelskapId = selskapByName.id;
            ecSuggestedSelskapNavn = selskapByName.firmanavn;
          }
        }

        if (!ecSelskapId && !ecSuggestedSelskapId) {
          const selskapByDomain = findSelskapByDomain(email);
          if (selskapByDomain) {
            ecSuggestedSelskapId = selskapByDomain.id;
            ecSuggestedSelskapNavn = selskapByDomain.firmanavn;
          }
        }

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
          domain: getDomain(email),
          type: ecType, status: ecStatus, ansvarlig: ecAnsvarlig,
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
          ownerUserId: ec.user_id || null,
        });
      }
    }

    const result = Array.from(map.values());
    result.sort((a, b) => {
      if (!a.sistKontaktetDato && !b.sistKontaktetDato) return 0;
      if (!a.sistKontaktetDato) return 1;
      if (!b.sistKontaktetDato) return -1;
      return new Date(b.sistKontaktetDato).getTime() - new Date(a.sistKontaktetDato).getTime();
    });

    return result;
  }, [kontakter, leads, salgsmuligheter, selskaper, partnere, emailContacts]);

  // Filtered people
  const filteredPeople = useMemo(() => {
    return persons.filter(p => {
      if (search) {
        const q = search.toLowerCase();
        if (!p.navn.toLowerCase().includes(q) && !p.email.includes(q) && !p.firmanavn.toLowerCase().includes(q)) return false;
      }
      if (filterEier !== "alle" && p.ownerUserId !== filterEier) return false;
      return true;
    });
  }, [persons, search, filterEier]);

  // Company groups
  const companyGroups = useMemo(() => {
    const domainMap = new Map<string, CompanyGroup>();

    for (const p of persons) {
      if (!p.domain) continue;
      if (filterEier !== "alle" && p.ownerUserId !== filterEier) continue;

      const existing = domainMap.get(p.domain);
      if (existing) {
        existing.personCount++;
        existing.persons.push(p);
        // Use best company name / selskap
        if (!existing.selskapId && p.selskapId) {
          existing.selskapId = p.selskapId;
          existing.firmanavn = p.firmanavn;
        }
        if (!existing.firmanavn && p.firmanavn) {
          existing.firmanavn = p.firmanavn;
        }
        // Track latest activity
        if (p.sistKontaktetDato) {
          if (!existing.lastContactedAt || new Date(p.sistKontaktetDato) > new Date(existing.lastContactedAt)) {
            existing.lastContactedAt = p.sistKontaktetDato;
          }
        }
        // Promote type priority
        const typePriority = { Kunde: 5, Partner: 4, Salgsmulighet: 3, Lead: 2, Kontakt: 1, Ukjent: 0 };
        if ((typePriority[p.type] || 0) > (typePriority[existing.type] || 0)) {
          existing.type = p.type;
        }
      } else {
        domainMap.set(p.domain, {
          domain: p.domain,
          firmanavn: p.firmanavn || p.domain,
          selskapId: p.selskapId,
          personCount: 1,
          lastContactedAt: p.sistKontaktetDato,
          persons: [p],
          type: p.type,
        });
      }
    }

    let groups = Array.from(domainMap.values());

    if (search) {
      const q = search.toLowerCase();
      groups = groups.filter(g =>
        g.firmanavn.toLowerCase().includes(q) ||
        g.domain.includes(q) ||
        g.persons.some(p => p.navn.toLowerCase().includes(q) || p.email.includes(q))
      );
    }

    // Sort by last contacted
    groups.sort((a, b) => {
      if (!a.lastContactedAt && !b.lastContactedAt) return 0;
      if (!a.lastContactedAt) return 1;
      if (!b.lastContactedAt) return -1;
      return new Date(b.lastContactedAt).getTime() - new Date(a.lastContactedAt).getTime();
    });

    return groups;
  }, [persons, search, filterEier]);

  const handleCreateLead = async (person: KontaktStromPerson) => {
    setCreatingLead(true);
    try {
      const { error } = await supabase.from("leads").insert({
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

  const handleCreateCompany = async (group: CompanyGroup) => {
    setCreatingCompany(true);
    try {
      const firmanavn = group.firmanavn !== group.domain ? group.firmanavn : group.domain.split(".")[0].charAt(0).toUpperCase() + group.domain.split(".")[0].slice(1);
      const { data, error } = await supabase.from("selskaper").insert({
        firmanavn,
        kundestatus: "Ikke kunde" as any,
      }).select().single();

      if (error) throw error;
      toast.success(`Selskap "${firmanavn}" opprettet`);
      refresh();
      setSelectedCompany(null);
    } catch (err: any) {
      toast.error("Kunne ikke opprette selskap: " + (err.message || "Ukjent feil"));
    } finally {
      setCreatingCompany(false);
    }
  };

  const faviconUrl = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

  const personInitial = (name: string) => (name || "?").charAt(0).toUpperCase();

  return (
    <PageShell
      title="Søk"
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
          <Select value={filterEier} onValueChange={setFilterEier}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Eier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle eiere</SelectItem>
              {profiles.map(p => (
                <SelectItem key={p.user_id} value={p.user_id}>
                  {p.display_name || p.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      {/* Tabs */}
      <div className="border-b mb-0">
        <div className="flex gap-6 px-1">
          <button
            className={`pb-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "people"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => { setActiveTab("people"); setSelectedCompany(null); }}
          >
            People <span className="text-muted-foreground ml-1">{filteredPeople.length}</span>
          </button>
          <button
            className={`pb-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "companies"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => { setActiveTab("companies"); setSelected(null); }}
          >
            Companies <span className="text-muted-foreground ml-1">{companyGroups.length}</span>
          </button>
        </div>
      </div>

      {/* People list */}
      {activeTab === "people" && (
        <div className="divide-y max-h-[calc(100vh-220px)] overflow-y-auto">
          {filteredPeople.map(p => (
            <div
              key={p.email}
              className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/40 cursor-pointer transition-colors ${
                selected?.email === p.email ? "bg-muted/60" : ""
              }`}
              onClick={() => { setSelected(p); setSelectedCompany(null); }}
            >
              <Avatar className="w-9 h-9 shrink-0">
                <AvatarImage src={gravatarUrl(p.email, 72) || undefined} alt={p.navn} />
                <AvatarFallback className="text-xs font-medium bg-muted text-muted-foreground">
                  {personInitial(p.navn)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.navn}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {p.firmanavn && (
                    <>
                      {p.selskapId ? (
                        <span
                          className="hover:underline cursor-pointer"
                          onClick={e => { e.stopPropagation(); navigate(`/selskaper/${p.selskapId}`); }}
                        >{p.firmanavn}</span>
                      ) : (
                        <span>{p.firmanavn}</span>
                      )}
                      <span className="mx-1">·</span>
                    </>
                  )}
                  {p.email}
                </p>
              </div>
              {(p.type === "Lead" || p.type === "Salgsmulighet" || p.type === "Kunde" || p.type === "Partner") && (
                <Badge variant="secondary" className={`text-xs shrink-0 ${TYPE_COLORS[p.type]}`}>
                  {p.type}
                </Badge>
              )}
            </div>
          ))}
          {filteredPeople.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-12">
              Ingen personer funnet
            </div>
          )}
        </div>
      )}

      {/* Companies list */}
      {activeTab === "companies" && (
        <div className="divide-y max-h-[calc(100vh-220px)] overflow-y-auto">
          {companyGroups.map(g => (
            <div
              key={g.domain}
              className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/40 cursor-pointer transition-colors ${
                selectedCompany?.domain === g.domain ? "bg-muted/60" : ""
              }`}
              onClick={() => { setSelectedCompany(g); setSelected(null); }}
            >
              <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                <img
                  src={faviconUrl(g.domain)}
                  alt={g.firmanavn}
                  className="w-5 h-5"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement!.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>'; }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{g.firmanavn}</p>
                <p className="text-xs text-muted-foreground">
                  {g.personCount} {g.personCount === 1 ? "person" : "personer"}
                  {g.domain && <span className="ml-1">· {g.domain}</span>}
                </p>
              </div>
              {(g.type === "Lead" || g.type === "Kunde" || g.type === "Partner") && (
                <Badge variant="secondary" className={`text-xs shrink-0 ${TYPE_COLORS[g.type]}`}>
                  {g.type}
                </Badge>
              )}
            </div>
          ))}
          {companyGroups.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-12">
              Ingen selskaper funnet
            </div>
          )}
        </div>
      )}

      {/* Person detail panel */}
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
                {selected.ansvarlig && <SharedDetailField label="Ansvarlig" value={selected.ansvarlig} />}
                {selected.nesteSteg && <SharedDetailField label="Neste steg" value={selected.nesteSteg} />}
              </DetailSection>
              <DetailDivider />
              {(selected.totalSent > 0 || selected.totalReceived > 0 || selected.sistKontaktetDato) && (
                <>
                  <DetailSection title="E-poststatistikk">
                    {(selected.totalSent > 0 || selected.totalReceived > 0) && (
                      <SharedDetailField label="Totalt interaksjoner" value={`${selected.totalSent + selected.totalReceived}`} />
                    )}
                    {selected.sistKontaktetDato && (
                      <SharedDetailField label="Siste interaksjon" value={format(new Date(selected.sistKontaktetDato), "d. MMM yyyy, HH:mm", { locale: nb })} />
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
                onLinked={() => { fetchEmailContacts(); refresh(); setSelected(null); }}
              />
              <DetailDivider />
              <DealSuggestions
                selskapId={selected.selskapId || selected.suggestedSelskapId}
                kontaktId={selected.kontaktId}
                email={selected.email}
                currentSalgsmulighetId={selected.salgsmulighetId}
                onLinked={() => { fetchEmailContacts(); refresh(); setSelected(null); }}
              />
            </>
          ),
          interaksjoner: (
            <>
              {selected.kontaktId && <ActivityLog kontakt_id={selected.kontaktId} />}
              {selected.leadId && !selected.kontaktId && <ActivityLog lead_id={selected.leadId} />}
              {!selected.kontaktId && !selected.leadId && <ActivityLog email={selected.email} />}
            </>
          ),
        } : undefined}
      />

      {/* Company detail panel */}
      <DetailPanelShell
        open={!!selectedCompany}
        onClose={() => setSelectedCompany(null)}
        title={selectedCompany?.firmanavn || ""}
        subtitle={`${selectedCompany?.personCount || 0} ${(selectedCompany?.personCount || 0) === 1 ? "person" : "personer"}`}
        badges={selectedCompany ? (
          <Badge variant="secondary" className={`text-xs ${TYPE_COLORS[selectedCompany.type]}`}>
            {selectedCompany.type}
          </Badge>
        ) : undefined}
        actions={selectedCompany?.selskapId ? (
          <Button size="sm" variant="outline" onClick={() => { navigate(`/selskaper/${selectedCompany.selskapId}`); setSelectedCompany(null); }}>
            <ExternalLink className="w-4 h-4 mr-1.5" />Selskapsprofil
          </Button>
        ) : undefined}
        tabContent={selectedCompany ? {
          detaljer: (
            <>
              <DetailSection title={`Personer (${selectedCompany.persons.length})`}>
                <div className="space-y-0 -mx-2">
                  {selectedCompany.persons.map(p => (
                    <div
                      key={p.email}
                      className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => { setSelected(p); setSelectedCompany(null); }}
                    >
                      <Avatar className="w-7 h-7 shrink-0">
                        <AvatarImage src={gravatarUrl(p.email, 56) || undefined} alt={p.navn} />
                        <AvatarFallback className="text-[10px] font-medium bg-muted text-muted-foreground">
                          {personInitial(p.navn)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{p.navn}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{p.email}</p>
                      </div>
                      {p.sistKontaktetDato && (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatAktivitetDato(p.sistKontaktetDato)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </DetailSection>
              <DetailDivider />
              {selectedCompany.lastContactedAt && (
                <SharedDetailField
                  label="Siste kontakt"
                  value={format(new Date(selectedCompany.lastContactedAt), "d. MMM yyyy", { locale: nb })}
                />
              )}
              <SharedDetailField label="Domene" value={selectedCompany.domain} />
            </>
          ),
          interaksjoner: (
            <>
              {selectedCompany.selskapId ? (
                <ActivityLog selskap_id={selectedCompany.selskapId} />
              ) : selectedCompany.persons.length > 0 ? (
                <ActivityLog email={selectedCompany.persons[0].email} />
              ) : (
                <p className="text-xs text-muted-foreground py-4">Ingen aktiviteter</p>
              )}
            </>
          ),
        } : undefined}
      />
    </PageShell>
  );
}
