import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Check, Copy, Loader2, Megaphone, RefreshCw } from "lucide-react";

interface MetaEvent {
  id: string;
  leadgen_id: string;
  page_id: string;
  form_name: string | null;
  status: string;
  attempts: number;
  last_error: string | null;
  received_at: string;
  processed_at: string | null;
  lead_id: string | null;
}

interface MetaStatus {
  tilstand: string;
  config: Record<string, boolean>;
  page_ids: string[];
  graph_version: string;
  callback_url: string;
  state: {
    connection_verified: boolean;
    verified_page_id: string | null;
    last_event_at: string | null;
    last_processed_at: string | null;
    last_error: string | null;
    last_error_at: string | null;
  } | null;
  counts: Record<string, number>;
  events: MetaEvent[];
}

const CONFIG_LABELS: Record<string, string> = {
  META_VERIFY_TOKEN: "Verifiseringstoken",
  META_APP_SECRET: "App-hemmelighet",
  META_PAGE_ACCESS_TOKEN: "Side-tilgangstoken",
  META_PAGE_IDS: "Godkjent side-ID",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "I kø",
  processing: "Behandles",
  done: "Ferdig",
  failed: "Feilet",
  ignored: "Ignorert",
};

function tid(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("nb-NO") : "—";
}

export default function MetaLeadsCard() {
  const { isAdmin } = useAuth();
  const [status, setStatus] = useState<MetaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (action: "status" | "retry" = "status") => {
    const { data, error } = await supabase.functions.invoke("meta-leads-admin", { body: { action } });
    if (error) {
      toast.error("Kunne ikke hente Meta-status");
      setLoading(false);
      return;
    }
    setStatus(data as MetaStatus);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) load();
    else setLoading(false);
  }, [isAdmin, load]);

  if (!isAdmin) return null;

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Kopiert!");
    setTimeout(() => setCopied(false), 2000);
  };

  const retry = async () => {
    setRetrying(true);
    await load("retry");
    setRetrying(false);
    toast.success("Feilede leveranser er lagt i kø på nytt");
  };

  const missing = status ? Object.entries(status.config).filter(([, ok]) => !ok).map(([k]) => k) : [];
  const badgeVariant = status?.tilstand === "Aktiv" ? "default" : "secondary";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">Meta-leads</CardTitle>
            <CardDescription>Instant Form-leads fra Facebook og Instagram rett inn i CRM-et</CardDescription>
          </div>
          {status && <Badge variant={badgeVariant}>{status.tilstand}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Laster...
          </div>
        )}

        {status && (
          <>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Callback-URL (lim inn i Meta)</Label>
              <div className="flex gap-2">
                <Input value={status.callback_url} readOnly className="font-mono text-xs" />
                <Button size="icon" variant="outline" onClick={() => copy(status.callback_url)}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 text-xs">
              <div className="rounded-lg border p-3">
                <p className="font-medium text-foreground mb-1">Konfigurasjon</p>
                <ul className="space-y-0.5 text-muted-foreground">
                  {Object.entries(status.config).map(([key, ok]) => (
                    <li key={key}>{ok ? "✓" : "—"} {CONFIG_LABELS[key] ?? key}</li>
                  ))}
                </ul>
                <p className="mt-2 text-muted-foreground">
                  Side: {status.page_ids.length ? status.page_ids.join(", ") : "ikke satt"} · Graph {status.graph_version}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="font-medium text-foreground mb-1">Status</p>
                <ul className="space-y-0.5 text-muted-foreground">
                  <li>Sist mottatt: {tid(status.state?.last_event_at ?? null)}</li>
                  <li>Sist behandlet: {tid(status.state?.last_processed_at ?? null)}</li>
                  <li>
                    Kø: {status.counts.pending} i kø · {status.counts.failed} feilet · {status.counts.done} ferdig
                  </li>
                  {status.state?.last_error && (
                    <li className="text-destructive">Siste feil: {status.state.last_error}</li>
                  )}
                </ul>
              </div>
            </div>

            {missing.length > 0 && (
              <div className="rounded-lg border bg-warning/5 border-warning/30 p-3 text-xs">
                Mangler oppsett: {missing.map((m) => CONFIG_LABELS[m] ?? m).join(", ")}. Disse legges inn som
                serverhemmeligheter — verdiene vises aldri her.
              </div>
            )}

            {status.tilstand === "Venter på Meta-oppsett" && (
              <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                Integrasjonen viser «Aktiv» først når et ekte testlead fra Meta er mottatt og behandlet.
              </div>
            )}

            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-2" onClick={() => load()}>
                <RefreshCw className="w-4 h-4" /> Oppdater
              </Button>
              <Button size="sm" variant="outline" className="gap-2" onClick={retry} disabled={retrying || status.counts.failed === 0}>
                <RefreshCw className={`w-4 h-4 ${retrying ? "animate-spin" : ""}`} /> Prøv feilede på nytt
              </Button>
            </div>

            {status.events.length > 0 && (
              <div className="rounded-lg border divide-y text-xs">
                {status.events.map((e) => (
                  <div key={e.id} className="p-2 flex flex-wrap items-center gap-2">
                    <Badge variant={e.status === "failed" ? "destructive" : e.status === "done" ? "default" : "secondary"}>
                      {STATUS_LABELS[e.status] ?? e.status}
                    </Badge>
                    <span className="font-mono">{e.leadgen_id}</span>
                    {e.form_name && <span className="text-muted-foreground">{e.form_name}</span>}
                    <span className="text-muted-foreground">{tid(e.received_at)}</span>
                    {e.attempts > 1 && <span className="text-muted-foreground">{e.attempts} forsøk</span>}
                    {e.last_error && <span className="text-destructive">{e.last_error}</span>}
                  </div>
                ))}
              </div>
            )}

            {status.events.length === 0 && (
              <p className="text-xs text-muted-foreground">Ingen Meta-leveranser mottatt ennå.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
