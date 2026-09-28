// Kern-domeinmodel van de Slimme Partnerdatabase.
// Zie backlog hoofdstuk 2 (datamodel) en 3 (factorenmodel).

/**
 * 'gearchiveerd' vervangt verwijderen: de partner blijft raadpleegbaar maar telt niet mee in zoeken, matching en verbanden.
 * 'concept' (US-54): door AI voorgesteld (AI-registratie, discovery of AI-aandraag) en nog niet vrijgegeven door een beheerder;
 *   telt nergens mee (zoeken, filteren, matchen, verbanden, chat, export) tot vrijgave.
 */
export type PartnerStatus = "bekend" | "prospect" | "afgewezen" | "preferred" | "geblokkeerd" | "gearchiveerd" | "concept";

export type Rol = "architect" | "aannemer" | "installateur" | "adviseur" | "leverancier" | "ontwikkelpartner";

export const ROLLEN: Rol[] = ["architect", "aannemer", "installateur", "adviseur", "leverancier", "ontwikkelpartner"];

export type FactorType = "hard" | "gewogen" | "semantisch";

export type FactorCategorie =
  | "A. Projecttype en programma"
  | "B. Bouwstijl en architectuur"
  | "C. Bouwmethode en materialen"
  | "D. Duurzaamheid"
  | "E. Capaciteit en continuïteit"
  | "F. Samenwerking en gedrag"
  | "G. Commercieel en risico";

/**
 * Schaal van een factor. Bepaalt hoe een partnerwaarde tegen een projecteis wordt afgezet.
 * - niveau: 0–5 ervaringsniveau (hoger is beter, eis = minimaal gewenst niveau)
 * - getal: absolute waarde met eenheid (lagerIsBeter bepaalt de richting)
 * - percentage: 0–100 (lagerIsBeter bepaalt de richting)
 * - bereik: min–max bandbreedte (eis = gevraagde waarde moet binnen bereik vallen)
 * - keuze: één of meer opties uit de waardenlijst (eis = gevraagde optie(s) aanwezig)
 * - boolean: ja/nee
 * - tekst: vrije tekst, alleen voor semantische factoren
 */
export type FactorSchaal =
  | { soort: "niveau"; min: 0; max: 5 }
  | { soort: "getal"; eenheid: string; lagerIsBeter?: boolean; min?: number; max?: number }
  | { soort: "percentage"; lagerIsBeter?: boolean }
  | { soort: "bereik"; eenheid: string }
  | { soort: "keuze"; meervoudig: boolean }
  | { soort: "boolean" }
  | { soort: "tekst" };

export type FactorOption = {
  id: string;
  label: string;
  /** Per optie kan een partner een ervaringsniveau 0–5 vastleggen (bij niveau-schalen met opties). */
  omschrijving?: string;
  actief: boolean;
};

export type Factor = {
  id: string;
  code: string;
  naam: string;
  omschrijving: string;
  categorie: FactorCategorie;
  type: FactorType;
  schaal: FactorSchaal;
  /** Optionele waardenlijst (taxonomie). Bij niveau-schalen met opties scoort de partner per optie. */
  opties?: FactorOption[];
  /** Rollen waarvoor deze factor relevant is; leeg = alle rollen. */
  rollen: Rol[];
  actief: boolean;
  gearchiveerdOp?: string;
  /** Bij samenvoegen: de factor waarin deze is opgegaan. */
  samengevoegdIn?: string;
  /** Afgeleid uit projecthistorie/evaluaties (US-19/20); niet handmatig te vullen behalve als overschrijving. */
  afgeleid?: boolean;
  /** Vervaltermijn: een waarde ouder dan dit aantal maanden geldt automatisch als 'verouderd'. Leeg = verjaart niet. */
  vervalMaanden?: number;
  versie: number;
};

/**
 * Bron van een gegeven. De rangorde volgt art. 11.2 van de aanvullende overeenkomst (v3.1):
 * 1. goudstandaard en eigen uitgaven van Blauwhoed (o.a. woningconceptenbrochure, Conceptenboulevard);
 * 2. aangeleverde documenten, opgave, projecthistorie en gevalideerde registraties (KVK-handelsregister, keurmerkregisters);
 * 3. indicatieve markt- en internetbronnen ("indicatief – niet gevalideerd").
 */
