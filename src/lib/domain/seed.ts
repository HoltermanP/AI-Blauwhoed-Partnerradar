// Demodata: fictieve partners en projecten, opgezet zodat elke user story zichtbaar werkt.
import { FACTOREN } from "./factors";
import { geocode } from "./geo";
import { GEWICHTSPROFIELEN } from "./gewichten";
import type { Bron, Certificaat, Database, Engagement, Evaluatie, Partner, PartnerFactor, Project, Rol } from "./types";
import { BRON_BETROUWBAARHEID } from "./types";

const NU = "2026-08-30";
const iso = (d: string) => `${d}T09:00:00.000Z`;

function f(factorId: string, waarde: PartnerFactor["waarde"], bron: Bron = "opgave", optieId?: string, extra: Partial<PartnerFactor> = {}): PartnerFactor {
  return { factorId, optieId, waarde, bron, betrouwbaarheid: BRON_BETROUWBAARHEID[bron], peildatum: "2026-03-01", ...extra };
}

function cert(id: string, type: Certificaat["type"], nummer: string, geldigTot: string, niveau?: number, geverifieerdOp?: string): Certificaat {
  return { id, type, nummer, geldigTot, niveau, geverifieerdOp };
}

function partner(p: Partial<Partner> & Pick<Partner, "id" | "naam" | "kvk" | "vestigingsplaats" | "rollen" | "omschrijving">): Partner {
  return {
    rechtsvorm: "B.V.",
    locatie: geocode(p.vestigingsplaats) ?? { lat: 52.1, lng: 5.3 },
    werkgebiedKm: 120,
    status: "bekend",
    referenties: [],
    beschikbaarheid: [],
    factoren: [],
    certificaten: [],
    contactpersonen: [],
    kwalificatie: [],
    bronnen: [],
    tags: [],
    aangemaaktOp: iso("2025-01-10"),
    bijgewerktOp: iso("2026-03-01"),
    ...p
  };
}

