// Kern-domeinmodel van de Slimme Partnerdatabase.
// Zie backlog hoofdstuk 2 (datamodel) en 3 (factorenmodel).

export type PartnerStatus = "bekend" | "prospect" | "afgewezen" | "preferred" | "geblokkeerd";

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
  versie: number;
};

export type Bron = "opgave" | "projecthistorie" | "evaluatie" | "web" | "certificaat";

/** Standaardbetrouwbaarheid per bron (bewijs boven zelfbeeld). */
export const BRON_BETROUWBAARHEID: Record<Bron, number> = {
  certificaat: 0.95,
  projecthistorie: 0.9,
  evaluatie: 0.9,
  opgave: 0.6,
  web: 0.4
};

export type Bewijs = {
  soort: "project" | "evaluatie" | "certificaat" | "document" | "url" | "factuur";
  ref: string;
  label: string;
};

export type FactorWaarde = number | string | boolean | string[] | { min: number; max: number };

export type PartnerFactor = {
  factorId: string;
  /** Bij niveau-schalen met opties: de optie waarop dit niveau betrekking heeft. */
  optieId?: string;
  waarde: FactorWaarde;
  bron: Bron;
  betrouwbaarheid: number;
  bewijs?: Bewijs;
  peildatum: string;
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

export type Geo = { lat: number; lng: number };

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
  kwalificatie: Kwalificatie[];
  financieel?: Financieel;
  bronnen: Array<{ url: string; opgehaaldOp: string; soort: string }>;
  tags: string[];
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
  veld: string;
  huidig: FactorWaarde | null;
  voorgesteld: FactorWaarde;
  bron: Bron;
  bronUrl?: string;
  betrouwbaarheid: number;
  soort: "aantoonbaar" | "geclaimd";
  citaat: string;
  status: "open" | "geaccepteerd" | "afgewezen";
  gevondenOp: string;
};

export type Gebruikersrol = "lezer" | "bewerker" | "inkoper" | "beheerder";

export type Gebruiker = { id: string; naam: string; rol: Gebruikersrol };

export type AuditEntry = {
  id: string;
  op: string;
  door: string;
  gebruikersrol: Gebruikersrol;
  entiteit: string;
  entiteitId: string;
  actie: string;
  details?: string;
};

export type Signaal = {
  id: string;
  soort: "certificaat" | "risico" | "afhankelijkheid" | "prospect" | "evaluatie" | "dekking";
  ernst: "info" | "waarschuwing" | "kritiek";
  titel: string;
  omschrijving: string;
  partnerId?: string;
  projectId?: string;
  link?: string;
};

export type Database = {
  versie: number;
  factoren: Factor[];
  partners: Partner[];
  projecten: Project[];
  engagements: Engagement[];
  evaluaties: Evaluatie[];
  kandidaten: DiscoveryCandidate[];
  matchRuns: MatchRun[];
  feedback: MatchFeedback[];
  teams: TeamVoorstel[];
  gewichtsprofielen: Gewichtsprofiel[];
  verrijkingsvoorstellen: EnrichmentVoorstel[];
  audit: AuditEntry[];
  gebruikers: Gebruiker[];
  importWachtrij: Array<{ id: string; regel: Record<string, string>; reden: string; op: string }>;
  afwijsredenen: Array<{ reden: string; op: string; kandidaatNaam: string }>;
  instellingen: {
    aiProvider: "uit" | "anthropic";
    afgeschermdeOmgeving: boolean;
    externeBronnenToegestaan: boolean;
    laatsteVerrijking?: string;
  };
};
