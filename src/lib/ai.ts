// Claude-integratie (optioneel). Actief zodra ANTHROPIC_API_KEY is gezet. Er gaan uitsluitend openbare bedrijfs- en
// projectteksten naar het model, nooit contactpersonen (US-48). Zonder sleutel vallen alle aanroepen terug op regels.
// US-59: per functie (extractie, chat, match, verband, aandragen) een instelbaar model — het lichtste passende model.
// US-58: kosten in euro tegen de rekenprijzen uit de instellingen; één handeling = één bewerking.
import { AsyncLocalStorage } from "node:async_hooks";
import Anthropic from "@anthropic-ai/sdk";
import { aiBudget, kostenEur, modelVoor, STANDAARD_BUDGET, STANDAARD_MODELLEN } from "./domain/kosten";
import { getDb, registreerAIBewerking } from "./store";
import type { AIBewerking, AIBudget, AIFunctie, AISamenvatting, Bron, DiscoveryCandidate, Factor, Project } from "./domain/types";

// ---------- Kostenregistratie: één gebruikershandeling = één bewerking, met daaronder de losse modelaanroepen. ----------
type Context = { bewerking: AIBewerking; budget: AIBudget; modellen: Record<AIFunctie, string>; doel?: string };
const bewerkingContext = new AsyncLocalStorage<Context>();
let doelContext = "";

/**
 * Voer een gebruikershandeling uit als AI-bewerking: alle modelaanroepen binnen `fn` worden eraan gekoppeld
 * (tokens, kosten, tijdstip). De bewerking wordt alleen opgeslagen als er daadwerkelijk aanroepen waren
 * (zonder extern taalmodel is het geen AI-bewerking, art. 8).
 */
export async function alsAIBewerking<T>(soort: AIBewerking["soort"], door: string, omschrijving: string, fn: () => Promise<T>, functie?: AIFunctie): Promise<T> {
  const bestaand = bewerkingContext.getStore();
  if (bestaand) return fn(); // al binnen een bewerking: niet dubbel tellen
  const db = await getDb();
  const bewerking: AIBewerking = { id: `aib-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, soort, functie, omschrijving, door, op: new Date().toISOString(), aanroepen: [], invoerTokens: 0, uitvoerTokens: 0, kostenEur: 0 };
  try {
    return await bewerkingContext.run({ bewerking, budget: aiBudget(db), modellen: { ...STANDAARD_MODELLEN, ...(db.instellingen.modellen ?? {}) } }, fn);
  } finally {
    if (bewerking.aanroepen.length) await registreerAIBewerking(bewerking);
  }
}

/** Benoem het doel van de eerstvolgende aanroep(en) binnen de lopende bewerking (voor de administratie). */
export function zetAanroepDoel(doel: string) {
  // Per bewerking (AsyncLocalStorage), zodat gelijktijdige verzoeken elkaars label niet overschrijven.
  const ctx = bewerkingContext.getStore();
  if (ctx) ctx.doel = doel;
  else doelContext = doel;
}

function registreerAanroep(model: string, invoerTokens: number, uitvoerTokens: number) {
  const ctx = bewerkingContext.getStore();
  const budget = ctx?.budget ?? STANDAARD_BUDGET;
  const aanroep = { model, doel: ctx?.doel || doelContext || "aanroep", invoerTokens, uitvoerTokens, kostenEur: kostenEur(invoerTokens, uitvoerTokens, budget), op: new Date().toISOString() };
  if (!ctx) {
    // Losse aanroep buiten een handeling: registreer als eigen bewerking zodat niets buiten de administratie valt.
    void registreerAIBewerking({ id: `aib-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, soort: "overig", omschrijving: aanroep.doel, door: "systeem", op: aanroep.op, aanroepen: [aanroep], invoerTokens, uitvoerTokens, kostenEur: aanroep.kostenEur });
    return;
  }
  const b = ctx.bewerking;
  b.aanroepen.push(aanroep);
  b.invoerTokens += invoerTokens;
  b.uitvoerTokens += uitvoerTokens;
  b.kostenEur += aanroep.kostenEur;
}

export function aiBeschikbaar() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

/** Het model voor een functie: uit de lopende bewerking, anders uit de instellingen. */
async function modelVoorFunctie(functie: AIFunctie) {
  return bewerkingContext.getStore()?.modellen[functie] ?? modelVoor(await getDb(), functie);
}

