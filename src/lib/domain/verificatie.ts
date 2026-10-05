// Verificatielabel per waarde: geverifieerd door een beheerder, door een gebruiker, nog niet geverifieerd, verouderd of
// berekend uit projecthistorie. Het label weegt mee in de matchscore: een niet-geverifieerde waarde telt minder zwaar.
import { effectieveStatus } from "./herkomst";
import type { Factor, FactorWaarde, Gebruiker, Gebruikersrol, PartnerFactor, VeldHerkomst, Verificatie } from "./types";

export const VERIFICATIE_LABEL: Record<Verificatie, string> = {
  beheerder: "geverifieerd door beheerder",
  gebruiker: "geverifieerd door gebruiker",
  niet: "niet geverifieerd",
  verouderd: "verouderd",
  berekend: "berekend uit historie"
};

export const VERIFICATIE_KLEUR: Record<Verificatie, "groen" | "blauw" | "geel" | "rood" | "mint"> = { beheerder: "groen", gebruiker: "blauw", niet: "geel", verouderd: "rood", berekend: "mint" };

/**
 * Weging in de matchscore: hoe sterk de fit van een waarde doorwerkt (1 = volledig, 0 = telt als neutraal).
 * Projecthistorie is bewijs en telt volledig; een waarde die niemand heeft bevestigd telt half.
 */
export const VERIFICATIE_WEGING: Record<Verificatie, number> = { beheerder: 1, gebruiker: 0.85, berekend: 1, niet: 0.5, verouderd: 0.3 };

/** Telt als geverifieerd voor de verificatiegraad van een match. */
export function isGeverifieerd(v: Verificatie | undefined) {
  return v === "beheerder" || v === "gebruiker" || v === "berekend";
}

export function verificatieVan(pf: PartnerFactor, factor: Factor | undefined, nu = new Date()): Verificatie {
  const st = effectieveStatus(pf, factor, nu);
  if (!st) return "berekend";
  if (st === "verouderd") return "verouderd";
  if (st === "voorgesteld") return "niet";
  return pf.gevalideerdDoorRol === "beheerder" ? "beheerder" : "gebruiker";
}

export function basisveldVerificatie(h: VeldHerkomst | undefined): Verificatie {
  if (!h || h.status === "voorgesteld") return "niet";
  if (h.status === "verouderd") return "verouderd";
  return h.gevalideerdDoorRol === "beheerder" ? "beheerder" : "gebruiker";
}

/** Oude validaties (van vóór het verificatielabel) krijgen de rol van de medewerker met die naam; onbekend = gebruiker. */
export function rolVanNaam(naam: string | undefined, gebruikers: Gebruiker[]): Gebruikersrol {
  return gebruikers.find((g) => g.naam === naam)?.rol === "beheerder" ? "beheerder" : "gebruiker";
}

/** Een mens verifieert een waarde: status gevalideerd, met naam, rol en datum; de peildatum wordt vandaag. */
export function verifieer<T extends { status?: string; gevalideerdDoor?: string; gevalideerdDoorRol?: Gebruikersrol; gevalideerdOp?: string }>(x: T, door: { naam: string; rol: Gebruikersrol }, nu = new Date()) {
  const dag = nu.toISOString().slice(0, 10);
  Object.assign(x, { status: "gevalideerd", gevalideerdDoor: door.naam, gevalideerdDoorRol: door.rol, gevalideerdOp: dag });
  return dag;
}

/** Past een (door AI of regels gevonden) waarde bij de schaal van de factor? Alleen dan wordt ze automatisch ingevuld. */
export function waardePastBijFactor(factor: Factor, waarde: FactorWaarde, optieId?: string): boolean {
  if (optieId && !factor.opties?.some((o) => o.id === optieId && o.actief !== false)) return false;
  const s = factor.schaal;
  switch (s.soort) {
    case "niveau":
      return typeof waarde === "number" && waarde >= 0 && waarde <= 5;
    case "getal":
      return typeof waarde === "number" && Number.isFinite(waarde) && (s.min === undefined || waarde >= s.min) && (s.max === undefined || waarde <= s.max);
    case "percentage":
      return typeof waarde === "number" && waarde >= 0 && waarde <= 100;
    case "boolean":
      return typeof waarde === "boolean";
    case "bereik":
      return typeof waarde === "object" && !Array.isArray(waarde) && waarde !== null && waarde.min <= waarde.max;
    case "keuze": {
      const ids = Array.isArray(waarde) ? waarde : [waarde];
      return ids.length > 0 && ids.every((id) => typeof id === "string" && Boolean(factor.opties?.some((o) => o.id === id)));
    }
    case "tekst":
      return typeof waarde === "string" && waarde.trim().length > 0;
  }
}
