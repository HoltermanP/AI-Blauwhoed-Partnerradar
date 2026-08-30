// US-19/US-20/US-33: factorwaarden afleiden uit projecthistorie en evaluaties.
// Afgeleide waarden krijgen bron `projecthistorie`/`evaluatie` en een hogere betrouwbaarheid dan opgave of web.
import type { Database, Engagement, Evaluatie, Partner, PartnerFactor, Project, Rol } from "./types";
import { BRON_BETROUWBAARHEID } from "./types";

const JAAR_MS = 365.25 * 24 * 3600 * 1000;

/** Recentheidsgewicht: 1.0 voor projecten jonger dan 2 jaar, aflopend naar 0.4 na 5 jaar en 0.25 daarna. */
export function recentheidsgewicht(datum: string, nu = new Date()) {
  const jaren = (nu.getTime() - new Date(datum).getTime()) / JAAR_MS;
  if (jaren <= 2) return 1;
  if (jaren <= 5) return 1 - ((jaren - 2) / 3) * 0.6;
  return 0.25;
}

function gewogenGemiddelde(items: Array<{ waarde: number; gewicht: number }>) {
  const totaal = items.reduce((s, i) => s + i.gewicht, 0);
  if (!totaal) return null;
  return items.reduce((s, i) => s + i.waarde * i.gewicht, 0) / totaal;
}

export type AfgeleidResultaat = {
  factoren: PartnerFactor[];
  statistieken: {
    aantalProjecten: number;
    aantalEvaluaties: number;
    totaleContractwaarde: number;
    kostenvastheid: number | null;
    planningsbetrouwbaarheid: number | null;
    evaluatiescore: number | null;
    perProjecttype: Record<string, number>;
    perBouwsysteem: Record<string, number>;
    omvang: { min: number; max: number } | null;
    blauwhoedAandeel: number | null;
  };
};

