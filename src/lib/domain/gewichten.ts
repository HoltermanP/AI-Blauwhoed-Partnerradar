// Standaard gewichtsprofielen (US-10). Gewichten per rol tellen op tot 100.
import type { Gewichtsprofiel, RequirementFactor, Rol } from "./types";

const r = (factorId: string, gewicht: number, gevraagd: RequirementFactor["gevraagd"], optieId?: string, minimumeis?: boolean): RequirementFactor => ({
  factorId,
  optieId,
  gevraagd,
  gewicht,
  minimumeis
});

function profiel(
  id: string,
  naam: string,
  omschrijving: string,
  perRol: Partial<Record<Rol, RequirementFactor[]>>,
  semantischGewicht = 15
): Gewichtsprofiel {
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
 * Houtbouwer en constructeur (demo oktober 2026, US-01/US-14): in elk standaardprofiel dezelfde startweging. Voorlopig; de
 * definitieve standaardweging wacht op de criteriadefinitie van het team (US-17).
 */
export const NIEUWE_TYPES: Partial<Record<Rol, RequirementFactor[]>> = {
  houtbouwer: [r("mpg", 15, 0.8), r("paris_proof", 20, 250), r("levertijd", 15, 26), r("productietijd", 10, 16), r("kosten_m2", 15, 1800), r("evaluatiescore", 25, 4)],
  constructeur: [r("bouwsysteem", 35, 3, "houtbouw"), r("bim", 25, 3), r("demontabel", 15, 2), r("evaluatiescore", 25, 4)]
};

export const GEWICHTSPROFIELEN: Gewichtsprofiel[] = [
  profiel(
    "binnenstedelijk-hoogbouw",
    "Binnenstedelijk hoogbouw",
    "Complexe stedelijke context: hoogbouwervaring, planningsbetrouwbaarheid en BIM wegen zwaar.",
    {
      architect: [
        r("projecttype", 30, 4, "hoogbouw"),
        r("architectuurstijl", 20, 3, "hoogstedelijk"),
        r("welstand", 15, 3),
        r("bim", 15, 3),
        r("evaluatiescore", 20, 4)
      ],
      aannemer: [
        r("projecttype", 25, 4, "hoogbouw"),
        r("planningsbetrouwbaarheid", 20, 80),
        r("kostenvastheid", 15, 5),
        r("bim", 10, 3),
        r("evaluatiescore", 20, 4),
        r("reisafstand", 10, 50)
      ],
      installateur: [r("projecttype", 30, 3, "hoogbouw"), r("beng", 25, 30), r("bim", 20, 3), r("evaluatiescore", 25, 4)],
      adviseur: [r("projecttype", 35, 3, "hoogbouw"), r("fase_expertise", 25, 3, "planvorming"), r("bim", 15, 3), r("evaluatiescore", 25, 4)],
      leverancier: [r("prefabricage", 40, 3), r("projecttype", 30, 3, "hoogbouw"), r("evaluatiescore", 30, 4)]
    }
  ),
  profiel(
    "grondgebonden-uitleg",
    "Grondgebonden uitleg",
    "Uitleglocatie met grondgebonden woningen: conceptbouw, prijsniveau en kostenvastheid bepalend.",
    {
      architect: [r("projecttype", 30, 4, "grondgebonden"), r("conceptbouw", 25, 3), r("architectuurstijl", 20, 3, "dorps"), r("evaluatiescore", 25, 4)],
      aannemer: [
        r("projecttype", 25, 4, "grondgebonden"),
        r("conceptbouw", 20, 3),
        r("prijsniveau", 20, 100),
        r("kostenvastheid", 15, 5),
        r("evaluatiescore", 20, 4)
      ],
      installateur: [r("projecttype", 35, 3, "grondgebonden"), r("prijsniveau", 25, 100), r("beng", 20, 30), r("evaluatiescore", 20, 4)],
      adviseur: [r("projecttype", 40, 3, "grondgebonden"), r("fase_expertise", 30, 3, "planvorming"), r("evaluatiescore", 30, 4)],
      leverancier: [r("conceptbouw", 40, 3), r("prefabricage", 30, 3), r("prijsniveau", 30, 100)]
    }
  ),
  profiel(
    "transformatie",
    "Transformatie",
    "Herbestemming van bestaand vastgoed: welstand, transformatie-ervaring en flexibiliteit.",
    {
      architect: [r("projecttype", 35, 4, "transformatie"), r("welstand", 25, 3), r("circulariteit", 15, 3), r("evaluatiescore", 25, 4)],
      aannemer: [r("projecttype", 35, 4, "transformatie"), r("bouwteam", 20, 3), r("kostenvastheid", 20, 5), r("evaluatiescore", 25, 4)],
      installateur: [r("projecttype", 40, 3, "transformatie"), r("beng", 25, 35), r("evaluatiescore", 35, 4)],
      adviseur: [r("projecttype", 40, 3, "transformatie"), r("welstand", 30, 3), r("evaluatiescore", 30, 4)],
      leverancier: [r("projecttype", 50, 3, "transformatie"), r("evaluatiescore", 50, 4)]
    }
  ),
  profiel(
    "houtbouw-biobased",
    "Houtbouw / biobased",
    "Duurzaamheid als hoofdambitie: houtbouw, MPG, biobased en circulariteit wegen zwaar.",
    {
      architect: [r("bouwsysteem", 30, 4, "houtbouw"), r("mpg", 20, 0.5), r("biobased", 20, 40), r("circulariteit", 15, 3), r("evaluatiescore", 15, 4)],
      aannemer: [
        r("bouwsysteem", 30, 4, "houtbouw"),
        r("mpg", 20, 0.5),
        r("biobased", 15, 40),
        r("prefabricage", 10, 3),
        r("evaluatiescore", 15, 4),
        r("kostenvastheid", 10, 5)
      ],
      installateur: [r("beng", 35, 25), r("bouwsysteem", 25, 3, "houtbouw"), r("bim", 15, 3), r("evaluatiescore", 25, 4)],
      adviseur: [r("mpg", 35, 0.5), r("circulariteit", 25, 3), r("bouwsysteem", 20, 3, "houtbouw"), r("evaluatiescore", 20, 4)],
      leverancier: [r("bouwsysteem", 40, 4, "houtbouw"), r("biobased", 30, 50), r("prefabricage", 30, 4)]
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
