import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, Mail, Phone, Linkedin, Upload, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Kontakt, Selskap, Salgsmulighet } from "@/data/crm-data";
import DataImportDialog from "@/components/DataImportDialog";
import ActivityLog from "@/components/ActivityLog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";

function EditableField({ label, value, onChange, icon, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; icon?: React.ReactNode; type?: string; placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <div className="flex items-center gap-2">
        {icon}
        <Input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || label}
          className="h-8 text-sm"
        />
      </div>
    </div>
  );
}

function ContactDetailPanel({ kontakt, selskaper, salgsmuligheter, onUpdate, onNavigate, onDelete }: {
  kontakt: Kontakt;
  selskaper: Selskap[];
  salgsmuligheter: Salgsmulighet[];
  onUpdate: (field: keyof Kontakt, value: string) => void;
  onNavigate: (path: string) => void;
  onDelete: () => void;
}) {
  const getSelskapNavn = (id: string) => selskaper.find(s => s.id === id)?.firmanavn || "–";

  return (
    <div className="mt-6 space-y-4 text-sm">
      <EditableField label="E-post" value={kontakt.e_post} onChange={v => onUpdate("e_post", v)} icon={<Mail className="w-4 h-4 text-muted-foreground shrink-0" />} type="email" />
      <EditableField label="Telefon" value={kontakt.telefon} onChange={v => onUpdate("telefon", v)} icon={<Phone className="w-4 h-4 text-muted-foreground shrink-0" />} type="tel" />
      <EditableField label="LinkedIn" value={kontakt.linkedin} onChange={v => onUpdate("linkedin", v)} icon={<Linkedin className="w-4 h-4 text-muted-foreground shrink-0" />} placeholder="https://linkedin.com/in/..." />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <span className="text-muted-foreground text-xs">Selskap</span>
          <select
            className="w-full border rounded-md px-2 py-1.5 text-sm bg-background h-8"
            value={kontakt.selskap_id}
            onChange={e => onUpdate("selskap_id", e.target.value)}
          >
            <option value="">Ingen</option>
            {selskaper.map(s => <option key={s.id} value={s.id}>{s.firmanavn}</option>)}
          </select>
          {kontakt.selskap_id && (
            <span className="text-xs text-primary cursor-pointer hover:underline" onClick={() => onNavigate(`/selskaper/${kontakt.selskap_id}`)}>
              Gå til selskapsprofil →
            </span>
          )}
        </div>
        <EditableField label="Rolle" value={kontakt.rolle} onChange={v => onUpdate("rolle", v)} />
      </div>

      <div className="space-y-1">
        <span className="text-muted-foreground text-xs">Notater</span>
        <Textarea
          value={kontakt.notater}
          onChange={e => onUpdate("notater", e.target.value)}
          placeholder="Legg til notater..."
          className="text-sm min-h-[60px]"
        />
      </div>

      <Separator />

      {salgsmuligheter.length > 0 && (
        <div>
          <span className="text-muted-foreground block text-xs mb-2">Relaterte salgsmuligheter</span>
          <div className="space-y-1.5">
            {salgsmuligheter.map(d => (
              <div key={d.id} className="p-2 bg-muted/50 rounded-lg text-xs">
                <span className="font-medium">{d.navn}</span> · {d.status} · {d.forventet_mrr.toLocaleString("no-NO")} MRR
              </div>
            ))}
          </div>
        </div>
      )}

      <ActivityLog kontakt_id={kontakt.id} />

      <Separator />

      <Button variant="destructive" size="sm" className="w-full" onClick={onDelete}>
        <Trash2 className="w-4 h-4 mr-2" />Slett kontakt
      </Button>
    </div>
  );
}

