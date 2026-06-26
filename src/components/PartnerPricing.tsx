import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Save, X, Calculator, Package, DollarSign, Zap } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { nok } from "@/lib/utils";
import { toast } from "sonner";

// Standard Snakk-pakker (sluttkunde-utsalg)
const PRESET_PAKKER: Array<{ navn: string; beskrivelse: string; inkluderte_minutter: number; utsalgspris_sluttkunde: number; ekstra_min_pris: number }> = [
  { navn: "Chatbot + 100 min", beskrivelse: "Unlimited chat (fair use) + 100 min voice", inkluderte_minutter: 100, utsalgspris_sluttkunde: 990, ekstra_min_pris: 0 },
  { navn: "Starter", beskrivelse: "500 min/mo (~250 samtaler)", inkluderte_minutter: 500, utsalgspris_sluttkunde: 2500, ekstra_min_pris: 0 },
  { navn: "Growth", beskrivelse: "1 500 min/mo (~750 samtaler) — MEST POPULÆR", inkluderte_minutter: 1500, utsalgspris_sluttkunde: 7500, ekstra_min_pris: 0 },
  { navn: "Pro", beskrivelse: "2 500 min/mo (~1 250 samtaler)", inkluderte_minutter: 2500, utsalgspris_sluttkunde: 12500, ekstra_min_pris: 0 },
  { navn: "800 min", beskrivelse: "800 min/mo (~400 samtaler)", inkluderte_minutter: 800, utsalgspris_sluttkunde: 4000, ekstra_min_pris: 0 },
  { navn: "Team", beskrivelse: "3 000 min/mo (~1 500 samtaler)", inkluderte_minutter: 3000, utsalgspris_sluttkunde: 15000, ekstra_min_pris: 0 },
  { navn: "Business", beskrivelse: "6 000 min/mo (~3 000 samtaler)", inkluderte_minutter: 6000, utsalgspris_sluttkunde: 30000, ekstra_min_pris: 0 },
  { navn: "Enterprise", beskrivelse: "22 500+ min/mo — Custom SLA & dedikert support", inkluderte_minutter: 22500, utsalgspris_sluttkunde: 0, ekstra_min_pris: 0 },
];

type Prismodell = {
  id: string;
  partner_id: string;
  trinn_navn: string;
  min_kunder: number;
  max_kunder: number | null;
  kostpris_per_minutt: number;
  sortering: number;
};

type Pakke = {
  id: string;
  partner_id: string;
  navn: string;
  beskrivelse: string | null;
  inkluderte_minutter: number;
  utsalgspris_sluttkunde: number;
  ekstra_min_pris: number;
  aktiv: boolean;
  sortering: number;
};

