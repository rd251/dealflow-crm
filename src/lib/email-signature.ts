import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface EmailSignatur {
  navn: string;
  tittel: string;
  selskap: string;
}

export const TOM_SIGNATUR: EmailSignatur = { navn: "", tittel: "", selskap: "" };

/** Title-cases a person name: "irene berg-hansen" -> "Irene Berg-Hansen" */
export function tilStorForbokstav(navn?: string | null): string {
  if (!navn) return "";
  return navn
    .trim()
    .toLowerCase()
    .split(/(\s+)/)
    .map((del) =>
      /\s/.test(del)
        ? del
        : del
            .split("-")
            .map((d) => (d ? d.charAt(0).toUpperCase() + d.slice(1) : d))
            .join("-")
    )
    .join("");
}

/** First name, properly capitalized. */
export function fornavn(navn?: string | null): string {
  const full = tilStorForbokstav(navn);
  return full.split(" ")[0] || "";
}

/** Matches unresolved placeholder tokens such as [Ditt navn] or [Din tittel]. */
export const PLASSHOLDER_REGEX = /\[[^\]\n]{1,80}\]/g;

export function finnPlassholdere(...tekster: (string | null | undefined)[]): string[] {
  const funnet = new Set<string>();
  for (const t of tekster) {
    if (!t) continue;
    for (const m of t.match(PLASSHOLDER_REGEX) || []) funnet.add(m);
  }
  return [...funnet];
}

const NAVN_NOKLER = ["ditt navn", "navn", "your name", "avsender", "ditt fulle navn"];
const TITTEL_NOKLER = ["din tittel", "tittel", "your title", "stilling", "din stilling"];
const SELSKAP_NOKLER = ["ditt selskap", "selskap", "firma", "your company", "bedrift"];

/** Replaces known signature placeholders with real values from the signature. */
export function fyllInnSignatur(tekst: string, sig: EmailSignatur): string {
  if (!tekst) return tekst;
  return tekst.replace(PLASSHOLDER_REGEX, (match) => {
    const inner = match.slice(1, -1).trim().toLowerCase();
    if (sig.navn && NAVN_NOKLER.includes(inner)) return sig.navn;
    if (sig.tittel && TITTEL_NOKLER.includes(inner)) return sig.tittel;
    if (sig.selskap && SELSKAP_NOKLER.includes(inner)) return sig.selskap;
    return match;
  });
}

export function signaturBlokk(sig: EmailSignatur): string {
  const linjer = [sig.navn, sig.tittel, sig.selskap].filter(Boolean);
  return linjer.length ? `Vennlig hilsen\n${linjer.join("\n")}` : "";
}

/** Fills placeholders and appends the signature block if the body has none. */
export function medSignatur(body: string, sig: EmailSignatur): string {
  const fylt = fyllInnSignatur(body || "", sig);
  const blokk = signaturBlokk(sig);
  if (!blokk) return fylt;
  if (sig.navn && fylt.includes(sig.navn)) return fylt;
  return `${fylt.trimEnd()}\n\n${blokk}`;
}

export function signaturPromptLinje(sig: EmailSignatur): string {
  const blokk = signaturBlokk(sig);
  if (!blokk) {
    return "Ikke skriv noen signatur og aldri plassholdere i klammer som [Ditt navn].";
  }
  return `Avslutt e-posten med nøyaktig denne signaturen:\n${blokk}\nAldri bruk plassholdere i klammer som [Ditt navn] eller [Din tittel].`;
}

/** Loads the logged-in user's signature from their profile. */
export function useSignatur() {
  const [signatur, setSignatur] = useState<EmailSignatur>(TOM_SIGNATUR);
  const [loading, setLoading] = useState(true);

  const hent = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("display_name, signatur_navn, signatur_tittel, signatur_selskap")
      .eq("user_id", user.id)
      .maybeSingle();
    const p = data as any;
    setSignatur({
      navn: p?.signatur_navn || p?.display_name || "",
      tittel: p?.signatur_tittel || "",
      selskap: p?.signatur_selskap || "",
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    hent();
  }, [hent]);

  return { signatur, loading, refetch: hent };
}
