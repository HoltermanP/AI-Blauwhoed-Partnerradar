// US-26: projecten importeren uit Business Central of het ERP (CSV/Excel), met het projectnummer als sleutel. Het ERP is de
// leidende bron: bestaande projecten (ook uit webbronnen) worden op projectnummer of naam samengevoegd; bij elk project blijft
// zichtbaar of het uit het ERP of uit een webbron komt. Een API-koppeling volgt later.
import { normaliseerNaam } from "./discovery";
import type { Database, Geo, Project, Projectfase, Projecttype } from "./types";

export type ProjectRij = Record<string, string | number | boolean | null | undefined>;
export type ProjectImportUitkomst = { gelezen: number; nieuw: number; bijgewerkt: number; samengevoegd: number; overgeslagen: Array<{ regel: number; reden: string }> };

const kolom = (r: ProjectRij, ...namen: string[]) => {
  const sleutels = Object.keys(r);
  for (const n of namen) {
    const k = sleutels.find((s) => s.toLowerCase().replace(/[\s._-]+/g, "") === n.toLowerCase().replace(/[\s._-]+/g, ""));
    if (k !== undefined && r[k] !== null && r[k] !== undefined && String(r[k]).trim() !== "") return String(r[k]).trim();
  }
  return "";
};

const TYPEN: Array<[RegExp, Projecttype]> = [
  [/zorg/i, "zorgwonen"],
  [/transform|herbestem|renovat/i, "transformatie"],
  [/hoogbouw|toren/i, "hoogbouw"],
  [/appartement|gestapeld/i, "appartementen"],
  [/gebied/i, "gebiedsontwikkeling"],
  [/grondgebonden|eengezins|rijwoning/i, "grondgebonden"]
];
const FASEN: Array<[RegExp, Projectfase]> = [
  [/nazorg|garantie/i, "nazorg"],
  [/opgeleverd|afgerond|gereed|gesloten/i, "opgeleverd"],
  [/uitvoering|realisatie|bouw/i, "realisatie"],
  [/ontwerp|plan|voorbereiding/i, "planvorming"],
  [/initiatief|acquisitie|haalbaarheid/i, "initiatief"]
];

/** Datum uit ERP-notaties (2026-03-01, 01-03-2026, 1/3/2026, Excel-serienummer). */
export function leesDatum(s: string): string | undefined {
  if (!s) return undefined;
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86_400_000);
    return d.toISOString().slice(0, 10);
  }
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

export type ErpProject = { nummer: string; naam?: string; plaats?: string; type?: Projecttype; woningen?: number; fase?: Projectfase; start?: string; eind?: string; verantwoordelijke?: string; omschrijving?: string };

export function leesProjectRij(r: ProjectRij): ErpProject | null {
  const nummer = kolom(r, "projectnummer", "projectnr", "project nr", "nummer", "no.", "nr", "project no");
  if (!nummer) return null;
  const typeTekst = kolom(r, "type", "projecttype", "soort");
  const faseTekst = kolom(r, "fase", "status", "projectstatus");
  const woningen = Number(kolom(r, "woningen", "aantal woningen", "aantal", "eenheden").replace(/\D/g, ""));
  return {
    nummer,
    naam: kolom(r, "projectnaam", "naam", "omschrijving project", "description") || undefined,
    plaats: kolom(r, "plaats", "locatie", "gemeente", "vestiging", "city") || undefined,
    type: TYPEN.find(([re]) => re.test(typeTekst))?.[1],
    woningen: woningen > 0 ? woningen : undefined,
    fase: FASEN.find(([re]) => re.test(faseTekst))?.[1],
    start: leesDatum(kolom(r, "start", "startdatum", "begindatum", "starting date")),
    eind: leesDatum(kolom(r, "eind", "einddatum", "oplevering", "opleverdatum", "ending date")),
    verantwoordelijke: kolom(r, "verantwoordelijke", "ontwikkelaar", "projectleider", "projectmanager", "person responsible") || undefined,
    omschrijving: kolom(r, "toelichting", "opmerking", "beschrijving") || undefined
  };
}