export type Bron = "goudstandaard" | "eigen_uitgave" | "opgave" | "document" | "projecthistorie" | "evaluatie" | "kvk" | "register" | "certificaat" | "web";

export const BRONNEN: Bron[] = ["goudstandaard", "eigen_uitgave", "opgave", "document", "projecthistorie", "evaluatie", "kvk", "register", "certificaat", "web"];

/** Rang per bron (1 = hoogst). Bij conflicterende voorstellen wint de hoogste rang. */
export const BRON_RANG: Record<Bron, 1 | 2 | 3> = {
  goudstandaard: 1,
  eigen_uitgave: 1,
  opgave: 2,
  document: 2,
  projecthistorie: 2,
  evaluatie: 2,
  kvk: 2,
  register: 2,
  certificaat: 2,
  web: 3
};

export const BRON_LABEL: Record<Bron, string> = {
  goudstandaard: "Goudstandaard Blauwhoed",
  eigen_uitgave: "Eigen uitgave Blauwhoed",
  opgave: "Opgave (aangeleverd)",
  document: "Aangeleverd document",
  projecthistorie: "Projecthistorie",
  evaluatie: "Evaluatie Blauwhoed",
  kvk: "KVK – gevalideerde registratie",
  register: "Keurmerk-/brancheregister",
  certificaat: "Certificaat",
  web: "Internet"
};

/** Standaardbetrouwbaarheid per bron (bewijs boven zelfbeeld). */
export const BRON_BETROUWBAARHEID: Record<Bron, number> = {
  goudstandaard: 1,
  eigen_uitgave: 0.95,
  certificaat: 0.95,
  kvk: 0.9,
  register: 0.9,
  projecthistorie: 0.9,
  evaluatie: 0.9,
  document: 0.75,
  opgave: 0.6,
  web: 0.4
};

export type Bewijs = {
  soort: "project" | "evaluatie" | "certificaat" | "document" | "url" | "factuur";
  ref: string;
  label: string;
};

export type FactorWaarde = number | string | boolean | string[] | { min: number; max: number };

/** Dwarsdoorsnijdende eis 1: status per veldwaarde. Alleen een mens zet een waarde op 'gevalideerd'. */
export type FactorWaardeStatus = "voorgesteld" | "gevalideerd" | "verouderd";

export type PartnerFactor = {
  factorId: string;
  /** Bij niveau-schalen met opties: de optie waarop dit niveau betrekking heeft. */
  optieId?: string;
  waarde: FactorWaarde;
  bron: Bron;
  betrouwbaarheid: number;
  bewijs?: Bewijs;
  peildatum: string;
  /** Status van deze waarde. Ontbreekt bij afgeleide (berekende) waarden. 'verouderd' wordt ook automatisch berekend uit peildatum + Factor.vervalMaanden. */
  status?: FactorWaardeStatus;
  gevalideerdDoor?: string;
  gevalideerdOp?: string;
  /** true = automatisch afgeleid uit historie; false/undefined = handmatig vastgelegd. */
  afgeleid?: boolean;
  /** Handmatige overschrijving van een afgeleide waarde. */
  overschrijving?: boolean;
  toelichting?: string;
};

export type CertificaatType =
  | "ISO 9001"
  | "ISO 14001"
  | "VCA"
  | "CO2-prestatieladder"
  | "FSC"
  | "PEFC"
  | "BREEAM-expertise"
  | "Woonkeur"
  | "KOMO";

export type Certificaat = {
  id: string;
  type: CertificaatType;
  nummer: string;
  niveau?: number;
  geldigTot: string;
  geverifieerdOp?: string;
  bronUrl?: string;
  /** US-62/US-30: gevonden in een openbaar register = geverifieerd; anders blijft het certificaat 'geclaimd'. */
  verificatie?: "geclaimd" | "geverifieerd";
  registerControle?: { register: string; url: string; op: string; gevonden: boolean };
};

