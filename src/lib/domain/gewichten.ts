// Standaard gewichtsprofielen (US-10). Gewichten per rol tellen op tot 100.
import type { Gewichtsprofiel, RequirementFactor, Rol } from "./types";

/** Eis zonder gewicht: het gewicht volgt uit `gelijkeGewichten`. */
const r = (factorId: string, gevraagd: RequirementFactor["gevraagd"], optieId?: string): RequirementFactor => ({ factorId, optieId, gevraagd, gewicht: 0 });

/** Standaardweging: 100% gelijk verdeeld over de gekozen factoren (de rest van de verdeling gaat naar de eerste). Aanpasbaar per project. */
export function gelijkeGewichten(eisen: RequirementFactor[]): RequirementFactor[] {
  const n = eisen.length || 1;
  const basis = Math.floor(100 / n);
  const rest = 100 - basis * n;
  return eisen.map((e, i) => ({ ...e, gewicht: basis + (i < rest ? 1 : 0) }));
}

function profiel(
  id: string,
  naam: string,
  omschrijving: string,
  invoer: Partial<Record<Rol, RequirementFactor[]>>,
  semantischGewicht = 15
): Gewichtsprofiel {
  const perRol = Object.fromEntries(Object.entries(invoer).map(([rol, eisen]) => [rol, gelijkeGewichten(eisen)])) as Partial<Record<Rol, RequirementFactor[]>>;
  return {
    id,
    naam,
    omschrijving,
    perRol,
    semantischGewicht,
    versie: 1,
    versies: [{ versie: 1, op: "2026-01-15T09:00:00.000Z", door: "systeem", toelichting: "Initieel profiel", snapshot: perRol }],
    standaard: true
  };
}

/**
 * Houtbouwer en constructeur (demo oktober 2026, US-01/US-14): in elk standaardprofiel dezelfde startweging, gelijk verdeeld.
 * De definitieve standaardweging wacht op de criteriadefinitie van het team (US-17).
 */
export const NIEUWE_TYPES: Partial<Record<Rol, RequirementFactor[]>> = {
  houtbouwer: gelijkeGewichten([r("mpg", 0.8), r("paris_proof", 250), r("levertijd", 26), r("productietijd", 16), r("kosten_m2", 1800), r("evaluatiescore", 4)]),
  constructeur: gelijkeGewichten([r("bouwsysteem", 3, "houtbouw"), r("demontabel", 2), r("evaluatiescore", 4)])
};

