// Hybride matching (uitgangspunt 4): harde filters -> gewogen score -> semantische gelijkenis. AI legt uit, AI beslist niet.
import { effectieveFactoren, huidigeBelasting } from "./derive";
import { semantischeGelijkenis, tokens } from "./embedding";
import { afstandKm } from "./geo";
import { zichtbaar } from "./zichtbaarheid";
import { isGeverifieerd, VERIFICATIE_LABEL, VERIFICATIE_WEGING, verificatieVan } from "./verificatie";
import { onderbouwKandidaat } from "./onderbouwing";
import { evaluatieTelt, totaalscore } from "./tevredenheid";
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

/**
 * Correctie voor lage dekking: criteria zonder gegevens tellen als neutraal (50) in plaats van weg te vallen. Een partner
 * met één bekend, goed scorend criterium eindigt zo niet boven een partner van wie veel bekend is.
 */
export function dempVoorDekking(gewogen: number, dekkingsgraad: number) {
  const d = Math.max(0, Math.min(100, dekkingsgraad)) / 100;
  return Math.round(d * gewogen + (1 - d) * 50);
}
/** Onder deze verificatiegraad krijgt een kandidaat een waarschuwing: de score rust vooral op onbevestigde gegevens. */
export const VERIFICATIE_WAARSCHUWING = 50;

function periodeOverlapt(a: { van: string; tot: string }, b: { van: string; tot: string }) {
  return new Date(a.van) <= new Date(b.tot) && new Date(b.van) <= new Date(a.tot);
}

// De factoren waaruit het semantische profiel wordt opgebouwd. Standaard de opgegeven factoren; geef de
// effectieve factoren (incl. afgeleide projecttype-/bouwsysteem-ervaring uit projecthistorie) mee voor volledige recall.
export function profieltekst(partner: Partner, factoren: PartnerFactor[] = partner.factoren) {
  return [
    partner.omschrijving,
    ...partner.referenties,
    ...partner.tags,
    // Gestructureerde factorwaarden tellen mee in het semantische profiel, zodat een vraag als
    // "ervaring met appartementen" ook partners vindt die appartementen alleen als projecttype-optie
    // (afgeleid uit projecthistorie) hebben en niet letterlijk in hun omschrijving noemen. Niveau 0 telt niet mee.
    ...factoren.flatMap((f) => {
      const w = f.waarde;
      const leeg = w == null || w === false || w === "" || (typeof w === "number" && w === 0) || (Array.isArray(w) && !w.length);
      if (leeg) return [];
      if (f.optieId) return [f.optieId]; // de optie (bv. projecttype "appartementen") is het onderwerp
      if (typeof w === "string") return [`${f.factorId} ${w}`];
      if (Array.isArray(w)) return [w.join(" ")];
      if (w === true || typeof w === "number") return [f.factorId]; // vlag/niveau zonder optie: de factor zelf (bv. demontabel)
      return [];
    }),
    // Conceptgegevens uit geimporteerde bronnen (o.a. Woningconceptenbrochure en Conceptenboulevard): elke ruwe rij
    // (woningconcept) telt semantisch mee in matching en zoeken.
    ...(partner.brongegevens ?? []).slice(0, 6).flatMap((b) => [b.titel ?? "", ...Object.entries(b.velden).map(([k, v]) => `${k} ${v}`)]),
    // Teksten van vastgelegde documenten (brochures, projectbladen).
    ...(partner.documenten ?? []).map((d) => `${d.naam}. ${d.tekst ?? ""}`.slice(0, 4000))
  ]
    .filter(Boolean)
    .join(". ")
    .slice(0, 40000);
}