export type Beschikbaarheid = {
  van: string;
  tot: string;
  beschikbaar: boolean;
  toelichting?: string;
};

export type Contactpersoon = {
  id: string;
  naam: string;
  functie: string;
  email?: string;
  telefoon?: string;
  /** AVG-grondslag (US-47). */
  grondslag: "overeenkomst" | "gerechtvaardigd belang" | "toestemming";
  vastgelegdOp: string;
  bewaartermijnMaanden: number;
};

export type KwalificatieItem =
  | "verzekering"
  | "kam"
  | "gedragscode"
  | "ketenaansprakelijkheid"
  | "uittreksel_kvk"
  | "financiele_toets";

export const KWALIFICATIE_ITEMS: Array<{ id: KwalificatieItem; label: string }> = [
  { id: "verzekering", label: "Bedrijfs- en beroepsaansprakelijkheidsverzekering" },
  { id: "kam", label: "KAM-systeem aanwezig en actueel" },
  { id: "gedragscode", label: "Gedragscode Blauwhoed ondertekend" },
  { id: "ketenaansprakelijkheid", label: "Ketenaansprakelijkheid: G-rekening / WKA-verklaring" },
  { id: "uittreksel_kvk", label: "Recent KVK-uittreksel" },
  { id: "financiele_toets", label: "Financiële toets uitgevoerd" }
];

export type Kwalificatie = {
  item: KwalificatieItem;
  afgevinkt: boolean;
  door?: string;
  op?: string;
  toelichting?: string;
};

export type Financieel = {
  boekjaar: number;
  omzet: number;
  omzetVorigJaar?: number;
  eigenVermogen?: number;
  solvabiliteit?: number;
  laatsteDeponering?: string;
  betalingsgedrag?: "goed" | "matig" | "slecht";
  risicoklasse?: "laag" | "midden" | "hoog";
  toelichting?: string;
};

/** Onderdeel 1: document per partner — verwijzing (URL) en/of geplakte openbare tekst; binaire opslag vergt een blobdienst en valt buiten scope. */
export type PartnerDocument = {
  id: string;
  naam: string;
  soort: "brochure" | "certificaat" | "contract" | "referentie" | "overig";
  url?: string;
  tekst?: string;
  /** Geüpload bestand in Vercel Blob. */
  bestandUrl?: string;
  bestandType?: string;
  bestandGrootte?: number;
  /** US-61: uit het bestand (PDF, Word, tekst) gelezen tekst; voedt de verrijking als bron 'aangeleverd document'. */
  geextraheerdeTekst?: string;
  tekstGeextraheerdOp?: string;
  /** Waarom er geen tekst gelezen kon worden (bijv. gescande PDF of oud .doc-formaat). */
  extractieMelding?: string;
  toelichting?: string;
  toegevoegdDoor: string;
  op: string;
};

export type Geo = { lat: number; lng: number };

/** US-52: basisvelden buiten het factorenmodel die elk een eigen herkomst en status hebben. */
export type BasisVeld = "website" | "kvk" | "rechtsvorm" | "vestigingsplaats" | "adres" | "omschrijving" | "telefoon" | "email" | "statutaireNaam" | "oprichtingsdatum" | "sbiActiviteiten";

export const BASISVELD_LABEL: Record<BasisVeld, string> = {
  website: "Website",
  kvk: "KVK-nummer",
  rechtsvorm: "Rechtsvorm",
  vestigingsplaats: "Vestigingsplaats",
  adres: "Vestigingsadres",
  omschrijving: "Omschrijving",
  telefoon: "Telefoon (algemeen)",
  email: "E-mail (algemeen)",
  statutaireNaam: "Statutaire naam",
  oprichtingsdatum: "Oprichtingsdatum",
  sbiActiviteiten: "SBI-activiteiten"
};

export type VeldHerkomst = {
  bron: Bron;
  /** URL, documentnaam of registerverwijzing. */
  bronDetail?: string;
  vastgesteldOp: string;
  betrouwbaarheid: number;
  status: FactorWaardeStatus;
  gevalideerdDoor?: string;
  gevalideerdOp?: string;
};

