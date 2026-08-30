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
];