export default function Contacts() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { kontakter, selskaper, salgsmuligheter, updateKontakter, updateSalgsmuligheter, generateId, refresh } = useCrmStore();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Kontakt | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState({ navn: "", selskap_id: "", rolle: "", e_post: "", telefon: "", linkedin: "", notater: "" });

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Kontakt | null>(null);
  const [deleteRelations, setDeleteRelations] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const filtered = kontakter.filter(k =>
    k.navn.toLowerCase().includes(search.toLowerCase()) || k.e_post.toLowerCase().includes(search.toLowerCase())
  );

  const getSelskapNavn = (id: string) => selskaper.find(s => s.id === id)?.firmanavn || "–";

  const addKontakt = () => {
    const id = generateId("K", kontakter);
    updateKontakter(prev => [...prev, { id, ...form }]);
    setDialogOpen(false);
    setForm({ navn: "", selskap_id: "", rolle: "", e_post: "", telefon: "", linkedin: "", notater: "" });
  };

  const currentKontakt = selected ? kontakter.find(k => k.id === selected.id) || selected : null;
  const relatedDeals = currentKontakt ? salgsmuligheter.filter(s => s.kontakt_id === currentKontakt.id || s.selskap_id === currentKontakt.selskap_id) : [];

  // Check relations and open delete dialog
  const handleDeleteClick = async (kontakt: Kontakt) => {
    const relations: string[] = [];

    // Check salgsmuligheter
    const { data: smData } = await supabase.from("salgsmuligheter").select("id").eq("kontakt_id", kontakt.id).limit(1);
    if (smData && smData.length > 0) relations.push("Salgsmuligheter");

    // Check aktiviteter
    const { data: aktData } = await supabase.from("aktiviteter").select("id").eq("kontakt_id", kontakt.id).limit(1);
    if (aktData && aktData.length > 0) relations.push("Aktiviteter");

    // Check if linked to a selskap
    if (kontakt.selskap_id) relations.push("Selskaper");

    setDeleteTarget(kontakt);
    setDeleteRelations(relations);
    setDeleteDialogOpen(true);
  };

  // Perform deletion
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      // Clear kontakt_id on salgsmuligheter
      await supabase.from("salgsmuligheter").update({ kontakt_id: null }).eq("kontakt_id", deleteTarget.id);

      // Clear kontakt_id on aktiviteter
      await supabase.from("aktiviteter").update({ kontakt_id: null }).eq("kontakt_id", deleteTarget.id);

      // Delete the contact
      await supabase.from("kontakter").delete().eq("id", deleteTarget.id);

      // Update local state
      updateKontakter(prev => prev.filter(k => k.id !== deleteTarget.id));
      updateSalgsmuligheter(prev => prev.map(s => s.kontakt_id === deleteTarget.id ? { ...s, kontakt_id: "" } : s));

      if (selected?.id === deleteTarget.id) setSelected(null);

      toast.success(`Kontakten "${deleteTarget.navn}" ble slettet`);
    } catch (err) {
      console.error("Delete contact error:", err);
      toast.error("Kunne ikke slette kontakten");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  const ContactMenu = ({ kontakt, onEdit }: { kontakt: Kontakt; onEdit: () => void }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => e.stopPropagation()}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={e => { e.stopPropagation(); onEdit(); }}>
          <Pencil className="h-4 w-4 mr-2" />Rediger kontakt
        </DropdownMenuItem>
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={e => { e.stopPropagation(); handleDeleteClick(kontakt); }}>
          <Trash2 className="h-4 w-4 mr-2" />Slett kontakt
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <PageShell
      title="Kontakter"
      subtitle={`${kontakter.length} kontakter`}
      actions={
        <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}><Upload className="w-4 h-4 mr-1" />{!isMobile && "Importer"}</Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />{!isMobile && "Ny kontakt"}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader><DialogTitle>Ny kontakt</DialogTitle><DialogDescription>Fyll inn detaljer for den nye kontakten.</DialogDescription></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Navn" value={form.navn} onChange={e => setForm(f => ({ ...f, navn: e.target.value }))} />
              <select className="w-full border rounded-lg px-3 py-2 text-sm bg-background" value={form.selskap_id} onChange={e => setForm(f => ({ ...f, selskap_id: e.target.value }))}>
                <option value="">Velg selskap</option>
                {selskaper.map(s => <option key={s.id} value={s.id}>{s.firmanavn}</option>)}
              </select>
              <Input placeholder="Rolle" value={form.rolle} onChange={e => setForm(f => ({ ...f, rolle: e.target.value }))} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input placeholder="E-post" value={form.e_post} onChange={e => setForm(f => ({ ...f, e_post: e.target.value }))} />
                <Input placeholder="Telefon" value={form.telefon} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} />
              </div>
              <Input placeholder="LinkedIn URL" value={form.linkedin} onChange={e => setForm(f => ({ ...f, linkedin: e.target.value }))} />
              <Button onClick={addKontakt} className="w-full" disabled={!form.navn}>Opprett kontakt</Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      }
    >
      <DataImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        target="kontakter"
        onImport={async (rows) => {
          let success = 0, errors = 0;
          const newItems: Kontakt[] = [];
          for (const row of rows) {
            try {
              newItems.push({
                id: crypto.randomUUID(),
                navn: String(row.navn || ""),
                selskap_id: "",
                rolle: String(row.rolle || ""),
                e_post: String(row.e_post || ""),
                telefon: String(row.telefon || ""),
                linkedin: String(row.linkedin || ""),
                notater: String(row.notater || ""),
              });
              success++;
            } catch { errors++; }
          }
          if (newItems.length > 0) {
            updateKontakter(prev => [...prev, ...newItems]);
          }
          return { success, errors };
        }}
      />
      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Søk kontakter..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Mobile: card layout */}
      {isMobile ? (
        <div className="space-y-3">
          {filtered.map(k => (
            <div key={k.id} className="bg-card border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm cursor-pointer" onClick={() => setSelected(k)}>{k.navn}</p>
                <ContactMenu kontakt={k} onEdit={() => setSelected(k)} />
              </div>
              <p className="text-xs text-muted-foreground cursor-pointer" onClick={() => navigate(`/selskaper/${k.selskap_id}`)}>
                {getSelskapNavn(k.selskap_id)}
              </p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {k.e_post && <span className="flex items-center gap-1 truncate"><Mail className="w-3 h-3 shrink-0" />{k.e_post}</span>}
                {k.telefon && <span className="flex items-center gap-1"><Phone className="w-3 h-3 shrink-0" />{k.telefon}</span>}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Ingen kontakter å vise</p>}
        </div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium">Navn</th>
                <th className="text-left px-4 py-3 font-medium">Selskap</th>
                <th className="text-left px-4 py-3 font-medium">Rolle</th>
                <th className="text-left px-4 py-3 font-medium">E-post</th>
                <th className="text-left px-4 py-3 font-medium">Telefon</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(k => (
                <tr key={k.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setSelected(k)}>
                  <td className="px-4 py-3 font-medium">{k.navn}</td>
                  <td className="px-4 py-3 text-muted-foreground"><span className="cursor-pointer hover:text-primary hover:underline" onClick={e => { e.stopPropagation(); navigate(`/selskaper/${k.selskap_id}`); }}>{getSelskapNavn(k.selskap_id)}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{k.rolle}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{k.e_post}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{k.telefon}</td>
                  <td className="px-4 py-3">
                    <ContactMenu kontakt={k} onEdit={() => setSelected(k)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Slett kontakt</DialogTitle>
            <DialogDescription>
              {deleteRelations.length > 0
                ? "Dette vil fjerne kontakten fra alle relaterte objekter."
                : `Er du sikker på at du vil slette "${deleteTarget?.navn}"?`
              }
            </DialogDescription>
          </DialogHeader>
          {deleteRelations.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Kontakten er koblet til:</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                {deleteRelations.map(r => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>Avbryt</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Sletter..." : "Slett kontakt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!currentKontakt} onOpenChange={open => !open && setSelected(null)}>
        <SheetContent className="w-full sm:w-[400px] sm:max-w-[500px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              <Input
                value={currentKontakt?.navn || ""}
                onChange={e => {
                  if (currentKontakt) {
                    updateKontakter(prev => prev.map(k => k.id === currentKontakt.id ? { ...k, navn: e.target.value } : k));
                  }
                }}
                className="text-lg font-semibold border-transparent shadow-none px-2 -mx-2 h-auto hover:border-input focus-visible:border-input focus-visible:ring-1 focus-visible:ring-ring transition-colors rounded-md"
              />
            </SheetTitle>
          </SheetHeader>
          {currentKontakt && (
            <ContactDetailPanel
              kontakt={currentKontakt}
              selskaper={selskaper}
              salgsmuligheter={relatedDeals}
              onUpdate={(field, value) => {
                updateKontakter(prev => prev.map(k => k.id === currentKontakt.id ? { ...k, [field]: value } : k));
              }}
              onNavigate={navigate}
              onDelete={() => handleDeleteClick(currentKontakt)}
            />
          )}
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}