/** US-53: expliciete markering dat er voor een veld geen betrouwbare bron is gevonden (het veld blijft leeg). */
export type GeenBronMarkering = { op: string; doorzocht: string[] };

/** Concept (US-54): wie het vroeg, waaruit het is opgebouwd, herkomst per veld en het besluit van de beheerder. */
export type PartnerRegistratie = {
  /** Hoe het concept is ontstaan: AI-registratie op verzoek, geaccepteerde discovery-kandidaat of AI-aandraag vanuit een zoekprofiel (US-55). */
  herkomstSoort?: "ai-registratie" | "discovery" | "ai-aandraag";
  /** US-55: onderbouwing van een AI-voorstel — waarom past deze partij, welke bron, wat is onzeker. */
  onderbouwing?: { waaromPast: string; bron: string; bronUrl?: string; opgehaaldOp: string; onzeker: string[]; zoekprofielId?: string; zoekvraag?: string };
  aangevraagdDoor: string;
  op: string;
  provider: string;
  /** Waaruit de registratie is opgebouwd: website(s) en/of aangeleverde tekst. */
  bronnen: string[];
  herkomst: Herkomst[];
  waarschuwingen: string[];
  /** "partnerId|reden" van een mogelijk bestaande partner. */
  mogelijkeDubbelVan?: string;
  besluit?: "vrijgegeven" | "afgewezen";
  beoordeeldDoor?: string;
  beoordeeldOp?: string;
  toelichting?: string;
};

export type Partner = {
  id: string;
  naam: string;
  kvk: string;
  rechtsvorm: string;
  vestigingsplaats: string;
  adres?: string;
  locatie: Geo;
  /** Werkgebied als straal in km rond de vestiging (PostGIS-polygoon in de normaliseerde schema). */
  werkgebiedKm: number;
  status: PartnerStatus;
  statusReden?: string;
  geblokkeerdTot?: string;
  rollen: Rol[];
  website?: string;
  omschrijving: string;
  /** Referentieprojecten in vrije tekst; voeden de semantische vergelijking. */
  referenties: string[];
  omzet?: number;
  medewerkers?: number;
  maxGelijktijdigeProjecten?: number;
  typischeProjectomvang?: { min: number; max: number };
  beschikbaarheid: Beschikbaarheid[];
  factoren: PartnerFactor[];
  certificaten: Certificaat[];
  contactpersonen: Contactpersoon[];
  documenten?: PartnerDocument[];
  kwalificatie: Kwalificatie[];
  financieel?: Financieel;
  bronnen: Array<{ url: string; opgehaaldOp: string; soort: string }>;
  /** Moment van de laatste verrijking (voor het verrijkingsschema: "niet verrijkt sinds X maanden"). */
  laatstVerrijktOp?: string;
  /** Inhoudshash van de laatst gelezen webbronnen; ongewijzigd = partner overslaan in de volgende ronde (delta-selectie). */
  webHash?: string;
  /** Ruwe brondata per geïmporteerde rij (bijv. per woningconcept uit het Excel-overzicht): alle oorspronkelijke kolommen. */
  brongegevens?: Array<{ bron: string; op: string; titel?: string; velden: Record<string, string> }>;
  tags: string[];
  /** Alleen bij partners die door AI zijn geregistreerd of voorgesteld (concept). */
  registratie?: PartnerRegistratie;
  /** Algemene bedrijfscontactgegevens (organisatie, geen persoon). */
  telefoon?: string;
  email?: string;
  /** Uit het KVK-handelsregister (Basisprofiel). */
  statutaireNaam?: string;
  oprichtingsdatum?: string;
  sbiActiviteiten?: Array<{ code: string; omschrijving: string; hoofd?: boolean }>;
  /** US-52: herkomst, datum, betrouwbaarheid en status per basisveld. */
  veldHerkomst?: Partial<Record<BasisVeld, VeldHerkomst>>;
  /** US-53: velden waarvoor bij verrijking geen betrouwbare bron is gevonden (sleutel `basis:<veld>` of `factor:<id>[/<optie>]`). */
  geenBron?: Record<string, GeenBronMarkering>;
  aangemaaktOp: string;
  bijgewerktOp: string;
};

