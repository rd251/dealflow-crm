import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageShell from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Phone, Upload, Plus, Search, ArrowLeft,
  PhoneCall, CalendarPlus, X, Send, RotateCcw,
  FileSpreadsheet, UserPlus, Crown, TrendingUp,
  BarChart3, Users, Layers, FolderOpen, Trash2, Pencil
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

// ---------- types ----------
interface Ringelister {
  id: string;
  navn: string;
  segment: string;
  kanal: string;
  partnertype_segment: string;
  kilde_segment: string;
  underkilde: string;
  ansvarlig: string;
  notater: string;
  created_at: string;
  contact_count?: number;
}

interface RingelisteItem {
  id: string;
  navn: string;
  e_post: string;
  telefon: string;
  selskap: string;
  rolle: string;
  prioritet: string;
  status: string;
  utfall: string;
  notater: string;
  ansvarlig: string;
  sist_kontaktet: string | null;
  kontakt_id: string | null;
  selskap_id: string | null;
  salgsmulighet_id: string | null;
  partner_id: string | null;
  created_at: string;
  segment: string;
  kanal: string;
  partnertype_segment: string;
  kilde_segment: string;
  underkilde: string;
  ringeliste_id: string | null;
}

// ---------- segmentation constants ----------
const SEGMENTS = ["SMB", "Enterprise", "Kommune", "Statlig", "Interkommunalt"];
const KANALER = ["Direkte", "Partner", "Self-serve"];
const PARTNERTYPER = ["Integrasjonspartner", "Strategisk partner", "Salgspartner", "Utviklingspartner"];
const KILDER_SEGMENT = ["LinkedIn", "Event", "Web", "Kjøpt liste", "Egen research"];

// ---------- role helpers ----------
const BESLUTNINGSTAKER = ["daglig leder", "ceo", "cfo", "coo", "cto", "cmo", "managing director", "adm. dir", "adm.dir", "administrerende direktør"];
const PAVIRKER = ["leder", "ansvarlig", "sjef", "manager", "director", "head of", "vp"];

function getRolePriority(rolle: string): "Høy" | "Medium" | "Lav" {
  const r = rolle.toLowerCase().trim();
  if (BESLUTNINGSTAKER.some(b => r.includes(b))) return "Høy";
  if (PAVIRKER.some(p => r.includes(p))) return "Medium";
  return "Lav";
}

function getRoleBadgeClass(rolle: string) {
  const p = getRolePriority(rolle);
  if (p === "Høy") return "bg-amber-500/15 text-amber-700 border-amber-300";
  if (p === "Medium") return "bg-blue-500/15 text-blue-700 border-blue-300";
  return "bg-muted text-muted-foreground border-border";
}

function getPrioritetBadge(p: string) {
  if (p === "Høy") return <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[10px]">Høy</Badge>;
  if (p === "Medium") return <Badge className="bg-amber-500/15 text-amber-700 border-amber-300 text-[10px]">Medium</Badge>;
  return <Badge variant="secondary" className="text-[10px]">Lav</Badge>;
}

const statusColors: Record<string, string> = {
  "Ikke ringt": "bg-muted text-muted-foreground",
  "Ringt": "bg-blue-500/15 text-blue-700",
  "Booket møte": "bg-emerald-500/15 text-emerald-700",
  "Ikke interessert": "bg-destructive/15 text-destructive",
  "Send info": "bg-violet-500/15 text-violet-700",
  "Ring igjen": "bg-amber-500/15 text-amber-700",
  "Konvertert": "bg-emerald-500/15 text-emerald-700",
};

const segmentColors: Record<string, string> = {
  "SMB": "bg-blue-500/15 text-blue-700 border-blue-300",
  "Enterprise": "bg-purple-500/15 text-purple-700 border-purple-300",
  "Kommune": "bg-emerald-500/15 text-emerald-700 border-emerald-300",
  "Statlig": "bg-amber-500/15 text-amber-700 border-amber-300",
  "Interkommunalt": "bg-teal-500/15 text-teal-700 border-teal-300",
};

