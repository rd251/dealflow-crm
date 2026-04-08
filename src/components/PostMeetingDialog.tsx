import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ThumbsUp, Minus, ThumbsDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Resultat = "bra" | "nøytral" | "dårlig";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingTitle: string;
  salgsmulighet_id: string | null;
  selskap_id: string | null;
  aktivitet_id?: string | null;
}

const resultatConfig: { value: Resultat; label: string; icon: React.ReactNode; cls: string }[] = [
  { value: "bra", label: "Bra", icon: <ThumbsUp className="w-4 h-4" />, cls: "border-emerald-300 bg-emerald-500/10 text-emerald-700" },
  { value: "nøytral", label: "Nøytral", icon: <Minus className="w-4 h-4" />, cls: "border-amber-300 bg-amber-500/10 text-amber-700" },
  { value: "dårlig", label: "Dårlig", icon: <ThumbsDown className="w-4 h-4" />, cls: "border-destructive/30 bg-destructive/10 text-destructive" },
];

export default function PostMeetingDialog({ open, onOpenChange, meetingTitle, salgsmulighet_id, selskap_id }: Props) {
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [nesteSteg, setNesteSteg] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!resultat || !nesteSteg.trim()) return;
    setSaving(true);

    try {
      // 1. Create task
      const { error: taskError } = await supabase.from("oppgaver").insert({
        oppgave: nesteSteg.trim(),
        selskap_id,
        salgsmulighet_id,
        prioritet: resultat === "bra" ? "Høy" : resultat === "nøytral" ? "Medium" : "Høy",
        status: "Åpen",
      });
      if (taskError) throw taskError;

      // 2. Update salgsmulighet neste_steg if linked
      if (salgsmulighet_id) {
        const updates: Record<string, any> = { neste_steg: nesteSteg.trim() };
        if (resultat === "bra") {
          // Advance stage if appropriate
          const { data: sm } = await supabase
            .from("salgsmuligheter")
            .select("status")
            .eq("id", salgsmulighet_id)
            .single();
          if (sm) {
            const stageAdvance: Record<string, string> = {
              "Møte booket": "Behov avklart",
              "Behov avklart": "Løsning presentert",
              "Løsning presentert": "Tilbud sendt",
              "Tilbud sendt": "Beslutning",
            };
            const next = stageAdvance[sm.status || ""];
            if (next) updates.status = next;
          }
        }
        await supabase.from("salgsmuligheter").update(updates).eq("id", salgsmulighet_id);
      }

      toast.success("Oppfølging registrert og oppgave opprettet");
      onOpenChange(false);
      setResultat(null);
      setNesteSteg("");
    } catch (err) {
      console.error(err);
      toast.error("Noe gikk galt");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Etter møtet: {meetingTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Resultat</Label>
            <div className="flex gap-2 mt-2">
              {resultatConfig.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setResultat(r.value)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all",
                    resultat === r.value ? r.cls : "border-border bg-background text-muted-foreground hover:bg-muted"
                  )}
                >
                  {r.icon} {r.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="neste-steg" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Neste steg
            </Label>
            <Textarea
              id="neste-steg"
              placeholder="Hva er neste handling etter møtet?"
              value={nesteSteg}
              onChange={(e) => setNesteSteg(e.target.value)}
              className="mt-2 min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button onClick={handleSave} disabled={!resultat || !nesteSteg.trim() || saving}>
            {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            Lagre og opprett oppgave
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
