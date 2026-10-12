// Uitleg in gewone taal bij de standaardfactoren, voor de factorenpagina: wat betekent de factor, een concreet voorbeeld
// en waarom Blauwhoed ernaar kijkt. Factoren die een beheerder zelf toevoegt, vallen terug op hun eigen omschrijving.

export type FactorUitleg = { betekenis: string; voorbeeld: string; waarom?: string };

export const CATEGORIE_UITLEG: Record<string, string> = {
  "A. Projecttype en programma": "Welk soort projecten de partner gewend is: woningtypes, doelgroepen, omvang en projectfase.",
  "B. Bouwstijl en architectuur": "Hoe de partner ontwerpt en bouwt: stijl, gevoelige omgevingen en werken met vaste woningconcepten.",
  "C. Bouwmethode en materialen": "Met welke bouwsystemen en materialen de partner ervaring heeft, zoals houtbouw of prefab.",
  "D. Duurzaamheid": "Wat de partner aantoonbaar heeft bereikt op milieu, energie, circulariteit en natuur.",
  "E. Capaciteit en continuïteit": "Of de partner het project aankan: omvang, beschikbaarheid, afstand en grootte van de organisatie.",
  "F. Samenwerking en gedrag": "Hoe de samenwerking in eerdere projecten met Blauwhoed verliep: kwaliteit, planning, budget en werkwijze.",
  "G. Commercieel en risico": "Contractvormen, prijsniveau en financiële risico's."
};