const formatKr = (v: number) =>
  v.toLocaleString("no-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " kr";

export default function PartnerPricing({
  partnerId,
  aktiveKunderCount,
}: {
  partnerId: string;
  aktiveKunderCount: number;
}) {
  const [trinn, setTrinn] = useState<Prismodell[]>([]);
  const [pakker, setPakker] = useState<Pakke[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTrinnId, setEditTrinnId] = useState<string | null>(null);
  const [trinnForm, setTrinnForm] = useState<Partial<Prismodell>>({});
  const [showAddTrinn, setShowAddTrinn] = useState(false);
  const [showAddPakke, setShowAddPakke] = useState(false);
  const [editPakke, setEditPakke] = useState<Pakke | null>(null);
  const [pakkeForm, setPakkeForm] = useState<Partial<Pakke>>({
    navn: "",
    beskrivelse: "",
    inkluderte_minutter: 0,
    utsalgspris_sluttkunde: 0,
    ekstra_min_pris: 0,
    aktiv: true,
  });
  const [overrideCount, setOverrideCount] = useState<number | null>(null);

  const effektivKunder = overrideCount ?? aktiveKunderCount;

  const load = async () => {
    setLoading(true);
    const [{ data: t }, { data: p }] = await Promise.all([
      supabase.from("partner_prismodell").select("*").eq("partner_id", partnerId).order("sortering"),
      supabase.from("partner_pakker").select("*").eq("partner_id", partnerId).order("sortering"),
    ]);
    setTrinn((t || []) as Prismodell[]);
    setPakker((p || []) as Pakke[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [partnerId]);

  const gjeldendeTrinn = trinn.find(
    (t) => effektivKunder >= t.min_kunder && (t.max_kunder === null || effektivKunder <= t.max_kunder)
  );
  const gjeldendeKostpris = gjeldendeTrinn?.kostpris_per_minutt ?? 0;

  // Trinn ops
  const saveTrinn = async (row: Partial<Prismodell> & { id?: string }) => {
    if (row.id) {
      const { error } = await supabase
        .from("partner_prismodell")
        .update({
          trinn_navn: row.trinn_navn!,
          min_kunder: Number(row.min_kunder),
          max_kunder: row.max_kunder === null || row.max_kunder === undefined ? null : Number(row.max_kunder),
          kostpris_per_minutt: Number(row.kostpris_per_minutt),
        })
        .eq("id", row.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("partner_prismodell").insert({
        partner_id: partnerId,
        trinn_navn: row.trinn_navn || "Nytt trinn",
        min_kunder: Number(row.min_kunder) || 0,
        max_kunder: row.max_kunder === null || row.max_kunder === undefined ? null : Number(row.max_kunder),
        kostpris_per_minutt: Number(row.kostpris_per_minutt) || 0,
        sortering: trinn.length + 1,
      });
      if (error) return toast.error(error.message);
    }
    setEditTrinnId(null);
    setTrinnForm({});
    setShowAddTrinn(false);
    toast.success("Lagret");
    load();
  };

  const deleteTrinn = async (id: string) => {
    if (!confirm("Slett trinn?")) return;
    const { error } = await supabase.from("partner_prismodell").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  // Pakke ops
  const savePakke = async () => {
    if (!pakkeForm.navn) return toast.error("Navn mangler");
    if (editPakke) {
      const { error } = await supabase
        .from("partner_pakker")
        .update({
          navn: pakkeForm.navn!,
          beskrivelse: pakkeForm.beskrivelse || null,
          inkluderte_minutter: Number(pakkeForm.inkluderte_minutter) || 0,
          utsalgspris_sluttkunde: Number(pakkeForm.utsalgspris_sluttkunde) || 0,
          ekstra_min_pris: Number(pakkeForm.ekstra_min_pris) || 0,
          aktiv: pakkeForm.aktiv ?? true,
        })
        .eq("id", editPakke.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("partner_pakker").insert({
        partner_id: partnerId,
        navn: pakkeForm.navn!,
        beskrivelse: pakkeForm.beskrivelse || null,
        inkluderte_minutter: Number(pakkeForm.inkluderte_minutter) || 0,
        utsalgspris_sluttkunde: Number(pakkeForm.utsalgspris_sluttkunde) || 0,
        ekstra_min_pris: Number(pakkeForm.ekstra_min_pris) || 0,
        aktiv: pakkeForm.aktiv ?? true,
        sortering: pakker.length + 1,
      });
      if (error) return toast.error(error.message);
    }
    setShowAddPakke(false);
    setEditPakke(null);
    setPakkeForm({ navn: "", beskrivelse: "", inkluderte_minutter: 0, utsalgspris_sluttkunde: 0, ekstra_min_pris: 0, aktiv: true });
    toast.success("Lagret");
    load();
  };

  const addPresetPakker = async (key: string) => {
    const presets = key === "__all__" ? PRESET_PAKKER : PRESET_PAKKER.filter((p) => p.navn === key);
    if (presets.length === 0) return;
    const existing = new Set(pakker.map((p) => p.navn.toLowerCase()));
    const toInsert = presets.filter((p) => !existing.has(p.navn.toLowerCase())).map((p, i) => ({
      partner_id: partnerId,
      navn: p.navn,
      beskrivelse: p.beskrivelse,
      inkluderte_minutter: p.inkluderte_minutter,
      utsalgspris_sluttkunde: p.utsalgspris_sluttkunde,
      ekstra_min_pris: p.ekstra_min_pris,
      aktiv: true,
      sortering: pakker.length + i + 1,
    }));
    if (toInsert.length === 0) return toast.info("Allerede lagt til");
    const { error } = await supabase.from("partner_pakker").insert(toInsert);
    if (error) return toast.error(error.message);
    toast.success(`La til ${toInsert.length} pakke${toInsert.length === 1 ? "" : "r"}`);
    load();
  };

  const deletePakke = async (id: string) => {
    if (!confirm("Slett pakke?")) return;
    const { error } = await supabase.from("partner_pakker").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const openEditPakke = (p: Pakke) => {
    setEditPakke(p);
    setPakkeForm({ ...p });
    setShowAddPakke(true);
  };

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Laster prising …</div>;

  return (
    <div className="space-y-6">
      {/* Gjeldende status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Aktive sluttkunder</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-2xl font-bold">{effektivKunder}</p>
            {overrideCount !== null && <Badge variant="outline" className="text-[10px]">simulert</Badge>}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Input
              type="number"
              placeholder="Simuler antall"
              className="h-7 text-xs"
              value={overrideCount ?? ""}
              onChange={(e) => setOverrideCount(e.target.value === "" ? null : Number(e.target.value))}
            />
            {overrideCount !== null && (
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setOverrideCount(null)}>
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Gjeldende trinn</p>
          <p className="text-lg font-semibold mt-1 truncate">{gjeldendeTrinn?.trinn_navn || "—"}</p>
          <p className="text-xs text-muted-foreground mt-1">Basert på aktive sluttkunder</p>
        </div>
        <div className="bg-primary/5 border border-primary/30 rounded-xl p-4">
          <p className="text-xs text-primary uppercase tracking-wide font-medium">Kostpris til oss</p>
          <p className="text-2xl font-bold mt-1 text-primary">{formatKr(gjeldendeKostpris)}<span className="text-sm font-normal"> / min</span></p>
          <p className="text-xs text-muted-foreground mt-1">Det vi fakturerer partner per minutt</p>
        </div>
      </div>

      {/* Pristrapp */}
      <div className="bg-card border rounded-xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" />
            <h3 className="font-semibold">Pristrapp (kostpris fra oss)</h3>
          </div>
          <Button size="sm" variant="outline" onClick={() => { setShowAddTrinn(true); setTrinnForm({ min_kunder: 0, max_kunder: null, kostpris_per_minutt: 0, trinn_navn: "" }); }}>
            <Plus className="w-4 h-4 mr-1" /> Trinn
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="text-left py-2 font-medium">Trinn</th>
                <th className="text-right py-2 font-medium">Min</th>
                <th className="text-right py-2 font-medium">Maks</th>
                <th className="text-right py-2 font-medium">Pris / min</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {trinn.map((t) => {
                const isEdit = editTrinnId === t.id;
                const isActive = gjeldendeTrinn?.id === t.id;
                return (
                  <tr key={t.id} className={`border-b last:border-0 ${isActive ? "bg-primary/5" : ""}`}>
                    {isEdit ? (
                      <>
                        <td className="py-2"><Input value={trinnForm.trinn_navn ?? ""} onChange={(e) => setTrinnForm({ ...trinnForm, trinn_navn: e.target.value })} className="h-8 text-sm" /></td>
                        <td className="py-2"><Input type="number" value={trinnForm.min_kunder ?? 0} onChange={(e) => setTrinnForm({ ...trinnForm, min_kunder: Number(e.target.value) })} className="h-8 text-sm w-20 ml-auto text-right" /></td>
                        <td className="py-2"><Input type="number" value={trinnForm.max_kunder ?? ""} placeholder="∞" onChange={(e) => setTrinnForm({ ...trinnForm, max_kunder: e.target.value === "" ? null : Number(e.target.value) })} className="h-8 text-sm w-20 ml-auto text-right" /></td>
                        <td className="py-2"><Input type="number" step="0.01" value={trinnForm.kostpris_per_minutt ?? 0} onChange={(e) => setTrinnForm({ ...trinnForm, kostpris_per_minutt: Number(e.target.value) })} className="h-8 text-sm w-24 ml-auto text-right" /></td>
                        <td className="py-2 text-right">
                          <Button size="sm" variant="ghost" onClick={() => saveTrinn({ ...trinnForm, id: t.id })}><Save className="w-3 h-3" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => { setEditTrinnId(null); setTrinnForm({}); }}><X className="w-3 h-3" /></Button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2 font-medium">
                          {t.trinn_navn} {isActive && <Badge className="ml-2 bg-primary text-primary-foreground text-[10px]">Gjeldende</Badge>}
                        </td>
                        <td className="py-2 text-right font-mono">{t.min_kunder}</td>
                        <td className="py-2 text-right font-mono">{t.max_kunder ?? "∞"}</td>
                        <td className="py-2 text-right font-mono font-semibold">{formatKr(Number(t.kostpris_per_minutt))}</td>
                        <td className="py-2 text-right">
                          <Button size="sm" variant="ghost" onClick={() => { setEditTrinnId(t.id); setTrinnForm(t); }}><Pencil className="w-3 h-3" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteTrinn(t.id)}><Trash2 className="w-3 h-3" /></Button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
              {showAddTrinn && (
                <tr className="border-b last:border-0 bg-muted/30">
                  <td className="py-2"><Input placeholder="Trinn-navn" value={trinnForm.trinn_navn ?? ""} onChange={(e) => setTrinnForm({ ...trinnForm, trinn_navn: e.target.value })} className="h-8 text-sm" /></td>
                  <td className="py-2"><Input type="number" value={trinnForm.min_kunder ?? 0} onChange={(e) => setTrinnForm({ ...trinnForm, min_kunder: Number(e.target.value) })} className="h-8 text-sm w-20 ml-auto text-right" /></td>
                  <td className="py-2"><Input type="number" value={trinnForm.max_kunder ?? ""} placeholder="∞" onChange={(e) => setTrinnForm({ ...trinnForm, max_kunder: e.target.value === "" ? null : Number(e.target.value) })} className="h-8 text-sm w-20 ml-auto text-right" /></td>
                  <td className="py-2"><Input type="number" step="0.01" value={trinnForm.kostpris_per_minutt ?? 0} onChange={(e) => setTrinnForm({ ...trinnForm, kostpris_per_minutt: Number(e.target.value) })} className="h-8 text-sm w-24 ml-auto text-right" /></td>
                  <td className="py-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => saveTrinn(trinnForm)}><Save className="w-3 h-3" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => { setShowAddTrinn(false); setTrinnForm({}); }}><X className="w-3 h-3" /></Button>
                  </td>
                </tr>
              )}
              {trinn.length === 0 && !showAddTrinn && (
                <tr><td colSpan={5} className="py-6 text-center text-xs text-muted-foreground">Ingen pristrinn definert</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pakker */}
      <div className="bg-card border rounded-xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            <h3 className="font-semibold">Sluttkunde-pakker</h3>
          </div>
          <div className="flex items-center gap-2">
            <Select onValueChange={(v) => addPresetPakker(v)}>
              <SelectTrigger className="h-8 w-[200px] text-xs">
                <Zap className="w-3 h-3 mr-1 text-primary" />
                <SelectValue placeholder="Snakk-pakker (hurtigvalg)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">⚡ Legg til alle pakker</SelectItem>
                {PRESET_PAKKER.map((p) => (
                  <SelectItem key={p.navn} value={p.navn}>
                    {p.navn} — {p.inkluderte_minutter} min{p.utsalgspris_sluttkunde > 0 ? ` / ${nok(p.utsalgspris_sluttkunde)}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => { setEditPakke(null); setPakkeForm({ navn: "", beskrivelse: "", inkluderte_minutter: 0, utsalgspris_sluttkunde: 0, ekstra_min_pris: 0, aktiv: true }); setShowAddPakke(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Pakke
            </Button>
          </div>
        </div>
        {pakker.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-6">Ingen pakker definert. Legg til pakkene partneren tilbyr sine sluttkunder.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {pakker.map((p) => {
              const vårKost = Number(p.inkluderte_minutter) * gjeldendeKostpris;
              const margin = Number(p.utsalgspris_sluttkunde) - vårKost;
              const marginPct = p.utsalgspris_sluttkunde > 0 ? (margin / Number(p.utsalgspris_sluttkunde)) * 100 : 0;
              const ekstraMargin = Number(p.ekstra_min_pris) - gjeldendeKostpris;
              return (
                <div key={p.id} className={`border rounded-xl p-4 ${p.aktiv ? "bg-card" : "bg-muted/30 opacity-60"}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold">{p.navn}</h4>
                        {!p.aktiv && <Badge variant="outline" className="text-[10px]">Inaktiv</Badge>}
                      </div>
                      {p.beskrivelse && <p className="text-xs text-muted-foreground mt-0.5">{p.beskrivelse}</p>}
                    </div>
                    <div className="flex shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => openEditPakke(p)}><Pencil className="w-3 h-3" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => deletePakke(p.id)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Inkludert</p>
                      <p className="font-mono font-semibold">{p.inkluderte_minutter} min</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Utsalg sluttkunde</p>
                      <p className="font-mono font-semibold">{nok(Number(p.utsalgspris_sluttkunde))}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Vår kost til partner</p>
                      <p className="font-mono font-semibold text-primary">{formatKr(vårKost)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Partner-margin</p>
                      <p className={`font-mono font-semibold ${margin >= 0 ? "text-success" : "text-destructive"}`}>
                        {nok(Math.round(margin))} <span className="text-[10px]">({marginPct.toFixed(0)}%)</span>
                      </p>
                    </div>
                    {Number(p.ekstra_min_pris) > 0 && (
                      <>
                        <div className="col-span-2 border-t pt-2 mt-1">
                          <p className="text-muted-foreground text-[10px] uppercase">Overforbruk</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Pris ekstra min</p>
                          <p className="font-mono">{formatKr(Number(p.ekstra_min_pris))}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Margin pr. ekstra min</p>
                          <p className={`font-mono ${ekstraMargin >= 0 ? "text-success" : "text-destructive"}`}>{formatKr(ekstraMargin)}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Beregningseksempel */}
      {pakker.filter((p) => p.aktiv).length > 0 && (
        <div className="bg-card border rounded-xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="w-4 h-4 text-primary" />
            <h3 className="font-semibold">Fakturagrunnlag — hvis alle pakker brukes opp</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Eksempel: hvis hver aktive sluttkunde bruker hele sin pakke, blir månedlig fakturering fra oss til partner som under. Kostpris/min benyttes med gjeldende trinn ({formatKr(gjeldendeKostpris)}).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-2">Pakke</th>
                  <th className="text-right py-2">Inkl. min</th>
                  <th className="text-right py-2">Utsalg</th>
                  <th className="text-right py-2">Vår kost</th>
                  <th className="text-right py-2">Partner-margin</th>
                </tr>
              </thead>
              <tbody>
                {pakker.filter((p) => p.aktiv).map((p) => {
                  const vårKost = Number(p.inkluderte_minutter) * gjeldendeKostpris;
                  const margin = Number(p.utsalgspris_sluttkunde) - vårKost;
                  return (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{p.navn}</td>
                      <td className="py-2 text-right font-mono">{p.inkluderte_minutter}</td>
                      <td className="py-2 text-right font-mono">{nok(Number(p.utsalgspris_sluttkunde))}</td>
                      <td className="py-2 text-right font-mono text-primary">{formatKr(vårKost)}</td>
                      <td className={`py-2 text-right font-mono ${margin >= 0 ? "text-success" : "text-destructive"}`}>{nok(Math.round(margin))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pakke dialog */}
      <Dialog open={showAddPakke} onOpenChange={(o) => { if (!o) { setShowAddPakke(false); setEditPakke(null); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editPakke ? "Rediger pakke" : "Ny pakke"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Navn</label>
              <Input value={pakkeForm.navn ?? ""} onChange={(e) => setPakkeForm({ ...pakkeForm, navn: e.target.value })} placeholder="f.eks. Basic 500" />
            </div>
            <div>
              <label className="text-xs font-medium">Beskrivelse</label>
              <Textarea value={pakkeForm.beskrivelse ?? ""} onChange={(e) => setPakkeForm({ ...pakkeForm, beskrivelse: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Inkluderte minutter</label>
                <Input type="number" value={pakkeForm.inkluderte_minutter ?? 0} onChange={(e) => setPakkeForm({ ...pakkeForm, inkluderte_minutter: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-xs font-medium">Utsalgspris sluttkunde (kr/mnd)</label>
                <Input type="number" value={pakkeForm.utsalgspris_sluttkunde ?? 0} onChange={(e) => setPakkeForm({ ...pakkeForm, utsalgspris_sluttkunde: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-xs font-medium">Pris ekstra minutt (kr)</label>
                <Input type="number" step="0.01" value={pakkeForm.ekstra_min_pris ?? 0} onChange={(e) => setPakkeForm({ ...pakkeForm, ekstra_min_pris: Number(e.target.value) })} />
              </div>
              <div className="flex items-end gap-2">
                <Switch checked={pakkeForm.aktiv ?? true} onCheckedChange={(c) => setPakkeForm({ ...pakkeForm, aktiv: c })} />
                <span className="text-sm">Aktiv</span>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => { setShowAddPakke(false); setEditPakke(null); }}>Avbryt</Button>
              <Button onClick={savePakke}>Lagre</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
