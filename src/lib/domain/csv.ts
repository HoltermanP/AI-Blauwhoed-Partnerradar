// US-18: import van projectadministratie via CSV. Match op KVK of crediteurnummer; onherleidbare regels naar controlewachtrij.
import type { Database, Engagement, Rol } from "./types";
import { ROLLEN } from "./types";

export function parseCsv(input: string): Record<string, string>[] {
  const regels = input.split(/\r?\n/).filter((r) => r.trim());
  if (!regels.length) return [];
  const scheidingsteken = (regels[0].match(/;/g)?.length ?? 0) >= (regels[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const kop = regels[0].split(scheidingsteken).map((k) => k.trim().toLowerCase().replace(/^"|"$/g, ""));
  return regels.slice(1).map((r) => {
    const cellen = r.split(scheidingsteken).map((c) => c.trim().replace(/^"|"$/g, ""));
    const obj: Record<string, string> = {};
    kop.forEach((k, i) => (obj[k] = cellen[i] ?? ""));
    return obj;
  });
}

const kolom = (r: Record<string, string>, ...namen: string[]) => {
  for (const n of namen) if (r[n] !== undefined && r[n] !== "") return r[n];
  return "";
};

export type ImportResultaat = { engagements: Engagement[]; wachtrij: Array<{ regel: Record<string, string>; reden: string }> };

export function importeerEngagements(csv: string, db: Pick<Database, "partners" | "projecten" | "engagements">, nu = new Date()): ImportResultaat {
  const regels = parseCsv(csv);
  const resultaat: ImportResultaat = { engagements: [], wachtrij: [] };
  regels.forEach((r, i) => {
    const kvk = kolom(r, "kvk", "kvk-nummer", "kvknummer");
    const crediteur = kolom(r, "crediteurnummer", "crediteur", "crediteurnr");
    const partner = db.partners.find((p) => (kvk && p.kvk === kvk) || (crediteur && db.engagements.some((e) => e.partnerId === p.id && e.crediteurnummer === crediteur)) || (crediteur && p.tags.includes(`crediteur:${crediteur}`)));
    const projectNaam = kolom(r, "project", "projectnaam", "projectnummer");
    const project = db.projecten.find((p) => p.naam.toLowerCase() === projectNaam.toLowerCase() || p.id === projectNaam);
    const rol = kolom(r, "rol").toLowerCase() as Rol;
    const contractwaarde = Number(kolom(r, "contractwaarde", "bedrag").replace(/[^0-9.,-]/g, "").replace(",", "."));
    if (!partner) return resultaat.wachtrij.push({ regel: r, reden: kvk || crediteur ? `Geen partner met KVK ${kvk || "-"} of crediteurnummer ${crediteur || "-"}` : "KVK en crediteurnummer ontbreken" });
    if (!project) return resultaat.wachtrij.push({ regel: r, reden: `Project '${projectNaam}' niet gevonden` });
    if (!ROLLEN.includes(rol)) return resultaat.wachtrij.push({ regel: r, reden: `Rol '${rol}' onbekend` });
    if (!Number.isFinite(contractwaarde)) return resultaat.wachtrij.push({ regel: r, reden: "Contractwaarde niet leesbaar" });
    resultaat.engagements.push({
      id: `eng-import-${nu.getTime().toString(36)}-${i}`,
      partnerId: partner.id,
      projectId: project.id,
      rol,
      periode: { van: kolom(r, "van", "start", "startdatum") || nu.toISOString().slice(0, 10), tot: kolom(r, "tot", "eind", "einddatum") || undefined },
      contractwaarde,
      ramingBijStart: Number(kolom(r, "raming")) || undefined,
      eindafrekening: Number(kolom(r, "eindafrekening")) || undefined,
      geplandeOplevering: kolom(r, "geplande oplevering", "gepland") || undefined,
      werkelijkeOplevering: kolom(r, "werkelijke oplevering", "werkelijk") || undefined,
      bouwsysteem: kolom(r, "bouwsysteem") || undefined,
      crediteurnummer: crediteur || undefined,
      bron: "csv-import"
    });
  });
  return resultaat;
}
