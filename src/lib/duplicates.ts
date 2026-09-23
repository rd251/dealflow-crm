import type { Kontakt, Selskap } from "@/data/crm-data";

// Terskler for dublettforslag
export const NAVN_LIKHET_TERSKEL = 0.88; // 0–1, hvor likt navnet må være
export const MIN_NAVN_LENGDE = 3;
export const MAKS_FORSLAG = 200;

export type DublettGrunn =
  | "Samme e-post"
  | "Samme telefon"
  | "Samme navn"
  | "Likt navn"
  | "Samme org.nr."
  | "Samme nettadresse";

export interface DublettPar<T> {
  key: string;
  grunn: DublettGrunn;
  a: T;
  b: T;
}

const SELSKAPSFORMER = /\b(as|asa|ab|a\/s|aps|oy|ltd|limited|inc|gmbh|sa|da|ans|nuf)\b/g;

export function normaliserNavn(v: string): string {
  return (v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9æøå\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normaliserFirmanavn(v: string): string {
  return normaliserNavn(v).replace(SELSKAPSFORMER, "").replace(/\s+/g, " ").trim();
}

export function normaliserEpost(v: string): string {
  return (v || "").trim().toLowerCase();
}

export function normaliserTelefon(v: string): string {
  const t = (v || "").replace(/[^\d]/g, "");
  return t.length >= 8 ? t.slice(-8) : "";
}

export function normaliserDomene(v: string): string {
  return (v || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

export function normaliserOrgnr(v: string): string {
  const t = (v || "").replace(/\D/g, "");
  return t.length === 9 ? t : "";
}

/** Likhet 0–1 basert på Levenshtein-avstand. */
export function likhet(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) / Math.max(m, n) > 0.34) return 0;
  let forrige = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const rad = [i];
    for (let j = 1; j <= n; j++) {
      rad[j] = Math.min(
        forrige[j] + 1,
        rad[j - 1] + 1,
        forrige[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    forrige = rad;
  }
  return 1 - forrige[n] / Math.max(m, n);
}

function parNokkel(type: string, a: string, b: string): string {
  return [type, ...[a, b].sort()].join(":");
}

function samle<T extends { id: string }>(
  rader: T[],
  grunn: DublettGrunn,
  nokkel: (r: T) => string,
  ut: Map<string, DublettPar<T>>,
) {
  const grupper = new Map<string, T[]>();
  for (const r of rader) {
    const k = nokkel(r);
    if (!k) continue;
    const liste = grupper.get(k);
    if (liste) liste.push(r);
    else grupper.set(k, [r]);
  }
  for (const liste of grupper.values()) {
    if (liste.length < 2) continue;
    for (let i = 0; i < liste.length - 1; i++) {
      for (let j = i + 1; j < liste.length; j++) {
        const key = parNokkel("", liste[i].id, liste[j].id).slice(1);
        if (!ut.has(key)) ut.set(key, { key, grunn, a: liste[i], b: liste[j] });
      }
    }
  }
}

function fuzzyNavn<T extends { id: string }>(
  rader: T[],
  navnAv: (r: T) => string,
  ut: Map<string, DublettPar<T>>,
) {
  const med = rader
    .map(r => ({ r, n: navnAv(r) }))
    .filter(x => x.n.length >= MIN_NAVN_LENGDE);
  for (let i = 0; i < med.length - 1; i++) {
    for (let j = i + 1; j < med.length; j++) {
      const key = parNokkel("", med[i].r.id, med[j].r.id).slice(1);
      if (ut.has(key)) continue;
      if (med[i].n === med[j].n) continue; // dekkes av «Samme navn»
      if (likhet(med[i].n, med[j].n) >= NAVN_LIKHET_TERSKEL) {
        ut.set(key, { key, grunn: "Likt navn", a: med[i].r, b: med[j].r });
      }
    }
  }
}

export function finnPersonDubletter(kontakter: Kontakt[]): DublettPar<Kontakt>[] {
  const ut = new Map<string, DublettPar<Kontakt>>();
  samle(kontakter, "Samme e-post", k => normaliserEpost(k.e_post), ut);
  samle(kontakter, "Samme telefon", k => normaliserTelefon(k.telefon), ut);
  samle(kontakter, "Samme navn", k => normaliserNavn(k.navn), ut);
  fuzzyNavn(kontakter, k => normaliserNavn(k.navn), ut);
  return [...ut.values()].slice(0, MAKS_FORSLAG);
}

export function finnSelskapDubletter(selskaper: Selskap[]): DublettPar<Selskap>[] {
  const ut = new Map<string, DublettPar<Selskap>>();
  samle(selskaper, "Samme org.nr.", s => normaliserOrgnr(s.orgnr), ut);
  samle(selskaper, "Samme nettadresse", s => normaliserDomene(s.domene), ut);
  samle(selskaper, "Samme navn", s => normaliserFirmanavn(s.firmanavn), ut);
  fuzzyNavn(selskaper, s => normaliserFirmanavn(s.firmanavn), ut);
  return [...ut.values()].slice(0, MAKS_FORSLAG);
}

export function dublettNokkel(aId: string, bId: string): string {
  return [aId, bId].sort().join(":");
}
