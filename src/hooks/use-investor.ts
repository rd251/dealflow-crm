import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/**
 * Investorer er en egen rolle med tilgang til én skrivebeskyttet side.
 * Rollen hentes direkte fra user_roles slik at grensesnittet aldri gjetter.
 */
export function useInvestor() {
  const { user, loading: authLoading } = useAuth();
  const [erInvestor, setErInvestor] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let aktiv = true;
    if (authLoading) return;
    if (!user) {
      setErInvestor(false);
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (!aktiv) return;
      const roller = (data || []).map((r) => r.role as string);
      setErInvestor(roller.length > 0 && roller.every((r) => r === "investor"));
      setLoading(false);
    })();
    return () => {
      aktiv = false;
    };
  }, [user, authLoading]);

  return { erInvestor, loading: loading || authLoading };
}
