// Verrijking vanuit internet (US-29/US-31): zoekt de bedrijfswebsite als die ontbreekt, leest een paar openbare pagina's
// (home, over ons, projecten, duurzaamheid) en doet voorstellen voor basisgegevens (website, KVK, plaats, omschrijving,
// referenties) én factorwaarden. Alles komt als voorstel in de wachtrij; niets wordt automatisch overgenomen.
import { extraheerVoorstellen, striptHtml } from "./enrichment";
import { leesBedrijfsgegevens } from "./webzoek";
import type { EnrichmentVoorstel, Partner } from "./types";

/** Velden buiten het factorenmodel die via een voorstel kunnen worden overgenomen (zie beoordeelVoorstel). */
export const BASISVELDEN = { website: "Website", kvk: "KVK-nummer", plaats: "Vestigingsplaats", omschrijving: "Omschrijving", referentie: "Referentieproject" } as const;

const UITSLUITEN = /(kvk\.nl|linkedin|facebook|instagram|youtube|twitter|x\.com|wikipedia|funda|indeed|glassdoor|trustpilot|drimble|cylex|telefoonboek|openingstijden|bedrijvenpagina|company\.info|creditsafe|graydon|bouwinfo|cobouw|bouwendnederland|conceptenboulevard|google\.|bing\.|duckduckgo|marktplaats|werkspot|jaap\.nl|huislijn|nieuwbouw-in|vacature)/i;
const SUBPAGINAS = [/over[- ]?ons|about|wie[- ]zijn[- ]wij|organisatie/i, /projecten|referenties|portfolio|werk|cases|woningen|concept/i, /duurzaam|circulair|biobased|mvo|sustainab|hout/i];

const UA = "BlauwhoedPartnerRadar/1.0 (verrijking; alleen openbare bedrijfsinformatie)";

function tokens(s: string) {
  return s
    .toLowerCase()
    .replace(/\b(b\.?v\.?|n\.?v\.?|groep|group|bouw|bouwbedrijf|bouwgroep|holding|nederland|de|het|van|der|den|en|&)\b/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

/** Past een gevonden URL bij de bedrijfsnaam? Minimaal één naamtoken in de hostnaam. */
export function pastBijNaam(naam: string, url: string) {
  const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const ts = tokens(naam);
  if (!ts.length) return false;
  return ts.some((t) => host.includes(t)) || host.includes(ts.join(""));
}

async function haalHtml(url: string, timeoutMs = 5000): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { "user-agent": UA, accept: "text/html" }, redirect: "follow" });
    if (!res.ok || !/text\/html/i.test(res.headers.get("content-type") ?? "text/html")) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Zoek de officiële website van een bedrijf via DuckDuckGo (keyless). Geeft de origin terug of null. */
