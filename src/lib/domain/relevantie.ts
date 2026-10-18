// Discovery: is een gevonden website een mogelijke bouwpartner voor Blauwhoed (woningontwikkelaar), of iets anders
// (woningportaal, makelaar, nieuwssite, overheid, webwinkel, vacaturesite)? Regelgebaseerd, zonder AI; met AI volgt
// daarna nog een inhoudelijke toets op het profiel van Blauwhoed en het project.
import type { Project, Projecttype, Rol } from "./types";

/** Korte typering van de opdrachtgever, voor zoekvragen en de AI-toets. */
export const BLAUWHOED_PROFIEL =
  "Blauwhoed is een Nederlandse woningontwikkelaar: nieuwbouw van grondgebonden woningen en appartementen, transformatie en gebiedsontwikkeling, met aandacht voor duurzaam en houtbouw. Partners zijn bedrijven die voor zulke projecten ontwerpen, adviseren, bouwen, installeren of bouwdelen leveren.";

/** Domeinen die nooit een bouwpartner zijn: woningportalen, media, overheid, onderwijs, webwinkels, gidsen en platforms. */
const GEEN_PARTNER_HOST =
  /(^|\.)(funda|pararius|jaap|huislijn|huizenzoeker|wozwaardeloket|woz-waardeloket|wozwaarde|wozwaarderapport|woningstats|wambla|woningwaarde[a-z]*|huizenprijzen|woningmarktcijfers|calcasa|matrixian|brainbay|walterliving|altum[a-z]*|woningwaardecheck|watiszijnhuiswaard|watismijnhuiswaard|mijnwoningwaarde|nieuwbouw-nederland|nieuwbouw-in-[a-z-]+|nieuwbouwprojecten|nieuwbouwwoningen|woningnet|wooniezie|woonnet-haaglanden|kamernet|huurwoningen|directwonen|rentola|huurstunt|huurzone|woonmatch|klikvoorwonen|hypotheker|independer|homedeal|werkspot|offerte|offertevergelijker|zoofy|trustoo|vergelijk|bouwkosten|bouwinfo|bouwgarant|woningborg|swk|cobouw|bouwwereld|vastgoedmarkt|architectenweb|nos|nu|ad|telegraaf|volkskrant|nrc|trouw|parool|rtlnieuws|omroep[a-z]*|dichtbij|indebuurt|wikipedia|linkedin|facebook|instagram|youtube|tiktok|twitter|x|pinterest|indeed|werkzoeken|nationalevacaturebank|jobbird|marktplaats|bol|amazon|gamma|praxis|karwei|hornbach|bouwmaat|kvk|google|bing|duckduckgo|telefoonboek|openingstijden|drimble|cylex|trustpilot|glassdoor|yelp|archdaily|dezeen|slideshare|scribd|issuu|prospeo|rocketreach|zoominfo|apollo|dnb|crunchbase|bedrijfsdata|companyinfo|oozo|ted|tenderned|reddit|stackoverflow|blauwhoed)\.[a-z.]+$/i;
const GEEN_PARTNER_TLD = /(\.gov\.|\.overheid\.nl$|^gemeente|\.gemeente\.|^www\.gemeente|provincie|rijksoverheid|\.edu$|universiteit|hogeschool|tudelft|tue\.nl$|wur\.nl$)/i;

/** Tekst die op een consumentenportaal of makelaar wijst (woningaanbod voor kopers en huurders). */
const PORTAAL_SIGNALEN: Array<[string, RegExp]> = [
  ["vraagprijs", /vraagprijs/i],
  ["huurprijs", /huurprijs|per maand|p\.\s?m\./i],
  ["k.k./v.o.n.", /\bk\.k\.|\bv\.o\.n\./i],
  ["woningaanbod", /woningaanbod|aanbod (koop|huur)woningen|alle (koop|huur)?woningen|bekijk (alle )?woningen/i],
  ["woning zoeken", /zoek(t|en)? (je|uw|een) (nieuwe )?(huis|woning|huurwoning|koopwoning)|woningzoekende/i],
  ["bezichtiging", /bezichtig/i],
  ["makelaar", /makelaar|aankoopmakelaar|verkoopmakelaar|nvm/i],
  ["hypotheek", /hypothe(ek|ken)|maandlasten/i],
  ["zoekopdracht bewaren", /bewaar (je )?zoekopdracht|favorieten|zoekopdracht opslaan/i],
  ["WOZ/woningwaarde", /woz[- ]?waarde|woningwaarde|wat is (mijn|je|uw) (huis|woning) waard|waardebepaling (woning|huis)|huizenprijzen|woningmarktcijfers/i]
];

