// Discovery en AI-aandraag: gevonden websites eerst met regels toetsen (portaal, makelaar, medium, geen bouwbedrijf), daarna
// met AI op het profiel van Blauwhoed en het project. Wat afvalt, wordt met reden teruggemeld in plaats van stil te verdwijnen.
import { aiBeschikbaar, aiToetsKandidaten, zetAanroepDoel } from "./ai";
import { BLAUWHOED_PROFIEL, type Relevantie } from "./domain/relevantie";
import { filterRelevant } from "./domain/webzoek";
import type { Rol } from "./domain/types";

export type Weggefilterd = { naam: string; reden: string };

export async function toetsKandidaten<T extends { naam: string; bronUrl: string; website?: string; voorlopigeScore?: number; ruweData: Record<string, unknown> }>(kandidaten: T[], rollen: Rol[], project?: string, upcoming = false): Promise<{ relevant: T[]; weg: Weggefilterd[] }> {
  const { relevant, weg } = filterRelevant(kandidaten);
  const metTekst = relevant.filter((k) => typeof k.ruweData.websiteTekst === "string" && ((k.ruweData.websiteTekst as string).length > 100 || Boolean(k.ruweData.aanleiding)));
  if (!aiBeschikbaar() || !metTekst.length) return { relevant, weg };
  zetAanroepDoel("kandidaten toetsen op het profiel van Blauwhoed");
  const toets = await aiToetsKandidaten(
    metTekst.map((k) => ({ naam: k.naam, url: k.website ?? k.bronUrl, tekst: `${k.ruweData.aanleiding ? `Aanleiding: ${String(k.ruweData.aanleiding)}. ` : ""}${String(k.ruweData.profiel ?? "")} ${String(k.ruweData.websiteTekst)}` })),
    { rollen, project, profiel: BLAUWHOED_PROFIEL, upcoming }
  );
  // AI niet beschikbaar of mislukt: de regeltoets blijft staan.
  if (!toets) return { relevant, weg };
  const afgewezen = new Set<T>();
  toets.forEach((t) => {
    const k = metTekst[t.index];
    if (!k) return;
    const vorige = k.ruweData.relevantie as Relevantie | undefined;
    k.ruweData.relevantie = { ...(vorige ?? { score: 50, soort: "bouwpartner" }), relevant: t.relevant, reden: `${t.reden} (AI-toets)`, ...(t.relevant ? {} : { soort: "geen bouwbedrijf" as const }) };
    if (!t.relevant) {
      afgewezen.add(k);
      weg.push({ naam: k.naam, reden: t.reden });
    }
  });
  return { relevant: relevant.filter((k) => !afgewezen.has(k)), weg };
}