export function leidFactorenAf(partner: Partner, db: Pick<Database, "engagements" | "evaluaties" | "projecten">, nu = new Date()): AfgeleidResultaat {
  const engagements = db.engagements.filter((e) => e.partnerId === partner.id);
  const evaluaties = db.evaluaties.filter((e) => e.partnerId === partner.id);
  const projectMap = new Map(db.projecten.map((p) => [p.id, p]));
  const factoren: PartnerFactor[] = [];
  const peildatum = nu.toISOString().slice(0, 10);

  const bewijsVoor = (e: Engagement) => {
    const p = projectMap.get(e.projectId);
    return { soort: "project" as const, ref: e.projectId, label: p?.naam ?? e.projectId };
  };

  // Projecttype-ervaring: gewogen aantal projecten per type -> niveau 0–5
  const perProjecttype: Record<string, number> = {};
  const perBouwsysteem: Record<string, number> = {};
  const omvangen: number[] = [];
  let totaleContractwaarde = 0;

  engagements.forEach((e) => {
    const p = projectMap.get(e.projectId);
    const w = recentheidsgewicht(e.periode.van, nu);
    totaleContractwaarde += e.contractwaarde;
    if (p) {
      perProjecttype[p.type] = (perProjecttype[p.type] ?? 0) + w;
      omvangen.push(p.woningen);
    }
    if (e.bouwsysteem) perBouwsysteem[e.bouwsysteem] = (perBouwsysteem[e.bouwsysteem] ?? 0) + w;
  });

  const naarNiveau = (gewogenAantal: number) => Math.min(5, Math.round(Math.min(5, 1 + gewogenAantal * 1.3)));

  Object.entries(perProjecttype).forEach(([type, aantal]) => {
    const laatste = engagements
      .filter((e) => projectMap.get(e.projectId)?.type === type)
      .sort((a, b) => b.periode.van.localeCompare(a.periode.van))[0];
    factoren.push({
      factorId: "projecttype",
      optieId: type,
      waarde: naarNiveau(aantal),
      bron: "projecthistorie",
      betrouwbaarheid: BRON_BETROUWBAARHEID.projecthistorie,
      bewijs: laatste ? bewijsVoor(laatste) : undefined,
      peildatum,
      afgeleid: true,
      toelichting: `${engagements.filter((e) => projectMap.get(e.projectId)?.type === type).length} project(en) van dit type, gewogen naar recentheid.`
    });
  });

  Object.entries(perBouwsysteem).forEach(([systeem, aantal]) => {
    const laatste = engagements.filter((e) => e.bouwsysteem === systeem).sort((a, b) => b.periode.van.localeCompare(a.periode.van))[0];
    factoren.push({
      factorId: "bouwsysteem",
      optieId: systeem,
      waarde: naarNiveau(aantal),
      bron: "projecthistorie",
      betrouwbaarheid: BRON_BETROUWBAARHEID.projecthistorie,
      bewijs: laatste ? bewijsVoor(laatste) : undefined,
      peildatum,
      afgeleid: true,
      toelichting: `${engagements.filter((e) => e.bouwsysteem === systeem).length} project(en) met dit bouwsysteem.`
    });
  });

  // Prijssegment-ervaring uit projecten
  const perSegment: Record<string, number> = {};
  engagements.forEach((e) => {
    const p = projectMap.get(e.projectId);
    p?.prijssegment.forEach((s) => (perSegment[s] = (perSegment[s] ?? 0) + recentheidsgewicht(e.periode.van, nu)));
  });
  Object.entries(perSegment).forEach(([segment, aantal]) =>
    factoren.push({
      factorId: "prijssegment",
      optieId: segment,
      waarde: naarNiveau(aantal),
      bron: "projecthistorie",
      betrouwbaarheid: BRON_BETROUWBAARHEID.projecthistorie,
      peildatum,
      afgeleid: true
    })
  );

  // Projectomvang-bandbreedte
  let omvang: { min: number; max: number } | null = null;
  if (omvangen.length) {
    omvang = { min: Math.min(...omvangen), max: Math.max(...omvangen) };
    factoren.push({
      factorId: "projectomvang",
      waarde: { min: Math.round(omvang.min * 0.5), max: Math.round(omvang.max * 2) },
      bron: "projecthistorie",
      betrouwbaarheid: BRON_BETROUWBAARHEID.projecthistorie,
      peildatum,
      afgeleid: true,
      toelichting: `Gerealiseerd tussen ${omvang.min} en ${omvang.max} woningen; bandbreedte 0,5× tot 2×.`
    });
  }

  // Kostenvastheid (US-20): |eind - raming| / raming, gewogen naar recentheid
  const kosten = engagements
    .filter((e) => e.ramingBijStart && e.eindafrekening)
    .map((e) => ({ waarde: (Math.abs(e.eindafrekening! - e.ramingBijStart!) / e.ramingBijStart!) * 100, gewicht: recentheidsgewicht(e.periode.van, nu) }));
  const kostenvastheid = gewogenGemiddelde(kosten);
  if (kostenvastheid !== null) {
    factoren.push({
      factorId: "kostenvastheid",
      waarde: Math.round(kostenvastheid * 10) / 10,
      bron: "projecthistorie",
      betrouwbaarheid: BRON_BETROUWBAARHEID.projecthistorie,
      peildatum,
      afgeleid: true,
      toelichting: `Gemiddelde afwijking raming/eindafrekening over ${kosten.length} project(en).`
    });
  }

  // Planningsbetrouwbaarheid (US-20): aandeel opgeleverd binnen 30 dagen na plan
  const planning = engagements
    .filter((e) => e.geplandeOplevering && e.werkelijkeOplevering)
    .map((e) => {
      const verschil = (new Date(e.werkelijkeOplevering!).getTime() - new Date(e.geplandeOplevering!).getTime()) / (24 * 3600 * 1000);
      return { waarde: verschil <= 30 ? 100 : 0, gewicht: recentheidsgewicht(e.periode.van, nu) };
    });
  const planningsbetrouwbaarheid = gewogenGemiddelde(planning);
  if (planningsbetrouwbaarheid !== null) {
    factoren.push({
      factorId: "planningsbetrouwbaarheid",
      waarde: Math.round(planningsbetrouwbaarheid),
      bron: "projecthistorie",
      betrouwbaarheid: BRON_BETROUWBAARHEID.projecthistorie,
      peildatum,
      afgeleid: true,
      toelichting: `${planning.length} project(en) met geplande en werkelijke oplevering.`
    });
  }

  // Evaluatiescore (US-21): gemiddelde van vier scores, gewogen naar recentheid
  const evals = evaluaties.map((ev) => ({
    waarde: (ev.kwaliteit + ev.planning + ev.budget + ev.samenwerking) / 4,
    gewicht: recentheidsgewicht(ev.datum, nu)
  }));
  const evaluatiescore = gewogenGemiddelde(evals);
  if (evaluatiescore !== null) {
    const laatste = [...evaluaties].sort((a, b) => b.datum.localeCompare(a.datum))[0];
    factoren.push({
      factorId: "evaluatiescore",
      waarde: Math.round(evaluatiescore * 10) / 10,
      bron: "evaluatie",
      betrouwbaarheid: Math.min(0.95, 0.7 + evaluaties.length * 0.08),
      bewijs: laatste ? { soort: "evaluatie", ref: laatste.id, label: `Evaluatie ${projectMap.get(laatste.projectId)?.naam ?? ""}`.trim() } : undefined,
      peildatum,
      afgeleid: true,
      toelichting: `${evaluaties.length} evaluatie(s), recente projecten wegen zwaarder.`
    });
    // Duurzaamheidsprestatie uit evaluaties voedt circulariteit als zwak signaal? Nee: bewust niet, alleen expliciet.
  }

  // Afhankelijkheid (US-33): aandeel Blauwhoed in omzet partner, laatste 3 jaar
  let blauwhoedAandeel: number | null = null;
  if (partner.omzet && partner.omzet > 0) {
    const recent = engagements.filter((e) => (nu.getTime() - new Date(e.periode.van).getTime()) / JAAR_MS <= 3);
    const perJaar = recent.reduce((s, e) => s + e.contractwaarde, 0) / 3;
    blauwhoedAandeel = Math.round((perJaar / partner.omzet) * 100);
    if (recent.length) {
      factoren.push({
        factorId: "afhankelijkheid",
        waarde: blauwhoedAandeel,
        bron: "projecthistorie",
        betrouwbaarheid: 0.8,
        peildatum,
        afgeleid: true,
        toelichting: `Gemiddelde jaarlijkse contractwaarde Blauwhoed (3 jr) gedeeld door jaaromzet.`
      });
    }
  }

  // CO2-prestatieladder uit geldig certificaat (bron certificaat)
  const co2 = partner.certificaten.find((c) => c.type === "CO2-prestatieladder" && new Date(c.geldigTot) >= nu);
  if (co2?.niveau) {
    factoren.push({
      factorId: "co2_ladder",
      waarde: co2.niveau,
      bron: "certificaat",
      betrouwbaarheid: co2.geverifieerdOp ? 0.98 : 0.85,
      bewijs: { soort: "certificaat", ref: co2.id, label: `CO2-prestatieladder ${co2.nummer}` },
      peildatum,
      afgeleid: true
    });
  }

  // Financiële gezondheid -> risicoklasse
  if (partner.financieel?.risicoklasse) {
    factoren.push({
      factorId: "financiele_gezondheid",
      waarde: partner.financieel.risicoklasse,
      bron: "opgave",
      betrouwbaarheid: 0.8,
      peildatum,
      afgeleid: true,
      toelichting: partner.financieel.toelichting
    });
  }

  return {
    factoren,
    statistieken: {
      aantalProjecten: engagements.length,
      aantalEvaluaties: evaluaties.length,
      totaleContractwaarde,
      kostenvastheid,
      planningsbetrouwbaarheid,
      evaluatiescore,
      perProjecttype,
      perBouwsysteem,
      omvang,
      blauwhoedAandeel
    }
  };
}

