import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LastMeetingInfo {
  id: string;
  dato: string;
  tittel: string | null;
  aktivitet_kilde: string | null;
  ai_sammendrag?: string | null;
  ai_kundesignal?: string | null;
}

/**
 * Henter siste møte (med notater) per salgsmulighet for en gitt liste deal-IDs.
 * Returnerer map { salgsmulighet_id: LastMeetingInfo }.
 */
export function useLastMeetingsByDeal(dealIds: string[]) {
  const [byId, setById] = useState<Record<string, LastMeetingInfo>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (dealIds.length === 0) {
      setById({});
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("aktiviteter")
          .select("id, dato, tittel, aktivitet_kilde, salgsmulighet_id, ai_oppsummering")
          .in("salgsmulighet_id", dealIds)
          .eq("type", "Møte")
          .not("moetenotater", "is", null)
          .order("dato", { ascending: false });

        if (error) throw error;
        if (cancelled) return;

        const map: Record<string, LastMeetingInfo> = {};
        for (const row of data || []) {
          const sid = row.salgsmulighet_id;
          if (!sid || map[sid]) continue; // første treff (nyeste) per deal
          const ai = row.ai_oppsummering as any;
          map[sid] = {
            id: row.id,
            dato: row.dato,
            tittel: row.tittel,
            aktivitet_kilde: row.aktivitet_kilde,
            ai_sammendrag: ai?.sammendrag || null,
            ai_kundesignal: ai?.kundesignal || null,
          };
        }
        setById(map);
      } catch (e) {
        console.error("useLastMeetingsByDeal error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealIds.join(",")]);

  return { byId, loading };
}
