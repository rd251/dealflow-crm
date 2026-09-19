import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { BellRing, Loader2 } from "lucide-react";
import { NUDGE_DAGER_MAKS, NUDGE_DAGER_MIN, NUDGE_DAGER_STANDARD, NUDGE_MAKS_PER_DAG } from "@/lib/nudge-rules";

/** Personlige innstillinger for oppfølgingspåminnelser og e-poster. */
export default function NudgeSettingsCard() {
  const { user } = useAuth();
  const [laster, setLaster] = useState(true);
  const [lagrer, setLagrer] = useState(false);
  const [nudgeAktiv, setNudgeAktiv] = useState(true);
  const [nudgeDager, setNudgeDager] = useState(NUDGE_DAGER_STANDARD);
  const [ukesagenda, setUkesagenda] = useState(true);
  const [dagligEpost, setDagligEpost] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("nudge_aktiv, nudge_dager, ukesagenda_aktiv, daglig_epost_aktiv")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setNudgeAktiv(data.nudge_aktiv ?? true);
        setNudgeDager(data.nudge_dager ?? NUDGE_DAGER_STANDARD);
        setUkesagenda(data.ukesagenda_aktiv ?? true);
        setDagligEpost(data.daglig_epost_aktiv ?? true);
      }
      setLaster(false);
    })();
  }, [user]);

  const lagre = async () => {
    if (!user) return;
    const dager = Math.min(NUDGE_DAGER_MAKS, Math.max(NUDGE_DAGER_MIN, Math.round(nudgeDager) || NUDGE_DAGER_STANDARD));
    setLagrer(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        nudge_aktiv: nudgeAktiv,
        nudge_dager: dager,
        ukesagenda_aktiv: ukesagenda,
        daglig_epost_aktiv: dagligEpost,
      })
      .eq("user_id", user.id);
    setLagrer(false);
    if (error) {
      toast.error("Kunne ikke lagre innstillingene");
      return;
    }
    setNudgeDager(dager);
    toast.success("Innstillinger lagret");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BellRing className="h-4 w-4" /> Oppfølgingspåminnelser
        </CardTitle>
        <CardDescription>
          Når du venter på svar fra noen, får du én rolig e-post om akkurat den personen. Maks {NUDGE_MAKS_PER_DAG} per dag.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {laster ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Laster...
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Switch id="nudge-aktiv" checked={nudgeAktiv} onCheckedChange={setNudgeAktiv} />
              <Label htmlFor="nudge-aktiv" className="text-sm">Send meg påminnelser</Label>
            </div>
            <div className="space-y-1.5 max-w-[220px]">
              <Label htmlFor="nudge-dager">Antall dager uten svar</Label>
              <Input
                id="nudge-dager"
                type="number"
                min={NUDGE_DAGER_MIN}
                max={NUDGE_DAGER_MAKS}
                value={nudgeDager}
                onChange={(e) => setNudgeDager(Number(e.target.value))}
                className="tabular-nums"
                disabled={!nudgeAktiv}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch id="ukesagenda" checked={ukesagenda} onCheckedChange={setUkesagenda} />
              <Label htmlFor="ukesagenda" className="text-sm">Ukesagenda mandag morgen</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="daglig-epost" checked={dagligEpost} onCheckedChange={setDagligEpost} />
              <Label htmlFor="daglig-epost" className="text-sm">Daglig plan på e-post</Label>
            </div>
            <Button onClick={lagre} disabled={lagrer} size="sm">
              {lagrer && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lagre innstillinger
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
