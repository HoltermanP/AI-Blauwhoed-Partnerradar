// US-70: onderbouwing van matchresultaten en analyse van verbanden zonder AI (regelgebaseerde terugval). Met AI-sleutel
// doet het ingestelde model (US-59) dit in gewone taal; de uitkomst blijft een onderbouwde eerste selectie resp. een signaal.
import type { Verband } from "./verbanden";
import type { Kandidaat, RolResultaat } from "./types";
import { ROL_LABEL } from "../format";

export function regelOnderbouwingKandidaat(k: Kandidaat) {
  const bijdragen = [...k.criteria].filter((c) => c.fit !== null).sort((a, b) => b.bijdrage - a.bijdrage);
  const sterk = bijdragen.slice(0, 2).map((c) => `${c.factorNaam} (${c.toelichting.split(/\.\s/)[0].replace(/\.$/, "")})`);
  const zwak = bijdragen.filter((c) => (c.fit ?? 1) < 0.5).slice(0, 2).map((c) => c.factorNaam);
  const onbekend = k.criteria.filter((c) => c.fit === null).map((c) => c.factorNaam);
  const aandacht = [...k.waarschuwingen, ...(onbekend.length ? [`Geen gegevens voor: ${onbekend.slice(0, 4).join(", ")}`] : []), ...k.criteria.filter((c) => c.bron === "web").slice(0, 2).map((c) => `${c.factorNaam} komt uit een indicatieve internetbron`)];
  return {
    partnerId: k.partnerId,
    onderbouwing: `Score ${k.score} bij een dekkingsgraad van ${k.dekkingsgraad}%.${sterk.length ? ` Draagt vooral bij: ${sterk.join("; ")}.` : ""}${zwak.length ? ` Minder sterk op ${zwak.join(", ")}.` : ""}`,
    aandachtspunten: aandacht
  };
}

export function regelOnderbouwingRol(r: RolResultaat, max = 5) {
  const top = r.kandidaten.slice(0, max);
  return {
    rol: r.rol,
    samenvatting: top.length ? `${top.length} kandidaat/kandidaten voor ${ROL_LABEL[r.rol].toLowerCase()}; ${r.uitsluitingen.length} uitgesloten op harde criteria.${top.some((k) => k.dekkingsgraad < 60) ? " Een deel van de scores rust op weinig bekende gegevens." : ""}` : `Geen kandidaten voor ${ROL_LABEL[r.rol].toLowerCase()}.`,
    perKandidaat: top.map(regelOnderbouwingKandidaat)
  };
}

/** Verbandanalyse zonder AI: welke rolcombinaties komen het vaakst voor, met voorbeeld-bronnen. */
export function regelVerbandAnalyse(verbanden: Verband[]) {
  const perCombinatie = new Map<string, { aantal: number; voorbeelden: string[]; bronnen: string[] }>();
  verbanden.forEach((v) => {
    v.a.rollen.forEach((ra) =>
      v.b.rollen.forEach((rb) => {
        const k = [ROL_LABEL[ra], ROL_LABEL[rb]].sort().join(" × ");
        const x = perCombinatie.get(k) ?? { aantal: 0, voorbeelden: [], bronnen: [] };
        x.aantal++;
        if (x.voorbeelden.length < 3) x.voorbeelden.push(`${v.a.naam} – ${v.b.naam}`);
        v.bronnen.slice(0, 1).forEach((b) => x.bronnen.length < 3 && x.bronnen.push(b.label));
        perCombinatie.set(k, x);
      })
    );
  });
  return {
    patronen: Array.from(perCombinatie.entries())
      .sort((a, b) => b[1].aantal - a[1].aantal)
      .slice(0, 6)
      .map(([titel, x]) => ({ titel: `${titel}: ${x.aantal} verband(en)`, toelichting: `Bijvoorbeeld ${x.voorbeelden.join("; ")}.`, bronnen: x.bronnen })),
    kanttekeningen: ["Uit bronnen afgeleide signalen; geen bevestiging van samenwerking of exclusiviteit.", "Niet bedoeld voor extern gebruik."]
  };
}
