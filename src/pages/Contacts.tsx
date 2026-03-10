import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { useCrmStore } from "@/hooks/use-crm-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, Search, Mail, Phone, Linkedin, Users } from "lucide-react";
import { Kontakt } from "@/data/crm-data";

export default function Contacts() {
  const navigate = useNavigate();
  const { kontakter, selskaper, salgsmuligheter, updateKontakter, generateId } = useCrmStore();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Kontakt | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ navn: "", selskap_id: "", rolle: "", e_post: "", telefon: "", linkedin: "", notater: "" });

  const filtered = kontakter.filter(k =>
    k.navn.toLowerCase().includes(search.toLowerCase()) || k.e_post.toLowerCase().includes(search.toLowerCase())
  );

  const getSelskapNavn = (id: string) => selskaper.find(s => s.id === id)?.firmanavn || "–";

  const addKontakt = () => {
    const id = `K-${String(kontakter.length + 1).padStart(4, "0")}`;
    updateKontakter(prev => [...prev, { id, ...form }]);
    setDialogOpen(false);
    setForm({ navn: "", selskap_id: "", rolle: "", e_post: "", telefon: "", linkedin: "", notater: "" });
  };

  const currentKontakt = selected ? kontakter.find(k => k.id === selected.id) || selected : null;
  const relatedDeals = currentKontakt ? salgsmuligheter.filter(s => s.kontakt_id === currentKontakt.id || s.selskap_id === currentKontakt.selskap_id) : [];

  return (
    <PageShell
      title="Kontakter"
      subtitle={`${kontakter.length} kontakter`}
      actions={
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />Ny kontakt</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Ny kontakt</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Navn" value={form.navn} onChange={e => setForm(f => ({ ...f, navn: e.target.value }))} />
              <select className="w-full border rounded-lg px-3 py-2 text-sm bg-background" value={form.selskap_id} onChange={e => setForm(f => ({ ...f, selskap_id: e.target.value }))}>
                <option value="">Velg selskap</option>
                {selskaper.map(s => <option key={s.id} value={s.id}>{s.firmanavn}</option>)}
              </select>
              <Input placeholder="Rolle" value={form.rolle} onChange={e => setForm(f => ({ ...f, rolle: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="E-post" value={form.e_post} onChange={e => setForm(f => ({ ...f, e_post: e.target.value }))} />
                <Input placeholder="Telefon" value={form.telefon} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} />
              </div>
              <Input placeholder="LinkedIn URL" value={form.linkedin} onChange={e => setForm(f => ({ ...f, linkedin: e.target.value }))} />
              <Button onClick={addKontakt} className="w-full" disabled={!form.navn}>Opprett kontakt</Button>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Søk kontakter..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-3 font-medium">Navn</th>
              <th className="text-left px-4 py-3 font-medium">Selskap</th>
              <th className="text-left px-4 py-3 font-medium">Rolle</th>
              <th className="text-left px-4 py-3 font-medium">E-post</th>
              <th className="text-left px-4 py-3 font-medium">Telefon</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={!!currentKontakt} onOpenChange={open => !open && setSelected(null)}>
        <SheetContent className="w-[400px] sm:w-[500px] overflow-y-auto">
          <SheetHeader><SheetTitle>{currentKontakt?.navn}</SheetTitle></SheetHeader>
          {currentKontakt && (
            <div className="mt-6 space-y-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" />{currentKontakt.e_post || "–"}</div>
                <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" />{currentKontakt.telefon || "–"}</div>
                {currentKontakt.linkedin && <div className="flex items-center gap-2"><Linkedin className="w-4 h-4 text-muted-foreground" /><a href={currentKontakt.linkedin} target="_blank" rel="noopener" className="text-primary underline text-xs">{currentKontakt.linkedin}</a></div>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground block text-xs">Selskap</span><span className="cursor-pointer hover:text-primary hover:underline" onClick={() => navigate(`/selskaper/${currentKontakt.selskap_id}`)}>{getSelskapNavn(currentKontakt.selskap_id)}</span></div>
                <div><span className="text-muted-foreground block text-xs">Rolle</span>{currentKontakt.rolle || "–"}</div>
              </div>
              {currentKontakt.notater && (
                <div><span className="text-muted-foreground block text-xs mb-1">Notater</span><p>{currentKontakt.notater}</p></div>
              )}
              {relatedDeals.length > 0 && (
                <div>
                  <span className="text-muted-foreground block text-xs mb-2">Relaterte salgsmuligheter</span>
                  <div className="space-y-1.5">
                    {relatedDeals.map(d => (
                      <div key={d.id} className="p-2 bg-muted/50 rounded-lg text-xs">
                        <span className="font-medium">{d.navn}</span> · {d.status} · {d.forventet_mrr.toLocaleString("no-NO")} MRR
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}
