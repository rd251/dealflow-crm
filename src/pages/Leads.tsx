import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import DetailPanelShell, { DetailSection, DetailField, DetailDivider } from "@/components/DetailPanelShell";
import { Plus, Search, ArrowRightCircle, Trash2, Users2, Upload, Lock } from "lucide-react";
import { Lead, LeadStatus, LeadKilde } from "@/data/crm-data";
import { Badge } from "@/components/ui/badge";
import InlineTaskForm from "@/components/InlineTaskForm";
import ActivityLog from "@/components/ActivityLog";
import LastActivityBadge from "@/components/LastActivityBadge";
import DataImportDialog from "@/components/DataImportDialog";

// Only user-selectable statuses – no conversion statuses in dropdown
const statusOptions: LeadStatus[] = ["Ny", "Kontaktet", "Kvalifisert", "Ikke aktuelt"];
const kildeOptions: LeadKilde[] = ["Nettside", "LinkedIn", "Partner", "Referanse", "Kald outbound", "E-post", "Telefon", "Annet"];

const statusColors: Record<string, string> = {
  "Ny": "bg-stage-new-lead/10 text-stage-new-lead",
  "Kontaktet": "bg-stage-contacted/10 text-stage-contacted",
  "Kvalifisert": "bg-stage-qualified/10 text-stage-qualified",
  "Ikke aktuelt": "bg-muted text-muted-foreground",
  "Konvertert til salg": "bg-success/10 text-success",
  "Konvertert til partner": "bg-primary/10 text-primary",
};

