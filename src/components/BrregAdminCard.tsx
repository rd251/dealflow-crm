import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";
import { kallBrreg } from "@/components/SelskapInnsikt";

/** Admin: match firma mot Brønnøysund på eksisterende leads og selskaper. */
export default function BrregAdminCard() {
  const { isAdmin } = useAuth();
  const [gjenstaar, setGjenstaar] = useState<{ leads: number; selskaper: number } | null>(null);
  const [starter, setStarter] = useState(false);

  const tell = useCallback(async () => {
    const [l, s] = await Promise.all([
      supabase.from("leads").select("id", { count: "exact", head: true }).is("brreg_status", null).is("brreg_hentet", null),
      supabase.from("selskaper").select("id", { count: "exact", head: true }).is("brreg_status", null).is("brreg_hentet", null),
    ]);
    setGjenstaar({ leads: l.count ?? 0, selskaper: s.count ?? 0 });
  }, []);

  useEffect(() => { if (isAdmin) tell(); }, [isAdmin, tell]);
  useEffect(() => {
    if (!starter) return;
    const t = setInterval(tell, 10000);
    return () => clearInterval(t);
  }, [starter, tell]);

  if (!isAdmin) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Building2 className="w-4 h-4" /> Brønnøysundregistrene</CardTitle>
        <CardDescription>
          Selskaper med org.nr får registerdata direkte. Leads og selskaper uten org.nr matches automatisk, og usikre treff må du velge selv på kortet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {gjenstaar && (
          <p className="text-sm tabular-nums text-muted-foreground">
            Ikke sjekket ennå: {gjenstaar.leads} leads og {gjenstaar.selskaper} selskaper
          </p>
        )}
        <Button
          disabled={starter && !!gjenstaar && gjenstaar.leads + gjenstaar.selskaper > 0}
          onClick={async () => {
            setStarter(true);
            try {
              await kallBrreg({ handling: "match_alle" });
              toast.success("Matchingen er startet. Det går rolig (maks 2 oppslag i sekundet), så den kan ta en stund.");
            } catch (e) {
              toast.error((e as Error).message);
              setStarter(false);
            }
          }}
        >
          {starter && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Match firma på eksisterende leads og selskaper
        </Button>
      </CardContent>
    </Card>
  );
}
