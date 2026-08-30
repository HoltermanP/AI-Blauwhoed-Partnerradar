// Epic 6: verrijking en AI-extractie. Uitsluitend openbare bronnen; extracties krijgen bron `web` met lage betrouwbaarheid.
// US-30: claims worden gesplitst in aantoonbaar (certificaat, meting, MPG-score) en geclaimd (marketingtekst).
import type { EnrichmentVoorstel, FactorWaarde, Partner } from "./types";

type Regel = { factorId: string; optieId?: string; patroon: RegExp; waarde: (m: RegExpMatchArray) => FactorWaarde; aantoonbaar: (m: RegExpMatchArray, context: string) => boolean; veld: string };

const AANTOONBAAR_WOORDEN = /(certificaat|gecertificeerd|iso|nmd|berekening|gemeten|meting|rapport|opgeleverd|gerealiseerd|niveau\s?[1-5]|\d+[.,]\d+)/i;

const REGELS: Regel[] = [
  { factorId: "mpg", veld: "MPG-score", patroon: /mpg[^0-9]{0,30}(0[.,]\d{1,2})/i, waarde: (m) => Number(m[1].replace(",", ".")), aantoonbaar: (_m, ctx) => /(berekening|nmd|gerealiseerd|opgeleverd|gemeten)/i.test(ctx), },
  { factorId: "beng", veld: "BENG-2", patroon: /beng[^0-9]{0,40}(\d{1,3})\s?kwh/i, waarde: (m) => Number(m[1]), aantoonbaar: (_m, ctx) => /(gemeten|opgeleverd|rapport)/i.test(ctx) },
  { factorId: "biobased", veld: "Aandeel biobased", patroon: /(\d{1,3})\s?%\s?(biobased|bio-based)/i, waarde: (m) => Number(m[1]), aantoonbaar: (_m, ctx) => /(berekening|materialenpaspoort|rapport)/i.test(ctx) },
  { factorId: "co2_ladder", veld: "CO2-prestatieladder", patroon: /co2[- ]?prestatieladder[^0-9]{0,20}(niveau|trede)?\s?([1-5])/i, waarde: (m) => Number(m[2]), aantoonbaar: () => true },
  { factorId: "bouwsysteem", optieId: "houtbouw", veld: "Bouwsysteem: houtbouw", patroon: /(clt|kruislaaghout|houtskeletbouw|houtbouw|hsb)/i, waarde: () => 3, aantoonbaar: (_m, ctx) => /(opgeleverd|gerealiseerd|referentie)/i.test(ctx) },
  { factorId: "bouwsysteem", optieId: "prefab_beton", veld: "Bouwsysteem: prefab beton", patroon: /prefab\s?beton/i, waarde: () => 3, aantoonbaar: (_m, ctx) => /(opgeleverd|gerealiseerd|referentie)/i.test(ctx) },
  { factorId: "prefabricage", veld: "Prefabricagegraad", patroon: /(modulair|fabrieksmatig|prefab|industrieel bouwen)/i, waarde: () => 3, aantoonbaar: (_m, ctx) => /(\d{2,3}\s?%|fabriek)/i.test(ctx) },
  { factorId: "demontabel", veld: "Demontabel bouwen", patroon: /(demontabel|remontabel|losmaakbaar)/i, waarde: () => 3, aantoonbaar: (_m, ctx) => /(materialenpaspoort|madaster|losmaakbaarheidsindex)/i.test(ctx) },
  { factorId: "circulariteit", veld: "Circulariteit", patroon: /(circulair|materialenpaspoort|madaster)/i, waarde: () => 3, aantoonbaar: (_m, ctx) => /(materialenpaspoort|madaster|gerealiseerd)/i.test(ctx) },
  { factorId: "natuurinclusief", veld: "Natuurinclusief", patroon: /(natuurinclusief|klimaatadaptief|biodiversiteit)/i, waarde: () => 3, aantoonbaar: (_m, ctx) => /(gerealiseerd|opgeleverd|scan|rapport)/i.test(ctx) },
  { factorId: "bim", veld: "BIM-niveau", patroon: /bim[^0-9]{0,15}(niveau|level)\s?([0-3])/i, waarde: (m) => Number(m[2]) + 1, aantoonbaar: (_m, ctx) => /(certificaat|protocol|ilS)/i.test(ctx) },
  { factorId: "projecttype", optieId: "hoogbouw", veld: "Projecttype: hoogbouw", patroon: /(hoogbouw|woontoren)/i, waarde: () => 3, aantoonbaar: (_m, ctx) => /(opgeleverd|gerealiseerd|referentie)/i.test(ctx) },
  { factorId: "projecttype", optieId: "transformatie", veld: "Projecttype: transformatie", patroon: /(transformatie|herbestemming)/i, waarde: () => 3, aantoonbaar: (_m, ctx) => /(opgeleverd|gerealiseerd|referentie)/i.test(ctx) },
  { factorId: "projecttype", optieId: "zorgwonen", veld: "Projecttype: zorgwonen", patroon: /(zorgwon|zorgcomplex|seniorenwon)/i, waarde: () => 3, aantoonbaar: (_m, ctx) => /(opgeleverd|gerealiseerd|referentie)/i.test(ctx) }
];