/** Leesbare providernaam voor herkomstvermelding. */
export async function providerLabel(functie: AIFunctie) {
  return `Claude (${await modelVoorFunctie(functie)})`;
}

async function jsonAntwoord<T>(functie: AIFunctie, system: string, prompt: string, schema: Record<string, unknown>): Promise<T | null> {
  if (!aiBeschikbaar()) return null;
  try {
    const model = await modelVoorFunctie(functie);
    // Haiku 4.5 kent geen effort-parameter; de zwaardere modellen draaien op 'medium' (voldoende voor dit werk, lager verbruik).
    const effort = model.startsWith("claude-haiku") ? {} : { effort: "medium" as const };
    const res = await getClient().messages.create({
      model,
      max_tokens: 4000,
      system,
      output_config: { ...effort, format: { type: "json_schema", schema } },
      messages: [{ role: "user", content: prompt }]
    });
    registreerAanroep(model, res.usage.input_tokens, res.usage.output_tokens);
    if (res.stop_reason === "refusal") return null;
    const tekst = res.content.find((b) => b.type === "text");
    return tekst && tekst.type === "text" ? (JSON.parse(tekst.text) as T) : null;
  } catch (e) {
    console.warn("Claude-aanroep mislukt:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** US-27: samenvatting van een prospect op basis van openbare tekst. */
export async function aiSamenvatting(kandidaat: DiscoveryCandidate, project: Project | undefined, openbareTekst: string): Promise<AISamenvatting | null> {
  const r = await jsonAntwoord<{ watDoetHetBedrijf: string; referentieprojecten: string[]; waaromPastHet: string; watIsOnzeker: string[] }>(
    "aandragen",
    "Je bent inkoopanalist bij een Nederlandse woningontwikkelaar. Vat een mogelijke bouwpartner feitelijk en kort samen in het Nederlands. Onderscheid aantoonbare feiten (certificaten, opgeleverde projecten, metingen) van marketingclaims; noem claims als onzeker. Gebruik alleen de aangeleverde tekst, verzin niets.",
    `Bedrijf: ${kandidaat.naam} (${kandidaat.rollen.join(", ")}), ${kandidaat.vestigingsplaats ?? "plaats onbekend"}.\n${project ? `Project waarvoor gezocht wordt: ${project.naam} — ${project.type}, ${project.woningen} woningen, ${project.locatie.plaats}. ${project.omschrijving}\n` : ""}\nOpenbare tekst over het bedrijf:\n${openbareTekst.slice(0, 12000)}`,
    {
      type: "object",
      additionalProperties: false,
      required: ["watDoetHetBedrijf", "referentieprojecten", "waaromPastHet", "watIsOnzeker"],
      properties: {
        watDoetHetBedrijf: { type: "string" },
        referentieprojecten: { type: "array", items: { type: "string" } },
        waaromPastHet: { type: "string" },
        watIsOnzeker: { type: "array", items: { type: "string" } }
      }
    }
  );
  if (!r) return null;
  return { ...r, gegenereerdOp: new Date().toISOString(), provider: await providerLabel("aandragen") };
}

export type AIFactorVoorstel = { factorId: string; optieId?: string; waarde: number | string | boolean; citaat: string; aantoonbaar: boolean };

/** US-29/30: factorwaarden uit openbare tekst volgens de taxonomie, met citaat en aantoonbaar/geclaimd. */
export async function aiFactorExtractie(naam: string, tekst: string, factoren: Factor[]): Promise<AIFactorVoorstel[] | null> {
  const taxonomie = factoren
    .filter((f) => f.actief && f.type !== "semantisch" && !f.afgeleid)
    .map((f) => `- ${f.id}: ${f.naam} (${f.schaal.soort}${"eenheid" in f.schaal ? `, ${f.schaal.eenheid}` : ""})${f.opties?.length ? ` opties: ${f.opties.map((o) => o.id).join("|")}` : ""}`)
    .join("\n");
  const r = await jsonAntwoord<{ voorstellen: AIFactorVoorstel[] }>(
    "extractie",
    "Je extraheert kenmerken van een bouwpartner uit openbare tekst volgens een vaste taxonomie. Geef alleen kenmerken die letterlijk uit de tekst volgen, met een kort citaat. Bij twijfel vul je niets in: een ontbrekend kenmerk is beter dan een onzekere waarde (het veld wordt dan gemarkeerd als 'geen betrouwbare bron'). 'aantoonbaar' is true alleen bij certificaat, meting, berekening of concreet opgeleverd project; marketingtaal is niet aantoonbaar. Niveau-schalen zijn 0–5 (3 = aantoonbare ervaring, 4–5 = specialisme). Schrijf in het Nederlands.",
    `Bedrijf: ${naam}\n\nTaxonomie:\n${taxonomie}\n\nTekst:\n${tekst.slice(0, 20000)}`,
    {
      type: "object",
      additionalProperties: false,
      required: ["voorstellen"],
      properties: {
        voorstellen: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["factorId", "waarde", "citaat", "aantoonbaar"],
            properties: {
              factorId: { type: "string" },
              optieId: { type: "string" },
              waarde: { anyOf: [{ type: "number" }, { type: "string" }, { type: "boolean" }] },
              citaat: { type: "string" },
              aantoonbaar: { type: "boolean" }
            }
          }
        }
      }
    }
  );
  return r?.voorstellen.filter((v) => factoren.some((f) => f.id === v.factorId)) ?? null;
}

export type AIProjectExtractie = {
  naam?: string;
  type?: string;
  plaats?: string;
  woningen?: number;
  prijssegment?: string[];
  bouwstijl?: string;
  ambitieDuurzaamheid?: number;
  start?: string;
  eind?: string;
  omschrijving?: string;
  herkomst: Array<{ veld: string; citaat: string; betrouwbaarheid: number }>;
};

/** US-11: projectprofiel uit een projectdocument of programma van eisen. */
export async function aiProjectExtractie(tekst: string): Promise<AIProjectExtractie | null> {
  return jsonAntwoord<AIProjectExtractie>(
    "extractie",
    "Je leest een Nederlands projectdocument of programma van eisen van een woningontwikkelaar en vult een projectprofiel voor. Geef per veld een citaat uit het document (herkomst) en een betrouwbaarheid 0–1. Laat velden weg die niet in het document staan. type ∈ grondgebonden|appartementen|hoogbouw|transformatie|zorgwonen|gebiedsontwikkeling; prijssegment ⊆ sociaal|middenhuur|koop|vrije sector; bouwstijl ∈ traditioneel|modern|industrieel|dorps|hoogstedelijk; ambitieDuurzaamheid 1–5; datums als YYYY-MM-DD; omschrijving is een feitelijke samenvatting van maximaal 600 tekens.",
    tekst.slice(0, 60000),
    {
      type: "object",
      additionalProperties: false,
      required: ["herkomst"],
      properties: {
        naam: { type: "string" },
        type: { type: "string" },
        plaats: { type: "string" },
        woningen: { type: "integer" },
        prijssegment: { type: "array", items: { type: "string" } },
        bouwstijl: { type: "string" },
        ambitieDuurzaamheid: { type: "integer" },
        start: { type: "string" },
        eind: { type: "string" },
        omschrijving: { type: "string" },
        herkomst: {
          type: "array",
          items: { type: "object", additionalProperties: false, required: ["veld", "citaat", "betrouwbaarheid"], properties: { veld: { type: "string" }, citaat: { type: "string" }, betrouwbaarheid: { type: "number" } } }
        }
      }
    }
  );
}

export type AIPartnerRegistratie = {
  naam?: string;
  kvk?: string;
  rechtsvorm?: string;
  vestigingsplaats?: string;
  adres?: string;
  rollen: string[];
  website?: string;
  omschrijving?: string;
  referenties: string[];
  medewerkers?: number;
  herkomst: Array<{ veld: string; citaat: string; betrouwbaarheid: number }>;
  watIsOnzeker: string[];
};

/** Partnerregistratie door AI: basisgegevens uit openbare tekst, met herkomst per veld. Een beheerder controleert vóór vrijgave. */
export async function aiPartnerRegistratie(hint: { naam?: string; website?: string }, tekst: string): Promise<AIPartnerRegistratie | null> {
  return jsonAntwoord<AIPartnerRegistratie>(
    "extractie",
    "Je registreert een bouwpartner voor woningontwikkelaar Blauwhoed op basis van openbare tekst (website of aangeleverd document). Vul alleen velden die aantoonbaar uit de tekst volgen, met per veld een kort letterlijk citaat (herkomst) en een betrouwbaarheid 0–1; laat de rest weg. Bij twijfel vul je een veld niet in: leeg is beter dan een onzekere waarde. Verzin niets: geen KVK-nummer tenzij het er letterlijk staat (8 cijfers). rollen ⊆ architect|aannemer|installateur|adviseur|leverancier|ontwikkelpartner. omschrijving is feitelijk, maximaal 500 tekens, zonder marketingtaal. referenties zijn concrete projectnamen (met plaats of aantal woningen als dat er staat), maximaal 8. Noem in watIsOnzeker wat een beheerder moet controleren. Schrijf in het Nederlands. Geef nooit namen of gegevens van personen.",
    `${hint.naam ? `Opgegeven naam: ${hint.naam}\n` : ""}${hint.website ? `Opgegeven website: ${hint.website}\n` : ""}\nTekst:\n${tekst.slice(0, 30000)}`,
    {
      type: "object",
      additionalProperties: false,
      required: ["rollen", "referenties", "herkomst", "watIsOnzeker"],
      properties: {
        naam: { type: "string" },
        kvk: { type: "string" },
        rechtsvorm: { type: "string" },
        vestigingsplaats: { type: "string" },
        adres: { type: "string" },
        rollen: { type: "array", items: { type: "string" } },
        website: { type: "string" },
        omschrijving: { type: "string" },
        referenties: { type: "array", items: { type: "string" } },
        medewerkers: { type: "integer" },
        herkomst: {
          type: "array",
          items: { type: "object", additionalProperties: false, required: ["veld", "citaat", "betrouwbaarheid"], properties: { veld: { type: "string" }, citaat: { type: "string" }, betrouwbaarheid: { type: "number" } } }
        },
        watIsOnzeker: { type: "array", items: { type: "string" } }
      }
    }
  );
}

export type AIChatAntwoord = { antwoord: string; partnerIds: string[] };

/**
 * B5: chat over het partnerbestand. Het model krijgt uitsluitend records uit de database mee en mag niets verzinnen;
 * elk antwoord verwijst naar de onderliggende partner-ids.
 */
export async function aiChat(vraag: string, context: string, historie: Array<{ vraag: string; antwoord: string }>): Promise<AIChatAntwoord | null> {
  return jsonAntwoord<AIChatAntwoord>(
    "chat",
    "Je beantwoordt vragen van een medewerker van woningontwikkelaar Blauwhoed over hun eigen partnerdatabase, in het Nederlands. Gebruik UITSLUITEND de meegeleverde partnerrecords; verzin geen partners, cijfers of eigenschappen. Staat het antwoord niet in de records, zeg dat dan expliciet en stel voor welk filter of welke verrijking zou helpen. Noem partners bij naam en geef hun id's terug in partnerIds (alleen id's uit de records). Wees feitelijk en beknopt; onderscheid gevalideerde waarden van voorgestelde (status staat per waarde in de records).",
    `${historie.map((h) => `Eerdere vraag: ${h.vraag}\nEerder antwoord: ${h.antwoord}`).join("\n\n")}\n\nPartnerrecords (JSON):\n${context}\n\nVraag: ${vraag}`,
    {
      type: "object",
      additionalProperties: false,
      required: ["antwoord", "partnerIds"],
      properties: { antwoord: { type: "string" }, partnerIds: { type: "array", items: { type: "string" } } }
    }
  );
}

export const AI_BRON: Bron = "web";

export type AIMatchOnderbouwing = { perKandidaat: Array<{ partnerId: string; onderbouwing: string; aandachtspunten: string[] }>; samenvatting: string };

/**
 * US-59/US-70: onderbouwing van een matchresultaat in gewone taal (één matchvraag = één bewerking). Het model krijgt alleen
 * de berekende criteria en bronnen mee; het is een onderbouwde eerste selectie, geen oordeel over geschiktheid.
 */
export async function aiMatchOnderbouwing(project: Pick<Project, "naam" | "omschrijving" | "type" | "woningen">, rol: string, kandidaten: Array<{ partnerId: string; naam: string; score: number; dekkingsgraad: number; criteria: string[]; waarschuwingen: string[] }>): Promise<AIMatchOnderbouwing | null> {
  return jsonAntwoord<AIMatchOnderbouwing>(
    "match",
    "Je licht voor woningontwikkelaar Blauwhoed een berekende partnermatch toe in het Nederlands. Gebruik uitsluitend de meegeleverde scores, criteria en bronnen; voeg geen feiten toe. Schrijf per kandidaat 1–3 zinnen waarom hij zo scoort en noem aandachtspunten (lage dekking, ontbrekende of indicatieve gegevens). Het is een onderbouwde eerste selectie, geen oordeel over geschiktheid, betrouwbaarheid of financiële gezondheid; formuleer dus niet als aanbeveling om te contracteren.",
    `Project: ${project.naam} (${project.type}, ${project.woningen} woningen). ${project.omschrijving.slice(0, 800)}\nRol: ${rol}\n\nKandidaten (JSON):\n${JSON.stringify(kandidaten).slice(0, 20000)}`,
    {
      type: "object",
      additionalProperties: false,
      required: ["perKandidaat", "samenvatting"],
      properties: {
        samenvatting: { type: "string" },
        perKandidaat: {
          type: "array",
          items: { type: "object", additionalProperties: false, required: ["partnerId", "onderbouwing", "aandachtspunten"], properties: { partnerId: { type: "string" }, onderbouwing: { type: "string" }, aandachtspunten: { type: "array", items: { type: "string" } } } }
        }
      }
    }
  );
}

export type AIVerbandAnalyse = { patronen: Array<{ titel: string; toelichting: string; bronnen: string[] }>; kanttekeningen: string[] };

/** US-59/US-70: verbandanalyse over afgeleide verbanden (één analyse = één bewerking). Signalen, geen bevestigde samenwerking. */
export async function aiVerbandAnalyse(verbanden: Array<{ a: string; b: string; rollen: string; bronnen: string[] }>): Promise<AIVerbandAnalyse | null> {
  return jsonAntwoord<AIVerbandAnalyse>(
    "verband",
    "Je vat voor Blauwhoed patronen samen in verbanden tussen bouwpartners (bijv. welke architecten vaak met welke houtbouwers werken). Gebruik uitsluitend de meegeleverde verbanden en noem bij elk patroon de bronnen. Het zijn uit bronnen afgeleide signalen, geen bevestiging van samenwerking of exclusiviteit; formuleer voorzichtig. Schrijf in het Nederlands, maximaal 6 patronen.",
    `Verbanden (JSON):\n${JSON.stringify(verbanden).slice(0, 25000)}`,
    {
      type: "object",
      additionalProperties: false,
      required: ["patronen", "kanttekeningen"],
      properties: {
        patronen: { type: "array", items: { type: "object", additionalProperties: false, required: ["titel", "toelichting", "bronnen"], properties: { titel: { type: "string" }, toelichting: { type: "string" }, bronnen: { type: "array", items: { type: "string" } } } } },
        kanttekeningen: { type: "array", items: { type: "string" } }
      }
    }
  );
}

/** US-55: gerichte zoekvragen vanuit een zoekprofiel (Nederlandse bedrijfszoekopdrachten, geen persoonsnamen). */
export async function aiZoekvragen(profiel: { rollen: string[]; trefwoorden: string; regio?: string }, bronnen: string[]): Promise<string[] | null> {
  const r = await jsonAntwoord<{ zoekvragen: string[] }>(
    "aandragen",
    "Je stelt voor woningontwikkelaar Blauwhoed gerichte zoekvragen op om bouwpartners (bedrijven) te vinden die nog niet in hun bestand staan. Geef 4 tot 8 korte Nederlandse zoekopdrachten voor een zoekmachine, gericht op bedrijfswebsites, vakmedia en openbare keurmerkregisters. Geen persoonsnamen, geen betaalde bronnen of bronnen achter een login.",
    `Rollen: ${profiel.rollen.join(", ")}\nTrefwoorden: ${profiel.trefwoorden}\nRegio: ${profiel.regio ?? "heel Nederland"}\nBeschikbare bronnen: ${bronnen.join(", ")}`,
    { type: "object", additionalProperties: false, required: ["zoekvragen"], properties: { zoekvragen: { type: "array", items: { type: "string" } } } }
  );
  return r?.zoekvragen.map((z) => z.trim()).filter((z) => z.length > 3).slice(0, 8) ?? null;
}