export const SEED_PARTNERS: Partner[] = [
  partner({
    id: "p-woudbouw",
    naam: "Woudbouw Groep B.V.",
    kvk: "34123456",
    vestigingsplaats: "Amersfoort",
    adres: "Houtsingel 12",
    werkgebiedKm: 150,
    status: "preferred",
    rollen: ["aannemer"],
    website: "https://example.org/woudbouw",
    omschrijving: "Bouwer van houtbouw- en hybride woningbouwprojecten, van grondgebonden tot 8 lagen. Eigen CLT-productielijn, hoge prefabricagegraad, ervaring in bouwteam en ketensamenwerking.",
    referenties: ["Houtwijk Vathorst, 84 grondgebonden woningen (CLT, MPG 0,48)", "Eemkwartier blok D, 56 appartementen in houtskeletbouw met demontabele gevel", "Buitenplaats Hoef, 40 biobased woningen"],
    omzet: 48_000_000,
    medewerkers: 180,
    maxGelijktijdigeProjecten: 6,
    typischeProjectomvang: { min: 30, max: 150 },
    factoren: [
      f("bouwsysteem", 5, "opgave", "houtbouw"),
      f("bouwsysteem", 3, "opgave", "hybride"),
      f("prefabricage", 5),
      f("demontabel", 4),
      f("mpg", 0.48, "projecthistorie", undefined, { bewijs: { soort: "document", ref: "nmd-2025-vathorst", label: "NMD-berekening Houtwijk Vathorst" }, betrouwbaarheid: 0.9 }),
      f("beng", 28, "projecthistorie", undefined, { betrouwbaarheid: 0.85 }),
      f("biobased", 55, "projecthistorie", undefined, { betrouwbaarheid: 0.85 }),
      f("circulariteit", 4),
      f("natuurinclusief", 3),
      f("bouwteam", 5),
      f("bim", 4),
      f("contractvorm", 5, "opgave", "bouwteam"),
      f("contractvorm", 3, "opgave", "design_build"),
      f("prijsniveau", 104),
      f("conceptbouw", 4),
      f("gevel", 4)
    ],
    certificaten: [cert("c1", "ISO 9001", "NL-9001-4471", "2027-05-01", undefined, "2025-05-02"), cert("c2", "CO2-prestatieladder", "CO2-5-0921", "2026-10-15", 5, "2025-10-16"), cert("c3", "VCA", "VCA-88213", "2028-01-01"), cert("c4", "FSC", "FSC-C12345", "2027-03-01")],
    contactpersonen: [{ id: "cp1", naam: "R. de Groot", functie: "Commercieel directeur", email: "r.degroot@example.org", grondslag: "overeenkomst", vastgelegdOp: "2024-02-01", bewaartermijnMaanden: 60 }],
    kwalificatie: [
      { item: "verzekering", afgevinkt: true, door: "Inkoper", op: "2025-06-01" },
      { item: "kam", afgevinkt: true, door: "Inkoper", op: "2025-06-01" },
      { item: "gedragscode", afgevinkt: true, door: "Inkoper", op: "2025-06-01" },
      { item: "ketenaansprakelijkheid", afgevinkt: true, door: "Inkoper", op: "2025-06-01" },
      { item: "uittreksel_kvk", afgevinkt: true, door: "Inkoper", op: "2025-06-01" },
      { item: "financiele_toets", afgevinkt: true, door: "Inkoper", op: "2025-06-01" }
    ],
    financieel: { boekjaar: 2025, omzet: 48_000_000, omzetVorigJaar: 44_000_000, eigenVermogen: 9_500_000, solvabiliteit: 38, laatsteDeponering: "2026-04-20", betalingsgedrag: "goed", risicoklasse: "laag" },
    tags: ["houtbouw", "biobased", "bouwteam", "crediteur:CR-1001"]
  }),
  partner({
    id: "p-steenhuis",
    naam: "Steenhuis Bouw B.V.",
    kvk: "34234567",
    vestigingsplaats: "Rotterdam",
    adres: "Waalhaven Z.z. 40",
    werkgebiedKm: 100,
    rollen: ["aannemer"],
    website: "https://example.org/steenhuis",
    omschrijving: "Grote aannemer voor gestapelde woningbouw en hoogbouw in prefab beton en traditionele bouw. Sterke planningsdiscipline, UAV-GC-ervaring.",
    referenties: ["Woontoren De Zalmhaven-Zuid, 190 appartementen", "Feijenoord Blok 7, 120 middenhuur appartementen", "Transformatie kantoor Weena naar 85 appartementen"],
    omzet: 120_000_000,
    medewerkers: 420,
    maxGelijktijdigeProjecten: 10,
    typischeProjectomvang: { min: 60, max: 400 },
    factoren: [
      f("bouwsysteem", 5, "opgave", "prefab_beton"),
      f("bouwsysteem", 4, "opgave", "traditioneel"),
      f("bouwsysteem", 1, "opgave", "houtbouw"),
      f("prefabricage", 4),
      f("demontabel", 1),
      f("mpg", 0.78, "projecthistorie", undefined, { betrouwbaarheid: 0.85 }),
      f("beng", 35, "projecthistorie", undefined, { betrouwbaarheid: 0.8 }),
      f("biobased", 8),
      f("circulariteit", 2),
      f("bouwteam", 4),
      f("bim", 5),
      f("contractvorm", 5, "opgave", "uav_gc"),
      f("contractvorm", 4, "opgave", "bouwteam"),
      f("prijsniveau", 98),
      f("gevel", 4),
      f("welstand", 2)
    ],
    certificaten: [cert("c5", "ISO 9001", "NL-9001-1120", "2026-09-20", undefined, "2024-09-21"), cert("c6", "ISO 14001", "NL-14001-330", "2027-01-01"), cert("c7", "CO2-prestatieladder", "CO2-3-1180", "2027-06-01", 3, "2025-06-02"), cert("c8", "VCA", "VCA-30012", "2027-11-01")],
    contactpersonen: [{ id: "cp2", naam: "M. Jansen", functie: "Accountmanager", grondslag: "overeenkomst", vastgelegdOp: "2023-05-12", bewaartermijnMaanden: 60 }],
    kwalificatie: [
      { item: "verzekering", afgevinkt: true, door: "Inkoper", op: "2025-02-01" },
      { item: "kam", afgevinkt: true, door: "Inkoper", op: "2025-02-01" },
      { item: "gedragscode", afgevinkt: false },
      { item: "ketenaansprakelijkheid", afgevinkt: true, door: "Inkoper", op: "2025-02-01" },
      { item: "uittreksel_kvk", afgevinkt: true, door: "Inkoper", op: "2025-02-01" },
      { item: "financiele_toets", afgevinkt: true, door: "Inkoper", op: "2025-02-01" }
    ],
    financieel: { boekjaar: 2025, omzet: 120_000_000, omzetVorigJaar: 118_000_000, eigenVermogen: 22_000_000, solvabiliteit: 31, laatsteDeponering: "2026-05-30", betalingsgedrag: "goed", risicoklasse: "laag" },
    tags: ["hoogbouw", "prefab beton", "crediteur:CR-1002"]
  }),
  partner({
    id: "p-dorpsbouw",
    naam: "Dorpsbouw Van Dijk",
    kvk: "34345678",
    rechtsvorm: "V.O.F.",
    vestigingsplaats: "Ede",
    adres: "Molenweg 3",
    werkgebiedKm: 60,
    rollen: ["aannemer"],
    omschrijving: "Regionale aannemer voor grondgebonden koopwoningen in traditionele en dorpse stijl. Kleinschalig, betrouwbaar, beperkte capaciteit.",
    referenties: ["Kernhem fase 2, 28 rijwoningen Ede", "Hof van Bennekom, 16 twee-onder-een-kapwoningen"],
    omzet: 9_000_000,
    medewerkers: 35,
    maxGelijktijdigeProjecten: 2,
    typischeProjectomvang: { min: 8, max: 45 },
    factoren: [f("bouwsysteem", 5, "opgave", "traditioneel"), f("bouwsysteem", 2, "opgave", "houtbouw"), f("prefabricage", 2), f("conceptbouw", 2), f("bouwteam", 3), f("bim", 2), f("prijsniveau", 94), f("contractvorm", 4, "opgave", "bouwteam"), f("gevel", 4)],
    certificaten: [cert("c9", "VCA", "VCA-77120", "2026-09-10"), cert("c10", "CO2-prestatieladder", "CO2-3-7710", "2026-06-01", 3)],
    financieel: { boekjaar: 2025, omzet: 9_000_000, omzetVorigJaar: 12_500_000, eigenVermogen: 600_000, solvabiliteit: 18, laatsteDeponering: "2025-03-15", betalingsgedrag: "matig", risicoklasse: "midden", toelichting: "Omzetdaling 28% en late deponering 2025; solvabiliteit onder 20%." },
    beschikbaarheid: [{ van: "2026-09-01", tot: "2027-03-31", beschikbaar: false, toelichting: "Volledig bezet op Kernhem fase 3" }],
    tags: ["grondgebonden", "dorps", "crediteur:CR-1003"]
  }),
  partner({
    id: "p-betonfix",
    naam: "BetonFix Constructies B.V.",
    kvk: "34456789",
    vestigingsplaats: "Dordrecht",
    werkgebiedKm: 120,
    status: "geblokkeerd",
    statusReden: "Geschil over eindafrekening Merwedehaven; juridisch traject loopt",
    geblokkeerdTot: "2027-06-30",
    rollen: ["aannemer"],
    omschrijving: "Aannemer prefab beton, appartementen en parkeergarages.",
    referenties: ["Merwedehaven blok A, 70 appartementen"],
    omzet: 30_000_000,
    medewerkers: 110,
    typischeProjectomvang: { min: 40, max: 200 },
    factoren: [f("bouwsysteem", 5, "opgave", "prefab_beton"), f("prefabricage", 4), f("bim", 3)],
    certificaten: [cert("c11", "VCA", "VCA-11223", "2027-02-01")],
    tags: ["crediteur:CR-1004"]
  }),
  partner({
    id: "p-lindenhout",
    naam: "Lindenhout Architecten",
    kvk: "34567890",
    vestigingsplaats: "Utrecht",
    adres: "Maliebaan 88",
    werkgebiedKm: 200,
    status: "preferred",
    rollen: ["architect"],
    website: "https://example.org/lindenhout",
    omschrijving: "Architectenbureau met signatuur in warme, biobased architectuur: houten gevels, ruime buitenruimtes, natuurinclusief. Ervaring met welstandsgevoelige locaties en conceptontwikkeling.",
    referenties: ["Houtwijk Vathorst, stedenbouw en woningontwerp 84 woningen", "Buitenplaats Hoef, 40 biobased woningen in landgoedsetting", "Transformatie Kloostertuin, 30 appartementen in rijksmonument"],
    omzet: 4_500_000,
    medewerkers: 28,
    maxGelijktijdigeProjecten: 8,
    typischeProjectomvang: { min: 15, max: 200 },
    factoren: [
      f("architectuurstijl", 5, "opgave", "modern"),
      f("architectuurstijl", 4, "opgave", "dorps"),
      f("architectuurstijl", 2, "opgave", "hoogstedelijk"),
      f("welstand", 4),
      f("conceptbouw", 4),
      f("signatuur", "Warme houten gevels, natuurlijke materialen, collectieve tuinen, veel daglicht; biobased en circulair ontwerpen met demontabele details."),
      f("bouwsysteem", 5, "opgave", "houtbouw"),
      f("mpg", 0.5, "projecthistorie", undefined, { betrouwbaarheid: 0.85 }),
      f("biobased", 50, "projecthistorie", undefined, { betrouwbaarheid: 0.8 }),
      f("circulariteit", 4),
      f("natuurinclusief", 5),
      f("demontabel", 4),
      f("bim", 4),
      f("bouwteam", 4),
      f("gevel", 5),
      f("fase_expertise", 5, "opgave", "planvorming"),
      f("fase_expertise", 4, "opgave", "initiatief")
    ],
    certificaten: [cert("c12", "BREEAM-expertise", "BRE-EXP-2201", "2027-12-31", undefined, "2025-01-10")],
    kwalificatie: [
      { item: "verzekering", afgevinkt: true, door: "Inkoper", op: "2025-03-01" },
      { item: "kam", afgevinkt: true, door: "Inkoper", op: "2025-03-01" },
      { item: "gedragscode", afgevinkt: true, door: "Inkoper", op: "2025-03-01" },
      { item: "ketenaansprakelijkheid", afgevinkt: true, door: "Inkoper", op: "2025-03-01" },
      { item: "uittreksel_kvk", afgevinkt: true, door: "Inkoper", op: "2025-03-01" },
      { item: "financiele_toets", afgevinkt: true, door: "Inkoper", op: "2025-03-01" }
    ],
    financieel: { boekjaar: 2025, omzet: 4_500_000, omzetVorigJaar: 4_100_000, eigenVermogen: 1_200_000, solvabiliteit: 45, laatsteDeponering: "2026-03-01", betalingsgedrag: "goed", risicoklasse: "laag" },
    tags: ["biobased", "natuurinclusief", "crediteur:CR-2001"]
  }),
  partner({
    id: "p-urbanaxis",
    naam: "UrbanAxis Architects",
    kvk: "34678901",
    vestigingsplaats: "Amsterdam",
    adres: "Oostenburgergracht 75",
    werkgebiedKm: 250,
    rollen: ["architect"],
    omschrijving: "Hoogstedelijk ontwerpbureau: woontorens, gemengde plinten, parametrisch ontwerp. Modern en industrieel idioom, BIM-niveau 3.",
    referenties: ["Sluisbuurt toren 9, 240 appartementen Amsterdam", "Weena-transformatie Rotterdam, 85 appartementen", "Binckhorst blok 2, 160 middenhuurappartementen Den Haag"],
    omzet: 6_800_000,
    medewerkers: 45,
    typischeProjectomvang: { min: 60, max: 500 },
    factoren: [
      f("architectuurstijl", 5, "opgave", "hoogstedelijk"),
      f("architectuurstijl", 5, "opgave", "modern"),
      f("architectuurstijl", 4, "opgave", "industrieel"),
      f("welstand", 3),
      f("signatuur", "Strakke, hoogstedelijke torens met expressieve plinten; glas, staal en beton; parametrische gevelpatronen."),
      f("bouwsysteem", 4, "opgave", "prefab_beton"),
      f("bouwsysteem", 2, "opgave", "houtbouw"),
      f("mpg", 0.72, "projecthistorie", undefined, { betrouwbaarheid: 0.8 }),
      f("circulariteit", 2),
      f("natuurinclusief", 2),
      f("bim", 5),
      f("bouwteam", 3),
      f("conceptbouw", 1),
      f("gevel", 4),
      f("fase_expertise", 5, "opgave", "planvorming")
    ],
    financieel: { boekjaar: 2025, omzet: 6_800_000, omzetVorigJaar: 6_900_000, eigenVermogen: 1_900_000, solvabiliteit: 40, laatsteDeponering: "2026-02-15", betalingsgedrag: "goed", risicoklasse: "laag" },
    tags: ["hoogbouw", "crediteur:CR-2002"]
  }),
  partner({
    id: "p-bureau-helder",
    naam: "Bureau Helder Architectuur",
    kvk: "34789012",
    vestigingsplaats: "Zwolle",
    werkgebiedKm: 120,
    rollen: ["architect"],
    omschrijving: "Traditionele en dorpse woningbouwarchitectuur, sterk in welstandsgevoelige kernen en conceptwoningen voor uitleglocaties.",
    referenties: ["Stadshagen Breezicht, 120 grondgebonden woningen", "Dorpshart Dalfsen, 24 woningen in beschermd dorpsgezicht"],
    omzet: 2_100_000,
    medewerkers: 14,
    typischeProjectomvang: { min: 10, max: 150 },
    factoren: [
      f("architectuurstijl", 5, "opgave", "traditioneel"),
      f("architectuurstijl", 5, "opgave", "dorps"),
      f("welstand", 5),
      f("conceptbouw", 5),
      f("signatuur", "Jaren-30 en dorpse referenties, baksteen en keramische pannen, herhaalbare woningconcepten."),
      f("bouwsysteem", 3, "opgave", "traditioneel"),
      f("bim", 3),
      f("bouwteam", 3),
      f("gevel", 4)
    ],
    financieel: { boekjaar: 2025, omzet: 2_100_000, solvabiliteit: 35, laatsteDeponering: "2026-01-20", betalingsgedrag: "goed", risicoklasse: "laag" },
    tags: ["dorps", "concept", "crediteur:CR-2003"]
  }),
  partner({
    id: "p-klimaattechniek",
    naam: "Klimaattechniek Nederland B.V.",
    kvk: "34890123",
    vestigingsplaats: "Utrecht",
    adres: "Atoomweg 50",
    werkgebiedKm: 150,
    status: "preferred",
    rollen: ["installateur"],
    omschrijving: "Installateur W en E voor woningbouw; warmtepompen, WTW, PV, all-electric en BENG-optimalisatie. BIM-niveau 2, ervaring met houtbouw en prefab installatiemodules.",
    referenties: ["Houtwijk Vathorst, 84 woningen all-electric (BENG-2 gemeten 24 kWh/m²)", "Feijenoord Blok 7, 120 appartementen", "Eemkwartier blok D, 56 appartementen"],
    omzet: 32_000_000,
    medewerkers: 150,
    maxGelijktijdigeProjecten: 12,
    typischeProjectomvang: { min: 20, max: 300 },
    factoren: [f("beng", 24, "projecthistorie", undefined, { betrouwbaarheid: 0.9, bewijs: { soort: "document", ref: "beng-meting-vathorst", label: "BENG-meetrapport Houtwijk Vathorst" } }), f("bim", 4), f("bouwsysteem", 4, "opgave", "houtbouw"), f("bouwsysteem", 4, "opgave", "prefab_beton"), f("prefabricage", 4), f("bouwteam", 4), f("prijsniveau", 102), f("contractvorm", 4, "opgave", "bouwteam")],
    certificaten: [cert("c13", "ISO 9001", "NL-9001-8830", "2027-08-01"), cert("c14", "VCA", "VCA-55901", "2026-11-05"), cert("c15", "CO2-prestatieladder", "CO2-4-2201", "2027-02-01", 4, "2025-02-02")],
    kwalificatie: [
      { item: "verzekering", afgevinkt: true, door: "Inkoper", op: "2025-04-01" },
      { item: "kam", afgevinkt: true, door: "Inkoper", op: "2025-04-01" },
      { item: "gedragscode", afgevinkt: true, door: "Inkoper", op: "2025-04-01" },
      { item: "ketenaansprakelijkheid", afgevinkt: true, door: "Inkoper", op: "2025-04-01" },
      { item: "uittreksel_kvk", afgevinkt: true, door: "Inkoper", op: "2025-04-01" },
      { item: "financiele_toets", afgevinkt: true, door: "Inkoper", op: "2025-04-01" }
    ],
    financieel: { boekjaar: 2025, omzet: 32_000_000, omzetVorigJaar: 29_000_000, eigenVermogen: 5_000_000, solvabiliteit: 33, laatsteDeponering: "2026-04-01", betalingsgedrag: "goed", risicoklasse: "laag" },
    tags: ["all-electric", "crediteur:CR-3001"]
  }),
  partner({
    id: "p-installo",
    naam: "Installo Techniek",
    kvk: "34901234",
    vestigingsplaats: "Breda",
    werkgebiedKm: 90,
    rollen: ["installateur"],
    omschrijving: "Regionale installateur, grondgebonden woningbouw, warmtepompen en PV. Scherp geprijsd.",
    referenties: ["Teteringen fase 5, 60 woningen"],
    omzet: 11_000_000,
    medewerkers: 48,
    typischeProjectomvang: { min: 10, max: 120 },
    factoren: [f("beng", 33), f("bim", 2), f("prijsniveau", 92), f("bouwteam", 2), f("bouwsysteem", 3, "opgave", "traditioneel")],
    certificaten: [cert("c16", "VCA", "VCA-61004", "2026-09-25")],
    financieel: { boekjaar: 2025, omzet: 11_000_000, solvabiliteit: 27, laatsteDeponering: "2026-06-01", betalingsgedrag: "goed", risicoklasse: "laag" },
    tags: ["crediteur:CR-3002"]
  }),
  partner({
    id: "p-duurzaamadvies",
    naam: "Adviesbureau Kringloop",
    kvk: "35012345",
    vestigingsplaats: "Den Haag",
    werkgebiedKm: 200,
    rollen: ["adviseur"],
    omschrijving: "Adviseur duurzaamheid en circulariteit: MPG-berekeningen, Paris Proof, materialenpaspoorten, BENG en biobased materialisatie. Begeleidt bouwteams vanaf initiatief.",
    referenties: ["MPG en materialenpaspoort Houtwijk Vathorst", "Circulair sloop- en hergebruikplan Kloostertuin", "Paris Proof-routekaart Binckhorst blok 2"],
    omzet: 2_800_000,
    medewerkers: 19,
    typischeProjectomvang: { min: 10, max: 500 },
    factoren: [f("mpg", 0.45, "projecthistorie", undefined, { betrouwbaarheid: 0.85 }), f("circulariteit", 5), f("bouwsysteem", 4, "opgave", "houtbouw"), f("biobased", 45), f("fase_expertise", 5, "opgave", "initiatief"), f("fase_expertise", 5, "opgave", "planvorming"), f("bim", 3), f("bouwteam", 4), f("natuurinclusief", 3)],
    certificaten: [cert("c17", "BREEAM-expertise", "BRE-EXP-1188", "2026-12-31")],
    financieel: { boekjaar: 2025, omzet: 2_800_000, solvabiliteit: 50, laatsteDeponering: "2026-02-01", betalingsgedrag: "goed", risicoklasse: "laag" },
    tags: ["mpg", "circulair", "crediteur:CR-4001"]
  }),
  partner({
    id: "p-constructief",
    naam: "Balk & Kolom Constructeurs",
    kvk: "35123456",
    vestigingsplaats: "Delft",
    werkgebiedKm: 200,
    rollen: ["adviseur"],
    omschrijving: "Constructief adviseur voor hoogbouw, prefab beton en houtbouw tot 12 lagen. Brandveiligheid en akoestiek houtbouw.",
    referenties: ["Constructie Sluisbuurt toren 9", "Constructie Eemkwartier blok D (CLT 6 lagen)"],
    omzet: 5_200_000,
    medewerkers: 40,
    typischeProjectomvang: { min: 20, max: 500 },
    factoren: [f("bouwsysteem", 5, "opgave", "prefab_beton"), f("bouwsysteem", 4, "opgave", "houtbouw"), f("bim", 5), f("fase_expertise", 5, "opgave", "planvorming"), f("fase_expertise", 4, "opgave", "realisatie"), f("bouwteam", 4)],
    financieel: { boekjaar: 2025, omzet: 5_200_000, solvabiliteit: 42, laatsteDeponering: "2026-03-10", betalingsgedrag: "goed", risicoklasse: "laag" },
    tags: ["constructie", "crediteur:CR-4002"]
  }),
  partner({
    id: "p-gevelwerk",
    naam: "GevelWerk Prefab B.V.",
    kvk: "35234567",
    vestigingsplaats: "Tilburg",
    werkgebiedKm: 200,
    rollen: ["leverancier"],
    omschrijving: "Leverancier van prefab houten gevelelementen met biobased isolatie; demontabele bevestiging; materialenpaspoort per element.",
    referenties: ["Gevelelementen Eemkwartier blok D", "Gevelelementen Piushaven Tilburg, 140 appartementen"],
    omzet: 18_000_000,
    medewerkers: 85,
    typischeProjectomvang: { min: 20, max: 300 },
    factoren: [f("bouwsysteem", 5, "opgave", "houtbouw"), f("prefabricage", 5), f("demontabel", 5), f("biobased", 60), f("circulariteit", 4), f("gevel", 5), f("bim", 4), f("prijsniveau", 106)],
    certificaten: [cert("c18", "FSC", "FSC-C55522", "2027-09-01"), cert("c19", "KOMO", "KOMO-77-119", "2026-09-05")],
    financieel: { boekjaar: 2025, omzet: 18_000_000, omzetVorigJaar: 15_000_000, solvabiliteit: 29, laatsteDeponering: "2026-05-01", betalingsgedrag: "goed", risicoklasse: "laag" },
    tags: ["gevel", "crediteur:CR-5001"]
  }),
  partner({
    id: "p-betonelementen",
    naam: "Betonelementen Oost",
    kvk: "35345678",
    vestigingsplaats: "Deventer",
    werkgebiedKm: 150,
    rollen: ["leverancier"],
    omschrijving: "Prefab betonelementen voor gestapelde bouw: wanden, vloeren, balkons. Grote volumes, korte levertijden.",
    referenties: ["Casco Feijenoord Blok 7", "Casco Stadshagen Breezicht"],
    omzet: 40_000_000,
    medewerkers: 160,
    typischeProjectomvang: { min: 40, max: 600 },
    factoren: [f("bouwsysteem", 5, "opgave", "prefab_beton"), f("prefabricage", 5), f("demontabel", 2), f("mpg", 0.85), f("bim", 4), f("prijsniveau", 97)],
    certificaten: [cert("c20", "KOMO", "KOMO-12-880", "2027-04-01"), cert("c21", "CO2-prestatieladder", "CO2-3-5540", "2026-04-01", 3)],
    financieel: { boekjaar: 2025, omzet: 40_000_000, solvabiliteit: 26, laatsteDeponering: "2026-06-15", betalingsgedrag: "matig", risicoklasse: "midden", toelichting: "Betalingsgedrag richting onderaannemers matig volgens kredietrapport." },
    tags: ["prefab beton", "crediteur:CR-5002"]
  }),
  partner({
    id: "p-hollands-hout",
    naam: "Hollands Hout Constructies",
    kvk: "71234568",
    vestigingsplaats: "Zaandam",
    adres: "Hembrugterrein 12",
    werkgebiedKm: 100,
    status: "prospect",
    statusReden: "Gepromoveerd uit discovery (Vakmedia: Houtwereld) op 2026-06-12",
    rollen: ["aannemer", "leverancier"],
    website: "https://example.org/hhc",
    omschrijving: "Houtskeletbouw en CLT-casco's voor appartementen tot 8 lagen. MPG < 0,5 aantoonbaar via NMD-berekening. Demontabele knooppunten.",
    referenties: ["Hembrug Wonen, 64 appartementen Zaandam", "Houtwijk, 40 woningen Purmerend"],
    medewerkers: 55,
    typischeProjectomvang: { min: 20, max: 120 },
    factoren: [f("bouwsysteem", 4, "web", "houtbouw"), f("mpg", 0.49, "web"), f("prefabricage", 4, "web"), f("demontabel", 3, "web")],
    bronnen: [{ url: "https://example.org/houtwereld/hhc", opgehaaldOp: "2026-06-10", soort: "Vakmedia: Houtwereld" }],
    tags: ["prospect", "houtbouw"]
  }),
  partner({
    id: "p-ontwikkelpartner",
    naam: "Samenwerkend Wonen Ontwikkeling",
    kvk: "35456789",
    vestigingsplaats: "Haarlem",
    werkgebiedKm: 100,
    rollen: ["ontwikkelpartner"],
    omschrijving: "Mede-ontwikkelaar voor gebiedsontwikkeling en betaalbare woningbouw; risicodragend in alliantievorm.",
    referenties: ["Gebiedsontwikkeling Schalkwijk Midden, 600 woningen (alliantie)"],
    omzet: 25_000_000,
    medewerkers: 30,
    typischeProjectomvang: { min: 100, max: 1000 },
    factoren: [f("contractvorm", 5, "opgave", "alliantie"), f("fase_expertise", 5, "opgave", "initiatief"), f("bouwteam", 4)],
    financieel: { boekjaar: 2025, omzet: 25_000_000, solvabiliteit: 35, laatsteDeponering: "2026-03-01", betalingsgedrag: "goed", risicoklasse: "laag" },
    tags: ["crediteur:CR-6001"]
  })
];

