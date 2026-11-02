import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import LoggUtfall, { type LoggResultat } from "@/components/LoggUtfall";
import type { ActivityTarget, LoggType } from "@/lib/activity-logging";

const SOK_GRENSE = 15;
const SOK_DEBOUNCE_MS = 250;

interface TargetOption { key: string; label: string; sublabel: string; navn: string; target: ActivityTarget }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fast tilknytning når dialogen åpnes fra et kort. */
  target?: ActivityTarget;
  /** Første steg er søk etter kontakt, lead eller selskap (global «+ Logg»). */
  allowTargetPick?: boolean;
  entityName?: string;
  /** Beholdt for bakoverkompatibilitet – brukes ikke lenger. */
  kontaktListe?: { id: string; navn: string }[];
  defaultType?: LoggType;
  onLogged?: (res?: LoggResultat) => void;
}

/** Dialog rundt den felles loggkomponenten. */
export default function LogActivityDialog({ open, onOpenChange, target, allowTargetPick, entityName, onLogged }: Props) {
  const [søk, setSøk] = useState("");
  const [options, setOptions] = useState<TargetOption[]>([]);
  const [valgt, setValgt] = useState<TargetOption | null>(null);

  useEffect(() => { if (open) { setValgt(null); setSøk(""); } }, [open]);

  useEffect(() => {
    if (!open || !allowTargetPick || valgt) return;
    let avbrutt = false;
    const q = søk.trim();
    const timer = setTimeout(async () => {
      const like = `%${q}%`;
      const kQ = supabase.from("kontakter").select("id, navn, selskap_id, selskaper(firmanavn)").order("updated_at", { ascending: false }).limit(SOK_GRENSE);
      const lQ = supabase.from("leads").select("id, firmanavn, kontaktperson").order("sist_aktivitet", { ascending: false }).limit(SOK_GRENSE);
      const sQ = supabase.from("selskaper").select("id, firmanavn").order("firmanavn").limit(SOK_GRENSE);
      const smQ = supabase.from("salgsmuligheter").select("id, navn, kontaktperson, selskap_id, kontakt_id, selskaper(firmanavn)").order("sist_aktivitet", { ascending: false }).limit(SOK_GRENSE);
      if (q) {
        kQ.ilike("navn", like);
        lQ.or(`firmanavn.ilike.${like},kontaktperson.ilike.${like}`);
        sQ.ilike("firmanavn", like);
        smQ.or(`navn.ilike.${like},kontaktperson.ilike.${like}`);
      }
      const [k, l, s, sm] = await Promise.all([kQ, lQ, sQ, smQ]);
      if (avbrutt) return;
      type MedSelskap = { selskaper?: { firmanavn: string | null } | null };
      setOptions([
        ...((k.data || []) as Array<{ id: string; navn: string; selskap_id: string | null } & MedSelskap>).map(x => ({
          key: `k-${x.id}`, label: x.navn, navn: x.navn, sublabel: `Kontakt${x.selskaper?.firmanavn ? ` · ${x.selskaper.firmanavn}` : ""}`,
          target: { kontakt_id: x.id, selskap_id: x.selskap_id || undefined },
        })),
        ...((l.data || []) as Array<{ id: string; firmanavn: string | null; kontaktperson: string | null }>).map(x => ({
          key: `l-${x.id}`, label: x.kontaktperson || x.firmanavn || "Uten navn", navn: x.kontaktperson || x.firmanavn || "",
          sublabel: `Lead${x.firmanavn && x.kontaktperson ? ` · ${x.firmanavn}` : ""}`, target: { lead_id: x.id },
        })),
        ...((sm.data || []) as Array<{ id: string; navn: string | null; kontaktperson: string | null; selskap_id: string | null; kontakt_id: string | null } & MedSelskap>).map(x => ({
          key: `sm-${x.id}`, label: x.selskaper?.firmanavn || x.navn || "Uten navn", navn: x.kontaktperson || x.selskaper?.firmanavn || x.navn || "",
          sublabel: `Salgsmulighet${x.navn ? ` · ${x.navn}` : ""}`,
          target: { salgsmulighet_id: x.id, selskap_id: x.selskap_id || undefined, kontakt_id: x.kontakt_id || undefined },
        })),
        ...((s.data || []) as Array<{ id: string; firmanavn: string }>).map(x => ({ key: `s-${x.id}`, label: x.firmanavn, navn: x.firmanavn, sublabel: "Selskap", target: { selskap_id: x.id } })),
      ]);
    }, q ? SOK_DEBOUNCE_MS : 0);
    return () => { avbrutt = true; clearTimeout(timer); };
  }, [open, allowTargetPick, søk, valgt]);

  const effektivt = allowTargetPick ? valgt?.target : target;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Logg</DialogTitle>
          <DialogDescription>{valgt?.label || entityName || (allowTargetPick ? "Hvem gjelder det?" : "Registrer det som skjedde")}</DialogDescription>
        </DialogHeader>

        {allowTargetPick && (valgt ? (
          <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
            <div className="min-w-0"><p className="truncate text-sm font-medium">{valgt.label}</p><p className="text-xs text-muted-foreground">{valgt.sublabel}</p></div>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setValgt(null)}>Bytt</Button>
          </div>
        ) : (
          <div className="rounded-lg border">
            <div className="relative border-b">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input autoFocus value={søk} onChange={e => setSøk(e.target.value)} placeholder="Søk etter kontakt, lead eller selskap" aria-label="Søk etter kontakt, lead eller selskap" className="h-10 border-0 pl-8 text-sm focus-visible:ring-0" />
            </div>
            <div className="max-h-72 overflow-y-auto">
              {options.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">Ingen treff</p>}
              {options.map(o => (
                <button key={o.key} type="button" onClick={() => setValgt(o)} className="w-full px-3 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none">
                  <span className="block truncate text-sm">{o.label}</span>
                  <span className="text-[11px] text-muted-foreground">{o.sublabel}</span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {effektivt && (
          <LoggUtfall key={JSON.stringify(effektivt)} target={effektivt} navn={valgt?.navn}
            onLogged={res => { onOpenChange(false); onLogged?.(res); }} />
        )}
      </DialogContent>
    </Dialog>
  );
}
