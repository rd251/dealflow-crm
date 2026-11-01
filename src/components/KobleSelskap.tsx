import { useMemo, useState } from "react";
import { Building2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCrmStore } from "@/hooks/use-crm-store";
import type { Selskap } from "@/data/crm-data";

export function nyttSelskap(firmanavn: string, ansvarlig = ""): Selskap {
  return {
    id: crypto.randomUUID(), firmanavn, bransje: "", kundeansvarlig: ansvarlig,
    kundestatus: "Ikke kunde", live_status: false, onboarding_status: "Ikke startet",
    mrr: 0, arr: 0, oppstartskostnad: 0, go_live_dato: "", kansellert_dato: "",
    kanselleringsaarsak: "", kanselleringsnotat: "", kundetilstand: "Bra",
    sist_aktivitet: new Date().toISOString().slice(0, 10), neste_steg: "", notater: "",
    kilde: "Direkte salg", partner_id: "", lukkedato: "", domene: "", orgnr: "", firmaadresse: "", postadresse: "",
  };
}

/** «Koble til selskap»: søk i eksisterende selskaper eller opprett nytt. */
export default function KobleSelskap({ forslag = "", onVelg }: { forslag?: string; onVelg: (s: Selskap) => void }) {
  const { selskaper, updateSelskaper } = useCrmStore();
  const [apen, setApen] = useState(false);
  const [sok, setSok] = useState(forslag);
  const treff = useMemo(() => {
    const q = sok.trim().toLowerCase();
    return (q ? selskaper.filter(s => s.firmanavn.toLowerCase().includes(q)) : selskaper).slice(0, 8);
  }, [sok, selskaper]);
  const velg = (s: Selskap) => { onVelg(s); setApen(false); };
  const opprett = () => {
    const s = nyttSelskap(sok.trim());
    updateSelskaper(prev => [...prev, s]);
    velg(s);
  };
  return (
    <Popover open={apen} onOpenChange={setApen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 gap-1"><Building2 className="h-3.5 w-3.5" />Koble til selskap</Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <Input autoFocus placeholder="Søk etter selskap" value={sok} onChange={e => setSok(e.target.value)} className="h-8" />
        <ul className="mt-2 max-h-56 overflow-y-auto">
          {treff.map(s => (
            <li key={s.id}><button type="button" onClick={() => velg(s)} className="w-full truncate rounded px-2 py-1.5 text-left text-sm hover:bg-muted">{s.firmanavn}</button></li>
          ))}
        </ul>
        {sok.trim() && !selskaper.some(s => s.firmanavn.toLowerCase() === sok.trim().toLowerCase()) && (
          <Button size="sm" variant="ghost" className="mt-1 w-full justify-start" onClick={opprett}>+ Opprett «{sok.trim()}»</Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
