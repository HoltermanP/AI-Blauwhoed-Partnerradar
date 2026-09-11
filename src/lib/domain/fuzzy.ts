// B8/onderdeel 3: fuzzy naamvergelijking (Sørensen–Dice op bigrammen van de genormaliseerde naam).
import { normaliseerNaam } from "./discovery";

function bigrammen(s: string) {
  const set = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const b = s.slice(i, i + 2);
    set.set(b, (set.get(b) ?? 0) + 1);
  }
  return set;
}

/** Gelijkenis 0–1 tussen twee bedrijfsnamen (1 = identiek na normalisatie). */
export function naamGelijkenis(a: string, b: string) {
  const na = normaliseerNaam(a);
  const nb = normaliseerNaam(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ba = bigrammen(na);
  const bb = bigrammen(nb);
  let overlap = 0;
  let totaalA = 0;
  let totaalB = 0;
  ba.forEach((n) => (totaalA += n));
  bb.forEach((n) => (totaalB += n));
  ba.forEach((n, k) => (overlap += Math.min(n, bb.get(k) ?? 0)));
  return (2 * overlap) / (totaalA + totaalB);
}
