import { supabase } from "@/integrations/supabase/client";

export interface Mottaker {
  e_post: string;
  firmanavn: string | null;
  kilde: "lead" | "kunde" | "kontakt";
  kilde_id: string | null;
  avmeldt?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function erGyldigEpost(e?: string | null): boolean {
  return !!e && EMAIL_RE.test(e.trim());
}

/** Henter unike mottakere fra leads, kontakter og kunder (salgsmuligheter). */
export async function hentMottakere(): Promise<Mottaker[]> {
  const [leadsRes, kontakterRes, dealsRes, avmeldtRes] = await Promise.all([
    supabase.from("leads").select("id, e_post, firmanavn, status"),
    supabase.from("kontakter").select("id, e_post, navn, selskap_id, selskaper(firmanavn)"),
    supabase.from("salgsmuligheter").select("id, e_post, navn, status"),
    supabase.from("nyhetsbrev_avmeldte").select("e_post"),
  ]);

  const avmeldte = new Set(
    (avmeldtRes.data || []).map((a: any) => a.e_post.toLowerCase())
  );

  const map = new Map<string, Mottaker>();
  const add = (m: Mottaker) => {
    const key = m.e_post.trim().toLowerCase();
    if (!erGyldigEpost(key)) return;
    if (map.has(key)) return;
    map.set(key, { ...m, e_post: key, avmeldt: avmeldte.has(key) });
  };

  for (const l of (leadsRes.data || []) as any[]) {
    if (l.status === "Ikke aktuelt") continue;
    add({ e_post: l.e_post, firmanavn: l.firmanavn, kilde: "lead", kilde_id: l.id });
  }
  for (const d of (dealsRes.data || []) as any[]) {
    add({ e_post: d.e_post, firmanavn: d.navn, kilde: "kunde", kilde_id: d.id });
  }
  for (const k of (kontakterRes.data || []) as any[]) {
    add({
      e_post: k.e_post,
      firmanavn: k.selskaper?.firmanavn || k.navn,
      kilde: "kontakt",
      kilde_id: k.id,
    });
  }

  return Array.from(map.values()).sort((a, b) => a.e_post.localeCompare(b.e_post));
}
