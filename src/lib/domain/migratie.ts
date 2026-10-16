// Migraties van de opgeslagen database (JSONB-snapshot). Elke migratie is idempotent en verhoogt db.versie.
import { laadAanvulling } from "./aanvulling";
import { vulOntbrekendeHerkomst } from "./herkomst";
import { niveauIsInschatting, rolVanNaam } from "./verificatie";
import { standaardAanvullingInstellingen } from "./instellingen";
import { kostenEur } from "./kosten";
import { FACTOREN } from "./factors";
import { productFactoren } from "./partnerimport";
import { STANDAARD_BRANCHEBRONNEN, STANDAARD_UPCOMING_BRONNEN, hostVan } from "./bronbeleid";
import { NIEUWE_TYPES } from "./gewichten";
import type { Database, Geo, Rol } from "./types";

export const HUIDIGE_VERSIE = 15;

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

export type MigratieUitkomst = { van: number; naar: number; hernoemd: number; aanvulling?: ReturnType<typeof laadAanvulling>; herkomstAangevuld?: number; concepten?: number };

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
    (db.instellingen as { aiBudgetUsdPerMaand?: number }).aiBudgetUsdPerMaand ??= 100;
  }
  if (van < 5) {
    // B3: verrijkingsrondes met verschillenoverzicht en configureerbare bronnen.
    db.verrijkingsrondes = db.verrijkingsrondes ?? [];
    db.instellingen.verrijkingsbronnen = db.instellingen.verrijkingsbronnen ?? [];
  }
  if (van < 6) {
    // B4: opgeslagen zoekprofielen voor discovery.
    db.zoekprofielen = db.zoekprofielen ?? [];
  }
  if (van < 7) {
    // Conceptenboulevard als actieve verrijkingsbron (naast de woningconceptenbrochure via import/documenten);
    // beide voeden ook het semantische matchprofiel.
    db.instellingen.verrijkingsbronnen = db.instellingen.verrijkingsbronnen ?? [];
    const cb = db.instellingen.verrijkingsbronnen.find((b) => /conceptenboulevard/i.test(b.naam) || /conceptenboulevard\.nl/i.test(b.url));
    if (cb) cb.actief = true;
    else db.instellingen.verrijkingsbronnen.push({ id: "vb-conceptenboulevard", naam: "Conceptenboulevard", url: "https://conceptenboulevard.nl/aanbieders/", actief: true });
  }
  if (van < 8) {
    // Woningconceptenbrochure (webpagina) als actieve verrijkingsbron naast Conceptenboulevard.
    db.instellingen.verrijkingsbronnen = db.instellingen.verrijkingsbronnen ?? [];
    if (!db.instellingen.verrijkingsbronnen.some((b) => /woningconcepten|conceptenbrochure/i.test(b.naam) || /conceptenbrochure/i.test(b.url))) {
      db.instellingen.verrijkingsbronnen.push({ id: "vb-woningconceptenbrochure", naam: "Woningconceptenbrochure 2026", url: "https://conceptenboulevard.nl/projecten/conceptenbrochure-2026/id=4", actief: true });
    }
  }
  if (van < 9) {
    // Aanvulling overeenkomst v3.1, groep A (US-49 t/m US-53): goudstandaard per partnertype, bronrangorde en herkomst per basisveld.
    db.goudstandaard = db.goudstandaard ?? {};
    db.instellingen.verrijkingsbronnen = (db.instellingen.verrijkingsbronnen ?? []).map((b) => ({
      ...b,
      categorie: b.categorie ?? (/conceptenboulevard|woningconcepten|conceptenbrochure/i.test(`${b.naam} ${b.url}`) ? "eigen_uitgave" : "web")
    }));
    // Bestaande basisvelden krijgen een afgeleide herkomst met status 'voorgesteld' (alleen een mens valideert).
    uitkomst.herkomstAangevuld = db.partners.reduce((n, p) => n + vulOntbrekendeHerkomst(p), 0);
  }
  if (van < 10) {
    // US-65: twee rollen — lezer, bewerker en inkoper worden gebruiker (ook in de auditlog en bij gebruikers).
    const rol = (r: string) => (r === "beheerder" ? "beheerder" : "gebruiker");
    db.gebruikers = (db.gebruikers ?? []).map((g) => ({ ...g, rol: rol(g.rol) }));
    db.audit.forEach((a) => {
      if (a.gebruikersrol !== "beheerder" && a.gebruikersrol !== "gebruiker") a.gebruikersrol = rol(a.gebruikersrol);
    });
    // US-54: één status 'concept' voor AI-voorstellen. 'ter_controle' wordt concept; geaccepteerde discovery-kandidaten die
    // nog als (onbeoordeelde) prospect in het bestand staan worden ook concept en komen in de vrijgavewachtrij.
    let concepten = 0;
    db.partners.forEach((p) => {
      if ((p.status as string) === "ter_controle") {
        p.status = "concept";
        if (p.registratie) p.registratie.herkomstSoort = p.registratie.herkomstSoort ?? "ai-registratie";
        concepten++;
      }
    });
    db.kandidaten.forEach((k) => {
      if (k.status !== "geaccepteerd" || !k.gepromoveerdTot) return;
      const p = db.partners.find((x) => x.id === k.gepromoveerdTot);
      if (!p || p.status !== "prospect" || p.registratie?.besluit) return;
      p.status = "concept";
      p.statusReden = `Discovery-kandidaat (geaccepteerd door ${k.beoordeeldDoor ?? "onbekend"}); wacht op vrijgave door een beheerder (migratie v10).`;
      p.registratie = {
        herkomstSoort: "discovery",
        aangevraagdDoor: k.beoordeeldDoor ?? "onbekend",
        op: k.beoordeeldOp ?? k.opgehaaldOp,
        provider: k.samenvatting?.provider ?? "regels (geen externe AI)",
        bronnen: [k.bronUrl],
        herkomst: [],
        waarschuwingen: k.samenvatting?.watIsOnzeker ?? [],
        onderbouwing: { waaromPast: k.samenvatting?.waaromPastHet ?? "", bron: k.bron, bronUrl: k.bronUrl, opgehaaldOp: k.opgehaaldOp, onzeker: k.samenvatting?.watIsOnzeker ?? [] }
      };
      concepten++;
    });
    uitkomst.concepten = concepten;
  }
  if (van < 11) {
    // US-56/58/59/62: budget in bewerkingen en euro, model per functie, verrijkingsschema en keurmerkregisters.
    const std = standaardAanvullingInstellingen(nu);
    const oud = db.instellingen as typeof db.instellingen & { aiBudgetUsdPerMaand?: number };
    db.instellingen.aiBudget = db.instellingen.aiBudget ?? std.aiBudget;
    db.instellingen.modellen = { ...std.modellen, ...(db.instellingen.modellen ?? {}) };
    db.instellingen.verrijkingsschema = db.instellingen.verrijkingsschema ?? std.verrijkingsschema;
    db.instellingen.registerbronnen = db.instellingen.registerbronnen ?? std.registerbronnen;
    delete oud.aiBudgetUsdPerMaand;
    // Kosten van bestaande bewerkingen herrekenen in euro tegen de rekenprijzen (was USD per model).
    (db.aiBewerkingen ?? []).forEach((b) => {
      const x = b as typeof b & { kostenUsd?: number };
      x.kostenEur = kostenEur(b.invoerTokens, b.uitvoerTokens, db.instellingen.aiBudget);
      delete x.kostenUsd;
      b.aanroepen.forEach((a) => {
        const y = a as typeof a & { kostenUsd?: number };
        y.kostenEur = kostenEur(a.invoerTokens, a.uitvoerTokens, db.instellingen.aiBudget);
        delete y.kostenUsd;
      });
    });
  }
  if (van < 12) {
    // US-63: projectnummer (uniek) en totale tevredenheidsscore per evaluatie. Bestaande projectnummers worden opgeschoond;
    // een dubbel nummer wordt bij het latere project leeggemaakt zodat de uniciteit gegarandeerd is.
    const gezien = new Set<string>();
    db.projecten.forEach((p) => {
      const n = p.projectnummer?.trim();
      if (!n) return void delete p.projectnummer;
      if (gezien.has(n.toLowerCase())) return void delete p.projectnummer;
      gezien.add(n.toLowerCase());
      p.projectnummer = n;
    });
    db.evaluaties.forEach((e) => {
      if (e.totaalscore !== undefined && !(e.totaalscore >= 1 && e.totaalscore <= 5)) delete e.totaalscore;
    });
  }
  if (van < 13) {
    // Verificatielabel: wie een waarde heeft gevalideerd (gebruiker of beheerder) weegt mee in de matchscore. Bestaande
    // validaties krijgen de rol van de medewerker met die naam; onbekend = gebruiker. Automatisch invullen staat aan.
    db.partners.forEach((p) => {
      p.factoren.forEach((f) => {
        if (f.status === "gevalideerd" && !f.gevalideerdDoorRol) f.gevalideerdDoorRol = rolVanNaam(f.gevalideerdDoor, db.gebruikers ?? []);
      });
      Object.values(p.veldHerkomst ?? {}).forEach((h) => {
        if (h && h.status === "gevalideerd" && !h.gevalideerdDoorRol) h.gevalideerdDoorRol = rolVanNaam(h.gevalideerdDoor, db.gebruikers ?? []);
      });
    });
    db.instellingen.automatischInvullen = db.instellingen.automatischInvullen ?? true;
  }

  if (van < 14) migreerV14(db, nu);
  if (van < 15) migreerV15(db);

  db.versie = HUIDIGE_VERSIE;
  db.audit.unshift({ id: `audit-migratie-${HUIDIGE_VERSIE}`, op: nu.toISOString(), door: "systeem", gebruikersrol: "beheerder", entiteit: "database", entiteitId: "migratie", actie: `database gemigreerd van versie ${van} naar ${HUIDIGE_VERSIE}`, details: `${uitkomst.hernoemd} partner-IDs stabiel gemaakt${uitkomst.aanvulling ? `; aanvulling: ${uitkomst.aanvulling.partnersNieuw} partners, ${uitkomst.aanvulling.projectenNieuw} projecten` : ""}` });
  return uitkomst;
}

