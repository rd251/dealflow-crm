import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import PageShell from "@/components/PageShell";
import SalesTabs from "@/components/SalesTabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProfiles } from "@/hooks/use-profiles";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import DetailPanelShell, { DetailSection, DetailField, DetailDivider } from "@/components/DetailPanelShell";
import EntityCalendarTab from "@/components/EntityCalendarTab";
import { Plus, Search, ArrowRightCircle, Trash2, Users2, Upload, Lock, Mail, ArrowUp, ArrowDown, ChevronsUpDown, PenLine, Send, Phone, CalendarDays, UserPlus, CheckCircle2, TrendingUp, AlertTriangle } from "lucide-react";
import { relativTid, dagerSiden, kildeGruppe, KILDE_GRUPPER, leadStatusFarge, leadStatusKort, idag, datoOm, type KildeGruppe } from "@/lib/sales-flow";
import SendEmailDialog from "@/components/SendEmailDialog";
import SelskapInnsikt from "@/components/SelskapInnsikt";
import { Lead, LeadStatus, LeadKilde, Partner } from "@/data/crm-data";
import { Badge } from "@/components/ui/badge";
import InlineTaskForm from "@/components/InlineTaskForm";
import ActivityLog from "@/components/ActivityLog";
import EntityChangelog from "@/components/EntityChangelog";
import LastActivityBadge from "@/components/LastActivityBadge";
import DataImportDialog from "@/components/DataImportDialog";
import CompanyLogo from "@/components/CompanyLogo";
import LeadForwardEmailPreview from "@/components/LeadForwardEmailPreview";
import NesteStegTaskButton from "@/components/NesteStegTaskButton";
import { PinnedNotatBoks, PinnedNotatFelt } from "@/components/PinnedNotat";
import { skjemaOnske, produktInteresse } from "@/lib/lead-notater";
import LeadHvaSkjedde from "@/components/LeadHvaSkjedde";
import { leadKvalitet, ekteOnske, nesteTekst, komInnTekst, kortDato } from "@/lib/lead-kort";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import RingelisteIdag from "@/components/RingelisteIdag";
import {
  NYTT_LEAD_OPPFOLGING_DAGER,
  oppfolgingDatoOm,
  LEAD_KALD_DAGER,
  erKaldtLead,
  effektivOppfolging,
  oppfolgingEtikett,
  oppfolgingFarge,
  oppfolgingTilstand,
} from "@/lib/follow-up-rules";
import { supabase } from "@/integrations/supabase/client";
import { loggAktivitet } from "@/lib/activity-logging";
import { applyLeadActivityResult } from "@/lib/lead-activity-result";
import { toast } from "sonner";
import MineTeametToggle from "@/components/MineTeametToggle";
import { useMineFilter } from "@/hooks/use-mine-filter";

/** Generiske e-postdomener som ikke peker på et firma. */
const GENERISKE_EPOSTDOMENER = /^(gmail\.com|hotmail\.com|outlook\.com|yahoo\.com|live\.com|icloud\.com|me\.com|msn\.com|aol\.com|protonmail\.com|proton\.me)$/i;

/** Bedriftsvisning: reelt firmanavn, ellers domenet fra e-posten. */
function bedriftVisning(lead: Pick<Lead, "firmanavn" | "kontaktperson" | "e_post">): string | null {
  const navn = (lead.firmanavn || "").trim();
  const normalisertNavn = navn.toLocaleLowerCase("nb");
  const kontaktperson = (lead.kontaktperson || "").trim().toLocaleLowerCase("nb");
  if (navn && normalisertNavn !== kontaktperson && normalisertNavn !== "ukjent") return navn;
  const domene = (lead.e_post || "").split("@")[1]?.toLowerCase().trim() || "";
  if (domene && !GENERISKE_EPOSTDOMENER.test(domene)) return domene.replace(/^www\./, "");
  return null;
}

// Only user-selectable statuses – no conversion statuses in dropdown
const statusOptions: LeadStatus[] = ["Ny", "Kontaktet", "Svarte ikke telefon", "Kvalifisert", "Ikke aktuelt"];
const kildeOptions: string[] = ["Nettside", "LinkedIn", "Partner", "Referanse", "Kald outbound", "E-post", "Telefon", "Organisk", "Facebook ads", "Instantly kald e-post", "Google ads", "Agent Builder", "Annet"];

const statusColors: Record<string, string> = leadStatusFarge;