function project(p: Partial<Project> & Pick<Project, "id" | "naam" | "type" | "woningen" | "fase" | "omschrijving"> & { plaats: string }): Project {
  const geo = geocode(p.plaats) ?? { lat: 52.1, lng: 5.3 };
  const { plaats, ...rest } = p;
  return {
    locatie: { ...geo, plaats },
    prijssegment: ["koop"],
    bouwstijl: "modern",
    ambitieDuurzaamheid: 3,
    planning: { start: "2027-01-01", eind: "2028-12-31" },
    eisen: [],
    aangemaaktOp: iso("2025-01-10"),
    bijgewerktOp: iso("2026-03-01"),
    ...rest
  };
}

const houtbouwProfiel = GEWICHTSPROFIELEN.find((g) => g.id === "houtbouw-biobased")!;
const hoogbouwProfiel = GEWICHTSPROFIELEN.find((g) => g.id === "binnenstedelijk-hoogbouw")!;

export const SEED_PROJECTEN: Project[] = [
  project({ id: "proj-vathorst", naam: "Houtwijk Vathorst", type: "grondgebonden", plaats: "Amersfoort", woningen: 84, prijssegment: ["koop", "middenhuur"], bouwstijl: "modern", ambitieDuurzaamheid: 5, fase: "opgeleverd", planning: { start: "2023-03-01", eind: "2025-02-28" }, omschrijving: "84 grondgebonden woningen in CLT met houten gevels, all-electric, MPG-doel 0,5." }),
  project({ id: "proj-eemkwartier", naam: "Eemkwartier blok D", type: "appartementen", plaats: "Amersfoort", woningen: 56, prijssegment: ["middenhuur"], bouwstijl: "modern", ambitieDuurzaamheid: 5, fase: "opgeleverd", planning: { start: "2023-09-01", eind: "2025-10-31" }, omschrijving: "56 middenhuurappartementen, 6 lagen houtskeletbouw met demontabele prefab gevel." }),
  project({ id: "proj-feijenoord", naam: "Feijenoord Blok 7", type: "appartementen", plaats: "Rotterdam", woningen: 120, prijssegment: ["middenhuur", "sociaal"], bouwstijl: "hoogstedelijk", ambitieDuurzaamheid: 3, fase: "opgeleverd", planning: { start: "2022-01-01", eind: "2024-06-30" }, omschrijving: "120 appartementen in prefab beton, stedelijke plint, 9 lagen." }),
  project({ id: "proj-kloostertuin", naam: "Transformatie Kloostertuin", type: "transformatie", plaats: "Utrecht", woningen: 30, prijssegment: ["vrije sector"], bouwstijl: "traditioneel", ambitieDuurzaamheid: 4, fase: "realisatie", planning: { start: "2025-06-01", eind: "2027-03-31" }, omschrijving: "Herbestemming rijksmonument klooster naar 30 appartementen; circulair sloopplan, welstandsgevoelig." }),
  project({ id: "proj-breezicht", naam: "Stadshagen Breezicht", type: "grondgebonden", plaats: "Zwolle", woningen: 120, prijssegment: ["koop"], bouwstijl: "dorps", ambitieDuurzaamheid: 3, fase: "nazorg", planning: { start: "2022-05-01", eind: "2024-12-31" }, omschrijving: "120 grondgebonden conceptwoningen in dorpse stijl, prefab betoncasco." }),
  project({
    id: "proj-sluisbuurt",
    naam: "Sluisbuurt kavel 12",
    type: "hoogbouw",
    plaats: "Amsterdam",
    woningen: 180,
    prijssegment: ["middenhuur", "koop"],
    bouwstijl: "hoogstedelijk",
    ambitieDuurzaamheid: 4,
    fase: "planvorming",
    planning: { start: "2027-06-01", eind: "2029-12-31" },
    omschrijving: "Woontoren van 18 lagen met 180 appartementen, gemengde plint, hoge eisen aan BIM en planningsbetrouwbaarheid; ambitie hybride houtbouw boven betonnen onderbouw.",
    gewichtsprofielId: "binnenstedelijk-hoogbouw",
    eisen: [
      { rol: "architect", eisen: hoogbouwProfiel.perRol.architect!, semantischGewicht: 15, vrijeOmschrijving: "hoogstedelijke woontoren met expressieve plint en hybride houtbouw" },
      { rol: "aannemer", eisen: hoogbouwProfiel.perRol.aannemer!, semantischGewicht: 15 },
      { rol: "installateur", eisen: hoogbouwProfiel.perRol.installateur!, semantischGewicht: 10 },
      { rol: "adviseur", eisen: hoogbouwProfiel.perRol.adviseur!, semantischGewicht: 10 }
    ]
  }),
  project({
    id: "proj-groene-loper",
    naam: "De Groene Loper",
    type: "grondgebonden",
    plaats: "Hilversum",
    woningen: 62,
    prijssegment: ["koop", "middenhuur"],
    bouwstijl: "dorps",
    ambitieDuurzaamheid: 5,
    fase: "initiatief",
    planning: { start: "2027-03-01", eind: "2028-09-30" },
    omschrijving: "62 grondgebonden woningen in circulaire houtbouw met demontabele gevel, biobased isolatie en natuurinclusieve tuinen; Paris Proof.",
    gewichtsprofielId: "houtbouw-biobased",
    eisen: [
      { rol: "architect", eisen: houtbouwProfiel.perRol.architect!, semantischGewicht: 20, vrijeOmschrijving: "circulaire houtbouw met demontabele gevel en natuurinclusieve tuinen" },
      { rol: "aannemer", eisen: houtbouwProfiel.perRol.aannemer!, semantischGewicht: 20, vrijeOmschrijving: "circulaire houtbouw met demontabele gevel" },
      { rol: "installateur", eisen: houtbouwProfiel.perRol.installateur!, semantischGewicht: 10 },
      { rol: "adviseur", eisen: houtbouwProfiel.perRol.adviseur!, semantischGewicht: 15 },
      { rol: "leverancier", eisen: houtbouwProfiel.perRol.leverancier!, semantischGewicht: 20, vrijeOmschrijving: "demontabele biobased gevelelementen" }
    ]
  })
];