/** Bronnen die het semantische profiel voeden buiten het eigen dossier (voor de uitleg per kandidaat). */
export function profielBronnen(partner: Partner): string[] {
  return Array.from(
    new Set([
      ...(partner.brongegevens ?? []).map((b) => b.bron),
      ...(partner.documenten ?? []).filter((d) => d.tekst).map((d) => `document: ${d.naam}`),
      ...partner.bronnen.filter((x) => x.soort === "bronvermelding").map((x) => x.url)
    ])
  ).slice(0, 6);
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
  if (partner.status === "concept") return u("status", "Door AI geregistreerd en nog niet vrijgegeven door een beheerder.", "uitsluiting");
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
  let geverifieerdGewicht = 0;

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
      pf = { factorId: "reisafstand", waarde: afstandKm(partner.locatie, ctx.project.locatie), bron: "projecthistorie", betrouwbaarheid: 1, peildatum: nu.toISOString().slice(0, 10), afgeleid: true };
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
    // Bewijs boven zelfbeeld: lage betrouwbaarheid dempt de fit richting neutraal (0.5), en een waarde die (nog) niet
    // door een gebruiker of beheerder is geverifieerd ook: zo telt een onbevestigd gegeven minder zwaar mee.
    const verificatie = verificatieVan(pf, factor, nu);
    const gedempt = 0.5 + (fit - 0.5) * (0.5 + 0.5 * pf.betrouwbaarheid) * VERIFICATIE_WEGING[verificatie];
    bekendGewicht += e.gewicht;
    if (isGeverifieerd(verificatie)) geverifieerdGewicht += e.gewicht;
    criteria.push({
      factorId: factor.id,
      factorNaam: naam,
      optieId: e.optieId,
      gevraagd: e.gevraagd,
      waarde: pf.waarde,
      fit: Math.round(gedempt * 100) / 100,
      basisFit: Math.round(fit * 100) / 100,
      betrouwbaarheid: pf.betrouwbaarheid,
      bron: pf.bron,
      bewijs: pf.bewijs,
      verificatie,
      gewicht: e.gewicht,
      effectiefGewicht: 0,
      bijdrage: 0,
      toelichting: `${toelichting} Bron: ${pf.bron} (betrouwbaarheid ${Math.round(pf.betrouwbaarheid * 100)}%, ${VERIFICATIE_LABEL[verificatie]}${VERIFICATIE_WEGING[verificatie] < 1 ? `, telt voor ${Math.round(VERIFICATIE_WEGING[verificatie] * 100)}%` : ""}).${pf.afgeleid && factor.id !== "reisafstand" ? " Afgeleid uit historie." : ""}`
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
  const verificatiegraad = bekendGewicht ? Math.round((geverifieerdGewicht / bekendGewicht) * 100) : 0;
  return { score: bekendGewicht ? Math.round(score * 100) : 0, dekkingsgraad, verificatiegraad, criteria };
}

/** US-19/US-21: de vrije ervaringstekst van de recentste geaccepteerde evaluaties, voor de onderbouwing en de AI-toelichting. */
export function ervaringenVan(partnerId: string, db: Pick<Database, "evaluaties" | "projecten">, max = 2) {
  return db.evaluaties
    .filter((e) => e.partnerId === partnerId && evaluatieTelt(e) && e.toelichting?.trim())
    .sort((a, b) => b.datum.localeCompare(a.datum))
    .slice(0, max)
    .map((e) => ({ project: db.projecten.find((p) => p.id === e.projectId)?.naam ?? e.projectId, tekst: e.toelichting.trim().slice(0, 240), score: totaalscore(e) }));
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
    // US-54: concepten en gearchiveerde partners tellen nergens mee, ook niet als (zichtbare, exporteerbare) uitsluiting.
    if (!zichtbaar(partner)) return;
    const factoren = effectieveFactoren(partner, db, nu);
    const uitsluiting = hardeFilters(partner, eis, ctx, factoren);
    if (uitsluiting) {
      uitsluitingen.push(uitsluiting);
      return;
    }
    const gewogen = gewogenScore(partner, eis, ctx, factoren);
    const sem = semantischeGelijkenis(vraagTekst, profieltekst(partner, factoren));
    const semGewicht = Math.min(40, Math.max(0, eis.semantischGewicht)) / 100;
    const demping = db.instellingen.dekkingDemping !== false && gewogen.criteria.length > 0;
    const gewogenEff = demping ? dempVoorDekking(gewogen.score, gewogen.dekkingsgraad) : gewogen.score;
    const score = Math.round(gewogenEff * (1 - semGewicht) + sem.score * 100 * semGewicht);
    const semBronnen = profielBronnen(partner);
    if ((eis.semantischGewicht > 0 || eis.vrijeOmschrijving) && sem.score > 0 && semBronnen.length) sem.treffers.push(`profiel gevoed door: ${semBronnen.join(", ")}`);
    const waarschuwingen: string[] = [];
    if (gewogen.dekkingsgraad < DEKKING_WAARSCHUWING) waarschuwingen.push(`Dekkingsgraad ${gewogen.dekkingsgraad}%: score rust op weinig bekende data.`);
    if (demping && Math.abs(gewogenEff - gewogen.score) >= 5) waarschuwingen.push(`Gecorrigeerd voor lage dekking: gewogen ${gewogen.score} → ${gewogenEff} (ontbrekende criteria tellen als neutraal).`);
    if (gewogen.criteria.some((c) => c.fit !== null) && gewogen.verificatiegraad < VERIFICATIE_WAARSCHUWING) waarschuwingen.push(`Verificatiegraad ${gewogen.verificatiegraad}%: de score rust grotendeels op gegevens die nog niet door een gebruiker of beheerder zijn geverifieerd.`);
    // Harde eisen die alleen op een niet-geverifieerde of verouderde waarde zijn doorstaan.
    eis.eisen.forEach((e) => {
      const factor = db.factoren.find((f) => f.id === e.factorId);
      if (!factor || !factor.actief || !(factor.type === "hard" || e.minimumeis)) return;
      const pf = zoekWaarde(factoren, e);
      const v = pf ? verificatieVan(pf, factor, nu) : undefined;
      if (v && !isGeverifieerd(v)) waarschuwingen.push(`${e.minimumeis ? "Minimumeis" : "Harde eis"} '${factor.naam}' is getoetst op een ${VERIFICATIE_LABEL[v]} waarde; laat deze verifiëren.`);
    });
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
      gewogenScore: gewogenEff,
      ongedempteGewogenScore: demping ? gewogen.score : undefined,
      semantischeScore: eis.semantischGewicht > 0 || eis.vrijeOmschrijving ? Math.round(sem.score * 100) : null,
      dekkingsgraad: gewogen.dekkingsgraad,
      waarschuwingen,
      criteria: gewogen.criteria,
      semantischeTreffers: sem.treffers,
      afstandKm: afstandKm(partner.locatie, project.locatie),
      isProspect: partner.status === "prospect",
      verificatiegraad: gewogen.verificatiegraad,
      ervaringen: ervaringenVan(partner.id, db)
    };
    kandidaat.onderbouwing = onderbouwKandidaat(kandidaat);
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
/** Welke factoren/opties noemt de vraag? Matcht vraagtokens tegen optie- en factornamen (met synoniemen). */
function gevraagdeFactoren(db: Database, vraag: string) {
  const qset = new Set(tokens(vraag));
  const treft = (...teksten: string[]) => teksten.flatMap((t) => tokens(t)).some((t) => qset.has(t));
  const opties = new Set<string>(); // `${factorId}::${optieId}`
  const vlaggen = new Set<string>(); // factorId zonder opties (vlag/niveau)
  for (const f of db.factoren) {
    if (f.opties?.length) {
      for (const o of f.opties) if (treft(o.id, o.label)) opties.add(`${f.id}::${o.id}`);
    } else if (treft(f.id, f.naam)) {
      vlaggen.add(f.id);
    }
  }
  return { opties, vlaggen, actief: opties.size > 0 || vlaggen.size > 0 };
}

export function semantischZoeken(db: Database, vraag: string, limiet = 20, nu = new Date()) {
  const gevraagd = gevraagdeFactoren(db, vraag);
  const fmap = new Map(db.factoren.map((f) => [f.id, f]));
  return db.partners
    .filter((p) => p.status !== "geblokkeerd" && p.status !== "gearchiveerd" && p.status !== "concept")
    .map((p) => {
      const eff = effectieveFactoren(p, db, nu);
      const s = semantischeGelijkenis(vraag, profieltekst(p, eff));
      // Structurele boost: een partner die de gevraagde factor/optie daadwerkelijk heeft (niveau > 0) is een
      // harde treffer, los van de fuzzy cosine. Hoe hoger het ervaringsniveau, hoe sterker de boost.
      let boost = 0;
      const extra: string[] = [];
      for (const f of eff) {
        const niveau = typeof f.waarde === "number" ? f.waarde : f.waarde === true ? 5 : 0;
        if (niveau <= 0) continue;
        const raakt = f.optieId ? gevraagd.opties.has(`${f.factorId}::${f.optieId}`) : gevraagd.vlaggen.has(f.factorId);
        if (!raakt) continue;
        boost += 40 + Math.min(1, niveau / 5) * 30;
        const def = fmap.get(f.factorId);
        extra.push(f.optieId ? def?.opties?.find((o) => o.id === f.optieId)?.label ?? f.optieId : def?.naam ?? f.factorId);
      }
      const score = Math.min(100, Math.round(s.score * 100) + Math.round(boost));
      const treffers = Array.from(new Set([...extra, ...s.treffers])).slice(0, 8);
      return { partner: p, score, treffers };
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