export async function zoekWebsite(naam: string, plaats?: string): Promise<string | null> {
  const query = `"${naam}" ${plaats ?? ""} bouw woningbouw`.replace(/\s+/g, " ").trim();
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=nl-nl`, { headers: { "user-agent": `Mozilla/5.0 (compatible; ${UA})`, accept: "text/html" }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const html = await res.text();
    const kandidaten: string[] = [];
    for (const m of html.matchAll(/class="result__a"[^>]*href="([^"]+)"/g)) {
      let u = m[1];
      const uddg = u.match(/[?&]uddg=([^&]+)/);
      if (uddg) u = decodeURIComponent(uddg[1]);
      if (!/^https?:\/\//.test(u) || UITSLUITEN.test(u)) continue;
      kandidaten.push(new URL(u).origin);
      if (kandidaten.length >= 8) break;
    }
    return kandidaten.find((u) => pastBijNaam(naam, u)) ?? null;
  } catch {
    return null;
  }
}

/** Kies uit de homepage maximaal drie relevante subpagina's (over ons, projecten, duurzaamheid). */
export function kiesSubpaginas(html: string, basis: string): string[] {
  const origin = new URL(basis).origin;
  const links = Array.from(html.matchAll(/href="([^"#?]+)"/g)).map((m) => m[1]);
  const gekozen: string[] = [];
  for (const patroon of SUBPAGINAS) {
    const l = links.find((x) => patroon.test(x) && !/\.(pdf|jpg|png|svg|css|js)$/i.test(x) && (x.startsWith("/") || x.startsWith(origin)));
    if (!l) continue;
    const abs = l.startsWith("/") ? origin + l : l;
    if (abs !== basis && !gekozen.includes(abs)) gekozen.push(abs);
  }
  return gekozen.slice(0, 3);
}

/** Referentieprojecten uit een projectenpagina: koppen met een plaatsnaam en/of aantal woningen. */
export function leesReferenties(html: string, max = 4): string[] {
  const koppen = Array.from(html.matchAll(/<h[2-4][^>]*>([\s\S]{4,140}?)<\/h[2-4]>/gi)).map((m) => striptHtml(m[1]).trim());
  const uniek = Array.from(new Set(koppen.filter((k) => k.length >= 6 && k.length <= 120 && !/^(over|contact|nieuws|menu|projecten|referenties|onze|meer|bekijk|lees|volg|vacatures|diensten)/i.test(k) && /(\d+\s?(woningen|appartementen|studio|units)|[A-Z][a-z]+ [A-Z][a-z]+|[A-Z][a-z]{3,}\b.*\b(hof|park|kwartier|plein|laan|straat|wijk|buurt|dijk|weg|erf|tuin))/.test(k))));
  return uniek.slice(0, max);
}

export type WebVerrijkingResultaat = {
  website: string | null;
  websiteGevonden: boolean;
  paginas: string[];
  tekst: string;
  voorstellen: EnrichmentVoorstel[];
};

/** Volledige internetverrijking van één partner, met een totaalbudget in ms. Netwerkfouten of tijdnood leveren gewoon minder voorstellen op. */
export async function verrijkVanuitInternet(partner: Partner, nu = new Date(), budgetMs = 20000): Promise<WebVerrijkingResultaat> {
  const leeg: WebVerrijkingResultaat = { website: partner.website ?? null, websiteGevonden: false, paginas: [], tekst: "", voorstellen: [] };
  try {
    return await Promise.race([verrijkIntern(partner, nu), new Promise<WebVerrijkingResultaat>((r) => setTimeout(() => r(leeg), budgetMs))]);
  } catch (e) {
    console.warn("Internetverrijking mislukt voor", partner.naam, e instanceof Error ? e.message : e);
    return leeg;
  }
}

async function verrijkIntern(partner: Partner, nu: Date): Promise<WebVerrijkingResultaat> {
  const voorstellen: EnrichmentVoorstel[] = [];
  const stempel = nu.getTime().toString(36);
  const maak = (veld: string, voorgesteld: EnrichmentVoorstel["voorgesteld"], huidig: EnrichmentVoorstel["huidig"], bronUrl: string, citaat: string, betrouwbaarheid: number, aantoonbaar = true): EnrichmentVoorstel => ({
    id: `ev-web-${partner.id}-${veld.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${stempel}-${voorstellen.length}`,
    partnerId: partner.id,
    veld,
    huidig,
    voorgesteld,
    bron: "web",
    bronUrl,
    betrouwbaarheid,
    soort: aantoonbaar ? "aantoonbaar" : "geclaimd",
    citaat,
    status: "open",
    gevondenOp: nu.toISOString()
  });

  let website = partner.website ?? null;
  let websiteGevonden = false;
  if (!website) {
    website = await zoekWebsite(partner.naam, partner.vestigingsplaats || undefined);
    websiteGevonden = Boolean(website);
    if (website) voorstellen.push(maak(BASISVELDEN.website, website, null, website, `Zoekresultaat voor "${partner.naam}"; hostnaam komt overeen met de bedrijfsnaam.`, 0.6));
  }
  if (!website) return { website: null, websiteGevonden: false, paginas: [], tekst: "", voorstellen };

  const home = await haalHtml(website);
  if (!home) return { website, websiteGevonden, paginas: [], tekst: "", voorstellen };
  const paginas = [website, ...kiesSubpaginas(home, website)];
  const htmls = [home, ...(await Promise.all(paginas.slice(1).map((u) => haalHtml(u))))];
  const teksten = htmls.map((h) => (h ? striptHtml(h).slice(0, 15000) : ""));
  const tekst = teksten.join("\n\n");

  const b = leesBedrijfsgegevens(teksten[0], home, website);
  if (!partner.kvk && b.kvk) voorstellen.push(maak(BASISVELDEN.kvk, b.kvk, null, website, `KVK-nummer op de website: ${b.kvk}`, 0.7));
  const kvkElders = !partner.kvk && !b.kvk ? tekst.match(/k\.?v\.?k\.?(?:[- ]?nummer)?[:\s]*(\d{8})\b/i)?.[1] : undefined;
  if (kvkElders) voorstellen.push(maak(BASISVELDEN.kvk, kvkElders, null, website, `KVK-nummer op een subpagina: ${kvkElders}`, 0.65));
  if (!partner.vestigingsplaats && b.plaats) voorstellen.push(maak(BASISVELDEN.plaats, b.plaats, null, website, `Adresvermelding op de website: ${b.plaats}`, 0.6));
  if (b.profiel && b.profiel.length > 40 && (!partner.omschrijving || partner.omschrijving.length < 60)) voorstellen.push(maak(BASISVELDEN.omschrijving, b.profiel.slice(0, 400), partner.omschrijving || null, website, b.profiel.slice(0, 200), 0.5, false));

  htmls.slice(1).forEach((h, i) => {
    if (!h || !SUBPAGINAS[1].test(paginas[i + 1])) return;
    leesReferenties(h).forEach((ref) => {
      if (partner.referenties.some((r) => r.toLowerCase() === ref.toLowerCase())) return;
      voorstellen.push(maak(BASISVELDEN.referentie, ref, null, paginas[i + 1], `Projectkop op ${paginas[i + 1]}: “${ref}”`, 0.45));
    });
  });

  voorstellen.push(...extraheerVoorstellen(partner, tekst, website, nu));
  return { website, websiteGevonden, paginas: paginas.filter((_, i) => htmls[i]), tekst, voorstellen };
}