export default function Leads() {
  const isMobile = useIsMobile();
  const { canEdit } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { leads, updateLeads, konverterLead, konverterTilPartner, generateId } = useCrmStore();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [form, setForm] = useState<Partial<Lead>>({ firmanavn: "", kontaktperson: "", e_post: "", telefon: "", kilde: "Nettside", status: "Ny", ansvarlig: "", neste_steg: "", notater: "", rolle_i_firma: "", use_case: "" });
  const [filterUtenOppfolging, setFilterUtenOppfolging] = useState(false);

  // Pick up filter from query param
  useEffect(() => {
    if (searchParams.get("filter") === "uten-oppfolging") {
      setFilterUtenOppfolging(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  const now = new Date();

  // Helper: is a lead converted (locked)?
  const isConverted = (l: Lead) => !!l.konvertert_til;

  const filtered = leads.filter(l => {
    // Hide converted leads from the active list
    if (isConverted(l)) return false;
    if (filterUtenOppfolging) {
      const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      if (l.status === "Ikke aktuelt") return false;
      if (l.sist_aktivitet && new Date(l.sist_aktivitet) >= cutoff) return false;
    }
    return (
      l.firmanavn.toLowerCase().includes(search.toLowerCase()) ||
      l.kontaktperson.toLowerCase().includes(search.toLowerCase())
    );
  });

  const addLead = () => {
    const today = new Date().toISOString().split("T")[0];
    const id = generateId("L", leads);
    const newLead: Lead = {
      id, firmanavn: form.firmanavn || "", kontaktperson: form.kontaktperson || "",
      e_post: form.e_post || "", telefon: form.telefon || "", kilde: form.kilde as LeadKilde || "Annet",
      status: "Ny", ansvarlig: form.ansvarlig || "", neste_steg: form.neste_steg || "",
      notater: form.notater || "", opprettet_dato: today, sist_aktivitet: today, konvertert_dato: "",
      konvertert_til: "",
      rolle_i_firma: form.rolle_i_firma || "", use_case: form.use_case || "",
    };
    updateLeads(prev => [...prev, newLead]);
    setDialogOpen(false);
    setForm({ firmanavn: "", kontaktperson: "", e_post: "", telefon: "", kilde: "Nettside", status: "Ny", ansvarlig: "", neste_steg: "", notater: "", rolle_i_firma: "", use_case: "" });
  };

  const changeStatus = (id: string, status: LeadStatus) => {
    updateLeads(prev => prev.map(l => l.id === id ? { ...l, status, sist_aktivitet: new Date().toISOString().split("T")[0] } : l));
  };

  const currentLead = selectedLead ? leads.find(l => l.id === selectedLead.id) || selectedLead : null;
  const currentIsLocked = currentLead ? isConverted(currentLead) : false;

  const conversionBadge = (lead: Lead) => {
    if (!lead.konvertert_til) return null;
    const isSalg = lead.konvertert_til === "salg";
    return (
      <Badge className={`text-[10px] gap-0.5 ${isSalg ? "bg-success/10 text-success" : "bg-primary/10 text-primary"}`}>
        <Lock className="w-3 h-3" />
        {isSalg ? "→ Salg" : "→ Partner"}
      </Badge>
    );
  };

  return (
    <PageShell
      title="Leads"
      subtitle={`${leads.filter(l => !isConverted(l) && l.status !== "Ikke aktuelt").length} aktive leads`}
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
      <div className="mb-4 flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Søk leads..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {filterUtenOppfolging && (
          <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-destructive/10" onClick={() => setFilterUtenOppfolging(false)}>
            Uten oppfølging ✕
          </Badge>
        )}
      </div>

      {/* Mobile: card layout */}
      {isMobile ? (
        <div className="space-y-3">
          {filtered.map(lead => {
            const locked = isConverted(lead);
            return (
              <div key={lead.id} className={`bg-card border rounded-xl p-4 space-y-2 ${locked ? "opacity-80" : ""}`} onClick={() => setSelectedLead(lead)}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-sm truncate">{lead.firmanavn}</p>
                  <div className="flex items-center gap-1 shrink-0">
                    {conversionBadge(lead)}
                    <Badge className={`text-[10px] ${statusColors[lead.status] || ""}`}>{lead.status}</Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{lead.kontaktperson}</p>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-[10px]">{lead.kilde}</Badge>
                  {lead.neste_steg && <span className="text-[10px] text-muted-foreground truncate ml-2">→ {lead.neste_steg}</span>}
                </div>
                {!locked && lead.status !== "Ikke aktuelt" && (
                  <div className="flex gap-1 mt-1">
                    <Button size="sm" variant="ghost" className="text-xs gap-1 flex-1" onClick={e => { e.stopPropagation(); konverterLead(lead.id); }}>
                      <ArrowRightCircle className="w-3.5 h-3.5" />Salg
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs gap-1 flex-1" onClick={e => { e.stopPropagation(); konverterTilPartner(lead.id); }}>
                      <Users2 className="w-3.5 h-3.5" />Partner
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Ingen leads å vise</p>}
        </div>
      ) : (
        /* Desktop: table layout */
        <div className="bg-card border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium">Firma</th>
                <th className="text-left px-4 py-3 font-medium">Kontaktperson</th>
                <th className="text-left px-4 py-3 font-medium">Kilde</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Neste steg</th>
                <th className="text-left px-4 py-3 font-medium">Sist aktivitet</th>
                <th className="text-left px-4 py-3 font-medium">Opprettet</th>
                <th className="text-right px-4 py-3 font-medium">Handling</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(lead => {
                const locked = isConverted(lead);
                return (
                  <tr key={lead.id} className={`border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer ${locked ? "opacity-70" : ""}`} onClick={() => setSelectedLead(lead)}>
                    <td className="px-4 py-3 font-medium">{lead.firmanavn}</td>
                    <td className="px-4 py-3 text-muted-foreground">{lead.kontaktperson}</td>
                    <td className="px-4 py-3"><Badge variant="secondary" className="text-xs">{lead.kilde}</Badge></td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        {locked ? (
                          conversionBadge(lead)
                        ) : (
                          <select
                            className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${statusColors[lead.status] || ""}`}
                            value={lead.status}
                            onChange={e => changeStatus(lead.id, e.target.value as LeadStatus)}
                          >
                            {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{lead.neste_steg}</td>
                    <td className="px-4 py-3"><LastActivityBadge lead_id={lead.id} sist_aktivitet={lead.sist_aktivitet} /></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{lead.opprettet_dato}</td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      {!locked && lead.status !== "Ikke aktuelt" && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="text-xs gap-1" onClick={() => konverterLead(lead.id)}>
                            <ArrowRightCircle className="w-3.5 h-3.5" />Salg
                          </Button>
                          <Button size="sm" variant="ghost" className="text-xs gap-1" onClick={() => konverterTilPartner(lead.id)}>
                            <Users2 className="w-3.5 h-3.5" />Partner
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <DetailPanelShell
        open={!!currentLead}
        onClose={() => setSelectedLead(null)}
        title={currentLead?.firmanavn || ""}
        subtitle={currentLead?.kontaktperson || undefined}
        badges={currentLead ? (
          <>
            <Badge className={`text-xs ${statusColors[currentLead.status] || ""}`}>{currentLead.status}</Badge>
            {currentLead.konvertert_til && (
              <Badge className={`text-xs gap-0.5 ${currentLead.konvertert_til === "salg" ? "bg-success/10 text-success" : "bg-primary/10 text-primary"}`}>
                <Lock className="w-3 h-3" />
                {currentLead.konvertert_til === "salg" ? "Konvertert → Salg" : "Konvertert → Partner"}
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">{currentLead.kilde}</Badge>
          </>
        ) : undefined}
        actions={canEdit && currentLead && !currentIsLocked && currentLead.status !== "Ikke aktuelt" ? (
          <>
            <Button size="sm" onClick={() => { konverterLead(currentLead.id); setSelectedLead(null); }}>
              <ArrowRightCircle className="w-4 h-4 mr-1.5" />Til salg
            </Button>
            <Button size="sm" variant="secondary" onClick={() => { konverterTilPartner(currentLead.id); setSelectedLead(null); }}>
              <Users2 className="w-4 h-4 mr-1.5" />Til partner
            </Button>
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
          return {
            detaljer: (
              <div className="space-y-3">
                {/* Neste steg – prominent at top */}
                <div className={`rounded-lg border p-3 ${!currentLead.neste_steg ? "border-warning bg-warning/5" : "bg-muted/30"}`}>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Neste steg</label>
                  <Input value={currentLead.neste_steg} onChange={e => updateField("neste_steg", e.target.value)} className="h-7 text-xs mt-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" placeholder="Hva er neste steg?" readOnly={!canEdit || currentIsLocked} />
                  {!currentLead.neste_steg && <p className="text-[10px] text-warning mt-0.5">⚠ Mangler neste steg</p>}
                </div>

                {/* Compact key info */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-xs"><span className="text-muted-foreground">Kilde</span>
                    <select className="w-full border rounded px-2 py-1 text-xs bg-background h-7 mt-0.5" value={currentLead.kilde}
                      onChange={e => updateField("kilde", e.target.value)} disabled={!canEdit || currentIsLocked}>
                      {kildeOptions.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                  <div className="text-xs"><span className="text-muted-foreground">Status</span>
                    <select className={`w-full border rounded px-2 py-1 text-xs bg-background h-7 mt-0.5 ${statusColors[currentLead.status] || ""}`}
                      value={currentLead.status} onChange={e => updateField("status", e.target.value)} disabled={!canEdit || currentIsLocked}>
                      {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="text-xs"><span className="text-muted-foreground">Ansvarlig</span>
                    <Input value={currentLead.ansvarlig} onChange={e => updateField("ansvarlig", e.target.value)} className="h-7 text-xs mt-0.5" readOnly={!canEdit || currentIsLocked} />
                  </div>
                  <div className="text-xs"><span className="text-muted-foreground">Opprettet</span>
                    <div className="h-7 flex items-center text-xs text-muted-foreground mt-0.5">{currentLead.opprettet_dato || "–"}</div>
                  </div>
                </div>

                <div className="border-t" />

                {/* Contact info – compact */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-xs"><span className="text-muted-foreground">Firmanavn</span>
                    <Input value={currentLead.firmanavn} onChange={e => updateField("firmanavn", e.target.value)} className="h-7 text-xs mt-0.5" readOnly={!canEdit || currentIsLocked} />
                  </div>
                  <div className="text-xs"><span className="text-muted-foreground">Kontaktperson</span>
                    <Input value={currentLead.kontaktperson} onChange={e => updateField("kontaktperson", e.target.value)} className="h-7 text-xs mt-0.5" readOnly={!canEdit || currentIsLocked} />
                  </div>
                  <div className="text-xs"><span className="text-muted-foreground">E-post</span>
                    <Input value={currentLead.e_post} onChange={e => updateField("e_post", e.target.value)} className="h-7 text-xs mt-0.5" readOnly={!canEdit || currentIsLocked} />
                  </div>
                  <div className="text-xs"><span className="text-muted-foreground">Telefon</span>
                    <Input value={currentLead.telefon} onChange={e => updateField("telefon", e.target.value)} className="h-7 text-xs mt-0.5" readOnly={!canEdit || currentIsLocked} />
                  </div>
                </div>

                {/* Use case */}
                <div className="text-xs"><span className="text-muted-foreground">Use case</span>
                  <Input value={currentLead.use_case} onChange={e => updateField("use_case", e.target.value)} className="h-7 text-xs mt-0.5" readOnly={!canEdit || currentIsLocked} />
                </div>

                {currentLead.konvertert_til && (
                  <div className={`p-2.5 rounded-lg text-xs font-medium flex items-center gap-2 ${currentLead.konvertert_til === "salg" ? "bg-success/10 text-success" : "bg-primary/10 text-primary"}`}>
                    <Lock className="w-3.5 h-3.5" />
                    Konvertert til {currentLead.konvertert_til === "salg" ? "salgsmulighet" : "partner"} · {currentLead.konvertert_dato}
                  </div>
                )}

                {canEdit && !currentIsLocked && (
                  <Button size="sm" variant="ghost" className="w-full text-xs text-destructive hover:text-destructive h-8" onClick={() => {
                    updateLeads(prev => prev.filter(l => l.id !== currentLead.id));
                    setSelectedLead(null);
                  }}>
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Slett lead
                  </Button>
                )}
              </div>
            ),
            interaksjoner: (
              <>
                <InlineTaskForm lead_id={currentLead.id} selskap_id="" />
                <ActivityLog lead_id={currentLead.id} onActivityLogged={() => {
                  updateLeads(prev => prev.map(l => l.id === currentLead.id ? { ...l, sist_aktivitet: new Date().toISOString().split("T")[0] } : l));
                }} />
              </>
            ),
            notater: (
              <DetailField label="Notater">
                <Textarea value={currentLead.notater} onChange={e => updateField("notater", e.target.value)} rows={6} readOnly={!canEdit || currentIsLocked} />
              </DetailField>
            ),
          };
        })() : undefined}
      />
    </PageShell>
  );
}
