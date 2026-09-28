"use server";
// US-59/US-70: onderbouwing van een matchrun en verbandanalyse. Met AI-sleutel is elke vraag één AI-bewerking (match resp.
// verband) met het per functie ingestelde model; zonder sleutel een regelgebaseerde uitleg uit dezelfde gegevens.
import { revalidatePath } from "next/cache";
import { aiBeschikbaar, aiMatchOnderbouwing, aiVerbandAnalyse, alsAIBewerking, providerLabel, zetAanroepDoel } from "../ai";
import { vereisRecht } from "../auth";
import { regelOnderbouwingRol, regelVerbandAnalyse } from "../domain/onderbouwing";
import { filterOpRollen, leidVerbandenAf } from "../domain/verbanden";
import type { MatchRun, Rol } from "../domain/types";
import { getDb, muteer } from "../store";

export async function onderbouwMatchrun(runId: string) {
  try {
    const g = await vereisRecht("lezen");
    const db = await getDb();
    const run = db.matchRuns.find((r) => r.id === runId);
    if (!run) throw new Error("Matchrun niet gevonden.");
    const project = db.projecten.find((p) => p.id === run.projectId);
    if (!project) throw new Error("Project niet gevonden.");
    let provider = "regels (geen externe AI)";
    const perRol: NonNullable<MatchRun["onderbouwing"]>["perRol"] = await alsAIBewerking(
      "match",
      g.naam,
      `onderbouwing matchrun ${project.naam}`,
      async () =>
        Promise.all(
          run.resultaat.map(async (r) => {
            const regel = regelOnderbouwingRol(r);
            if (!aiBeschikbaar() || !r.kandidaten.length) return regel;
            zetAanroepDoel(`match-onderbouwing ${r.rol}`);
            const ai = await aiMatchOnderbouwing(project, r.rol, r.kandidaten.slice(0, 5).map((k) => ({ partnerId: k.partnerId, naam: k.partnerNaam, score: k.score, dekkingsgraad: k.dekkingsgraad, criteria: k.criteria.map((c) => `${c.factorNaam}: ${c.toelichting} (bijdrage ${c.bijdrage})`), waarschuwingen: k.waarschuwingen })));
            if (!ai) return regel;
            provider = await providerLabel("match");
            return { rol: r.rol, samenvatting: ai.samenvatting, perKandidaat: ai.perKandidaat.filter((x) => r.kandidaten.some((k) => k.partnerId === x.partnerId)) };
          })
        ),
      "match"
    );
    await muteer(g, { entiteit: "match_run", entiteitId: runId, actie: "onderbouwing opgesteld", details: provider }, (db) => {
      const r = db.matchRuns.find((x) => x.id === runId);
      if (r) r.onderbouwing = { provider, op: new Date().toISOString(), door: g.naam, perRol };
    });
    revalidatePath(`/projecten/${project.id}/match`);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, fout: e instanceof Error ? e.message : String(e) };
  }
}

export type VerbandAnalyseUitkomst = { patronen: Array<{ titel: string; toelichting: string; bronnen: string[] }>; kanttekeningen: string[]; provider: string };

export async function analyseerVerbanden(rolA?: Rol, rolB?: Rol) {
  try {
    const g = await vereisRecht("lezen");
    const db = await getDb();
    const verbanden = filterOpRollen(leidVerbandenAf(db), rolA, rolB).slice(0, 80);
    if (!verbanden.length) throw new Error("Geen verbanden om te analyseren.");
    const ai = aiBeschikbaar()
      ? await alsAIBewerking("verband", g.naam, `verbandanalyse ${rolA ?? "alle"} × ${rolB ?? "alle"}`, () => {
          zetAanroepDoel("verbandanalyse");
          return aiVerbandAnalyse(verbanden.map((v) => ({ a: v.a.naam, b: v.b.naam, rollen: `${v.a.rollen.join("/")} × ${v.b.rollen.join("/")}`, bronnen: v.bronnen.map((b) => b.label) })));
        }, "verband")
      : null;
    const uit: VerbandAnalyseUitkomst = ai ? { ...ai, provider: await providerLabel("verband") } : { ...regelVerbandAnalyse(verbanden), provider: "regels (geen externe AI)" };
    return { ok: true as const, data: uit };
  } catch (e) {
    return { ok: false as const, fout: e instanceof Error ? e.message : String(e) };
  }
}
