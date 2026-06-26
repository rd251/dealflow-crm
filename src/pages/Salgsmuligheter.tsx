import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/use-auth";
import { nok } from "@/lib/utils";
import { useProfiles } from "@/hooks/use-profiles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import DetailPanelShell, { DetailSection, DetailField, DetailDivider, DetailStatGrid, DetailStatCard } from "@/components/DetailPanelShell";
import EntityCalendarTab from "@/components/EntityCalendarTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, GripVertical, Trophy, XCircle, Trash2, Phone, User, AlertTriangle, Clock, Building2, DollarSign, Mail, FileSignature, PartyPopper, Globe, ExternalLink, Linkedin, PenLine, NotebookPen, Send } from "lucide-react";
import SendEmailDialog from "@/components/SendEmailDialog";
import SelskapInnsikt from "@/components/SelskapInnsikt";
import CompanyLogo from "@/components/CompanyLogo";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { gravatarUrl } from "@/lib/gravatar";
import EntityLinkPicker from "@/components/EntityLinkPicker";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Sparkles, ArrowRight, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Salgsmulighet, SalgsmulighetStatus, Tapsaarsak, KontraktStatus, beregnTotalKontraktsverdi, beregnVektetPipeline, PAKKER } from "@/data/crm-data";
import InlineTaskForm from "@/components/InlineTaskForm";
import ActivityLog from "@/components/ActivityLog";
import EntityChangelog from "@/components/EntityChangelog";
import MeetingNotesList from "@/components/MeetingNotesList";
import SendContractModal from "@/components/SendContractModal";
import DealRecapCard from "@/components/DealRecapCard";
import LastMeetingCard from "@/components/LastMeetingCard";
import { useLastMeetingsByDeal } from "@/hooks/use-last-meetings";

const allStatuses: SalgsmulighetStatus[] = ["Møte booket", "Behov avklart", "Løsning presentert", "Kontrakt sendt"];
const openStatuses = allStatuses;
const tapsaarsaker: Tapsaarsak[] = ["Pris", "Ikke riktig timing", "Valgte annen leverandør", "Ikke behov", "Teknisk / integrasjon", "Annet"];

const kontraktStatusColors: Record<KontraktStatus, string> = {
  "Ikke sendt": "bg-muted text-muted-foreground",
  "Sendt": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "Åpnet": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  "Signert": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "Utløpt": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function MobileSwipeCard({ deal, stage, onMove, onClick, signal, missingNeste, isBlocked, children }: {
  deal: Salgsmulighet; stage: SalgsmulighetStatus; onMove: (dealId: string, newStage: SalgsmulighetStatus) => void;
  onClick: () => void; signal: { color: string; label: string }; missingNeste: boolean; isBlocked: boolean; children: React.ReactNode;
}) {
  const startX = useRef(0);
  const currentX = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const [swiping, setSwiping] = useState(false);
  const [swipeDir, setSwipeDir] = useState<"left" | "right" | null>(null);

  const stageIdx = allStatuses.indexOf(stage);
  const canLeft = stageIdx < allStatuses.length - 1;
  const canRight = stageIdx > 0;
  const nextStage = canLeft ? allStatuses[stageIdx + 1] : null;
  const prevStage = canRight ? allStatuses[stageIdx - 1] : null;

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    currentX.current = 0;
    setSwiping(true);
    setSwipeDir(null);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping) return;
    const diff = e.touches[0].clientX - startX.current;
    currentX.current = diff;
    if (cardRef.current) {
      const clamped = Math.max(-100, Math.min(100, diff));
      cardRef.current.style.transform = `translateX(${clamped}px)`;
      cardRef.current.style.opacity = `${1 - Math.abs(clamped) / 200}`;
    }
    if (Math.abs(diff) > 20) setSwipeDir(diff > 0 ? "right" : "left");
    else setSwipeDir(null);
  }, [swiping]);

  const onTouchEnd = useCallback(() => {
    setSwiping(false);
    if (cardRef.current) {
      cardRef.current.style.transform = "";
      cardRef.current.style.opacity = "";
    }
    const diff = currentX.current;
    if (Math.abs(diff) >= 70) {
      if (diff < 0 && canLeft && nextStage && !missingNeste) {
        onMove(deal.id, nextStage);
      } else if (diff > 0 && canRight && prevStage && !missingNeste) {
        onMove(deal.id, prevStage);
      }
    }
    setSwipeDir(null);
  }, [deal.id, canLeft, canRight, nextStage, prevStage, missingNeste, onMove]);

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Swipe hint labels */}
      {swiping && swipeDir === "right" && prevStage && (
        <div className="absolute inset-y-0 left-0 w-16 flex items-center justify-center bg-primary/10 rounded-l-lg z-0">
          <span className="text-[9px] font-medium text-primary writing-vertical">← {prevStage}</span>
        </div>
      )}
      {swiping && swipeDir === "left" && nextStage && (
        <div className="absolute inset-y-0 right-0 w-16 flex items-center justify-center bg-primary/10 rounded-r-lg z-0">
          <span className="text-[9px] font-medium text-primary">→ {nextStage}</span>
        </div>
      )}
      <div ref={cardRef}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onClick={onClick}
        className={`relative z-10 bg-card border rounded-lg p-2.5 active:bg-muted/50 transition-[opacity] duration-100 ${isBlocked ? "ring-2 ring-destructive animate-pulse" : ""}`}
        style={{ touchAction: "pan-y" }}>
        {children}
      </div>
    </div>
  );
}

const statusColors: Record<SalgsmulighetStatus, string> = {
  "Møte booket": "bg-stage-contacted",
  "Behov avklart": "bg-stage-qualified",
  "Løsning presentert": "bg-stage-demo",
  "Kontrakt sendt": "bg-stage-proposal",
  "Vunnet": "bg-stage-won",
  "Tapt": "bg-stage-lost",
};

// Activity signal: days since last activity
function activitySignal(sist_aktivitet: string): { color: string; border: string; label: string } {
  if (!sist_aktivitet) return { color: "bg-destructive", border: "border-l-destructive", label: ">3 dager" };
  const days = Math.floor((Date.now() - new Date(sist_aktivitet).getTime()) / (1000 * 60 * 60 * 24));
  if (days > 3) return { color: "bg-destructive", border: "border-l-destructive", label: `${days}d` };
  if (days >= 1) return { color: "bg-warning", border: "border-l-warning", label: `${days}d` };
  return { color: "bg-success", border: "border-l-success", label: "i dag" };
}

// Sort deals: least recent activity first, then highest value
function sortDeals(deals: Salgsmulighet[]): Salgsmulighet[] {
  return [...deals].sort((a, b) => {
    // Primary: least recent activity first (oldest first)
    const dateA = a.sist_aktivitet ? new Date(a.sist_aktivitet).getTime() : 0;
    const dateB = b.sist_aktivitet ? new Date(b.sist_aktivitet).getTime() : 0;
    if (dateA !== dateB) return dateA - dateB;
    // Secondary: highest value first
    return b.forventet_mrr - a.forventet_mrr;
  });
}

