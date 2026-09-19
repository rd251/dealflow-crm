import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export interface GoogleTilkobling {
  last_synced_at: string | null;
  gmail_sync_enabled: boolean | null;
  gmail_last_synced_at: string | null;
}

/**
 * Hver ansatt kobler til sin egen Google-konto. Statusvisningen leser en
 * egen visning som aldri eksponerer tokens.
 */
export function useGoogleConnection() {
  const { user, loading: authLoading } = useAuth();
  const [tilkobling, setTilkobling] = useState<GoogleTilkobling | null>(null);
  const [loading, setLoading] = useState(true);

  const hent = useCallback(async () => {
    if (!user) {
      setTilkobling(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("google_calendar_connection_status" as never)
      .select("last_synced_at, gmail_sync_enabled, gmail_last_synced_at")
      .eq("user_id", user.id)
      .maybeSingle();
    setTilkobling((data as GoogleTilkobling | null) ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void hent();
  }, [authLoading, hent]);

  return {
    tilkoblet: !!tilkobling,
    gmailAktiv: !!tilkobling?.gmail_sync_enabled,
    tilkobling,
    loading: loading || authLoading,
    oppdater: hent,
  };
}