export type Projecttype =
  | "grondgebonden"
  | "appartementen"
  | "hoogbouw"
  | "transformatie"
  | "zorgwonen"
  | "gebiedsontwikkeling";

export type Prijssegment = "sociaal" | "middenhuur" | "koop" | "vrije sector";

export type Bouwstijl = "traditioneel" | "modern" | "industrieel" | "dorps" | "hoogstedelijk";

export type Projectfase = "initiatief" | "planvorming" | "realisatie" | "opgeleverd" | "nazorg";

export type RequirementFactor = {
  factorId: string;
  optieId?: string;
  gevraagd: FactorWaarde;
  /** Gewicht in procent binnen de rol (som = 100). Bij harde factoren genegeerd. */
  gewicht: number;
  /** Zet een gewogen factor tijdelijk als harde minimumeis. */
  minimumeis?: boolean;
};

export type ProjectRequirement = {
  rol: Rol;
  eisen: RequirementFactor[];
  /** Gewicht van de semantische gelijkenis in de eindscore (0–40). */
  semantischGewicht: number;
  vrijeOmschrijving?: string;
};

export type Herkomst = { veld: string; citaat: string; betrouwbaarheid: number };

export type Project = {
  id: string;
  naam: string;
  type: Projecttype;
  locatie: Geo & { plaats: string; adres?: string };
  woningen: number;
  prijssegment: Prijssegment[];
  bouwstijl: Bouwstijl;
  ambitieDuurzaamheid: 1 | 2 | 3 | 4 | 5;
  planning: { start: string; eind: string };
  fase: Projectfase;
  omschrijving: string;
  eisen: ProjectRequirement[];
  gewichtsprofielId?: string;
  herkomst?: Herkomst[];
  aangemaaktOp: string;
  bijgewerktOp: string;
};

export type Engagement = {
  id: string;
  partnerId: string;
  projectId: string;
  rol: Rol;
  periode: { van: string; tot?: string };
  contractwaarde: number;
  ramingBijStart?: number;
  eindafrekening?: number;
  geplandeOplevering?: string;
  werkelijkeOplevering?: string;
  bouwsysteem?: string;
  crediteurnummer?: string;
  bron: "handmatig" | "csv-import";
};

export type Evaluatie = {
  id: string;
  engagementId: string;
  partnerId: string;
  projectId: string;
  datum: string;
  door: string;
  kwaliteit: number;
  planning: number;
  budget: number;
  samenwerking: number;
  duurzaamheid: number;
  toelichting: string;
};

export type DiscoveryStatus = "nieuw" | "geaccepteerd" | "afgewezen" | "geparkeerd";

export type DiscoveryCandidate = {
  id: string;
  naam: string;
  kvk?: string;
  vestigingsplaats?: string;
  adres?: string;
  locatie?: Geo;
  website?: string;
  rollen: Rol[];
  bron: string;
  bronUrl: string;
  opgehaaldOp: string;
  ruweData: Record<string, unknown>;
  projectId?: string;
  status: DiscoveryStatus;
  reden?: string;
  mogelijkeDubbelVan?: string;
  samenvatting?: AISamenvatting;
  voorlopigeScore?: number;
  gepromoveerdTot?: string;
  beoordeeldOp?: string;
  beoordeeldDoor?: string;
};

export type AISamenvatting = {
  watDoetHetBedrijf: string;
  referentieprojecten: string[];
  waaromPastHet: string;
  watIsOnzeker: string[];
  gegenereerdOp: string;
  provider: string;
};

export type Uitsluiting = {
  partnerId: string;
  partnerNaam: string;
  reden: string;
  factorId?: string;
  soort: "status" | "rol" | "regio" | "capaciteit" | "beschikbaarheid" | "certificaat" | "factor";
};

export type CriteriumScore = {
  factorId: string;
  factorNaam: string;
  optieId?: string;
  gevraagd: FactorWaarde;
  waarde?: FactorWaarde;
  /** Ruwe fit 0–1 voordat betrouwbaarheid meeweegt. */
  fit: number | null;
  betrouwbaarheid?: number;
  bron?: Bron;
  bewijs?: Bewijs;
  gewicht: number;
  effectiefGewicht: number;
  bijdrage: number;
  toelichting: string;
};