function eng(e: Omit<Engagement, "bron"> & { bron?: Engagement["bron"] }): Engagement {
  return { bron: "handmatig", ...e };
}

export const SEED_ENGAGEMENTS: Engagement[] = [
  eng({ id: "e1", partnerId: "p-woudbouw", projectId: "proj-vathorst", rol: "aannemer", periode: { van: "2023-03-01", tot: "2025-02-28" }, contractwaarde: 21_500_000, ramingBijStart: 21_000_000, eindafrekening: 21_600_000, geplandeOplevering: "2025-02-15", werkelijkeOplevering: "2025-02-28", bouwsysteem: "houtbouw", crediteurnummer: "CR-1001" }),
  eng({ id: "e2", partnerId: "p-lindenhout", projectId: "proj-vathorst", rol: "architect", periode: { van: "2022-06-01", tot: "2025-02-28" }, contractwaarde: 900_000, ramingBijStart: 880_000, eindafrekening: 910_000, crediteurnummer: "CR-2001" }),
  eng({ id: "e3", partnerId: "p-klimaattechniek", projectId: "proj-vathorst", rol: "installateur", periode: { van: "2023-06-01", tot: "2025-02-28" }, contractwaarde: 3_100_000, ramingBijStart: 3_000_000, eindafrekening: 3_150_000, geplandeOplevering: "2025-02-15", werkelijkeOplevering: "2025-02-20", crediteurnummer: "CR-3001" }),
  eng({ id: "e4", partnerId: "p-duurzaamadvies", projectId: "proj-vathorst", rol: "adviseur", periode: { van: "2022-04-01", tot: "2025-02-28" }, contractwaarde: 120_000, crediteurnummer: "CR-4001" }),
  eng({ id: "e5", partnerId: "p-woudbouw", projectId: "proj-eemkwartier", rol: "aannemer", periode: { van: "2023-09-01", tot: "2025-10-31" }, contractwaarde: 14_200_000, ramingBijStart: 13_500_000, eindafrekening: 14_400_000, geplandeOplevering: "2025-09-30", werkelijkeOplevering: "2025-10-31", bouwsysteem: "houtbouw", crediteurnummer: "CR-1001" }),
  eng({ id: "e6", partnerId: "p-gevelwerk", projectId: "proj-eemkwartier", rol: "leverancier", periode: { van: "2024-03-01", tot: "2025-06-30" }, contractwaarde: 2_400_000, ramingBijStart: 2_300_000, eindafrekening: 2_450_000, crediteurnummer: "CR-5001" }),
  eng({ id: "e7", partnerId: "p-klimaattechniek", projectId: "proj-eemkwartier", rol: "installateur", periode: { van: "2024-01-01", tot: "2025-10-31" }, contractwaarde: 2_900_000, ramingBijStart: 2_800_000, eindafrekening: 2_950_000, geplandeOplevering: "2025-09-30", werkelijkeOplevering: "2025-10-20", crediteurnummer: "CR-3001" }),
  eng({ id: "e8", partnerId: "p-constructief", projectId: "proj-eemkwartier", rol: "adviseur", periode: { van: "2023-01-01", tot: "2025-10-31" }, contractwaarde: 260_000, crediteurnummer: "CR-4002" }),
  eng({ id: "e9", partnerId: "p-steenhuis", projectId: "proj-feijenoord", rol: "aannemer", periode: { van: "2022-01-01", tot: "2024-06-30" }, contractwaarde: 32_000_000, ramingBijStart: 30_000_000, eindafrekening: 33_800_000, geplandeOplevering: "2024-03-31", werkelijkeOplevering: "2024-06-30", bouwsysteem: "prefab_beton", crediteurnummer: "CR-1002" }),
  eng({ id: "e10", partnerId: "p-urbanaxis", projectId: "proj-feijenoord", rol: "architect", periode: { van: "2020-09-01", tot: "2024-06-30" }, contractwaarde: 1_400_000, ramingBijStart: 1_350_000, eindafrekening: 1_420_000, crediteurnummer: "CR-2002" }),
  eng({ id: "e11", partnerId: "p-klimaattechniek", projectId: "proj-feijenoord", rol: "installateur", periode: { van: "2022-06-01", tot: "2024-06-30" }, contractwaarde: 5_600_000, ramingBijStart: 5_400_000, eindafrekening: 5_900_000, geplandeOplevering: "2024-03-31", werkelijkeOplevering: "2024-06-30", crediteurnummer: "CR-3001" }),
  eng({ id: "e12", partnerId: "p-betonelementen", projectId: "proj-feijenoord", rol: "leverancier", periode: { van: "2022-03-01", tot: "2023-09-30" }, contractwaarde: 6_200_000, ramingBijStart: 6_000_000, eindafrekening: 6_250_000, crediteurnummer: "CR-5002" }),
  eng({ id: "e13", partnerId: "p-lindenhout", projectId: "proj-kloostertuin", rol: "architect", periode: { van: "2024-09-01" }, contractwaarde: 520_000, ramingBijStart: 500_000, crediteurnummer: "CR-2001" }),
  eng({ id: "e14", partnerId: "p-duurzaamadvies", projectId: "proj-kloostertuin", rol: "adviseur", periode: { van: "2024-09-01" }, contractwaarde: 95_000, crediteurnummer: "CR-4001" }),
  eng({ id: "e15", partnerId: "p-dorpsbouw", projectId: "proj-kloostertuin", rol: "aannemer", periode: { van: "2025-06-01" }, contractwaarde: 8_900_000, ramingBijStart: 8_400_000, bouwsysteem: "traditioneel", crediteurnummer: "CR-1003" }),
  eng({ id: "e16", partnerId: "p-bureau-helder", projectId: "proj-breezicht", rol: "architect", periode: { van: "2021-06-01", tot: "2024-12-31" }, contractwaarde: 640_000, ramingBijStart: 640_000, eindafrekening: 650_000, crediteurnummer: "CR-2003" }),
  eng({ id: "e17", partnerId: "p-steenhuis", projectId: "proj-breezicht", rol: "aannemer", periode: { van: "2022-05-01", tot: "2024-12-31" }, contractwaarde: 24_000_000, ramingBijStart: 23_000_000, eindafrekening: 24_900_000, geplandeOplevering: "2024-10-31", werkelijkeOplevering: "2024-12-20", bouwsysteem: "prefab_beton", crediteurnummer: "CR-1002" }),
  eng({ id: "e18", partnerId: "p-betonelementen", projectId: "proj-breezicht", rol: "leverancier", periode: { van: "2022-08-01", tot: "2024-03-31" }, contractwaarde: 4_800_000, ramingBijStart: 4_700_000, eindafrekening: 4_820_000, crediteurnummer: "CR-5002" }),
  eng({ id: "e19", partnerId: "p-installo", projectId: "proj-breezicht", rol: "installateur", periode: { van: "2022-10-01", tot: "2024-12-31" }, contractwaarde: 3_600_000, ramingBijStart: 3_300_000, eindafrekening: 3_900_000, geplandeOplevering: "2024-10-31", werkelijkeOplevering: "2025-01-20", crediteurnummer: "CR-3002" })
];

