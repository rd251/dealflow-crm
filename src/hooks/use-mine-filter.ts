import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";

/**
 * «Mine» er kun et bekvemmelighetsfilter – all CRM-data er delt i Snakk.
 * Valget huskes per visning slik at man slipper å sette det på nytt.
 */
export type EierFilter = "mine" | "teamet";

const LAGRINGSPREFIKS = "snakk-eierfilter";

export function useMineFilter(visning: string, standard: EierFilter = "teamet") {
  const { user } = useAuth();
  const nokkel = `${LAGRINGSPREFIKS}:${visning}`;
  const [filter, setFilterState] = useState<EierFilter>(() => {
    if (typeof window === "undefined") return standard;
    const lagret = window.localStorage.getItem(nokkel);
    return lagret === "mine" || lagret === "teamet" ? lagret : standard;
  });

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(nokkel, filter);
  }, [nokkel, filter]);

  const setFilter = useCallback((neste: EierFilter) => setFilterState(neste), []);

  /** True når raden skal vises med gjeldende filter. */
  const tilhorerFilter = useCallback(
    (eierId?: string | null) => filter === "teamet" || (!!user && eierId === user.id),
    [filter, user],
  );

  return { filter, setFilter, kunMine: filter === "mine", tilhorerFilter, brukerId: user?.id ?? null };
}
