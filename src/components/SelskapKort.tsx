import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import type { KundeRef } from "@/hooks/use-kort";
import { cn } from "@/lib/utils";

interface Hist { id: string; type: string; tittel: string | null; beskrivelse: string; dato: string }
const Tittel = ({ children }: { children: React.ReactNode }) => <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{children}</h3>;

export default function SelskapKort({ id, onClose, onKunde }: { id: string; onClose: () => void; onKunde: (r: KundeRef) => void }) {
  const isMobile = useIsMobile();
  const { canEdit } = useAuth();
  const { selskaper, kontakter, leads, salgsmuligheter, oppgaver, updateSelskaper, updateKontakter } = useCrmStore();
  const s = selskaper.find(x => x.id === id);
  const navnLc = (s?.firmanavn || "").toLowerCase();
  const mineKontakter = useMemo(() => kontakter.filter(k => k.selskap_id === id), [kontakter, id]);
  const mineLeads = useMemo(() => navnLc ? leads.filter(l => (l.firmanavn || "").toLowerCase() === navnLc && !l.status.startsWith("Konvertert")) : [], [leads, navnLc]);
  const mineSm = useMemo(() => salgsmuligheter.filter(x => x.selskap_id === id), [salgsmuligheter, id]);
  const mineOppg = useMemo(() => {
    const kIds = new Set(mineKontakter.map(k => k.id)); const smIds = new Set(mineSm.map(x => x.id)); const lIds = new Set(mineLeads.map(l => l.id));
    return oppgaver.filter(o => o.status !== "Ferdig" && (o.selskap_id === id || kIds.has(o.kontakt_id) || smIds.has(o.salgsmulighet_id) || lIds.has(o.lead_id)));
  }, [oppgaver, id, mineKontakter, mineSm, mineLeads]);

  const [ekstra, setEkstra] = useState({ telefon: "", e_post: "" });
  const [redigerer, setRedigerer] = useState(false);
  const [form, setForm] = useState({ firmanavn: "", orgnr: "", telefon: "", e_post: "", domene: "" });
  const [ny, setNy] = useState<{ navn: string; telefon: string; e_post: string; rolle: string } | null>(null);
  const [hist, setHist] = useState<Hist[]>([]);

  useEffect(() => {
    supabase.from("selskaper").select("telefon, e_post").eq("id", id).maybeSingle()
      .then(({ data }) => setEkstra({ telefon: data?.telefon || "", e_post: data?.e_post || "" }));
    setRedigerer(false); setNy(null);
  }, [id]);

  const histKey = [id, ...mineKontakter.map(k => k.id), ...mineSm.map(x => x.id), ...mineLeads.map(l => l.id)].join(",");
  useEffect(() => {
    const deler = [`selskap_id.eq.${id}`];
    if (mineKontakter.length) deler.push(`kontakt_id.in.(${mineKontakter.map(k => k.id).join(",")})`);
    if (mineSm.length) deler.push(`salgsmulighet_id.in.(${mineSm.map(x => x.id).join(",")})`);
    if (mineLeads.length) deler.push(`lead_id.in.(${mineLeads.map(l => l.id).join(",")})`);
    supabase.from("aktiviteter").select("id, type, tittel, beskrivelse, dato").or(deler.join(",")).order("dato", { ascending: false }).limit(25)
      .then(({ data }) => setHist((data as Hist[]) || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [histKey]);

  if (!s) return null;

  const startRediger = () => { setForm({ firmanavn: s.firmanavn, orgnr: s.orgnr, telefon: ekstra.telefon, e_post: ekstra.e_post, domene: s.domene }); setRedigerer(true); };
  const lagre = async () => {
    const f = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()])) as typeof form;
    if (!f.firmanavn) { toast.error("Firmanavn må fylles ut"); return; }
    updateSelskaper(prev => prev.map(x => x.id === id ? { ...x, firmanavn: f.firmanavn, orgnr: f.orgnr, domene: f.domene } : x));
    const { error } = await supabase.from("selskaper").update({ telefon: f.telefon || null, e_post: f.e_post || null }).eq("id", id);
    if (error) { toast.error("Kunne ikke lagre telefon/e-post"); return; }
    setEkstra({ telefon: f.telefon, e_post: f.e_post });
    setRedigerer(false); toast.success("Selskapet er lagret");
  };
  const leggTilKontakt = () => {
    if (!ny?.navn.trim()) { toast.error("Navn må fylles ut"); return; }
    const kid = crypto.randomUUID();
    updateKontakter(prev => [...prev, { id: kid, navn: ny.navn.trim(), selskap_id: id, rolle: ny.rolle.trim(), e_post: ny.e_post.trim(), telefon: ny.telefon.trim(), linkedin: "", notater: "" }]);
    setNy(null); toast.success("Kontakt lagt til");
  };
  const nettside = s.domene ? (s.domene.startsWith("http") ? s.domene : `https://${s.domene}`) : "";

  return (
    <Sheet open onOpenChange={o => !o && onClose()}>
      <SheetContent side={isMobile ? "bottom" : "right"} className={cn("overflow-y-auto", isMobile ? "max-h-[90vh] rounded-t-xl" : "w-full sm:max-w-md")}>
        <SheetHeader className="text-left">
          <SheetTitle className="font-display">{s.firmanavn}</SheetTitle>
          <SheetDescription>{[s.kundestatus, s.bransje].filter(Boolean).join(" · ")}</SheetDescription>
        </SheetHeader>
        <div className="mt-5 space-y-6">
          <section className="space-y-2">
            <div className="flex items-center justify-between"><Tittel>Selskapsinfo</Tittel>
              {canEdit && !redigerer && <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={startRediger}><Pencil className="h-3.5 w-3.5" />Rediger</Button>}
            </div>
            {redigerer ? (
              <div className="grid gap-2">
                {([["firmanavn", "Navn"], ["orgnr", "Org.nr"], ["telefon", "Telefon"], ["e_post", "E-post"], ["domene", "Nettside"]] as const).map(([k, l]) => (
                  <label key={k} className="grid gap-1 text-xs text-muted-foreground">{l}<Input value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} /></label>
                ))}
                <div className="flex gap-2 pt-1"><Button size="sm" onClick={lagre}>Lagre</Button><Button size="sm" variant="ghost" onClick={() => setRedigerer(false)}>Avbryt</Button></div>
              </div>
            ) : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">Org.nr</dt><dd className="tabular-nums">{s.orgnr || "–"}</dd>
                <dt className="text-muted-foreground">Telefon</dt><dd>{ekstra.telefon ? <a className="tabular-nums hover:underline" href={`tel:${ekstra.telefon.replace(/\s/g, "")}`}>{ekstra.telefon}</a> : "–"}</dd>
                <dt className="text-muted-foreground">E-post</dt><dd className="truncate">{ekstra.e_post ? <a className="hover:underline" href={`mailto:${ekstra.e_post}`}>{ekstra.e_post}</a> : "–"}</dd>
                <dt className="text-muted-foreground">Nettside</dt><dd className="truncate">{nettside ? <a className="hover:underline" href={nettside} target="_blank" rel="noreferrer">{s.domene}</a> : "–"}</dd>
              </dl>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between"><Tittel>Kontakter ({mineKontakter.length + mineLeads.length})</Tittel>
              {canEdit && !ny && <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => setNy({ navn: "", telefon: "", e_post: "", rolle: "" })}><Plus className="h-3.5 w-3.5" />Legg til kontakt</Button>}
            </div>
            {ny && (
              <div className="grid gap-2 rounded-lg border bg-muted/30 p-3">
                {([["navn", "Navn"], ["rolle", "Rolle"], ["telefon", "Telefon"], ["e_post", "E-post"]] as const).map(([k, l]) => (
                  <Input key={k} placeholder={l} aria-label={l} value={ny[k]} onChange={e => setNy(n => n && ({ ...n, [k]: e.target.value }))} className="h-8" />
                ))}
                <div className="flex gap-2"><Button size="sm" onClick={leggTilKontakt}>Legg til</Button><Button size="sm" variant="ghost" onClick={() => setNy(null)}>Avbryt</Button></div>
              </div>
            )}
            {mineKontakter.length + mineLeads.length === 0 ? <p className="text-sm text-muted-foreground">Ingen kontakter ennå.</p> : (
              <ul className="divide-y rounded-lg border">
                {mineKontakter.map(k => (
                  <li key={k.id}><button type="button" onClick={() => onKunde({ type: "kontakt", id: k.id })} className="w-full px-3 py-2 text-left hover:bg-muted/50">
                    <span className="block truncate text-sm font-medium">{k.navn}</span>
                    <span className="block truncate text-xs text-muted-foreground">{[k.rolle, k.telefon, k.e_post].filter(Boolean).join(" · ")}</span>
                  </button></li>
                ))}
                {mineLeads.map(l => (
                  <li key={l.id}><button type="button" onClick={() => onKunde({ type: "lead", id: l.id })} className="w-full px-3 py-2 text-left hover:bg-muted/50">
                    <span className="flex items-center gap-2 text-sm font-medium"><span className="truncate">{l.kontaktperson || l.e_post || "Lead"}</span><Badge variant="secondary" className="text-[10px]">Lead · {l.status}</Badge></span>
                    <span className="block truncate text-xs text-muted-foreground">{[l.rolle_i_firma, l.telefon, l.e_post].filter(Boolean).join(" · ")}</span>
                  </button></li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <Tittel>Salgsmuligheter ({mineSm.length})</Tittel>
            {mineSm.length === 0 ? <p className="text-sm text-muted-foreground">Ingen salgsmuligheter.</p> : (
              <ul className="divide-y rounded-lg border">
                {mineSm.map(x => (
                  <li key={x.id}><button type="button" onClick={() => onKunde({ type: "sm", id: x.id })} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50">
                    <span className="truncate font-medium">{x.navn}</span><Badge variant="outline" className="shrink-0">{x.status}</Badge>
                  </button></li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <Tittel>Åpne oppgaver ({mineOppg.length})</Tittel>
            {mineOppg.length === 0 ? <p className="text-sm text-muted-foreground">Ingen åpne oppgaver.</p> : (
              <ul className="divide-y rounded-lg border">
                {mineOppg.map(o => (
                  <li key={o.id}><button type="button" onClick={() => onKunde({ type: "oppgave", id: o.id })} className="flex w-full justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50">
                    <span className="truncate">{o.oppgave}</span><span className="shrink-0 text-xs text-muted-foreground tabular-nums">{o.frist ? format(new Date(o.frist), "d. MMM", { locale: nb }) : ""}</span>
                  </button></li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <Tittel>Historikk</Tittel>
            {hist.length === 0 ? <p className="text-sm text-muted-foreground">Ingen aktiviteter ennå.</p> : (
              <ul className="divide-y rounded-lg border">
                {hist.map(h => (
                  <li key={h.id} className="px-3 py-2">
                    <p className="flex justify-between gap-2 text-sm font-medium"><span className="truncate">{h.tittel || h.type}</span><span className="shrink-0 text-xs font-normal text-muted-foreground tabular-nums">{format(new Date(h.dato), "d. MMM HH:mm", { locale: nb })}</span></p>
                    {h.beskrivelse && h.beskrivelse !== h.tittel && <p className="line-clamp-2 text-xs text-muted-foreground">{h.beskrivelse}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
