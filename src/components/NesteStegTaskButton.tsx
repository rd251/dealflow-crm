import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { Oppgave, Prioritet } from "@/data/crm-data";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useAuth } from "@/hooks/use-auth";

interface NesteStegTaskButtonProps {
  nesteSteg: string;
  lead_id?: string;
  selskap_id?: string;
  salgsmulighet_id?: string;
  kontakt_id?: string;
  /** Kompakt variant til kanban-kort */
  compact?: boolean;
  disabled?: boolean;
}

export default function NesteStegTaskButton({
  nesteSteg,
  lead_id = "",
  selskap_id = "",
  salgsmulighet_id = "",
  kontakt_id = "",
  compact = false,
  disabled = false,
}: NesteStegTaskButtonProps) {
  const { oppgaver, updateOppgaver, generateId } = useCrmStore();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tittel, setTittel] = useState("");
  const [frist, setFrist] = useState("");
  const [prioritet, setPrioritet] = useState<Prioritet>("Medium");
  const [lagret, setLagret] = useState(false);

  const tekst = (nesteSteg || "").trim();
  if (!tekst) return null;

  const openChange = (v: boolean) => {
    if (v) {
      setTittel(tekst);
      setFrist("");
      setPrioritet("Medium");
      setLagret(false);
    }
    setOpen(v);
  };

  const lagre = () => {
    const navn = tittel.trim();
    if (!navn) return;
    const ny: Oppgave = {
      id: generateId("O", oppgaver),
      oppgave: navn,
      lead_id,
      selskap_id,
      salgsmulighet_id,
      kontakt_id,
      ansvarlig: user?.id || "",
      frist,
      prioritet,
      status: "Åpen",
      paaminnelse: true,
      notater: "",
    };
    updateOppgaver(prev => [...prev, ny]);
    setLagret(true);
    toast.success("Oppgave opprettet ✓");
    setTimeout(() => setOpen(false), 900);
  };

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          onClick={e => e.stopPropagation()}
          className={
            compact
              ? "shrink-0 inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
              : "shrink-0 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-40"
          }
          title="Gjør neste steg om til en oppgave"
        >
          <ArrowRight className="w-3 h-3" />
          {compact ? "Oppgave" : "Gjør til oppgave"}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 p-3 space-y-2"
        onClick={e => e.stopPropagation()}
      >
        {lagret ? (
          <div className="flex items-center gap-2 text-sm text-success py-2">
            <Check className="w-4 h-4" /> Oppgave opprettet ✓
          </div>
        ) : (
          <>
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Ny oppgave
            </div>
            <Input
              value={tittel}
              onChange={e => setTittel(e.target.value)}
              className="h-8 text-sm"
              placeholder="Oppgavetittel"
            />
            <div className="flex gap-2">
              <Input
                type="date"
                value={frist}
                onChange={e => setFrist(e.target.value)}
                className="h-8 text-xs flex-1"
              />
              <select
                className="border rounded-md px-2 text-xs bg-background h-8"
                value={prioritet}
                onChange={e => setPrioritet(e.target.value as Prioritet)}
              >
                <option value="Lav">Lav</option>
                <option value="Medium">Medium</option>
                <option value="Høy">Høy</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(false)}>
                Avbryt
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={lagre} disabled={!tittel.trim()}>
                Opprett oppgave
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
