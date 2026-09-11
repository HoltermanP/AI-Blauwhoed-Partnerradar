// B8: datakwaliteit per veld (factor) en per partnertype (rol): volledigheid, actualiteit en betrouwbaarheid.
import { effectieveStatus } from "./herkomst";
import type { Database, Rol } from "./types";

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
};

/** Kwaliteit per veld, optioneel beperkt tot één rol (partnertype). */
export function veldKwaliteit(db: Database, rol?: Rol, nu = new Date()): VeldKwaliteit[] {
  const partners = db.partners.filter((p) => p.status !== "gearchiveerd" && (!rol || p.rollen.includes(rol)));
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
        gemBetrouwbaarheid: waarden.length ? Math.round((waarden.reduce((s, x) => s + x.betrouwbaarheid, 0) / waarden.length) * 100) : null
      };
    })
    .sort((a, b) => a.pctVolledig - b.pctVolledig);
}

/** Basisvelden (naam/kvk/plaats/website/omschrijving) — volledigheid over het bestand. */
export function basisVeldKwaliteit(db: Database, rol?: Rol) {
  const partners = db.partners.filter((p) => p.status !== "gearchiveerd" && (!rol || p.rollen.includes(rol)));
  const pct = (n: number) => (partners.length ? Math.round((n / partners.length) * 100) : 0);
  return [
    { veld: "KVK-nummer", pct: pct(partners.filter((p) => p.kvk).length) },
    { veld: "Vestigingsplaats", pct: pct(partners.filter((p) => p.vestigingsplaats).length) },
    { veld: "Website", pct: pct(partners.filter((p) => p.website).length) },
    { veld: "Omschrijving", pct: pct(partners.filter((p) => p.omschrijving.length >= 40).length) },
    { veld: "Contactpersoon", pct: pct(partners.filter((p) => p.contactpersonen.length).length) },
    { veld: "Referenties", pct: pct(partners.filter((p) => p.referenties.length).length) }
  ];
}