export type Kandidaat = {
  partnerId: string;
  partnerNaam: string;
  status: PartnerStatus;
  rol: Rol;
  score: number;
  gewogenScore: number;
  semantischeScore: number | null;
  dekkingsgraad: number;
  waarschuwingen: string[];
  criteria: CriteriumScore[];
  semantischeTreffers: string[];
  afstandKm: number | null;
  isProspect: boolean;
};

export type RolResultaat = {
  rol: Rol;
  kandidaten: Kandidaat[];
  prospects: Kandidaat[];
  uitsluitingen: Uitsluiting[];
};

export type MatchRun = {
  id: string;
  projectId: string;
  naam: string;
  gestartOp: string;
  door: string;
  input: { eisen: ProjectRequirement[]; vrijeOmschrijving?: string; gewichtsversieId?: string };
  resultaat: RolResultaat[];
  vorigeRunId?: string;
};

export type MatchFeedback = {
  id: string;
  matchRunId: string;
  projectId: string;
  rol: Rol;
  partnerId: string;
  beslissing: "gekozen" | "afgewezen" | "shortlist";
  reden: string;
  door: string;
  op: string;
  positieInRanking: number;
};

export type TeamLid = { rol: Rol; partnerId: string; partnerNaam: string; score: number };

export type TeamVoorstel = {
  id: string;
  projectId: string;
  matchRunId: string;
  variant: "voorkeur" | "alternatief";
  leden: TeamLid[];
  teamScore: number;
  onderdelen: {
    gemiddeldeKwaliteit: number;
    samenwerkingshistorie: number;
    nabijheid: number;
    beschikbaarheid: number;
  };
  onderbouwing: string[];
  gemaaktOp: string;
};

export type Gewichtsprofiel = {
  id: string;
  naam: string;
  omschrijving: string;
  perRol: Partial<Record<Rol, RequirementFactor[]>>;
  semantischGewicht: number;
  versie: number;
  versies: Array<{ versie: number; op: string; door: string; toelichting: string; snapshot: Partial<Record<Rol, RequirementFactor[]>> }>;
  standaard: boolean;
};

export type EnrichmentVoorstel = {
  id: string;
  partnerId: string;
  factorId?: string;
  /** Optie binnen de factor (bijv. bouwsysteem/houtbouw). */
  optieId?: string;
  veld: string;
  huidig: FactorWaarde | null;
  voorgesteld: FactorWaarde;
  bron: Bron;
  bronUrl?: string;
  betrouwbaarheid: number;
  soort: "aantoonbaar" | "geclaimd";
  /** Verschiltype in het rondeoverzicht: nieuw gevonden, gewijzigd t.o.v. huidige waarde, of niet langer bevestigd op de bron. */
  aard?: "nieuw" | "gewijzigd" | "niet_bevestigd";
  /** De huidige waarde is door een mens gevalideerd; dit voorstel is een afwijkend signaal en overschrijft nooit stilzwijgend. */
  conflictMetGevalideerd?: boolean;
  /** Ronde waarin dit voorstel is gevonden (voor het verschillenoverzicht per ronde). */
  rondeId?: string;
  /** US-50: een voorstel met een hogere bronrang (of de huidige waarde) gaat voor; dit voorstel is een alternatief. */
  alternatief?: boolean;
  /** US-49: de huidige waarde komt uit de goudstandaard/eigen uitgave van Blauwhoed; AI overschrijft die nooit. */
  goudstandaardGaatVoor?: boolean;
  citaat: string;
  status: "open" | "geaccepteerd" | "afgewezen";
  gevondenOp: string;
};

/** B4: herbruikbaar zoekprofiel voor discovery. */
export type Zoekprofiel = { id: string; naam: string; rollen: Rol[]; trefwoorden: string; regio?: string; door: string; op: string };