// De vier standaardprofielen uit US-10. Per rol de bepalende factoren, gelijk gewogen; de gevraagde niveaus (4 = specialisme,
// 3 = aantoonbare ervaring) en drempels zijn startwaarden die de gebruiker per project aanpast.
export const GEWICHTSPROFIELEN: Gewichtsprofiel[] = [
  profiel("binnenstedelijk-hoogbouw", "Binnenstedelijk hoogbouw", "Complexe stedelijke context: hoogbouwervaring en planningsbetrouwbaarheid wegen mee.", {
    architect: [r("projecttype", 4, "hoogbouw"), r("architectuurstijl", 3, "hoogstedelijk"), r("evaluatiescore", 4)],
    aannemer: [r("projecttype", 4, "hoogbouw"), r("planningsbetrouwbaarheid", 80), r("kostenvastheid", 5), r("evaluatiescore", 4), r("reisafstand", 50)],
    installateur: [r("projecttype", 3, "hoogbouw"), r("beng", 30), r("evaluatiescore", 4)],
    adviseur: [r("projecttype", 3, "hoogbouw"), r("evaluatiescore", 4)],
    leverancier: [r("prefabricage", 3), r("projecttype", 3, "hoogbouw"), r("evaluatiescore", 4)]
  }),
  profiel("grondgebonden-uitleg", "Grondgebonden uitleg", "Uitleglocatie met grondgebonden woningen: conceptbouw en kostenvastheid bepalend.", {
    architect: [r("projecttype", 4, "grondgebonden"), r("conceptbouw", 3), r("architectuurstijl", 3, "dorps"), r("evaluatiescore", 4)],
    aannemer: [r("projecttype", 4, "grondgebonden"), r("conceptbouw", 3), r("kostenvastheid", 5), r("evaluatiescore", 4)],
    installateur: [r("projecttype", 3, "grondgebonden"), r("beng", 30), r("evaluatiescore", 4)],
    adviseur: [r("projecttype", 3, "grondgebonden"), r("evaluatiescore", 4)],
    leverancier: [r("conceptbouw", 3), r("prefabricage", 3), r("evaluatiescore", 4)]
  }),
  profiel("transformatie", "Transformatie", "Herbestemming van bestaand vastgoed: transformatie-ervaring en kostenvastheid.", {
    architect: [r("projecttype", 4, "transformatie"), r("evaluatiescore", 4)],
    aannemer: [r("projecttype", 4, "transformatie"), r("kostenvastheid", 5), r("evaluatiescore", 4)],
    installateur: [r("projecttype", 3, "transformatie"), r("beng", 35), r("evaluatiescore", 4)],
    adviseur: [r("projecttype", 3, "transformatie"), r("evaluatiescore", 4)],
    leverancier: [r("projecttype", 3, "transformatie"), r("evaluatiescore", 4)]
  }),
  profiel(
    "houtbouw-biobased",
    "Houtbouw / biobased",
    "Duurzaamheid als hoofdambitie: houtbouw, MPG en biobased wegen zwaar.",
    {
      architect: [r("bouwsysteem", 4, "houtbouw"), r("mpg", 0.5), r("biobased", 40), r("evaluatiescore", 4)],
      aannemer: [r("bouwsysteem", 4, "houtbouw"), r("mpg", 0.5), r("biobased", 40), r("prefabricage", 3), r("kostenvastheid", 5), r("evaluatiescore", 4)],
      installateur: [r("beng", 25), r("bouwsysteem", 3, "houtbouw"), r("evaluatiescore", 4)],
      adviseur: [r("mpg", 0.5), r("bouwsysteem", 3, "houtbouw"), r("evaluatiescore", 4)],
      leverancier: [r("bouwsysteem", 4, "houtbouw"), r("biobased", 50), r("prefabricage", 4)]
    },
    20
  )
].map((p) => ({ ...p, perRol: { ...p.perRol, ...NIEUWE_TYPES }, versies: p.versies.map((v) => ({ ...v, snapshot: { ...v.snapshot, ...NIEUWE_TYPES } })) }));

/**
 * US-17/US-21: zet het aandeel van eigen ervaring (factor evaluatiescore, alleen geaccepteerde evaluaties) in een rol op `pct`
 * procent; de overige gewogen criteria (openbare bronnen, opgave, historie) delen naar verhouding de rest. Harde en
 * semantische eisen blijven ongemoeid. Het totaal van de gewogen criteria blijft 100.
 */
export function pasErvaringsgewichtToe(eisen: RequirementFactor[], pct: number, isGewogen: (factorId: string) => boolean): RequirementFactor[] {
  const p = Math.max(0, Math.min(80, Math.round(pct)));
  const lijst = eisen.map((e) => ({ ...e }));
  let ev = lijst.find((e) => e.factorId === "evaluatiescore");
  if (!ev && p > 0) {
    ev = { factorId: "evaluatiescore", gevraagd: 4, gewicht: 0 };
    lijst.push(ev);
  }
  const overig = lijst.filter((e) => e !== ev && isGewogen(e.factorId));
  const somOverig = overig.reduce((s, e) => s + e.gewicht, 0);
  if (!overig.length) {
    if (ev) ev.gewicht = 100;
    return lijst;
  }
  if (ev) ev.gewicht = p;
  let rest = 100 - p;
  overig.forEach((e, i) => {
    const nieuw = i === overig.length - 1 ? rest : Math.round(((somOverig ? e.gewicht / somOverig : 1 / overig.length)) * (100 - p));
    e.gewicht = Math.max(0, nieuw);
    rest -= e.gewicht;
  });
  return lijst.filter((e) => !(e === ev && p === 0));
}

/** Aandelen van de teamscore: kwaliteit, samenwerkingshistorie, nabijheid en beschikbaarheid (som 1). */
export function teamWeging(samenwerkingPct = 25) {
  const s = Math.max(0, Math.min(70, samenwerkingPct)) / 100;
  const rest = 1 - s;
  return { kwaliteit: (rest * 50) / 75, samenwerking: s, nabijheid: (rest * 15) / 75, beschikbaarheid: (rest * 10) / 75 };
}
