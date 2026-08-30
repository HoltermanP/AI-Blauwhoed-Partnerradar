// Uitgebreide demo-instroom voor discovery: fictieve bedrijven, gespreid over rollen, archetypen en regio's.
// Vervang of vul aan met echte connectors (KVK Zoeken API in kvk.ts) zodra het bronnenbeleid vaststaat.
import type { Rol } from "./types";

export type DemoBedrijf = { naam: string; kvk: string; plaats: string; adres: string; website: string; rollen: Rol[]; profiel: string; referenties: string[]; medewerkers: number; bron: string; bronUrl: string; tags: string[] };

export const DEMO_BEDRIJVEN_EXTRA: DemoBedrijf[] = [
  {
    "naam": "Van Leeuwen Houtbouw B.V.",
    "kvk": "72000001",
    "plaats": "Maastricht",
    "adres": "Bouwmeesterlaan 8",
    "website": "https://example.org/van-leeuwen",
    "rollen": [
      "aannemer"
    ],
    "profiel": "Fabrieksmatige CLT- en houtskeletbouw voor grondgebonden woningen en appartementen tot 6 lagen; biobased isolatie, demontabele gevelelementen, bouwteamervaring.",
    "referenties": [
      "Eindhoven Houtkwartier, 110 grondgebonden woningen (CLT)",
      "Tilburg Bosrand, 16 appartementen in houtskeletbouw"
    ],
    "medewerkers": 120,
    "bron": "Vakmedia: Cobouw",
    "bronUrl": "https://example.org/cobouw/van-leeuwen",
    "tags": [
      "houtbouw"
    ]
  },
  {
    "naam": "Vermeer Houtbouw B.V.",
    "kvk": "72000002",
    "plaats": "Zaandam",
    "adres": "Industrieweg 71",
    "website": "https://example.org/vermeer",
    "rollen": [
      "aannemer"
    ],
    "profiel": "Fabrieksmatige CLT- en houtskeletbouw voor grondgebonden woningen en appartementen tot 6 lagen; biobased isolatie, demontabele gevelelementen, bouwteamervaring.",
    "referenties": [
      "Hilversum Houtkwartier, 36 grondgebonden woningen (CLT)",
      "Eindhoven Bosrand, 80 appartementen in houtskeletbouw"
    ],
    "medewerkers": 65,
    "bron": "Branchevereniging Houtbouw NL",
    "bronUrl": "https://example.org/houtbouw-nl/leden/vermeer",
    "tags": [
      "houtbouw"
    ]
  },
  {
    "naam": "De Waard Houtbouw B.V.",
    "kvk": "72000003",
    "plaats": "Utrecht",
    "adres": "Industrieweg 72",
    "website": "https://example.org/de-waard",
    "rollen": [
      "aannemer"
    ],
    "profiel": "Fabrieksmatige CLT- en houtskeletbouw voor grondgebonden woningen en appartementen tot 6 lagen; biobased isolatie, demontabele gevelelementen, bouwteamervaring.",
    "referenties": [
      "Alkmaar Houtkwartier, 60 grondgebonden woningen (CLT)",
      "Utrecht Bosrand, 16 appartementen in houtskeletbouw"
    ],
    "medewerkers": 18,
    "bron": "Branchevereniging Houtbouw NL",
    "bronUrl": "https://example.org/houtbouw-nl/leden/de-waard",
    "tags": [
      "houtbouw"
    ]
  },
  {
    "naam": "Brink Bouwgroep Groep B.V.",
    "kvk": "72000004",
    "plaats": "Deventer",
    "adres": "Bouwmeesterlaan 74",
    "website": "https://example.org/brink",
    "rollen": [
      "aannemer"
    ],
    "profiel": "Middelgrote aannemer voor gestapelde woningbouw in prefab beton; sterke planningsdiscipline, UAV-GC en bouwteam, BIM-niveau 2.",
    "referenties": [
      "Den Bosch Stadsblok, 48 appartementen (prefab beton)",
      "Haarlem Havenkade, 28 middenhuurappartementen"
    ],
    "medewerkers": 220,
    "bron": "KVK-register",
    "bronUrl": "https://example.org/kvk/72000004",
    "tags": [
      "prefab"
    ]
  },
  {
    "naam": "Hendriks Bouwgroep",
    "kvk": "72000005",
    "plaats": "Amersfoort",
    "adres": "Ambachtsweg 69",
    "website": "https://example.org/hendriks",
    "rollen": [
      "aannemer"
    ],
    "profiel": "Middelgrote aannemer voor gestapelde woningbouw in prefab beton; sterke planningsdiscipline, UAV-GC en bouwteam, BIM-niveau 2.",
    "referenties": [
      "Utrecht Stadsblok, 36 appartementen (prefab beton)",
      "Zaandam Havenkade, 28 middenhuurappartementen"
    ],
    "medewerkers": 65,
    "bron": "Vakmedia: Architectenweb",
    "bronUrl": "https://example.org/architectenweb/hendriks",
    "tags": [
      "prefab"
    ]
  },
  {
    "naam": "Roos Bouwgroep Groep B.V.",
    "kvk": "72000006",
    "plaats": "Maastricht",
    "adres": "Kanaaldijk 90",
    "website": "https://example.org/roos",
    "rollen": [
      "aannemer"
    ],
    "profiel": "Middelgrote aannemer voor gestapelde woningbouw in prefab beton; sterke planningsdiscipline, UAV-GC en bouwteam, BIM-niveau 2.",
    "referenties": [
      "Dordrecht Stadsblok, 210 appartementen (prefab beton)",
      "Den Bosch Havenkade, 96 middenhuurappartementen"
    ],
    "medewerkers": 25,
    "bron": "Branchevereniging Houtbouw NL",
    "bronUrl": "https://example.org/houtbouw-nl/leden/roos",
    "tags": [
      "prefab"
    ]
  },
  {
    "naam": "Bouwbedrijf Elzinga",
    "kvk": "72000007",
    "plaats": "Groningen",
    "adres": "Bouwmeesterlaan 10",
    "website": "https://example.org/elzinga",
    "rollen": [
      "aannemer"
    ],
    "profiel": "Regionale aannemer voor grondgebonden koopwoningen in traditionele en dorpse stijl; eigen woningconcept, vaste onderaannemers.",
    "referenties": [
      "Leeuwarden Buitenhof, 180 rijwoningen",
      "Purmerend Kerkakkers, 96 twee-onder-een-kapwoningen"
    ],
    "medewerkers": 12,
    "bron": "Vakmedia: Cobouw",
    "bronUrl": "https://example.org/cobouw/elzinga",
    "tags": [
      "traditioneel"
    ]
  },
  {
    "naam": "Bouwbedrijf Kuiper B.V.",
    "kvk": "72000008",
    "plaats": "Hilversum",
    "adres": "Ambachtsweg 10",
    "website": "https://example.org/kuiper",
    "rollen": [
      "aannemer"
    ],
    "profiel": "Regionale aannemer voor grondgebonden koopwoningen in traditionele en dorpse stijl; eigen woningconcept, vaste onderaannemers.",
    "referenties": [
      "Lelystad Buitenhof, 90 rijwoningen",
      "Hilversum Kerkakkers, 32 twee-onder-een-kapwoningen"
    ],
    "medewerkers": 120,
    "bron": "KVK-register",
    "bronUrl": "https://example.org/kvk/72000008",
    "tags": [
      "traditioneel"
    ]
  },
  {
    "naam": "Bouwbedrijf Ter Horst",
    "kvk": "72000009",
    "plaats": "Maastricht",
    "adres": "Industrieweg 35",
    "website": "https://example.org/ter-horst",
    "rollen": [
      "aannemer"
    ],
    "profiel": "Regionale aannemer voor grondgebonden koopwoningen in traditionele en dorpse stijl; eigen woningconcept, vaste onderaannemers.",
    "referenties": [
      "Ede Buitenhof, 90 rijwoningen",
      "Eindhoven Kerkakkers, 96 twee-onder-een-kapwoningen"
    ],
    "medewerkers": 90,
    "bron": "Vakmedia: Stadszaken",
    "bronUrl": "https://example.org/stadszaken/ter-horst",
    "tags": [
      "traditioneel"
    ]
  },
  {
    "naam": "Bakker Hoogbouw B.V.",
    "kvk": "72000010",
    "plaats": "Eindhoven",
    "adres": "Stationsplein 3",
    "website": "https://example.org/bakker",
    "rollen": [
      "aannemer"
    ],
    "profiel": "Grote bouwer van woontorens en gemengde stedelijke blokken; hoogbouw tot 25 lagen, logistiek binnenstedelijk, BIM-niveau 3.",
    "referenties": [
      "Toren Deventer Centraal, 72 appartementen",
      "Hoorn Zuidas-blok, 96 woningen met plint"
    ],
    "medewerkers": 90,
    "bron": "Prijzenlijst: Gulden Feniks",
    "bronUrl": "https://example.org/gulden-feniks/bakker",
    "tags": [
      "hoogbouw"
    ]
  },
  {
    "naam": "Meijer Hoogbouw B.V.",
    "kvk": "72000011",
    "plaats": "Enschede",
    "adres": "Stationsplein 17",
    "website": "https://example.org/meijer",
    "rollen": [
      "aannemer"
    ],
    "profiel": "Grote bouwer van woontorens en gemengde stedelijke blokken; hoogbouw tot 25 lagen, logistiek binnenstedelijk, BIM-niveau 3.",
    "referenties": [
      "Toren Lelystad Centraal, 210 appartementen",
      "Utrecht Zuidas-blok, 28 woningen met plint"
    ],
    "medewerkers": 300,
    "bron": "Branchevereniging Houtbouw NL",
    "bronUrl": "https://example.org/houtbouw-nl/leden/meijer",
    "tags": [
      "hoogbouw"
    ]
  },
  {
    "naam": "Van Dam Hoogbouw Groep B.V.",
    "kvk": "72000012",
    "plaats": "Leiden",
    "adres": "Havenstraat 71",
    "website": "https://example.org/van-dam",
    "rollen": [
      "aannemer"
    ],
    "profiel": "Grote bouwer van woontorens en gemengde stedelijke blokken; hoogbouw tot 25 lagen, logistiek binnenstedelijk, BIM-niveau 3.",
    "referenties": [
      "Toren Groningen Centraal, 110 appartementen",
      "Arnhem Zuidas-blok, 96 woningen met plint"
    ],
    "medewerkers": 35,
    "bron": "Vakmedia: Architectenweb",
    "bronUrl": "https://example.org/architectenweb/van-dam",
    "tags": [
      "hoogbouw"
    ]
  },
  {
    "naam": "Smits Renovatie & Transformatie Groep B.V.",
    "kvk": "72000013",
    "plaats": "Breda",
    "adres": "Havenstraat 30",
    "website": "https://example.org/smits",
    "rollen": [
      "aannemer"
    ],
    "profiel": "Specialist in herbestemming van kantoren en monumenten naar woningen; circulair slopen, welstandsgevoelige context.",
    "referenties": [
      "Transformatie kantoor Hilversum naar 180 appartementen",
      "Herbestemming klooster Enschede, 56 woningen"
    ],
    "medewerkers": 18,
    "bron": "Prijzenlijst: Gulden Feniks",
    "bronUrl": "https://example.org/gulden-feniks/smits",
    "tags": [
      "transformatie"
    ]
  },
  {
    "naam": "Willems Renovatie & Transformatie B.V.",
    "kvk": "72000014",
    "plaats": "Groningen",
    "adres": "Bouwmeesterlaan 24",
    "website": "https://example.org/willems",
    "rollen": [
      "aannemer"
    ],
    "profiel": "Specialist in herbestemming van kantoren en monumenten naar woningen; circulair slopen, welstandsgevoelige context.",
    "referenties": [
      "Transformatie kantoor Zwolle naar 48 appartementen",
      "Herbestemming klooster Amsterdam, 40 woningen"
    ],
    "medewerkers": 35,
    "bron": "Vakmedia: Architectenweb",
    "bronUrl": "https://example.org/architectenweb/willems",
    "tags": [
      "transformatie"
    ]
  },
  {
    "naam": "Nijhof Renovatie & Transformatie B.V.",
    "kvk": "72000015",
    "plaats": "Deventer",
    "adres": "Ambachtsweg 110",
    "website": "https://example.org/nijhof",
    "rollen": [
      "aannemer"
    ],
    "profiel": "Specialist in herbestemming van kantoren en monumenten naar woningen; circulair slopen, welstandsgevoelige context.",
    "referenties": [
      "Transformatie kantoor Dordrecht naar 48 appartementen",
      "Herbestemming klooster Maastricht, 80 woningen"
    ],
    "medewerkers": 120,
    "bron": "Branchevereniging Houtbouw NL",
    "bronUrl": "https://example.org/houtbouw-nl/leden/nijhof",
    "tags": [
      "transformatie"
    ]
  },
  {
    "naam": "Kooij Zorgbouw Groep B.V.",
    "kvk": "72000016",
    "plaats": "Utrecht",
    "adres": "Industrieweg 62",
    "website": "https://example.org/kooij",
    "rollen": [
      "aannemer"
    ],
    "profiel": "Bouwer van zorgwoningen en seniorenhuisvesting; traditionele bouw, planningsbetrouwbaar, ervaring met zorgexploitanten.",
    "referenties": [
      "Zorgresidentie Alkmaar, 180 zorgwoningen",
      "Hof van Alkmaar, 80 seniorenwoningen"
    ],
    "medewerkers": 220,
    "bron": "Vakmedia: Architectenweb",
    "bronUrl": "https://example.org/architectenweb/kooij",
    "tags": [
      "zorg"
    ]
  },
  {
    "naam": "Prins Zorgbouw B.V.",
    "kvk": "72000017",
    "plaats": "Alkmaar",
    "adres": "Industrieweg 44",
    "website": "https://example.org/prins",
    "rollen": [
      "aannemer"
    ],
    "profiel": "Bouwer van zorgwoningen en seniorenhuisvesting; traditionele bouw, planningsbetrouwbaar, ervaring met zorgexploitanten.",
    "referenties": [
      "Zorgresidentie Zaandam, 60 zorgwoningen",
      "Hof van Purmerend, 28 seniorenwoningen"
    ],
    "medewerkers": 160,
    "bron": "Branchevereniging Houtbouw NL",
    "bronUrl": "https://example.org/houtbouw-nl/leden/prins",
    "tags": [
      "zorg"
    ]
  },
  {
    "naam": "De Ruyter Zorgbouw B.V.",
    "kvk": "72000018",
    "plaats": "Utrecht",
    "adres": "Industrieweg 10",
    "website": "https://example.org/de-ruyter",
    "rollen": [
      "aannemer"
    ],
    "profiel": "Bouwer van zorgwoningen en seniorenhuisvesting; traditionele bouw, planningsbetrouwbaar, ervaring met zorgexploitanten.",
    "referenties": [
      "Zorgresidentie Tilburg, 24 zorgwoningen",
      "Hof van Dordrecht, 32 seniorenwoningen"
    ],
    "medewerkers": 25,
    "bron": "Aanbestedingsplatform TenderNed",
    "bronUrl": "https://example.org/tenderned/de-ruyter",
    "tags": [
      "zorg"
    ]
  },
  {
    "naam": "Lansink Modulair Wonen B.V.",
    "kvk": "72000019",
    "plaats": "Hoorn",
    "adres": "Industrieweg 109",
    "website": "https://example.org/lansink",
    "rollen": [
      "aannemer"
    ],
    "profiel": "3D-modulaire woningen uit de fabriek, 90% prefab, remontabel; sociale huur, middenhuur en flexwonen.",
    "referenties": [
      "Flexwonen Dordrecht, 72 woningen",
      "Startersblok Woerden, 64 modulaire woningen"
    ],
    "medewerkers": 90,
    "bron": "KVK-register",
    "bronUrl": "https://example.org/kvk/72000019",
    "tags": [
      "modulair"
    ]
  },
  {
    "naam": "Dekker Modulair Wonen Groep B.V.",
    "kvk": "72000020",
    "plaats": "Ede",
    "adres": "Ambachtsweg 44",
    "website": "https://example.org/dekker",
    "rollen": [
      "aannemer"
    ],
    "profiel": "3D-modulaire woningen uit de fabriek, 90% prefab, remontabel; sociale huur, middenhuur en flexwonen.",
    "referenties": [
      "Flexwonen Groningen, 140 woningen",
      "Startersblok Nijmegen, 56 modulaire woningen"
    ],
    "medewerkers": 300,
    "bron": "KVK-register",
    "bronUrl": "https://example.org/kvk/72000020",
    "tags": [
      "modulair"
    ]
  },
  {
    "naam": "Bosch Modulair Wonen Groep B.V.",
    "kvk": "72000021",
    "plaats": "Delft",
    "adres": "Ambachtsweg 70",
    "website": "https://example.org/bosch",
    "rollen": [
      "aannemer"
    ],
    "profiel": "3D-modulaire woningen uit de fabriek, 90% prefab, remontabel; sociale huur, middenhuur en flexwonen.",
    "referenties": [
      "Flexwonen Zaandam, 48 woningen",
      "Startersblok Dordrecht, 16 modulaire woningen"
    ],
    "medewerkers": 8,
    "bron": "Branchevereniging Houtbouw NL",
    "bronUrl": "https://example.org/houtbouw-nl/leden/bosch",
    "tags": [
      "modulair"
    ]
  },
  {
    "naam": "Van Veen Architecten B.V.",
    "kvk": "72000022",
    "plaats": "Den Bosch",
    "adres": "Kanaaldijk 69",
    "website": "https://example.org/van-veen",
    "rollen": [
      "architect"
    ],
    "profiel": "Ontwerpbureau met signatuur in warme biobased architectuur: houten gevels, collectieve tuinen, natuurinclusief; ervaring met welstand.",
    "referenties": [
      "Arnhem Houtkwartier, ontwerp 72 woningen",
      "Landgoed Enschede, 64 biobased woningen"
    ],
    "medewerkers": 120,
    "bron": "Vakmedia: Stadszaken",
    "bronUrl": "https://example.org/stadszaken/van-veen",
    "tags": [
      "biobased"
    ]
  },
  {
    "naam": "Mulder Architecten B.V.",
    "kvk": "72000023",
    "plaats": "Leeuwarden",
    "adres": "Kanaaldijk 26",
    "website": "https://example.org/mulder",
    "rollen": [
      "architect"
    ],
    "profiel": "Ontwerpbureau met signatuur in warme biobased architectuur: houten gevels, collectieve tuinen, natuurinclusief; ervaring met welstand.",
    "referenties": [
      "Leiden Houtkwartier, ontwerp 210 woningen",
      "Landgoed Alkmaar, 40 biobased woningen"
    ],
    "medewerkers": 120,
    "bron": "Prijzenlijst: Gulden Feniks",
    "bronUrl": "https://example.org/gulden-feniks/mulder",
    "tags": [
      "biobased"
    ]
  },
  {
    "naam": "Studio Jonker",
    "kvk": "72000024",
    "plaats": "Lelystad",
    "adres": "Kanaaldijk 89",
    "website": "https://example.org/jonker",
    "rollen": [
      "architect"
    ],
    "profiel": "Hoogstedelijke woontorens en gemengde plinten; modern en industrieel idioom, parametrisch ontwerp, BIM-niveau 3.",
    "referenties": [
      "Toren Apeldoorn, 24 appartementen",
      "Woerden Kade, 16 middenhuurappartementen"
    ],
    "medewerkers": 160,
    "bron": "Vakmedia: Cobouw",
    "bronUrl": "https://example.org/cobouw/jonker",
    "tags": [
      "hoogstedelijk"
    ]
  },
  {
    "naam": "Studio Timmer Groep B.V.",
    "kvk": "72000025",
    "plaats": "Enschede",
    "adres": "Kanaaldijk 61",
    "website": "https://example.org/timmer",
    "rollen": [
      "architect"
    ],
    "profiel": "Hoogstedelijke woontorens en gemengde plinten; modern en industrieel idioom, parametrisch ontwerp, BIM-niveau 3.",
    "referenties": [
      "Toren Groningen, 90 appartementen",
      "Zwolle Kade, 64 middenhuurappartementen"
    ],
    "medewerkers": 25,
    "bron": "KVK-register",
    "bronUrl": "https://example.org/kvk/72000025",
    "tags": [
      "hoogstedelijk"
    ]
  },
  {
    "naam": "Bureau Boer B.V.",
    "kvk": "72000026",
    "plaats": "Leeuwarden",
    "adres": "Ambachtsweg 11",
    "website": "https://example.org/boer",
    "rollen": [
      "architect"
    ],
    "profiel": "Traditionele en dorpse woningbouwarchitectuur; herhaalbare woningconcepten voor uitleglocaties, welstandsgevoelige kernen.",
    "referenties": [
      "Woerden Buitenhof, 140 grondgebonden woningen",
      "Dorpshart Enschede, 16 woningen in beschermd dorpsgezicht"
    ],
    "medewerkers": 220,
    "bron": "Vakmedia: Stadszaken",
    "bronUrl": "https://example.org/stadszaken/boer",
    "tags": [
      "dorps"
    ]
  },
  {
    "naam": "Bureau Vos Groep B.V.",
    "kvk": "72000027",
    "plaats": "Almere",
    "adres": "Ambachtsweg 43",
    "website": "https://example.org/vos",
    "rollen": [
      "architect"
    ],
    "profiel": "Traditionele en dorpse woningbouwarchitectuur; herhaalbare woningconcepten voor uitleglocaties, welstandsgevoelige kernen.",
    "referenties": [
      "Haarlem Buitenhof, 60 grondgebonden woningen",
      "Dorpshart Gouda, 96 woningen in beschermd dorpsgezicht"
    ],
    "medewerkers": 12,
    "bron": "Vakmedia: Stadszaken",
    "bronUrl": "https://example.org/stadszaken/vos",
    "tags": [
      "dorps"
    ]
  },
  {
    "naam": "De Bruin Architectuur & Erfgoed Groep B.V.",
    "kvk": "72000028",
    "plaats": "Alkmaar",
    "adres": "Industrieweg 20",
    "website": "https://example.org/de-bruin",
    "rollen": [
      "architect"
    ],
    "profiel": "Transformatie en restauratie van monumenten naar wonen; circulair hergebruik, materialenpaspoort.",
    "referenties": [
      "Herbestemming Arnhem Drukkerij, 110 appartementen",
      "Klooster Arnhem, 28 woningen"
    ],
    "medewerkers": 160,
    "bron": "Branchevereniging Houtbouw NL",
    "bronUrl": "https://example.org/houtbouw-nl/leden/de-bruin",
    "tags": [
      "transformatie"
    ]
  },
  {
    "naam": "Kramer Architectuur & Erfgoed B.V.",
    "kvk": "72000029",
    "plaats": "Ede",
    "adres": "Bouwmeesterlaan 17",
    "website": "https://example.org/kramer",
    "rollen": [
      "architect"
    ],
    "profiel": "Transformatie en restauratie van monumenten naar wonen; circulair hergebruik, materialenpaspoort.",
    "referenties": [
      "Herbestemming Enschede Drukkerij, 210 appartementen",
      "Klooster Nijmegen, 96 woningen"
    ],
    "medewerkers": 8,
    "bron": "Aanbestedingsplatform TenderNed",
    "bronUrl": "https://example.org/tenderned/kramer",
    "tags": [
      "transformatie"
    ]
  },
  {
    "naam": "Hofstede Installatietechniek B.V.",
    "kvk": "72000030",
    "plaats": "Amsterdam",
    "adres": "Kanaaldijk 4",
    "website": "https://example.org/hofstede",
    "rollen": [
      "installateur"
    ],
    "profiel": "W- en E-installaties voor woningbouw; warmtepompen, WTW, PV, all-electric, BENG-optimalisatie, BIM-niveau 2.",
    "referenties": [
      "Gouda Stadsblok, 180 woningen all-electric (BENG-2 gemeten)",
      "Amersfoort Buitenhof, 32 woningen"
    ],
    "medewerkers": 35,
    "bron": "Vakmedia: Stadszaken",
    "bronUrl": "https://example.org/stadszaken/hofstede",
    "tags": [
      "allelectric"
    ]
  },
  {
    "naam": "Stam Installatietechniek",
    "kvk": "72000031",
    "plaats": "Zaandam",
    "adres": "Havenstraat 107",
    "website": "https://example.org/stam",
    "rollen": [
      "installateur"
    ],
    "profiel": "W- en E-installaties voor woningbouw; warmtepompen, WTW, PV, all-electric, BENG-optimalisatie, BIM-niveau 2.",
    "referenties": [
      "Maastricht Stadsblok, 180 woningen all-electric (BENG-2 gemeten)",
      "Delft Buitenhof, 40 woningen"
    ],
    "medewerkers": 18,
    "bron": "Aanbestedingsplatform TenderNed",
    "bronUrl": "https://example.org/tenderned/stam",
    "tags": [
      "allelectric"
    ]
  },
  {
    "naam": "Vink Techniek",
    "kvk": "72000032",
    "plaats": "Utrecht",
    "adres": "Kanaaldijk 68",
    "website": "https://example.org/vink",
    "rollen": [
      "installateur"
    ],
    "profiel": "Regionale installateur voor grondgebonden woningbouw; warmtepompen en PV; scherp geprijsd.",
    "referenties": [
      "Breda Kerkakkers, 140 woningen"
    ],
    "medewerkers": 120,
    "bron": "Aanbestedingsplatform TenderNed",
    "bronUrl": "https://example.org/tenderned/vink",
    "tags": [
      "regionaal"
    ]
  },
  {
    "naam": "Zwart Techniek Groep B.V.",
    "kvk": "72000033",
    "plaats": "Rotterdam",
    "adres": "Kanaaldijk 61",
    "website": "https://example.org/zwart",
    "rollen": [
      "installateur"
    ],
    "profiel": "Regionale installateur voor grondgebonden woningbouw; warmtepompen en PV; scherp geprijsd.",
    "referenties": [
      "Nijmegen Kerkakkers, 48 woningen"
    ],
    "medewerkers": 160,
    "bron": "Branchevereniging Houtbouw NL",
    "bronUrl": "https://example.org/houtbouw-nl/leden/zwart",
    "tags": [
      "regionaal"
    ]
  },
  {
    "naam": "Groot Prefab Installaties B.V.",
    "kvk": "72000034",
    "plaats": "Almere",
    "adres": "Kanaaldijk 36",
    "website": "https://example.org/groot",
    "rollen": [
      "installateur"
    ],
    "profiel": "Prefab installatiemodules en leidingschachten voor gestapelde bouw en houtbouw; korte bouwtijd, hoge prefabricagegraad.",
    "referenties": [
      "Toren Tilburg, 90 appartementen",
      "Utrecht Houtkwartier, 96 woningen"
    ],
    "medewerkers": 8,
    "bron": "Branchevereniging Houtbouw NL",
    "bronUrl": "https://example.org/houtbouw-nl/leden/groot",
    "tags": [
      "prefab"
    ]
  },
  {
    "naam": "Koning Prefab Installaties Groep B.V.",
    "kvk": "72000035",
    "plaats": "Tilburg",
    "adres": "Bouwmeesterlaan 65",
    "website": "https://example.org/koning",
    "rollen": [
      "installateur"
    ],
    "profiel": "Prefab installatiemodules en leidingschachten voor gestapelde bouw en houtbouw; korte bouwtijd, hoge prefabricagegraad.",
    "referenties": [
      "Toren Eindhoven, 180 appartementen",
      "Purmerend Houtkwartier, 16 woningen"
    ],
    "medewerkers": 160,
    "bron": "Vakmedia: Cobouw",
    "bronUrl": "https://example.org/cobouw/koning",
    "tags": [
      "prefab"
    ]
  },
  {
    "naam": "Peters Duurzaamheidsadvies",
    "kvk": "72000036",
    "plaats": "Amersfoort",
    "adres": "Kanaaldijk 108",
    "website": "https://example.org/peters",
    "rollen": [
      "adviseur"
    ],
    "profiel": "Adviseur MPG, BENG, Paris Proof en circulariteit; materialenpaspoorten, biobased materialisatie, begeleiding bouwteams.",
    "referenties": [
      "MPG-advies Leiden, 140 woningen",
      "Materialenpaspoort Delft Kade"
    ],
    "medewerkers": 90,
    "bron": "Aanbestedingsplatform TenderNed",
    "bronUrl": "https://example.org/tenderned/peters",
    "tags": [
      "duurzaam"
    ]
  },
  {
    "naam": "Rietveld Duurzaamheidsadvies Groep B.V.",
    "kvk": "72000037",
    "plaats": "Breda",
    "adres": "Ambachtsweg 31",
    "website": "https://example.org/rietveld",
    "rollen": [
      "adviseur"
    ],
    "profiel": "Adviseur MPG, BENG, Paris Proof en circulariteit; materialenpaspoorten, biobased materialisatie, begeleiding bouwteams.",
    "referenties": [
      "MPG-advies Purmerend, 36 woningen",
      "Materialenpaspoort Maastricht Kade"
    ],
    "medewerkers": 65,
    "bron": "KVK-register",
    "bronUrl": "https://example.org/kvk/72000037",
    "tags": [
      "duurzaam"
    ]
  },
  {
    "naam": "Hoek Constructeurs B.V.",
    "kvk": "72000038",
    "plaats": "Eindhoven",
    "adres": "Stationsplein 114",
    "website": "https://example.org/hoek",
    "rollen": [
      "adviseur"
    ],
    "profiel": "Constructief adviseur voor hoogbouw, prefab beton en houtbouw tot 12 lagen; brandveiligheid en akoestiek houtbouw.",
    "referenties": [
      "Constructie toren Nijmegen, 72 appartementen",
      "Constructie Dordrecht Houtkwartier (CLT)"
    ],
    "medewerkers": 18,
    "bron": "Branchevereniging Houtbouw NL",
    "bronUrl": "https://example.org/houtbouw-nl/leden/hoek",
    "tags": [
      "constructie"
    ]
  },
  {
    "naam": "Berg Constructeurs B.V.",
    "kvk": "72000039",
    "plaats": "Ede",
    "adres": "Kanaaldijk 21",
    "website": "https://example.org/berg",
    "rollen": [
      "adviseur"
    ],
    "profiel": "Constructief adviseur voor hoogbouw, prefab beton en houtbouw tot 12 lagen; brandveiligheid en akoestiek houtbouw.",
    "referenties": [
      "Constructie toren Lelystad, 36 appartementen",
      "Constructie Arnhem Houtkwartier (CLT)"
    ],
    "medewerkers": 300,
    "bron": "Prijzenlijst: Gulden Feniks",
    "bronUrl": "https://example.org/gulden-feniks/berg",
    "tags": [
      "constructie"
    ]
  },
  {
    "naam": "Beekman Landschap & Ecologie Groep B.V.",
    "kvk": "72000040",
    "plaats": "Gouda",
    "adres": "Stationsplein 12",
    "website": "https://example.org/beekman",
    "rollen": [
      "adviseur"
    ],
    "profiel": "Natuurinclusief en klimaatadaptief ontwerpen; biodiversiteitsscans, groenblauwe daken, waterberging.",
    "referenties": [
      "Natuurinclusief plan Amersfoort Rivierpark"
    ],
    "medewerkers": 300,
    "bron": "Vakmedia: Cobouw",
    "bronUrl": "https://example.org/cobouw/beekman",
    "tags": [
      "groen"
    ]
  },
  {
    "naam": "Otten Landschap & Ecologie B.V.",
    "kvk": "72000041",
    "plaats": "Dordrecht",
    "adres": "Industrieweg 50",
    "website": "https://example.org/otten",
    "rollen": [
      "adviseur"
    ],
    "profiel": "Natuurinclusief en klimaatadaptief ontwerpen; biodiversiteitsscans, groenblauwe daken, waterberging.",
    "referenties": [
      "Natuurinclusief plan Purmerend Rivierpark"
    ],
    "medewerkers": 48,
    "bron": "Prijzenlijst: Gulden Feniks",
    "bronUrl": "https://example.org/gulden-feniks/otten",
    "tags": [
      "groen"
    ]
  },
  {
    "naam": "Hagen Bouwfysica B.V.",
    "kvk": "72000042",
    "plaats": "Deventer",
    "adres": "Stationsplein 35",
    "website": "https://example.org/hagen",
    "rollen": [
      "adviseur"
    ],
    "profiel": "Bouwfysisch en akoestisch advies; energieconcepten, BENG-berekeningen, comfort in houtbouw.",
    "referenties": [
      "BENG-advies Tilburg, 36 woningen"
    ],
    "medewerkers": 8,
    "bron": "KVK-register",
    "bronUrl": "https://example.org/kvk/72000042",
    "tags": [
      "bouwfysica"
    ]
  },
  {
    "naam": "Wouters Bouwfysica",
    "kvk": "72000043",
    "plaats": "Haarlem",
    "adres": "Kanaaldijk 69",
    "website": "https://example.org/wouters",
    "rollen": [
      "adviseur"
    ],
    "profiel": "Bouwfysisch en akoestisch advies; energieconcepten, BENG-berekeningen, comfort in houtbouw.",
    "referenties": [
      "BENG-advies Delft, 48 woningen"
    ],
    "medewerkers": 120,
    "bron": "Vakmedia: Architectenweb",
    "bronUrl": "https://example.org/architectenweb/wouters",
    "tags": [
      "bouwfysica"
    ]
  },
  {
    "naam": "Ravensberg Gevelsystemen",
    "kvk": "72000044",
    "plaats": "Lelystad",
    "adres": "Havenstraat 115",
    "website": "https://example.org/ravensberg",
    "rollen": [
      "leverancier"
    ],
    "profiel": "Prefab houten gevelelementen met biobased isolatie; demontabel en remontabel, materialenpaspoort per element.",
    "referenties": [
      "Gevels Utrecht Kade, 36 appartementen"
    ],
    "medewerkers": 12,
    "bron": "Vakmedia: Stadszaken",
    "bronUrl": "https://example.org/stadszaken/ravensberg",
    "tags": [
      "gevel"
    ]
  },
  {
    "naam": "Lindeboom Gevelsystemen B.V.",
    "kvk": "72000045",
    "plaats": "Apeldoorn",
    "adres": "Industrieweg 34",
    "website": "https://example.org/lindeboom",
    "rollen": [
      "leverancier"
    ],
    "profiel": "Prefab houten gevelelementen met biobased isolatie; demontabel en remontabel, materialenpaspoort per element.",
    "referenties": [
      "Gevels Groningen Kade, 36 appartementen"
    ],
    "medewerkers": 12,
    "bron": "Aanbestedingsplatform TenderNed",
    "bronUrl": "https://example.org/tenderned/lindeboom",
    "tags": [
      "gevel"
    ]
  },
  {
    "naam": "Schouten Betonelementen B.V.",
    "kvk": "72000046",
    "plaats": "Ede",
    "adres": "Kanaaldijk 6",
    "website": "https://example.org/schouten",
    "rollen": [
      "leverancier"
    ],
    "profiel": "Prefab betonelementen voor gestapelde bouw: wanden, vloeren, balkons; grote volumes, korte levertijden.",
    "referenties": [
      "Casco Apeldoorn Stadsblok, 90 appartementen"
    ],
    "medewerkers": 120,
    "bron": "Aanbestedingsplatform TenderNed",
    "bronUrl": "https://example.org/tenderned/schouten",
    "tags": [
      "beton"
    ]
  },
  {
    "naam": "Verhoef Betonelementen B.V.",
    "kvk": "72000047",
    "plaats": "Leiden",
    "adres": "Kanaaldijk 120",
    "website": "https://example.org/verhoef",
    "rollen": [
      "leverancier"
    ],
    "profiel": "Prefab betonelementen voor gestapelde bouw: wanden, vloeren, balkons; grote volumes, korte levertijden.",
    "referenties": [
      "Casco Utrecht Stadsblok, 48 appartementen"
    ],
    "medewerkers": 35,
    "bron": "Branchevereniging Houtbouw NL",
    "bronUrl": "https://example.org/houtbouw-nl/leden/verhoef",
    "tags": [
      "beton"
    ]
  },
  {
    "naam": "Koster Houtconstructies B.V.",
    "kvk": "72000048",
    "plaats": "Den Bosch",
    "adres": "Industrieweg 33",
    "website": "https://example.org/koster",
    "rollen": [
      "leverancier",
      "aannemer"
    ],
    "profiel": "Leverancier van CLT- en HSB-casco's; engineering en montage; FSC/PEFC-gecertificeerd.",
    "referenties": [
      "Casco Haarlem Houtkwartier, 72 woningen"
    ],
    "medewerkers": 8,
    "bron": "Vakmedia: Cobouw",
    "bronUrl": "https://example.org/cobouw/koster",
    "tags": [
      "hout"
    ]
  },
  {
    "naam": "Dijkstra Houtconstructies B.V.",
    "kvk": "72000049",
    "plaats": "Amsterdam",
    "adres": "Industrieweg 85",
    "website": "https://example.org/dijkstra",
    "rollen": [
      "leverancier"
    ],
    "profiel": "Leverancier van CLT- en HSB-casco's; engineering en montage; FSC/PEFC-gecertificeerd.",
    "referenties": [
      "Casco Woerden Houtkwartier, 180 woningen"
    ],
    "medewerkers": 220,
    "bron": "Branchevereniging Houtbouw NL",
    "bronUrl": "https://example.org/houtbouw-nl/leden/dijkstra",
    "tags": [
      "hout"
    ]
  },
  {
    "naam": "Wijnands Kozijnen & Daken Groep B.V.",
    "kvk": "72000050",
    "plaats": "Gouda",
    "adres": "Kanaaldijk 30",
    "website": "https://example.org/wijnands",
    "rollen": [
      "leverancier"
    ],
    "profiel": "Houten kozijnen en prefab dakelementen; conceptbouw, FSC-hout, korte levertijden.",
    "referenties": [
      "Kozijnen Den Bosch Buitenhof, 180 woningen"
    ],
    "medewerkers": 48,
    "bron": "Prijzenlijst: Gulden Feniks",
    "bronUrl": "https://example.org/gulden-feniks/wijnands",
    "tags": [
      "kozijn"
    ]
  },
  {
    "naam": "Postma Kozijnen & Daken B.V.",
    "kvk": "72000051",
    "plaats": "Amersfoort",
    "adres": "Kanaaldijk 2",
    "website": "https://example.org/postma",
    "rollen": [
      "leverancier"
    ],
    "profiel": "Houten kozijnen en prefab dakelementen; conceptbouw, FSC-hout, korte levertijden.",
    "referenties": [
      "Kozijnen Utrecht Buitenhof, 110 woningen"
    ],
    "medewerkers": 12,
    "bron": "Vakmedia: Stadszaken",
    "bronUrl": "https://example.org/stadszaken/postma",
    "tags": [
      "kozijn"
    ]
  }
];
