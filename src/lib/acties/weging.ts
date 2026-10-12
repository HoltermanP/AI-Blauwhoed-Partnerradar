"use server";
// US-16: weging per project of tender. Een andere weging werkt direct door in de rangschikking (in de browser, uit de run);
// hier wordt ze vastgelegd: op het project (volgende runs) of als eigen gewichtsprofiel, bijvoorbeeld per tendertype.
import { revalidatePath } from "next/cache";
import { vereisRecht } from "../auth";
import { criteriumSleutel, normaliseerGewichten, type Weging } from "../domain/herweging";
import { valideerGewichten } from "../domain/matching";
import { pasErvaringsgewichtToe } from "../domain/gewichten";
import type { ProjectRequirement, RequirementFactor, Rol } from "../domain/types";
import { getDb, muteer, nieuwId } from "../store";

type Resultaat<T = undefined> = { ok: true; data?: T } | { ok: false; fout: string };

async function veilig<T>(fn: () => Promise<T>): Promise<Resultaat<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, fout: e instanceof Error ? e.message : String(e) };
  }
}

function pasToe(eisen: ProjectRequirement[], weging: Partial<Record<Rol, Weging>>): ProjectRequirement[] {
  return eisen.map((e) => {
    const w = weging[e.rol];
    if (!w) return e;
    const genormaliseerd = normaliseerGewichten(w.gewichten);
    return { ...e, semantischGewicht: Math.round(w.semantisch), eisen: e.eisen.map((x) => (criteriumSleutel(x) in genormaliseerd ? { ...x, gewicht: genormaliseerd[criteriumSleutel(x)] } : x)) };
  });
}

/** Leg de weging vast op het project; de volgende matchrun gebruikt haar. */
export async function slaWegingOpProject(projectId: string, runId: string, weging: Partial<Record<Rol, Weging>>) {
  return veilig(async () => {
    const g = await vereisRecht("bewerken");
    const db = await getDb();
    const project = db.projecten.find((p) => p.id === projectId);
    const run = db.matchRuns.find((r) => r.id === runId);
    if (!project || !run) throw new Error("Project of matchrun niet gevonden.");
    const eisen = pasToe(project.eisen.length ? project.eisen : run.input.eisen, weging);
    for (const e of eisen) {
      const v = valideerGewichten(e.eisen, db.factoren);
      if (!v.geldig && v.som > 0) throw new Error(`Gewichten voor ${e.rol} tellen op tot ${v.som}%, niet 100%.`);
    }
    await muteer(g, { entiteit: "project", entiteitId: projectId, actie: "weging aangepast vanuit matchrun", details: Object.keys(weging).join(", ") }, (db) => {
      const p = db.projecten.find((x) => x.id === projectId)!;
      p.eisen = eisen;
      p.bijgewerktOp = new Date().toISOString();
    });
    revalidatePath(`/projecten/${projectId}`);
    revalidatePath(`/projecten/${projectId}/match`);
  });
}

/** Sla de weging op als (eigen) gewichtsprofiel, bijvoorbeeld per tendertype. Standaardprofielen wijzigt alleen beheer. */
export async function slaWegingOpAlsProfiel(runId: string, naam: string, omschrijving: string, weging: Partial<Record<Rol, Weging>>) {
  return veilig(async () => {
    const g = await vereisRecht("bewerken");
    if (!naam.trim()) throw new Error("Geef het profiel een naam.");
    const db = await getDb();
    const run = db.matchRuns.find((r) => r.id === runId);
    if (!run) throw new Error("Matchrun niet gevonden.");
    if (db.gewichtsprofielen.some((p) => p.naam.toLowerCase() === naam.trim().toLowerCase())) throw new Error("Er bestaat al een profiel met deze naam.");
    const eisen = pasToe(run.input.eisen, weging);
    const perRol: Partial<Record<Rol, RequirementFactor[]>> = Object.fromEntries(eisen.map((e) => [e.rol, e.eisen]));
    const semantisch = Math.round(eisen.reduce((s, e) => s + e.semantischGewicht, 0) / Math.max(1, eisen.length));
    const id = nieuwId("gp");
    const nu = new Date().toISOString();
    await muteer(g, { entiteit: "gewichtsprofiel", entiteitId: id, actie: "profiel opgeslagen vanuit matchrun", details: naam }, (db) => {
      db.gewichtsprofielen.push({ id, naam: naam.trim(), omschrijving: omschrijving.trim() || `Weging opgeslagen door ${g.naam} vanuit een matchrun.`, perRol, semantischGewicht: semantisch, versie: 1, versies: [{ versie: 1, op: nu, door: g.naam, toelichting: "Opgeslagen vanuit een matchrun", snapshot: JSON.parse(JSON.stringify(perRol)) }], standaard: false });
    });
    revalidatePath("/beheer/gewichten");
    return id;
  });
}

/**
 * US-17/US-21: de standaardweging vastleggen (beheer). Het aandeel eigen ervaring wordt in elke rol van alle
 * standaardprofielen toegepast (nieuwe versie per profiel, terug te draaien); het aandeel samenwerking geldt voor de
 * teamscore; het standaardprofiel is het startpunt bij nieuwe projecten.
 */
export async function slaStandaardwegingOp(invoer: { eigenErvaring: number; samenwerking: number; profielId?: string; dekkingDemping: boolean }) {
  return veilig(async () => {
    const g = await vereisRecht("beheer");
    if (!(invoer.eigenErvaring >= 0 && invoer.eigenErvaring <= 80)) throw new Error("Eigen ervaring ligt tussen 0 en 80%.");
    if (!(invoer.samenwerking >= 0 && invoer.samenwerking <= 50)) throw new Error("Samenwerking ligt tussen 0 en 50%.");
    const db = await getDb();
    if (invoer.profielId && !db.gewichtsprofielen.some((p) => p.id === invoer.profielId)) throw new Error("Profiel niet gevonden.");
    const isGewogen = (id: string) => db.factoren.find((f) => f.id === id)?.type === "gewogen";
    await muteer(g, { entiteit: "gewichtsprofiel", entiteitId: "standaardweging", actie: "standaardweging vastgesteld", details: `eigen ervaring ${invoer.eigenErvaring}%, samenwerking ${invoer.samenwerking}%, dekkingscorrectie ${invoer.dekkingDemping ? "aan" : "uit"}${invoer.profielId ? `, standaardprofiel ${invoer.profielId}` : ""}` }, (db) => {
      const nu = new Date().toISOString();
      db.gewichtsprofielen
        .filter((gp) => gp.standaard)
        .forEach((gp) => {
          const perRol = Object.fromEntries(Object.entries(gp.perRol).map(([rol, eisen]) => [rol, pasErvaringsgewichtToe(eisen ?? [], invoer.eigenErvaring, isGewogen)])) as typeof gp.perRol;
          if (JSON.stringify(perRol) === JSON.stringify(gp.perRol)) return;
          gp.versie += 1;
          gp.perRol = perRol;
          gp.versies.push({ versie: gp.versie, op: nu, door: g.naam, toelichting: `Standaardweging: eigen ervaring ${invoer.eigenErvaring}% per rol`, snapshot: JSON.parse(JSON.stringify(perRol)) });
        });
      db.instellingen.standaardweging = { eigenErvaring: invoer.eigenErvaring, samenwerking: invoer.samenwerking, vastgesteldDoor: g.naam, vastgesteldOp: nu };
      db.instellingen.standaardGewichtsprofielId = invoer.profielId || undefined;
      db.instellingen.dekkingDemping = invoer.dekkingDemping;
    });
    revalidatePath("/beheer/gewichten");
  });
}
