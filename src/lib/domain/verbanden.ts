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
  const partners = db.partners.filter((p) => p.status !== "geblokkeerd" && (p.status as string) !== "gearchiveerd");
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
        if (a && b) voeg(a, b, { soort: "project", ref: proj.id, label: proj.naam });
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
