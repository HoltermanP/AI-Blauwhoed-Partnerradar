// Epic 8: teamsamenstelling. Je matcht een team, geen losse partij (uitgangspunt 5).
import { samenwerking } from "./derive";
import { afstandKm } from "./geo";
import type { Database, Kandidaat, MatchRun, Project, RolResultaat, TeamLid, TeamVoorstel } from "./types";

type Optie = { rol: RolResultaat["rol"]; kandidaat: Kandidaat };

function combinaties(perRol: Optie[][]): Optie[][] {
  return perRol.reduce<Optie[][]>((acc, opties) => acc.flatMap((combo) => opties.map((o) => [...combo, o])), [[]]);
}

export function scoreTeam(leden: Optie[], db: Database, project: Project) {
  const partners = leden.map((l) => db.partners.find((p) => p.id === l.kandidaat.partnerId)!).filter(Boolean);
  const gemiddeldeKwaliteit = leden.length ? leden.reduce((s, l) => s + l.kandidaat.score, 0) / leden.length : 0;

  // Samenwerkingshistorie: aandeel paren dat eerder samenwerkte, gewogen met samenwerkingsscore
  let paren = 0;
  let samenScore = 0;
  const onderbouwing: string[] = [];
  for (let i = 0; i < partners.length; i++)
    for (let j = i + 1; j < partners.length; j++) {
      paren++;
      const s = samenwerking(db, partners[i].id, partners[j].id);
      if (s.aantal) {
        const kwaliteit = s.gemiddeldeSamenwerking ? s.gemiddeldeSamenwerking / 5 : 0.7;
        samenScore += Math.min(1, 0.6 + s.aantal * 0.2) * kwaliteit;
        onderbouwing.push(`${partners[i].naam} en ${partners[j].naam} werkten ${s.aantal}× samen${s.gemiddeldeSamenwerking ? ` (samenwerking ${s.gemiddeldeSamenwerking.toFixed(1)}/5)` : ""}.`);
      }
    }
  const samenwerkingshistorie = paren ? (samenScore / paren) * 100 : 50;
  if (!onderbouwing.length && partners.length > 1) onderbouwing.push("Geen van deze partijen werkte eerder samen op een Blauwhoed-project: risico op inwerktijd.");

  // Nabijheid: gemiddelde afstand tot projectlocatie, 0 km = 100, 100 km = 0
  const afstanden = partners.map((p) => afstandKm(p.locatie, project.locatie));
  const gemAfstand = afstanden.length ? afstanden.reduce((s, x) => s + x, 0) / afstanden.length : 0;
  const nabijheid = Math.max(0, 100 - gemAfstand);

  // Gezamenlijke beschikbaarheid in de projectperiode (deels niet beschikbaar drukt de score)
  const beschikbaarheid =
    (partners.filter((p) => !p.beschikbaarheid.some((b) => !b.beschikbaar && new Date(b.van) <= new Date(project.planning.eind) && new Date(project.planning.start) <= new Date(b.tot))).length /
      Math.max(partners.length, 1)) *
    100;

  const teamScore = Math.round(gemiddeldeKwaliteit * 0.5 + samenwerkingshistorie * 0.25 + nabijheid * 0.15 + beschikbaarheid * 0.1);
  return {
    teamScore,
    onderdelen: {
      gemiddeldeKwaliteit: Math.round(gemiddeldeKwaliteit),
      samenwerkingshistorie: Math.round(samenwerkingshistorie),
      nabijheid: Math.round(nabijheid),
      beschikbaarheid: Math.round(beschikbaarheid)
    },
    onderbouwing
  };
}

/** US-35/36: beste team over alle rollen, met teamscore die samenwerking, nabijheid en beschikbaarheid meeweegt. */
export function stelTeamSamen(run: MatchRun, db: Database, project: Project, variant: "voorkeur" | "alternatief" = "voorkeur", uitsluiten: string[] = []): TeamVoorstel | null {
  const perRol: Optie[][] = run.resultaat
    .map((r) => {
      let pool = r.kandidaten.filter((k) => !uitsluiten.includes(k.partnerId));
      if (variant === "alternatief") {
        // US-37: bewust afwijken: prospects toestaan en partijen die al in het voorkeursteam zaten mijden
        pool = [...pool, ...r.prospects.filter((k) => !uitsluiten.includes(k.partnerId))];
      }
      return pool.slice(0, variant === "alternatief" ? 5 : 4).map((kandidaat) => ({ rol: r.rol, kandidaat }));
    })
    .filter((o) => o.length);
  if (!perRol.length) return null;

  let beste: { leden: Optie[]; score: ReturnType<typeof scoreTeam> } | null = null;
  const alle = combinaties(perRol).filter((combo) => new Set(combo.map((c) => c.kandidaat.partnerId)).size === combo.length);
  for (const combo of alle.slice(0, 4000)) {
    const score = scoreTeam(combo, db, project);
    if (!beste || score.teamScore > beste.score.teamScore) beste = { leden: combo, score };
  }
  if (!beste) return null;

  const leden: TeamLid[] = beste.leden.map((l) => ({ rol: l.rol, partnerId: l.kandidaat.partnerId, partnerNaam: l.kandidaat.partnerNaam, score: l.kandidaat.score }));
  const onderbouwing = [
    ...beste.leden.map((l) => {
      const top = l.kandidaat.criteria.filter((c) => c.fit !== null).sort((a, b) => b.bijdrage - a.bijdrage).slice(0, 2);
      return `${l.rol}: ${l.kandidaat.partnerNaam} (score ${l.kandidaat.score}, dekking ${l.kandidaat.dekkingsgraad}%)${top.length ? ` — sterk op ${top.map((c) => c.factorNaam).join(" en ")}` : ""}${l.kandidaat.isProspect ? " — prospect, nog niet gekwalificeerd" : ""}.`;
    }),
    ...beste.score.onderbouwing
  ];
  return {
    id: `team-${Date.now().toString(36)}-${variant}`,
    projectId: project.id,
    matchRunId: run.id,
    variant,
    leden,
    teamScore: beste.score.teamScore,
    onderdelen: beste.score.onderdelen,
    onderbouwing,
    gemaaktOp: new Date().toISOString()
  };
}
