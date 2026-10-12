// US-15: dekking van een matchrun per rol (hoeveel criteria echt zijn meegewogen). US-16: herweging zonder nieuwe run — de
// fit per criterium staat al in de run, dus een andere weging rekent direct een nieuwe rangschikking uit (ook in de browser).
import { isGeverifieerd } from "./verificatie";
import { onderbouwKandidaat } from "./onderbouwing";
import { dempVoorDekking } from "./matching";
import type { Kandidaat, ProjectRequirement, RolResultaat } from "./types";

export const STANDAARD_DEKKING_DREMPEL = 60;

export const criteriumSleutel = (c: { factorId: string; optieId?: string }) => `${c.factorId}|${c.optieId ?? ""}`;

export type CriteriumDekking = { sleutel: string; factorId: string; optieId?: string; naam: string; gewicht: number; bekend: number; totaal: number; pct: number };
export type RolDekking = { pct: number; geteld: number; criteria: CriteriumDekking[]; ontbrekend: CriteriumDekking[]; indicatief: boolean; drempel: number };

/**
 * Dekking per rol: het gemiddelde aandeel (in gewicht) van de criteria waarvoor bij de beste kandidaten echt een waarde
 * bekend was. Criteria die bij minder dan de helft van die kandidaten bekend zijn, heten 'ontbrekend'.
 */
export function dekkingVanRol(r: RolResultaat, drempel = STANDAARD_DEKKING_DREMPEL, top = 10): RolDekking {
  const basis = (r.kandidaten.length ? r.kandidaten : r.prospects).slice(0, top);
  if (!basis.length) return { pct: 0, geteld: 0, criteria: [], ontbrekend: [], indicatief: true, drempel };
  const map = new Map<string, CriteriumDekking>();
  basis.forEach((k) =>
    k.criteria.forEach((c) => {
      const s = criteriumSleutel(c);
      const x = map.get(s) ?? { sleutel: s, factorId: c.factorId, optieId: c.optieId, naam: c.factorNaam, gewicht: c.gewicht, bekend: 0, totaal: 0, pct: 0 };
      x.totaal++;
      if (c.fit !== null) x.bekend++;
      map.set(s, x);
    })
  );
  const criteria = Array.from(map.values()).map((c) => ({ ...c, pct: c.totaal ? Math.round((c.bekend / c.totaal) * 100) : 0 }));
  const pct = Math.round(basis.reduce((s, k) => s + k.dekkingsgraad, 0) / basis.length);
  const ontbrekend = criteria.filter((c) => c.pct < 50).sort((a, b) => b.gewicht - a.gewicht);
  return { pct, geteld: basis.length, criteria, ontbrekend, indicatief: pct < drempel, drempel };
}

export type Weging = { gewichten: Record<string, number>; semantisch: number; demping?: boolean };

/** De weging zoals die in de run is gebruikt (per criterium het gewicht uit de projecteisen). */
export function wegingVanEis(eis: ProjectRequirement | undefined, r: RolResultaat): Weging {
  const gewichten: Record<string, number> = {};
  const voorbeeld = r.kandidaten[0] ?? r.prospects[0];
  voorbeeld?.criteria.forEach((c) => (gewichten[criteriumSleutel(c)] = c.gewicht));
  eis?.eisen.forEach((e) => {
    const s = criteriumSleutel(e);
    if (s in gewichten) gewichten[s] = e.gewicht;
  });
  const demping = [...r.kandidaten, ...r.prospects].some((k) => k.ongedempteGewogenScore !== undefined);
  return { gewichten, semantisch: Math.min(40, Math.max(0, eis?.semantischGewicht ?? 0)), demping };
}

/** Herbereken score, dekking, verificatiegraad en onderbouwing van een kandidaat met een andere weging (zelfde formule als de matching). */
export function herweegKandidaat(k: Kandidaat, w: Weging): Kandidaat {
  const criteria = k.criteria.map((c) => ({ ...c, gewicht: Math.max(0, w.gewichten[criteriumSleutel(c)] ?? c.gewicht) }));
  const totaal = criteria.reduce((s, c) => s + c.gewicht, 0);
  const bekend = criteria.filter((c) => c.fit !== null).reduce((s, c) => s + c.gewicht, 0);
  const geverifieerd = criteria.filter((c) => c.fit !== null && isGeverifieerd(c.verificatie)).reduce((s, c) => s + c.gewicht, 0);
  let gewogen = 0;
  criteria.forEach((c) => {
    if (c.fit === null || !bekend) {
      c.effectiefGewicht = 0;
      c.bijdrage = 0;
      return;
    }
    c.effectiefGewicht = Math.round((c.gewicht / bekend) * 100);
    c.bijdrage = Math.round(c.fit * c.effectiefGewicht * 10) / 10;
    gewogen += c.fit * (c.gewicht / bekend);
  });
  const ruw = bekend ? Math.round(gewogen * 100) : 0;
  const dekkingsgraad = totaal ? Math.round((bekend / totaal) * 100) : 0;
  const demping = Boolean(w.demping) && criteria.length > 0;
  const gewogenScore = demping ? dempVoorDekking(ruw, dekkingsgraad) : ruw;
  const s = Math.min(40, Math.max(0, w.semantisch)) / 100;
  const score = Math.round(gewogenScore * (1 - s) + (k.semantischeScore ?? 0) * s);
  const nieuw: Kandidaat = { ...k, criteria, gewogenScore, ongedempteGewogenScore: demping ? ruw : undefined, score, dekkingsgraad, verificatiegraad: bekend ? Math.round((geverifieerd / bekend) * 100) : 0 };
  nieuw.onderbouwing = onderbouwKandidaat(nieuw);
  return nieuw;
}

export function herweegResultaat(r: RolResultaat, w: Weging): RolResultaat {
  const sorteer = (a: Kandidaat, b: Kandidaat) => b.score - a.score || (a.status === "preferred" ? -1 : 0) - (b.status === "preferred" ? -1 : 0);
  return { ...r, kandidaten: r.kandidaten.map((k) => herweegKandidaat(k, w)).sort(sorteer), prospects: r.prospects.map((k) => herweegKandidaat(k, w)).sort(sorteer) };
}

/** Normaliseer gewichten zodat de gewogen criteria samen 100 zijn (eis van de projecteisen en gewichtsprofielen). */
export function normaliseerGewichten(gewichten: Record<string, number>): Record<string, number> {
  const som = Object.values(gewichten).reduce((s, x) => s + Math.max(0, x), 0);
  if (!som) return gewichten;
  const sleutels = Object.keys(gewichten);
  const uit: Record<string, number> = {};
  let rest = 100;
  sleutels.forEach((k, i) => {
    const v = i === sleutels.length - 1 ? rest : Math.round((Math.max(0, gewichten[k]) / som) * 100);
    uit[k] = v;
    rest -= v;
  });
  return uit;
}
