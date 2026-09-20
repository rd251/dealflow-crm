import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import {
  beregnTotalKontraktsverdi, beregnVektetPipeline,
  Prosjekt, Kontakt, Kundestatus, OnboardingStatus, Kundetilstand, SalgsmulighetStatus, Oppgave,
} from "@/data/crm-data";
import InlineTaskForm from "@/components/InlineTaskForm";
import ActivityLog from "@/components/ActivityLog";
import LogActivityButton from "@/components/LogActivityButton";
import PersonTimeline from "@/components/PersonTimeline";
import EntityChangelog from "@/components/EntityChangelog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  ArrowLeft, Users, Mail, Phone, Linkedin, FileText, ChevronRight, Plus, X, Trash2, Send, ListPlus, Rocket,
} from "lucide-react";
import SendEmailDialog from "@/components/SendEmailDialog";
import CompanyLogo from "@/components/CompanyLogo";
import SelskapInnsikt from "@/components/SelskapInnsikt";
import CompanyDocuments from "@/components/CompanyDocuments";
import OnboardingAnswers from "@/components/OnboardingAnswers";
import OpprettProsjektDialog from "@/components/prosjekt/OpprettProsjektDialog";
import ProsjektFremdrift from "@/components/prosjekt/ProsjektFremdrift";
import Timeregistrering from "@/components/kunde/Timeregistrering";
import {
  PROSJEKT_STATUSER, harTimeregistrering, kundestatusFarge, tilstandFarge, prosjektStatusFarge, relativTid, iDag,
  type OnboardingType,
} from "@/lib/kundeforhold";
import { nok } from "@/lib/utils";
import { toast } from "sonner";

const kundestatuser: Kundestatus[] = ["Ikke kunde", "Pilot", "Live", "Pause", "Kansellert"];
const onboardingStatuser: OnboardingStatus[] = ["Ikke startet", "Pågår", "Venter på kunde", "Klar for live", "Ferdig"];
const kundetilstander: Kundetilstand[] = ["Bra", "Usikker", "Risiko"];

const smStatusColors: Record<SalgsmulighetStatus, string> = {
  "Møte booket": "bg-stage-contacted/10 text-stage-contacted",
  "Behov avklart": "bg-stage-qualified/10 text-stage-qualified",
  "Løsning presentert": "bg-stage-demo/10 text-stage-demo",
  "Demo gjennomført": "bg-stage-demo/10 text-stage-demo",
  "Demo-prosjekt": "bg-stage-demo/10 text-stage-demo",
  "Kontrakt sendt": "bg-stage-proposal/10 text-stage-proposal",
  "Vunnet": "bg-success/10 text-success",
  "Tapt": "bg-destructive/10 text-destructive",
};