export default function Salgsmuligheter() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const { canEdit, isAdmin, user } = useAuth();
  const { profiles } = useProfiles();
  const { salgsmuligheter, selskaper, kontakter, partnere, updateSalgsmuligheter, updateSelskaper, updateKontakter, vinnSalgsmulighet, tapSalgsmulighet, generateId } = useCrmStore();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [selectedSm, setSelectedSm] = useState<Salgsmulighet | null>(null);
  const [lossDialog, setLossDialog] = useState<string | null>(null);
  const [winDialog, setWinDialog] = useState<string | null>(null);
  const [winPartnerId, setWinPartnerId] = useState<string>("");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [lossReason, setLossReason] = useState<Tapsaarsak>("Pris");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [moveBlockedId, setMoveBlockedId] = useState<string | null>(null);
  const [form, setForm] = useState({ selskap_id: "", kontakt_id: "", forventet_mrr: 0, sla: 0, oppstartskostnad: 0, kontraktslengde_mnd: 12, sannsynlighet: 50, forventet_lukkedato: "", neste_steg: "", rolle_i_firma: "", use_case: "", kontaktperson: "", e_post: "", telefon: "", ansvarlig: "", kilde: "Nettside" as string });
  const [filterUtenAktivitet, setFilterUtenAktivitet] = useState(false);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [pipelineView, setPipelineView] = useState<"kanban" | "table">(() => (localStorage.getItem("pipelineView") as "kanban" | "table") || "kanban");
  useEffect(() => { localStorage.setItem("pipelineView", pipelineView); }, [pipelineView]);

  // Forward to partner
  const [forwardDialogSm, setForwardDialogSm] = useState<Salgsmulighet | null>(null);
  const [forwardPartnerId, setForwardPartnerId] = useState<string>("");
  const [forwardMessage, setForwardMessage] = useState<string>("");
  const [forwardSending, setForwardSending] = useState<boolean>(false);

  const openForwardDialog = (sm: Salgsmulighet) => {
    setForwardDialogSm(sm);
    setForwardPartnerId("");
    setForwardMessage("");
  };

  const sendForward = async () => {
    if (!forwardDialogSm || !forwardPartnerId) return;
    const partner = partnere.find(p => p.id === forwardPartnerId);
    if (!partner) { toast.error("Fant ikke valgt partner"); return; }
    if (!partner.e_post) { toast.error("Partneren mangler e-postadresse"); return; }
    setForwardSending(true);
    const sm = forwardDialogSm;
    const today = new Date().toISOString().split("T")[0];
    const selskap = selskaper.find(s => s.id === sm.selskap_id);
    try {
      const { error: emailErr } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "deal-forwarded-to-partner",
          recipientEmail: partner.e_post,
          idempotencyKey: `deal-forward-${sm.id}-${partner.id}-${today}`,
          templateData: {
            partner_navn: partner.partnernavn,
            deal_navn: sm.navn,
            selskap_firmanavn: selskap?.firmanavn || "",
            kontaktperson: sm.kontaktperson,
            kontakt_epost: sm.e_post,
            kontakt_telefon: sm.telefon,
            kontakt_rolle: sm.rolle_i_firma,
            status: sm.status,
            kilde: sm.kilde,
            use_case: sm.use_case,
            notater: sm.notater,
            forventet_mrr: sm.forventet_mrr,
            oppstartskostnad: sm.oppstartskostnad,
            kontraktslengde_mnd: sm.kontraktslengde_mnd,
            forventet_lukkedato: sm.forventet_lukkedato,
            neste_steg: sm.neste_steg,
            videresendt_av: user?.email || "Snakk",
            intern_melding: forwardMessage,
          },
        },
      });
      if (emailErr) throw emailErr;

      updateSalgsmuligheter(prev => prev.map(s => s.id === sm.id
        ? { ...s, videresendt_til_partner_id: partner.id, videresendt_dato: today, sist_aktivitet: today }
        : s));

      try {
        await supabase.from("aktiviteter").insert({
          type: "E-post",
          tittel: `Videresendt til partner: ${partner.partnernavn}`,
          beskrivelse: `Salgsmulighet videresendt til ${partner.partnernavn} (${partner.e_post}).${forwardMessage ? `\n\nMelding: ${forwardMessage}` : ""}`,
          dato: new Date().toISOString(),
          salgsmulighet_id: sm.id,
          selskap_id: sm.selskap_id || null,
          partner_id: partner.id,
          aktivitet_kilde: "manuell",
        });
      } catch (logErr) {
        console.warn("Activity log failed", logErr);
      }

      toast.success(`Salgsmulighet videresendt til ${partner.partnernavn}`);
      setForwardDialogSm(null);
    } catch (err: any) {
      console.error("Forward failed", err);
      toast.error(`Kunne ikke videresende: ${err?.message || "ukjent feil"}`);
    } finally {
      setForwardSending(false);
    }
  };

  useEffect(() => {
    const openId = searchParams.get("open");
    if (openId && salgsmuligheter.length > 0) {
      const found = salgsmuligheter.find(s => s.id === openId);
      if (found) {
        setSelectedSm(found);
        setSearchParams({}, { replace: true });
      }
    }
    if (searchParams.get("filter") === "uten-aktivitet") {
      setFilterUtenAktivitet(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, salgsmuligheter]);

  const getSelskapNavn = (id: string) => selskaper.find(s => s.id === id)?.firmanavn || "–";
  const getSelskapDomain = (id: string | null) => id ? selskaper.find(s => s.id === id)?.domene || "" : "";
  const getProfileName = (id: string) => profiles.find(p => p.user_id === id)?.display_name || "";
  const handleDrop = (e: React.DragEvent, stage: SalgsmulighetStatus) => {
    e.preventDefault();
    setDragOverStage(null);
    if (!draggedId) return;

    // Block move if neste_steg is empty (for open stages)
    if (stage !== "Vunnet" && stage !== "Tapt") {
      const deal = salgsmuligheter.find(s => s.id === draggedId);
      if (deal && !deal.neste_steg?.trim()) {
        setMoveBlockedId(draggedId);
        setTimeout(() => setMoveBlockedId(null), 2500);
        setDraggedId(null);
        return;
      }
    }

    if (stage === "Vunnet") { setWinPartnerId(""); setWinDialog(draggedId); }
    else if (stage === "Tapt") { setLossDialog(draggedId); }
    else {
      updateSalgsmuligheter(prev => prev.map(s =>
        s.id === draggedId ? { ...s, status: stage, sist_aktivitet: new Date().toISOString().split("T")[0] } : s
      ));
    }
    setDraggedId(null);
  };

  const moveDealToStage = useCallback((dealId: string, newStage: SalgsmulighetStatus) => {
    updateSalgsmuligheter(prev => prev.map(s =>
      s.id === dealId ? { ...s, status: newStage, sist_aktivitet: new Date().toISOString().split("T")[0] } : s
    ));
  }, [updateSalgsmuligheter]);

  const addSm = () => {
    const today = new Date().toISOString().split("T")[0];
    const id = generateId("SM", salgsmuligheter);
    const nySm: Salgsmulighet = {
      id, navn: form.use_case, selskap_id: form.selskap_id, kontakt_id: form.kontakt_id,
      ansvarlig: form.ansvarlig || user?.id || "", status: "Møte booket", forventet_mrr: form.forventet_mrr, sla: form.sla,
      oppstartskostnad: form.oppstartskostnad, kontraktslengde_mnd: form.kontraktslengde_mnd,
      sannsynlighet: form.sannsynlighet, forventet_lukkedato: form.forventet_lukkedato,
      vunnet_dato: "", tapt_dato: "", tapsaarsak: "", neste_steg: form.neste_steg, notater: "",
      opprettet_dato: today, sist_aktivitet: today,
      kilde: form.kilde as any, partner_id: "", partner_provisjon: 0, partner_kostnad: 0, netto_inntekt: 0,
      rolle_i_firma: form.rolle_i_firma, use_case: form.use_case,
      kontaktperson: form.kontaktperson, e_post: form.e_post, telefon: form.telefon,
      kontrakt_status: "Ikke sendt", kontrakt_signert_dato: "", dealbuilder_dokument_id: "", valgt_pakke: "",
    };
    updateSalgsmuligheter(prev => [...prev, nySm]);
    setDialogOpen(false);
    setForm({ selskap_id: "", kontakt_id: "", forventet_mrr: 0, sla: 0, oppstartskostnad: 0, kontraktslengde_mnd: 12, sannsynlighet: 50, forventet_lukkedato: "", neste_steg: "", rolle_i_firma: "", use_case: "", kontaktperson: "", e_post: "", telefon: "", ansvarlig: "", kilde: "Nettside" });
  };

  const now = new Date();
  const thisMonth = (d: string) => { const dt = new Date(d); return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear(); };

  const openDeals = salgsmuligheter.filter(s => {
    if (!openStatuses.includes(s.status)) return false;
    if (filterUtenAktivitet) {
      const cutoff = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      if (s.sist_aktivitet && new Date(s.sist_aktivitet) >= cutoff) return false;
    }
    return true;
  });
  const wonThisMonth = salgsmuligheter.filter(s => s.status === "Vunnet" && thisMonth(s.vunnet_dato));
  const lostThisMonth = salgsmuligheter.filter(s => s.status === "Tapt" && thisMonth(s.tapt_dato));
  const allClosed = salgsmuligheter.filter(s => s.status === "Vunnet" || s.status === "Tapt");

  // Signerte kontrakter (nylig signert)
  const signedDeals = salgsmuligheter.filter(s => s.kontrakt_status === "Signert");

  // Venter på signering: kontrakt sendt/åpnet men ikke signert, og deal er fortsatt åpen
  const awaitingSignature = salgsmuligheter.filter(s =>
    openStatuses.includes(s.status) &&
    (s.kontrakt_status === "Sendt" || s.kontrakt_status === "Åpnet")
  );

  // Forfalt: deals med forventet lukkedato som har passert
  const overdueDeals = salgsmuligheter.filter(s =>
    openStatuses.includes(s.status) &&
    s.forventet_lukkedato &&
    new Date(s.forventet_lukkedato) < now
  );

  // Inaktive: ingen aktivitet siste 7 dager
  const inactiveDeals = salgsmuligheter.filter(s => {
    if (!openStatuses.includes(s.status)) return false;
    if (!s.sist_aktivitet) return true;
    const days = Math.floor((now.getTime() - new Date(s.sist_aktivitet).getTime()) / (1000 * 60 * 60 * 24));
    return days > 7;
  });

  const currentSm = selectedSm ? salgsmuligheter.find(s => s.id === selectedSm.id) || selectedSm : null;
  const openDealIds = openDeals.map(d => d.id);
  const { byId: lastMeetings } = useLastMeetingsByDeal(openDealIds);
  const openCreateActivityRef = useRef<(() => void) | null>(null);
  const [detailTab, setDetailTab] = useState<"detaljer" | "selskap" | "kontakt" | "interaksjoner" | "notater" | "kalender" | "dokumenter">("detaljer");
  const [pendingOpenActivity, setPendingOpenActivity] = useState(false);

  useEffect(() => {
    if (pendingOpenActivity && detailTab === "interaksjoner") {
      const t = setTimeout(() => {
        openCreateActivityRef.current?.();
        setPendingOpenActivity(false);
      }, 50);
      return () => clearTimeout(t);
    }
  }, [pendingOpenActivity, detailTab]);

  useEffect(() => { setDetailTab("detaljer"); }, [selectedSm?.id]);

  

  return (
    <PageShell
      title="Salgsmuligheter"
      subtitle={`${openDeals.length} åpne · ${nok(openDeals.reduce((s, d) => s + d.forventet_mrr, 0))} MRR i pipeline`}
      actions={canEdit ? (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />{!isMobile && "Ny mulighet"}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader><DialogTitle>Ny salgsmulighet</DialogTitle><DialogDescription>Fyll inn detaljer for den nye salgsmuligheten.</DialogDescription></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Use case / Navn på deal *" value={form.use_case} onChange={e => setForm(f => ({ ...f, use_case: e.target.value }))} />
              <select className="w-full border rounded-lg px-3 py-2 text-sm bg-background" value={form.selskap_id} onChange={e => setForm(f => ({ ...f, selskap_id: e.target.value }))}>
                <option value="">Velg selskap</option>
                {selskaper.map(s => <option key={s.id} value={s.id}>{s.firmanavn}</option>)}
              </select>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Input type="number" placeholder="Forventet MRR" value={form.forventet_mrr || ""} onChange={e => setForm(f => ({ ...f, forventet_mrr: Number(e.target.value) }))} />
                <Input type="number" placeholder="SLA" value={form.sla || ""} onChange={e => setForm(f => ({ ...f, sla: Number(e.target.value) }))} />
                <Input type="number" placeholder="Oppstartskostnad" value={form.oppstartskostnad || ""} onChange={e => setForm(f => ({ ...f, oppstartskostnad: Number(e.target.value) }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input type="number" placeholder="Kontraktslengde (mnd)" value={form.kontraktslengde_mnd || ""} onChange={e => setForm(f => ({ ...f, kontraktslengde_mnd: Number(e.target.value) }))} />
                <Input type="number" placeholder="Sannsynlighet %" value={form.sannsynlighet || ""} onChange={e => setForm(f => ({ ...f, sannsynlighet: Number(e.target.value) }))} />
              </div>
              <Input type="date" placeholder="Forventet lukkedato" value={form.forventet_lukkedato} onChange={e => setForm(f => ({ ...f, forventet_lukkedato: e.target.value }))} />
              <Input placeholder="Neste steg *" value={form.neste_steg} onChange={e => setForm(f => ({ ...f, neste_steg: e.target.value }))} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input placeholder="Kontaktperson" value={form.kontaktperson} onChange={e => setForm(f => ({ ...f, kontaktperson: e.target.value }))} />
                <Input placeholder="E-post" value={form.e_post} onChange={e => setForm(f => ({ ...f, e_post: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input placeholder="Telefon" value={form.telefon} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} />
                <Input placeholder="Rolle i firma" value={form.rolle_i_firma} onChange={e => setForm(f => ({ ...f, rolle_i_firma: e.target.value }))} />
              </div>

              <select className="w-full border rounded-lg px-3 py-2 text-sm bg-background" value={form.kilde} onChange={e => setForm(f => ({ ...f, kilde: e.target.value }))}>
                {["Nettside","LinkedIn","Partner","Referanse","Kald outbound","E-post","Telefon","Annet","Organisk","Facebook ads","Instantly kald e-post","Google ads"].map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
              
              <select className="w-full border rounded-lg px-3 py-2 text-sm bg-background" value={form.ansvarlig} onChange={e => setForm(f => ({ ...f, ansvarlig: e.target.value }))}>
                <option value="">Velg ansvarlig</option>
                {profiles.map(p => (
                  <option key={p.user_id} value={p.user_id}>
                    {p.display_name}{p.user_id === user?.id ? " (deg)" : ""}
                  </option>
                ))}
              </select>
              <Button onClick={addSm} className="w-full" disabled={!form.use_case || !form.neste_steg}>Opprett</Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : undefined}
    >
      {/* Loss reason dialog */}
      <Dialog open={!!lossDialog} onOpenChange={open => !open && setLossDialog(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader><DialogTitle>Tapsårsak</DialogTitle><DialogDescription>Velg årsaken til at denne dealen ble tapt.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <select className="w-full border rounded-lg px-3 py-2 text-sm bg-background" value={lossReason} onChange={e => setLossReason(e.target.value as Tapsaarsak)}>
              {tapsaarsaker.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <Button className="w-full" onClick={() => { if (lossDialog) { tapSalgsmulighet(lossDialog, lossReason); setLossDialog(null); } }}>Bekreft tap</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Win dialog – velg evt. partner for kundeforholdet */}
      <Dialog open={!!winDialog} onOpenChange={open => !open && setWinDialog(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>🏆 Marker som vunnet</DialogTitle>
            <DialogDescription>
              Selskapet blir kunde (Pilot) og et prosjekt opprettes. Hvis dette er en partner-deal, velg partneren – kunden vil da være registrert som «kunde hos» den partneren.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Partner (valgfritt)</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                value={winPartnerId}
                onChange={e => setWinPartnerId(e.target.value)}
              >
                <option value="">Ingen partner – direkte kunde</option>
                {partnere
                  .filter(p => p.partnerstatus !== "Inaktiv")
                  .sort((a, b) => a.partnernavn.localeCompare(b.partnernavn, "nb"))
                  .map(p => (
                    <option key={p.id} value={p.id}>{p.partnernavn}</option>
                  ))}
              </select>
            </div>
            <Button
              className="w-full bg-success hover:bg-success/90 text-success-foreground"
              onClick={() => {
                if (winDialog) {
                  vinnSalgsmulighet(winDialog, winPartnerId || null);
                  setWinDialog(null);
                  setWinPartnerId("");
                }
              }}
            >
              <Trophy className="w-4 h-4 mr-2" /> Bekreft vunnet
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Forward to partner dialog (admin only) */}
      <Dialog open={!!forwardDialogSm} onOpenChange={open => { if (!open && !forwardSending) setForwardDialogSm(null); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Videresend salgsmulighet til partner</DialogTitle>
            <DialogDescription>
              Send dealen {forwardDialogSm?.navn ? `«${forwardDialogSm.navn}»` : ""} videre til en av partnerne. De får all kontaktinfo, deal-detaljer (forventet MRR, status, neste steg) og bakgrunn via e-post.
            </DialogDescription>
          </DialogHeader>
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
                  .filter(p => p.partnerstatus !== "Inaktiv" && p.e_post)
                  .sort((a, b) => a.partnernavn.localeCompare(b.partnernavn, "nb"))
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      {p.partnernavn} — {p.e_post}
                    </option>
                  ))}
              </select>
              {partnere.filter(p => p.partnerstatus !== "Inaktiv" && p.e_post).length === 0 && (
                <p className="text-[11px] text-warning mt-1">Ingen aktive partnere med e-postadresse funnet.</p>
              )}
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-xs">
              <p className="font-medium text-foreground">Dette sendes til partneren:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                <li>Firma + kontaktinfo (navn, e-post, telefon, rolle)</li>
                <li>Deal-detaljer: status, forventet MRR, oppstart, kontraktslengde, lukkedato</li>
                <li>Bakgrunn: kilde, use case, neste steg, notater</li>
                {forwardDialogSm?.videresendt_til_partner_id && (
                  <li className="text-warning">⚠ Allerede videresendt {forwardDialogSm.videresendt_dato || "tidligere"} – sender på nytt</li>
                )}
              </ul>
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
              onClick={sendForward}
              disabled={!forwardPartnerId || forwardSending}
            >
              <Send className="w-4 h-4 mr-1.5" />
              {forwardSending ? "Sender..." : "Send til partner"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="pipeline">
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="pipeline" className="text-xs sm:text-sm">Pipeline</TabsTrigger>
          <TabsTrigger value="awaiting" className="text-xs sm:text-sm">Venter på signering ({awaitingSignature.length})</TabsTrigger>
          <TabsTrigger value="signed" className="text-xs sm:text-sm">Signerte ({signedDeals.length})</TabsTrigger>
          <TabsTrigger value="overdue" className="text-xs sm:text-sm">Forfalt ({overdueDeals.length})</TabsTrigger>
          <TabsTrigger value="inactive" className="text-xs sm:text-sm">Inaktive ({inactiveDeals.length})</TabsTrigger>
          <TabsTrigger value="won" className="text-xs sm:text-sm">Vunnet ({wonThisMonth.length})</TabsTrigger>
          <TabsTrigger value="lost" className="text-xs sm:text-sm">Tapt ({lostThisMonth.length})</TabsTrigger>
          <TabsTrigger value="all" className="text-xs sm:text-sm">Avsluttede</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline">
          {filterUtenAktivitet && (
            <div className="mb-3">
              <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-destructive/10" onClick={() => setFilterUtenAktivitet(false)}>
                Uten aktivitet ✕
              </Badge>
            </div>
          )}
          {/* Pipeline summary panel */}
          {(() => {
            const totalPipeline = openDeals.reduce((s, d) => s + beregnTotalKontraktsverdi(d), 0);
            const totalVektet = openDeals.reduce((s, d) => s + beregnVektetPipeline(d), 0);
            const nearClosing = openDeals.filter(d => d.status === "Kontrakt sendt");
            const nearClosingValue = nearClosing.reduce((s, d) => s + beregnTotalKontraktsverdi(d), 0);
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="bg-card border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground font-medium">Total pipeline</p>
                  <p className="text-lg font-bold tracking-tight">{nok(totalPipeline)}</p>
                  <p className="text-[11px] text-muted-foreground">{openDeals.length} åpne deals</p>
                </div>
                <div className="bg-card border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground font-medium">Vektet verdi</p>
                  <p className="text-lg font-bold tracking-tight">{nok(totalVektet)}</p>
                  <p className="text-[11px] text-muted-foreground">justert for sannsynlighet</p>
                </div>
                <div className="bg-card border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground font-medium">Nær closing</p>
                  <p className="text-lg font-bold tracking-tight">{nearClosing.length} deals</p>
                  <p className="text-[11px] text-muted-foreground">{nok(nearClosingValue)} i verdi</p>
                </div>
                <div className="bg-card border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground font-medium">Snitt MRR</p>
                  <p className="text-lg font-bold tracking-tight">{nok(openDeals.length ? Math.round(openDeals.reduce((s, d) => s + d.forventet_mrr, 0) / openDeals.length) : 0)}</p>
                  <p className="text-[11px] text-muted-foreground">per deal</p>
                </div>
              </div>
            );
          })()}
          <div className="flex items-center justify-end mb-3">
            <div className="inline-flex rounded-md border bg-card p-0.5">
              <button type="button" onClick={() => setPipelineView("kanban")} className={`px-3 py-1 text-xs font-medium rounded ${pipelineView === "kanban" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>Kanban</button>
              <button type="button" onClick={() => setPipelineView("table")} className={`px-3 py-1 text-xs font-medium rounded ${pipelineView === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>Tabell</button>
            </div>
          </div>
          {pipelineView === "table" ? (
            <DealList deals={sortDeals(openDeals)} getSelskapNavn={getSelskapNavn} getSelskapDomain={getSelskapDomain} onSelect={setSelectedSm} label="Åpne salgsmuligheter" onNavigateSelskap={id => navigate(`/selskaper/${id}`)} isMobile={isMobile} showKontraktStatus showLukkedato showSignalAndNextStep />
          ) : (
          <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 scrollbar-thin items-start">
            {openStatuses.map(stage => {
              const stageDeals = sortDeals(openDeals.filter(d => d.status === stage));
              const stageMrr = stageDeals.reduce((s, d) => s + d.forventet_mrr, 0);
              return (
                <div key={stage} className={`${isMobile ? "min-w-[260px] w-[260px]" : "min-w-[290px] w-[290px]"} flex-shrink-0 flex flex-col rounded-xl p-2 -m-2 transition-colors ${dragOverStage === stage ? "bg-primary/10 ring-2 ring-primary/30" : ""}`}
                  onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverStage(stage); }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverStage(null); }}
                  onDragEnd={() => { setDragOverStage(null); setDraggedId(null); }}
                  onDrop={e => handleDrop(e, stage)}>
                  <div className="mb-2 flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${statusColors[stage]}`} />
                    <h3 className="font-semibold text-xs sm:text-sm">{stage}</h3>
                    <span className="text-xs text-muted-foreground ml-auto">{stageDeals.length}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-3 font-mono">{nok(stageMrr)} MRR</p>
                  <div className="space-y-2 max-h-[calc(75vh-80px)] overflow-y-auto pr-1 scrollbar-thin">
                    {stageDeals.map(deal => {
                      const signal = activitySignal(deal.sist_aktivitet);
                      const missingNeste = !deal.neste_steg?.trim();
                      const isBlocked = moveBlockedId === deal.id;
                      return isMobile ? (
                        /* ── Compact mobile card with swipe ── */
                        <MobileSwipeCard key={deal.id} deal={deal} stage={stage} onMove={moveDealToStage}
                          onClick={() => setSelectedSm(deal)} signal={signal} missingNeste={missingNeste} isBlocked={isBlocked}>
                          <div className="flex items-center gap-2">
                            <CompanyLogo domain={getSelskapDomain(deal.selskap_id)} firmanavn={getSelskapNavn(deal.selskap_id || "")} kontaktEmails={deal.e_post ? [deal.e_post] : undefined} size="sm" className="w-6 h-6 rounded shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-foreground truncate">{getSelskapNavn(deal.selskap_id || "")}</p>
                              {deal.kontaktperson && <p className="text-[10px] text-muted-foreground truncate">{deal.kontaktperson}</p>}
                            </div>
                            <span className="text-xs font-medium text-foreground shrink-0">{nok(deal.forventet_mrr)}{deal.valgt_pakke ? ` · ${deal.valgt_pakke}` : ""}</span>
                            {deal.kontrakt_status && deal.kontrakt_status !== "Ikke sendt" && (
                              <Badge className={`text-[8px] px-1 py-0 h-3.5 shrink-0 ${kontraktStatusColors[deal.kontrakt_status as KontraktStatus]}`}>
                                {deal.kontrakt_status === "Signert" ? "✅" : deal.kontrakt_status.charAt(0)}
                              </Badge>
                            )}
                            <div className={`w-2 h-2 rounded-full shrink-0 ${signal.color}`} title={signal.label} />
                          </div>
                          {missingNeste && (
                            <div className="flex items-center gap-1 mt-1 text-destructive">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              <span className="text-[9px] font-medium">Neste steg mangler</span>
                            </div>
                          )}
                          {isBlocked && <p className="text-[9px] text-destructive mt-0.5 font-medium">⛔ Fyll inn neste steg</p>}
                        </MobileSwipeCard>
                      ) : (
                        /* ── Full desktop card ── */
                        <HoverCard key={deal.id} openDelay={350} closeDelay={100}>
                          <HoverCardTrigger asChild>
                          {(() => {
                            const signal = ((deal as any).ai_recap?.kundesignal || "").toLowerCase();
                            const signalBorderClass = signal === "høy" || signal === "hoy"
                              ? "border-l-4 border-l-success"
                              : signal === "medium"
                              ? "border-l-4 border-l-warning"
                              : signal === "lav"
                              ? "border-l-4 border-l-destructive"
                              : "";
                            return (
                          <div draggable onDragStart={e => { setDraggedId(deal.id); e.dataTransfer.effectAllowed = "move"; }}
                          onClick={() => setSelectedSm(deal)}
                          className={`bg-card border rounded-xl p-3.5 cursor-grab active:cursor-grabbing hover:shadow-md transition-all group ${signalBorderClass} ${isBlocked ? "ring-2 ring-destructive animate-pulse" : ""}`}>
                          
                          {/* 1. Company with logo */}
                          <div className="flex items-center gap-2 mb-2.5">
                            <CompanyLogo domain={getSelskapDomain(deal.selskap_id)} firmanavn={getSelskapNavn(deal.selskap_id || "")} kontaktEmails={deal.e_post ? [deal.e_post] : undefined} size="sm" className="w-7 h-7 rounded-lg" />
                            <span className="text-sm font-semibold text-foreground truncate flex-1 cursor-pointer hover:text-primary hover:underline" onClick={e => { e.stopPropagation(); if (deal.selskap_id) navigate(`/selskaper/${deal.selskap_id}`); }}>
                              {getSelskapNavn(deal.selskap_id || "")}
                            </span>
                            {(deal as any).ai_recap && (
                              <Sparkles className="w-3 h-3 text-primary/70 shrink-0" />
                            )}
                            {(() => {
                              const lm = lastMeetings[deal.id];
                              if (!lm) return null;
                              const days = Math.floor((Date.now() - new Date(lm.dato).getTime()) / 86400000);
                              return (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 gap-0.5 bg-warning/10 text-warning border-warning/30 shrink-0" title={lm.ai_sammendrag || lm.tittel || "Siste møte"}>
                                  <NotebookPen className="w-2.5 h-2.5" />
                                  {days === 0 ? "i dag" : `${days}d`}
                                </Badge>
                              );
                            })()}
                            <GripVertical className="w-4 h-4 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </div>

                          {/* Details */}
                          <div className="space-y-1.5 pl-[2px]">
                            {/* 2. Contact person */}
                            {deal.kontaktperson && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Avatar className="w-5 h-5 shrink-0">
                                  {deal.e_post && <AvatarImage src={gravatarUrl(deal.e_post, 40) || undefined} alt={deal.kontaktperson} />}
                                  <AvatarFallback className="text-[8px] font-bold bg-primary/10 text-primary">
                                    {deal.kontaktperson.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="truncate">{deal.kontaktperson}</span>
                              </div>
                            )}

                            {/* 3. Use case */}
                            {deal.use_case?.trim() && (
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                <div className="w-5 h-5 flex items-center justify-center shrink-0">💡</div>
                                <span className="truncate">{deal.use_case}</span>
                              </div>
                            )}

                            {/* 4. MRR + Package */}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                                <DollarSign className="w-3.5 h-3.5" />
                              </div>
                              <span className="font-medium text-foreground">{nok(deal.forventet_mrr)}</span>
                              {deal.valgt_pakke && (() => {
                                const pakke = PAKKER.find(p => p.navn === deal.valgt_pakke);
                                return (
                                  <span className="text-[10px] text-muted-foreground">
                                    · {deal.valgt_pakke}{pakke?.minutter ? ` (${pakke.minutter})` : ""}
                                  </span>
                                );
                              })()}
                            </div>

                            {/* 5. Deal owner */}
                            {deal.ansvarlig && getProfileName(deal.ansvarlig) && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                  <span className="text-[9px] font-bold text-primary">{getProfileName(deal.ansvarlig).charAt(0).toUpperCase()}</span>
                                </div>
                                <span className="truncate">{getProfileName(deal.ansvarlig)}</span>
                              </div>
                            )}

                            {/* 6. Kilde */}
                            {deal.kilde && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <div className="w-5 h-5 flex items-center justify-center shrink-0">📣</div>
                                <span className="truncate">{deal.kilde}</span>
                              </div>
                            )}

                            {/* 7. Kontrakt-status */}
                            {deal.kontrakt_status && deal.kontrakt_status !== "Ikke sendt" && (
                              <div className="flex items-center gap-2 text-xs">
                                <div className="w-5 h-5 flex items-center justify-center shrink-0">
                                  <FileSignature className="w-3.5 h-3.5 text-muted-foreground" />
                                </div>
                                <Badge className={`text-[10px] px-1.5 py-0 h-4 ${kontraktStatusColors[deal.kontrakt_status as KontraktStatus]}`}>
                                  {deal.kontrakt_status}{deal.kontrakt_status === "Signert" && " 🎉"}
                                </Badge>
                              </div>
                            )}
                          </div>

                          {/* 6. Neste steg */}
                          {missingNeste ? (
                            <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-border/50 text-destructive">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span className="text-[10px] font-medium">Neste steg mangler!</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-border/50">
                              <p className="text-[10px] text-muted-foreground truncate">→ {deal.neste_steg}</p>
                              <div className="flex items-center gap-1 shrink-0">
                                <div className={`w-1.5 h-1.5 rounded-full ${signal.color}`} />
                                <span className="text-[10px] text-muted-foreground">{signal.label}</span>
                              </div>
                            </div>
                          )}

                          {isBlocked && (
                            <p className="text-[10px] text-destructive mt-1 font-medium">⛔ Fyll inn neste steg før flytting</p>
                          )}
                          </div>
                          ); })()}
                          </HoverCardTrigger>
                          {(() => {
                            const recap = (deal as any).ai_recap as { sammendrag?: string; kundesignal?: string; neste_steg?: string; risikofaktorer?: string[]; generert_dato?: string } | null;
                            if (!recap) return null;
                            const signalStyle = recap.kundesignal === "Høy" ? "bg-success/15 text-success border-success/30"
                              : recap.kundesignal === "Medium" ? "bg-warning/15 text-warning border-warning/30"
                              : recap.kundesignal === "Lav" ? "bg-destructive/15 text-destructive border-destructive/30"
                              : "bg-muted text-muted-foreground border-border";
                            return (
                              <HoverCardContent side="right" align="start" className="w-80 p-3 space-y-2">
                                <div className="flex items-center gap-2">
                                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                                  <span className="text-xs font-semibold">AI Recap</span>
                                  {recap.kundesignal && (
                                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${signalStyle}`}>
                                      {recap.kundesignal} interesse
                                    </Badge>
                                  )}
                                </div>
                                {recap.sammendrag && (
                                  <p className="text-xs leading-relaxed text-foreground">{recap.sammendrag}</p>
                                )}
                                {(() => {
                                  const lm = lastMeetings[deal.id];
                                  if (!lm) return null;
                                  const days = Math.floor((Date.now() - new Date(lm.dato).getTime()) / 86400000);
                                  return (
                                    <div className="rounded-md bg-warning/5 border border-warning/20 p-2">
                                      <div className="flex items-center gap-1.5 mb-0.5">
                                        <NotebookPen className="w-2.5 h-2.5 text-warning" />
                                        <span className="text-[10px] font-medium text-warning uppercase tracking-wide">
                                          Siste møte · {days === 0 ? "i dag" : `${days}d siden`}
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-foreground/80 line-clamp-3">
                                        {lm.ai_sammendrag || lm.tittel || "Møtenotater tilgjengelig"}
                                      </p>
                                    </div>
                                  );
                                })()}
                                {recap.neste_steg && (() => {
                                  const alreadyApplied = (deal.neste_steg || "").trim() === recap.neste_steg.trim();
                                  return (
                                    <div className="rounded-md bg-muted/50 border p-2">
                                      <div className="flex items-center justify-between gap-2 mb-0.5">
                                        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Foreslått neste steg</div>
                                        <Button
                                          size="sm"
                                          variant={alreadyApplied ? "ghost" : "outline"}
                                          className="h-5 px-1.5 text-[10px]"
                                          disabled={alreadyApplied}
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            try {
                                              const { error } = await supabase
                                                .from("salgsmuligheter")
                                                .update({ neste_steg: recap.neste_steg })
                                                .eq("id", deal.id);
                                              if (error) throw error;
                                              updateSalgsmuligheter(prev => prev.map(s =>
                                                s.id === deal.id ? { ...s, neste_steg: recap.neste_steg! } : s
                                              ));
                                              toast.success("Neste steg oppdatert");
                                            } catch (err) {
                                              console.error(err);
                                              toast.error("Kunne ikke oppdatere neste steg");
                                            }
                                          }}
                                        >
                                          {alreadyApplied ? (
                                            <><Check className="w-2.5 h-2.5 mr-0.5" /> Brukt</>
                                          ) : (
                                            <>Bruk <ArrowRight className="w-2.5 h-2.5 ml-0.5" /></>
                                          )}
                                        </Button>
                                      </div>
                                      <div className="text-xs">{recap.neste_steg}</div>
                                    </div>
                                  );
                                })()}
                                {recap.risikofaktorer && recap.risikofaktorer.length > 0 && (
                                  <div className="rounded-md bg-destructive/5 border border-destructive/20 p-2">
                                    <div className="text-[10px] font-medium text-destructive uppercase tracking-wide mb-0.5 flex items-center gap-1">
                                      <AlertTriangle className="w-2.5 h-2.5" /> Risiko
                                    </div>
                                    <ul className="text-[11px] space-y-0.5 list-disc list-inside text-foreground/80">
                                      {recap.risikofaktorer.slice(0, 3).map((r, i) => <li key={i}>{r}</li>)}
                                    </ul>
                                  </div>
                                )}
                              </HoverCardContent>
                            );
                          })()}
                        </HoverCard>
                      );
                    })}
                    {stageDeals.length === 0 && (
                      <div className="border-2 border-dashed rounded-lg p-6 text-center text-xs text-muted-foreground">Dra hit</div>
                    )}
                  </div>
                </div>
              );
            })}
            {/* Vunnet / Tapt drop zones */}
            {(["Vunnet", "Tapt"] as const).map(stage => (
              <div key={stage} className={`${isMobile ? "min-w-[160px] w-[160px]" : "min-w-[200px] w-[200px]"} flex-shrink-0 rounded-xl p-2 -m-2 transition-colors ${dragOverStage === stage ? (stage === "Vunnet" ? "bg-success/10 ring-2 ring-success/30" : "bg-destructive/10 ring-2 ring-destructive/30") : ""}`}
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverStage(stage); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverStage(null); }}
                onDragEnd={() => { setDragOverStage(null); setDraggedId(null); }}
                onDrop={e => handleDrop(e, stage)}>
                <div className="mb-3 flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${statusColors[stage]}`} />
                  <h3 className="font-semibold text-xs sm:text-sm">{stage}</h3>
                </div>
                <div className="border-2 border-dashed rounded-lg p-6 sm:p-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                  {stage === "Vunnet" ? <Trophy className="w-5 h-5 text-success" /> : <XCircle className="w-5 h-5 text-destructive" />}
                  Dra deal hit
                </div>
              </div>
            ))}
          </div>
          )}
        </TabsContent>
        <TabsContent value="signed">
          <DealList deals={signedDeals} getSelskapNavn={getSelskapNavn} getSelskapDomain={getSelskapDomain} onSelect={setSelectedSm} label="Signerte kontrakter" onNavigateSelskap={id => navigate(`/selskaper/${id}`)} isMobile={isMobile} showKontraktStatus />
        </TabsContent>

        <TabsContent value="awaiting">
          <DealList deals={awaitingSignature} getSelskapNavn={getSelskapNavn} getSelskapDomain={getSelskapDomain} onSelect={setSelectedSm} label="Venter på signering" onNavigateSelskap={id => navigate(`/selskaper/${id}`)} isMobile={isMobile} showKontraktStatus />
        </TabsContent>
        <TabsContent value="overdue">
          <DealList deals={overdueDeals} getSelskapNavn={getSelskapNavn} getSelskapDomain={getSelskapDomain} onSelect={setSelectedSm} label="Forfalt lukkedato" onNavigateSelskap={id => navigate(`/selskaper/${id}`)} isMobile={isMobile} showLukkedato />
        </TabsContent>
        <TabsContent value="inactive">
          <DealList deals={inactiveDeals} getSelskapNavn={getSelskapNavn} getSelskapDomain={getSelskapDomain} onSelect={setSelectedSm} label="Inaktive deals (>7 dager)" onNavigateSelskap={id => navigate(`/selskaper/${id}`)} isMobile={isMobile} />
        </TabsContent>
        <TabsContent value="won">
          <DealList deals={wonThisMonth} getSelskapNavn={getSelskapNavn} getSelskapDomain={getSelskapDomain} onSelect={setSelectedSm} label="Vunnet denne måneden" onNavigateSelskap={id => navigate(`/selskaper/${id}`)} isMobile={isMobile} />
        </TabsContent>
        <TabsContent value="lost">
          <DealList deals={lostThisMonth} getSelskapNavn={getSelskapNavn} getSelskapDomain={getSelskapDomain} onSelect={setSelectedSm} label="Tapt denne måneden" onNavigateSelskap={id => navigate(`/selskaper/${id}`)} isMobile={isMobile} />
        </TabsContent>
        <TabsContent value="all">
          <DealList deals={allClosed} getSelskapNavn={getSelskapNavn} getSelskapDomain={getSelskapDomain} onSelect={setSelectedSm} label="Alle avsluttede salg" onNavigateSelskap={id => navigate(`/selskaper/${id}`)} isMobile={isMobile} />
        </TabsContent>
      </Tabs>

      <DetailPanelShell
        open={!!currentSm}
        onClose={() => setSelectedSm(null)}
        activeTab={detailTab}
        onActiveTabChange={(t) => setDetailTab(t)}
        title={currentSm?.navn || ""}
        onTitleChange={canEdit && currentSm ? (value) => {
          const today = new Date().toISOString().split("T")[0];
          updateSalgsmuligheter(prev => prev.map(s => s.id === currentSm.id ? { ...s, navn: value, sist_aktivitet: today } : s));
        } : undefined}
        subtitle={currentSm ? getSelskapNavn(currentSm.selskap_id) : undefined}
        badges={currentSm ? (
          <>
            <Badge variant="secondary" className="text-xs">{currentSm.status}</Badge>
            {currentSm.sannsynlighet != null && <Badge variant="outline" className="text-xs">{currentSm.sannsynlighet}%</Badge>}
            <Badge className={`text-[10px] ${kontraktStatusColors[currentSm.kontrakt_status as KontraktStatus] || kontraktStatusColors["Ikke sendt"]}`}>
              <FileSignature className="w-3 h-3 mr-0.5" />{currentSm.kontrakt_status || "Ikke sendt"}
            </Badge>
            {(() => {
              const sig = activitySignal(currentSm.sist_aktivitet);
              return <Badge className={`text-[10px] gap-1 ${sig.color === "bg-destructive" ? "bg-destructive/10 text-destructive" : sig.color === "bg-warning" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}>
                <Clock className="w-3 h-3" />{sig.label}
              </Badge>;
            })()}
          </>
        ) : undefined}
        actions={canEdit && currentSm && openStatuses.includes(currentSm.status as any) ? (
          <>
            <Button size="sm" variant="outline" onClick={() => {
              if (detailTab === "interaksjoner") {
                openCreateActivityRef.current?.();
              } else {
                setPendingOpenActivity(true);
                setDetailTab("interaksjoner");
              }
            }}>
              <PenLine className="w-3.5 h-3.5 mr-1.5" />Logg aktivitet
            </Button>
            {currentSm.e_post && (
              <Button size="sm" variant="outline" onClick={() => setEmailDialogOpen(true)}>
                <Mail className="w-3.5 h-3.5 mr-1.5" />E-post
              </Button>
            )}
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => openForwardDialog(currentSm)}>
                <Send className="w-3.5 h-3.5 mr-1.5" />Videresend
              </Button>
            )}
            <Button size="sm" className="bg-success hover:bg-success/90 text-success-foreground" onClick={() => { setWinPartnerId(currentSm.partner_id || ""); setWinDialog(currentSm.id); setSelectedSm(null); }}>
              <Trophy className="w-3.5 h-3.5 mr-1.5" />Vunnet
            </Button>
            <Button size="sm" variant="destructive" onClick={() => { setSelectedSm(null); setLossDialog(currentSm.id); }}>
              <XCircle className="w-3.5 h-3.5 mr-1.5" />Tapt
            </Button>
          </>
        ) : undefined}
        tabContent={currentSm ? (() => {
          const updateField = (field: string, value: any) => {
            const today = new Date().toISOString().split("T")[0];
            updateSalgsmuligheter(prev => prev.map(s =>
              s.id === currentSm.id ? { ...s, [field]: value, sist_aktivitet: today } : s
            ));
          };
          const updateSelskapField = (field: string, value: any) => {
            if (!currentSm.selskap_id) return;
            updateSelskaper(prev => prev.map(s =>
              s.id === currentSm.selskap_id ? { ...s, [field]: value } : s
            ));
          };
          const arr = currentSm.forventet_mrr * 12;
          const totalKontraktsverdi = beregnTotalKontraktsverdi(currentSm);
          const vektetVerdi = beregnVektetPipeline(currentSm);
          const selskap = selskaper.find(s => s.id === currentSm.selskap_id);
          const linkedKontakt = currentSm.kontakt_id ? kontakter.find(k => k.id === currentSm.kontakt_id) : null;

          return {
            detaljer: (
              <>
                {/* AI Recap (auto-genereres ved nye aktiviteter) */}
                <DealRecapCard
                  salgsmulighetId={currentSm.id}
                  initialRecap={(currentSm as any).ai_recap || null}
                  autoGenerateIfStale={{ lastAktivitetDato: currentSm.sist_aktivitet }}
                  currentNesteSteg={currentSm.neste_steg}
                  onUpdated={(recap) => updateSalgsmuligheter(prev => prev.map(s =>
                    s.id === currentSm.id ? { ...s, ai_recap: recap } as any : s
                  ))}
                  onNesteStegUpdated={(ns) => updateSalgsmuligheter(prev => prev.map(s =>
                    s.id === currentSm.id ? { ...s, neste_steg: ns } : s
                  ))}
                />

                <LastMeetingCard
                  salgsmulighetId={currentSm.id}
                  selskapId={currentSm.selskap_id}
                  kontaktId={currentSm.kontakt_id}
                  ansvarlig={currentSm.ansvarlig}
                  ansvarligUserId={profiles.find(p => p.display_name === currentSm.ansvarlig)?.user_id || null}
                />

                <DetailDivider />

                {/* Seksjon 1 — Pipeline */}
                <DetailSection title="Pipeline">
                  <DetailField label="Status">
                    <select className="w-full border rounded-lg px-3 py-1.5 text-sm bg-background"
                      value={currentSm.status}
                      disabled={!canEdit}
                      onChange={e => {
                        const newStatus = e.target.value as SalgsmulighetStatus;
                        if (newStatus === "Vunnet") { setWinPartnerId(currentSm.partner_id || ""); setWinDialog(currentSm.id); setSelectedSm(null); }
                        else if (newStatus === "Tapt") { setSelectedSm(null); setLossDialog(currentSm.id); }
                        else updateField("status", newStatus);
                      }}>
                      {[...openStatuses, "Vunnet", "Tapt"].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </DetailField>
                  <div className="grid grid-cols-2 gap-2">
                    <DetailField label="Sannsynlighet">
                      <Input type="number" min={0} max={100} value={currentSm.sannsynlighet || ""} onChange={e => updateField("sannsynlighet", Number(e.target.value))} className="h-7 text-xs" readOnly={!canEdit} />
                    </DetailField>
                    <DetailField label="Lukkedato">
                      <Input type="date" value={currentSm.forventet_lukkedato} onChange={e => updateField("forventet_lukkedato", e.target.value)} className="h-7 text-xs" readOnly={!canEdit} />
                    </DetailField>
                  </div>
                  <DetailField label="Ansvarlig">
                    <select className="w-full border rounded-lg px-2 py-1 text-xs bg-background h-7"
                      value={currentSm.ansvarlig}
                      disabled={!canEdit}
                      onChange={e => updateField("ansvarlig", e.target.value)}>
                      <option value="">Ikke tildelt</option>
                      {profiles.map(p => (
                        <option key={p.user_id} value={p.user_id}>
                          {p.display_name}{p.user_id === user?.id ? " (deg)" : ""}
                        </option>
                      ))}
                    </select>
                  </DetailField>
                  <DetailField label="Kilde">
                    <select className="w-full border rounded-lg px-2 py-1 text-xs bg-background h-7"
                      value={currentSm.kilde || ""}
                      disabled={!canEdit}
                      onChange={e => updateField("kilde", e.target.value)}>
                      <option value="">Ikke satt</option>
                      {["Nettside","LinkedIn","Partner","Referanse","Kald outbound","E-post","Telefon","Annet","Organisk","Facebook ads","Instantly kald e-post","Google ads"].map(k => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
                  </DetailField>
                  {currentSm.status === "Tapt" && currentSm.tapsaarsak && (
                    <div className="p-2 bg-destructive/10 rounded-lg text-destructive text-xs">
                      <strong>Tapsårsak:</strong> {currentSm.tapsaarsak} · {currentSm.tapt_dato}
                    </div>
                  )}
                  {currentSm.status === "Vunnet" && (
                    <div className="p-2 bg-success/10 rounded-lg text-success text-xs">
                      <strong>Vunnet:</strong> {currentSm.vunnet_dato}
                    </div>
                  )}
                </DetailSection>

                <DetailDivider />

                {/* Seksjon 2 — Økonomi */}
                <DetailSection title="Økonomi">
                  <DetailField label="Pakke">
                    <select className="w-full border rounded-lg px-2 py-1 text-xs bg-background h-7"
                      value={currentSm.valgt_pakke || ""}
                      disabled={!canEdit}
                      onChange={e => {
                        const pakkeNavn = e.target.value;
                        const pakke = PAKKER.find(p => p.navn === pakkeNavn);
                        updateField("valgt_pakke", pakkeNavn);
                        if (pakke?.mrr != null) {
                          updateField("forventet_mrr", pakke.mrr);
                        }
                      }}>
                      <option value="">Velg pakke…</option>
                      {PAKKER.map(p => (
                        <option key={p.navn} value={p.navn}>
                          {p.navn} {p.mrr != null ? `— ${nok(p.mrr)}/mnd` : p.navn === "Enterprise" ? "— kontakt for pris" : "— fritekst"}{p.minutter ? ` (${p.minutter})` : ""}
                        </option>
                      ))}
                    </select>
                  </DetailField>
                  {currentSm.valgt_pakke && (() => {
                    const pakke = PAKKER.find(p => p.navn === currentSm.valgt_pakke);
                    return pakke?.minutter ? (
                      <div className="text-xs text-muted-foreground bg-muted/30 rounded-md px-2 py-1">
                        📞 {pakke.minutter} inkludert
                      </div>
                    ) : null;
                  })()}
                  <div className="grid grid-cols-2 gap-2">
                    <DetailField label="MRR">
                      <Input type="number" value={currentSm.forventet_mrr || ""} onChange={e => updateField("forventet_mrr", Number(e.target.value))} className="h-7 text-xs" readOnly={!canEdit || (!!currentSm.valgt_pakke && PAKKER.find(p => p.navn === currentSm.valgt_pakke)?.mrr != null)} />
                    </DetailField>
                    <DetailField label="ARR">
                      <div className="text-sm font-medium">{nok(arr)}</div>
                    </DetailField>
                    <DetailField label="Oppstart">
                      <Input type="number" value={currentSm.oppstartskostnad || ""} onChange={e => updateField("oppstartskostnad", Number(e.target.value))} className="h-7 text-xs" readOnly={!canEdit} />
                    </DetailField>
                    <DetailField label="Kontraktslengde (Mnd)">
                      <Input type="number" value={currentSm.kontraktslengde_mnd || ""} onChange={e => updateField("kontraktslengde_mnd", Number(e.target.value))} className="h-7 text-xs" readOnly={!canEdit} />
                    </DetailField>
                  </div>
                  <DetailField label="Vektet verdi">
                    <div className="text-sm font-medium">{nok(vektetVerdi)}</div>
                  </DetailField>
                </DetailSection>

                <DetailDivider />

                {/* Seksjon 3 — Detaljer */}
                <DetailSection title="Detaljer">
                  <DetailField label="Use case">
                    <Input value={currentSm.use_case} onChange={e => updateField("use_case", e.target.value)} className="h-7 text-xs" readOnly={!canEdit} />
                  </DetailField>
                  <div className="rounded-lg border p-3 space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Neste steg</label>
                    <Input value={currentSm.neste_steg} onChange={e => updateField("neste_steg", e.target.value)} className={`h-8 text-sm ${!currentSm.neste_steg?.trim() ? "border-destructive ring-1 ring-destructive/30" : ""}`} readOnly={!canEdit} placeholder="Hva er neste steg?" />
                    {!currentSm.neste_steg?.trim() && (
                      <p className="text-[10px] text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Obligatorisk</p>
                    )}
                  </div>
                  <DetailField label="SLA">
                    <Input type="number" value={currentSm.sla || ""} onChange={e => updateField("sla", Number(e.target.value))} className="h-7 text-xs" readOnly={!canEdit} />
                  </DetailField>
                </DetailSection>

                <DetailDivider />

                {/* Seksjon 4 — Kontrakt */}
                <DetailSection title="Kontrakt">
                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs ${kontraktStatusColors[currentSm.kontrakt_status as KontraktStatus] || kontraktStatusColors["Ikke sendt"]}`}>
                      <FileSignature className="w-3 h-3 mr-1" />{currentSm.kontrakt_status || "Ikke sendt"}
                    </Badge>
                    {currentSm.kontrakt_status === "Signert" && currentSm.kontrakt_signert_dato && (
                      <span className="text-xs text-success flex items-center gap-1">
                        🎉 {new Date(currentSm.kontrakt_signert_dato).toLocaleDateString("nb-NO")}
                      </span>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex flex-wrap gap-2">
                      <Button size="default" variant="destructive" className="text-sm gap-2" onClick={() => setContractModalOpen(true)}>
                        <FileSignature className="w-4 h-4" />Send kontrakt
                      </Button>
                      {(currentSm.kontrakt_status === "Sendt" || currentSm.kontrakt_status === "Åpnet") && (
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => {
                          const params = new URLSearchParams({
                            companyname: selskap?.firmanavn || "",
                            customername: currentSm.kontaktperson || "",
                            email: currentSm.e_post || "",
                            phonenumber: currentSm.telefon || "",
                            orgnumber: selskap?.orgnr || "",
                            address: selskap?.postadresse || "",
                            visitaddress: selskap?.firmaadresse || "",
                            CRMid: currentSm.id,
                            pakke: currentSm.valgt_pakke || "",
                          });
                          window.open(`https://app.dealbuilder.io/contract/createnewcontractexternal?${params.toString()}`, "_blank");
                        }}>
                          <Mail className="w-3.5 h-3.5 mr-1.5" />Send påminnelse
                        </Button>
                      )}
                    </div>
                  )}
                  {currentSm && (() => {
                    const pakke = PAKKER.find(p => p.navn === currentSm.valgt_pakke);
                    return (
                      <SendContractModal
                        open={contractModalOpen}
                        onOpenChange={setContractModalOpen}
                        contractData={{
                          salgsmulighet_id: currentSm.id,
                          firmanavn: selskap?.firmanavn || "",
                          orgnr: selskap?.orgnr || "",
                          adresse: selskap?.postadresse || selskap?.firmaadresse || "",
                          kontaktperson: currentSm.kontaktperson || "",
                          telefon: currentSm.telefon || "",
                          e_post: currentSm.e_post || "",
                          valgt_pakke: currentSm.valgt_pakke || "",
                          pakke_pris: pakke?.mrr || currentSm.forventet_mrr || 0,
                          minutter: pakke?.minutter || "",
                          sla: currentSm.sla ?? null,
                          oppstartskostnad: currentSm.oppstartskostnad ?? null,
                        }}
                        senderEmail={user?.email || ""}
                        onContractSent={(dokumentId) => {
                          updateSalgsmuligheter(prev => prev.map(s =>
                            s.id === currentSm.id ? {
                              ...s,
                              kontrakt_status: "Sendt" as const,
                              status: "Kontrakt sendt" as SalgsmulighetStatus,
                              sist_aktivitet: new Date().toISOString().split("T")[0],
                              ...(dokumentId ? { dealbuilder_dokument_id: dokumentId } : {}),
                            } : s
                          ));
                        }}
                      />
                    );
                  })()}
                </DetailSection>

                {canEdit && (
                  <Button size="sm" variant="ghost" className="w-full text-destructive hover:bg-destructive/10 text-xs" onClick={() => {
                    updateSalgsmuligheter(prev => prev.filter(s => s.id !== currentSm.id));
                    setSelectedSm(null);
                  }}>
                    <Trash2 className="w-3 h-3 mr-1" />Slett
                  </Button>
                )}
              </>
            ),
            selskap: (
              <>
                <DetailSection title="Selskapsinformasjon">
                  {selskap ? (
                    <>
                      <DetailField label="Selskapsnavn" value={selskap.firmanavn} />
                      <DetailField label="Organisasjonsnummer">
                        <Input value={selskap.orgnr || ""} onChange={e => updateSelskapField("orgnr", e.target.value)} className="h-7 text-xs" readOnly={!canEdit} placeholder="Org.nr" />
                      </DetailField>
                      <DetailField label="Firmaadresse (besøk)">
                        <Input value={selskap.firmaadresse || ""} onChange={e => updateSelskapField("firmaadresse", e.target.value)} className="h-7 text-xs" readOnly={!canEdit} placeholder="Besøksadresse" />
                      </DetailField>
                      <DetailField label="Postadresse">
                        <Input value={selskap.postadresse || ""} onChange={e => updateSelskapField("postadresse", e.target.value)} className="h-7 text-xs" readOnly={!canEdit} placeholder="Postadresse" />
                      </DetailField>
                      <DetailField label="Bransje">
                        <Input value={selskap.bransje || ""} onChange={e => updateSelskapField("bransje", e.target.value)} className="h-7 text-xs" readOnly={!canEdit} />
                      </DetailField>
                      <DetailField label="Nettside">
                        {selskap.domene ? (
                          <a href={`https://${selskap.domene}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                            <Globe className="w-3 h-3" />{selskap.domene}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">–</span>
                        )}
                      </DetailField>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Ingen selskap koblet til denne salgsmuligheten.</p>
                  )}
                </DetailSection>

                {selskap && (
                  <>
                    <DetailDivider />
                    <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => navigate(`/selskaper/${selskap.id}`)}>
                      <Building2 className="w-3.5 h-3.5 mr-1.5" />Gå til selskapsprofil
                    </Button>
                  </>
                )}

                <SelskapInnsikt
                  domene={getSelskapDomain(currentSm.selskap_id)}
                  firmanavn={getSelskapNavn(currentSm.selskap_id || "")}
                  e_post={currentSm.e_post}
                  onEnriched={(innsikt) => {
                    if (currentSm.selskap_id) {
                      const selskap = selskaper.find(s => s.id === currentSm.selskap_id);
                      if (selskap) {
                        const needsOrgnr = innsikt.orgnr && (!selskap.orgnr || selskap.orgnr === "");
                        const needsBransje = innsikt.bransje && (!selskap.bransje || selskap.bransje === "");
                        const needsFirmaadresse = innsikt.firmaadresse && (!selskap.firmaadresse || selskap.firmaadresse === "");
                        const needsPostadresse = innsikt.postadresse && (!selskap.postadresse || selskap.postadresse === "");
                        if (needsOrgnr || needsBransje || needsFirmaadresse || needsPostadresse) {
                          updateSelskaper(prev => prev.map(s =>
                            s.id === currentSm.selskap_id ? {
                              ...s,
                              ...(needsOrgnr ? { orgnr: innsikt.orgnr! } : {}),
                              ...(needsBransje ? { bransje: innsikt.bransje! } : {}),
                              ...(needsFirmaadresse ? { firmaadresse: innsikt.firmaadresse! } : {}),
                              ...(needsPostadresse ? { postadresse: innsikt.postadresse! } : {}),
                            } : s
                          ));
                          toast.success("Selskapsfelt oppdatert fra selskapsinnsikt");
                        }
                      }
                    }
                  }}
                />
              </>
            ),
            kontakt: (
              <>
                <DetailSection title="Kontaktperson">
                  <div className="grid grid-cols-2 gap-2">
                    <DetailField label="Navn">
                      <Input value={currentSm.kontaktperson} onChange={e => updateField("kontaktperson", e.target.value)} className="h-7 text-xs" readOnly={!canEdit} />
                    </DetailField>
                    <DetailField label="Rolle">
                      <Input value={currentSm.rolle_i_firma} onChange={e => updateField("rolle_i_firma", e.target.value)} className="h-7 text-xs" readOnly={!canEdit} />
                    </DetailField>
                    <DetailField label="E-post">
                      <Input value={currentSm.e_post} onChange={e => updateField("e_post", e.target.value)} className="h-7 text-xs" readOnly={!canEdit} />
                    </DetailField>
                    <DetailField label="Telefon">
                      <Input value={currentSm.telefon} onChange={e => updateField("telefon", e.target.value)} className="h-7 text-xs" readOnly={!canEdit} />
                    </DetailField>
                  </div>
                  {linkedKontakt?.linkedin && (
                    <DetailField label="LinkedIn">
                      <a href={linkedKontakt.linkedin.startsWith("http") ? linkedKontakt.linkedin : `https://linkedin.com/in/${linkedKontakt.linkedin}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                        <Linkedin className="w-3 h-3" />{linkedKontakt.linkedin}
                      </a>
                    </DetailField>
                  )}
                </DetailSection>

                <DetailDivider />

                {canEdit && (
                  <DetailSection title="Koble til kontakt">
                    <EntityLinkPicker
                      options={(() => {
                        const sameCompany = kontakter
                          .filter(k => currentSm.selskap_id && k.selskap_id === currentSm.selskap_id)
                          .map(k => ({ id: k.id, label: k.navn, sublabel: k.e_post || k.rolle || undefined }));
                        const others = kontakter
                          .filter(k => !currentSm.selskap_id || k.selskap_id !== currentSm.selskap_id)
                          .map(k => ({ id: k.id, label: k.navn, sublabel: k.e_post || k.rolle || undefined }));
                        return [...sameCompany, ...others];
                      })()}
                      value={currentSm.kontakt_id || null}
                      onChange={(id) => {
                        if (id) {
                          const kontakt = kontakter.find(k => k.id === id);
                          if (kontakt) {
                            updateField("kontakt_id", kontakt.id);
                            updateField("kontaktperson", kontakt.navn);
                            updateField("e_post", kontakt.e_post);
                            updateField("telefon", kontakt.telefon);
                            updateField("rolle_i_firma", kontakt.rolle);
                          }
                        } else {
                          updateField("kontakt_id", "");
                        }
                      }}
                      placeholder="Koble til kontakt..."
                    />
                  </DetailSection>
                )}
              </>
            ),
            interaksjoner: (
              <>
                <InlineTaskForm salgsmulighet_id={currentSm.id} selskap_id={currentSm.selskap_id} />
                <ActivityLog salgsmulighet_id={currentSm.id} onOpenCreateRef={openCreateActivityRef} onActivityLogged={() => {
                  updateSalgsmuligheter(prev => prev.map(s => s.id === currentSm.id ? { ...s, sist_aktivitet: new Date().toISOString().split("T")[0] } : s));
                }} />
                <MeetingNotesList
                  salgsmulighet_id={currentSm.id}
                  dealName={currentSm.navn}
                  companyName={getSelskapNavn(currentSm.selskap_id)}
                  onSuggestNesteSteg={(text) => updateField("neste_steg", text)}
                />
                <EntityChangelog entity_type="salgsmulighet" entity_id={currentSm.id} />
              </>
            ),
            notater: (
              <DetailField label="Notater">
                <Textarea value={currentSm.notater} onChange={e => updateField("notater", e.target.value)} rows={6} readOnly={!canEdit} />
              </DetailField>
            ),
            kalender: (
              <EntityCalendarTab salgsmulighet_id={currentSm.id} />
            ),
          };
        })() : undefined}
      />
      {currentSm && (
        <SendEmailDialog
          open={emailDialogOpen}
          onOpenChange={setEmailDialogOpen}
          defaultTo={currentSm.e_post}
          defaultSubject={`Oppfølging – ${getSelskapNavn(currentSm.selskap_id)}`}
          context={{
            entityType: "salgsmulighet",
            entityId: currentSm.id,
            selskapNavn: getSelskapNavn(currentSm.selskap_id),
            kontaktperson: currentSm.kontaktperson,
            selskapId: currentSm.selskap_id,
            kontaktId: currentSm.kontakt_id,
            nesteSteg: currentSm.neste_steg,
            useCase: currentSm.use_case,
            status: currentSm.status,
          }}
          onSent={() => {
            const today = new Date().toISOString().split("T")[0];
            updateSalgsmuligheter(prev => prev.map(s => s.id === currentSm.id ? { ...s, sist_aktivitet: today } : s));
          }}
        />
      )}
    </PageShell>
  );
}

function getSignalDotClass(deal: Salgsmulighet): string {
  const signal = ((deal as any).ai_recap?.kundesignal || "").toLowerCase();
  if (signal === "høy" || signal === "hoy") return "bg-success";
  if (signal === "medium") return "bg-warning";
  if (signal === "lav") return "bg-destructive";
  return "bg-muted-foreground/30";
}

function getSignalLabel(deal: Salgsmulighet): string {
  const signal = ((deal as any).ai_recap?.kundesignal || "").toLowerCase();
  if (signal === "høy" || signal === "hoy") return "Høy";
  if (signal === "medium") return "Medium";
  if (signal === "lav") return "Lav";
  return "Ingen AI-recap";
}

function DealList({ deals, getSelskapNavn, getSelskapDomain, onSelect, label, onNavigateSelskap, isMobile, showKontraktStatus, showLukkedato, showSignalAndNextStep }: { deals: Salgsmulighet[]; getSelskapNavn: (id: string) => string; getSelskapDomain?: (id: string | null) => string; onSelect: (s: Salgsmulighet) => void; label: string; onNavigateSelskap?: (id: string) => void; isMobile: boolean; showKontraktStatus?: boolean; showLukkedato?: boolean; showSignalAndNextStep?: boolean }) {
  if (deals.length === 0) return <div className="text-center py-12 text-muted-foreground text-sm">{label}: ingen</div>;

  if (isMobile) {
    return (
      <div className="space-y-3">
        {deals.map(d => (
          <div key={d.id} className="bg-card border rounded-xl p-4 space-y-1" onClick={() => onSelect(d)}>
            <p className="font-semibold text-sm truncate">{d.kontaktperson || "–"}</p>
            {d.use_case && <p className="text-xs text-muted-foreground">{d.use_case}</p>}
            <p className="text-xs text-muted-foreground cursor-pointer" onClick={e => { e.stopPropagation(); onNavigateSelskap?.(d.selskap_id); }}>{getSelskapNavn(d.selskap_id)}</p>
            <div className="flex items-center gap-2">
              {d.oppstartskostnad > 0 && <p className="text-xs font-mono">{d.oppstartskostnad.toLocaleString("no-NO")} oppstart</p>}
              {showKontraktStatus && d.kontrakt_status && (
                <Badge className={`text-[10px] px-1.5 py-0 h-4 ${kontraktStatusColors[d.kontrakt_status as KontraktStatus] || ""}`}>{d.kontrakt_status}</Badge>
              )}
              {showLukkedato && d.forventet_lukkedato && (
                <span className="text-[10px] text-destructive font-medium">Frist: {new Date(d.forventet_lukkedato).toLocaleDateString("nb-NO")}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {showSignalAndNextStep && <th className="text-left px-2 py-3 font-medium w-8" title="Kundesignal"></th>}
            <th className="text-left px-4 py-3 font-medium">Kontaktperson</th>
            <th className="text-left px-4 py-3 font-medium">Use case</th>
            <th className="text-left px-4 py-3 font-medium">Selskap</th>
            <th className="text-left px-4 py-3 font-medium">Status</th>
            {showSignalAndNextStep && <th className="text-left px-4 py-3 font-medium">Neste steg</th>}
            {showKontraktStatus && <th className="text-left px-4 py-3 font-medium">Kontrakt</th>}
            {showLukkedato && <th className="text-left px-4 py-3 font-medium">Lukkedato</th>}
            <th className="text-right px-4 py-3 font-medium">MRR</th>
          </tr>
        </thead>
        <tbody>
          {deals.map(d => (
            <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => onSelect(d)}>
              {showSignalAndNextStep && (
                <td className="px-2 py-3">
                  <div className={`h-2.5 w-2.5 rounded-full ${getSignalDotClass(d)}`} title={`Kundesignal: ${getSignalLabel(d)}`} />
                </td>
              )}
              <td className="px-4 py-3 font-medium">
                {(() => {
                  const name = d.kontaktperson || "–";
                  const initials = name.split(" ").map(n => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
                  const src = d.e_post ? gravatarUrl(d.e_post) : undefined;
                  return (
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="w-6 h-6 shrink-0">
                        {src && <AvatarImage src={src} alt={name} />}
                        <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                      </Avatar>
                      <span className="truncate">{name}</span>
                    </div>
                  );
                })()}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{d.use_case || "–"}</td>
              <td className="px-4 py-3 text-muted-foreground">
                <div className="flex items-center gap-2 min-w-0">
                  <CompanyLogo domain={getSelskapDomain?.(d.selskap_id) || ""} firmanavn={getSelskapNavn(d.selskap_id)} kontaktEmails={d.e_post ? [d.e_post] : undefined} size="sm" className="w-6 h-6 rounded shrink-0" />
                  <span className="cursor-pointer hover:text-primary hover:underline truncate" onClick={e => { e.stopPropagation(); onNavigateSelskap?.(d.selskap_id); }}>{getSelskapNavn(d.selskap_id)}</span>
                </div>
              </td>
              <td className="px-4 py-3"><Badge variant="secondary" className="text-[10px]">{d.status}</Badge></td>
              {showSignalAndNextStep && (
                <td className="px-4 py-3 text-muted-foreground text-xs max-w-[240px] truncate" title={d.neste_steg || ""}>{d.neste_steg || "–"}</td>
              )}
              {showKontraktStatus && (
                <td className="px-4 py-3">
                  <Badge className={`text-[10px] px-1.5 py-0 h-4 ${kontraktStatusColors[d.kontrakt_status as KontraktStatus] || ""}`}>{d.kontrakt_status || "–"}</Badge>
                </td>
              )}
              {showLukkedato && (
                <td className="px-4 py-3 text-destructive text-xs font-medium">{d.forventet_lukkedato ? new Date(d.forventet_lukkedato).toLocaleDateString("nb-NO") : "–"}</td>
              )}
              <td className="px-4 py-3 text-right font-mono">{nok(d.forventet_mrr)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