/** Geplande/handmatige verrijkingsronde over het bestand; hervatbaar en met verschillenoverzicht. */
export type VerrijkingsRonde = {
  id: string;
  gestartOp: string;
  bijgewerktOp: string;
  klaarOp?: string;
  door: string;
  totaal: number;
  partnerIdsVerwerkt: string[];
  /** Partners overgeslagen omdat de broninhoud niet wijzigde sinds de vorige ronde (delta-selectie). */
  ongewijzigd: number;
  nieuw: number;
  gewijzigd: number;
  nietBevestigd: number;
  /** US-56: partners die deze ronde bestrijkt (volgens de omvang); ontbreekt = het hele bestand. */
  doelIds?: string[];
  omvang?: VerrijkingsSchema["omvang"];
  /** Gestart door het verrijkingsschema (cron) in plaats van handmatig. */
  gepland?: boolean;
  /** Alleen partners met een gewijzigde website verrijken (delta via webHash). */
  alleenGewijzigd?: boolean;
  /** US-57: vooraf verwachte AI-bewerkingen. */
  verwachteBewerkingen?: number;
};

/** Configureerbare extra verrijkingsbron (openbare URL, bijv. Conceptenboulevard of een brochurepagina). Toevoegbaar zonder codewijziging. */
export type VerrijkingsBron = {
  id: string;
  naam: string;
  url: string;
  actief: boolean;
  /** US-50: categorie van de bron. Eigen uitgaven van Blauwhoed (Conceptenboulevard, woningconceptenbrochure) hebben rang 1; overige webbronnen zijn indicatief. */
  categorie?: "eigen_uitgave" | "web";
};

/** US-59: functies waarvoor per functie een model wordt ingesteld (lichtste passende model, art. 8.9). */
export type AIFunctie = "extractie" | "chat" | "match" | "verband" | "aandragen";

/** US-62: openbaar register waarin een certificaat verifieerbaar is. `url` mag {naam} en {kvk} bevatten. */
export type RegisterBron = { id: string; naam: string; url: string; certificaat: CertificaatType; actief: boolean };

/** Eis 2 / US-58: één modelaanroep binnen een bewerking. Kosten in euro tegen de rekenprijzen uit de instellingen. */
export type AIAanroep = {
  model: string;
  doel: string;
  invoerTokens: number;
  uitvoerTokens: number;
  kostenEur: number;
  op: string;
};

/**
 * US-58 (art. 8): één AI-bewerking = één handeling die tot verwerking door een extern taalmodel leidt, inclusief alle
 * onderliggende aanroepen. Eén verrijking van één partner is één bewerking (ook binnen een ronde); een chatvraag, matchvraag,
 * verbandanalyse en AI-voorstelronde zijn elk één bewerking. Onderhoudsprocessen tellen niet mee.
 */
export type AIBewerking = {
  id: string;
  soort: "verrijking" | "verrijkingsronde" | "discovery" | "aandraag" | "projectextractie" | "partnerregistratie" | "chat" | "match" | "verband" | "samenvatting" | "overig";
  functie?: AIFunctie;
  omschrijving?: string;
  /** Gebruikersnaam, of "systeem" voor geplande rondes. */
  door: string;
  op: string;
  aanroepen: AIAanroep[];
  invoerTokens: number;
  uitvoerTokens: number;
  kostenEur: number;
};

/** US-58: budget in bewerkingen en tokens (euro), met de rekenprijzen per miljoen tokens. */
export type AIBudget = {
  bewerkingenPerMaand: number;
  tokenbudgetEur: number;
  prijsInvoerPerMTok: number;
  prijsUitvoerPerMTok: number;
};

/** US-56: instelbaar schema voor de periodieke verrijking. */
export type VerrijkingsSchema = {
  frequentie: "uit" | "wekelijks" | "tweewekelijks" | "maandelijks" | "kwartaal";
  /** Wekelijks/tweewekelijks: 1 = maandag … 7 = zondag. Maandelijks/kwartaal: dag van de maand (1–28). */
  dag: number;
  /** Tijd in Nederlandse tijd, "HH:MM". */
  tijd: string;
  omvang: "alles" | "partnertype" | "niet_verrijkt_sinds" | "gewijzigde_website";
  rollen: Rol[];
  maanden: number;
  ingesteldOp: string;
  ingesteldDoor?: string;
  /** Geplande moment van de laatst gestarte ronde. */
  laatsteGeplandeRonde?: string;
  /** Laatste keer dat de dagelijkse controle (cron) liep. */
  laatsteControle?: string;
  /** Laatste reden waarom een geplande ronde niet startte (bijv. budget). */
  overgeslagen?: { op: string; reden: string; gepland: string };
};