function ev(e: Omit<Evaluatie, "door"> & { door?: string }): Evaluatie {
  return { door: "Projectleider", ...e };
}

export const SEED_EVALUATIES: Evaluatie[] = [
  ev({ id: "ev1", engagementId: "e1", partnerId: "p-woudbouw", projectId: "proj-vathorst", datum: "2025-03-15", kwaliteit: 5, planning: 4, budget: 4, samenwerking: 5, duurzaamheid: 5, toelichting: "Uitstekende afwerking, MPG-doel gehaald. Twee weken vertraging door leveringsprobleem gevelhout." }),
  ev({ id: "ev2", engagementId: "e2", partnerId: "p-lindenhout", projectId: "proj-vathorst", datum: "2025-03-15", kwaliteit: 5, planning: 5, budget: 5, samenwerking: 5, duurzaamheid: 5, toelichting: "Sterk ontwerp, welstand in één keer akkoord." }),
  ev({ id: "ev3", engagementId: "e3", partnerId: "p-klimaattechniek", projectId: "proj-vathorst", datum: "2025-03-15", kwaliteit: 4, planning: 5, budget: 4, samenwerking: 4, duurzaamheid: 5, toelichting: "BENG-2 gemeten 24 kWh/m². Goede afstemming met houtbouwer." }),
  ev({ id: "ev4", engagementId: "e5", partnerId: "p-woudbouw", projectId: "proj-eemkwartier", datum: "2025-11-20", kwaliteit: 4, planning: 3, budget: 3, samenwerking: 4, duurzaamheid: 5, toelichting: "Een maand vertraging en 6% meerwerk door gewijzigde brandveiligheidseisen. Samenwerking constructief." }),
  ev({ id: "ev5", engagementId: "e6", partnerId: "p-gevelwerk", projectId: "proj-eemkwartier", datum: "2025-11-20", kwaliteit: 5, planning: 4, budget: 4, samenwerking: 4, duurzaamheid: 5, toelichting: "Demontabele gevel werkte goed; materialenpaspoort geleverd." }),
  ev({ id: "ev6", engagementId: "e9", partnerId: "p-steenhuis", projectId: "proj-feijenoord", datum: "2024-07-30", kwaliteit: 4, planning: 3, budget: 2, samenwerking: 3, duurzaamheid: 2, toelichting: "13% overschrijding en drie maanden vertraging; kwaliteit prima. Meerwerkdiscussies verliepen stroef." }),
  ev({ id: "ev7", engagementId: "e10", partnerId: "p-urbanaxis", projectId: "proj-feijenoord", datum: "2024-07-30", kwaliteit: 5, planning: 4, budget: 4, samenwerking: 4, duurzaamheid: 3, toelichting: "Sterk gebouw, plint werkt goed in de buurt." }),
  ev({ id: "ev8", engagementId: "e11", partnerId: "p-klimaattechniek", projectId: "proj-feijenoord", datum: "2024-07-30", kwaliteit: 4, planning: 3, budget: 3, samenwerking: 4, duurzaamheid: 3, toelichting: "Vertraging volgde de hoofdaannemer." }),
  ev({ id: "ev9", engagementId: "e16", partnerId: "p-bureau-helder", projectId: "proj-breezicht", datum: "2025-01-20", kwaliteit: 4, planning: 5, budget: 5, samenwerking: 5, duurzaamheid: 3, toelichting: "Concept goed herhaalbaar, welstand zonder problemen." }),
  ev({ id: "ev10", engagementId: "e17", partnerId: "p-steenhuis", projectId: "proj-breezicht", datum: "2025-01-20", kwaliteit: 4, planning: 4, budget: 3, samenwerking: 4, duurzaamheid: 2, toelichting: "Beter dan Feijenoord; 4% meerwerk." }),
  ev({ id: "ev11", engagementId: "e19", partnerId: "p-installo", projectId: "proj-breezicht", datum: "2025-02-01", kwaliteit: 3, planning: 2, budget: 2, samenwerking: 3, duurzaamheid: 3, toelichting: "Late oplevering, 18% meerwerk, capaciteitsproblemen." })
];

