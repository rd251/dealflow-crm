import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/**
 * «Mine» er kun et bekvemmelighetsfilter – all CRM-data er delt internt i Snakk.
 * Valget huskes per visning slik at man slipper å sette det på nytt.
 */
export type EierFilter = "mine" | "teamet";

const LAGRINGSPREFIKS = "snakk-eierfilter";

export function useMineFilter(visning: string, standard: EierFilter = "teamet") {
  const { user } = useAuth();
  const nokkel = `${LAGRINGSPREFIKS}:${visning}`;
  const [filter, setFilter] = useState<EierFilter>(() => {
    if (typeof window === "undefined") return standard;
    const lagret = window.localStorage.getItem(nokkel);
    return lagret === "mine" || lagret === "teamet" ? lagret : standard;
  });
  const [minttNavn, setMittNavn] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(nokkel, filter);
  }, [nokkel, filter]);

  useEffect(() => {
    if (!user) return;
    let aktiv = true;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (aktiv) setMittNavn((data?.display_name as string) || "");
      });
    return () => {
      aktiv = false;
    };
  }, [user]);

  const minEpost = (user?.email || "").toLowerCase();
  const mineNavn = useMemo(
    () => [minttNavn, minEpost, minEpost.split("@")[0] || ""].filter(Boolean).map(n => n.toLowerCase()),
    [minttNavn, minEpost],
  );

  /** True når raden skal vises med gjeldende filter. */
  const tilhorerFilter = useCallback(
    (ansvarlig?: string | null, eierId?: string | null) => {
      if (filter === "teamet") return true;
      if (eierId && user && eierId === user.id) return true;
      const navn = (ansvarlig || "").trim().toLowerCase();
      if (!navn) return false;
      return mineNavn.some(mitt => navn === mitt || navn.includes(mitt) || mitt.includes(navn));
    },
    [filter, mineNavn, user],
  );

  return { filter, setFilter, kunMine: filter === "mine", tilhorerFilter, mittNavn: minttNavn };
}