/** US-65: twee rollen conform de overeenkomst. Het aantal gebruikers is onbeperkt. */
export type Gebruikersrol = "gebruiker" | "beheerder";

export type Gebruiker = {
  id: string;
  naam: string;
  rol: Gebruikersrol;
  /** US-64: e-mailadres van de ingelogde medewerker (Entra ID). */
  email?: string;
  actief?: boolean;
  laatstIngelogdOp?: string;
  aangemaaktOp?: string;
};

export type AuditEntry = {
  id: string;
  op: string;
  door: string;
  /** US-64: id en e-mail van de ingelogde gebruiker. */
  gebruikerId?: string;
  email?: string;
  gebruikersrol: Gebruikersrol;
  entiteit: string;
  entiteitId: string;
  actie: string;
  details?: string;
};

export type Signaal = {
  id: string;
  soort: "certificaat" | "risico" | "afhankelijkheid" | "prospect" | "evaluatie" | "dekking" | "budget";
  ernst: "info" | "waarschuwing" | "kritiek";
  titel: string;
  omschrijving: string;
  partnerId?: string;
  projectId?: string;
  link?: string;
};

/** US-49: goudstandaard per partnertype (rol): welke velden verplicht of gewenst zijn en de beoordelingscriteria. */
export type GoudstandaardVeld = {
  /** `basis:<BasisVeld>` of `factor:<factorId>`. */
  sleutel: string;
  niveau: "verplicht" | "gewenst";
  toelichting?: string;
};

export type Beoordelingscriterium = { id: string; naam: string; omschrijving: string; factorId?: string };

export type GoudstandaardProfiel = {
  rol: Rol;
  velden: GoudstandaardVeld[];
  criteria: Beoordelingscriterium[];
  versie: number;
  bijgewerktOp: string;
  door: string;
};

export type Database = {
  versie: number;
  /** US-49: goudstandaard per partnertype. */
  goudstandaard: Partial<Record<Rol, GoudstandaardProfiel>>;
  factoren: Factor[];
  partners: Partner[];
  projecten: Project[];
  engagements: Engagement[];
  evaluaties: Evaluatie[];
  kandidaten: DiscoveryCandidate[];
  zoekprofielen: Zoekprofiel[];
  matchRuns: MatchRun[];
  feedback: MatchFeedback[];
  teams: TeamVoorstel[];
  gewichtsprofielen: Gewichtsprofiel[];
  verrijkingsvoorstellen: EnrichmentVoorstel[];
  verrijkingsrondes: VerrijkingsRonde[];
  aiBewerkingen: AIBewerking[];
  audit: AuditEntry[];
  gebruikers: Gebruiker[];
  importWachtrij: Array<{ id: string; regel: Record<string, string>; reden: string; op: string }>;
  afwijsredenen: Array<{ reden: string; op: string; kandidaatNaam: string }>;
  instellingen: {
    aiProvider: "uit" | "anthropic";
    afgeschermdeOmgeving: boolean;
    externeBronnenToegestaan: boolean;
    laatsteVerrijking?: string;
    /** US-58: maandbudget in AI-bewerkingen (standaard 750) en tokenbudget in euro (standaard € 30) met rekenprijzen. */
    aiBudget: AIBudget;
    /** US-59: model per functie. */
    modellen: Record<AIFunctie, string>;
    /** US-56: verrijkingsschema. */
    verrijkingsschema: VerrijkingsSchema;
    /** US-62: openbare keurmerk- en brancheregisters (geen login of betaling). */
    registerbronnen: RegisterBron[];
    /** Extra openbare verrijkingsbronnen (beheerbaar, geen codewijziging nodig). */
    verrijkingsbronnen: VerrijkingsBron[];
  };
};
