// Standaardinstellingen voor nieuwe databases en migraties (aanvulling overeenkomst v3.1).
import { STANDAARD_BUDGET, STANDAARD_MODELLEN } from "./kosten";
import { standaardSchema } from "./schema";
import type { Database, RegisterBron } from "./types";

/**
 * US-62: openbare keurmerk- en brancheregisters. Standaard uitgeschakeld: de beheerder controleert het zoekpatroon ({naam},
 * {kvk}) en zet het register daarna aan. Alleen openbare bronnen zonder login of betaling.
 */
export function standaardRegisterbronnen(): RegisterBron[] {
  return [
    { id: "reg-co2", naam: "CO2-prestatieladder – gecertificeerde bedrijven (SKAO)", url: "https://www.co2-prestatieladder.nl/nl/certificaathouders?search={naam}", certificaat: "CO2-prestatieladder", actief: false },
    { id: "reg-fsc", naam: "FSC-certificaatdatabase", url: "https://search.fsc.org/en?q={naam}", certificaat: "FSC", actief: false },
    { id: "reg-vca", naam: "VCA-register (SSVV)", url: "https://www.vca.nl/zoek-een-gecertificeerd-bedrijf?search={naam}", certificaat: "VCA", actief: false }
  ];
}

export function standaardAanvullingInstellingen(nu = new Date()): Pick<Database["instellingen"], "aiBudget" | "modellen" | "verrijkingsschema" | "registerbronnen"> {
  return { aiBudget: { ...STANDAARD_BUDGET }, modellen: { ...STANDAARD_MODELLEN }, verrijkingsschema: standaardSchema(nu), registerbronnen: standaardRegisterbronnen() };
}
