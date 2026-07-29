import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import logo from "@/assets/logo.svg";

// Beta OAuth methods on supabase.auth. Typed locally so TS is happy.
type OAuthDetails = {
  client?: { name?: string; client_id?: string; redirect_uris?: string[] };
  scope?: string;
  redirect_url?: string;
  redirect_to?: string;
};
type OAuthResult = { data: OAuthDetails | null; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};

function getOAuthApi(): OAuthApi | null {
  const api = (supabase.auth as unknown as { oauth?: OAuthApi }).oauth;
  return api ?? null;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<OAuthDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!authorizationId) {
      setError("Mangler authorization_id i URL.");
      setLoading(false);
      return;
    }
    if (!user) {
      const next = window.location.pathname + window.location.search;
      navigate(`/login?next=${encodeURIComponent(next)}`, { replace: true });
      return;
    }
    const api = getOAuthApi();
    if (!api) {
      setError("OAuth-server er ikke tilgjengelig i denne klienten.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await api.getAuthorizationDetails(authorizationId);
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [authorizationId, authLoading, user, navigate]);

  async function decide(approve: boolean) {
    const api = getOAuthApi();
    if (!api) return;
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await api.approveAuthorization(authorizationId)
      : await api.denyAuthorization(authorizationId);
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setError("Ingen redirect returnert fra OAuth-serveren.");
      setBusy(false);
      return;
    }
    window.location.href = target;
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Kunne ikke laste forespørselen</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const clientName = details?.client?.name ?? "En ekstern klient";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <img src={logo} alt="Snakk CRM" className="h-10 mx-auto mb-2" />
          <CardTitle>Koble {clientName} til Snakk CRM</CardTitle>
          <CardDescription>
            Dette lar {clientName} bruke Snakk CRMs verktøy som deg. RLS og tilgangsregler i CRM
            gjelder fortsatt – klienten kan bare se og gjøre det du kan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Innlogget som <span className="font-medium text-foreground">{user?.email}</span>
          </div>
          {details?.scope && (
            <div className="text-xs text-muted-foreground">Forespurte tillatelser: {details.scope}</div>
          )}
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
              Godkjenn
            </Button>
            <Button className="flex-1" variant="outline" disabled={busy} onClick={() => decide(false)}>
              Avslå
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
