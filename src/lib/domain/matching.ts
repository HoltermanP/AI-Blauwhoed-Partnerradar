// Hybride matching (uitgangspunt 4): harde filters -> gewogen score -> semantische gelijkenis. AI legt uit, AI beslist niet.
import { effectieveFactoren, huidigeBelasting } from "./derive";
import { semantischeGelijkenis } from "./embedding";
import { afstandKm } from "./geo";
import type {
  CriteriumScore,
  Database,
  Factor,
  FactorWaarde,
  Kandidaat,
  Partner,
  PartnerFactor,
  Project,
  ProjectRequirement,
  RequirementFactor,
  RolResultaat,
  Uitsluiting
} from "./types";

export const DEKKING_WAARSCHUWING = 60;

function periodeOverlapt(a: { van: string; tot: string }, b: { van: string; tot: string }) {
  return new Date(a.van) <= new Date(b.tot) && new Date(b.van) <= new Date(a.tot);
}

export function profieltekst(partner: Partner) {
  return [partner.omschrijving, ...partner.referenties, ...partner.tags, ...partner.factoren.filter((f) => typeof f.waarde === "string" && f.factorId === "signatuur").map((f) => String(f.waarde))].join(". ");
}

function asNumber(v: FactorWaarde | undefined): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

/** Fit 0–1 van een partnerwaarde tegenover een eis, afhankelijk van de schaal. */
export function fitVoor(factor: Factor, gevraagd: FactorWaarde, waarde: FactorWaarde): { fit: number; toelichting: string } {
  const s = factor.schaal;
  switch (s.soort) {
    case "niveau": {
      const g = asNumber(gevraagd) ?? 3;
      const w = asNumber(waarde) ?? 0;
      if (g <= 0) return { fit: 1, toelichting: "Geen minimumniveau gevraagd." };
      const fit = Math.min(1, w / g);
      return { fit, toelichting: `Niveau ${w} van gevraagd ${g}.` };
    }
    case "getal": {
      const g = asNumber(gevraagd);
      const w = asNumber(waarde);
      if (g === null || w === null) return { fit: 0, toelichting: "Niet vergelijkbaar." };
      const bereik = (s.max ?? Math.max(g, w) * 2) - (s.min ?? 0) || 1;
      if (s.lagerIsBeter) {
        if (w <= g) return { fit: 1, toelichting: `${w} ${s.eenheid} ≤ gevraagd ${g}.` };
        return { fit: Math.max(0, 1 - (w - g) / (bereik * 0.5)), toelichting: `${w} ${s.eenheid} ligt boven gevraagd ${g}.` };
      }
      if (w >= g) return { fit: 1, toelichting: `${w} ${s.eenheid} ≥ gevraagd ${g}.` };
      return { fit: Math.max(0, w / g), toelichting: `${w} ${s.eenheid} onder gevraagd ${g}.` };
    }
    case "percentage": {
      const g = asNumber(gevraagd) ?? 0;
      const w = asNumber(waarde) ?? 0;
      if (s.lagerIsBeter) {
        if (w <= g) return { fit: 1, toelichting: `${w}% ≤ gevraagd ${g}%.` };
        return { fit: Math.max(0, 1 - (w - g) / Math.max(g, 10) / 2), toelichting: `${w}% boven gevraagd ${g}%.` };
      }
      if (w >= g) return { fit: 1, toelichting: `${w}% ≥ gevraagd ${g}%.` };
      return { fit: g ? w / g : 1, toelichting: `${w}% onder gevraagd ${g}%.` };
    }
    case "bereik": {
      const g = asNumber(gevraagd);
      if (g === null || typeof waarde !== "object" || Array.isArray(waarde)) return { fit: 0, toelichting: "Niet vergelijkbaar." };
      const { min, max } = waarde;
      if (g >= min && g <= max) return { fit: 1, toelichting: `${g} valt binnen ${min}–${max}.` };
      const afwijking = g < min ? (min - g) / Math.max(min, 1) : (g - max) / Math.max(max, 1);
      return { fit: Math.max(0, 1 - afwijking), toelichting: `${g} valt buiten ${min}–${max}.` };
    }
    case "keuze": {
      const gevraagdLijst = Array.isArray(gevraagd) ? gevraagd : [String(gevraagd)];
      const waardeLijst = Array.isArray(waarde) ? waarde : [String(waarde)];
      const overlap = gevraagdLijst.filter((x) => waardeLijst.includes(x)).length;
      return { fit: gevraagdLijst.length ? overlap / gevraagdLijst.length : 1, toelichting: `${overlap} van ${gevraagdLijst.length} gevraagde opties.` };
    }
    case "boolean":
      return { fit: Boolean(waarde) === Boolean(gevraagd) ? 1 : 0, toelichting: Boolean(waarde) ? "Ja" : "Nee" };
    case "tekst":
      return { fit: 0, toelichting: "Alleen semantisch vergeleken." };
  }
}

