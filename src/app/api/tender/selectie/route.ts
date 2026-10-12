// US-27: partnerselectie starten vanuit de tenderapplicatie. De tenderapplicatie stuurt projectgegevens en (optioneel) de
// selectiecriteria mee; dit endpoint maakt het project aan (bron 'tender'), legt de eisen vast en voert direct een matchrun
// uit. Beveiligd met een eigen sleutel (TENDER_API_KEY, header Authorization: Bearer …). De koppeling met de tenderapplicatie
// zelf bestaat nog niet; raakvlakken met andere tools worden nog geïnventariseerd.
import { NextResponse } from "next/server";
import { geocodeer } from "@/lib/domain/geocode";
import { matchProject, valideerGewichten } from "@/lib/domain/matching";
import { leidEisenAf } from "@/lib/domain/projectfactoren";
import { ROLLEN, type Project, type ProjectRequirement, type Projecttype, type RequirementFactor, type Rol } from "@/lib/domain/types";
import { getDb, muteer, nieuwId } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TENDER = { id: "tenderapplicatie", naam: "tenderapplicatie", rol: "gebruiker" as const };
const TYPEN: Projecttype[] = ["grondgebonden", "appartementen", "hoogbouw", "transformatie", "zorgwonen", "gebiedsontwikkeling"];

type Invoer = {
  project: { naam: string; plaats: string; woningen?: number; type?: Projecttype; start?: string; eind?: string; ambitieDuurzaamheid?: number; omschrijving?: string; projectnummer?: string; tenderId?: string };
  rollen?: Rol[];
  gewichtsprofielId?: string;
  /** Selectiecriteria per rol (uit de selectieleidraad); ontbreekt = afgeleid uit het projectprofiel en het gewichtsprofiel. */
  criteria?: Partial<Record<Rol, RequirementFactor[]>>;
};

function geautoriseerd(req: Request) {
  const sleutel = process.env.TENDER_API_KEY;
  return Boolean(sleutel) && req.headers.get("authorization") === `Bearer ${sleutel}`;
}

export async function POST(req: Request) {
  if (!process.env.TENDER_API_KEY) return NextResponse.json({ ok: false, fout: "De tenderkoppeling is niet ingericht (TENDER_API_KEY ontbreekt)." }, { status: 501 });
  if (!geautoriseerd(req)) return NextResponse.json({ ok: false, fout: "Ongeldige of ontbrekende sleutel." }, { status: 401 });
  let invoer: Invoer;
  try {
    invoer = (await req.json()) as Invoer;
  } catch {
    return NextResponse.json({ ok: false, fout: "Ongeldige JSON." }, { status: 400 });
  }
  const p = invoer.project;
  if (!p?.naam?.trim() || !p.plaats?.trim()) return NextResponse.json({ ok: false, fout: "project.naam en project.plaats zijn verplicht." }, { status: 400 });
  const rollen = (invoer.rollen ?? []).filter((r) => ROLLEN.includes(r));
  const geo = await geocodeer(p.plaats);
  if (!geo) return NextResponse.json({ ok: false, fout: `Plaats '${p.plaats}' niet gevonden.` }, { status: 400 });
  const db = await getDb();
  if (p.projectnummer && db.projecten.some((x) => x.projectnummer?.toLowerCase() === p.projectnummer!.toLowerCase())) return NextResponse.json({ ok: false, fout: `Projectnummer ${p.projectnummer} bestaat al.` }, { status: 409 });
  const nu = new Date().toISOString();
  const start = p.start ?? nu.slice(0, 10);
  const project: Project = {
    id: nieuwId("proj"),
    projectnummer: p.projectnummer,
    bron: "tender",
    naam: p.naam.trim(),
    type: TYPEN.includes(p.type as Projecttype) ? (p.type as Projecttype) : "grondgebonden",
    locatie: { ...geo.locatie, plaats: p.plaats },
    woningen: Math.max(0, Math.round(p.woningen ?? 0)),
    prijssegment: [],
    bouwstijl: "modern",
    ambitieDuurzaamheid: Math.min(5, Math.max(1, Math.round(p.ambitieDuurzaamheid ?? 3))) as Project["ambitieDuurzaamheid"],
    planning: { start, eind: p.eind ?? start },
    fase: "initiatief",
    omschrijving: `${p.omschrijving ?? ""}${p.tenderId ? ` (tender ${p.tenderId})` : ""}`.trim(),
    eisen: [],
    gewichtsprofielId: invoer.gewichtsprofielId,
    aangemaaktOp: nu,
    bijgewerktOp: nu
  };
  // Eisen: de meegestuurde selectiecriteria, anders afgeleid uit het profiel.
  let eisen: ProjectRequirement[];
  if (invoer.criteria && Object.keys(invoer.criteria).length) {
    eisen = (Object.entries(invoer.criteria) as Array<[Rol, RequirementFactor[]]>)
      .filter(([rol, lijst]) => ROLLEN.includes(rol) && Array.isArray(lijst) && lijst.length)
      .map(([rol, lijst]) => ({ rol, eisen: lijst.filter((e) => db.factoren.some((f) => f.id === e.factorId)), semantischGewicht: 15 }));
    for (const e of eisen) {
      const v = valideerGewichten(e.eisen, db.factoren);
      if (!v.geldig) return NextResponse.json({ ok: false, fout: `Gewichten voor ${e.rol} tellen op tot ${v.som}%, niet 100%.` }, { status: 400 });
    }
  } else {
    const afgeleid = leidEisenAf(project, db.factoren, db.gewichtsprofielen, rollen.length ? rollen : undefined);
    eisen = afgeleid.eisen;
    project.gewichtsprofielId = project.gewichtsprofielId ?? afgeleid.profielId;
  }
  if (!eisen.length) return NextResponse.json({ ok: false, fout: "Geen rollen of criteria om op te matchen." }, { status: 400 });
  project.eisen = eisen;
  const resultaat = matchProject({ db, project }, eisen);
  const runId = nieuwId("run");
  await muteer(TENDER, { entiteit: "match_run", entiteitId: project.id, actie: "partnerselectie gestart vanuit tenderapplicatie", details: `${project.naam}${p.tenderId ? `, tender ${p.tenderId}` : ""}` }, (d) => {
    d.projecten.push(project);
    d.matchRuns.unshift({ id: runId, projectId: project.id, naam: `Tenderselectie ${new Date().toLocaleDateString("nl-NL")}`, gestartOp: nu, door: TENDER.naam, input: { eisen }, resultaat });
  });
  const basis = new URL(req.url).origin;
  return NextResponse.json({
    ok: true,
    projectId: project.id,
    runId,
    url: `${basis}/projecten/${project.id}/match?run=${runId}`,
    perRol: resultaat.map((r) => ({ rol: r.rol, kandidaten: r.kandidaten.slice(0, 10).map((k) => ({ partnerId: k.partnerId, naam: k.partnerNaam, score: k.score, dekkingsgraad: k.dekkingsgraad })) }))
  });
}