/** Beveiligings- of botcontrolepagina (Cloudflare e.d.) of een lege/onleesbare pagina: geen bruikbaar bedrijfsprofiel. */
const BOT_CONTROLE = /(security verification|even geduld a\.?u\.?b|just a moment|checking your browser|verifi(e|ë)er dat je (een )?mens|are you (a )?human|i'?m not a robot|recaptcha|captcha|cloudflare|ddos protection|request blocked|access denied|403 forbidden|enable javascript to|schakel javascript in)/i;

/** Tekst die op een gemeente of andere overheid wijst (hun domein is vaak gewoon de plaatsnaam, zoals utrecht.nl). */
const OVERHEID_SIGNALEN = /(burgerzaken|paspoort|rijbewijs|afvalkalender|gemeenteraad|raadsvergadering|college van b(urgemeester )?(en|&) w|omgevingsvergunning aanvragen|melding openbare ruimte|wethouder)/gi;

/** Tekst die op een bedrijf in de bouwketen wijst. */
const SECTOR_SIGNALEN: Array<[string, RegExp]> = [
  ["woningbouw", /woningbouw|woningen gebouwd|nieuwbouwwoningen gerealiseerd/i],
  ["projecten/referenties", /onze projecten|referenties|referentieprojecten|portfolio|opgeleverd|oplevering/i],
  ["opdrachtgevers", /opdrachtgever|ontwikkelaars?|woningcorporatie|bouwteam/i],
  ["bouwproces", /bouwproces|uitvoering|bouwplaats|bouwkundig|bestek|aanbesteding/i],
  ["bouwtypen", /appartementen|grondgebonden|hoogbouw|transformatie|utiliteitsbouw|renovatie/i]
];

const ROL_SIGNALEN: Record<Rol, RegExp[]> = {
  aannemer: [/aannemer/i, /bouwbedrijf|bouwonderneming|bouwgroep|bouwcombinatie/i, /hoofdaannemer|bouwteam/i, /nieuwbouw/i],
  houtbouwer: [/houtbouw/i, /\bclt\b|kruislaaghout/i, /houtskeletbouw|\bhsb\b/i, /houtconstructie|timmerfabriek|biobased/i],
  constructeur: [/constructeur/i, /constructie(f|ve)? ?(advies|ontwerp|berekening)/i, /ingenieursbureau/i, /draagconstructie|sterkteberekening/i],
  architect: [/architect/i, /architectuur/i, /ontwerpbureau|stedenbouw/i, /ontwerp(en)? van woningen|woningontwerp/i],
  installateur: [/installateur|installatiebedrijf/i, /installatietechniek|e- en w-installatie|elektrotechniek/i, /warmtepomp|klimaatinstallatie|ventilatie/i, /duurzame energie|zonnepanelen/i],
  adviseur: [/adviesbureau|advies/i, /bouwfysica|akoestiek|duurzaamheidsadvies/i, /bouwmanagement|projectmanagement|kostendeskundig/i, /\bbeng\b|\bmpg\b|epc/i],
  leverancier: [/leverancier|levering/i, /producent|fabrikant|productie/i, /prefab|bouwelementen|gevelelementen|kozijnen/i, /fabriek/i],
  ontwikkelpartner: [/ontwikkelende bouwer/i, /projectontwikkel/i, /gebiedsontwikkel/i, /conceptbouw|ontwikkelen en bouwen/i]
};

export type Relevantie = {
  relevant: boolean;
  /** 0–100: hoe duidelijk de site een bouwpartner in de gevraagde rol is. */
  score: number;
  /** Waarom wel of niet, in gewone taal. */
  reden: string;
  soort: "bouwpartner" | "uitgesloten domein" | "woningportaal of makelaar" | "geen bouwbedrijf" | "andere rol";
  /** De gevraagde rol met de meeste aanwijzingen (alleen bij een bouwpartner). */
  rol?: Rol;
};

function hostVan(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/** Domein dat nooit een bouwpartner is (portaal, media, overheid, platform). */
export function isUitgeslotenDomein(url: string) {
  const host = hostVan(url);
  return !host || GEEN_PARTNER_HOST.test(host) || GEEN_PARTNER_TLD.test(host);
}

const treffers = (lijst: Array<[string, RegExp]>, tekst: string) => lijst.filter(([, r]) => r.test(tekst)).map(([n]) => n);

/** Regeltoets: is deze website een mogelijke bouwpartner in (een van) de gevraagde rollen? */
export function beoordeelRelevantie(url: string, tekst: string, rollen: Rol[]): Relevantie {
  if (isUitgeslotenDomein(url)) return { relevant: false, score: 0, reden: `${hostVan(url) || url} is een portaal, medium, overheid of platform, geen bedrijf in de bouwketen.`, soort: "uitgesloten domein" };
  const t = tekst.slice(0, 15000);
  // Beveiligings-/botcontrolepagina of een (vrijwel) lege pagina levert geen bedrijfsprofiel op: nooit een kandidaat.
  if (BOT_CONTROLE.test(t) || t.replace(/\s+/g, "").length < 120)
    return { relevant: false, score: 0, reden: "De pagina kon niet worden gelezen (beveiligings- of botcontrole, of (vrijwel) leeg), geen bruikbaar bedrijfsprofiel.", soort: "uitgesloten domein" };
  const overheid = new Set((t.match(OVERHEID_SIGNALEN) ?? []).map((w) => w.toLowerCase()));
  if (overheid.size >= 2) return { relevant: false, score: 0, reden: `Lijkt een gemeente of andere overheid (${Array.from(overheid).slice(0, 3).join(", ")}), geen bouwpartner.`, soort: "uitgesloten domein" };
  const portaal = treffers(PORTAAL_SIGNALEN, t);
  const sector = treffers(SECTOR_SIGNALEN, t);
  const perRol = rollen.map((r) => ({ r, n: ROL_SIGNALEN[r].filter((x) => x.test(t)).length }));
  const besteRol = perRol.sort((a, b) => b.n - a.n)[0];
  const rolTreffers = besteRol?.n ?? 0;
  // Ook een ontwikkelaar of aannemer toont eigen woningen te koop; pas bij veel portaalsignalen en weinig bouwsignalen is het een portaal.
  if (portaal.length >= 3 && rolTreffers + sector.length < 4) return { relevant: false, score: 5, reden: `Lijkt een woningportaal of makelaar (${portaal.join(", ")}), geen bouwpartner.`, soort: "woningportaal of makelaar" };
  if (!sector.length && rolTreffers < 2) return { relevant: false, score: 10, reden: "Geen aanwijzingen voor een bedrijf in de woningbouw (geen projecten, opdrachtgevers of bouwtermen op de site).", soort: "geen bouwbedrijf" };
  if (!rolTreffers) return { relevant: false, score: 20, reden: `Bouwgerelateerd, maar geen aanwijzing voor de gevraagde rol (${rollen.join(", ")}).`, soort: "andere rol" };
  const score = Math.min(100, 25 + rolTreffers * 15 + sector.length * 8 - portaal.length * 5);
  return { relevant: true, score, reden: `Aanwijzingen voor ${besteRol.r}: ${rolTreffers} rolkenmerk(en); bouwketen: ${sector.join(", ") || "–"}.`, soort: "bouwpartner", rol: besteRol.r };
}

const TYPE_TERM: Record<Projecttype, string> = {
  grondgebonden: "grondgebonden woningbouw",
  appartementen: "appartementenbouw",
  hoogbouw: "hoogbouw woningen",
  transformatie: "transformatie herbestemming",
  zorgwonen: "zorgwoningen",
  gebiedsontwikkeling: "gebiedsontwikkeling"
};

const VAKTERMEN = /\b(houtbouw|clt|hsb|houtskeletbouw|biobased|circulair|natuurinclusief|prefab|modulair|industrieel bouwen|gasloos|energieneutraal|nul-op-de-meter|paris proof|monument|herbestemming)\b/gi;

/**
 * Zoektermen voor een project: het projecttype en de vaktermen uit de omschrijving. Niet de omschrijving zelf: woorden als
 * 'nieuwbouw', 'appartementen' en een plaatsnaam leveren vooral woningportalen (funda e.d.) op in plaats van bouwpartners.
 */
export function zoektermenVoorProject(project: Pick<Project, "type" | "omschrijving">) {
  const vak = Array.from(new Set((project.omschrijving.match(VAKTERMEN) ?? []).map((w) => w.toLowerCase())));
  return [TYPE_TERM[project.type], ...vak].filter(Boolean).join(" ");
}