function zoekWaarde(factoren: PartnerFactor[], eis: RequirementFactor): PartnerFactor | undefined {
  return factoren.find((f) => f.factorId === eis.factorId && (eis.optieId ? f.optieId === eis.optieId : !f.optieId || f.optieId === undefined)) ??
    factoren.find((f) => f.factorId === eis.factorId && !eis.optieId);
}

export type MatchContext = {
  db: Database;
  project: Project;
  nu?: Date;
};

/** Harde filters (US-14): elke uitsluiting krijgt een expliciete reden. */
export function hardeFilters(partner: Partner, eis: ProjectRequirement, ctx: MatchContext, factoren: PartnerFactor[]): Uitsluiting | null {
  const nu = ctx.nu ?? new Date();
  const { project } = ctx;
  const u = (soort: Uitsluiting["soort"], reden: string, factorId?: string): Uitsluiting => ({ partnerId: partner.id, partnerNaam: partner.naam, reden, soort, factorId });

  if (partner.status === "gearchiveerd") return u("status", "Gearchiveerd: telt niet mee in matching.", "uitsluiting");
  if (partner.status === "geblokkeerd" && (!partner.geblokkeerdTot || new Date(partner.geblokkeerdTot) >= nu))
    return u("status", `Geblokkeerd${partner.statusReden ? `: ${partner.statusReden}` : ""}${partner.geblokkeerdTot ? ` (tot ${partner.geblokkeerdTot})` : ""}.`, "uitsluiting");
  if (partner.status === "afgewezen") return u("status", `Afgewezen${partner.statusReden ? `: ${partner.statusReden}` : ""}.`, "uitsluiting");
  if (!partner.rollen.includes(eis.rol)) return u("rol", `Vervult de rol ${eis.rol} niet.`);

  // Regio: projectlocatie binnen werkgebied
  const afstand = afstandKm(partner.locatie, project.locatie);
  if (afstand > partner.werkgebiedKm) return u("regio", `Projectlocatie ligt ${afstand} km van de vestiging, buiten werkgebied van ${partner.werkgebiedKm} km.`, "reisafstand");

  // Capaciteit: projectomvang binnen bandbreedte. Opgave (typische omvang) en historie worden samengevoegd tot één band met marge;
  // een dun profiel (één of twee projecten) sluit dus niet onterecht uit. Buiten de band = harde uitsluiting.
  const omvang = factoren.find((f) => f.factorId === "projectomvang");
  const banden: Array<{ min: number; max: number }> = [];
  if (omvang && typeof omvang.waarde === "object" && !Array.isArray(omvang.waarde)) banden.push(omvang.waarde);
  if (partner.typischeProjectomvang) banden.push({ min: partner.typischeProjectomvang.min * 0.5, max: partner.typischeProjectomvang.max * 1.5 });
  if (banden.length) {
    const band = { min: Math.floor(Math.min(...banden.map((b) => b.min))), max: Math.ceil(Math.max(...banden.map((b) => b.max))) };
    if (project.woningen < band.min || project.woningen > band.max)
      return u("capaciteit", `Projectomvang ${project.woningen} woningen valt buiten bandbreedte ${band.min}–${band.max} (${omvang ? "projecthistorie" : "opgave"}${omvang && partner.typischeProjectomvang ? " + opgave" : ""}).`, "projectomvang");
  }
  if (partner.maxGelijktijdigeProjecten) {
    const belasting = huidigeBelasting(partner, ctx.db, nu);
    if (belasting.aantal >= partner.maxGelijktijdigeProjecten)
      return u("capaciteit", `Draait al ${belasting.aantal} project(en), maximum gelijktijdig is ${partner.maxGelijktijdigeProjecten}.`, "max_projectomvang");
  }

  // Beschikbaarheid in projectperiode
  const nietBeschikbaar = partner.beschikbaarheid.find((b) => !b.beschikbaar && periodeOverlapt(b, { van: project.planning.start, tot: project.planning.eind }));
  if (nietBeschikbaar) return u("beschikbaarheid", `Niet beschikbaar ${nietBeschikbaar.van} t/m ${nietBeschikbaar.tot}${nietBeschikbaar.toelichting ? ` (${nietBeschikbaar.toelichting})` : ""}.`, "beschikbaarheid");

  // Financiële gezondheid
  if (partner.financieel?.risicoklasse === "hoog") return u("factor", `Financieel risico hoog: ${partner.financieel.toelichting ?? "zie kerncijfers"}.`, "financiele_gezondheid");

  // Harde factoren en minimumeisen uit het projectprofiel
  for (const e of eis.eisen) {
    const factor = ctx.db.factoren.find((f) => f.id === e.factorId);
    if (!factor || !factor.actief) continue;
    const isHard = factor.type === "hard" || e.minimumeis;
    if (!isHard) continue;
    const pf = zoekWaarde(factoren, e);
    if (!pf) {
      if (factor.type === "hard") return u("factor", `Harde eis '${factor.naam}' kan niet worden getoetst: waarde ontbreekt.`, factor.id);
      continue; // minimumeis op gewogen factor zonder data: niet uitsluiten, wel lage dekking
    }
    const { fit } = fitVoor(factor, e.gevraagd, pf.waarde);
    if (fit < 1) {
      const soort = factor.id === "co2_ladder" || factor.id === "uitsluiting" ? "certificaat" : "factor";
      return u(soort, `Voldoet niet aan ${e.minimumeis ? "minimumeis" : "harde eis"} '${factor.naam}': ${JSON.stringify(pf.waarde)} versus gevraagd ${JSON.stringify(e.gevraagd)}.`, factor.id);
    }
  }
  return null;
}