export default function Leads() {
  const isMobile = useIsMobile();
  const { profiles } = useProfiles();
  const ownerName = (value: string) => profiles.find(p => p.user_id === value)?.display_name || value || "Ikke fordelt";
  const { canEdit, isAdmin, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { leads, partnere, updateLeads, updateOppgaver, konverterLead, konverterTilPartner, generateId } = useCrmStore();
  const [search, setSearch] = useState("");
  const { filter: eierFilter, setFilter: setEierFilter, tilhorerFilter } = useMineFilter("leads");
  const [visning, setVisning] = useState<"leads" | "ringeliste" | "kalde">("leads");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [convertDialogLead, setConvertDialogLead] = useState<Lead | null>(null);
  const [convertNavn, setConvertNavn] = useState("");
  const [partnerDialogLead, setPartnerDialogLead] = useState<Lead | null>(null);
  const [enrichFields, setEnrichFields] = useState({ orgnr: "", bransje: "", firmaadresse: "", postadresse: "" });
  const openCreateActivityRef = useRef<(() => void) | null>(null);
  const [detailTab, setDetailTab] = useState<"detaljer" | "tilbud" | "selskap" | "kontakt" | "interaksjoner" | "notater" | "kalender" | "dokumenter">("detaljer");
  const [pendingOpenActivity, setPendingOpenActivity] = useState(false);
  const [form, setForm] = useState<Partial<Lead>>({ firmanavn: "", kontaktperson: "", e_post: "", telefon: "", kilde: "Nettside", status: "Ny", ansvarlig: "", neste_steg: "", notater: "", rolle_i_firma: "", use_case: "" });
  const [filterUtenOppfolging, setFilterUtenOppfolging] = useState(false);
  const [kildeFilter, setKildeFilter] = useState<"alle" | KildeGruppe>("alle");
  const [statusFilter, setStatusFilter] = useState<"alle" | LeadStatus>("alle");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [slettLead, setSlettLead] = useState<Lead | null>(null);
  // Forwarding to partner
  const [forwardDialogLead, setForwardDialogLead] = useState<Lead | null>(null);
  const [forwardPartnerId, setForwardPartnerId] = useState<string>("");
  const [forwardMessage, setForwardMessage] = useState<string>("");
  const [forwardHarByggeagent, setForwardHarByggeagent] = useState<boolean>(false);
  const [forwardOnboarding, setForwardOnboarding] = useState<string>("");
  const [forwardSending, setForwardSending] = useState<boolean>(false);
  const [forwardStep, setForwardStep] = useState<"edit" | "confirm">("edit");

  type LeadSortKey = "firmanavn" | "kontaktperson" | "kilde" | "status" | "neste_steg" | "sist_aktivitet" | "opprettet_dato";
  const [sortKey, setSortKey] = useState<LeadSortKey | null>("opprettet_dato");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (key: LeadSortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ col }: { col: LeadSortKey }) => {
    if (sortKey !== col) return <ChevronsUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  // Pick up filter from query param
  useEffect(() => {
    if (searchParams.get("filter") === "uten-oppfolging") {
      setFilterUtenOppfolging(true);
      setSearchParams({}, { replace: true });
    }
    const openId = searchParams.get("open");
    if (openId) {
      const lead = leads.find(l => l.id === openId);
      if (lead) {
        setSelectedLead(lead);
        setSearchParams({}, { replace: true });
      }
    }
    if (searchParams.get("ny") === "1") {
      setDialogOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, leads]);

  /** Deep-linkede filtre fra oversikten. */
  const statusParam = searchParams.get("status") as LeadStatus | null;
  const oppfolgingFilter = searchParams.get("filter") === "oppfolging";
  const clearDeepFilter = (key: "status" | "filter") => {
    const next = new URLSearchParams(searchParams);
    next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const now = new Date();

  // Helper: is a lead converted (locked)? Also check konvertert_dato for DB-persisted state
  const isConverted = (l: Lead) =>
    !!l.konvertert_til ||
    !!l.konvertert_dato ||
    l.status === "Konvertert til salg" ||
    l.status === "Konvertert til partner";

  // Derive conversion type for display when konvertert_til is missing (after reload)
  const getConversionType = (l: Lead): "" | "salg" | "partner" => {
    if (l.konvertert_til) return l.konvertert_til as "salg" | "partner";
    if (l.status === "Konvertert til salg") return "salg";
    if (l.status === "Konvertert til partner") return "partner";
    if (l.konvertert_dato) return "salg";
    return "";
  };

  const normalizedSearch = search.trim().toLowerCase();

  /** Aktive (ikke konverterte) leads – grunnlag for oppfølging og kalde leads. */
  const aktiveLeads = leads.filter(l => !isConverted(l) && l.status !== "Ikke aktuelt");
  const kaldeLeads = aktiveLeads.filter(erKaldtLead);

  const filteredUnsorted = leads.filter(l => {
    // Hide converted leads to avoid duplication with salgsmuligheter/partnere
    if (isConverted(l)) return false;
    // Kalde leads holdes utenfor hovedflyten – de har egen visning
    if (visning === "kalde") {
      if (!erKaldtLead(l) || l.status === "Ikke aktuelt") return false;
    } else if (erKaldtLead(l) && l.status !== "Ikke aktuelt") {
      return false;
    }
    if (filterUtenOppfolging) {
      if (l.status === "Ikke aktuelt") return false;
      const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      if (l.sist_aktivitet && new Date(l.sist_aktivitet) >= cutoff) return false;
    }
    if (oppfolgingFilter) {
      if (l.status === "Ikke aktuelt") return false;
      const cutoff = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      if (l.sist_aktivitet && new Date(l.sist_aktivitet) >= cutoff) return false;
    }
    if (!tilhorerFilter(l.ansvarlig)) return false;
    if (statusParam && l.status !== statusParam) return false;
    if (kildeFilter !== "alle" && kildeGruppe(l.kilde) !== kildeFilter) return false;
    if (statusFilter !== "alle" && l.status !== statusFilter) return false;
    if (!normalizedSearch) return true;
    return (
      l.firmanavn.toLowerCase().includes(normalizedSearch) ||
      l.kontaktperson.toLowerCase().includes(normalizedSearch) ||
      l.e_post.toLowerCase().includes(normalizedSearch) ||
      l.telefon.toLowerCase().includes(normalizedSearch)
    );
  });

  const filtered = [...filteredUnsorted].sort((a, b) => {
    if (!sortKey) return 0;
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "firmanavn": return dir * a.firmanavn.localeCompare(b.firmanavn, "nb");
      case "kontaktperson": return dir * a.kontaktperson.localeCompare(b.kontaktperson, "nb");
      case "kilde": return dir * (a.kilde || "").localeCompare(b.kilde || "", "nb");
      case "status": return dir * a.status.localeCompare(b.status, "nb");
      case "neste_steg": return dir * (a.neste_steg || "").localeCompare(b.neste_steg || "", "nb");
      case "sist_aktivitet": return dir * (a.sist_aktivitet || "").localeCompare(b.sist_aktivitet || "");
      case "opprettet_dato": return dir * (a.opprettet_dato || "").localeCompare(b.opprettet_dato || "");
      default: return 0;
    }
  });

  const addLead = () => {
    const today = new Date().toISOString().split("T")[0];
    const id = generateId("L", leads);
    const newLead: Lead = {
      id, firmanavn: form.firmanavn || "", kontaktperson: form.kontaktperson || "",
      e_post: form.e_post || "", telefon: form.telefon || "", kilde: form.kilde as LeadKilde || "Annet",
      status: "Ny", ansvarlig: form.ansvarlig || "", neste_steg: form.neste_steg || "",
      notater: form.notater || "", opprettet_dato: today, sist_aktivitet: today,
      neste_oppfolging: oppfolgingDatoOm(NYTT_LEAD_OPPFOLGING_DAGER), konvertert_dato: "",
      konvertert_til: "",
      rolle_i_firma: form.rolle_i_firma || "", use_case: form.use_case || "",
      videresendt_til_partner_id: "", videresendt_dato: "",
    };
    updateLeads(prev => [...prev, newLead]);
    setDialogOpen(false);
    setForm({ firmanavn: "", kontaktperson: "", e_post: "", telefon: "", kilde: "Nettside", status: "Ny", ansvarlig: "", neste_steg: "", notater: "", rolle_i_firma: "", use_case: "" });
  };

  const changeStatus = (id: string, status: LeadStatus) => {
    updateLeads(prev => prev.map(l => l.id === id ? { ...l, status, sist_aktivitet: new Date().toISOString().split("T")[0] } : l));
  };

  /* ---- Hurtighandlinger ---- */
  const loggSamtale = async (lead: Lead) => {
    try {
      await loggAktivitet({
        logg: "ringte",
        target: { lead_id: lead.id },
        tittel: `Samtale med ${lead.kontaktperson || lead.firmanavn}`,
        notat: `Ringt ${lead.kontaktperson || lead.firmanavn}${lead.telefon ? ` (${lead.telefon})` : ""}`,
      });
      updateLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: l.status === "Ny" ? "Kontaktet" : l.status, sist_aktivitet: idag() } : l));
      toast.success("Samtale logget");
    } catch (err: any) {
      toast.error(`Kunne ikke logge samtale: ${err?.message || "ukjent feil"}`);
    }
  };

  const bookMoete = (lead: Lead) => {
    setSelectedLead(lead);
    setDetailTab("kalender");
  };

  const sendEpost = (lead: Lead) => {
    setSelectedLead(lead);
    setEmailDialogOpen(true);
  };

  // Open the "forward to partner" dialog, and auto-detect if lead has self-builder onboarding answers
  const openForwardDialog = async (lead: Lead) => {
    setForwardDialogLead(lead);
    setForwardPartnerId("");
    setForwardMessage("");
    setForwardHarByggeagent(false);
    setForwardOnboarding("");
    setForwardStep("edit");
    try {
      const email = (lead.e_post || "").trim().toLowerCase();
      const firma = (lead.firmanavn || "").trim();
      if (!email && !firma) return;
      const query = supabase.from("onboarding_svar").select("svar, firmanavn, kontakt_epost, created_at").order("created_at", { ascending: false }).limit(1);
      const { data } = email
        ? await query.ilike("kontakt_epost", email)
        : await query.ilike("firmanavn", firma);
      if (data && data.length > 0) {
        setForwardHarByggeagent(true);
        const svar = data[0].svar as Record<string, any> | null;
        if (svar && typeof svar === "object") {
          const parts: string[] = [];
          for (const [k, v] of Object.entries(svar)) {
            const val = typeof v === "string" ? v : JSON.stringify(v);
            if (val && val.trim()) parts.push(`• ${k}: ${val.trim().slice(0, 240)}`);
          }
          setForwardOnboarding(parts.slice(0, 8).join("\n"));
        }
      }
    } catch (err) {
      console.error("Onboarding lookup failed", err);
    }
  };

  const sendForward = async () => {
    if (!forwardDialogLead || !forwardPartnerId) return;
    const partner = partnere.find((p: Partner) => p.id === forwardPartnerId);
    if (!partner) { toast.error("Fant ikke valgt partner"); return; }
    if (!partner.e_post) { toast.error("Partneren mangler e-postadresse"); return; }
    setForwardSending(true);
    const lead = forwardDialogLead;
    const today = new Date().toISOString().split("T")[0];
    try {
      const { data: emailRes, error: emailErr } = await supabase.functions.invoke("forward-lead-to-partner", {
        body: {
          leadId: lead.id,
          partnerId: partner.id,
          internMelding: forwardMessage,
          harByggeagent: forwardHarByggeagent,
          onboardingOppsummering: forwardOnboarding,
        },
      });
      if (emailErr) throw emailErr;
      if (emailRes?.error) throw new Error(emailRes.error);

      // Persist forwarding state on the lead
      updateLeads(prev => prev.map(l => l.id === lead.id
        ? { ...l, videresendt_til_partner_id: partner.id, videresendt_dato: today, sist_aktivitet: today }
        : l));

      // Log an activity for the audit trail
      try {
        await loggAktivitet({
          logg: "epost",
          target: { lead_id: lead.id, partner_id: partner.id },
          tittel: `Videresendt til partner: ${partner.partnernavn}`,
          notat: `Lead videresendt til ${partner.partnernavn} (${partner.e_post}).${forwardMessage ? `\n\nMelding: ${forwardMessage}` : ""}`,
        });
      } catch (logErr) {
        console.warn("Activity log failed", logErr);
      }

      toast.success(`Lead videresendt til ${partner.partnernavn}`);
      setForwardDialogLead(null);
    } catch (err: any) {
      console.error("Forward failed", err);
      toast.error(`Kunne ikke videresende: ${err?.message || "ukjent feil"}`);
    } finally {
      setForwardSending(false);
    }
  };

  const konverterOgOpprettOppgave = (lead: Lead, navn: string, enrich?: typeof enrichFields) => {
    const smId = konverterLead(lead.id, navn, enrich);
    if (selectedLead?.id === lead.id) setSelectedLead(null);
    if (!smId) return;
    updateOppgaver(prev => [...prev, {
      id: crypto.randomUUID(), oppgave: "Gjennomfør demo", lead_id: "", selskap_id: "", salgsmulighet_id: smId, kontakt_id: "",
      ansvarlig: lead.ansvarlig || user?.id || "", frist: datoOm(7), frist_tid: "", prioritet: "Høy", status: "Åpen", paaminnelse: true, notater: "",
    }]);
    toast.success(`${lead.firmanavn || lead.kontaktperson} er nå salgsmulighet (Møte booket) · oppgave «Gjennomfør demo» opprettet`, {
      action: { label: "Åpne", onClick: () => navigate(`/salgsmuligheter?open=${smId}`) },
    });
  };

  const currentLead = selectedLead ? leads.find(l => l.id === selectedLead.id) || selectedLead : null;
  const currentIsLocked = currentLead ? isConverted(currentLead) : false;
  const currentForwardedPartner = currentLead?.videresendt_til_partner_id
    ? partnere.find((p: Partner) => p.id === currentLead.videresendt_til_partner_id)
    : null;

  useEffect(() => {
    if (pendingOpenActivity && detailTab === "interaksjoner") {
      const t = setTimeout(() => {
        openCreateActivityRef.current?.();
        setPendingOpenActivity(false);
      }, 50);
      return () => clearTimeout(t);
    }
  }, [pendingOpenActivity, detailTab]);

  useEffect(() => { setDetailTab("detaljer"); }, [selectedLead?.id]);

  return (
    <PageShell
      title="Leads"
      navigation={<SalesTabs value="leads" />}
      subtitle={`${filtered.length} leads`}
      actions={canEdit ? (
        <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}><Upload className="w-4 h-4 mr-1" />{!isMobile && "Importer"}</Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />{!isMobile && "Nytt lead"}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader><DialogTitle>Nytt lead</DialogTitle><DialogDescription>Fyll inn detaljer for det nye leadet.</DialogDescription></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Firmanavn" value={form.firmanavn} onChange={e => setForm(f => ({ ...f, firmanavn: e.target.value }))} />
              <Input placeholder="Kontaktperson" value={form.kontaktperson} onChange={e => setForm(f => ({ ...f, kontaktperson: e.target.value }))} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input placeholder="E-post" value={form.e_post} onChange={e => setForm(f => ({ ...f, e_post: e.target.value }))} />
                <Input placeholder="Telefon" value={form.telefon} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select className="border rounded-lg px-3 py-2 text-sm bg-background" value={form.kilde} onChange={e => setForm(f => ({ ...f, kilde: e.target.value as LeadKilde }))}>
                  {kildeOptions.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
                <Input placeholder="Ansvarlig" value={form.ansvarlig} onChange={e => setForm(f => ({ ...f, ansvarlig: e.target.value }))} />
              </div>
              <Input placeholder="Neste steg" value={form.neste_steg} onChange={e => setForm(f => ({ ...f, neste_steg: e.target.value }))} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input placeholder="Rolle i firma" value={form.rolle_i_firma} onChange={e => setForm(f => ({ ...f, rolle_i_firma: e.target.value }))} />
                <Input placeholder="Use case" value={form.use_case} onChange={e => setForm(f => ({ ...f, use_case: e.target.value }))} />
              </div>
              <Textarea placeholder="Notater" value={form.notater} onChange={e => setForm(f => ({ ...f, notater: e.target.value }))} />
              <Button onClick={addLead} className="w-full" disabled={!form.firmanavn}>Opprett lead</Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      ) : undefined}
    >
      <DataImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        target="leads"
        onImport={async (rows) => {
          const today = new Date().toISOString().split("T")[0];
          let success = 0, errors = 0;
          const newLeads: Lead[] = [];
          for (const row of rows) {
            try {
              newLeads.push({
                id: crypto.randomUUID(),
                firmanavn: String(row.firmanavn || ""),
                kontaktperson: String(row.kontaktperson || ""),
                e_post: String(row.e_post || ""),
                telefon: String(row.telefon || ""),
                kilde: (row.kilde as LeadKilde) || "Annet",
                status: "Ny",
                ansvarlig: String(row.ansvarlig || ""),
                neste_steg: String(row.neste_steg || ""),
                notater: String(row.notater || ""),
                opprettet_dato: today,
                sist_aktivitet: today,
                konvertert_dato: "",
                konvertert_til: "",
                rolle_i_firma: String(row.rolle_i_firma || ""),
                use_case: String(row.use_case || ""),
                videresendt_til_partner_id: "",
                videresendt_dato: "",
              });
              success++;
            } catch { errors++; }
          }
          if (newLeads.length > 0) {
            updateLeads(prev => [...prev, ...newLeads]);
          }
          return { success, errors };
        }}
      />

      {/* Convert to sale dialog */}
      <Dialog open={!!convertDialogLead} onOpenChange={open => { if (!open) { setConvertDialogLead(null); setConvertNavn(""); setEnrichFields({ orgnr: "", bransje: "", firmaadresse: "", postadresse: "" }); } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kvalifiser til salgsmulighet</DialogTitle>
            <DialogDescription>Gi salgsmuligheten et navn og fyll inn selskapsinfo for {convertDialogLead?.firmanavn}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {convertDialogLead && (
              <SelskapInnsikt
                domene={undefined}
                firmanavn={convertDialogLead.firmanavn}
                e_post={convertDialogLead.e_post}
                onEnriched={(data) => {
                  setEnrichFields(prev => ({
                    orgnr: prev.orgnr || data.orgnr || "",
                    bransje: prev.bransje || data.bransje || "",
                    firmaadresse: prev.firmaadresse || data.firmaadresse || "",
                    postadresse: prev.postadresse || data.postadresse || "",
                  }));
                }}
              />
            )}
            <Input
              placeholder="Navn på salgsmulighet / use case"
              value={convertNavn}
              onChange={e => setConvertNavn(e.target.value)}
              autoFocus
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Org.nr</label>
                <Input placeholder="Org.nr" value={enrichFields.orgnr} onChange={e => setEnrichFields(p => ({ ...p, orgnr: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Bransje</label>
                <Input placeholder="Bransje" value={enrichFields.bransje} onChange={e => setEnrichFields(p => ({ ...p, bransje: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Firmaadresse</label>
                <Input placeholder="Firmaadresse" value={enrichFields.firmaadresse} onChange={e => setEnrichFields(p => ({ ...p, firmaadresse: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Postadresse</label>
                <Input placeholder="Postadresse" value={enrichFields.postadresse} onChange={e => setEnrichFields(p => ({ ...p, postadresse: e.target.value }))} />
              </div>
            </div>
            <Button
              className="w-full"
              disabled={!convertNavn.trim()}
              onClick={() => {
                if (convertDialogLead) {
                  konverterOgOpprettOppgave(convertDialogLead, convertNavn.trim(), enrichFields);
                  setConvertDialogLead(null);
                  setConvertNavn("");
                  setEnrichFields({ orgnr: "", bransje: "", firmaadresse: "", postadresse: "" });
                }
              }}
            >
              Kvalifiser og opprett salgsmulighet
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Convert to partner dialog */}
      <Dialog open={!!partnerDialogLead} onOpenChange={open => { if (!open) { setPartnerDialogLead(null); setEnrichFields({ orgnr: "", bransje: "", firmaadresse: "", postadresse: "" }); } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Konverter til partner</DialogTitle>
            <DialogDescription>Bekreft konvertering av {partnerDialogLead?.firmanavn} til partner.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {partnerDialogLead && (
              <SelskapInnsikt
                domene={undefined}
                firmanavn={partnerDialogLead.firmanavn}
                e_post={partnerDialogLead.e_post}
                onEnriched={(data) => {
                  setEnrichFields(prev => ({
                    orgnr: prev.orgnr || data.orgnr || "",
                    bransje: prev.bransje || data.bransje || "",
                    firmaadresse: prev.firmaadresse || data.firmaadresse || "",
                    postadresse: prev.postadresse || data.postadresse || "",
                  }));
                }}
              />
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Org.nr</label>
                <Input placeholder="Org.nr" value={enrichFields.orgnr} onChange={e => setEnrichFields(p => ({ ...p, orgnr: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Bransje</label>
                <Input placeholder="Bransje" value={enrichFields.bransje} onChange={e => setEnrichFields(p => ({ ...p, bransje: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Firmaadresse</label>
                <Input placeholder="Firmaadresse" value={enrichFields.firmaadresse} onChange={e => setEnrichFields(p => ({ ...p, firmaadresse: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Postadresse</label>
                <Input placeholder="Postadresse" value={enrichFields.postadresse} onChange={e => setEnrichFields(p => ({ ...p, postadresse: e.target.value }))} />
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                if (partnerDialogLead) {
                  konverterTilPartner(partnerDialogLead.id, enrichFields);
                  if (selectedLead?.id === partnerDialogLead.id) setSelectedLead(null);
                  setPartnerDialogLead(null);
                  setEnrichFields({ orgnr: "", bransje: "", firmaadresse: "", postadresse: "" });
                }
              }}
            >
              Konverter til partner
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Forward to partner dialog (admin only) */}
      <Dialog open={!!forwardDialogLead} onOpenChange={open => { if (!open && !forwardSending) setForwardDialogLead(null); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Videresend lead til partner</DialogTitle>
            <DialogDescription>
              Send leaden {forwardDialogLead?.firmanavn ? `«${forwardDialogLead.firmanavn}»` : ""} videre til en av partnerne. De får all kontaktinfo, generell info om leaden og status på selvbyggeren via e-post.
            </DialogDescription>
          </DialogHeader>
          {forwardStep === "edit" ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Velg partner</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                value={forwardPartnerId}
                onChange={e => setForwardPartnerId(e.target.value)}
              >
                <option value="">– Velg partner –</option>
                {partnere
                  .filter((p: Partner) => p.partnerstatus !== "Inaktiv" && p.e_post)
                  .sort((a: Partner, b: Partner) => a.partnernavn.localeCompare(b.partnernavn, "nb"))
                  .map((p: Partner) => (
                    <option key={p.id} value={p.id}>
                      {p.partnernavn} — {p.e_post}
                    </option>
                  ))}
              </select>
              {partnere.filter((p: Partner) => p.partnerstatus !== "Inaktiv" && p.e_post).length === 0 && (
                <p className="text-[11px] text-warning mt-1">Ingen aktive partnere med e-postadresse funnet.</p>
              )}
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-xs">
              <p className="font-medium text-foreground">Dette sendes til partneren:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                <li>Kontaktinfo: navn, e-post, telefon, rolle</li>
                <li>Generell lead-info: firma, kilde, use case, notater</li>
                <li>Om leaden har byggeagent via selvbyggeren</li>
                {forwardOnboarding && <li>Svar fra selvbyggeren (kort oppsummering)</li>}
              </ul>
              <label className="flex items-center gap-2 text-xs pt-1">
                <input
                  type="checkbox"
                  checked={forwardHarByggeagent}
                  onChange={e => setForwardHarByggeagent(e.target.checked)}
                />
                <span>Har bygget agent via selvbyggeren {forwardOnboarding ? "(oppdaget automatisk)" : ""}</span>
              </label>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Melding til partneren (valgfritt)</label>
              <Textarea
                placeholder="F.eks. «Tror dette passer godt for dere – ta gjerne kontakt direkte»"
                value={forwardMessage}
                onChange={e => setForwardMessage(e.target.value)}
                rows={3}
              />
            </div>

            <Button
              className="w-full"
              onClick={() => setForwardStep("confirm")}
              disabled={!forwardPartnerId}
            >
              Forhåndsvis
            </Button>
          </div>
          ) : (
          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bekreft videresending</p>
              {(() => {
                const partner = partnere.find((p: Partner) => p.id === forwardPartnerId);
                return (
                  <div className="space-y-1.5">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Partner</span>
                      <span className="font-medium text-right">{partner?.partnernavn || "–"}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Sendes til</span>
                      <span className="font-medium text-right break-all">{partner?.e_post || "–"}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Lead</span>
                      <span className="font-medium text-right">{forwardDialogLead?.firmanavn || "–"}</span>
                    </div>
                    {forwardMessage && (
                      <div className="pt-2 border-t mt-2">
                        <p className="text-xs text-muted-foreground mb-1">Intern melding</p>
                        <p className="whitespace-pre-wrap text-sm">{forwardMessage}</p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-muted-foreground">Forhåndsvisning av e-post</label>
                <span className="text-[10px] text-muted-foreground">Slik ser e-posten ut hos partneren</span>
              </div>
              <LeadForwardEmailPreview
                partner_navn={partnere.find((p: Partner) => p.id === forwardPartnerId)?.partnernavn || "Partner"}
                lead_firmanavn={forwardDialogLead?.firmanavn}
                lead_kontaktperson={forwardDialogLead?.kontaktperson}
                lead_epost={forwardDialogLead?.e_post}
                lead_telefon={forwardDialogLead?.telefon}
                lead_rolle={(forwardDialogLead as any)?.rolle}
                lead_kilde={forwardDialogLead?.kilde}
                lead_use_case={(forwardDialogLead as any)?.use_case}
                lead_notater={forwardDialogLead?.notater}
                har_byggeagent={forwardHarByggeagent}
                onboarding_oppsummering={forwardOnboarding}
                videresendt_av={user?.email || "Snakk"}
                intern_melding={forwardMessage}
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setForwardStep("edit")}
                disabled={forwardSending}
              >
                Tilbake
              </Button>
              <Button
                className="flex-1"
                onClick={sendForward}
                disabled={!forwardPartnerId || forwardSending}
              >
                <Send className="w-4 h-4 mr-1.5" />
                {forwardSending ? "Sender..." : "Send nå"}
              </Button>
            </div>
          </div>
          )}
        </DialogContent>
      </Dialog>



      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Søk leads" placeholder="Søk kontakt, bedrift, e-post eller telefon…" className="h-9 pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={visning} onValueChange={value => setVisning(value as typeof visning)}>
          <SelectTrigger aria-label="Leadliste" className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="leads">Aktive leads</SelectItem><SelectItem value="ringeliste">Ringeliste i dag</SelectItem><SelectItem value="kalde">Kalde leads ({kaldeLeads.length})</SelectItem></SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={value => setStatusFilter(value as typeof statusFilter)}>
          <SelectTrigger aria-label="Filtrer status" className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="alle">Alle statuser</SelectItem>{statusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={kildeFilter} onValueChange={value => setKildeFilter(value as typeof kildeFilter)}>
          <SelectTrigger aria-label="Filtrer kilde" className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="alle">Alle kilder</SelectItem>{KILDE_GRUPPER.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
        </Select>
        <MineTeametToggle verdi={eierFilter} onEndre={setEierFilter} />
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => navigate("/ringemodus")}><Phone className="h-4 w-4" />Ringemodus</Button>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {filterUtenOppfolging && <Button size="sm" variant="secondary" onClick={() => setFilterUtenOppfolging(false)}>Uten oppfølging ×</Button>}
        {statusParam && <Button size="sm" variant="secondary" onClick={() => clearDeepFilter("status")}>{statusParam} ×</Button>}
        {oppfolgingFilter && <Button size="sm" variant="secondary" onClick={() => clearDeepFilter("filter")}>Trenger oppfølging ×</Button>}
      </div>
      {visning === "ringeliste" ? <RingelisteIdag /> : <>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3" aria-label="Leads">
        {filtered.map(lead => {
          const kvalitet = leadKvalitet(lead);
          const onske = ekteOnske(lead.produkt_oppsummering) || ekteOnske(skjemaOnske(lead.notater));
          const neste = nesteTekst(effektivOppfolging(lead), lead.status);
          const linje2 = [bedriftVisning(lead) || "Firma ikke oppgitt", kildeGruppe(lead.kilde), komInnTekst(lead.opprettet_dato)].filter(Boolean).join(" · ");
          return (
            <li key={lead.id} className="flex min-w-0 flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20">
              <button type="button" className="flex w-full min-w-0 flex-col gap-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md" onClick={() => setSelectedLead(lead)}>
                <span className="flex w-full items-start justify-between gap-2">
                  <span className="min-w-0 truncate font-display text-base font-semibold">{lead.kontaktperson || bedriftVisning(lead) || "Kontakt ikke oppgitt"}</span>
                  <Badge variant="outline" className={`shrink-0 text-[11px] ${statusColors[lead.status] || ""}`}>{leadStatusKort[lead.status] || lead.status}</Badge>
                </span>
                <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                  <span className="truncate tabular-nums">{linje2}</span>
                  {kvalitet.firmaUklart && <span className="shrink-0 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">Firma uklart</span>}
                </span>
                {onske && <span className="line-clamp-2 text-xs text-foreground/80">Ønsker: {onske}</span>}
                {lead.pinned_notat?.trim() && <PinnedNotatBoks notat={lead.pinned_notat} />}
                {neste && <span className={`text-xs tabular-nums ${neste.haster ? "font-semibold text-warning" : "text-muted-foreground"}`}>{neste.tekst}</span>}
              </button>
              {canEdit && lead.status !== "Ikke aktuelt" && (
                <div className="mt-auto flex gap-2 pt-1">
                  {lead.telefon ? (
                    <Button asChild size="sm" className="flex-1">
                      <a href={`tel:${lead.telefon}`} onClick={() => setSelectedLead(lead)} title={kvalitet.telefonUgyldig ? "Sjekk nummeret før du ringer" : undefined}>
                        <Phone className="h-4 w-4" />Ring
                      </a>
                    </Button>
                  ) : (
                    <Button size="sm" className="flex-1" disabled><Phone className="h-4 w-4" />Ring</Button>
                  )}
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setSelectedLead(lead)}>
                    <PenLine className="h-4 w-4" />Logg utfall
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Ingen leads funnet</p>}
      </>}


      <DetailPanelShell
        presentation="dialog"
        open={!!currentLead}
        onClose={() => setSelectedLead(null)}
        activeTab={detailTab}
        onActiveTabChange={(t) => setDetailTab(t)}
        title={currentLead ? currentLead.kontaktperson || bedriftVisning(currentLead) || "Ukjent" : ""}
        subtitle={currentLead && currentLead.kontaktperson ? bedriftVisning(currentLead) || "Firma ikke oppgitt" : undefined}
        badges={currentLead ? (
          <>
            <Badge variant="outline" className={`text-xs ${statusColors[currentLead.status] || ""}`}>{currentLead.status}</Badge>
            {getConversionType(currentLead) && (
              <Badge className={`text-xs gap-0.5 ${getConversionType(currentLead) === "salg" ? "bg-success/10 text-success" : "bg-primary/10 text-primary"}`}>
                <Lock className="w-3 h-3" />
                {getConversionType(currentLead) === "salg" ? "Konvertert → Salg" : "Konvertert → Partner"}
              </Badge>
            )}
          </>
        ) : undefined}
        tabContent={currentLead ? (() => {
          const updateField = (field: string, value: any) => {
            if (currentIsLocked) return;
            const today = new Date().toISOString().split("T")[0];
            updateLeads(prev => prev.map(l =>
              l.id === currentLead.id ? { ...l, [field]: value, sist_aktivitet: today } : l
            ));
          };
          const kvalitet = leadKvalitet(currentLead);
          const neste = effektivOppfolging(currentLead);
          const kanEndre = canEdit && !currentIsLocked;
          const pinnedFelt = (
            <PinnedNotatFelt
              verdi={currentLead.pinned_notat}
              av={currentLead.pinned_notat_av}
              dato={currentLead.pinned_notat_dato}
              disabled={!kanEndre}
              onLagre={(notat, av, dato) => {
                updateLeads(prev => prev.map(l => l.id === currentLead.id
                  ? { ...l, pinned_notat: notat, pinned_notat_av: av, pinned_notat_dato: dato } : l));
              }}
            />
          );
          return {
            detaljer: (
              <div className="space-y-5">
                {kvalitet.meldinger.length > 0 && (
                  <div role="alert" className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <div className="space-y-1">{kvalitet.meldinger.map(m => <p key={m}>{m}</p>)}</div>
                  </div>
                )}

                {/* Nøkkelinfo – synlig uten scrolling */}
                <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
                  <div className="min-w-0">
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Telefon</dt>
                    <dd className="truncate tabular-nums font-medium">{currentLead.telefon ? <a href={`tel:${currentLead.telefon}`} className="hover:underline">{currentLead.telefon}</a> : "—"}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">E-post</dt>
                    <dd className="truncate font-medium">{currentLead.e_post ? <a href={`mailto:${currentLead.e_post}`} className="hover:underline" title={currentLead.e_post}>{currentLead.e_post}</a> : "—"}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Kom inn</dt>
                    <dd className="truncate tabular-nums">{[komInnTekst(currentLead.opprettet_dato), kildeGruppe(currentLead.kilde)].filter(Boolean).join(" · ")}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Neste oppfølging</dt>
                    <dd className={`truncate tabular-nums ${currentLead.status !== "Ikke aktuelt" && ["forfalt", "i-dag"].includes(oppfolgingTilstand(neste)) ? "font-semibold text-warning" : ""}`}>
                      {currentLead.status === "Ikke aktuelt" ? "Ikke i oppfølging" : ["forfalt", "i-dag"].includes(oppfolgingTilstand(neste)) ? "I dag" : kortDato(neste)}
                    </dd>
                  </div>
                </dl>

                {currentLead.pinned_notat?.trim() && <PinnedNotatBoks notat={currentLead.pinned_notat} />}

                {kanEndre && <LeadHvaSkjedde lead={currentLead} onBooketMoete={(l) => {
                  konverterOgOpprettOppgave(l, l.use_case || l.firmanavn);
                }} />}

                {/* Neste steg */}
                <div className={`rounded-lg border p-3 ${!currentLead.neste_steg ? "border-warning bg-warning/5" : "bg-muted/30"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Neste steg</label>
                    <NesteStegTaskButton nesteSteg={currentLead.neste_steg} lead_id={currentLead.id} disabled={!kanEndre} />
                  </div>
                  <Input value={currentLead.neste_steg} onChange={e => updateField("neste_steg", e.target.value)} className="h-7 text-xs mt-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" placeholder="Hva er neste steg?" readOnly={!kanEndre} />
                </div>

                {/* Redigerbare felter */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="text-xs"><span className="text-muted-foreground">Firmanavn</span>
                    <Input value={currentLead.firmanavn} onChange={e => updateField("firmanavn", e.target.value)} className={`h-8 text-xs mt-0.5 ${kvalitet.firmaUklart ? "border-warning" : ""}`} readOnly={!kanEndre} />
                  </div>
                  <div className="text-xs"><span className="text-muted-foreground">Kontaktperson</span>
                    <Input value={currentLead.kontaktperson} onChange={e => updateField("kontaktperson", e.target.value)} className="h-8 text-xs mt-0.5" readOnly={!kanEndre} />
                  </div>
                  <div className="text-xs"><span className="text-muted-foreground">Telefon</span>
                    <Input value={currentLead.telefon} onChange={e => updateField("telefon", e.target.value)} className={`h-8 text-xs mt-0.5 tabular-nums ${kvalitet.telefonUgyldig ? "border-warning" : ""}`} readOnly={!kanEndre} />
                  </div>
                  <div className="text-xs"><span className="text-muted-foreground">E-post</span>
                    <Input value={currentLead.e_post} onChange={e => updateField("e_post", e.target.value)} className="h-8 text-xs mt-0.5" readOnly={!kanEndre} />
                  </div>
                  <div className="text-xs"><span className="text-muted-foreground">Status</span>
                    <select className={`w-full border rounded-md px-2 text-xs bg-background h-8 mt-0.5 ${statusColors[currentLead.status] || ""}`}
                      value={currentLead.status} onChange={e => updateField("status", e.target.value)} disabled={!kanEndre}>
                      {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="text-xs"><span className="text-muted-foreground">Neste oppfølging</span>
                    <Input type="date" value={currentLead.neste_oppfolging || neste} onChange={e => updateField("neste_oppfolging", e.target.value)} className="h-8 text-xs mt-0.5" readOnly={!kanEndre} />
                  </div>
                  <div className="text-xs"><span className="text-muted-foreground">Kilde</span>
                    <select className="w-full border rounded-md px-2 text-xs bg-background h-8 mt-0.5" value={currentLead.kilde}
                      onChange={e => updateField("kilde", e.target.value)} disabled={!kanEndre}>
                      {kildeOptions.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                  <div className="text-xs"><span className="text-muted-foreground">Ansvarlig</span>
                    <Input value={currentLead.ansvarlig} onChange={e => updateField("ansvarlig", e.target.value)} className="h-8 text-xs mt-0.5" readOnly={!kanEndre} />
                  </div>
                  <div className="text-xs sm:col-span-2"><span className="text-muted-foreground">Use case</span>
                    <Input value={currentLead.use_case} onChange={e => updateField("use_case", e.target.value)} className="h-8 text-xs mt-0.5" readOnly={!kanEndre} />
                  </div>
                </div>

                <SelskapInnsikt domene="" firmanavn={currentLead.firmanavn} e_post={currentLead.e_post} />

                {getConversionType(currentLead) && (
                  <div className={`p-2.5 rounded-lg text-xs font-medium flex items-center gap-2 ${getConversionType(currentLead) === "salg" ? "bg-success/10 text-success" : "bg-primary/10 text-primary"}`}>
                    <Lock className="w-3.5 h-3.5" />
                    Konvertert til {getConversionType(currentLead) === "salg" ? "salgsmulighet" : "partner"} · {currentLead.konvertert_dato}
                  </div>
                )}

                {currentForwardedPartner && (
                  <div className="p-2.5 rounded-lg text-xs bg-muted/40 border flex items-start gap-2">
                    <Send className="w-3.5 h-3.5 mt-0.5 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="font-medium">Videresendt til {currentForwardedPartner.partnernavn}</div>
                      <div className="text-muted-foreground">{currentLead.videresendt_dato} · {currentForwardedPartner.e_post}</div>
                    </div>
                  </div>
                )}

                {kanEndre && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-xs">
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs text-muted-foreground" onClick={() => setPartnerDialogLead(currentLead)}>Til partner</Button>
                    {isAdmin && <Button variant="link" size="sm" className="h-auto p-0 text-xs text-muted-foreground" onClick={() => openForwardDialog(currentLead)}>Videresend</Button>}
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs text-muted-foreground" onClick={() => { setConvertDialogLead(currentLead); setConvertNavn(currentLead.use_case || currentLead.firmanavn); }}>Gjør til salgsmulighet</Button>
                    <Button variant="link" size="sm" className="ml-auto h-auto p-0 text-xs text-destructive" onClick={() => setSlettLead(currentLead)}>Slett</Button>
                  </div>
                )}
              </div>
            ),
            interaksjoner: (
              <>
                <InlineTaskForm lead_id={currentLead.id} selskap_id="" />
                <ActivityLog lead_id={currentLead.id} onOpenCreateRef={openCreateActivityRef} onActivityLogged={(result) => {
                  updateLeads(prev => prev.map(l => l.id === currentLead.id ? applyLeadActivityResult(l, result) : l));
                }} />
                <EntityChangelog entity_type="lead" entity_id={currentLead.id} />
              </>
            ),
            notater: (
              <div className="space-y-4">
                {pinnedFelt}
                <DetailField label="Notater">
                  <Textarea value={currentLead.notater} onChange={e => updateField("notater", e.target.value)} rows={6} readOnly={!kanEndre} />
                </DetailField>
              </div>
            ),
            kalender: (
              <EntityCalendarTab lead_id={currentLead.id} />
            ),
          };
        })() : undefined}
      />
      <AlertDialog open={!!slettLead} onOpenChange={o => { if (!o) setSlettLead(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slette leadet?</AlertDialogTitle>
            <AlertDialogDescription>
              {slettLead?.kontaktperson || slettLead?.firmanavn} flyttes til papirkurven og kan gjenopprettes i 30 dager.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => {
              if (!slettLead) return;
              const id = slettLead.id;
              updateLeads(prev => prev.filter(l => l.id !== id));
              setSlettLead(null);
              setSelectedLead(null);
              toast("Lead flyttet til papirkurven");
            }}>Slett</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {currentLead && (
        <SendEmailDialog
          open={emailDialogOpen}
          onOpenChange={setEmailDialogOpen}
          defaultTo={currentLead.e_post}
          defaultSubject={`Oppfølging – ${currentLead.firmanavn}`}
          context={{
            entityType: "lead",
            entityId: currentLead.id,
            selskapNavn: currentLead.firmanavn,
            kontaktperson: currentLead.kontaktperson,
            nesteSteg: currentLead.neste_steg,
            useCase: currentLead.use_case,
            status: currentLead.status,
          }}
          onSent={() => {
            const today = new Date().toISOString().split("T")[0];
            updateLeads(prev => prev.map(l => l.id === currentLead.id ? { ...l, sist_aktivitet: today } : l));
          }}
        />
      )}
    </PageShell>
  );
}
