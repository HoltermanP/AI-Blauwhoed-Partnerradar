// Dwarsdoorsnijdende eis 1: herkomst en status per veldwaarde.
// - alleen een mens valideert (acties zetten status 'gevalideerd' met naam en datum);
// - 'verouderd' wordt hier berekend uit peildatum + de per factor ingestelde vervaltermijn;
// - herkomst is per partner exporteerbaar en verwijderbaar (AVG).
import type { Factor, FactorWaardeStatus, Partner, PartnerFactor } from "./types";

/** Effectieve status van een waarde: expliciete status, automatisch 'verouderd' na de vervaltermijn van de factor. */
export function effectieveStatus(pf: PartnerFactor, factor: Factor | undefined, nu = new Date()): FactorWaardeStatus | undefined {
  if (pf.afgeleid) return undefined; // berekende waarden hebben geen validatiestatus
  const basis = pf.status ?? "voorgesteld";
  if (basis !== "verouderd" && factor?.vervalMaanden && pf.peildatum) {
    const grens = new Date(nu);
    grens.setMonth(grens.getMonth() - factor.vervalMaanden);
    if (new Date(pf.peildatum) < grens) return "verouderd";
  }
  return basis;
}

export function isVerouderd(pf: PartnerFactor, factor: Factor | undefined, nu = new Date()) {
  return effectieveStatus(pf, factor, nu) === "verouderd";
}

export const STATUS_WAARDE_LABEL: Record<FactorWaardeStatus, string> = { voorgesteld: "voorgesteld", gevalideerd: "gevalideerd", verouderd: "verouderd" };

/** AVG: alle herkomstinformatie van één partner als exporteerbaar object. */
export function herkomstExport(partner: Partner, factoren: Factor[], nu = new Date()) {
  const fmap = new Map(factoren.map((f) => [f.id, f]));
  return {
    partner: { id: partner.id, naam: partner.naam, kvk: partner.kvk },
    geexporteerdOp: nu.toISOString(),
    waarden: partner.factoren.map((pf) => {
      const f = fmap.get(pf.factorId);
      return {
        veld: f ? (pf.optieId ? `${f.naam}: ${f.opties?.find((o) => o.id === pf.optieId)?.label ?? pf.optieId}` : f.naam) : pf.factorId,
        waarde: pf.waarde,
        bron: pf.bron,
        bronDetail: pf.bewijs ? { soort: pf.bewijs.soort, referentie: pf.bewijs.ref, label: pf.bewijs.label } : null,
        vastgesteldOp: pf.peildatum,
        betrouwbaarheid: pf.betrouwbaarheid >= 0.7 ? "hoog" : pf.betrouwbaarheid >= 0.45 ? "midden" : "laag",
        status: effectieveStatus(pf, f, nu) ?? "afgeleid",
        gevalideerdDoor: pf.gevalideerdDoor ?? null,
        gevalideerdOp: pf.gevalideerdOp ?? null,
        toelichting: pf.toelichting ?? null
      };
    }),
    bronnen: partner.bronnen,
    brongegevens: (partner.brongegevens ?? []).map((b) => ({ bron: b.bron, op: b.op, titel: b.titel ?? null, velden: b.velden }))
  };
}

/** AVG: verwijder alle herkomstinformatie van één partner. Waarden blijven staan, maar zonder bron- en bewijsdetails. */
export function wisHerkomst(partner: Partner) {
  let gewist = partner.bronnen.length + (partner.brongegevens?.length ?? 0);
  partner.bronnen = [];
  partner.brongegevens = [];
  partner.factoren.forEach((pf) => {
    if (pf.bewijs || pf.toelichting) gewist++;
    delete pf.bewijs;
    delete pf.toelichting;
  });
  return gewist;
}