/** Gewogen score met dekkingsgraad (US-04b): ontbrekende factoren tellen niet mee; gewicht wordt herverdeeld. */
export function gewogenScore(partner: Partner, eis: ProjectRequirement, ctx: MatchContext, factoren: PartnerFactor[]) {
  const nu = ctx.nu ?? new Date();
  const criteria: CriteriumScore[] = [];
  let bekendGewicht = 0;
  let totaalGewicht = 0;

  const verlopenCerts = partner.certificaten.filter((c) => new Date(c.geldigTot) < nu).map((c) => c.type);

  eis.eisen.forEach((e) => {
    const factor = ctx.db.factoren.find((f) => f.id === e.factorId);
    if (!factor || !factor.actief || factor.type === "hard" || factor.type === "semantisch") return;
    totaalGewicht += e.gewicht;
    const optieLabel = e.optieId ? factor.opties?.find((o) => o.id === e.optieId)?.label : undefined;
    const naam = optieLabel ? `${factor.naam}: ${optieLabel}` : factor.naam;

    let pf = zoekWaarde(factoren, e);
    // Reisafstand komt uit geometrie, niet uit een vastgelegde waarde.
    if (factor.id === "reisafstand") {
      pf = { factorId: "reisafstand", waarde: afstandKm(partner.locatie, ctx.project.locatie), bron: "projecthistorie", betrouwbaarheid: 1, peildatum: nu.toISOString().slice(0, 10) };
    }
    if (factor.id === "organisatieomvang" && !pf && partner.medewerkers) {
      pf = { factorId: "organisatieomvang", waarde: partner.medewerkers, bron: "opgave", betrouwbaarheid: 0.7, peildatum: partner.bijgewerktOp.slice(0, 10) };
    }
    // Verlopen certificaat telt niet mee (US-06)
    if (pf && pf.bron === "certificaat" && factor.id === "co2_ladder" && verlopenCerts.includes("CO2-prestatieladder") && !partner.certificaten.some((c) => c.type === "CO2-prestatieladder" && new Date(c.geldigTot) >= nu)) pf = undefined;

    if (!pf) {
      criteria.push({ factorId: factor.id, factorNaam: naam, optieId: e.optieId, gevraagd: e.gevraagd, fit: null, gewicht: e.gewicht, effectiefGewicht: 0, bijdrage: 0, toelichting: "Geen waarde bekend; telt niet mee (gewicht herverdeeld)." });
      return;
    }
    const { fit, toelichting } = fitVoor(factor, e.gevraagd, pf.waarde);
    // Bewijs boven zelfbeeld: lage betrouwbaarheid dempt de fit richting neutraal (0.5).
    const gedempt = 0.5 + (fit - 0.5) * (0.5 + 0.5 * pf.betrouwbaarheid);
    bekendGewicht += e.gewicht;
    criteria.push({
      factorId: factor.id,
      factorNaam: naam,
      optieId: e.optieId,
      gevraagd: e.gevraagd,
      waarde: pf.waarde,
      fit: Math.round(gedempt * 100) / 100,
      betrouwbaarheid: pf.betrouwbaarheid,
      bron: pf.bron,
      bewijs: pf.bewijs,
      gewicht: e.gewicht,
      effectiefGewicht: 0,
      bijdrage: 0,
      toelichting: `${toelichting} Bron: ${pf.bron} (betrouwbaarheid ${Math.round(pf.betrouwbaarheid * 100)}%).${pf.afgeleid ? " Afgeleid uit historie." : ""}`
    });
  });

  // Herverdeel gewicht over bekende factoren
  let score = 0;
  criteria.forEach((c) => {
    if (c.fit === null || !bekendGewicht) return;
    c.effectiefGewicht = Math.round((c.gewicht / bekendGewicht) * 100);
    c.bijdrage = Math.round(c.fit * c.effectiefGewicht * 10) / 10;
    score += c.fit * (c.gewicht / bekendGewicht);
  });
  const dekkingsgraad = totaalGewicht ? Math.round((bekendGewicht / totaalGewicht) * 100) : 0;
  return { score: bekendGewicht ? Math.round(score * 100) : 0, dekkingsgraad, criteria };
}

