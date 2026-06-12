import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { CalendarDays, Mail, RefreshCw, Unlink, CheckCircle2, XCircle, Loader2, Globe, Copy, Check, Mic } from "lucide-react";
import { Input } from "@/components/ui/input";
import DeletedItemsLog from "@/components/DeletedItemsLog";
import DealBuilderSyncCard from "@/components/DealBuilderSyncCard";

interface ConnectionData {
  last_synced_at: string | null;
  gmail_sync_enabled: boolean;
  gmail_last_synced_at: string | null;
}

export default function Innstillinger() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [connected, setConnected] = useState(false);
  const [connectionData, setConnectionData] = useState<ConnectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [syncingGmail, setSyncingGmail] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [togglingGmail, setTogglingGmail] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const leadApiUrl = `${supabaseUrl}/functions/v1/lead-intake`;
  const traleWebhookUrl = `${supabaseUrl}/functions/v1/trale-webhook`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success("Kopiert!");
    setTimeout(() => setCopied(null), 2000);
  };

  useEffect(() => {
    if (searchParams.get("gcal_connected") === "true") {
      toast.success("Google-konto koblet til!");
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
      .from("google_calendar_connection_status" as any)
      .select("last_synced_at, gmail_sync_enabled, gmail_last_synced_at")
      .eq("user_id", user.id)
      .maybeSingle();
    setConnected(!!data);
    setConnectionData(data as any);
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
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast.error("Kunne ikke starte Google-tilkobling: " + e.message);
      setConnecting(false);
    }
  };

  const disconnectGoogle = async () => {
    if (!user) return;
    await supabase.from("google_calendar_connections" as any).delete().eq("user_id", user.id);
    await supabase.from("aktiviteter").delete().eq("ekstern_provider", "google_calendar");
    await supabase.from("aktiviteter").delete().eq("ekstern_provider", "gmail");
    setConnected(false);
    setConnectionData(null);
    toast.success("Google-konto frakoblet");
  };

  const syncCalendarNow = async () => {
    setSyncingCalendar(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-sync");
      if (error) throw error;
      const result = data?.results?.[0];
      toast.success(`Kalender: ${result?.synced || 0} hendelser hentet, ${result?.pushed || 0} sendt`);
      await fetchConnection();
    } catch (e: any) {
      toast.error("Kalendersynk feilet: " + e.message);
    } finally {
      setSyncingCalendar(false);
    }
  };

  const syncGmailNow = async () => {
    setSyncingGmail(true);
    try {
      const { data, error } = await supabase.functions.invoke("gmail-sync");
      if (error) throw error;
      const result = data?.results?.[0];
      toast.success(`Gmail: ${result?.synced || 0} e-poster synkronisert`);
      await fetchConnection();
    } catch (e: any) {
      toast.error("Gmail-synk feilet: " + e.message);
    } finally {
      setSyncingGmail(false);
    }
  };

  const toggleGmail = async (enabled: boolean) => {
    if (!user) return;
    setTogglingGmail(true);
    await supabase
      .from("google_calendar_connections" as any)
      .update({ gmail_sync_enabled: enabled })
      .eq("user_id", user.id);
    setConnectionData(prev => prev ? { ...prev, gmail_sync_enabled: enabled } : null);
    setTogglingGmail(false);
    if (enabled) {
      toast.success("Gmail-synkronisering aktivert");
      syncGmailNow();
    } else {
      toast.info("Gmail-synkronisering deaktivert");
    }
  };

  const GoogleIcon = () => (
    <svg className="h-4 w-4" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );

  return (
    <PageShell title="Innstillinger">
      <div className="max-w-2xl space-y-6">
        {/* Google-tilkobling */}
        {!connected && !loading && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <GoogleIcon />
                </div>
                <div>
                  <CardTitle className="text-lg">Google-konto</CardTitle>
                  <CardDescription>
                    Koble til Google for å synkronisere Calendar og Gmail
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Badge variant="secondary" className="gap-1">
                <XCircle className="w-3 h-3" /> Ikke tilkoblet
              </Badge>
              <p className="text-sm text-muted-foreground">
                Koble til Google-kontoen din for å automatisk synkronisere kalendermøter og e-poster med CRM-et.
              </p>
              <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                <li>Møter fra Google Calendar vises i CRM-et (toveis-synk)</li>
                <li>E-poster matches mot kontakter og vises som aktiviteter</li>
                <li>Deltakere matches automatisk via e-post</li>
              </ul>
              <Button onClick={connectGoogle} disabled={connecting} className="gap-2">
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
                {connecting ? "Kobler til..." : "Koble til Google"}
              </Button>
            </CardContent>
          </Card>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Laster...
          </div>
        )}

        {connected && !loading && (
          <>
            {/* Connection status */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <GoogleIcon />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">Google-konto</CardTitle>
                    <CardDescription>Tilkoblet og klar til synkronisering</CardDescription>
                  </div>
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Tilkoblet
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Button onClick={disconnectGoogle} variant="ghost" size="sm" className="gap-2 text-destructive hover:text-destructive">
                  <Unlink className="w-4 h-4" /> Koble fra Google
                </Button>
              </CardContent>
            </Card>

            {/* Google Calendar */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <CalendarDays className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Google Calendar</CardTitle>
                    <CardDescription>Toveis-synk av møter hvert 15. minutt</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {connectionData?.last_synced_at && (
                  <p className="text-xs text-muted-foreground">
                    Sist synkronisert: {new Date(connectionData.last_synced_at).toLocaleString("no-NO")}
                  </p>
                )}
                <Button onClick={syncCalendarNow} disabled={syncingCalendar} variant="outline" size="sm" className="gap-2">
                  <RefreshCw className={`w-4 h-4 ${syncingCalendar ? "animate-spin" : ""}`} />
                  {syncingCalendar ? "Synkroniserer..." : "Synkroniser kalender"}
                </Button>
              </CardContent>
            </Card>

            {/* Gmail */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">Gmail</CardTitle>
                    <CardDescription>Synkroniser sendte og mottatte e-poster som aktiviteter</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Switch
                    id="gmail-sync"
                    checked={connectionData?.gmail_sync_enabled || false}
                    onCheckedChange={toggleGmail}
                    disabled={togglingGmail}
                  />
                  <Label htmlFor="gmail-sync" className="text-sm">
                    Aktiver Gmail-synkronisering
                  </Label>
                </div>
                {connectionData?.gmail_sync_enabled && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      E-poster matches mot kontakter og leads basert på e-postadresse.
                      Kun e-poster til/fra kjente kontakter logges.
                    </p>
                    <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-0.5">
                      <li>Emne og kort preview lagres</li>
                      <li>Retning (sendt/mottatt) vises med pil</li>
                      <li>Kobles automatisk til kontakt, selskap, lead og salgsmulighet</li>
                    </ul>
                    {connectionData?.gmail_last_synced_at && (
                      <p className="text-xs text-muted-foreground">
                        Sist synkronisert: {new Date(connectionData.gmail_last_synced_at).toLocaleString("no-NO")}
                      </p>
                    )}
                    <Button onClick={syncGmailNow} disabled={syncingGmail} variant="outline" size="sm" className="gap-2">
                      <RefreshCw className={`w-4 h-4 ${syncingGmail ? "animate-spin" : ""}`} />
                      {syncingGmail ? "Synkroniserer..." : "Synkroniser Gmail"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Lead API */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Globe className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Lead API</CardTitle>
                <CardDescription>Motta leads automatisk fra nettsiden din</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">API-endepunkt (POST)</Label>
              <div className="flex gap-2">
                <Input value={leadApiUrl} readOnly className="font-mono text-xs" />
                <Button size="icon" variant="outline" onClick={() => copyToClipboard(leadApiUrl, "url")}>
                  {copied === "url" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Eksempel (fra nettskjema)</Label>
              <div className="relative">
                <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto whitespace-pre">{`fetch("${leadApiUrl}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    navn: "Ola Nordmann",
    firmanavn: "Acme AS",
    email: "ola@acme.no",
    telefon: "+4791234567",
    melding: "Ønsker en demo"
  })
})`}</pre>
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute top-2 right-2 h-7 text-xs"
                  onClick={() => copyToClipboard(`fetch("${leadApiUrl}", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({\n    navn: "Ola Nordmann",\n    firmanavn: "Acme AS",\n    email: "ola@acme.no",\n    telefon: "+4791234567",\n    melding: "Ønsker en demo"\n  })\n})`, "code")}
                >
                  {copied === "code" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </Button>
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Støttede felt:</p>
              <ul className="list-disc pl-5 space-y-0.5">
                <li><code className="bg-muted px-1 rounded">navn</code> / <code className="bg-muted px-1 rounded">kontaktperson</code> — Kontaktperson</li>
                <li><code className="bg-muted px-1 rounded">firmanavn</code> / <code className="bg-muted px-1 rounded">company</code> — Firmanavn</li>
                <li><code className="bg-muted px-1 rounded">email</code> / <code className="bg-muted px-1 rounded">e_post</code> — E-postadresse</li>
                <li><code className="bg-muted px-1 rounded">telefon</code> / <code className="bg-muted px-1 rounded">phone</code> — Telefonnummer</li>
                <li><code className="bg-muted px-1 rounded">melding</code> / <code className="bg-muted px-1 rounded">notater</code> — Melding/notater</li>
                <li><code className="bg-muted px-1 rounded">kilde</code> — Leadkilde (standard: Nettside)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
        {/* Trale møtenotater */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Mic className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Trale – Møtenotater</CardTitle>
                <CardDescription>Motta AI-genererte møtenotater automatisk fra Trale</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Webhook-URL (lim inn i Trale)</Label>
              <div className="flex gap-2">
                <Input value={traleWebhookUrl} readOnly className="font-mono text-xs" />
                <Button size="icon" variant="outline" onClick={() => copyToClipboard(traleWebhookUrl, "trale-url")}>
                  {copied === "trale-url" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">Slik setter du opp:</p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Gå til <strong>Innstillinger → Integrasjoner → Webhooks</strong> i Trale</li>
                <li>Lim inn webhook-URL-en over</li>
                <li>Velg alle felt (sammendrag, deltakere, transkripsjon)</li>
                <li>Klikk «Opprett Webhook»</li>
              </ol>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Hva skjer automatisk:</p>
              <ul className="list-disc pl-5 space-y-0.5">
                <li>Møtesammendraget lagres som en <strong>aktivitet</strong> i CRM-et</li>
                <li>Kobles til riktig salgsmulighet basert på deltakernes e-post</li>
                <li>AI foreslår <strong>neste steg</strong> basert på sammendraget</li>
                <li>Ansvarlig selger mottar et <strong>varsel</strong></li>
              </ul>
            </div>

            <div className="rounded-lg border bg-warning/5 border-warning/30 p-3 text-xs">
              <p><strong>Tips:</strong> For signaturverifisering, kontakt admin for å konfigurere en webhook-hemmelighet.</p>
            </div>
          </CardContent>
        </Card>

        {/* DealBuilder sync */}
        <DealBuilderSyncCard />
        {/* Deleted items log */}
        <DeletedItemsLog />
      </div>
    </PageShell>
  );
}