export const FACTOR_UITLEG: Record<string, FactorUitleg> = {
  projecttype: { betekenis: "Hoeveel ervaring de partner heeft per soort project, zoals grondgebonden woningen, appartementen of transformatie.", voorbeeld: "Appartementen: niveau 4 (meerdere appartementencomplexen opgeleverd); zorgwonen: niveau 1.", waarom: "Een bouwer van rijtjeshuizen is niet vanzelf geschikt voor een woontoren." },
  prijssegment: { betekenis: "In welke prijsklassen de partner gewend is te bouwen: sociale huur, middenhuur, koop of vrije sector.", voorbeeld: "Sociaal: niveau 4, vrije sector: niveau 2.", waarom: "Elk segment vraagt een andere balans tussen kosten en afwerking." },
  projectomvang: { betekenis: "Tussen hoeveel woningen de projecten van de partner meestal liggen.", voorbeeld: "20–150 woningen. Een project van 400 woningen valt daarbuiten.", waarom: "Te groot of te klein werkt allebei slecht. Een project buiten deze bandbreedte valt af." },
  fase_expertise: { betekenis: "In welke fase van een project de partner sterk is: van het eerste idee tot nazorg na oplevering.", voorbeeld: "Planvorming: niveau 4, nazorg: niveau 2.", waarom: "Sommige partijen denken graag vroeg mee, andere zijn vooral goed in de uitvoering." },
  architectuurstijl: { betekenis: "In welke stijlen de architect of ontwikkelaar ervaring heeft.", voorbeeld: "Dorps: niveau 4, hoogstedelijk: niveau 1.", waarom: "Een dorpse uitbreiding vraagt een ander handschrift dan een stedelijke toren." },
  welstand: { betekenis: "Ervaring met bouwen in een beschermd stads- of dorpsgezicht of naast monumenten.", voorbeeld: "Niveau 4: meerdere projecten in een beschermd dorpsgezicht door de welstandscommissie gekregen.", waarom: "In een gevoelige omgeving voorkomt ervaring vertraging bij welstand en vergunning." },
  conceptbouw: { betekenis: "Hoeveel de partner werkt met herhaalbare, vooraf ontwikkelde woningconcepten.", voorbeeld: "Niveau 5: een eigen woningconcept dat al op tien locaties is gebouwd.", waarom: "Conceptbouw is vaak sneller en voorspelbaarder in kosten." },
  signatuur: { betekenis: "Het ontwerphandschrift van de partner, in woorden en referentieprojecten. Hier hoort geen cijfer bij.", voorbeeld: "‘Ingetogen baksteenarchitectuur met veel aandacht voor de straat.’", waarom: "De app vergelijkt deze tekst met de projectomschrijving om partners met een passend handschrift te vinden." },
  bouwsysteem: { betekenis: "Hoeveel ervaring de partner heeft per manier van bouwen: houtbouw (CLT), prefab beton, staalframe, traditioneel of een mix.", voorbeeld: "Houtbouw / CLT: niveau 4; prefab beton: niveau 2.", waarom: "Voor een houtbouwproject wil je een partij die al houten woningen heeft opgeleverd." },
  gevel: { betekenis: "De kwaliteit van gevelwerk en detaillering in opgeleverde projecten.", voorbeeld: "Niveau 4: metselwerk met sierverband en verdiepte voegen, netjes uitgevoerd.", waarom: "De gevel bepaalt voor een groot deel hoe een buurt eruitziet." },
  prefabricage: { betekenis: "Hoeveel van het bouwwerk in een fabriek wordt voorbereid in plaats van op de bouwplaats.", voorbeeld: "Niveau 5: complete wand- en vloerelementen uit de eigen fabriek.", waarom: "Prefab verkort de bouwtijd en geeft minder overlast op de bouwplaats." },
  demontabel: { betekenis: "Ervaring met bouwen zodat onderdelen later weer los te halen en opnieuw te gebruiken zijn.", voorbeeld: "Niveau 3: gevels met droge, schroefbare verbindingen in twee projecten.", waarom: "Losmaakbaar bouwen maakt hergebruik mogelijk en hoort bij circulaire ambities." },
  mpg: { betekenis: "De MilieuPrestatie Gebouwen: de milieubelasting van de gebruikte materialen, gemeten in opgeleverde projecten. Lager is beter.", voorbeeld: "0,48 €/m² per jaar (de wettelijke grens is 0,8).", waarom: "Laat zien of de duurzaamheid in de praktijk is waargemaakt, en niet alleen beloofd." },
  beng: { betekenis: "Het fossiele energiegebruik van opgeleverde woningen volgens de BENG-norm. Lager is beter.", voorbeeld: "25 kWh per m² per jaar.", waarom: "Hoe zuiniger de woning, hoe lager de energierekening van bewoners." },
  biobased: { betekenis: "Welk deel van de materialen uit plantaardige of andere hernieuwbare bronnen komt, zoals hout, stro of hennep.", voorbeeld: "55% biobased materiaal in recente projecten.", waarom: "Biobased materialen leggen CO₂ vast en passen bij de duurzaamheidsdoelen van Blauwhoed." },
  circulariteit: { betekenis: "Ervaring met circulair ontwerpen en met een materialenpaspoort (een overzicht van alle gebruikte materialen voor later hergebruik).", voorbeeld: "Niveau 3: voor twee projecten een materialenpaspoort opgeleverd.", waarom: "Circulair bouwen voorkomt afval en wordt vaker gevraagd door gemeenten." },
  co2_ladder: { betekenis: "Het niveau op de CO₂-prestatieladder (1 tot 5), op basis van een geldig certificaat.", voorbeeld: "Niveau 3, certificaat geldig tot 2027.", waarom: "Een erkend bewijs dat de partner werkt aan het verminderen van CO₂-uitstoot. Een verlopen certificaat telt niet mee." },
  natuurinclusief: { betekenis: "Ervaring met bouwen dat ruimte geeft aan natuur (nestkasten, groene daken) en bestand is tegen hitte en hevige regen.", voorbeeld: "Niveau 4: groene daken en wadi's in drie projecten.", waarom: "Gemeenten vragen dit steeds vaker bij nieuwe wijken." },
  max_projectomvang: { betekenis: "De grootste contractwaarde die de partner tegelijk aankan.", voorbeeld: "€ 25 miljoen tegelijk onderhanden.", waarom: "Te veel werk tegelijk geeft risico op vertraging of problemen. Daarboven valt de partner af." },
  beschikbaarheid: { betekenis: "Of de partner beschikbaar is in de periode van het project.", voorbeeld: "Niet beschikbaar van maart tot september 2027 (vol met ander werk).", waarom: "Een partner die niet kan in de projectperiode, valt af." },
  reisafstand: { betekenis: "De afstand van de vestiging tot de projectlocatie, en het gebied waarin de partner wil werken.", voorbeeld: "35 km van het project; werkgebied tot 80 km.", waarom: "Buiten het werkgebied valt de partner af. Binnen het werkgebied scoort dichterbij beter." },
  organisatieomvang: { betekenis: "Het aantal medewerkers.", voorbeeld: "120 fte.", waarom: "Geeft een indruk of de organisatie groot genoeg is voor het project." },
  evaluatiescore: { betekenis: "Het gemiddelde rapportcijfer (1 tot 5) dat Blauwhoed-teams gaven na eerdere projecten: kwaliteit, planning, budget en samenwerking.", voorbeeld: "4,2 uit vijf evaluaties; recente projecten tellen zwaarder.", waarom: "Eigen ervaring is het sterkste bewijs. De app rekent dit zelf uit de evaluaties uit." },
  kostenvastheid: { betekenis: "Hoeveel de eindafrekening gemiddeld afweek van de afgesproken prijs. Lager is beter.", voorbeeld: "Gemiddeld 3% duurder dan geraamd.", waarom: "Laat zien of afspraken over geld worden waargemaakt. Berekend uit de projecthistorie." },
  planningsbetrouwbaarheid: { betekenis: "Welk deel van de projecten op tijd is opgeleverd (uiterlijk 30 dagen na de geplande datum).", voorbeeld: "80%: vier van de vijf projecten op tijd.", waarom: "Een te late oplevering kost kopers en Blauwhoed geld. Berekend uit de projecthistorie." },
  bouwteam: { betekenis: "Ervaring met samenwerken in een bouwteam, waarin ontwerper, bouwer en opdrachtgever vroeg samen optrekken.", voorbeeld: "Niveau 4: zes bouwteamprojecten.", waarom: "Blauwhoed werkt vaak in bouwteams; dat vraagt een open houding." },
  bim: { betekenis: "Hoe goed de partner werkt met een digitaal 3D-bouwmodel (BIM) en hoe bruikbaar de gegevens zijn die hij oplevert.", voorbeeld: "Niveau 3: werkt standaard in BIM en levert een model bij oplevering.", waarom: "Goede digitale gegevens helpen bij afstemming en later beheer." },
  contractvorm: { betekenis: "Ervaring met verschillende soorten contracten, zoals bouwteam, Design & Build of UAV-GC.", voorbeeld: "Bouwteam: niveau 4; UAV-GC: niveau 1.", waarom: "De gekozen contractvorm vraagt andere vaardigheden van de partner." },
  prijsniveau: { betekenis: "Hoe duur de partner is ten opzichte van de markt. 100 is marktconform; lager is goedkoper.", voorbeeld: "Index 95: ongeveer 5% onder het marktgemiddelde.", waarom: "Helpt bij het inschatten of een partner binnen het budget past." },
  financiele_gezondheid: { betekenis: "Hoe financieel gezond de partner is (laag, midden of hoog risico), op basis van jaarcijfers en deponeringen.", voorbeeld: "Midden risico: omzetdaling van 25% en lage solvabiliteit.", waarom: "Een faillissement midden in een project is een groot risico. Bij hoog risico valt de partner af." },
  afhankelijkheid: { betekenis: "Welk deel van de omzet van de partner van Blauwhoed komt.", voorbeeld: "35%: de partner draait voor een derde op Blauwhoed-projecten.", waarom: "Een grote afhankelijkheid is een risico voor beide partijen. Vanaf 30% krijg je een waarschuwing." },
  uitsluiting: { betekenis: "Of de partner geblokkeerd is of een verplicht certificaat mist of heeft laten verlopen.", voorbeeld: "Geblokkeerd tot 1 januari 2027 na een conflict over oplevering.", waarom: "Een geblokkeerde partner komt niet in het advies." },
  paris_proof: { betekenis: "De Paris Proof-score: de CO₂-uitstoot van de materialen van een woning of product (van grondstof tot bouwplaats), in kg CO₂ per m² vloeroppervlak, volgens de methode van de Dutch Green Building Council. Lager is beter.", voorbeeld: "160 kg CO₂ per m² BVO voor een houten rijwoning.", waarom: "Laat zien of een bouwsysteem past bij de klimaatdoelen; voor houtbouw een verplicht gegeven." },
  productietijd: { betekenis: "Hoeveel weken de fabriek nodig heeft om de elementen of modules te maken, vanaf de definitieve bestelling.", voorbeeld: "12 weken voor 40 woningen.", waarom: "Bepaalt of de bouwplanning haalbaar is." },
  levertijd: { betekenis: "Hoeveel weken het duurt van opdracht tot levering op de bouwplaats, bij de huidige orderportefeuille.", voorbeeld: "26 weken; bij een volle fabriek kan dat oplopen.", waarom: "Een korte levertijd helpt om een project op tijd te starten." },
  kosten_m2: { betekenis: "De indicatieve kosten per m² vloeroppervlak (BVO), exclusief btw.", voorbeeld: "Vanaf € 1.100 per m² BVO.", waarom: "Geeft vroeg in het project een beeld of een concept binnen het budget past." },
  productinformatie: { betekenis: "Een beschrijving van het product of woningconcept: systeem, opbouw, afmetingen en varianten, liefst met een link naar het productblad.", voorbeeld: "CLT-woonconcept, grondgebonden en gestapeld tot 6 lagen, beukmaat 5,4 m.", waarom: "Hiermee beoordeelt het projectteam of het product past bij het ontwerp; het telt ook mee bij zoeken en de inhoudelijke gelijkenis." }
};

/** Wat een niveau van 0–5 betekent. */
export const NIVEAU_UITLEG: Array<[number, string]> = [
  [0, "Geen ervaring"],
  [1, "Eerste of beperkte ervaring (één project, of alleen een claim)"],
  [2, "Enige ervaring"],
  [3, "Aantoonbare ervaring: meerdere opgeleverde projecten"],
  [4, "Ruime ervaring: een sterkte van de partner"],
  [5, "Specialist: hierin behoort de partner tot de besten"]
];
