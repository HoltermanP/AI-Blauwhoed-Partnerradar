// B7 / onderdeel 7: verbanden tussen partijen en categorieën (bijv. welke architecten met welke houtbouwers werken).
// Altijd mét de bron waaruit het verband is afgeleid, en gepresenteerd als signaal — nooit als bevestigde samenwerking.
import { normaliseerNaam } from "./discovery";
import type { Database, Partner, Rol } from "./types";

export type VerbandBron = { soort: "project" | "vermelding"; ref: string; label: string };

export type Verband = {
  a: { id: string; naam: string; rollen: Rol[] };
  b: { id: string; naam: string; rollen: Rol[] };
  bronnen: VerbandBron[];
};

function sleutel(a: string, b: string) {
  return [a, b].sort().join("|");
}

/** Leid verbanden af uit gedeelde projecthistorie en uit naamsvermeldingen in openbare teksten (referenties/omschrijving). */
export function leidVerbandenAf(db: Database): Verband[] {
  const map = new Map<string, Verband>();
  const partners = db.partners.filter((p) => p.status !== "geblokkeerd" && p.status !== "gearchiveerd" && p.status !== "concept");
  const voeg = (a: Partner, b: Partner, bron: VerbandBron) => {
    if (a.id === b.id) return;
    const k = sleutel(a.id, b.id);
    const [ea, eb] = a.id < b.id ? [a, b] : [b, a];
    const v = map.get(k) ?? { a: { id: ea.id, naam: ea.naam, rollen: ea.rollen }, b: { id: eb.id, naam: eb.naam, rollen: eb.rollen }, bronnen: [] };
    if (!v.bronnen.some((x) => x.soort === bron.soort && x.ref === bron.ref)) v.bronnen.push(bron);
    map.set(k, v);
  };

  // 1. Gedeelde projecthistorie: partners met een engagement op hetzelfde project.
  db.projecten.forEach((proj) => {
    const eng = db.engagements.filter((e) => e.projectId === proj.id);
    for (let i = 0; i < eng.length; i++) {
      for (let j = i + 1; j < eng.length; j++) {
        const a = partners.find((p) => p.id === eng[i].partnerId);
        const b = partners.find((p) => p.id === eng[j].partnerId);
        if (a && b) voeg(a, b, { soort: "project", ref: proj.id, label: proj.extern ? `${proj.naam} (extern project, bron: ${eng[i].bronUrl ?? proj.herkomst?.[0]?.citaat ?? "openbare bron"})` : proj.naam });
      }
    }
  });

  // 2. Naamsvermeldingen: partner A wordt genoemd in de openbare teksten (referenties/omschrijving) van partner B.
  const metNaam = partners.filter((p) => normaliseerNaam(p.naam).length >= 5).map((p) => ({ p, naam: normaliseerNaam(p.naam) }));
  partners.forEach((b) => {
    const tekst = normaliseerNaam([b.omschrijving, ...b.referenties].join(" . "));
    metNaam.forEach(({ p: a, naam }) => {
      if (a.id === b.id || !tekst.includes(naam)) return;
      const bronUrl = b.bronnen.find((x) => /^https?:/.test(x.url))?.url ?? "profieltekst";
      voeg(a, b, { soort: "vermelding", ref: b.id, label: `${a.naam} genoemd in profiel/referenties van ${b.naam} (${bronUrl})` });
    });
  });

  return Array.from(map.values()).sort((x, y) => y.bronnen.length - x.bronnen.length);
}

/** Filter op rolcombinatie (bijv. architect × aannemer), in willekeurige richting. */
export function filterOpRollen(verbanden: Verband[], rolA?: Rol, rolB?: Rol) {
  if (!rolA && !rolB) return verbanden;
  return verbanden.filter((v) => {
    const past = (x: Verband["a"], rol?: Rol) => !rol || x.rollen.includes(rol);
    return (past(v.a, rolA) && past(v.b, rolB)) || (past(v.a, rolB) && past(v.b, rolA));
  });
}

// ---------- US-22: bevestigde samenwerking (beheerder) tegenover een signaal ----------
export function samenwerkingSleutel(a: string, b: string) {
  return sleutel(a, b);
}

