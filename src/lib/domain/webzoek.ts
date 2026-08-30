// Keyless webconnector voor discovery (US-24): zoekt via DuckDuckGo (HTML-endpoint) naar bedrijfswebsites op branchetermen,
// haalt de website op en leest bedrijfsnaam, KVK-nummer (als dat op de site staat), plaats en profieltekst.
// Alleen openbare bedrijfsinformatie. Zoekmachines wijzigen hun HTML; bij falen levert deze connector gewoon niets.
import type { BronConnector } from "./discovery";
import { haalWebsiteOp } from "./enrichment";
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

async function zoekUrls(query: string, max = 8): Promise<string[]> {
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=nl-nl`, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; BlauwhoedPartnerRadar/1.0; alleen openbare bedrijfsinformatie)", accept: "text/html" },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return [];
    const html = await res.text();
    const urls = new Set<string>();
    for (const m of html.matchAll(/class="result__a"[^>]*href="([^"]+)"/g)) {
      let u = m[1];
      const uddg = u.match(/[?&]uddg=([^&]+)/);
      if (uddg) u = decodeURIComponent(uddg[1]);
      if (!/^https?:\/\//.test(u) || UITSLUITEN.test(u)) continue;
      const host = new URL(u).origin;
      urls.add(host);
      if (urls.size >= max) break;
    }
    return Array.from(urls);
  } catch {
    return [];
  }
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
  omschrijving: "Zoekt bedrijfswebsites op branchetermen, trefwoorden en regio en leest naam, KVK-nummer, plaats en profieltekst van de site.",
  async zoek(vraag) {
    const resultaten: Awaited<ReturnType<BronConnector["zoek"]>> = [];
    const gezien = new Set<string>();
    const extra = vraag.trefwoorden.filter((w) => w.length > 4).slice(0, 3).join(" ");
    for (const rol of vraag.rollen) {
      for (const term of TERMEN[rol]) {
        const urls = await zoekUrls(`${term} ${extra} ${vraag.regio ?? ""}`.trim());
        for (const url of urls) {
          if (gezien.has(url)) continue;
          gezien.add(url);
          const html = await (async () => {
            try {
              const r = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { "user-agent": "BlauwhoedPartnerRadar/1.0 (discovery; alleen openbare bedrijfsinformatie)" } });
              return r.ok ? await r.text() : null;
            } catch {
              return null;
            }
          })();
          if (!html) continue;
          const tekst = (await haalWebsiteOp(url)) ?? "";
          const b = leesBedrijfsgegevens(tekst, html, url);
          resultaten.push({
            naam: b.naam,
            kvk: b.kvk,
            vestigingsplaats: b.plaats ?? vraag.regio,
            website: url,
            rollen: [rol],
            bron: "Webzoek",
            bronUrl: url,
            ruweData: { profiel: b.profiel, referenties: [], zoekterm: `${term} ${extra}`.trim(), websiteTekst: tekst.slice(0, 8000) }
          } as Awaited<ReturnType<BronConnector["zoek"]>>[number]);
        }
      }
    }
    return resultaten;
  }
};
