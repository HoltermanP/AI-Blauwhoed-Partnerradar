// Claude-integratie (optioneel). Actief zodra ANTHROPIC_API_KEY is gezet. Er gaan uitsluitend openbare bedrijfs- en
// projectteksten naar het model, nooit contactpersonen (US-48). Zonder sleutel vallen alle aanroepen terug op regels.
import Anthropic from "@anthropic-ai/sdk";
import type { AISamenvatting, Bron, DiscoveryCandidate, Factor, Project } from "./domain/types";

const MODEL = "claude-opus-5";

export function aiBeschikbaar() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

async function jsonAntwoord<T>(system: string, prompt: string, schema: Record<string, unknown>): Promise<T | null> {
  if (!aiBeschikbaar()) return null;
  try {
    const res = await getClient().messages.create({
      model: MODEL,
      max_tokens: 4000,
      system,
      output_config: { effort: "medium", format: { type: "json_schema", schema } },
      messages: [{ role: "user", content: prompt }]
    });
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
  return { ...r, gegenereerdOp: new Date().toISOString(), provider: `Claude (${MODEL})` };
}

export type AIFactorVoorstel = { factorId: string; optieId?: string; waarde: number | string | boolean; citaat: string; aantoonbaar: boolean };

/** US-29/30: factorwaarden uit openbare tekst volgens de taxonomie, met citaat en aantoonbaar/geclaimd. */
export async function aiFactorExtractie(naam: string, tekst: string, factoren: Factor[]): Promise<AIFactorVoorstel[] | null> {
  const taxonomie = factoren
    .filter((f) => f.actief && f.type !== "semantisch" && !f.afgeleid)
    .map((f) => `- ${f.id}: ${f.naam} (${f.schaal.soort}${"eenheid" in f.schaal ? `, ${f.schaal.eenheid}` : ""})${f.opties?.length ? ` opties: ${f.opties.map((o) => o.id).join("|")}` : ""}`)
    .join("\n");
  const r = await jsonAntwoord<{ voorstellen: AIFactorVoorstel[] }>(
    "Je extraheert kenmerken van een bouwpartner uit openbare tekst volgens een vaste taxonomie. Geef alleen kenmerken die letterlijk uit de tekst volgen, met een kort citaat. 'aantoonbaar' is true alleen bij certificaat, meting, berekening of concreet opgeleverd project; marketingtaal is niet aantoonbaar. Niveau-schalen zijn 0–5 (3 = aantoonbare ervaring, 4–5 = specialisme). Schrijf in het Nederlands.",
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

export const AI_BRON: Bron = "web";
