// Factoren vaststellen op basis van projectinformatie: uit type, omvang, bouwstijl, prijssegment, ambitie en omschrijving
// worden per rol de eisen (factor, gevraagde waarde, gewicht) afgeleid. Startpunt is het best passende gewichtsprofiel;
// daarna worden opties en drempels op het project afgestemd. De gebruiker ziet en bevestigt het resultaat in de editor.
import { tokens } from "./embedding";
import type { Factor, Gewichtsprofiel, Project, ProjectRequirement, RequirementFactor, Rol } from "./types";
import { ROLLEN } from "./types";

export type AfgeleideEisen = {
  profielId: string;
  eisen: ProjectRequirement[];
  toelichting: string[];
  /** Kenmerken om partners rechtstreeks op te filteren (US-39), afgeleid uit dezelfde projectinformatie. */
  kenmerken: Array<{ factorId: string; optieId?: string; min?: number; label: string }>;
};

const HOUTBOUW = /(houtbouw|clt|hsb|houtskelet|biobased|circulair|demontabel|paris proof|mpg)/i;

function kiesProfiel(project: Project, profielen: Gewichtsprofiel[]) {
  const wil = (id: string) => profielen.find((p) => p.id === id) ?? profielen[0];
  if (project.type === "hoogbouw" || (project.type === "appartementen" && project.bouwstijl === "hoogstedelijk")) return { profiel: wil("binnenstedelijk-hoogbouw"), reden: "hoogbouw/hoogstedelijk programma" };
  if (project.type === "transformatie") return { profiel: wil("transformatie"), reden: "transformatieopgave" };
  if (project.ambitieDuurzaamheid >= 4 || HOUTBOUW.test(project.omschrijving)) return { profiel: wil("houtbouw-biobased"), reden: `duurzaamheidsambitie ${project.ambitieDuurzaamheid}/5${HOUTBOUW.test(project.omschrijving) ? " en houtbouw/biobased in de omschrijving" : ""}` };
  return { profiel: wil("grondgebonden-uitleg"), reden: "grondgebonden/uitleg programma" };
}

function normaliseer(eisen: RequirementFactor[], factoren: Factor[]) {
  const gewogen = eisen.filter((e) => factoren.find((f) => f.id === e.factorId)?.type === "gewogen");
  const som = gewogen.reduce((s, e) => s + e.gewicht, 0) || 1;
  let rest = 100;
  gewogen.forEach((e, i) => {
    e.gewicht = i === gewogen.length - 1 ? rest : Math.round((e.gewicht / som) * 100);
    rest -= e.gewicht;
  });
  return eisen;
}

