// Keyless webconnector voor discovery (US-24): zoekt via DuckDuckGo (HTML-endpoint) naar bedrijfswebsites op branchetermen,
// haalt de website op en leest bedrijfsnaam, KVK-nummer (als dat op de site staat), plaats en profieltekst.
// Alleen openbare bedrijfsinformatie. Zoekmachines wijzigen hun HTML; bij falen levert deze connector gewoon niets.
import type { BronConnector } from "./discovery";
import { striptHtml } from "./enrichment";
import type { Rol } from "./types";

const TERMEN: Record<Rol, string[]> = {
  aannemer: ["aannemer woningbouw", "bouwbedrijf nieuwbouw woningen"],
  architect: ["architectenbureau woningbouw"],
  installateur: ["installateur woningbouw warmtepomp"],
  adviseur: ["adviesbureau duurzaamheid woningbouw", "constructeur woningbouw"],
  leverancier: ["prefab bouwelementen leverancier", "houtskeletbouw leverancier"],
  ontwikkelpartner: ["ontwikkelende bouwer woningbouw"]
};

const UITSLUITEN = /(bouwgarant|keurmerk|nieuwbouw-in|funda|jaap\.nl|huislijn|vergelijk|offerte|werkspot|homedeal|bouwinfo|bouwkosten|brancheorganisatie|wikipedia|linkedin|facebook|instagram|youtube|indeed|werkzoeken|marktplaats|kvk\.nl|google\.|bing\.|duckduckgo|telefoonboek|openingstijden|bedrijvenpagina|drimble|cylex|trustpilot|glassdoor)/i;

// Zoekmachines blokkeren regelmatig verkeer uit datacenters (zoals Vercel). Daarom een keten: DuckDuckGo → Bing,
// met per zoekmachine een diagnose, zodat "0 resultaten" uit te leggen is in plaats van stil te falen.
const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const ZOEK_HEADERS = { "user-agent": BROWSER_UA, accept: "text/html", "accept-language": "nl-NL,nl;q=0.9,en;q=0.5" };

export type ZoekDiagnose = { zoekmachine: string; status: number | null; resultaten: number; geblokkeerd: boolean };

