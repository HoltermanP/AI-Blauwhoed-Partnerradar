// B8: datakwaliteit per veld (factor) en per partnertype (rol): volledigheid, actualiteit en betrouwbaarheid.
import { basisveldWaarde, effectieveStatus } from "./herkomst";
import type { BasisVeld, Database, Factor, FactorWaardeStatus, Partner, Rol } from "./types";

export type VeldKwaliteit = {
  factorId: string;
  naam: string;
  categorie: string;
  relevant: number;
  metWaarde: number;
  pctVolledig: number;
  pctVerouderd: number;
  pctGevalideerd: number;
  gemBetrouwbaarheid: number | null;
  /** US-53: aantal partners waarvoor bij verrijking geen betrouwbare bron is gevonden. */
  geenBron: number;
};

/** Kwaliteit per veld, optioneel beperkt tot één rol (partnertype). */
export function veldKwaliteit(db: Database, rol?: Rol, nu = new Date()): VeldKwaliteit[] {
  const partners = db.partners.filter((p) => p.status !== "gearchiveerd" && p.status !== "concept" && (!rol || p.rollen.includes(rol)));
  return db.factoren
    .filter((f) => f.actief && !f.afgeleid)
    .map((f) => {
      const relevant = partners.filter((p) => f.rollen.length === 0 || p.rollen.some((r) => f.rollen.includes(r)));
      const met = relevant.map((p) => p.factoren.filter((x) => x.factorId === f.id)).filter((xs) => xs.length > 0);
      const waarden = met.flat();
      const verouderd = waarden.filter((x) => effectieveStatus(x, f, nu) === "verouderd").length;
      const gevalideerd = waarden.filter((x) => effectieveStatus(x, f, nu) === "gevalideerd").length;
      return {
        factorId: f.id,
        naam: f.naam,
        categorie: f.categorie,
        relevant: relevant.length,
        metWaarde: met.length,
        pctVolledig: relevant.length ? Math.round((met.length / relevant.length) * 100) : 0,
        pctVerouderd: waarden.length ? Math.round((verouderd / waarden.length) * 100) : 0,
        pctGevalideerd: waarden.length ? Math.round((gevalideerd / waarden.length) * 100) : 0,
        gemBetrouwbaarheid: waarden.length ? Math.round((waarden.reduce((s, x) => s + x.betrouwbaarheid, 0) / waarden.length) * 100) : null,
        geenBron: relevant.filter((p) => Object.keys(p.geenBron ?? {}).some((k) => k === `factor:${f.id}` || k.startsWith(`factor:${f.id}/`))).length
      };
    })
    .sort((a, b) => a.pctVolledig - b.pctVolledig);
}

/** Basisvelden (naam/kvk/plaats/website/omschrijving) — volledigheid over het bestand. */
export function basisVeldKwaliteit(db: Database, rol?: Rol) {
  const partners = db.partners.filter((p) => p.status !== "gearchiveerd" && p.status !== "concept" && (!rol || p.rollen.includes(rol)));
  const pct = (n: number) => (partners.length ? Math.round((n / partners.length) * 100) : 0);
  const extra = (veld: BasisVeld) => ({
    gevalideerd: pct(partners.filter((p) => basisveldWaarde(p, veld) && p.veldHerkomst?.[veld]?.status === "gevalideerd").length),
    geenBron: partners.filter((p) => p.geenBron?.[`basis:${veld}`]).length
  });
  return [
    { veld: "KVK-nummer", pct: pct(partners.filter((p) => p.kvk).length), ...extra("kvk") },
    { veld: "Vestigingsplaats", pct: pct(partners.filter((p) => p.vestigingsplaats).length), ...extra("vestigingsplaats") },
    { veld: "Website", pct: pct(partners.filter((p) => p.website).length), ...extra("website") },
    { veld: "Omschrijving", pct: pct(partners.filter((p) => p.omschrijving.length >= 40).length), ...extra("omschrijving") },
    { veld: "Contactpersoon", pct: pct(partners.filter((p) => p.contactpersonen.length).length), gevalideerd: 0, geenBron: 0 },
    { veld: "Referenties", pct: pct(partners.filter((p) => p.referenties.length).length), gevalideerd: 0, geenBron: 0 }
  ];
}

export type StatusVerdeling = { gevalideerd: number; voorgesteld: number; verouderd: number; totaal: number };

/** US-66: verdeling gevalideerd / voorgesteld / verouderd over alle vastgelegde waarden (factoren én basisvelden). */
export function statusVerdeling(partners: Partner[], factoren: Factor[], nu = new Date()): StatusVerdeling {
  const fmap = new Map(factoren.map((f) => [f.id, f]));
  const v: StatusVerdeling = { gevalideerd: 0, voorgesteld: 0, verouderd: 0, totaal: 0 };
  partners.forEach((p) => {
    p.factoren.forEach((pf) => {
      const st = effectieveStatus(pf, fmap.get(pf.factorId), nu);
      if (!st) return;
      v[st]++;
      v.totaal++;
    });
    Object.entries(p.veldHerkomst ?? {}).forEach(([veld, h]) => {
      if (!h || !basisveldWaarde(p, veld as BasisVeld)) return;
      v[h.status]++;
      v.totaal++;
    });
  });
  return v;
}

/** Status van een partner voor de filter "waardestatus": heeft hij minstens één waarde met deze status? */
export function heeftWaardeStatus(p: Partner, status: FactorWaardeStatus, factoren: Factor[], nu = new Date()) {
  const fmap = new Map(factoren.map((f) => [f.id, f]));
  return p.factoren.some((pf) => effectieveStatus(pf, fmap.get(pf.factorId), nu) === status) || Object.entries(p.veldHerkomst ?? {}).some(([veld, h]) => h?.status === status && basisveldWaarde(p, veld as BasisVeld));
}
