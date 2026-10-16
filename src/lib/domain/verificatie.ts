// Verificatielabel per waarde: geverifieerd door een beheerder, door een gebruiker, nog niet geverifieerd (feitelijk van
// de bron of ingeschat met onderbouwing), verouderd of berekend uit projecthistorie. Het label weegt mee in de matchscore:
// een niet-geverifieerde waarde telt minder zwaar, een inschatting nog minder dan een feitelijke vaststelling.
import { effectieveBasisStatus, effectieveStatus } from "./herkomst";
import type { Factor, FactorWaarde, Gebruiker, Gebruikersrol, PartnerFactor, VeldHerkomst, Verificatie, Vaststelling } from "./types";

/** US-04: de statussen per waarde zoals Blauwhoed ze benoemt (voorstel, gebruikers- of beheerdersgeverifieerd, afgewezen). */
export const VERIFICATIE_LABEL: Record<Verificatie, string> = {
  beheerder: "beheerdersgeverifieerd",
  gebruiker: "gebruikersgeverifieerd",
  niet: "niet geverifieerd · feitelijk",
  ingeschat: "niet geverifieerd · ingeschat",
  verouderd: "verouderd",
  berekend: "berekend uit historie",
  afgewezen: "afgewezen"
};

export const VERIFICATIE_KLEUR: Record<Verificatie, "groen" | "blauw" | "geel" | "rood" | "mint" | "grijs"> = { beheerder: "groen", gebruiker: "blauw", niet: "geel", ingeschat: "geel", verouderd: "rood", berekend: "mint", afgewezen: "grijs" };

/**
 * Weging in de matchscore: hoe sterk de fit van een waarde doorwerkt (1 = volledig, 0 = telt als neutraal).
 * Projecthistorie is bewijs en telt volledig. Een waarde die niemand heeft bevestigd telt minder: een feit dat letterlijk
 * op de bron staat voor 60%, een onderbouwde inschatting voor 35%.
 */
export const VERIFICATIE_WEGING: Record<Verificatie, number> = { beheerder: 1, gebruiker: 0.85, berekend: 1, niet: 0.6, ingeschat: 0.35, verouderd: 0.3, afgewezen: 0 };

/** Uitleg van de weging in gewone taal (US-05), voor de matchonderbouwing en de factorenpagina. */
export const WEGING_UITLEG =
  "Hoe zeker een waarde is, telt mee in de score. Een waarde die een beheerder heeft geverifieerd of die uit projecthistorie komt, telt volledig; gebruikersgeverifieerd telt voor 85%. Een niet-geverifieerde waarde (bijvoorbeeld door de verrijking ingevuld) telt voor 60% als ze feitelijk op de bron staat en voor 35% als ze is ingeschat; een verouderde waarde telt voor 30%. Daarnaast dempt een lage bronbetrouwbaarheid (de rang van de bron) de waarde richting neutraal. Afgewezen waarden tellen niet mee.";

/** Uitleg van feitelijk en ingeschat, voor tooltips en de factorenpagina. */
export const VASTSTELLING_UITLEG: Record<Vaststelling, string> = {
  feitelijk: "Feitelijk: de waarde staat zo op de bron (website, register, document); het citaat is de onderbouwing.",
  ingeschat: "Ingeschat: de waarde staat niet letterlijk op de bron maar is afgeleid uit aanwijzingen daar (bijvoorbeeld het aantal referentieprojecten); de onderbouwing legt uit hoe."
};

/** Ontbrekende vaststelling (oude en handmatige waarden) geldt als feitelijk. */
export function vaststellingVan(x: { vaststelling?: Vaststelling }): Vaststelling {
  return x.vaststelling === "ingeschat" ? "ingeschat" : "feitelijk";
}

/**
 * Is een niveau (0–5) uit een openbare bron een inschatting? Een niveau staat zelden letterlijk op een website of in een
 * document; alleen als de bron het niveau of de trede zelf noemt (bijv. CO2-prestatieladder trede 5) is het een feit.
 */
export function niveauIsInschatting(factor: Factor | undefined, tekst: string | undefined) {
  return factor?.schaal.soort === "niveau" && !/(niveau|trede|level)\s?[0-5]\b/i.test(tekst ?? "");
}

/** Telt als geverifieerd voor de verificatiegraad van een match. */
export function isGeverifieerd(v: Verificatie | undefined) {
  return v === "beheerder" || v === "gebruiker" || v === "berekend";
}

export function verificatieVan(pf: PartnerFactor, factor: Factor | undefined, nu = new Date()): Verificatie {
  const st = effectieveStatus(pf, factor, nu);
  if (!st) return "berekend";
  if (st === "afgewezen") return "afgewezen";
  if (st === "verouderd") return "verouderd";
  if (st === "voorgesteld") return vaststellingVan(pf) === "ingeschat" ? "ingeschat" : "niet";
  return pf.gevalideerdDoorRol === "beheerder" ? "beheerder" : "gebruiker";
}

export function basisveldVerificatie(h: VeldHerkomst | undefined, vervalMaanden?: number, nu = new Date()): Verificatie {
  const st = effectieveBasisStatus(h, vervalMaanden, nu);
  if (!h || !st || st === "voorgesteld") return "niet";
  if (st === "afgewezen") return "afgewezen";
  if (st === "verouderd") return "verouderd";
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