export function bevestiging(db: Pick<Database, "samenwerkingen">, a: string, b: string) {
  const k = sleutel(a, b);
  return (db.samenwerkingen ?? []).find((s) => sleutel(s.a, s.b) === k);
}

// ---------- US-23: terugkerende teamcombinaties ----------
export const TEAMROLLEN: Rol[] = ["architect", "adviseur", "installateur", "constructeur"];

export type TeamCombinatie = {
  sleutel: string;
  leden: Array<{ id: string; naam: string; rol: Rol }>;
  projecten: Array<{ id: string; naam: string; extern: boolean }>;
  aantal: number;
  /** Gemiddelde (geaccepteerde) evaluatie van de leden op de gedeelde projecten, 1–5; null = geen evaluaties. */
  evaluatie: number | null;
  evaluaties: number;
};

/**
 * Combinaties van partijen in de rollen architect, adviseur, installatie(adviseur) en constructeur die op meerdere projecten
 * samen voorkwamen. Gerangschikt op aantal gedeelde projecten en de evaluaties daarvan. Een combinatie die volledig opgaat in
 * een grotere met dezelfde projecten wordt weggelaten.
 */
export function teamCombinaties(db: Database, rollen: Rol[] = TEAMROLLEN, minProjecten = 2, max = 30): TeamCombinatie[] {
  const zichtbaarIds = new Set(db.partners.filter((p) => p.status !== "gearchiveerd" && p.status !== "concept").map((p) => p.id));
  const naam = (id: string) => db.partners.find((p) => p.id === id)?.naam ?? id;
  const perCombi = new Map<string, { leden: Map<string, Rol>; projecten: Set<string> }>();
  db.projecten.forEach((proj) => {
    const leden = new Map<string, Rol>();
    db.engagements
      .filter((e) => e.projectId === proj.id && rollen.includes(e.rol) && zichtbaarIds.has(e.partnerId))
      .forEach((e) => leden.set(e.partnerId, leden.get(e.partnerId) ?? e.rol));
    const ids = Array.from(leden.keys()).sort().slice(0, 8);
    // Alle deelverzamelingen van 2 t/m 4 leden.
    const n = ids.length;
    for (let mask = 1; mask < 1 << n; mask++) {
      const sub = ids.filter((_, i) => mask & (1 << i));
      if (sub.length < 2 || sub.length > 4) continue;
      const k = sub.join("|");
      const x = perCombi.get(k) ?? { leden: new Map(sub.map((id) => [id, leden.get(id)!])), projecten: new Set<string>() };
      x.projecten.add(proj.id);
      perCombi.set(k, x);
    }
  });
  const kandidaten = Array.from(perCombi.entries()).filter(([, x]) => x.projecten.size >= minProjecten);
  const projectSet = (x: { projecten: Set<string> }) => Array.from(x.projecten).sort().join(",");
  const uit: TeamCombinatie[] = kandidaten
    .filter(([k, x]) => !kandidaten.some(([k2, y]) => k2 !== k && k2.split("|").length > k.split("|").length && k.split("|").every((id) => k2.split("|").includes(id)) && projectSet(y) === projectSet(x)))
    .map(([k, x]) => {
      const ids = k.split("|");
      const evs = db.evaluaties.filter((e) => (e.status ?? "geaccepteerd") === "geaccepteerd" && ids.includes(e.partnerId) && x.projecten.has(e.projectId));
      const score = (e: (typeof evs)[number]) => (typeof e.totaalscore === "number" ? e.totaalscore : (e.kwaliteit + e.planning + e.budget + e.samenwerking + e.duurzaamheid) / 5);
      return {
        sleutel: k,
        leden: ids.map((id) => ({ id, naam: naam(id), rol: x.leden.get(id)! })),
        projecten: Array.from(x.projecten).map((id) => {
          const p = db.projecten.find((q) => q.id === id);
          return { id, naam: p?.naam ?? id, extern: Boolean(p?.extern) };
        }),
        aantal: x.projecten.size,
        evaluatie: evs.length ? Math.round((evs.reduce((s, e) => s + score(e), 0) / evs.length) * 10) / 10 : null,
        evaluaties: evs.length
      };
    });
  return uit.sort((a, b) => b.aantal - a.aantal || (b.evaluatie ?? 0) - (a.evaluatie ?? 0) || b.leden.length - a.leden.length).slice(0, max);
}
