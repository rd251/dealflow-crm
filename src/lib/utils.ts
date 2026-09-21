import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function nok(v: number): string {
  return v.toLocaleString("no-NO") + " kr";
}

/** Postnummer er 4 siffer i Norge. */
const POSTNUMMER_LENGDE = 4;

/** "935518822" -> "935 518 822". Ukjent format returneres uendret. */
export function formaterOrgnr(orgnr?: string | null): string {
  const rene = (orgnr || "").replace(/\D/g, "");
  if (rene.length !== 9) return (orgnr || "").trim();
  return `${rene.slice(0, 3)} ${rene.slice(3, 6)} ${rene.slice(6)}`;
}

/**
 * Setter sammen en lesbar kontraktsadresse. Postadresse inneholder ofte bare
 * postnummer (f.eks. "4376"), mens firmaadresse er "Sirdalsveien 38, HELLELAND".
 * Da blir resultatet "Sirdalsveien 38, 4376 HELLELAND".
 */
export function kontraktAdresse(postadresse?: string | null, firmaadresse?: string | null): string {
  const post = (postadresse || "").trim();
  const firma = (firmaadresse || "").trim();
  if (!post) return firma;
  if (!firma) return post;
  const erBarePostnummer = new RegExp(`^\\d{${POSTNUMMER_LENGDE}}$`).test(post);
  if (!erBarePostnummer) return post;
  const deler = firma.split(",").map(d => d.trim()).filter(Boolean);
  if (deler.length > 1) {
    const sted = deler.pop() as string;
    return `${deler.join(", ")}, ${post} ${sted}`;
  }
  return `${firma}, ${post}`;
}
