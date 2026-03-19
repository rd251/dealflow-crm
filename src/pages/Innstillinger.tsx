import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { CalendarDays, RefreshCw, Unlink, CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function Innstillinger() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [connected, setConnected] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (searchParams.get("gcal_connected") === "true") {
      toast.success("Google Calendar koblet til!");
      fetchConnection();
    }
    if (searchParams.get("gcal_error")) {
      toast.error(`Feil ved tilkobling: ${searchParams.get("gcal_error")}`);
    }
  }, [searchParams]);

  const fetchConnection = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("google_calendar_connections" as any)
      .select("last_synced_at")
      .eq("user_id", user.id)
      .maybeSingle();
    setConnected(!!data);
    setLastSynced((data as any)?.last_synced_at || null);
    setLoading(false);
  };

  useEffect(() => { fetchConnection(); }, [user]);

  const connectGoogle = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-auth", {
        body: { redirect_uri: window.location.origin + "/innstillinger" },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (e: any) {
      toast.error("Kunne ikke starte Google-tilkobling: " + e.message);
      setConnecting(false);
    }
  };

  const disconnectGoogle = async () => {
    if (!user) return;
    await supabase
      .from("google_calendar_connections" as any)
      .delete()
      .eq("user_id", user.id);

    // Optionally remove synced activities
    await supabase
      .from("aktiviteter")
      .delete()
      .eq("ekstern_provider", "google_calendar");

    setConnected(false);
    setLastSynced(null);
    toast.success("Google Calendar frakoblet");
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-sync");
      if (error) throw error;
      const result = data?.results?.[0];
      toast.success(`Synkronisering fullført: ${result?.synced || 0} hendelser hentet, ${result?.pushed || 0} sendt til Google`);
      await fetchConnection();
    } catch (e: any) {
      toast.error("Synkronisering feilet: " + e.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <PageShell title="Innstillinger">
      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Google Calendar</CardTitle>
                <CardDescription>
                  Synkroniser møter automatisk mellom Google Calendar og CRM-et
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Laster...
              </div>
            ) : connected ? (
              <>
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Tilkoblet
                  </Badge>
                  {lastSynced && (
                    <span className="text-xs text-muted-foreground">
                      Sist synkronisert: {new Date(lastSynced).toLocaleString("no-NO")}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Møter synkroniseres automatisk hvert 15. minutt. Du kan også synkronisere manuelt.
                </p>
                <div className="flex gap-2">
                  <Button onClick={syncNow} disabled={syncing} variant="outline" className="gap-2">
                    <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                    {syncing ? "Synkroniserer..." : "Synkroniser nå"}
                  </Button>
                  <Button onClick={disconnectGoogle} variant="ghost" className="gap-2 text-destructive hover:text-destructive">
                    <Unlink className="w-4 h-4" />
                    Koble fra
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <XCircle className="w-3 h-3" /> Ikke tilkoblet
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Koble til Google Calendar for å automatisk synkronisere møter.
                  Deltakere matches mot kontakter basert på e-postadresse.
                </p>
                <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                  <li>Møter fra Google Calendar vises i CRM-et</li>
                  <li>CRM-møter sendes til Google Calendar</li>
                  <li>Avlyste møter fjernes automatisk</li>
                  <li>Deltakere matches mot kontakter via e-post</li>
                </ul>
                <Button onClick={connectGoogle} disabled={connecting} className="gap-2">
                  {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  )}
                  {connecting ? "Kobler til..." : "Koble til Google Calendar"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