const outcomes = [
  { value: "Ikke svar", icon: <X className="w-4 h-4" />, status: "Ring igjen", cls: "border-muted-foreground/30" },
  { value: "Booket møte", icon: <CalendarPlus className="w-4 h-4" />, status: "Booket møte", cls: "border-emerald-300 bg-emerald-500/10 text-emerald-700" },
  { value: "Ikke interessert", icon: <X className="w-4 h-4" />, status: "Ikke interessert", cls: "border-destructive/30 bg-destructive/10 text-destructive" },
  { value: "Send info", icon: <Send className="w-4 h-4" />, status: "Send info", cls: "border-violet-300 bg-violet-500/10 text-violet-700" },
  { value: "Ring igjen", icon: <RotateCcw className="w-4 h-4" />, status: "Ring igjen", cls: "border-amber-300 bg-amber-500/10 text-amber-700" },
];

// ========== Segmentation Form ==========
function SegmentationForm({ seg, onChange }: {
  seg: { segment: string; kanal: string; partnertype_segment: string; kilde_segment: string; underkilde: string };
  onChange: (s: typeof seg) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label className="text-xs">Segment *</Label>
        <Select value={seg.segment} onValueChange={v => onChange({ ...seg, segment: v })}>
          <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="Velg segment" /></SelectTrigger>
          <SelectContent>{SEGMENTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Kanal *</Label>
        <Select value={seg.kanal} onValueChange={v => onChange({ ...seg, kanal: v, partnertype_segment: v !== "Partner" ? "" : seg.partnertype_segment })}>
          <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="Velg kanal" /></SelectTrigger>
          <SelectContent>{KANALER.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {seg.kanal === "Partner" && (
        <div>
          <Label className="text-xs">Partnertype</Label>
          <Select value={seg.partnertype_segment} onValueChange={v => onChange({ ...seg, partnertype_segment: v })}>
            <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="Velg partnertype" /></SelectTrigger>
            <SelectContent>{PARTNERTYPER.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      <div>
        <Label className="text-xs">Kilde *</Label>
        <Select value={seg.kilde_segment} onValueChange={v => onChange({ ...seg, kilde_segment: v })}>
          <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="Velg kilde" /></SelectTrigger>
          <SelectContent>{KILDER_SEGMENT.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="col-span-2">
        <Label className="text-xs">Underkilde</Label>
        <Input placeholder="F.eks. Stand på tech-messen" value={seg.underkilde} onChange={e => onChange({ ...seg, underkilde: e.target.value })} className="h-8 mt-1" />
      </div>
    </div>
  );
}

function isSegmentValid(seg: { segment: string; kanal: string; kilde_segment: string }) {
  return seg.segment && seg.kanal && seg.kilde_segment;
}

// ========== MAIN COMPONENT ==========
export default function Ringeliste() {
  const [activeListe, setActiveListe] = useState<Ringelister | null>(null);

  return (
    <PageShell title="Ringeliste">
      {activeListe ? (
        <RingelisteContacts liste={activeListe} onBack={() => setActiveListe(null)} />
      ) : (
        <RingelisterOverview onSelect={setActiveListe} />
      )}
    </PageShell>
  );
}

// ========== RINGELISTER OVERVIEW (FOLDER LIST) ==========
function RingelisterOverview({ onSelect }: { onSelect: (l: Ringelister) => void }) {
  const [lister, setLister] = useState<Ringelister[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ navn: "", ansvarlig: "", notater: "" });
  const [seg, setSeg] = useState({ segment: "", kanal: "", partnertype_segment: "", kilde_segment: "", underkilde: "" });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchLister = async () => {
    const { data: listsData } = await supabase.from("ringelister").select("*").order("created_at", { ascending: false });
    if (!listsData) { setLoading(false); return; }

    // Get contact counts per list
    const { data: contacts } = await supabase.from("ringeliste").select("ringeliste_id");
    const counts: Record<string, number> = {};
    contacts?.forEach(c => {
      if (c.ringeliste_id) counts[c.ringeliste_id] = (counts[c.ringeliste_id] || 0) + 1;
    });

    setLister((listsData as any[]).map(l => ({ ...l, contact_count: counts[l.id] || 0 })));
    setLoading(false);
  };

  useEffect(() => { fetchLister(); }, []);

  const handleCreate = async () => {
    if (!form.navn.trim() || !isSegmentValid(seg)) return;
    setSaving(true);
    await supabase.from("ringelister").insert({ ...form, ...seg } as any);
    toast.success("Ringeliste opprettet");
    setForm({ navn: "", ansvarlig: "", notater: "" });
    setSeg({ segment: "", kanal: "", partnertype_segment: "", kilde_segment: "", underkilde: "" });
    setCreateOpen(false);
    setSaving(false);
    fetchLister();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("ringelister").delete().eq("id", deleteId);
    toast.success("Ringeliste slettet");
    setDeleteId(null);
    fetchLister();
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <p className="text-sm text-muted-foreground">{lister.length} ringelister</p>
        <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-1" />Ny ringeliste</Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Laster...</div>
      ) : lister.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground/50" />
          <p className="text-muted-foreground">Ingen ringelister ennå</p>
          <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-1" />Opprett din første liste</Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lister.map(l => (
            <div
              key={l.id}
              className="border rounded-lg p-4 hover:border-primary/50 hover:shadow-sm cursor-pointer transition-all group"
              onClick={() => onSelect(l)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FolderOpen className="w-4 h-4 text-primary shrink-0" />
                  <h3 className="font-medium text-sm truncate">{l.navn}</h3>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 shrink-0"
                  onClick={e => { e.stopPropagation(); setDeleteId(l.id); }}
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {l.segment && <Badge variant="outline" className={cn("text-[10px]", segmentColors[l.segment])}>{l.segment}</Badge>}
                {l.kanal && <Badge variant="outline" className="text-[10px]">{l.kanal}</Badge>}
                {l.kilde_segment && <Badge variant="outline" className="text-[10px]">{l.kilde_segment}</Badge>}
                {l.partnertype_segment && <Badge variant="outline" className="text-[10px]">{l.partnertype_segment}</Badge>}
                {l.underkilde && <Badge variant="outline" className="text-[10px] bg-muted/50">{l.underkilde}</Badge>}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{l.contact_count || 0} kontakter</span>
                {l.ansvarlig && <span>{l.ansvarlig}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ny ringeliste</DialogTitle>
            <DialogDescription>Velg segmentering og gi listen et navn.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/30 rounded-lg p-3 border">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Segmentering</span>
              </div>
              <SegmentationForm seg={seg} onChange={setSeg} />
            </div>
            <div>
              <Label className="text-xs">Listenavn *</Label>
              <Input placeholder="F.eks. SMB Oslo Q2" value={form.navn} onChange={e => setForm(p => ({ ...p, navn: e.target.value }))} className="h-8 mt-1" />
            </div>
            <div>
              <Label className="text-xs">Ansvarlig</Label>
              <Input placeholder="Selger" value={form.ansvarlig} onChange={e => setForm(p => ({ ...p, ansvarlig: e.target.value }))} className="h-8 mt-1" />
            </div>
            <div>
              <Label className="text-xs">Notater</Label>
              <Textarea placeholder="Kort beskrivelse..." value={form.notater} onChange={e => setForm(p => ({ ...p, notater: e.target.value }))} className="mt-1 min-h-[50px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Avbryt</Button>
            <Button onClick={handleCreate} disabled={!form.navn.trim() || !isSegmentValid(seg) || saving}>
              {saving ? "Oppretter..." : "Opprett"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={o => { if (!o) setDeleteId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Slett ringeliste?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Alle kontakter i listen slettes permanent.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Avbryt</Button>
            <Button variant="destructive" onClick={handleDelete}>Slett</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ========== RINGELISTE CONTACTS (INSIDE A FOLDER) ==========
function RingelisteContacts({ liste, onBack }: { liste: Ringelister; onBack: () => void }) {
  const [items, setItems] = useState<RingelisteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("alle");
  const [sortBy, setSortBy] = useState<"prioritet" | "sist_kontaktet" | "status">("prioritet");
  const [selected, setSelected] = useState<RingelisteItem | null>(null);
  const [callNotes, setCallNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertTarget, setConvertTarget] = useState<"salg" | "partner">("salg");

  const [addForm, setAddForm] = useState({ navn: "", e_post: "", telefon: "", selskap: "", rolle: "", ansvarlig: "" });

  const fetchItems = async () => {
    const { data } = await supabase.from("ringeliste").select("*").eq("ringeliste_id", liste.id).order("created_at", { ascending: false });
    if (data) setItems(data as unknown as RingelisteItem[]);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, [liste.id]);

  const filtered = useMemo(() => {
    let list = items;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(i => i.navn.toLowerCase().includes(s) || i.selskap.toLowerCase().includes(s) || i.rolle.toLowerCase().includes(s));
    }
    if (filterStatus !== "alle") list = list.filter(i => i.status === filterStatus);
    const prioOrder = { "Høy": 0, "Medium": 1, "Lav": 2 };
    list = [...list].sort((a, b) => {
      if (sortBy === "prioritet") return (prioOrder[a.prioritet as keyof typeof prioOrder] ?? 2) - (prioOrder[b.prioritet as keyof typeof prioOrder] ?? 2);
      if (sortBy === "sist_kontaktet") return (a.sist_kontaktet ?? "").localeCompare(b.sist_kontaktet ?? "");
      return a.status.localeCompare(b.status);
    });
    return list;
  }, [items, search, filterStatus, sortBy]);

  const handleOutcome = async (outcome: typeof outcomes[0]) => {
    if (!selected) return;
    setSaving(true);
    const now = new Date().toISOString();
    const isBeslutningstaker = getRolePriority(selected.rolle) === "Høy";
    await supabase.from("ringeliste").update({
      status: outcome.status,
      utfall: outcome.value,
      notater: callNotes ? `${selected.notater ? selected.notater + "\n---\n" : ""}${new Date().toLocaleDateString("nb-NO")}: ${outcome.value} – ${callNotes}` : selected.notater,
      sist_kontaktet: now,
    }).eq("id", selected.id);
    toast.success(`Registrert: ${outcome.value}`);
    if (outcome.value === "Booket møte" && isBeslutningstaker) toast.info("🎯 Beslutningstaker – vurder direkte konvertering til salgsmulighet");
    if (outcome.value === "Booket møte" && !isBeslutningstaker) toast.info("💡 Tip: Be om intro til beslutningstaker, eller opprett ny kontakt");
    setSelected(null);
    setCallNotes("");
    setSaving(false);
    fetchItems();
  };

  const handleAdd = async () => {
    if (!addForm.navn.trim()) return;
    const prio = getRolePriority(addForm.rolle);
    await supabase.from("ringeliste").insert({
      ...addForm,
      prioritet: prio,
      ringeliste_id: liste.id,
      segment: liste.segment,
      kanal: liste.kanal,
      partnertype_segment: liste.partnertype_segment,
      kilde_segment: liste.kilde_segment,
      underkilde: liste.underkilde,
    });
    toast.success("Lagt til i ringeliste");
    setAddForm({ navn: "", e_post: "", telefon: "", selskap: "", rolle: "", ansvarlig: "" });
    setAddOpen(false);
    fetchItems();
  };

  const handleConvert = async () => {
    if (!selected) return;
    setSaving(true);
    if (convertTarget === "salg") {
      const { error } = await supabase.from("salgsmuligheter").insert({
        navn: `${selected.selskap} – ${selected.rolle}`,
        kontaktperson: selected.navn,
        e_post: selected.e_post,
        telefon: selected.telefon,
        rolle_i_firma: selected.rolle,
      });
      if (!error) {
        await supabase.from("ringeliste").update({ status: "Konvertert" }).eq("id", selected.id);
        toast.success("Konvertert til salgsmulighet");
      }
    } else {
      const { error } = await supabase.from("partnere").insert({
        partnernavn: selected.selskap || selected.navn,
        kontaktperson: selected.navn,
        e_post: selected.e_post,
        telefon: selected.telefon,
      });
      if (!error) {
        await supabase.from("ringeliste").update({ status: "Konvertert" }).eq("id", selected.id);
        toast.success("Konvertert til partner");
      }
    }
    setSaving(false);
    setConvertOpen(false);
    setSelected(null);
    fetchItems();
  };

  const stats = useMemo(() => {
    const total = items.length;
    const booket = items.filter(i => i.status === "Booket møte").length;
    const konvertert = items.filter(i => i.status === "Konvertert").length;
    const perRolle: Record<string, { total: number; booket: number }> = {};
    items.forEach(i => {
      const r = i.rolle || "Ukjent";
      if (!perRolle[r]) perRolle[r] = { total: 0, booket: 0 };
      perRolle[r].total++;
      if (i.status === "Booket møte" || i.status === "Konvertert") perRolle[r].booket++;
    });
    const beslutningstakere = items.filter(i => getRolePriority(i.rolle) === "Høy");
    const btBooket = beslutningstakere.filter(i => i.status === "Booket møte" || i.status === "Konvertert").length;
    return { total, booket, konvertert, perRolle, btBooket, btTotal: beslutningstakere.length };
  }, [items]);

  return (
    <>
      {/* Header with back button */}
      <div className="flex items-center gap-3 mb-1">
        <Button size="sm" variant="ghost" onClick={onBack} className="h-8 px-2">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="min-w-0">
          <h2 className="font-semibold text-base truncate">{liste.navn}</h2>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-4 ml-10">
        {liste.segment && <Badge variant="outline" className={cn("text-[10px]", segmentColors[liste.segment])}>{liste.segment}</Badge>}
        {liste.kanal && <Badge variant="outline" className="text-[10px]">{liste.kanal}</Badge>}
        {liste.kilde_segment && <Badge variant="outline" className="text-[10px]">{liste.kilde_segment}</Badge>}
        {liste.partnertype_segment && <Badge variant="outline" className="text-[10px]">{liste.partnertype_segment}</Badge>}
        {liste.underkilde && <Badge variant="outline" className="text-[10px] bg-muted/50">{liste.underkilde}</Badge>}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Søk navn, selskap, rolle..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <select className="border rounded-md px-3 py-1.5 text-sm bg-background h-9" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="alle">Alle statuser</option>
          {Object.keys(statusColors).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="border rounded-md px-3 py-1.5 text-sm bg-background h-9" value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
          <option value="prioritet">Sorter: Prioritet</option>
          <option value="sist_kontaktet">Sorter: Sist kontakt</option>
          <option value="status">Sorter: Status</option>
        </select>
        <Button size="sm" variant="outline" onClick={() => setStatsOpen(true)}><BarChart3 className="w-4 h-4 mr-1" />Statistikk</Button>
        <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}><Upload className="w-4 h-4 mr-1" />Importer</Button>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="w-4 h-4 mr-1" />Legg til</Button>
      </div>

      {/* Contact list table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Navn</th>
                <th className="text-left px-3 py-2 font-medium">Selskap</th>
                <th className="text-left px-3 py-2 font-medium">Rolle</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium">Sist kontakt</th>
                <th className="text-left px-3 py-2 font-medium">Ansvarlig</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Laster...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Ingen kontakter i denne listen</td></tr>
              ) : filtered.map(item => (
                <tr key={item.id} className="border-t hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => { setSelected(item); setCallNotes(""); }}>
                  <td className="px-3 py-2.5 font-medium">{item.navn}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{item.selskap}</td>
                  <td className="px-3 py-2.5">
                    {item.rolle && (
                      <Badge variant="outline" className={cn("text-[10px]", getRoleBadgeClass(item.rolle))}>
                        {getRolePriority(item.rolle) === "Høy" && <Crown className="w-3 h-3 mr-0.5" />}
                        {item.rolle}
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className={cn("text-[10px]", statusColors[item.status] || "")}>{item.status}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs">
                    {item.sist_kontaktet ? new Date(item.sist_kontaktet).toLocaleDateString("nb-NO") : "–"}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{item.ansvarlig}</td>
                  <td className="px-3 py-2.5">
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={e => { e.stopPropagation(); setSelected(item); setCallNotes(""); }}>
                      <PhoneCall className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Call Panel Dialog */}
      <Dialog open={!!selected} onOpenChange={o => { if (!o) setSelected(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><PhoneCall className="w-5 h-5" />{selected.navn}</DialogTitle>
                <DialogDescription>Ring og registrer utfall</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">Selskap</span>
                    <p className="font-medium">{selected.selskap || "–"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Rolle</span>
                    <div className="mt-0.5">
                      {selected.rolle ? (
                        <Badge variant="outline" className={cn("text-xs", getRoleBadgeClass(selected.rolle))}>
                          {getRolePriority(selected.rolle) === "Høy" && <Crown className="w-3 h-3 mr-1" />}
                          {selected.rolle}
                        </Badge>
                      ) : "–"}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Telefon</span>
                    <p className="font-medium">{selected.telefon ? <a href={`tel:${selected.telefon}`} className="text-primary hover:underline">{selected.telefon}</a> : "–"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">E-post</span>
                    <p className="font-medium text-xs truncate">{selected.e_post || "–"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Sist kontaktet</span>
                    <p>{selected.sist_kontaktet ? new Date(selected.sist_kontaktet).toLocaleDateString("nb-NO") : "Aldri"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Prioritet</span>
                    <div className="mt-0.5">{getPrioritetBadge(selected.prioritet)}</div>
                  </div>
                </div>

                {selected.notater && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tidligere notater</span>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{selected.notater}</p>
                  </div>
                )}

                {getRolePriority(selected.rolle) === "Høy" && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-xs">
                    <Crown className="w-4 h-4 shrink-0" />
                    <span><strong>Beslutningstaker</strong> – foreslå direkte møtebooking</span>
                  </div>
                )}
                {getRolePriority(selected.rolle) !== "Høy" && selected.rolle && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-800 text-xs">
                    <UserPlus className="w-4 h-4 shrink-0" />
                    <span>Be om intro til beslutningstaker, eller opprett ny kontakt</span>
                  </div>
                )}

                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notater fra samtale</Label>
                  <Textarea placeholder="Hva ble diskutert?" value={callNotes} onChange={e => setCallNotes(e.target.value)} className="mt-1.5 min-h-[60px]" />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Utfall</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                    {outcomes.map(o => (
                      <button key={o.value} onClick={() => handleOutcome(o)} disabled={saving}
                        className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all hover:scale-[1.02]", o.cls)}>
                        {o.icon} {o.value}
                      </button>
                    ))}
                  </div>
                </div>

                {selected.status === "Booket møte" && (
                  <div className="flex gap-2 pt-2 border-t">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => { setConvertTarget("salg"); setConvertOpen(true); }}>
                      <TrendingUp className="w-4 h-4 mr-1" />Konverter til salgsmulighet
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => { setConvertTarget("partner"); setConvertOpen(true); }}>
                      <Users className="w-4 h-4 mr-1" />Konverter til partner
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Convert Dialog */}
      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Konverter til {convertTarget === "salg" ? "salgsmulighet" : "partner"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Opprett basert på <strong>{selected?.navn}</strong>. Rolle ({selected?.rolle}) lagres.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertOpen(false)}>Avbryt</Button>
            <Button onClick={handleConvert} disabled={saving}>{saving ? "Lagrer..." : "Konverter"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Dialog - no segmentation needed, inherited from list */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Legg til kontakt</DialogTitle>
            <DialogDescription>Kontakten arver segmentering fra listen.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {liste.segment && <Badge variant="outline" className={cn("text-[10px]", segmentColors[liste.segment])}>{liste.segment}</Badge>}
            {liste.kanal && <Badge variant="outline" className="text-[10px]">{liste.kanal}</Badge>}
            {liste.kilde_segment && <Badge variant="outline" className="text-[10px]">{liste.kilde_segment}</Badge>}
          </div>
          <div className="space-y-3">
            {[
              { key: "navn", label: "Navn *", placeholder: "Ola Nordmann" },
              { key: "telefon", label: "Telefon", placeholder: "+47..." },
              { key: "e_post", label: "E-post", placeholder: "ola@firma.no" },
              { key: "selskap", label: "Selskap", placeholder: "Firma AS" },
              { key: "rolle", label: "Rolle", placeholder: "Daglig leder, CFO, Marked..." },
              { key: "ansvarlig", label: "Ansvarlig", placeholder: "Selger" },
            ].map(f => (
              <div key={f.key}>
                <Label className="text-xs">{f.label}</Label>
                <Input placeholder={f.placeholder} value={(addForm as any)[f.key]} onChange={e => setAddForm(prev => ({ ...prev, [f.key]: e.target.value }))} className="h-8 mt-1" />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Avbryt</Button>
            <Button onClick={handleAdd} disabled={!addForm.navn.trim()}>Legg til</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <RingelisteImport open={importOpen} onOpenChange={setImportOpen} onDone={fetchItems} liste={liste} />

      {/* Stats Dialog */}
      <Dialog open={statsOpen} onOpenChange={setStatsOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><BarChart3 className="w-5 h-5" />Statistikk – {liste.navn}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Totalt</p>
              </div>
              <div className="bg-emerald-500/10 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-emerald-700">{stats.booket}</p>
                <p className="text-xs text-muted-foreground">Møter booket</p>
              </div>
              <div className="bg-primary/10 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-primary">{stats.konvertert}</p>
                <p className="text-xs text-muted-foreground">Konvertert</p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Crown className="w-4 h-4 text-amber-700" />
                <span className="text-sm font-semibold text-amber-800">Beslutningstakere</span>
              </div>
              <p className="text-sm">{stats.btBooket} av {stats.btTotal} har booket møte ({stats.btTotal > 0 ? Math.round(stats.btBooket / stats.btTotal * 100) : 0}%)</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-2">Konverteringsrate per rolle</h4>
              <div className="space-y-1.5">
                {Object.entries(stats.perRolle).sort((a, b) => b[1].booket - a[1].booket).map(([rolle, data]) => (
                  <div key={rolle} className="flex items-center justify-between text-sm">
                    <span>{rolle}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{data.total} kontakter</span>
                      <Badge variant="outline" className="text-[10px]">
                        {data.total > 0 ? Math.round(data.booket / data.total * 100) : 0}% konvertert
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ========== IMPORT COMPONENT ==========
function RingelisteImport({ open, onOpenChange, onDone, liste }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void; liste: Ringelister }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"upload" | "map" | "preview">("upload");
  const [importing, setImporting] = useState(false);

  const fields = [
    { key: "navn", label: "Navn", required: true },
    { key: "e_post", label: "E-post" },
    { key: "telefon", label: "Telefon" },
    { key: "selskap", label: "Selskap" },
    { key: "rolle", label: "Rolle" },
    { key: "ansvarlig", label: "Ansvarlig" },
  ];

  const reset = () => { setRows([]); setHeaders([]); setMapping({}); setStep("upload"); if (fileRef.current) fileRef.current.value = ""; };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: "array" });
    const json = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
    if (!json.length) { toast.error("Tom fil"); return; }
    const h = Object.keys(json[0]);
    setHeaders(h);
    setRows(json);
    const m: Record<string, string> = {};
    for (const f of fields) {
      const match = h.find(hh => {
        const l = hh.toLowerCase().replace(/[_\-\s]/g, "");
        return l.includes(f.key.replace("_", "")) || l.includes(f.label.toLowerCase());
      });
      if (match) m[f.key] = match;
    }
    setMapping(m);
    setStep("map");
  };

  const mappedRows = rows.map(r => {
    const m: Record<string, any> = {};
    for (const f of fields) {
      if (mapping[f.key]) m[f.key] = r[mapping[f.key]];
    }
    return m;
  }).filter(r => r.navn && String(r.navn).trim());

  const handleImport = async () => {
    setImporting(true);
    const inserts = mappedRows.map(r => ({
      navn: String(r.navn).trim(),
      e_post: String(r.e_post || "").trim(),
      telefon: String(r.telefon || "").trim(),
      selskap: String(r.selskap || "").trim(),
      rolle: String(r.rolle || "").trim(),
      ansvarlig: String(r.ansvarlig || "").trim(),
      prioritet: getRolePriority(String(r.rolle || "")),
      ringeliste_id: liste.id,
      segment: liste.segment,
      kanal: liste.kanal,
      partnertype_segment: liste.partnertype_segment,
      kilde_segment: liste.kilde_segment,
      underkilde: liste.underkilde,
    }));
    const { error } = await supabase.from("ringeliste").insert(inserts);
    if (error) { toast.error("Importfeil"); } else { toast.success(`${inserts.length} kontakter importert`); }
    setImporting(false);
    reset();
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="w-5 h-5" />Importer til {liste.navn}</DialogTitle>
          <DialogDescription>Kontakter arver segmentering fra listen.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5 mb-2">
          {liste.segment && <Badge variant="outline" className={cn("text-[10px]", segmentColors[liste.segment])}>{liste.segment}</Badge>}
          {liste.kanal && <Badge variant="outline" className="text-[10px]">{liste.kanal}</Badge>}
          {liste.kilde_segment && <Badge variant="outline" className="text-[10px]">{liste.kilde_segment}</Badge>}
        </div>

        {step === "upload" && (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors" onClick={() => fileRef.current?.click()}>
              <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium text-sm">Klikk for å velge fil</p>
              <p className="text-xs text-muted-foreground mt-1">CSV eller Excel (.xlsx)</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs font-medium mb-1.5">Støttede kolonner:</p>
              <div className="flex flex-wrap gap-1.5">
                {fields.map(f => <Badge key={f.key} variant={f.required ? "default" : "secondary"} className="text-xs">{f.label}{f.required ? " *" : ""}</Badge>)}
              </div>
            </div>
          </div>
        )}

        {step === "map" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{rows.length} rader funnet. Koble kolonner:</p>
            <div className="space-y-2">
              {fields.map(f => (
                <div key={f.key} className="flex items-center gap-3">
                  <label className="text-sm w-28 shrink-0">{f.label}{f.required && <span className="text-destructive"> *</span>}</label>
                  <select className="flex-1 border rounded-md px-3 py-1.5 text-sm bg-background" value={mapping[f.key] || ""} onChange={e => setMapping(prev => ({ ...prev, [f.key]: e.target.value }))}>
                    <option value="">– Ikke koble –</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="outline" size="sm" onClick={() => setStep("upload")}>Tilbake</Button>
              <Button size="sm" disabled={mappedRows.length === 0} onClick={() => setStep("preview")}>Forhåndsvis ({mappedRows.length} rader)</Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{mappedRows.length} klare for import.</p>
            <div className="border rounded-lg overflow-auto max-h-60">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>{fields.filter(f => mapping[f.key]).map(f => <th key={f.key} className="text-left px-2 py-1.5 font-medium">{f.label}</th>)}</tr>
                </thead>
                <tbody>
                  {mappedRows.slice(0, 20).map((r, i) => (
                    <tr key={i} className="border-t">{fields.filter(f => mapping[f.key]).map(f => <td key={f.key} className="px-2 py-1 truncate max-w-[200px]">{String(r[f.key] ?? "")}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="outline" size="sm" onClick={() => setStep("map")}>Tilbake</Button>
              <Button size="sm" onClick={handleImport} disabled={importing}>{importing ? "Importerer..." : `Importer ${mappedRows.length}`}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
