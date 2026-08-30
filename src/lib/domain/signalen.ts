// Dashboard-signalen: certificaten (US-06), risico (US-32), afhankelijkheid (US-33), prospects (US-28), evaluaties (US-21).
import { leidFactorenAf } from "./derive";
import type { Database, Financieel, Partner, Signaal } from "./types";

export function risicoklasse(f: Financieel | undefined, nu = new Date()): Financieel["risicoklasse"] {
  if (!f) return undefined;
  let punten = 0;
  if (f.omzetVorigJaar && f.omzet < f.omzetVorigJaar * 0.8) punten += 2;
  if (f.solvabiliteit !== undefined && f.solvabiliteit < 20) punten += 2;
  else if (f.solvabiliteit !== undefined && f.solvabiliteit < 30) punten += 1;
  if (f.laatsteDeponering && (nu.getTime() - new Date(f.laatsteDeponering).getTime()) / (24 * 3600 * 1000) > 400) punten += 2;
  if (f.betalingsgedrag === "slecht") punten += 2;
  else if (f.betalingsgedrag === "matig") punten += 1;
  if (f.eigenVermogen !== undefined && f.eigenVermogen < 0) punten += 3;
  if (punten >= 4) return "hoog";
  if (punten >= 2) return "midden";
  return "laag";
}

export function signalenVoor(db: Database, nu = new Date()): Signaal[] {
  const signalen: Signaal[] = [];
  const dag = 24 * 3600 * 1000;

  db.partners.forEach((p: Partner) => {
    p.certificaten.forEach((c) => {
      const dagen = Math.round((new Date(c.geldigTot).getTime() - nu.getTime()) / dag);
      if (dagen < 0)
        signalen.push({ id: `cert-${c.id}`, soort: "certificaat", ernst: "kritiek", titel: `${c.type} verlopen`, omschrijving: `${p.naam}: ${c.type} is verlopen op ${c.geldigTot}. Telt niet mee in de matchscore.`, partnerId: p.id, link: `/partners/${p.id}` });
      else if (dagen <= 90)
        signalen.push({ id: `cert-${c.id}`, soort: "certificaat", ernst: "waarschuwing", titel: `${c.type} verloopt over ${dagen} dagen`, omschrijving: `${p.naam}: ${c.type} (${c.nummer}) verloopt op ${c.geldigTot}.`, partnerId: p.id, link: `/partners/${p.id}` });
    });
    const klasse = p.financieel?.risicoklasse ?? risicoklasse(p.financieel, nu);
    if (klasse === "hoog") signalen.push({ id: `risico-${p.id}`, soort: "risico", ernst: "kritiek", titel: `Continuïteitsrisico ${p.naam}`, omschrijving: p.financieel?.toelichting ?? "Financiële kerncijfers wijzen op hoog risico.", partnerId: p.id, link: `/partners/${p.id}` });
    else if (klasse === "midden") signalen.push({ id: `risico-${p.id}`, soort: "risico", ernst: "waarschuwing", titel: `Financieel signaal ${p.naam}`, omschrijving: p.financieel?.toelichting ?? "Kerncijfers vragen aandacht.", partnerId: p.id, link: `/partners/${p.id}` });
    const afgeleid = leidFactorenAf(p, db, nu);
    if (afgeleid.statistieken.blauwhoedAandeel !== null && afgeleid.statistieken.blauwhoedAandeel >= 30)
      signalen.push({ id: `afh-${p.id}`, soort: "afhankelijkheid", ernst: afgeleid.statistieken.blauwhoedAandeel >= 50 ? "kritiek" : "waarschuwing", titel: `Afhankelijkheid ${p.naam}: ${afgeleid.statistieken.blauwhoedAandeel}%`, omschrijving: `Blauwhoed is ${afgeleid.statistieken.blauwhoedAandeel}% van de jaaromzet van ${p.naam}. Bewaak spreiding.`, partnerId: p.id, link: `/partners/${p.id}` });
  });

  // Projecten waar één partner onmisbaar is (US-33): partner met >60% van contractwaarde in project
  db.projecten.forEach((proj) => {
    const eng = db.engagements.filter((e) => e.projectId === proj.id);
    const totaal = eng.reduce((s, e) => s + e.contractwaarde, 0);
    eng.forEach((e) => {
      if (totaal && e.contractwaarde / totaal > 0.6 && eng.length > 1) {
        const p = db.partners.find((x) => x.id === e.partnerId);
        signalen.push({ id: `onmisbaar-${e.id}`, soort: "afhankelijkheid", ernst: "info", titel: `${p?.naam ?? e.partnerId} onmisbaar in ${proj.naam}`, omschrijving: `${Math.round((e.contractwaarde / totaal) * 100)}% van de contractwaarde zit bij één partner.`, projectId: proj.id, partnerId: e.partnerId, link: `/projecten/${proj.id}` });
      }
    });
    // Evaluatieherinnering (US-21)
    if (proj.fase === "opgeleverd" || proj.fase === "nazorg") {
      eng.forEach((e) => {
        if (!db.evaluaties.some((ev) => ev.engagementId === e.id)) {
          const p = db.partners.find((x) => x.id === e.partnerId);
          signalen.push({ id: `eval-${e.id}`, soort: "evaluatie", ernst: "waarschuwing", titel: `Beoordeling ontbreekt: ${p?.naam ?? e.partnerId}`, omschrijving: `${proj.naam} is opgeleverd; beoordeel ${p?.naam ?? "partner"} (${e.rol}) op kwaliteit, planning, budget, samenwerking en duurzaamheid.`, projectId: proj.id, partnerId: e.partnerId, link: `/projecten/${proj.id}/evaluaties?engagement=${e.id}` });
        }
      });
    }
  });

  // US-28: prospect die structureel beter scoort dan de vaste kring
  const tellingen = new Map<string, { beter: number; runs: number; naam: string }>();
  db.matchRuns.forEach((run) =>
    run.resultaat.forEach((r) => {
      const derde = r.kandidaten[2]?.score ?? r.kandidaten[r.kandidaten.length - 1]?.score ?? 0;
      r.prospects.forEach((pr) => {
        const t = tellingen.get(pr.partnerId) ?? { beter: 0, runs: 0, naam: pr.partnerNaam };
        t.runs++;
        if (pr.score > derde) t.beter++;
        tellingen.set(pr.partnerId, t);
      });
    })
  );
  tellingen.forEach((t, id) => {
    if (t.runs >= 2 && t.beter / t.runs >= 0.6)
      signalen.push({ id: `prospect-${id}`, soort: "prospect", ernst: "info", titel: `Prospect ${t.naam} scoort structureel hoog`, omschrijving: `In ${t.beter} van ${t.runs} matchruns scoort deze prospect boven de top-3 van de vaste kring. Overweeg kwalificatie.`, partnerId: id, link: `/partners/${id}` });
  });

  const rang = { kritiek: 0, waarschuwing: 1, info: 2 };
  return signalen.sort((a, b) => rang[a.ernst] - rang[b.ernst]);
}