/**
 * Versie 13 → 14 (user stories demo oktober 2026):
 * - partnertypes houtbouwer en constructeur (US-01): partners uit het houtbouwersoverzicht krijgen type houtbouwer erbij,
 *   adviseurs die zich als constructeur profileren type constructeur; bestaande types blijven staan;
 * - nieuwe factoren (Paris Proof, productietijd, levertijd, kosten per m², productinformatie) en de nieuwe types in de
 *   rollen van bestaande factoren; productkenmerken worden gevuld uit de al bewaarde brondata van de import;
 * - bronbeleid (US-12/US-11): branchebronnen met rang en bronnen voor prijzen en nominaties (standaard uit);
 * - evaluaties krijgen expliciet status 'geaccepteerd' (US-21: alleen geaccepteerde tellen mee).
 */
/**
 * v15: feitelijk vs ingeschat. Bestaande niet-geverifieerde niveauwaarden uit internet of documenten (automatisch
 * ingevuld of uit de aanvulling) zijn vrijwel altijd een inschatting: ze krijgen het label 'ingeschat' met onderbouwing.
 * Waarden die een mens heeft geverifieerd of afgewezen, en berekende waarden, blijven ongemoeid.
 */
export function migreerV15(db: Database) {
  let aantal = 0;
  db.partners.forEach((p) =>
    p.factoren.forEach((f) => {
      if (f.vaststelling || f.afgeleid || f.status === "gevalideerd" || f.status === "afgewezen") return;
      if (f.bron !== "web" && f.bron !== "document" && !f.automatisch) return;
      if (!niveauIsInschatting(db.factoren.find((x) => x.id === f.factorId), f.toelichting)) return;
      f.vaststelling = "ingeschat";
      f.onderbouwing = f.onderbouwing ?? `Niveau ${String(f.waarde)} ingeschat: de bron noemt het onderwerp, niet het niveau zelf (bij de migratie zo aangemerkt).`;
      aantal++;
    })
  );
  return aantal;
}