export default function CompanyProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const {
    selskaper, updateSelskaper, kontakter, updateKontakter, salgsmuligheter, updateSalgsmuligheter,
    prosjekter, updateProsjekter, oppgaver, updateOppgaver, partnere, generateId, settProsjektLive,
  } = useCrmStore();

  const [showAddContact, setShowAddContact] = useState(false);
  const [expandedContact, setExpandedContact] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState({ navn: "", rolle: "", e_post: "", telefon: "", linkedin: "" });
  const [deleteTarget, setDeleteTarget] = useState<Kontakt | null>(null);
  const [deleteRelations, setDeleteRelations] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailContact, setEmailContact] = useState<Kontakt | null>(null);
  const [nyttProsjektOpen, setNyttProsjektOpen] = useState(false);
  const [pakkenavn, setPakkenavn] = useState<string>("");

  const selskap = selskaper.find(s => s.id === id);

  useEffect(() => {
    let aktiv = true;
    if (!selskap?.partner_pakke_id) { setPakkenavn(""); return; }
    supabase.from("partner_pakker").select("navn").eq("id", selskap.partner_pakke_id).maybeSingle()
      .then(({ data }) => { if (aktiv) setPakkenavn(data?.navn || ""); });
    return () => { aktiv = false; };
  }, [selskap?.partner_pakke_id]);

  const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1`;
  const API_HEADERS: HeadersInit = {
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  };

  const requestJson = async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(`${API_URL}${path}`, { ...init, headers: { ...API_HEADERS, ...(init?.headers || {}) } });
    if (!response.ok) throw new Error((await response.text()) || `Request failed (${response.status})`);
    if (response.status === 204) return null as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : null) as T;
  };

  const handleDeleteContact = async (kontakt: Kontakt) => {
    try {
      const encodedId = encodeURIComponent(kontakt.id);
      const [smData, aktData] = await Promise.all([
        requestJson<Array<{ id: string }>>(`/salgsmuligheter?select=id&kontakt_id=eq.${encodedId}&limit=1`, { method: "GET" }),
        requestJson<Array<{ id: string }>>(`/aktiviteter?select=id&kontakt_id=eq.${encodedId}&limit=1`, { method: "GET" }),
      ]);
      const relations: string[] = [];
      if (smData?.length > 0) relations.push("Salgsmuligheter");
      if (aktData?.length > 0) relations.push("Aktiviteter");
      setDeleteTarget(kontakt);
      setDeleteRelations(relations);
      setExpandedContact(null);
      setDeleteDialogOpen(true);
    } catch (err) {
      console.error("Delete contact relation check error:", err);
      toast.error("Kunne ikke sjekke relasjoner for kontakten");
    }
  };

  const confirmDeleteContact = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const encodedId = encodeURIComponent(deleteTarget.id);
      await requestJson(`/salgsmuligheter?kontakt_id=eq.${encodedId}`, { method: "PATCH", body: JSON.stringify({ kontakt_id: null }) });
      await requestJson(`/aktiviteter?kontakt_id=eq.${encodedId}`, { method: "PATCH", body: JSON.stringify({ kontakt_id: null }) });
      await requestJson(`/kontakter?id=eq.${encodedId}`, { method: "DELETE" });
      updateSalgsmuligheter(prev => prev.map(s => s.kontakt_id === deleteTarget.id ? { ...s, kontakt_id: "" } : s));
      updateKontakter(prev => prev.filter(k => k.id !== deleteTarget.id));
      toast.success(`Kontakten «${deleteTarget.navn}» ble slettet`);
    } catch (err) {
      console.error("Delete contact error:", err);
      toast.error("Kunne ikke slette kontakten");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  if (!selskap) {
    return (
      <div className={`${isMobile ? "ml-0" : "ml-60"} min-h-screen bg-background flex items-center justify-center`}>
        <div className="text-center">
          <p className="text-muted-foreground">Selskap ikke funnet</p>
          <Button variant="ghost" className="mt-2" onClick={() => navigate("/selskaper")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Tilbake
          </Button>
        </div>
      </div>
    );
  }

  const selskapKontakter = kontakter.filter(k => k.selskap_id === id);
  const selskapSm = salgsmuligheter.filter(s => s.selskap_id === id);
  const selskapProsjekter = prosjekter.filter(p => p.selskap_id === id);
  const hovedProsjekt = selskapProsjekter[0];
  const hovedkontakt = selskapKontakter[0];

  const totalKontraktsverdi = selskapSm.reduce((sum, s) => sum + beregnTotalKontraktsverdi(s), 0);
  const kontraktslengde = selskapSm.find(s => s.kontraktslengde_mnd)?.kontraktslengde_mnd || 0;

  const today = iDag();
  const updateField = (field: string, value: unknown) => {
    updateSelskaper(prev => prev.map(s => s.id === id ? { ...s, [field]: value, sist_aktivitet: today } : s));
  };

  const endreProsjekt = (prosjektId: string, patch: Partial<Prosjekt>) => {
    updateProsjekter(prev => prev.map(p => p.id === prosjektId ? { ...p, ...patch } : p));
  };

  const nesteStegTilOppgave = () => {
    if (!selskap.neste_steg.trim()) { toast.error("Ingen neste steg å gjøre om til oppgave"); return; }
    const ny: Oppgave = {
      id: generateId("O", oppgaver),
      oppgave: selskap.neste_steg.trim(),
      lead_id: "", selskap_id: id!, salgsmulighet_id: "", kontakt_id: "",
      ansvarlig: "", frist: today, prioritet: "Medium", status: "Åpen", paaminnelse: true, notater: "",
    };
    updateOppgaver(prev => [...prev, ny]);
    toast.success("Neste steg lagt til som oppgave");
  };

  const kontaktMaal = { selskap_id: id!, kontakt_id: hovedkontakt?.id };

  return (
    <>
      <div className={`${isMobile ? "ml-0" : "ml-60"} min-h-screen bg-background transition-all duration-200`}>
        <header className={`sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b ${isMobile ? "px-4 py-4 pl-14" : "px-8 py-5"}`}>
          <div className="flex items-center gap-3 mb-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/selskaper")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Kundeforhold
            </Button>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <CompanyLogo domain={selskap.domene} firmanavn={selskap.firmanavn} kontaktEmails={selskapKontakter.map(k => k.e_post)} size={isMobile ? "md" : "lg"} />
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{selskap.firmanavn}</h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap text-sm text-muted-foreground">
                  {selskap.orgnr && <span className="tabular-nums">Org.nr {selskap.orgnr}</span>}
                  {pakkenavn && <span>· {pakkenavn}</span>}
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge className={kundestatusFarge[selskap.kundestatus]}>{selskap.kundestatus}</Badge>
                  <Badge className={tilstandFarge[selskap.kundetilstand]}>{selskap.kundetilstand}</Badge>
                  {selskap.partner_id && (() => {
                    const p = partnere.find(pp => pp.id === selskap.partner_id);
                    return p ? (
                      <Badge variant="outline" className="text-[10px] border-primary/30 text-primary cursor-pointer" onClick={() => navigate(`/partnere/${p.id}`)}>
                        Kunde hos {p.partnernavn}
                      </Badge>
                    ) : null;
                  })()}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-3">
              <div className="flex gap-4 text-right">
                <div>
                  <div className="font-display text-lg font-semibold tabular-nums">{nok(selskap.mrr)}</div>
                  <div className="text-[11px] text-muted-foreground">MRR</div>
                </div>
                <div>
                  <div className="font-display text-lg font-semibold tabular-nums">{nok(selskap.arr)}</div>
                  <div className="text-[11px] text-muted-foreground">ARR</div>
                </div>
                <div>
                  <div className="font-display text-lg font-semibold tabular-nums">{selskap.go_live_dato || "–"}</div>
                  <div className="text-[11px] text-muted-foreground">Go-live</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                <LogActivityButton target={kontaktMaal} entityName={selskap.firmanavn} size="sm" variant="outline" label="Ring" />
                <Button size="sm" variant="outline" className="h-8 text-xs" disabled={!hovedkontakt?.e_post}
                  onClick={() => { if (hovedkontakt) { setEmailContact(hovedkontakt); setEmailDialogOpen(true); } }}>
                  <Mail className="w-3.5 h-3.5 mr-1" />E-post
                </Button>
                <LogActivityButton target={kontaktMaal} entityName={selskap.firmanavn} size="sm" variant="outline" label="Møte" />
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => navigate(`/selskaper/${id}?tab=dokumenter`)}>
                  <FileText className="w-3.5 h-3.5 mr-1" />Kontrakt
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className={`${isMobile ? "p-4" : "p-8"}`}>
          <Tabs defaultValue="oversikt" className="space-y-6">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="oversikt">Oversikt</TabsTrigger>
              <TabsTrigger value="aktivitet">Aktivitet</TabsTrigger>
              <TabsTrigger value="prosjekt">Prosjekt</TabsTrigger>
              <TabsTrigger value="dokumenter">Dokumenter</TabsTrigger>
              <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
            </TabsList>

            {/* OVERSIKT */}
            <TabsContent value="oversikt" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-card border rounded-xl p-4 sm:p-5 space-y-4">
                    <h2 className="font-semibold text-base">Kundeforhold</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground block text-xs mb-1">Kundeansvarlig</span>
                        <Input value={selskap.kundeansvarlig} onChange={e => updateField("kundeansvarlig", e.target.value)} className="h-8 text-sm" />
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs mb-1">Kundestatus</span>
                        <select className="w-full border rounded-lg px-3 py-1.5 text-sm bg-background h-8"
                          value={selskap.kundestatus} onChange={e => {
                            const val = e.target.value as Kundestatus;
                            updateField("kundestatus", val);
                            if (val === "Live") updateField("live_status", true);
                            else if (val !== "Pilot") updateField("live_status", false);
                          }}>
                          {kundestatuser.map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs mb-1">Kundetilstand</span>
                        <select className="w-full border rounded-lg px-3 py-1.5 text-sm bg-background h-8"
                          value={selskap.kundetilstand} onChange={e => updateField("kundetilstand", e.target.value)}>
                          {kundetilstander.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs mb-1">Onboarding</span>
                        <select className="w-full border rounded-lg px-3 py-1.5 text-sm bg-background h-8" value={selskap.onboarding_status}
                          onChange={e => updateField("onboarding_status", e.target.value)}>
                          {onboardingStatuser.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs mb-1">Pakke</span>
                        <p className="text-sm py-1.5">{pakkenavn || "Ingen pakke"}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs">Oppstart betalt</span>
                        <Switch checked={!!hovedProsjekt?.oppstart_betalt}
                          onCheckedChange={v => hovedProsjekt && endreProsjekt(hovedProsjekt.id, { oppstart_betalt: v })} />
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs mb-1">Kontraktslengde</span>
                        <p className="text-sm py-1.5 tabular-nums">{kontraktslengde ? `${kontraktslengde} mnd` : "–"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs mb-1">Sist aktivitet</span>
                        <p className="text-sm py-1.5">{relativTid(selskap.sist_aktivitet)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs mb-1">MRR</span>
                        <Input type="number" value={selskap.mrr || ""} onChange={e => {
                          const mrr = Number(e.target.value);
                          updateSelskaper(prev => prev.map(s => s.id === id ? { ...s, mrr, arr: mrr * 12, sist_aktivitet: today } : s));
                        }} className="h-8 text-sm tabular-nums" />
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs mb-1">Go-live dato</span>
                        <Input type="date" value={selskap.go_live_dato} onChange={e => updateField("go_live_dato", e.target.value)} className="h-8 text-sm" />
                      </div>
                    </div>

                    <div className="border-t pt-3">
                      <span className="text-muted-foreground block text-xs mb-1">Neste steg</span>
                      <div className="flex gap-2">
                        <Input value={selskap.neste_steg} onChange={e => updateField("neste_steg", e.target.value)} className="h-8 text-sm" />
                        <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" onClick={nesteStegTilOppgave}>
                          <ListPlus className="w-3.5 h-3.5 mr-1" />Gjør til oppgave
                        </Button>
                      </div>
                    </div>

                    <div>
                      <span className="text-muted-foreground block text-xs mb-1">Notater</span>
                      <Textarea value={selskap.notater} onChange={e => updateField("notater", e.target.value)} rows={3} />
                    </div>
                  </div>

                  <div className="bg-card border rounded-xl p-4 sm:p-5 space-y-3">
                    <h2 className="font-semibold text-base">Selskapsinfo</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground block text-xs mb-1">Firmanavn</span>
                        <Input value={selskap.firmanavn} onChange={e => updateField("firmanavn", e.target.value)} className="h-8 text-sm" />
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs mb-1">Bransje</span>
                        <Input value={selskap.bransje} onChange={e => updateField("bransje", e.target.value)} className="h-8 text-sm" />
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs mb-1">Domene</span>
                        <Input value={selskap.domene} onChange={e => updateField("domene", e.target.value)} className="h-8 text-sm" />
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs mb-1">Org.nr</span>
                        <Input value={selskap.orgnr} onChange={e => updateField("orgnr", e.target.value)} className="h-8 text-sm tabular-nums" />
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs mb-1">Firmaadresse</span>
                        <Input value={selskap.firmaadresse || ""} onChange={e => updateField("firmaadresse", e.target.value)} className="h-8 text-sm" />
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs mb-1">Postadresse</span>
                        <Input value={selskap.postadresse || ""} onChange={e => updateField("postadresse", e.target.value)} className="h-8 text-sm" />
                      </div>
                    </div>
                    <SelskapInnsikt
                      domene={selskap.domene}
                      firmanavn={selskap.firmanavn}
                      e_post={hovedkontakt?.e_post}
                      onEnriched={(innsikt) => {
                        const patch: Record<string, string> = {};
                        if (innsikt.bransje && !selskap.bransje) patch.bransje = innsikt.bransje;
                        if (innsikt.orgnr && !selskap.orgnr) patch.orgnr = innsikt.orgnr;
                        if (innsikt.firmaadresse && !selskap.firmaadresse) patch.firmaadresse = innsikt.firmaadresse;
                        if (innsikt.postadresse && !selskap.postadresse) patch.postadresse = innsikt.postadresse;
                        if (Object.keys(patch).length) {
                          updateSelskaper(prev => prev.map(s => s.id === selskap.id ? { ...s, ...patch } : s));
                          toast.success("Selskapsfelt oppdatert fra berikelsesdata");
                        }
                      }}
                    />
                  </div>

                  {selskapSm.length > 0 && (
                    <div className="bg-card border rounded-xl p-4 sm:p-5 space-y-3">
                      <h2 className="font-semibold text-base">Salgsmuligheter ({selskapSm.length})</h2>
                      <div className="space-y-2">
                        {selskapSm.map(sm => (
                          <Link to="/salgsmuligheter" key={sm.id} className="block p-3 bg-muted/50 rounded-lg hover:bg-muted/80 transition-colors">
                            <div className="flex items-center justify-between mb-1">
                              <p className="font-medium text-sm truncate">{sm.navn}</p>
                              <Badge className={`text-[10px] shrink-0 ${smStatusColors[sm.status]}`}>{sm.status}</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
                              <span>MRR: {nok(sm.forventet_mrr)}</span>
                              <span>Total: {nok(beregnTotalKontraktsverdi(sm))}</span>
                              <span>Vektet: {nok(beregnVektetPipeline(sm))}</span>
                              <span>Kontrakt: {nok(totalKontraktsverdi)}</span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="bg-card border rounded-xl p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold text-base flex items-center gap-2">
                        <Users className="w-4 h-4" /> Kontakter ({selskapKontakter.length})
                      </h2>
                      <Button variant="ghost" size="sm" onClick={() => setShowAddContact(!showAddContact)}>
                        {showAddContact ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </Button>
                    </div>

                    {showAddContact && (
                      <div className="p-3 border border-dashed rounded-lg space-y-2">
                        <Input placeholder="Navn" value={contactForm.navn} onChange={e => setContactForm(f => ({ ...f, navn: e.target.value }))} className="h-8 text-sm" />
                        <Input placeholder="Rolle" value={contactForm.rolle} onChange={e => setContactForm(f => ({ ...f, rolle: e.target.value }))} className="h-8 text-sm" />
                        <Input placeholder="E-post" value={contactForm.e_post} onChange={e => setContactForm(f => ({ ...f, e_post: e.target.value }))} className="h-8 text-sm" />
                        <Input placeholder="Telefon" value={contactForm.telefon} onChange={e => setContactForm(f => ({ ...f, telefon: e.target.value }))} className="h-8 text-sm" />
                        <Input placeholder="LinkedIn URL" value={contactForm.linkedin} onChange={e => setContactForm(f => ({ ...f, linkedin: e.target.value }))} className="h-8 text-sm" />
                        <Button size="sm" className="w-full" disabled={!contactForm.navn} onClick={() => {
                          const nyKontakt: Kontakt = {
                            id: generateId("K", kontakter), selskap_id: id!, navn: contactForm.navn,
                            rolle: contactForm.rolle, e_post: contactForm.e_post,
                            telefon: contactForm.telefon, linkedin: contactForm.linkedin, notater: "",
                          };
                          updateKontakter(prev => [...prev, nyKontakt]);
                          setContactForm({ navn: "", rolle: "", e_post: "", telefon: "", linkedin: "" });
                          setShowAddContact(false);
                        }}>Legg til kontakt</Button>
                      </div>
                    )}

                    {selskapKontakter.length === 0 && !showAddContact ? (
                      <p className="text-xs text-muted-foreground">Ingen kontakter registrert</p>
                    ) : (
                      <div className="space-y-3">
                        {selskapKontakter.map(k => {
                          const isExpanded = expandedContact === k.id;
                          return (
                            <div key={k.id} className="p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted/80 transition-colors"
                              onClick={() => setExpandedContact(isExpanded ? null : k.id)}>
                              <div className="flex items-center justify-between">
                                <div className="min-w-0">
                                  <p className="font-medium text-sm">{k.navn}</p>
                                  {k.rolle && <p className="text-xs text-muted-foreground">{k.rolle}</p>}
                                </div>
                                <ChevronRight className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                              </div>
                              {!isExpanded && (
                                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap mt-1">
                                  {k.e_post && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /><span className="truncate">{k.e_post}</span></span>}
                                  {k.telefon && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{k.telefon}</span>}
                                  {k.linkedin && <span className="flex items-center gap-1"><Linkedin className="w-3 h-3" />LinkedIn</span>}
                                </div>
                              )}
                              {isExpanded && (
                                <div className="mt-3 space-y-2 border-t pt-3" onClick={e => e.stopPropagation()}>
                                  <Input value={k.navn} onChange={e => updateKontakter(prev => prev.map(c => c.id === k.id ? { ...c, navn: e.target.value } : c))} className="h-8 text-sm" placeholder="Navn" />
                                  <Input value={k.rolle || ""} onChange={e => updateKontakter(prev => prev.map(c => c.id === k.id ? { ...c, rolle: e.target.value } : c))} className="h-8 text-sm" placeholder="Rolle" />
                                  <Input value={k.e_post || ""} onChange={e => updateKontakter(prev => prev.map(c => c.id === k.id ? { ...c, e_post: e.target.value } : c))} className="h-8 text-sm" placeholder="E-post" />
                                  <Input value={k.telefon || ""} onChange={e => updateKontakter(prev => prev.map(c => c.id === k.id ? { ...c, telefon: e.target.value } : c))} className="h-8 text-sm" placeholder="Telefon" />
                                  <Input value={k.linkedin || ""} onChange={e => updateKontakter(prev => prev.map(c => c.id === k.id ? { ...c, linkedin: e.target.value } : c))} className="h-8 text-sm" placeholder="LinkedIn URL" />
                                  <div className="flex gap-2 mt-2">
                                    {k.e_post && (
                                      <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => { setEmailContact(k); setEmailDialogOpen(true); }}>
                                        <Send className="w-3.5 h-3.5 mr-1" /> Send e-post
                                      </Button>
                                    )}
                                    <Button variant="ghost" size="sm" className="flex-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => handleDeleteContact(k)}>
                                      <Trash2 className="w-4 h-4 mr-1" /> Slett
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="bg-card border rounded-xl p-4 sm:p-5">
                    <h2 className="font-semibold text-base mb-3">Siste aktiviteter</h2>
                    <ActivityLog selskap_id={id!} />
                  </div>

                  <div className="bg-card border rounded-xl p-4 sm:p-5">
                    <InlineTaskForm selskap_id={id!} />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* AKTIVITET */}
            <TabsContent value="aktivitet" className="space-y-6">
              <div className="bg-card border rounded-xl p-4 sm:p-5 space-y-4">
                <LogActivityButton target={kontaktMaal} entityName={selskap.firmanavn} showQuickActions size="sm"
                  kontaktListe={selskapKontakter.map(k => ({ id: k.id, navn: k.navn }))}
                  onLogged={() => updateField("sist_aktivitet", iDag())} />
                <ActivityLog selskap_id={id!} onActivityLogged={() => updateField("sist_aktivitet", iDag())} />
                <EntityChangelog entity_type="selskap" entity_id={id!} />
              </div>
              <PersonTimeline selskap_id={id!} maks={12} tittel="Relasjonstidslinje" onSeAlt={() => navigate("/kontakter")} />
            </TabsContent>

            {/* PROSJEKT */}
            <TabsContent value="prosjekt" className="space-y-6">
              {selskapProsjekter.length === 0 ? (
                <div className="bg-card border rounded-xl p-8 text-center space-y-3">
                  <Rocket className="w-8 h-8 mx-auto text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Ingen prosjekter ennå for denne kunden.</p>
                  <Button size="sm" onClick={() => setNyttProsjektOpen(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1" />Opprett prosjekt
                  </Button>
                </div>
              ) : (
                selskapProsjekter.map(p => (
                  <div key={p.id} className="bg-card border rounded-xl p-4 sm:p-5 space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h2 className="font-semibold text-base">{p.prosjektnavn}</h2>
                        <p className="text-xs text-muted-foreground">Ansvarlig: {p.ansvarlig || "–"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`text-[10px] ${prosjektStatusFarge[p.status] || "bg-muted text-muted-foreground"}`}>{p.status}</Badge>
                        <select className="border rounded-md px-2 py-1.5 text-sm bg-background h-8"
                          value={p.status}
                          onChange={e => {
                            const ny = e.target.value as Prosjekt["status"];
                            if (ny === "Live") settProsjektLive(p.id);
                            else endreProsjekt(p.id, { status: ny });
                          }}>
                          {PROSJEKT_STATUSER.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>

                    <ProsjektFremdrift
                      onboardingType={p.onboarding_type}
                      fullforteSteg={p.onboarding_steg}
                      onEndreType={(t: OnboardingType) => endreProsjekt(p.id, { onboarding_type: t, onboarding_steg: [] })}
                      onEndreSteg={steg => endreProsjekt(p.id, { onboarding_steg: steg })}
                    />

                    {harTimeregistrering(p.onboarding_type) && (
                      <div className="border-t pt-5">
                        <Timeregistrering prosjektId={p.id} selskapId={id!} firmanavn={selskap.firmanavn} timepris={p.timepris} />
                      </div>
                    )}
                  </div>
                ))
              )}
            </TabsContent>

            {/* DOKUMENTER */}
            <TabsContent value="dokumenter">
              <div className="bg-card border rounded-xl p-4 sm:p-5">
                <CompanyDocuments selskapId={id!} />
              </div>
            </TabsContent>

            {/* ONBOARDING */}
            <TabsContent value="onboarding">
              <div className="bg-card border rounded-xl p-4 sm:p-5">
                {hovedProsjekt ? (
                  <OnboardingAnswers prosjektId={hovedProsjekt.id} />
                ) : (
                  <p className="text-sm text-muted-foreground">Ingen onboarding-svar ennå — opprett et prosjekt først.</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>

      <OpprettProsjektDialog
        open={nyttProsjektOpen}
        onOpenChange={setNyttProsjektOpen}
        selskapId={id!}
        firmanavn={selskap.firmanavn}
        salgsmulighetId={selskapSm[0]?.id}
      />

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Slett kontakt</DialogTitle>
            <DialogDescription>
              Er du sikker på at du vil slette kontakten «{deleteTarget?.navn}»?
              {deleteRelations.length > 0 && (
                <span className="block mt-2 text-warning">
                  Denne kontakten er koblet til: {deleteRelations.join(", ")}. Koblingene vil bli fjernet.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>Avbryt</Button>
            <Button variant="destructive" onClick={confirmDeleteContact} disabled={deleting}>
              {deleting ? "Sletter…" : "Slett"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {emailContact && (
        <SendEmailDialog
          open={emailDialogOpen}
          onOpenChange={setEmailDialogOpen}
          defaultTo={emailContact.e_post}
          defaultSubject={`Hei ${emailContact.navn.split(" ")[0]} – ${selskap.firmanavn}`}
          context={{
            entityType: "lead",
            entityId: emailContact.id,
            selskapNavn: selskap.firmanavn,
            kontaktperson: emailContact.navn,
            kontaktId: emailContact.id,
            selskapId: selskap.id,
          }}
        />
      )}
    </>
  );
}
