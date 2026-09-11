// Factorencatalogus uit backlog hoofdstuk 3. Dit is configuratie: nieuwe factoren zijn een record, geen migratie.
import type { Factor, FactorOption, Rol } from "./types";

const opt = (id: string, label: string): FactorOption => ({ id, label, actief: true });

const ALLE: Rol[] = [];
const BOUWERS: Rol[] = ["aannemer", "ontwikkelpartner"];
const ONTWERP: Rol[] = ["architect", "ontwikkelpartner"];
const TECHNIEK: Rol[] = ["aannemer", "installateur", "leverancier", "ontwikkelpartner"];

export const FACTOREN: Factor[] = [
  // A. Projecttype en programma
  {
    id: "projecttype",
    code: "A1",
    naam: "Projecttype",
    omschrijving: "Ervaringsniveau per projecttype.",
    categorie: "A. Projecttype en programma",
    type: "gewogen",
    schaal: { soort: "niveau", min: 0, max: 5 },
    opties: [
      opt("grondgebonden", "Grondgebonden"),
      opt("appartementen", "Appartementen"),
      opt("hoogbouw", "Hoogbouw"),
      opt("transformatie", "Transformatie"),
      opt("zorgwonen", "Zorgwonen"),
      opt("gebiedsontwikkeling", "Gebiedsontwikkeling")
    ],
    rollen: ALLE,
    actief: true,
    versie: 1
  },
  {
    id: "prijssegment",
    code: "A2",
    naam: "Prijssegment",
    omschrijving: "Ervaringsniveau per prijssegment.",
    categorie: "A. Projecttype en programma",
    type: "gewogen",
    schaal: { soort: "niveau", min: 0, max: 5 },
    opties: [opt("sociaal", "Sociaal"), opt("middenhuur", "Middenhuur"), opt("koop", "Koop"), opt("vrije sector", "Vrije sector")],
    rollen: ALLE,
    actief: true,
    versie: 1
  },
  {
    id: "projectomvang",
    code: "A3",
    naam: "Projectomvang",
    omschrijving: "Bandbreedte aantal woningen waarin de partner aantoonbaar opereert. Hard filter én gewogen.",
    categorie: "A. Projecttype en programma",
    type: "hard",
    schaal: { soort: "bereik", eenheid: "woningen" },
    rollen: ALLE,
    actief: true,
    versie: 1
  },
  {
    id: "fase_expertise",
    code: "A4",
    naam: "Fase-expertise",
    omschrijving: "Ervaring per projectfase.",
    categorie: "A. Projecttype en programma",
    type: "gewogen",
    schaal: { soort: "niveau", min: 0, max: 5 },
    opties: [opt("initiatief", "Initiatief"), opt("planvorming", "Planvorming"), opt("realisatie", "Realisatie"), opt("nazorg", "Nazorg")],
    rollen: ALLE,
    actief: true,
    versie: 1
  },
  // B. Bouwstijl en architectuur
  {
    id: "architectuurstijl",
    code: "B1",
    naam: "Architectuurstijl",
    omschrijving: "Ervaringsniveau per stijl.",
    categorie: "B. Bouwstijl en architectuur",
    type: "gewogen",
    schaal: { soort: "niveau", min: 0, max: 5 },
    opties: [opt("traditioneel", "Traditioneel"), opt("modern", "Modern"), opt("industrieel", "Industrieel"), opt("dorps", "Dorps"), opt("hoogstedelijk", "Hoogstedelijk")],
    rollen: ONTWERP,
    actief: true,
    versie: 1
  },
  {
    id: "welstand",
    code: "B2",
    naam: "Welstandsgevoelige of beschermde context",
    omschrijving: "Ervaring in beschermd stads-/dorpsgezicht of monumentale context.",
    categorie: "B. Bouwstijl en architectuur",
    type: "gewogen",
    schaal: { soort: "niveau", min: 0, max: 5 },
    rollen: ONTWERP,
    actief: true,
    versie: 1
  },
  {
    id: "conceptbouw",
    code: "B3",
    naam: "Conceptbouw en herhaalbaarheid",
    omschrijving: "Mate waarin de partner met herhaalbare woningconcepten werkt.",
    categorie: "B. Bouwstijl en architectuur",
    type: "gewogen",
    schaal: { soort: "niveau", min: 0, max: 5 },
    rollen: ALLE,
    actief: true,
    versie: 1
  },
  {
    id: "signatuur",
    code: "B4",
    naam: "Vormgevingssignatuur",
    omschrijving: "Vrije tekst en referenties; alleen semantisch vergeleken.",
    categorie: "B. Bouwstijl en architectuur",
    type: "semantisch",
    schaal: { soort: "tekst" },
    rollen: ONTWERP,
    actief: true,
    versie: 1
  },
  // C. Bouwmethode en materialen
  {
    id: "bouwsysteem",
    code: "C1",
    naam: "Bouwsysteem",
    omschrijving: "Ervaringsniveau per bouwsysteem.",
    categorie: "C. Bouwmethode en materialen",
    type: "gewogen",
    schaal: { soort: "niveau", min: 0, max: 5 },
    opties: [
      opt("houtbouw", "Houtbouw / CLT"),
      opt("prefab_beton", "Prefab beton"),
      opt("staalframe", "Staalframe"),
      opt("traditioneel", "Traditioneel"),
      opt("hybride", "Hybride")
    ],
    rollen: TECHNIEK.concat("architect"),
    actief: true,
    versie: 1
  },
  {
    id: "gevel",
    code: "C2",
    naam: "Gevelmateriaal en detaillering",
    omschrijving: "Kwaliteitsniveau gevelwerk en detaillering.",
    categorie: "C. Bouwmethode en materialen",
    type: "gewogen",
    schaal: { soort: "niveau", min: 0, max: 5 },
    rollen: TECHNIEK.concat("architect"),
    actief: true,
    versie: 1
  },
  {
    id: "prefabricage",
    code: "C3",
    naam: "Prefabricagegraad",
    omschrijving: "Mate van industrieel/prefab bouwen.",
    categorie: "C. Bouwmethode en materialen",
    type: "gewogen",
    schaal: { soort: "niveau", min: 0, max: 5 },
    rollen: TECHNIEK,
    actief: true,
    versie: 1
  },
  {
    id: "demontabel",
    code: "C4",
    naam: "Demontabel en remontabel bouwen",
    omschrijving: "Ervaring met losmaakbaar bouwen.",
    categorie: "C. Bouwmethode en materialen",
    type: "gewogen",
    schaal: { soort: "niveau", min: 0, max: 5 },
    rollen: TECHNIEK.concat("architect"),
    actief: true,
    versie: 1
  },
  // D. Duurzaamheid
  {
    id: "mpg",
    vervalMaanden: 24,
    code: "D1",
    naam: "Gerealiseerde MPG-score",
    omschrijving: "Gemiddelde aantoonbare MPG in opgeleverde projecten (lager is beter).",
    categorie: "D. Duurzaamheid",
    type: "gewogen",
    schaal: { soort: "getal", eenheid: "€/m² BVO/jaar", lagerIsBeter: true, min: 0.3, max: 1.2 },
    rollen: TECHNIEK.concat("architect"),
    actief: true,
    versie: 1
  },
  {
    id: "beng",
    vervalMaanden: 24,
    code: "D2",
    naam: "BENG-prestatie",
    omschrijving: "Gemeten BENG-2 primair fossiel energiegebruik in opgeleverde projecten (lager is beter).",
    categorie: "D. Duurzaamheid",
    type: "gewogen",
    schaal: { soort: "getal", eenheid: "kWh/m²/jaar", lagerIsBeter: true, min: 0, max: 60 },
    rollen: TECHNIEK.concat("architect"),
    actief: true,
    versie: 1
  },
  {
    id: "biobased",
    vervalMaanden: 24,
    code: "D3",
    naam: "Aandeel biobased materiaal",
    omschrijving: "Percentage biobased materiaal in recente projecten.",
    categorie: "D. Duurzaamheid",
    type: "gewogen",
    schaal: { soort: "percentage" },
    rollen: TECHNIEK.concat("architect"),
    actief: true,
    versie: 1
  },
  {
    id: "circulariteit",
    code: "D4",
    naam: "Circulariteit en materialenpaspoort",
    omschrijving: "Ervaring met circulair ontwerpen en materialenpaspoorten.",
    categorie: "D. Duurzaamheid",
    type: "gewogen",
    schaal: { soort: "niveau", min: 0, max: 5 },
    rollen: ALLE,
    actief: true,
    versie: 1
  },
  {
    id: "co2_ladder",
    vervalMaanden: 12,
    code: "D5",
    naam: "CO2-prestatieladder",
    omschrijving: "Niveau 1–5 op basis van geldig certificaat. Als harde eis of gewogen inzetbaar.",
    categorie: "D. Duurzaamheid",
    type: "gewogen",
    schaal: { soort: "getal", eenheid: "niveau", min: 0, max: 5 },
    rollen: ALLE,
    actief: true,
    versie: 1
  },
  {
    id: "natuurinclusief",
    code: "D6",
    naam: "Natuurinclusief en klimaatadaptief",
    omschrijving: "Ervaring met natuurinclusief en klimaatadaptief bouwen.",
    categorie: "D. Duurzaamheid",
    type: "gewogen",
    schaal: { soort: "niveau", min: 0, max: 5 },
    rollen: ALLE,
    actief: true,
    versie: 1
  },
  // E. Capaciteit en continuïteit
  {
    id: "max_projectomvang",
    code: "E1",
    naam: "Maximale gelijktijdige projectomvang",
    omschrijving: "Maximale contractwaarde die de partner tegelijk aankan (hard).",
    categorie: "E. Capaciteit en continuïteit",
    type: "hard",
    schaal: { soort: "getal", eenheid: "€" },
    rollen: ALLE,
    actief: true,
    versie: 1
  },
  {
    id: "beschikbaarheid",
    vervalMaanden: 6,
    code: "E2",
    naam: "Beschikbaarheid in de projectperiode",
    omschrijving: "Ja/nee per periode (hard).",
    categorie: "E. Capaciteit en continuïteit",
    type: "hard",
    schaal: { soort: "boolean" },
    rollen: ALLE,
    actief: true,
    versie: 1
  },
  {
    id: "reisafstand",
    code: "E3",
    naam: "Werkgebied en reisafstand",
    omschrijving: "Afstand vestiging tot projectlocatie in km (hard op werkgebied, gewogen op afstand).",
    categorie: "E. Capaciteit en continuïteit",
    type: "gewogen",
    schaal: { soort: "getal", eenheid: "km", lagerIsBeter: true, min: 0, max: 150 },
    rollen: ALLE,
    actief: true,
    versie: 1
  },
  {
    id: "organisatieomvang",
    code: "E4",
    naam: "Omvang organisatie",
    omschrijving: "Aantal medewerkers.",
    categorie: "E. Capaciteit en continuïteit",
    type: "gewogen",
    schaal: { soort: "getal", eenheid: "fte", min: 0, max: 500 },
    rollen: ALLE,
    actief: true,
    versie: 1
  },
  // F. Samenwerking en gedrag
  {
    id: "evaluatiescore",
    code: "F1",
    naam: "Evaluatiescore",
    omschrijving: "Gemiddelde van kwaliteit, planning, budget en samenwerking; recentere projecten wegen zwaarder.",
    categorie: "F. Samenwerking en gedrag",
    type: "gewogen",
    schaal: { soort: "getal", eenheid: "1–5", min: 1, max: 5 },
    rollen: ALLE,
    actief: true,
    afgeleid: true,
    versie: 1
  },
  {
    id: "kostenvastheid",
    code: "F2",
    naam: "Kostenvastheid",
    omschrijving: "Gemiddelde afwijking raming versus eindafrekening (lager is beter).",
    categorie: "F. Samenwerking en gedrag",
    type: "gewogen",
    schaal: { soort: "percentage", lagerIsBeter: true },
    rollen: ALLE,
    actief: true,
    afgeleid: true,
    versie: 1
  },
  {
    id: "planningsbetrouwbaarheid",
    code: "F3",
    naam: "Planningsbetrouwbaarheid",
    omschrijving: "Aandeel projecten dat binnen de geplande opleverdatum (+30 dagen) is opgeleverd.",
    categorie: "F. Samenwerking en gedrag",
    type: "gewogen",
    schaal: { soort: "percentage" },
    rollen: ALLE,
    actief: true,
    afgeleid: true,
    versie: 1
  },
  {
    id: "bouwteam",
    code: "F4",
    naam: "Bouwteam- en ketensamenwerking",
    omschrijving: "Ervaring met bouwteam en ketensamenwerking.",
    categorie: "F. Samenwerking en gedrag",
    type: "gewogen",
    schaal: { soort: "niveau", min: 0, max: 5 },
    rollen: ALLE,
    actief: true,
    versie: 1
  },
  {
    id: "bim",
    code: "F5",
    naam: "BIM-volwassenheid en datalevering",
    omschrijving: "Niveau van BIM-werken en datalevering.",
    categorie: "F. Samenwerking en gedrag",
    type: "gewogen",
    schaal: { soort: "niveau", min: 0, max: 5 },
    rollen: ALLE,
    actief: true,
    versie: 1
  },
  // G. Commercieel en risico
  {
    id: "contractvorm",
    code: "G1",
    naam: "Contractvormervaring",
    omschrijving: "Ervaringsniveau per contractvorm.",
    categorie: "G. Commercieel en risico",
    type: "gewogen",
    schaal: { soort: "niveau", min: 0, max: 5 },
    opties: [opt("bouwteam", "Bouwteam"), opt("design_build", "Design & Build"), opt("uav_gc", "UAV-GC"), opt("alliantie", "Alliantie")],
    rollen: ALLE,
    actief: true,
    versie: 1
  },
  {
    id: "prijsniveau",
    code: "G2",
    naam: "Prijsniveau t.o.v. markt",
    omschrijving: "Index, 100 = marktconform (lager is goedkoper).",
    categorie: "G. Commercieel en risico",
    type: "gewogen",
    schaal: { soort: "getal", eenheid: "index", lagerIsBeter: true, min: 80, max: 120 },
    rollen: ALLE,
    actief: true,
    versie: 1
  },
  {
    id: "financiele_gezondheid",
    vervalMaanden: 12,
    code: "G3",
    naam: "Financiële gezondheid",
    omschrijving: "Risicoklasse op basis van kerncijfers en deponeringen (hard bij 'hoog').",
    categorie: "G. Commercieel en risico",
    type: "hard",
    schaal: { soort: "keuze", meervoudig: false },
    opties: [opt("laag", "Laag risico"), opt("midden", "Midden risico"), opt("hoog", "Hoog risico")],
    rollen: ALLE,
    actief: true,
    versie: 1
  },
  {
    id: "afhankelijkheid",
    code: "G4",
    naam: "Afhankelijkheid van Blauwhoed",
    omschrijving: "Aandeel van Blauwhoed in de omzet van de partner (signaal).",
    categorie: "G. Commercieel en risico",
    type: "gewogen",
    schaal: { soort: "percentage", lagerIsBeter: true },
    rollen: ALLE,
    actief: true,
    afgeleid: true,
    versie: 1
  },
  {
    id: "uitsluiting",
    code: "G5",
    naam: "Uitsluitingen en certificaatstatus",
    omschrijving: "Geblokkeerde status of verlopen verplicht certificaat (hard).",
    categorie: "G. Commercieel en risico",
    type: "hard",
    schaal: { soort: "boolean" },
    rollen: ALLE,
    actief: true,
    versie: 1
  }
];

export const CATEGORIEEN = Array.from(new Set(FACTOREN.map((f) => f.categorie)));
