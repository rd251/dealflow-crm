import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ThumbsUp, Minus, ThumbsDown, Loader2, Sparkles } from "lucide-react";
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

export default function PostMeetingDialog({ open, onOpenChange, meetingTitle, salgsmulighet_id, selskap_id, aktivitet_id }: Props) {
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [nesteSteg, setNesteSteg] = useState("");
  const [moetenotater, setMoetenotater] = useState("");
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggested, setAiSuggested] = useState(false);
  const [aiOppsummering, setAiOppsummering] = useState("");
  const [aiKundesignal, setAiKundesignal] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced AI call when meeting notes change
  const triggerAi = useCallback(async (notes: string) => {
    if (notes.trim().length < 15) return;
    setAiLoading(true);
    try {
      // Fetch deal context if available
      let dealName: string | undefined;
      let companyName: string | undefined;
      let dealActivities: any[] = [];

      if (salgsmulighet_id) {
        const { data: sm } = await supabase
          .from("salgsmuligheter")
          .select("navn, selskap_id")
          .eq("id", salgsmulighet_id)
          .maybeSingle();
        if (sm) dealName = sm.navn;

        const { data: acts } = await supabase
          .from("aktiviteter")
          .select("type, dato, tittel, beskrivelse, moetenotater")
          .eq("salgsmulighet_id", salgsmulighet_id)
          .order("dato", { ascending: false })
          .limit(10);
        if (acts) dealActivities = acts;
      }

      if (selskap_id) {
        const { data: sel } = await supabase
          .from("selskaper")
          .select("firmanavn")
          .eq("id", selskap_id)
          .maybeSingle();
        if (sel) companyName = sel.firmanavn;
      }

      const { data, error } = await supabase.functions.invoke("meeting-summary", {
        body: {
          meetingNotes: notes,
          meetingTitle,
          dealName,
          companyName,
          dealActivities,
        },
      });

      if (error) throw error;

      if (data?.foreslatt_neste_steg_tekst) {
        setNesteSteg(data.foreslatt_neste_steg_tekst);
        setAiSuggested(true);
      }
      if (data?.oppsummering) setAiOppsummering(data.oppsummering);
      if (data?.kundesignal) setAiKundesignal(data.kundesignal);
    } catch (err) {
      console.error("AI summary error:", err);
      // Silently fail - user can still type manually
    } finally {
      setAiLoading(false);
    }
  }, [salgsmulighet_id, selskap_id, meetingTitle]);

  // Debounce: trigger AI 1.5s after user stops typing in notes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (moetenotater.trim().length >= 15) {
      debounceRef.current = setTimeout(() => {
        triggerAi(moetenotater);
      }, 1500);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [moetenotater, triggerAi]);

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

      // 2. Save meeting notes to activity if available
      if (aktivitet_id && moetenotater.trim()) {
        await supabase.from("aktiviteter").update({ moetenotater: moetenotater.trim() }).eq("id", aktivitet_id);
      }

      // 3. Update salgsmulighet neste_steg if linked
      if (salgsmulighet_id) {
        const updates: Record<string, any> = { neste_steg: nesteSteg.trim() };
        if (resultat === "bra") {
          const { data: sm } = await supabase
            .from("salgsmuligheter")
            .select("status")
            .eq("id", salgsmulighet_id)
            .maybeSingle();
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
      setMoetenotater("");
      setAiSuggested(false);
      setAiOppsummering("");
      setAiKundesignal("");
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
            <Label htmlFor="moetenotater" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Møtenotater
            </Label>
            <Textarea
              id="moetenotater"
              placeholder="Skriv et sammendrag av møtet..."
              value={moetenotater}
              onChange={(e) => {
                setMoetenotater(e.target.value);
                setAiSuggested(false);
              }}
              className="mt-2 min-h-[80px]"
            />
          </div>

          {/* AI Summary Section */}
          {(aiOppsummering || aiKundesignal || aiLoading) && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wide">
                <Sparkles className="w-3.5 h-3.5" />
                AI-oppsummering
              </div>
              {aiLoading && !aiOppsummering && (
                <p className="text-xs text-muted-foreground animate-pulse">Analyserer møtenotater...</p>
              )}
              {aiOppsummering && (
                <p className="text-sm text-foreground leading-relaxed">{aiOppsummering}</p>
              )}
              {aiKundesignal && (
                <div className="flex items-center gap-1.5 pt-1 border-t border-primary/10">
                  <span className="text-xs font-medium text-muted-foreground">Kundesignal:</span>
                  <span className="text-xs font-semibold text-foreground">{aiKundesignal}</span>
                </div>
              )}
            </div>
          )}


            <div className="flex items-center justify-between">
              <Label htmlFor="neste-steg" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Neste steg
              </Label>
              {aiLoading && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground animate-pulse">
                  <Sparkles className="w-3 h-3" /> AI foreslår...
                </span>
              )}
              {aiSuggested && !aiLoading && (
                <span className="flex items-center gap-1 text-xs text-primary">
                  <Sparkles className="w-3 h-3" /> AI-forslag
                </span>
              )}
            </div>
            <Textarea
              id="neste-steg"
              placeholder="Hva er neste handling etter møtet?"
              value={nesteSteg}
              onChange={(e) => {
                setNesteSteg(e.target.value);
                setAiSuggested(false);
              }}
              className={cn("mt-2 min-h-[80px]", aiSuggested && "ring-1 ring-primary/30")}
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
