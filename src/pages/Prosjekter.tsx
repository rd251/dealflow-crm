import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageShell from "@/components/PageShell";
import CompanyLogo from "@/components/CompanyLogo";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import DetailPanelShell, { DetailSection, DetailField, DetailDivider, DetailStatGrid, DetailStatCard } from "@/components/DetailPanelShell";
import EntityCalendarTab from "@/components/EntityCalendarTab";
import { GripVertical, Rocket, Plus } from "lucide-react";
import InlineTaskForm from "@/components/InlineTaskForm";
import ActivityLog from "@/components/ActivityLog";
import { Prosjekt, ProsjektStatus, Integrasjon } from "@/data/crm-data";
import { toast } from "sonner";
import OnboardingAnswers from "@/components/OnboardingAnswers";

const statuses: ProsjektStatus[] = ["Ny", "Skjema mottatt", "I produksjon", "Test med kunde", "Live", "Blokkert"];

const statusColors: Record<ProsjektStatus, string> = {
  "Ny": "bg-stage-new-lead",
  "Skjema mottatt": "bg-blue-400",
  "I produksjon": "bg-stage-contacted",
  "Test med kunde": "bg-stage-demo",
  "Live": "bg-stage-won",
  "Blokkert": "bg-stage-lost",
};

export default function Prosjekter() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { prosjekter, selskaper, kontakter, updateProsjekter, settProsjektLive, generateId } = useCrmStore();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [selectedP, setSelectedP] = useState<Prosjekt | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState({ prosjektnavn: "", selskap_id: "", integrasjon: "Ingen" as Integrasjon });

  const getSelskap = (id: string) => selskaper.find(s => s.id === id);
  const getSelskapNavn = (id: string) => getSelskap(id)?.firmanavn || "–";

  const handleDrop = (e: React.DragEvent, status: ProsjektStatus) => {
    e.preventDefault();
    if (!draggedId) return;
    if (status === "Live") {
      settProsjektLive(draggedId);
    } else {
      updateProsjekter(prev => prev.map(p => p.id === draggedId ? { ...p, status } : p));
    }
    setDraggedId(null);
  };

  const currentP = selectedP ? prosjekter.find(p => p.id === selectedP.id) || selectedP : null;

  return (
    <PageShell title="Prosjekter" subtitle={`${prosjekter.length} prosjekter`}
      actions={
        <Button size="sm" onClick={() => { setForm({ prosjektnavn: "", selskap_id: selskaper[0]?.id || "", integrasjon: "Ingen" }); setNewOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" />{!isMobile && "Nytt prosjekt"}
        </Button>
      }
    >
      {prosjekter.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Rocket className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Ingen prosjekter ennå. Vinn en salgsmulighet for å starte et prosjekt.</p>
        </div>
      ) : (
        <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 scrollbar-thin">
          {statuses.map(status => {
            const items = prosjekter.filter(p => p.status === status);
            return (
              <div key={status} className={`${isMobile ? "min-w-[240px] w-[240px]" : "min-w-[280px] w-[280px]"} flex-shrink-0`}
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                onDrop={e => handleDrop(e, status)}>
                <div className="mb-3 flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${statusColors[status]}`} />
                  <h3 className="font-semibold text-xs sm:text-sm">{status}</h3>
                  <span className="text-xs text-muted-foreground ml-auto">{items.length}</span>
                </div>
                <div className="space-y-2.5">
                  {items.map(p => (
                    <div key={p.id} draggable
                      onDragStart={e => { setDraggedId(p.id); e.dataTransfer.effectAllowed = "move"; }}
                      onClick={() => setSelectedP(p)}
                      className="bg-card border rounded-lg p-3 sm:p-3.5 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group">
                      <div className="flex items-start gap-2">
                        {!isMobile && <GripVertical className="w-4 h-4 text-muted-foreground/40 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />}
                        <CompanyLogo domain={getSelskap(p.selskap_id)?.domene} firmanavn={getSelskapNavn(p.selskap_id)} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{p.prosjektnavn}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 cursor-pointer hover:text-primary hover:underline" onClick={e => { e.stopPropagation(); navigate(`/selskaper/${p.selskap_id}`); }}>{getSelskapNavn(p.selskap_id)}</p>
                          {p.forventet_go_live && <p className="text-[10px] text-muted-foreground mt-1">Go-live: {p.forventet_go_live}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="border-2 border-dashed rounded-lg p-6 text-center text-xs text-muted-foreground">Dra hit</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DetailPanelShell
        open={!!currentP}
        onClose={() => setSelectedP(null)}
        title={currentP?.prosjektnavn || ""}
        subtitle={currentP ? getSelskapNavn(currentP.selskap_id) : undefined}
        badges={currentP ? (
          <Badge variant="secondary" className="text-xs">{currentP.status}</Badge>
        ) : undefined}
        actions={currentP && currentP.status !== "Live" ? (
          <Button size="sm" className="bg-success hover:bg-success/90 text-success-foreground" onClick={() => { settProsjektLive(currentP.id); setSelectedP(null); }}>
            <Rocket className="w-3.5 h-3.5 mr-1.5" />Sett som Live
          </Button>
        ) : undefined}
        tabContent={currentP ? {
          detaljer: (
            <>
              <DetailSection title="Prosjektdetaljer">
                <DetailStatGrid>
                  <DetailField label="Selskap">
                    <span className="text-sm cursor-pointer hover:text-primary hover:underline" onClick={() => navigate(`/selskaper/${currentP.selskap_id}`)}>{getSelskapNavn(currentP.selskap_id)}</span>
                  </DetailField>
                  <DetailField label="Status" value={currentP.status} />
                  <DetailField label="Startdato" value={currentP.startdato || "–"} />
                  <DetailField label="Forventet go-live" value={currentP.forventet_go_live || "–"} />
                  <DetailField label="Go-live dato" value={currentP.go_live_dato || "–"} />
                  <DetailField label="Integrasjon" value={currentP.integrasjon} />
                </DetailStatGrid>
              </DetailSection>

              <DetailDivider />

              <DetailSection title="Økonomi">
                <DetailStatGrid>
                  <DetailStatCard label="Oppstart" value={`${currentP.oppstartskostnad.toLocaleString("no-NO")} kr`} />
                  <DetailStatCard label="Fakturert / Betalt" value={`${currentP.oppstart_fakturert ? "✓" : "✗"} / ${currentP.oppstart_betalt ? "✓" : "✗"}`} />
                </DetailStatGrid>
              </DetailSection>

              <DetailDivider />

              <DetailSection title="Onboarding-svar">
                <OnboardingAnswers prosjektId={currentP.id} />
              </DetailSection>
            </>
          ),
          interaksjoner: (
            <>
              <InlineTaskForm selskap_id={currentP.selskap_id} salgsmulighet_id={currentP.salgsmulighet_id} />
              <ActivityLog prosjekt_id={currentP.id} />
            </>
          ),
          kalender: (
            <EntityCalendarTab prosjekt_id={currentP.id} />
          ),
        } : undefined}
      />
      {/* Nytt prosjekt dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Opprett nytt prosjekt</DialogTitle>
            <DialogDescription>Velg selskap og fyll inn prosjektdetaljer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-xs"><span className="text-muted-foreground">Prosjektnavn</span>
              <Input value={form.prosjektnavn} onChange={e => setForm(f => ({ ...f, prosjektnavn: e.target.value }))} className="h-8 text-sm mt-0.5" placeholder="Prosjektnavn" />
            </div>
            <div className="text-xs"><span className="text-muted-foreground">Selskap</span>
              <select className="w-full border rounded px-2 py-1.5 text-sm bg-background mt-0.5"
                value={form.selskap_id} onChange={e => setForm(f => ({ ...f, selskap_id: e.target.value }))}>
                <option value="">Velg selskap...</option>
                {selskaper.map(s => <option key={s.id} value={s.id}>{s.firmanavn}</option>)}
              </select>
            </div>
            <div className="text-xs"><span className="text-muted-foreground">Integrasjon</span>
              <select className="w-full border rounded px-2 py-1.5 text-sm bg-background mt-0.5"
                value={form.integrasjon} onChange={e => setForm(f => ({ ...f, integrasjon: e.target.value as Integrasjon }))}>
                {(["Ingen", "GastroPlanner", "HubSpot", "Lime", "Salesforce", "API", "Annet"] as Integrasjon[]).map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setNewOpen(false)}>Avbryt</Button>
            <Button disabled={!form.prosjektnavn.trim() || !form.selskap_id} onClick={() => {
              const selskap = selskaper.find(s => s.id === form.selskap_id);
              const newP: Prosjekt = {
                id: generateId("p", prosjekter),
                prosjektnavn: form.prosjektnavn.trim(),
                selskap_id: form.selskap_id,
                salgsmulighet_id: "",
                ansvarlig: selskap?.kundeansvarlig || "",
                status: "Ny",
                startdato: new Date().toISOString().split("T")[0],
                forventet_go_live: "",
                go_live_dato: "",
                oppstartskostnad: 0,
                oppstart_fakturert: false,
                oppstart_faktura_dato: "",
                oppstart_betalt: false,
                integrasjon: form.integrasjon,
                notater: "",
              };
              updateProsjekter(prev => [...prev, newP]);
              setNewOpen(false);
              toast.success("Prosjekt opprettet");
            }}>
              <Rocket className="w-3.5 h-3.5 mr-1.5" />Opprett
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