function verzamel(ruw: string[], max: number) {
  const urls = new Set<string>();
  for (const u of ruw) {
    if (!/^https?:\/\//.test(u) || UITSLUITEN.test(u)) continue;
    try {
      urls.add(new URL(u).origin);
    } catch {
      continue;
    }
    if (urls.size >= max) break;
  }
  return Array.from(urls);
}

async function viaDuckDuckGo(query: string, max: number): Promise<{ urls: string[]; diagnose: ZoekDiagnose }> {
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=nl-nl`, { headers: ZOEK_HEADERS, signal: AbortSignal.timeout(8000) });
    const html = res.ok ? await res.text() : "";
    const ruw = Array.from(html.matchAll(/class="result__a"[^>]*href="([^"]+)"/g)).map((m) => {
      const uddg = m[1].match(/[?&]uddg=([^&]+)/);
      return uddg ? decodeURIComponent(uddg[1]) : m[1];
    });
    const urls = verzamel(ruw, max);
    return { urls, diagnose: { zoekmachine: "DuckDuckGo", status: res.status, resultaten: urls.length, geblokkeerd: !res.ok || res.status === 202 || /anomaly|captcha|challenge/i.test(html) } };
  } catch {
    return { urls: [], diagnose: { zoekmachine: "DuckDuckGo", status: null, resultaten: 0, geblokkeerd: true } };
  }
}

/** Bing verpakt resultaten in /ck/a?…&u=a1<base64url>; dat wordt hier teruggerekend naar de echte URL. */
export function bingDoelUrl(href: string) {
  const h = href.replace(/&amp;/g, "&");
  const u = h.match(/[?&]u=a1([^&]+)/)?.[1];
  if (!u) return h;
  try {
    return Buffer.from(u.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  } catch {
    return h;
  }
}

async function viaBing(query: string, max: number): Promise<{ urls: string[]; diagnose: ZoekDiagnose }> {
  try {
    const res = await fetch(`https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=nl&cc=NL`, { headers: ZOEK_HEADERS, signal: AbortSignal.timeout(8000) });
    const html = res.ok ? await res.text() : "";
    const ruw = Array.from(html.matchAll(/<li class="b_algo"[\s\S]*?<a[^>]+href="(https?:[^"]+)"/g)).map((m) => bingDoelUrl(m[1]));
    const urls = verzamel(ruw, max);
    return { urls, diagnose: { zoekmachine: "Bing", status: res.status, resultaten: urls.length, geblokkeerd: !res.ok || /captcha|challenge/i.test(html.slice(0, 5000)) } };
  } catch {
    return { urls: [], diagnose: { zoekmachine: "Bing", status: null, resultaten: 0, geblokkeerd: true } };
  }
}

export async function zoekUrlsMetDiagnose(query: string, max = 8): Promise<{ urls: string[]; diagnose: ZoekDiagnose[] }> {
  const diagnose: ZoekDiagnose[] = [];
  for (const motor of [viaDuckDuckGo, viaBing]) {
    const r = await motor(query, max);
    diagnose.push(r.diagnose);
    if (r.urls.length) return { urls: r.urls, diagnose };
  }
  return { urls: [], diagnose };
}

export async function zoekUrls(query: string, max = 8): Promise<string[]> {
  return (await zoekUrlsMetDiagnose(query, max)).urls;
}

/** Lees een gevonden bedrijfswebsite als discovery-kandidaat (naam, KVK, plaats, profiel). */
export async function kandidaatVanWebsite(url: string, rol: Rol, bron: string, zoekterm: string, regio?: string): Promise<Awaited<ReturnType<BronConnector["zoek"]>>[number] | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { "user-agent": "BlauwhoedPartnerRadar/1.0 (discovery; alleen openbare bedrijfsinformatie)" } });
    if (!r.ok) return null;
    const html = await r.text();
    const tekst = striptHtml(html).slice(0, 20000);
    const b = leesBedrijfsgegevens(tekst, html, url);
    return { naam: b.naam, kvk: b.kvk, vestigingsplaats: b.plaats ?? regio, website: url, rollen: [rol], bron, bronUrl: url, ruweData: { profiel: b.profiel, referenties: [], zoekterm, websiteTekst: tekst.slice(0, 8000) } } as Awaited<ReturnType<BronConnector["zoek"]>>[number];
  } catch {
    return null;
  }
}

/** Diagnose van de laatste webzoekronde (voor een begrijpelijke melding bij 0 resultaten). */
export let laatsteZoekDiagnose: ZoekDiagnose[] = [];

export function diagnoseTekst(d: ZoekDiagnose[]) {
  const per = new Map<string, { geblokkeerd: number; resultaten: number; keer: number }>();
  d.forEach((x) => {
    const v = per.get(x.zoekmachine) ?? { geblokkeerd: 0, resultaten: 0, keer: 0 };
    v.keer++;
    v.resultaten += x.resultaten;
    if (x.geblokkeerd) v.geblokkeerd++;
    per.set(x.zoekmachine, v);
  });
  return Array.from(per.entries()).map(([n, v]) => `${n}: ${v.geblokkeerd ? `geweigerd of geblokkeerd (${v.geblokkeerd}×)` : `${v.resultaten} resultaten`}`).join(", ");
}

export function leesBedrijfsgegevens(tekst: string, html: string, url: string) {
  const titel = html.match(/<title[^>]*>([^<]{2,120})<\/title>/i)?.[1]?.split(/[|\-–•]/)[0].trim();
  const kvk = tekst.match(/k\.?v\.?k\.?(?:[- ]?nummer)?[:\s]*(\d{8})\b/i)?.[1];
  const plaats = tekst.match(/\b\d{4}\s?[A-Z]{2}\s+([A-Z][a-zA-Z'\- ]{2,30}?)(?=[\s,.]|$)/)?.[1]?.trim();
  const meta = html.match(/<meta[^>]+name="description"[^>]+content="([^"]{20,400})"/i)?.[1];
  const profiel = (meta ?? tekst.slice(0, 600)).replace(/\s+/g, " ").trim();
  return { naam: titel || new URL(url).hostname.replace(/^www\./, ""), kvk, plaats, profiel };
}

export const webzoekConnector: BronConnector = {
  naam: "Webzoek (bedrijfswebsites)",
  omschrijving: "Zoekt bedrijfswebsites (DuckDuckGo, anders Bing) op branchetermen, trefwoorden en regio en leest naam, KVK-nummer, plaats en profieltekst van de site.",
  async zoek(vraag) {
    const resultaten: Awaited<ReturnType<BronConnector["zoek"]>> = [];
    const gezien = new Set<string>();
    const diagnose: ZoekDiagnose[] = [];
    const extra = vraag.trefwoorden.filter((w) => w.length > 4).slice(0, 3).join(" ");
    for (const rol of vraag.rollen) {
      for (const term of TERMEN[rol]) {
        const zoekterm = `${term} ${extra} ${vraag.regio ?? ""}`.replace(/\s+/g, " ").trim();
        const r = await zoekUrlsMetDiagnose(zoekterm);
        diagnose.push(...r.diagnose);
        const nieuw = r.urls.filter((u) => !gezien.has(u));
        nieuw.forEach((u) => gezien.add(u));
        const gelezen = await Promise.all(nieuw.map((u) => kandidaatVanWebsite(u, rol, "Webzoek", zoekterm, vraag.regio)));
        gelezen.forEach((k) => k && resultaten.push(k));
      }
    }
    laatsteZoekDiagnose = diagnose;
    return resultaten;
  }
};

/** US-55: kandidaten voor een lijst gerichte zoekvragen (AI of regels), met de zoekvraag als herkomst. */
export async function zoekMetVragen(vragen: Array<{ vraag: string; rol: Rol }>, maxPerVraag = 5, maxTotaal = 12): Promise<Array<Awaited<ReturnType<BronConnector["zoek"]>>[number] & { zoekvraag: string }>> {
  const uit: Array<Awaited<ReturnType<BronConnector["zoek"]>>[number] & { zoekvraag: string }> = [];
  const gezien = new Set<string>();
  const diagnose: ZoekDiagnose[] = [];
  for (const { vraag, rol } of vragen) {
    if (uit.length >= maxTotaal) break;
    const r = await zoekUrlsMetDiagnose(vraag, maxPerVraag);
    diagnose.push(...r.diagnose);
    const nieuw = r.urls.filter((u) => !gezien.has(u));
    nieuw.forEach((u) => gezien.add(u));
    const gelezen = await Promise.all(nieuw.map((u) => kandidaatVanWebsite(u, rol, "Open web (zoekmachine)", vraag)));
    gelezen.forEach((k) => k && uit.length < maxTotaal && uit.push({ ...k, zoekvraag: vraag }));
  }
  laatsteZoekDiagnose = diagnose;
  return uit;
}
