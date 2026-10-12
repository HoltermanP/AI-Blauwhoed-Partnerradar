// US-12/US-13: bronbeleid. Vooraf aangewezen branchebronnen (beroepsverenigingen, registers, platforms) krijgen een hogere
// kwaliteitsrang dan gewone webresultaten; die rang telt mee in de betrouwbaarheid van een gevonden waarde (en daarmee in de
// matching, US-05). Gebruikers stellen nieuwe bronnen voor; pas na goedkeuring door beheer gebruiken verrijking en discovery ze.
import type { EnrichmentVoorstel, VerrijkingsBron } from "./types";

export type BronRang = 1 | 2 | 3;

export const BRONRANG_LABEL: Record<BronRang, string> = {
  1: "Rang 1 – eigen uitgave Blauwhoed",
  2: "Rang 2 – branchebron (vereniging, register, platform)",
  3: "Rang 3 – gewoon webresultaat (indicatief)"
};

/** Betrouwbaarheid die een waarde minimaal krijgt als ze van een bron met deze rang komt. */
export const RANG_BETROUWBAARHEID: Record<BronRang, number> = { 1: 0.9, 2: 0.7, 3: 0.4 };

export function rangVanBron(b: Pick<VerrijkingsBron, "rang" | "categorie">): BronRang {
  if (b.rang) return b.rang;
  return b.categorie === "eigen_uitgave" ? 1 : b.categorie === "branche" ? 2 : 3;
}

/** Een bron zonder status is van vóór het bronvoorstel en geldt als goedgekeurd. */
export function isGoedgekeurd(b: Pick<VerrijkingsBron, "status">) {
  return (b.status ?? "goedgekeurd") === "goedgekeurd";
}

export function hostVan(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/** De goedgekeurde bron uit de bronnenlijst waartoe deze URL behoort (zelfde domein of subdomein). */
export function bronVoorUrl(url: string | undefined, bronnen: VerrijkingsBron[]): VerrijkingsBron | undefined {
  const host = hostVan(url);
  if (!host) return undefined;
  return bronnen
    .filter(isGoedgekeurd)
    .map((b) => ({ b, h: hostVan(b.url) }))
    .filter((x): x is { b: VerrijkingsBron; h: string } => Boolean(x.h) && (host === x.h || host.endsWith(`.${x.h}`)))
    .sort((a, b) => rangVanBron(a.b) - rangVanBron(b.b))[0]?.b;
}

/**
 * Pas de bronrang toe op een verrijkingsvoorstel: komt de bron-URL van een aangewezen bron, dan krijgt de waarde minimaal de
 * betrouwbaarheid van die rang en wordt de bron bij naam genoemd. Een gewone webbron blijft indicatief.
 */
export function pasBronrangToe(v: EnrichmentVoorstel, bronnen: VerrijkingsBron[]) {
  const b = bronVoorUrl(v.bronUrl, bronnen);
  if (!b) return v;
  const rang = rangVanBron(b);
  v.bronNaam = b.naam;
  v.bronRangLijst = rang;
  v.betrouwbaarheid = Math.max(v.betrouwbaarheid, RANG_BETROUWBAARHEID[rang]);
  return v;
}

/** US-07: zonder bron geen voorstel. Een voorstel heeft een herleidbare bron (URL, document of register) en een onderbouwing (citaat). */
export function heeftBronEnOnderbouwing(v: Pick<EnrichmentVoorstel, "bronUrl" | "citaat" | "bron">) {
  const bron = (v.bronUrl ?? "").trim();
  return Boolean(bron) && Boolean((v.citaat ?? "").trim());
}

const b = (id: string, naam: string, url: string, omschrijving: string, extra: Partial<VerrijkingsBron> = {}): VerrijkingsBron => ({ id, naam, url, omschrijving, actief: false, categorie: "branche", rang: 2, status: "goedgekeurd", ...extra });

/**
 * Startlijst branchebronnen (rang 2). Standaard niet actief als extra pagina in een ronde (dat kost leestijd per ronde), maar
 * hun rang telt wel mee zodra een waarde van dat domein komt. Beheer past de lijst aan zonder ontwikkelaar.
 */
export const STANDAARD_BRANCHEBRONNEN: VerrijkingsBron[] = [
  b("vb-architectenregister", "Architectenregister", "https://www.architectenregister.nl/", "Wettelijk register van architecten (Bureau Architectenregister)."),
  b("vb-bna", "BNA – Bond van Nederlandse Architecten", "https://bna.nl/", "Beroepsvereniging van architecten; ledenlijst en projecten."),
  b("vb-nlingenieurs", "NLingenieurs", "https://www.nlingenieurs.nl/", "Branchevereniging van advies-, ingenieurs- en constructiebureaus."),
  b("vb-technieknederland", "Techniek Nederland", "https://www.technieknederland.nl/", "Branchevereniging van installatiebedrijven."),
  b("vb-bouwendnederland", "Bouwend Nederland", "https://www.bouwendnederland.nl/", "Branchevereniging van bouw- en infrabedrijven."),
  b("vb-dgbc", "Dutch Green Building Council", "https://www.dgbc.nl/", "Paris Proof, BREEAM-NL en duurzaamheidsprojecten."),
  b("vb-centrumhout", "Centrum Hout", "https://www.centrumhout.nl/", "Kennisplatform houtbouw; projecten en leveranciers.")
];

/**
 * US-11: bronnen voor prijzen en nominaties (discovery-modus 'upcoming'). Welke bronnen goed werken, wordt nog getest: ze staan
 * daarom als voorstel klaar en zijn door beheer aan of uit te zetten.
 */
export const STANDAARD_UPCOMING_BRONNEN: VerrijkingsBron[] = [
  b("vb-abebonnema", "Abe Bonnema Prijs", "https://abebonnemaprijs.nl/", "Prijs voor jonge architecten; nominaties en winnaars.", { upcoming: true, rang: 3, categorie: "web", actief: true }),
  b("vb-goudenpiramide", "Gouden Piramide", "https://www.goudenpiramide.nl/", "Rijksprijs voor inspirerend opdrachtgeverschap; genomineerde projecten en teams.", { upcoming: true, rang: 3, categorie: "web", actief: true }),
  b("vb-bna-bestegebouw", "BNA Beste Gebouw van het Jaar", "https://bna.nl/documenten/bna-beste-gebouw-van-het-jaar/", "Jaarlijkse architectuurprijs; genomineerde gebouwen en bureaus.", { upcoming: true, rang: 3, categorie: "web", actief: true }),
  b("vb-dda", "Dutch Design Awards", "https://www.dutchdesignawards.nl/", "Designprijs met een categorie ruimtelijk ontwerp.", { upcoming: true, rang: 3, categorie: "web", actief: true }),
  b("vb-arc", "ARC Awards (de Architect)", "https://www.dearchitect.nl/arc", "Architectuur- en innovatieprijzen van vakblad de Architect.", { upcoming: true, rang: 3, categorie: "web", actief: true })
];

/** Zoektermen voor de discovery-modus 'upcoming': opvallende projecten, prijzen en nominaties. */
export const UPCOMING_TERMEN = ["genomineerd", "nominatie", "prijswinnaar", "award", "jong bureau"];