/**
 * Effectief profiel: afgeleide waarden + handmatige waarden. Een handmatige overschrijving (overschrijving=true) wint
 * van een afgeleide waarde; anders wint de afgeleide waarde (bewijs boven zelfbeeld) en wordt de opgave meegeleverd.
 */
export function effectieveFactoren(partner: Partner, db: Pick<Database, "engagements" | "evaluaties" | "projecten">, nu = new Date()): PartnerFactor[] {
  const afgeleid = leidFactorenAf(partner, db, nu).factoren;
  const sleutel = (f: PartnerFactor) => `${f.factorId}::${f.optieId ?? ""}`;
  const resultaat = new Map<string, PartnerFactor>();
  afgeleid.forEach((f) => resultaat.set(sleutel(f), f));
  partner.factoren.forEach((f) => {
    const k = sleutel(f);
    const bestaand = resultaat.get(k);
    if (!bestaand) {
      resultaat.set(k, f);
      return;
    }
    if (f.overschrijving) resultaat.set(k, { ...f, toelichting: `Handmatige overschrijving van afgeleide waarde (${bestaand.waarde}). ${f.toelichting ?? ""}`.trim() });
    else if (f.betrouwbaarheid > bestaand.betrouwbaarheid) resultaat.set(k, f);
  });
  return Array.from(resultaat.values());
}