export function leidEisenAf(project: Project, factoren: Factor[], profielen: Gewichtsprofiel[], rollen: Rol[] = ROLLEN.filter((r) => r !== "ontwikkelpartner")): AfgeleideEisen {
  const { profiel, reden } = kiesProfiel(project, profielen);
  const toelichting: string[] = [`Gewichtsprofiel '${profiel.naam}' gekozen op basis van ${reden}.`];
  const woorden = new Set(tokens(`${project.omschrijving} ${project.naam}`));
  const heeft = (id: string) => factoren.some((f) => f.id === id && f.actief);
  const ambitieNiveau = Math.min(5, Math.max(2, project.ambitieDuurzaamheid));
  const kenmerken: AfgeleideEisen["kenmerken"] = [];

  const eisen: ProjectRequirement[] = rollen
    .filter((rol) => profiel.perRol[rol]?.length)
    .map((rol) => {
      const basis: RequirementFactor[] = JSON.parse(JSON.stringify(profiel.perRol[rol] ?? []));
      const zet = (factorId: string, optieId: string | undefined, gevraagd: RequirementFactor["gevraagd"], gewicht: number, minimumeis?: boolean) => {
        if (!heeft(factorId)) return;
        const f = factoren.find((x) => x.id === factorId)!;
        if (f.rollen.length && !f.rollen.includes(rol)) return;
        const idx = basis.findIndex((e) => e.factorId === factorId && (optieId ? e.optieId === optieId : true));
        if (idx >= 0) basis[idx] = { ...basis[idx], optieId, gevraagd, minimumeis: minimumeis ?? basis[idx].minimumeis };
        else basis.push({ factorId, optieId, gevraagd, gewicht, minimumeis });
      };

      // Projecttype: vervang de optie van het profiel door het type van dit project
      const typeIdx = basis.findIndex((e) => e.factorId === "projecttype");
      if (typeIdx >= 0) basis[typeIdx] = { ...basis[typeIdx], optieId: project.type, gevraagd: 3 };
      else zet("projecttype", project.type, 3, 20);

      // Projectomvang als harde bandbreedte-eis (gewicht 0, factor is hard)
      zet("projectomvang", undefined, project.woningen, 0);

      // Bouwstijl -> architectuurstijl (ontwerpende rollen)
      if (rol === "architect") zet("architectuurstijl", project.bouwstijl, 3, 15);

      // Prijssegment: ervaring met het (eerste) segment
      if (project.prijssegment[0] && rol !== "leverancier") zet("prijssegment", project.prijssegment[0], 2, 8);

      // Duurzaamheidsambitie -> drempels op MPG/biobased/circulariteit
      if (project.ambitieDuurzaamheid >= 4 && rol !== "installateur") {
        zet("circulariteit", undefined, ambitieNiveau - 1, 10);
        if (project.ambitieDuurzaamheid === 5) zet("mpg", undefined, 0.5, 15);
      }
      if (project.ambitieDuurzaamheid >= 3 && rol === "installateur") zet("beng", undefined, project.ambitieDuurzaamheid >= 4 ? 25 : 35, 20);

      // Trefwoorden in de omschrijving -> bouwsysteem / kenmerken
      const woord = (...w: string[]) => w.some((x) => woorden.has(x));
      if (woord("houtbouw") && rol !== "installateur") zet("bouwsysteem", "houtbouw", 4, 25);
      if (woord("prefab") && (rol === "aannemer" || rol === "leverancier")) zet("prefabricage", undefined, 3, 10);
      if (woord("demontabel") && rol !== "installateur") zet("demontabel", undefined, 3, 10);
      if (woord("natuurinclusief") && (rol === "architect" || rol === "adviseur")) zet("natuurinclusief", undefined, 3, 10);
      if (woord("welstand") && rol === "architect") zet("welstand", undefined, 3, 15);
      if (woord("bouwteam")) zet("bouwteam", undefined, 3, 8);

      // Werkgebied/afstand als gewogen factor voor uitvoerende rollen
      if (rol === "aannemer" || rol === "installateur") zet("reisafstand", undefined, 60, 8);

      return { rol, eisen: normaliseer(basis, factoren), semantischGewicht: profiel.semantischGewicht, vrijeOmschrijving: project.omschrijving.slice(0, 200) };
    });

  // Kenmerken voor de partnerfilter
  kenmerken.push({ factorId: "projecttype", optieId: project.type, min: 2, label: `Ervaring met ${project.type} (≥2)` });
  if (project.ambitieDuurzaamheid >= 4) kenmerken.push({ factorId: "circulariteit", min: ambitieNiveau - 2, label: `Circulariteit ≥${ambitieNiveau - 2}` });
  if (project.ambitieDuurzaamheid === 5) kenmerken.push({ factorId: "mpg", min: 0.5, label: "MPG ≤ 0,5" });
  if (woorden.has("houtbouw")) kenmerken.push({ factorId: "bouwsysteem", optieId: "houtbouw", min: 3, label: "Houtbouw ≥3" });
  if (woorden.has("demontabel")) kenmerken.push({ factorId: "demontabel", min: 3, label: "Demontabel ≥3" });
  if (woorden.has("prefab")) kenmerken.push({ factorId: "prefabricage", min: 3, label: "Prefabricage ≥3" });
  if (woorden.has("welstand")) kenmerken.push({ factorId: "welstand", min: 3, label: "Welstandservaring ≥3" });
  if (woorden.has("natuurinclusief")) kenmerken.push({ factorId: "natuurinclusief", min: 3, label: "Natuurinclusief ≥3" });

  toelichting.push(`Projecttype '${project.type}' en omvang ${project.woningen} woningen zijn als eis gezet; bouwstijl '${project.bouwstijl}' voor de architect.`);
  if (project.ambitieDuurzaamheid >= 4) toelichting.push(`Duurzaamheidsambitie ${project.ambitieDuurzaamheid}/5 vertaald naar drempels op circulariteit${project.ambitieDuurzaamheid === 5 ? ", MPG ≤ 0,5" : ""} en BENG.`);
  const gevonden = ["houtbouw", "prefab", "demontabel", "natuurinclusief", "welstand", "bouwteam"].filter((w) => woorden.has(w));
  if (gevonden.length) toelichting.push(`Uit de omschrijving herkend: ${gevonden.join(", ")}.`);
  toelichting.push("Gewichten zijn per rol herverdeeld tot 100%. Controleer en pas aan voordat u opslaat.");

  return { profielId: profiel.id, eisen, toelichting, kenmerken };
}
