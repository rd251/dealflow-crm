import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageShell from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Phone, Upload, Plus, Search, ArrowUpDown,
  PhoneCall, CalendarPlus, X, Send, RotateCcw, CheckCircle2,
  FileSpreadsheet, AlertCircle, UserPlus, Crown, TrendingUp,
  BarChart3, Users, Target
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

// ---------- types ----------
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
}

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

// ---------- outcomes ----------
const outcomes = [
  { value: "Ikke svar", icon: <X className="w-4 h-4" />, status: "Ring igjen", cls: "border-muted-foreground/30" },
  { value: "Booket møte", icon: <CalendarPlus className="w-4 h-4" />, status: "Booket møte", cls: "border-emerald-300 bg-emerald-500/10 text-emerald-700" },
  { value: "Ikke interessert", icon: <X className="w-4 h-4" />, status: "Ikke interessert", cls: "border-destructive/30 bg-destructive/10 text-destructive" },
  { value: "Send info", icon: <Send className="w-4 h-4" />, status: "Send info", cls: "border-violet-300 bg-violet-500/10 text-violet-700" },
  { value: "Ring igjen", icon: <RotateCcw className="w-4 h-4" />, status: "Ring igjen", cls: "border-amber-300 bg-amber-500/10 text-amber-700" },
];

// ---------- component ----------
export default function Ringeliste() {
  const [items, setItems] = useState<RingelisteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("alle");
  const [sortBy, setSortBy] = useState<"prioritet" | "sist_kontaktet" | "status">("prioritet");
  const [selected, setSelected] = useState<RingelisteItem | null>(null);
  const [callNotes, setCallNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // import
  const [importOpen, setImportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  // add form
  const [addForm, setAddForm] = useState({ navn: "", e_post: "", telefon: "", selskap: "", rolle: "", ansvarlig: "" });

  // convert dialog
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertTarget, setConvertTarget] = useState<"salg" | "partner">("salg");

  const fetchItems = async () => {
    const { data } = await supabase.from("ringeliste").select("*").order("created_at", { ascending: false });
    if (data) setItems(data as unknown as RingelisteItem[]);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  // ---------- sorting & filtering ----------
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

  // ---------- outcome handler ----------
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

    // Auto suggestion
    if (outcome.value === "Booket møte" && isBeslutningstaker) {
      toast.info("🎯 Beslutningstaker – vurder direkte konvertering til salgsmulighet");
    }
    if (outcome.value === "Booket møte" && !isBeslutningstaker) {
      toast.info("💡 Tip: Be om intro til beslutningstaker, eller opprett ny kontakt");
    }

    setSelected(null);
    setCallNotes("");
    setSaving(false);
    fetchItems();
  };

  // ---------- add item ----------
  const handleAdd = async () => {
    if (!addForm.navn.trim()) return;
    const prio = getRolePriority(addForm.rolle);
    await supabase.from("ringeliste").insert({ ...addForm, prioritet: prio });
    toast.success("Lagt til i ringeliste");
    setAddForm({ navn: "", e_post: "", telefon: "", selskap: "", rolle: "", ansvarlig: "" });
    setAddOpen(false);
    fetchItems();
  };

  // ---------- convert ----------
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

  // ---------- stats ----------
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
    <PageShell title="Ringeliste">
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

      {/* List */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Navn</th>
                <th className="text-left px-3 py-2 font-medium">Selskap</th>
                <th className="text-left px-3 py-2 font-medium">Rolle</th>
                <th className="text-left px-3 py-2 font-medium">Prioritet</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium">Sist kontakt</th>
                <th className="text-left px-3 py-2 font-medium">Ansvarlig</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Laster...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Ingen oppføringer</td></tr>
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
                  <td className="px-3 py-2.5">{getPrioritetBadge(item.prioritet)}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className={cn("text-[10px]", statusColors[item.status] || "")}>
                      {item.status}
                    </Badge>
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

      {/* ===== Call Panel Dialog ===== */}
      <Dialog open={!!selected} onOpenChange={o => { if (!o) setSelected(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <PhoneCall className="w-5 h-5" />
                  {selected.navn}
                </DialogTitle>
                <DialogDescription>Ring og registrer utfall</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {/* Contact info */}
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
                    <p className="font-medium">
                      {selected.telefon ? <a href={`tel:${selected.telefon}`} className="text-primary hover:underline">{selected.telefon}</a> : "–"}
                    </p>
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

                {/* Previous notes */}
                {selected.notater && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tidligere notater</span>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{selected.notater}</p>
                  </div>
                )}

                {/* Role-based suggestion */}
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

                {/* Notes */}
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notater fra samtale</Label>
                  <Textarea placeholder="Hva ble diskutert?" value={callNotes} onChange={e => setCallNotes(e.target.value)} className="mt-1.5 min-h-[60px]" />
                </div>

                {/* Outcomes */}
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Utfall</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                    {outcomes.map(o => (
                      <button
                        key={o.value}
                        onClick={() => handleOutcome(o)}
                        disabled={saving}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all hover:scale-[1.02]",
                          o.cls
                        )}
                      >
                        {o.icon} {o.value}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Convert */}
                {(selected.status === "Booket møte") && (
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

      {/* ===== Convert Dialog ===== */}
      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Konverter til {convertTarget === "salg" ? "salgsmulighet" : "partner"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Opprett en ny {convertTarget === "salg" ? "salgsmulighet" : "partner"} basert på <strong>{selected?.navn}</strong>.
            Rolle ({selected?.rolle}) lagres på kontakten.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertOpen(false)}>Avbryt</Button>
            <Button onClick={handleConvert} disabled={saving}>{saving ? "Lagrer..." : "Konverter"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Add Dialog ===== */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Legg til i ringeliste</DialogTitle>
          </DialogHeader>
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
                <Input
                  placeholder={f.placeholder}
                  value={(addForm as any)[f.key]}
                  onChange={e => setAddForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="h-8 mt-1"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Avbryt</Button>
            <Button onClick={handleAdd} disabled={!addForm.navn.trim()}>Legg til</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Import Dialog ===== */}
      <RingelisteImport open={importOpen} onOpenChange={setImportOpen} onDone={fetchItems} />

      {/* ===== Stats Dialog ===== */}
      <Dialog open={statsOpen} onOpenChange={setStatsOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><BarChart3 className="w-5 h-5" />Ringestatistikk</DialogTitle>
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
    </PageShell>
  );
}

// ========== IMPORT COMPONENT ==========
function RingelisteImport({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
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
    // auto-map
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
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="w-5 h-5" />Importer ringeliste</DialogTitle>
          <DialogDescription>Last opp CSV eller Excel med kontakter for ringelisten.</DialogDescription>
        </DialogHeader>

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
                {fields.map(f => (
                  <Badge key={f.key} variant={f.required ? "default" : "secondary"} className="text-xs">
                    {f.label}{f.required ? " *" : ""}
                  </Badge>
                ))}
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
              <Button variant="outline" size="sm" onClick={reset}>Tilbake</Button>
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