export function migreerV14(db: Database, nu = new Date()) {
  const dag = nu.toISOString().slice(0, 10);
  // Factoren: ontbrekende toevoegen, nieuwe types aan bestaande factoren toevoegen (beheerwijzigingen blijven staan).
  FACTOREN.forEach((cat) => {
    const f = db.factoren.find((x) => x.id === cat.id);
    if (!f) {
      db.factoren.push({ ...cat });
      return;
    }
    if (f.rollen.length) {
      const extra = cat.rollen.filter((r) => (r === "houtbouwer" || r === "constructeur") && !f.rollen.includes(r));
      if (extra.length) f.rollen = [...f.rollen, ...extra];
    }
  });
  // Partnertypes.
  db.partners.forEach((p) => {
    const uitOverzicht = p.bronnen.some((b) => /houtbouw/i.test(b.url)) || (p.brongegevens ?? []).some((b) => /houtbouw/i.test(b.bron));
    const tekst = `${p.naam} ${p.omschrijving} ${p.tags.join(" ")}`.toLowerCase();
    if (uitOverzicht && !p.rollen.includes("houtbouwer")) p.rollen.push("houtbouwer");
    if (!uitOverzicht && !p.rollen.includes("houtbouwer") && /\b(clt|houtbouw(er)?|houtskeletbouw|hsb)\b/.test(tekst) && p.rollen.some((r) => r === "aannemer" || r === "leverancier")) p.rollen.push("houtbouwer");
    if (!p.rollen.includes("constructeur") && /constructeur|constructief|constructieadvies|constructief advies/.test(tekst)) p.rollen.push("constructeur");
    // Productkenmerken uit de bewaarde importrijen (bron opgave, zoals bij de oorspronkelijke import).
    (p.brongegevens ?? []).forEach((b) => {
      productFactoren(b.velden).forEach((x) => {
        if (p.factoren.some((f) => f.factorId === x.factorId)) return;
        p.factoren.push({ factorId: x.factorId, waarde: x.waarde, bron: "opgave", betrouwbaarheid: 0.6, peildatum: b.op || dag, status: "voorgesteld", toelichting: `${x.toelichting} (${b.bron})` });
      });
    });
  });
  // Bronbeleid: startlijst branchebronnen en bronnen voor prijzen/nominaties, alleen als het domein nog niet in de lijst staat.
  db.instellingen.verrijkingsbronnen = db.instellingen.verrijkingsbronnen ?? [];
  const hosts = new Set(db.instellingen.verrijkingsbronnen.map((b) => `${hostVan(b.url)}${new URL(b.url).pathname.replace(/\/$/, "")}`));
  [...STANDAARD_BRANCHEBRONNEN, ...STANDAARD_UPCOMING_BRONNEN].forEach((b) => {
    const k = `${hostVan(b.url)}${new URL(b.url).pathname.replace(/\/$/, "")}`;
    if (!hosts.has(k)) db.instellingen.verrijkingsbronnen.push({ ...b, beoordeeldDoor: "systeem (startlijst)", beoordeeldOp: nu.toISOString() });
  });
  db.instellingen.verrijkingsbronnen.forEach((b) => {
    if (!b.rang) b.rang = b.categorie === "eigen_uitgave" ? 1 : b.categorie === "branche" ? 2 : 3;
    if (!b.status) b.status = "goedgekeurd";
  });
  // Evaluaties: bestaande gelden als geaccepteerd.
  db.evaluaties.forEach((e) => {
    if (!e.status) e.status = "geaccepteerd";
    if (!e.moment) e.moment = "oplevering";
  });
  db.samenwerkingen = db.samenwerkingen ?? [];
  // Standaardprofielen krijgen een startweging voor de nieuwe types (eigen profielen blijven ongemoeid).
  db.gewichtsprofielen.forEach((gp) => {
    if (!gp.standaard) return;
    (Object.keys(NIEUWE_TYPES) as Rol[]).forEach((rol) => {
      if (!gp.perRol[rol]) gp.perRol[rol] = structuredClone(NIEUWE_TYPES[rol]);
    });
  });
}