export function matchRol(eis: ProjectRequirement, ctx: MatchContext): RolResultaat {
  const nu = ctx.nu ?? new Date();
  const { db, project } = ctx;
  const vraagTekst = [eis.vrijeOmschrijving ?? "", project.omschrijving, project.type, project.bouwstijl].join(". ");
  const kandidaten: Kandidaat[] = [];
  const prospects: Kandidaat[] = [];
  const uitsluitingen: Uitsluiting[] = [];

  db.partners.forEach((partner) => {
    if (!partner.rollen.includes(eis.rol)) return; // stil: rol-mismatch is geen 'afgevallen goede partij'
    const factoren = effectieveFactoren(partner, db, nu);
    const uitsluiting = hardeFilters(partner, eis, ctx, factoren);
    if (uitsluiting) {
      uitsluitingen.push(uitsluiting);
      return;
    }
    const gewogen = gewogenScore(partner, eis, ctx, factoren);
    const sem = semantischeGelijkenis(vraagTekst, profieltekst(partner));
    const semGewicht = Math.min(40, Math.max(0, eis.semantischGewicht)) / 100;
    const score = Math.round(gewogen.score * (1 - semGewicht) + sem.score * 100 * semGewicht);
    const waarschuwingen: string[] = [];
    if (gewogen.dekkingsgraad < DEKKING_WAARSCHUWING) waarschuwingen.push(`Dekkingsgraad ${gewogen.dekkingsgraad}%: score rust op weinig bekende data.`);
    const bijnaVerlopen = partner.certificaten.filter((c) => {
      const d = (new Date(c.geldigTot).getTime() - nu.getTime()) / (24 * 3600 * 1000);
      return d >= 0 && d <= 90;
    });
    bijnaVerlopen.forEach((c) => waarschuwingen.push(`Certificaat ${c.type} verloopt op ${c.geldigTot}.`));
    partner.certificaten.filter((c) => new Date(c.geldigTot) < nu).forEach((c) => waarschuwingen.push(`Certificaat ${c.type} is verlopen (${c.geldigTot}) en telt niet mee.`));
    if (partner.financieel?.risicoklasse === "midden") waarschuwingen.push("Financieel risico: midden.");
    const afh = factoren.find((f) => f.factorId === "afhankelijkheid");
    if (afh && typeof afh.waarde === "number" && afh.waarde >= 30) waarschuwingen.push(`Afhankelijkheid: Blauwhoed is ${afh.waarde}% van de omzet.`);

    const kandidaat: Kandidaat = {
      partnerId: partner.id,
      partnerNaam: partner.naam,
      status: partner.status,
      rol: eis.rol,
      score,
      gewogenScore: gewogen.score,
      semantischeScore: eis.semantischGewicht > 0 || eis.vrijeOmschrijving ? Math.round(sem.score * 100) : null,
      dekkingsgraad: gewogen.dekkingsgraad,
      waarschuwingen,
      criteria: gewogen.criteria,
      semantischeTreffers: sem.treffers,
      afstandKm: afstandKm(partner.locatie, project.locatie),
      isProspect: partner.status === "prospect"
    };
    (partner.status === "prospect" ? prospects : kandidaten).push(kandidaat);
  });

  const sorteer = (a: Kandidaat, b: Kandidaat) => b.score - a.score || (a.status === "preferred" ? -1 : 0) - (b.status === "preferred" ? -1 : 0);
  kandidaten.sort(sorteer);
  prospects.sort(sorteer);
  return { rol: eis.rol, kandidaten, prospects, uitsluitingen };
}

export function matchProject(ctx: MatchContext, eisen = ctx.project.eisen): RolResultaat[] {
  return eisen.map((eis) => matchRol(eis, ctx));
}

/** US-15: vrije semantische zoekopdracht over alle partners. */
export function semantischZoeken(db: Database, vraag: string, limiet = 20) {
  return db.partners
    .filter((p) => p.status !== "geblokkeerd" && p.status !== "gearchiveerd")
    .map((p) => {
      const s = semantischeGelijkenis(vraag, profieltekst(p));
      return { partner: p, score: Math.round(s.score * 100), treffers: s.treffers };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limiet);
}

export function valideerGewichten(eisen: RequirementFactor[], factoren: Factor[]) {
  const gewogen = eisen.filter((e) => {
    const f = factoren.find((x) => x.id === e.factorId);
    return f && f.type === "gewogen";
  });
  const som = gewogen.reduce((s, e) => s + e.gewicht, 0);
  const zwaar = gewogen.filter((e) => e.gewicht > 10).length;
  return { som, geldig: som === 100, teveelZwaar: zwaar > 6, zwaar };
}