const MARKETING = /(duurzaamste|groenste|toonaangevend|marktleider|innovatief|vooruitstrevend|100% duurzaam|klimaatneutraal bedrijf)/i;

export function striptHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extraheer factorvoorstellen uit openbare tekst volgens de taxonomie. */
export function extraheerVoorstellen(partner: Partner, tekst: string, bronUrl: string, nu = new Date()): EnrichmentVoorstel[] {
  const voorstellen: EnrichmentVoorstel[] = [];
  REGELS.forEach((regel) => {
    const m = tekst.match(regel.patroon);
    if (!m || m.index === undefined) return;
    const context = tekst.slice(Math.max(0, m.index - 120), m.index + m[0].length + 120);
    const aantoonbaar = regel.aantoonbaar(m, context) && AANTOONBAAR_WOORDEN.test(context);
    const isMarketing = MARKETING.test(context);
    const huidig = partner.factoren.find((f) => f.factorId === regel.factorId && (regel.optieId ? f.optieId === regel.optieId : !f.optieId));
    const voorgesteld = regel.waarde(m);
    if (huidig && JSON.stringify(huidig.waarde) === JSON.stringify(voorgesteld)) return;
    voorstellen.push({
      id: `ev-${partner.id}-${regel.factorId}-${regel.optieId ?? ""}-${nu.getTime().toString(36)}`,
      partnerId: partner.id,
      factorId: regel.factorId,
      veld: regel.veld,
      huidig: huidig?.waarde ?? null,
      voorgesteld,
      bron: "web",
      bronUrl,
      betrouwbaarheid: aantoonbaar ? 0.55 : isMarketing ? 0.2 : 0.35,
      soort: aantoonbaar ? "aantoonbaar" : "geclaimd",
      citaat: `…${context.trim()}…`,
      status: "open",
      gevondenOp: nu.toISOString()
    });
  });
  return voorstellen;
}

/** US-30: splits duurzaamheidsclaims in een tekst. */
export function splitsClaims(tekst: string) {
  const zinnen = tekst.split(/(?<=[.!?])\s+/).filter((z) => /(duurza|circul|biobased|mpg|beng|co2|energie|klimaat|natuur|groen|hout)/i.test(z));
  return {
    aantoonbaar: zinnen.filter((z) => AANTOONBAAR_WOORDEN.test(z) && !MARKETING.test(z)),
    geclaimd: zinnen.filter((z) => !AANTOONBAAR_WOORDEN.test(z) || MARKETING.test(z))
  };
}

/** Haal openbare websitetekst op (alleen als externe bronnen zijn toegestaan). Faalt stil met null. */
export async function haalWebsiteOp(url: string, timeoutMs = 6000): Promise<string | null> {
  if (!/^https?:\/\//.test(url)) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctrl.signal, headers: { "user-agent": "BlauwhoedPartnerRadar/1.0 (verrijking; alleen openbare bedrijfsinformatie)" } });
    clearTimeout(t);
    if (!res.ok) return null;
    const html = await res.text();
    return striptHtml(html).slice(0, 20000);
  } catch {
    return null;
  }
}