/** Lege productiedatabase: alleen configuratie (factorenmodel, gewichtsprofielen), geen partners of projecten. */
export function maakLegeDatabase(): Database {
  const db = maakSeedDatabase();
  return {
    ...db,
    partners: [],
    projecten: [],
    engagements: [],
    evaluaties: [],
    audit: [{ id: "a0", op: new Date().toISOString(), door: "systeem", gebruikersrol: "beheerder", entiteit: "database", entiteitId: "init", actie: "lege database aangemaakt" }],
    instellingen: { aiProvider: process.env.ANTHROPIC_API_KEY ? "anthropic" : "uit", afgeschermdeOmgeving: true, externeBronnenToegestaan: true, aiBudgetUsdPerMaand: 100 }
  };
}

export function maakSeedDatabase(): Database {
  return {
    versie: 2,
    factoren: FACTOREN.map((x) => ({ ...x })),
    partners: SEED_PARTNERS,
    projecten: SEED_PROJECTEN,
    engagements: SEED_ENGAGEMENTS,
    evaluaties: SEED_EVALUATIES,
    kandidaten: [],
    matchRuns: [],
    feedback: [],
    teams: [],
    gewichtsprofielen: GEWICHTSPROFIELEN,
    verrijkingsvoorstellen: [],
    aiBewerkingen: [],
    audit: [{ id: "a0", op: iso(NU), door: "systeem", gebruikersrol: "beheerder", entiteit: "database", entiteitId: "seed", actie: "seed geladen", details: "Demodata geladen" }],
    gebruikers: [],
    importWachtrij: [],
    afwijsredenen: [],
    instellingen: { aiProvider: "uit", afgeschermdeOmgeving: true, externeBronnenToegestaan: false, aiBudgetUsdPerMaand: 100 }
  };
}

export type { Rol };
