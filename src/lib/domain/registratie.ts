// Partnerregistratie door AI: een partner wordt opgebouwd uit openbare tekst (website en/of aangeleverd document) en
// komt met status 'concept' in het bestand. Pas na vrijgave door een beheerder telt hij mee in zoeken en matching.
// Deze module bevat de regelgebaseerde terugval (zonder API-sleutel) en de samenvoeging van AI- en regeluitkomsten.
import { BASISVELDEN } from "./webverrijking";
import { leesBedrijfsgegevens } from "./webzoek";
import { ROLLEN, type EnrichmentVoorstel, type Herkomst, type Partner, type Rol } from "./types";

export type RegistratieVelden = {
  naam: string;
  kvk: string;
  rechtsvorm: string;
  vestigingsplaats: string;
  adres?: string;
  rollen: Rol[];
  website?: string;
  omschrijving: string;
  referenties: string[];
  medewerkers?: number;
};

export type RegistratieConcept = { velden: RegistratieVelden; herkomst: Herkomst[]; waarschuwingen: string[] };

const ROL_PATRONEN: Array<[Rol, RegExp]> = [
  ["architect", /\barchitect(en|enbureau|uur)?\b/i],
  ["aannemer", /\b(aannemer|aannemersbedrijf|bouwbedrijf|bouwonderneming|bouwgroep)\b/i],
  ["installateur", /\b(installateur|installatiebedrijf|installatietechniek|warmtepomp(en)? install)/i],
  ["adviseur", /\b(adviesbureau|adviseur|constructeur|ingenieursbureau|bouwfysica)\b/i],
  ["leverancier", /\b(leverancier|prefab|fabrikant|bouwelementen|houtskeletbouw)\b/i],
  ["ontwikkelpartner", /\b(projectontwikkel|ontwikkelende bouwer|gebiedsontwikkel)/i]
];

/** Rollen raden uit vrije tekst; alleen als hint voor de beheerder, nooit als vastgestelde waarde. */
export function raadRollen(tekst: string): Rol[] {
  return ROL_PATRONEN.filter(([, re]) => re.test(tekst)).map(([r]) => r);
}

export function geldigeRollen(rollen: string[]): Rol[] {
  return Array.from(new Set(rollen.map((r) => r.toLowerCase().trim()).filter((r): r is Rol => (ROLLEN as string[]).includes(r))));
}

export function normaliseerWebsite(url?: string) {
  const u = url?.trim();
  if (!u) return undefined;
  try {
    return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).origin;
  } catch {
    return undefined;
  }
}

/** Regelgebaseerd concept uit aangeleverde tekst en de basisvoorstellen van de internetverrijking. */
export function regelConcept(hint: { naam?: string; website?: string }, tekst: string, webVoorstellen: EnrichmentVoorstel[]): RegistratieConcept {
  const herkomst: Herkomst[] = [];
  const eerste = (veld: string) => webVoorstellen.find((v) => v.veld === veld);
  const uitTekst = tekst ? leesBedrijfsgegevens(tekst, "", "https://tekst.invalid") : undefined;

  const websiteV = eerste(BASISVELDEN.website);
  const website = hint.website ?? (websiteV ? String(websiteV.voorgesteld) : undefined);
  if (websiteV && !hint.website) herkomst.push({ veld: "website", citaat: websiteV.citaat, betrouwbaarheid: websiteV.betrouwbaarheid });

  const kvkV = eerste(BASISVELDEN.kvk);
  const kvk = kvkV ? String(kvkV.voorgesteld) : (uitTekst?.kvk ?? "");
  if (kvkV) herkomst.push({ veld: "kvk", citaat: kvkV.citaat, betrouwbaarheid: kvkV.betrouwbaarheid });
  else if (uitTekst?.kvk) herkomst.push({ veld: "kvk", citaat: `KVK-nummer in de aangeleverde tekst: ${uitTekst.kvk}`, betrouwbaarheid: 0.7 });

  const plaatsV = eerste(BASISVELDEN.plaats);
  const plaats = plaatsV ? String(plaatsV.voorgesteld) : (uitTekst?.plaats ?? "");
  if (plaatsV) herkomst.push({ veld: "vestigingsplaats", citaat: plaatsV.citaat, betrouwbaarheid: plaatsV.betrouwbaarheid });
  else if (uitTekst?.plaats) herkomst.push({ veld: "vestigingsplaats", citaat: `Adresvermelding in de aangeleverde tekst: ${uitTekst.plaats}`, betrouwbaarheid: 0.6 });

  const omschrijvingV = eerste(BASISVELDEN.omschrijving);
  const omschrijving = omschrijvingV ? String(omschrijvingV.voorgesteld) : (uitTekst?.profiel.slice(0, 400) ?? "");
  if (omschrijvingV) herkomst.push({ veld: "omschrijving", citaat: omschrijvingV.citaat, betrouwbaarheid: omschrijvingV.betrouwbaarheid });

  const refs = webVoorstellen.filter((v) => v.veld === BASISVELDEN.referentie);
  refs.forEach((v) => herkomst.push({ veld: "referenties", citaat: v.citaat, betrouwbaarheid: v.betrouwbaarheid }));

  const rollen = raadRollen(`${hint.naam ?? ""} ${omschrijving} ${tekst.slice(0, 5000)}`);
  if (rollen.length) herkomst.push({ veld: "rollen", citaat: `Afgeleid uit trefwoorden in de tekst (${rollen.join(", ")}).`, betrouwbaarheid: 0.4 });

  const naam = hint.naam || (website ? new URL(website).hostname.replace(/^www\./, "") : "");
  return {
    velden: { naam, kvk, rechtsvorm: /\bB\.?V\.?\b/i.test(naam) ? "B.V." : "Onbekend", vestigingsplaats: plaats, rollen, website, omschrijving, referenties: refs.map((v) => String(v.voorgesteld)) },
    herkomst,
    waarschuwingen: ["Opgebouwd met regels (geen AI-sleutel ingesteld): controleer alle velden extra zorgvuldig."]
  };
}

/** Controles die een beheerder vóór vrijgave moet zien; vrijgave is pas mogelijk als de blokkerende punten zijn opgelost. */
export function vrijgaveBlokkades(p: Pick<Partner, "naam" | "rollen" | "vestigingsplaats" | "kvk">): string[] {
  const b: string[] = [];
  if (!p.naam.trim()) b.push("Naam ontbreekt.");
  if (!p.rollen.length) b.push("Er is nog geen rol gekozen.");
  if (!p.vestigingsplaats.trim()) b.push("Vestigingsplaats ontbreekt (nodig voor het regiofilter).");
  if (p.kvk && !/^\d{8}$/.test(p.kvk)) b.push("KVK-nummer is geen 8 cijfers.");
  return b;
}