/** US-22: samenwerkingshistorie tussen twee partners. */
export function samenwerking(db: Pick<Database, "engagements" | "evaluaties">, a: string, b: string) {
  const projA = new Set(db.engagements.filter((e) => e.partnerId === a).map((e) => e.projectId));
  const gezamenlijk = Array.from(new Set(db.engagements.filter((e) => e.partnerId === b && projA.has(e.projectId)).map((e) => e.projectId)));
  const scores = db.evaluaties.filter((ev) => gezamenlijk.includes(ev.projectId) && (ev.partnerId === a || ev.partnerId === b)).map((ev) => ev.samenwerking);
  return {
    projecten: gezamenlijk,
    aantal: gezamenlijk.length,
    gemiddeldeSamenwerking: scores.length ? scores.reduce((s, x) => s + x, 0) / scores.length : null
  };
}

export function collaborationEdges(db: Pick<Database, "engagements" | "evaluaties" | "partners">) {
  const edges: Array<{ a: string; b: string; aantal: number; gemiddeldeScore: number | null }> = [];
  const ids = db.partners.map((p) => p.id);
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const s = samenwerking(db, ids[i], ids[j]);
      if (s.aantal) edges.push({ a: ids[i], b: ids[j], aantal: s.aantal, gemiddeldeScore: s.gemiddeldeSamenwerking });
    }
  return edges;
}

export function huidigeBelasting(partner: Partner, db: Pick<Database, "engagements" | "projecten">, nu = new Date()) {
  const lopend = db.engagements.filter((e) => e.partnerId === partner.id && (!e.periode.tot || new Date(e.periode.tot) >= nu) && new Date(e.periode.van) <= nu);
  return { aantal: lopend.length, contractwaarde: lopend.reduce((s, e) => s + e.contractwaarde, 0) };
}

export function rollenVan(partner: Partner, db: Pick<Database, "engagements">): Rol[] {
  const uitHistorie = db.engagements.filter((e) => e.partnerId === partner.id).map((e) => e.rol);
  return Array.from(new Set([...partner.rollen, ...uitHistorie]));
}

export type { Evaluatie, Project };
