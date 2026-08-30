// Epic 5: discovery van onbekende partners. Alleen bedrijfsgegevens, elke kandidaat met bron-URL en ophaaldatum.
import { semantischeGelijkenis } from "./embedding";
import { geocode } from "./geo";
import type { AISamenvatting, Database, DiscoveryCandidate, Partner, Project, Rol } from "./types";

export function normaliseerNaam(naam: string) {
  return naam
    .toLowerCase()
    .replace(/\b(b\.?v\.?|n\.?v\.?|v\.?o\.?f\.?|holding|groep|group|bouw|bouwbedrijf|architecten|architectuur|bv)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normaliseerAdres(adres?: string) {
  return (adres ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** US-26: dubbelherkenning op KVK, genormaliseerde naam en adres. */
export function vindDubbel(kandidaat: Pick<DiscoveryCandidate, "naam" | "kvk" | "adres" | "vestigingsplaats">, partners: Partner[]): { partner: Partner; reden: string } | null {
  if (kandidaat.kvk) {
    const opKvk = partners.find((p) => p.kvk === kandidaat.kvk);
    if (opKvk) return { partner: opKvk, reden: `KVK ${kandidaat.kvk} bestaat al` };
  }
  const naam = normaliseerNaam(kandidaat.naam);
  const opNaam = partners.find((p) => normaliseerNaam(p.naam) === naam);
  if (opNaam) return { partner: opNaam, reden: `Naam komt overeen met ${opNaam.naam}` };
  const adres = normaliseerAdres(kandidaat.adres);
  if (adres) {
    const opAdres = partners.find((p) => normaliseerAdres(p.adres) === adres && p.vestigingsplaats.toLowerCase() === (kandidaat.vestigingsplaats ?? "").toLowerCase());
    if (opAdres) return { partner: opAdres, reden: `Zelfde adres als ${opAdres.naam}` };
  }
  return null;
}

/**
 * Externe bronconnector. In deze omgeving draait een demo-connector met een gecureerde lijst (fictieve bedrijven);
 * KVK-API, brancheverenigingen, vakmedia en aanbestedingsplatforms hangen aan dezelfde interface.
 */
export type BronConnector = {
  naam: string;
  omschrijving: string;
  zoek: (vraag: { rollen: Rol[]; regio?: string; trefwoorden: string[] }) => Promise<Array<Omit<DiscoveryCandidate, "id" | "status" | "opgehaaldOp" | "projectId">>>;
};

type DemoBedrijf = { naam: string; kvk: string; plaats: string; adres: string; website: string; rollen: Rol[]; profiel: string; referenties: string[]; medewerkers: number; bron: string; bronUrl: string };

const DEMO_BEDRIJVEN: DemoBedrijf[] = [
  { naam: "Noorderlicht Houtbouw B.V.", kvk: "71234561", plaats: "Groningen", adres: "Industrieweg 14", website: "https://example.org/noorderlicht", rollen: ["aannemer"], profiel: "Fabrieksmatige CLT-woningbouw, biobased isolatie, demontabele gevelelementen. Actief in Noord- en Oost-Nederland.", referenties: ["De Houtwerf, 48 grondgebonden woningen Groningen (CLT)", "Zuiderzon, 32 appartementen Zwolle (houtskeletbouw)"], medewerkers: 65, bron: "Branchevereniging Houtbouw NL", bronUrl: "https://example.org/houtbouw-nl/leden" },
  { naam: "Atelier Vermeulen Architecten", kvk: "71234562", plaats: "Utrecht", adres: "Oudegracht 210", website: "https://example.org/vermeulen", rollen: ["architect"], profiel: "Ontwerpbureau voor binnenstedelijke transformaties en gestapelde woningbouw in beschermd stadsgezicht.", referenties: ["Transformatie Drukkerij De Pers, 60 appartementen Utrecht", "Woontoren Lumière, 120 appartementen Amersfoort"], medewerkers: 22, bron: "Vakmedia: Architectenweb", bronUrl: "https://example.org/architectenweb/vermeulen" },
  { naam: "Circulaire Installaties Delta", kvk: "71234563", plaats: "Rotterdam", adres: "Maashaven 8", website: "https://example.org/delta", rollen: ["installateur"], profiel: "Energieneutrale installaties, warmtepompen en BENG-optimalisatie voor gestapelde bouw. BIM-niveau 2.", referenties: ["Katendrecht Blok C, 90 appartementen", "Zorgcampus Dordrecht, 70 zorgwoningen"], medewerkers: 140, bron: "Aanbestedingsplatform TenderNed", bronUrl: "https://example.org/tenderned/delta" },
  { naam: "Bureau Bodem & Bouwfysica", kvk: "71234564", plaats: "Amersfoort", adres: "Stationsplein 5", website: "https://example.org/bbb", rollen: ["adviseur"], profiel: "Adviseur MPG, BENG en circulariteit. Materialenpaspoorten, Paris Proof-berekeningen.", referenties: ["MPG-advies 300 woningen Almere Poort", "Materialenpaspoort Kop van Zuid"], medewerkers: 18, bron: "Vakmedia: Cobouw", bronUrl: "https://example.org/cobouw/bbb" },
  { naam: "Prefab Gevels Zuid B.V.", kvk: "71234565", plaats: "Tilburg", adres: "Kanaalweg 33", website: "https://example.org/pgz", rollen: ["leverancier"], profiel: "Prefab gevelelementen met biobased isolatie, demontabel en remontabel. Levering aan houtbouw en beton.", referenties: ["Gevels Piushaven, 140 appartementen Tilburg"], medewerkers: 80, bron: "Branchevereniging Houtbouw NL", bronUrl: "https://example.org/houtbouw-nl/leden" },
  { naam: "Bouwgroep Meander", kvk: "71234566", plaats: "Arnhem", adres: "Rijnkade 100", website: "https://example.org/meander", rollen: ["aannemer", "ontwikkelpartner"], profiel: "Middelgrote bouwer van grondgebonden woningen met eigen woningconcept 'Meander Thuis'. Conceptbouw, bouwteamervaring.", referenties: ["Park Lingezegen, 110 grondgebonden woningen", "Schuytgraaf fase 4, 80 woningen"], medewerkers: 210, bron: "KVK-register", bronUrl: "https://example.org/kvk/71234566" },
  { naam: "Studio Hoogstad", kvk: "71234567", plaats: "Amsterdam", adres: "Piet Heinkade 55", website: "https://example.org/hoogstad", rollen: ["architect"], profiel: "Hoogstedelijke woontorens en gemengde programma's. Hoogbouw, parametrisch ontwerp, BIM-niveau 3.", referenties: ["Toren Amstelkwartier, 210 appartementen", "Sluisbuurt kavel 3, 180 appartementen"], medewerkers: 35, bron: "Prijzenlijst: Amsterdamse Architectuurprijs", bronUrl: "https://example.org/arcam/prijs" },
  { naam: "Hollands Hout Constructies", kvk: "71234568", plaats: "Zaandam", adres: "Hembrugterrein 12", website: "https://example.org/hhc", rollen: ["aannemer", "leverancier"], profiel: "Houtskeletbouw en CLT-casco's voor appartementen tot 8 lagen. MPG < 0,5 aantoonbaar via NMD-berekening.", referenties: ["Hembrug Wonen, 64 appartementen Zaandam", "Houtwijk, 40 woningen Purmerend"], medewerkers: 55, bron: "Vakmedia: Houtwereld", bronUrl: "https://example.org/houtwereld/hhc" },
  { naam: "Zorgbouw Brabant", kvk: "71234569", plaats: "Eindhoven", adres: "Kennedylaan 2", website: "https://example.org/zorgbouw", rollen: ["aannemer"], profiel: "Specialist in zorgwonen en seniorenhuisvesting. Traditionele bouw, sterke planningsdiscipline.", referenties: ["Zorgresidentie Meerhoven, 60 zorgwoningen", "Hof van Strijp, 45 seniorenwoningen"], medewerkers: 95, bron: "KVK-register", bronUrl: "https://example.org/kvk/71234569" },
  { naam: "Groenwerk Adviseurs", kvk: "71234570", plaats: "Leiden", adres: "Haagweg 40", website: "https://example.org/groenwerk", rollen: ["adviseur"], profiel: "Natuurinclusief en klimaatadaptief ontwerpen; biodiversiteitsscans en groenblauwe daken.", referenties: ["Natuurinclusief plan Rijnhaven Leiden"], medewerkers: 9, bron: "Vakmedia: Stadszaken", bronUrl: "https://example.org/stadszaken/groenwerk" },
  { naam: "Modulair Wonen Nederland", kvk: "71234571", plaats: "Almere", adres: "Randstad 22", website: "https://example.org/mwn", rollen: ["aannemer", "leverancier"], profiel: "3D-modulaire woningen uit fabriek, 90% prefab, remontabel. Sociale huur en middenhuur.", referenties: ["Flexwonen Almere Buiten, 120 woningen", "Startersblok Lelystad, 56 woningen"], medewerkers: 160, bron: "Aanbestedingsplatform TenderNed", bronUrl: "https://example.org/tenderned/mwn" },
  { naam: "Van der Kolk Installatietechniek", kvk: "71234572", plaats: "Zwolle", adres: "Ceintuurbaan 9", website: "https://example.org/vdkolk", rollen: ["installateur"], profiel: "W- en E-installaties voor grondgebonden woningbouw. Warmtepompen, PV. Werkgebied Oost-Nederland.", referenties: ["Stadshagen fase 3, 200 woningen"], medewerkers: 75, bron: "KVK-register", bronUrl: "https://example.org/kvk/71234572" }
];

export const demoConnector: BronConnector = {
  naam: "Demo-bronnen (KVK, brancheverenigingen, vakmedia, aanbestedingen, prijzenlijsten)",
  omschrijving: "Gecureerde demo-instroom. Vervang door echte connectors zodra het beleid op externe bronnen is vastgesteld (punt 5).",
  async zoek(vraag) {
    const tekst = vraag.trefwoorden.join(" ");
    return DEMO_BEDRIJVEN.filter((b) => b.rollen.some((r) => vraag.rollen.includes(r)))
      .map((b) => ({
        naam: b.naam,
        kvk: b.kvk,
        vestigingsplaats: b.plaats,
        adres: b.adres,
        locatie: geocode(b.plaats) ?? undefined,
        website: b.website,
        rollen: b.rollen,
        bron: b.bron,
        bronUrl: b.bronUrl,
        ruweData: { profiel: b.profiel, referenties: b.referenties, medewerkers: b.medewerkers },
        voorlopigeScore: tekst ? Math.round(semantischeGelijkenis(tekst, `${b.profiel} ${b.referenties.join(" ")}`).score * 100) : undefined
      }))
      .sort((a, b) => (b.voorlopigeScore ?? 0) - (a.voorlopigeScore ?? 0));
  }
};

/** Afwijsredenen trainen de filtering (US-25): kandidaten die lijken op eerder afgewezen profielen zakken. */
export function afwijsPenalty(kandidaat: { naam: string; ruweData: Record<string, unknown> }, afwijsredenen: Database["afwijsredenen"]) {
  if (!afwijsredenen.length) return 0;
  const profiel = `${kandidaat.naam} ${JSON.stringify(kandidaat.ruweData)}`;
  const max = Math.max(...afwijsredenen.map((r) => semantischeGelijkenis(r.reden, profiel).score));
  return Math.round(max * 30);
}

/** US-27: korte samenvatting per prospect. Zonder AI-provider: deterministische samenvatting uit de ruwe data. */
export function samenvattingVoor(kandidaat: DiscoveryCandidate, project?: Project): AISamenvatting {
  const profiel = String(kandidaat.ruweData.profiel ?? "");
  const referenties = (kandidaat.ruweData.referenties as string[] | undefined) ?? [];
  const onzeker: string[] = [];
  if (!kandidaat.kvk) onzeker.push("KVK-nummer niet geverifieerd.");
  if (!referenties.length) onzeker.push("Geen referentieprojecten gevonden.");
  onzeker.push("Claims komen van de eigen website/bron en zijn niet aantoonbaar gemaakt met certificaat of meting.");
  if (!kandidaat.ruweData.medewerkers) onzeker.push("Organisatieomvang onbekend.");
  const treffers = project ? semantischeGelijkenis(`${project.omschrijving} ${project.type} ${project.bouwstijl}`, `${profiel} ${referenties.join(" ")}`).treffers : [];
  return {
    watDoetHetBedrijf: profiel || `${kandidaat.naam} (${kandidaat.rollen.join(", ")}) in ${kandidaat.vestigingsplaats ?? "onbekende plaats"}.`,
    referentieprojecten: referenties,
    waaromPastHet: project
      ? treffers.length
        ? `Overlap met ${project.naam} op: ${treffers.join(", ")}. Rol ${kandidaat.rollen.join("/")} is gevraagd.`
        : `Rol ${kandidaat.rollen.join("/")} is gevraagd voor ${project.naam}, maar inhoudelijke overlap is beperkt.`
      : `Rol ${kandidaat.rollen.join("/")}; nog niet aan een project gekoppeld.`,
    watIsOnzeker: onzeker,
    gegenereerdOp: new Date().toISOString(),
    provider: "regels (geen externe AI)"
  };
}

/** Promotie van kandidaat naar partner met status prospect (US-25). */
export function kandidaatNaarPartner(k: DiscoveryCandidate, nu = new Date()): Partner {
  const iso = nu.toISOString();
  const profiel = String(k.ruweData.profiel ?? "");
  const referenties = (k.ruweData.referenties as string[] | undefined) ?? [];
  return {
    id: `p-${k.id}`,
    naam: k.naam,
    kvk: k.kvk ?? "",
    rechtsvorm: k.naam.match(/B\.?V\.?/i) ? "B.V." : "Onbekend",
    vestigingsplaats: k.vestigingsplaats ?? "",
    adres: k.adres,
    locatie: k.locatie ?? geocode(k.vestigingsplaats ?? "") ?? { lat: 52.1, lng: 5.3 },
    werkgebiedKm: 100,
    status: "prospect",
    statusReden: `Gepromoveerd uit discovery (${k.bron})`,
    rollen: k.rollen,
    website: k.website,
    omschrijving: profiel,
    referenties,
    medewerkers: typeof k.ruweData.medewerkers === "number" ? k.ruweData.medewerkers : undefined,
    beschikbaarheid: [],
    factoren: [],
    certificaten: [],
    contactpersonen: [],
    kwalificatie: [],
    bronnen: [{ url: k.bronUrl, opgehaaldOp: k.opgehaaldOp, soort: k.bron }],
    tags: ["prospect"],
    aangemaaktOp: iso,
    bijgewerktOp: iso
  };
}
