import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/** Hva kundekortet viser: lead, kontakt, salgsmulighet eller oppgave. */
export type KundeType = "lead" | "kontakt" | "sm" | "oppgave";
export interface KundeRef { type: KundeType; id: string }

export const kundeParam = (r: KundeRef) => `${r.type}:${r.id}`;
export function lesKundeParam(v: string | null): KundeRef | null {
  if (!v) return null;
  const [type, id] = v.split(":");
  return id && ["lead", "kontakt", "sm", "oppgave"].includes(type) ? { type: type as KundeType, id } : null;
}

/**
 * Ett globalt kort om gangen, styrt av URL-en (?kunde=lead:ID / ?selskap=ID) så det kan lenkes til.
 * `fra` husker selskapet når kundekortet ble åpnet fra selskapskortet (tilbake-knapp).
 */
export function useKort() {
  const [params, setParams] = useSearchParams();
  const sett = useCallback((fn: (p: URLSearchParams) => void) => {
    setParams(prev => { const p = new URLSearchParams(prev); p.delete("kunde"); p.delete("selskap"); p.delete("fra"); fn(p); return p; });
  }, [setParams]);
  const openKunde = useCallback((r: KundeRef, fraSelskap?: string) => sett(p => { p.set("kunde", kundeParam(r)); if (fraSelskap) p.set("fra", fraSelskap); }), [sett]);
  const openSelskap = useCallback((id: string) => sett(p => p.set("selskap", id)), [sett]);
  const lukk = useCallback(() => sett(() => {}), [sett]);
  return {
    kunde: lesKundeParam(params.get("kunde")),
    selskapId: params.get("selskap"),
    fra: params.get("fra"),
    openKunde, openSelskap, lukk,
  };
}