/** Voeg ERP-projecten toe of werk ze bij. Locaties van nieuwe plaatsen zijn vooraf opgezocht (synchroon muteren). */
export function importeerProjecten(db: Database, rijen: ProjectRij[], locaties: Map<string, Geo | null>, nieuwId: (prefix: string) => string, nu = new Date()): ProjectImportUitkomst {
  const u: ProjectImportUitkomst = { gelezen: rijen.length, nieuw: 0, bijgewerkt: 0, samengevoegd: 0, overgeslagen: [] };
  const iso = nu.toISOString();
  const gezien = new Set<string>();
  rijen.forEach((rij, i) => {
    const e = leesProjectRij(rij);
    if (!e) return void u.overgeslagen.push({ regel: i + 2, reden: "geen projectnummer" });
    const sleutel = e.nummer.toLowerCase();
    if (gezien.has(sleutel)) return void u.overgeslagen.push({ regel: i + 2, reden: `projectnummer ${e.nummer} komt dubbel voor in het bestand` });
    gezien.add(sleutel);
    const bijNummer = db.projecten.find((p) => p.projectnummer?.toLowerCase() === sleutel);
    const bijNaam = !bijNummer && e.naam ? db.projecten.find((p) => !p.projectnummer && normaliseerNaam(p.naam) === normaliseerNaam(e.naam!)) : undefined;
    const bestaand = bijNummer ?? bijNaam;
    const geo = e.plaats ? locaties.get(e.plaats) ?? null : null;
    if (bestaand) {
      const wasWeb = bestaand.bron === "web" || Boolean(bestaand.herkomst?.length) || bestaand.ookWebbron;
      // Het ERP is leidend voor wat het levert; wat het ERP niet levert blijft staan.
      bestaand.projectnummer = e.nummer;
      if (e.naam) bestaand.naam = e.naam;
      if (e.fase) bestaand.fase = e.fase;
      if (e.type) bestaand.type = e.type;
      if (e.woningen) bestaand.woningen = e.woningen;
      if (e.start) bestaand.planning = { ...bestaand.planning, start: e.start };
      if (e.eind) bestaand.planning = { ...bestaand.planning, eind: e.eind };
      if (e.verantwoordelijke) bestaand.verantwoordelijke = e.verantwoordelijke;
      if (e.plaats && geo) bestaand.locatie = { ...geo, plaats: e.plaats };
      bestaand.bron = "erp";
      bestaand.ookWebbron = wasWeb || undefined;
      bestaand.erpImportOp = iso;
      bestaand.bijgewerktOp = iso;
      if (bijNaam) u.samengevoegd++;
      else u.bijgewerkt++;
      return;
    }
    if (!e.naam) return void u.overgeslagen.push({ regel: i + 2, reden: `projectnummer ${e.nummer}: geen projectnaam` });
    if (!geo) return void u.overgeslagen.push({ regel: i + 2, reden: `projectnummer ${e.nummer}: plaats '${e.plaats ?? ""}' onbekend` });
    const start = e.start ?? iso.slice(0, 10);
    const project: Project = {
      id: nieuwId("proj"),
      projectnummer: e.nummer,
      bron: "erp",
      erpImportOp: iso,
      naam: e.naam,
      type: e.type ?? "grondgebonden",
      locatie: { ...geo, plaats: e.plaats! },
      woningen: e.woningen ?? 0,
      prijssegment: [],
      bouwstijl: "modern",
      ambitieDuurzaamheid: 3,
      planning: { start, eind: e.eind ?? start },
      fase: e.fase ?? "initiatief",
      omschrijving: e.omschrijving ?? "",
      verantwoordelijke: e.verantwoordelijke,
      eisen: [],
      aangemaaktOp: iso,
      bijgewerktOp: iso
    };
    db.projecten.push(project);
    u.nieuw++;
  });
  return u;
}

export const PROJECTBRON_LABEL = { erp: "ERP (Business Central)", web: "webbron", handmatig: "handmatig", tender: "tenderapplicatie" } as const;
