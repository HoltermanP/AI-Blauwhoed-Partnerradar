// Migraties van de opgeslagen database (JSONB-snapshot). Elke migratie is idempotent en verhoogt db.versie.
import { laadAanvulling } from "./aanvulling";
import type { Database, Geo } from "./types";

export const HUIDIGE_VERSIE = 5;

/** Stabiel, naam-gebaseerd ID (bijv. p-giesbers-wijchen). Gelijk op elke instantie en bij elke herstart. */
export function stabielId(prefix: string, hint: string) {
  const slug = hint
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${prefix}-${slug || "x"}`;
}

/** Maakt een ID-generator die stabiele IDs geeft (met hint) en bij botsingen een volgnummer toevoegt; zonder hint een teller. */
export function maakSeedIdGenerator(bestaand: Iterable<string> = []) {
  const gebruikt = new Set(bestaand);
  const tellers = new Map<string, number>();
  return (prefix: string, hint?: string) => {
    let id: string;
    if (hint) {
      const basis = stabielId(prefix, hint);
      id = basis;
      for (let n = 2; gebruikt.has(id); n++) id = `${basis}-${n}`;
    } else {
      const n = (tellers.get(prefix) ?? 0) + 1;
      tellers.set(prefix, n);
      id = `${prefix}-seed-${n}`;
      while (gebruikt.has(id)) id = `${prefix}-seed-${tellers.set(prefix, (tellers.get(prefix) ?? 0) + 1).get(prefix)}`;
    }
    gebruikt.add(id);
    return id;
  };
}

/** Vervang overal in de database (diep) de oude ID-strings door de nieuwe. IDs zijn unieke tokens, dus exacte stringvergelijking volstaat. */
export function hernoemIds(db: Database, mapping: Map<string, string>) {
  if (!mapping.size) return;
  const loop = (waarde: unknown): unknown => {
    if (typeof waarde === "string") return mapping.get(waarde) ?? waarde;
    if (Array.isArray(waarde)) return waarde.map(loop);
    if (waarde && typeof waarde === "object") {
      const o = waarde as Record<string, unknown>;
      Object.keys(o).forEach((k) => {
        o[k] = loop(o[k]);
      });
      return o;
    }
    return waarde;
  };
  loop(db);
}

export type MigratieUitkomst = { van: number; naar: number; hernoemd: number; aanvulling?: ReturnType<typeof laadAanvulling> };

/**
 * Versie 1 → 2: tijdstempel-IDs van partners (p-<tijd>) worden stabiele naam-IDs; daarna wordt de aanvullende dataset geladen.
 * Nodig voor serverless-hosting: links moeten op elke instantie naar hetzelfde record wijzen.
 */
export function migreerDatabase(db: Database, locaties: Map<string, Geo | null>, nu = new Date()): MigratieUitkomst | null {
  const van = db.versie ?? 1;
  if (van >= HUIDIGE_VERSIE) return null;
  const uitkomst: MigratieUitkomst = { van, naar: HUIDIGE_VERSIE, hernoemd: 0 };
  if (van < 2) {
    const gen = maakSeedIdGenerator();
    const mapping = new Map<string, string>();
    db.partners.forEach((p) => {
      const nieuw = gen("p", p.naam);
      if (nieuw !== p.id) mapping.set(p.id, nieuw);
    });
    hernoemIds(db, mapping);
    uitkomst.hernoemd = mapping.size;
    const alle = [...db.partners, ...db.projecten, ...db.engagements, ...db.evaluaties, ...db.matchRuns, ...db.teams, ...db.kandidaten, ...db.verrijkingsvoorstellen, ...db.audit].map((x) => x.id);
    uitkomst.aanvulling = laadAanvulling(db, locaties, maakSeedIdGenerator(alle), nu);
  }
  if (van < 3) {
    // Eis 1: bestaande waarden krijgen een status. Web-waarden zonder menselijke acceptatie -> 'voorgesteld';
    // handmatig/geimporteerd vastgelegde waarden -> 'gevalideerd'; afgeleide (berekende) waarden krijgen er geen.
    db.partners.forEach((p) => {
      p.factoren.forEach((f) => {
        if (f.afgeleid || f.status) return;
        f.status = f.bron === "web" ? "voorgesteld" : "gevalideerd";
      });
    });
  }
  if (van < 4) {
    // Eis 2: kostenadministratie voor AI-bewerkingen.
    db.aiBewerkingen = db.aiBewerkingen ?? [];
    db.instellingen.aiBudgetUsdPerMaand = db.instellingen.aiBudgetUsdPerMaand ?? 100;
  }
  if (van < 5) {
    // B3: verrijkingsrondes met verschillenoverzicht en configureerbare bronnen.
    db.verrijkingsrondes = db.verrijkingsrondes ?? [];
    db.instellingen.verrijkingsbronnen = db.instellingen.verrijkingsbronnen ?? [];
  }
  db.versie = HUIDIGE_VERSIE;
  db.audit.unshift({ id: `audit-migratie-${HUIDIGE_VERSIE}`, op: nu.toISOString(), door: "systeem", gebruikersrol: "beheerder", entiteit: "database", entiteitId: "migratie", actie: `database gemigreerd van versie ${van} naar ${HUIDIGE_VERSIE}`, details: `${uitkomst.hernoemd} partner-IDs stabiel gemaakt${uitkomst.aanvulling ? `; aanvulling: ${uitkomst.aanvulling.partnersNieuw} partners, ${uitkomst.aanvulling.projectenNieuw} projecten` : ""}` });
  return uitkomst;
}
