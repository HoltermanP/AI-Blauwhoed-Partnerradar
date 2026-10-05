// US-70: onderbouwing van matchresultaten en analyse van verbanden zonder AI (regelgebaseerde terugval). Met AI-sleutel
// doet het ingestelde model (US-59) dit in gewone taal; de uitkomst blijft een onderbouwde eerste selectie resp. een signaal.
import type { Verband } from "./verbanden";
import type { CriteriumScore, Kandidaat, RolResultaat, Verificatie } from "./types";
import { ROL_LABEL } from "../format";

const VERIFICATIE_KORT: Record<Verificatie, string> = { beheerder: "geverifieerd door een beheerder", gebruiker: "geverifieerd door een gebruiker", niet: "nog niet geverifieerd", verouderd: "verouderd", berekend: "uit projecthistorie" };

function lijst(items: string[]) {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} en ${items[items.length - 1]}`;
}

/** Feitelijke kern van een criterium ("niveau 4 van gevraagd 3"), zonder de bronvermelding. */
function kern(c: CriteriumScore) {
  const t = c.toelichting.split(" Bron:")[0].trim().replace(/\.$/, "");
  return t ? t.charAt(0).toLowerCase() + t.slice(1) : "";
}

function criteriumZin(c: CriteriumScore) {
  const delen = [kern(c), c.verificatie ? VERIFICATIE_KORT[c.verificatie] : ""].filter(Boolean);
  return `${c.factorNaam.toLowerCase()}${delen.length ? ` (${delen.join("; ")})` : ""}`;
}

/**
 * Onderbouwing in gewone taal voor één kandidaat, opgesteld uit dezelfde gegevens als de score: waarom de partner
 * matcht, waar hij minder sterk is, hoeveel van de gebruikte gegevens geverifieerd is en wat ontbreekt.
 */
export function onderbouwKandidaat(k: Kandidaat): { tekst: string; aandachtspunten: string[] } {
  const rol = ROL_LABEL[k.rol].toLowerCase();
  const bekend = k.criteria.filter((c) => c.fit !== null);
  // Sterk = voldoet (vrijwel) aan de eis; zwak = blijft er duidelijk onder. Oude runs zonder basisFit vallen terug op de fit.
  const basis = (c: CriteriumScore) => c.basisFit ?? c.fit ?? 0;
  const sterk = [...bekend].filter((c) => basis(c) >= 0.9).sort((a, b) => b.bijdrage - a.bijdrage).slice(0, 3);
  const zwak = [...bekend].filter((c) => basis(c) < 0.6).sort((a, b) => b.effectiefGewicht - a.effectiefGewicht).slice(0, 2);
  const onbekend = k.criteria.filter((c) => c.fit === null).map((c) => c.factorNaam.toLowerCase());
  const nietGeverifieerd = bekend.filter((c) => c.verificatie === "niet" || c.verificatie === "verouderd");
  const oordeel = k.score >= 75 ? "past daarmee goed bij dit project" : k.score >= 55 ? "past daarmee redelijk bij dit project" : "past daarmee matig bij dit project";
  const dun = bekend.length > 0 && k.dekkingsgraad < 60 ? `, al rust die score op weinig gegevens (voor ${k.dekkingsgraad}% van het gewicht is iets bekend)` : "";
  const zinnen: string[] = [`${k.partnerNaam} scoort ${k.score} van 100 als ${rol} en ${oordeel}${dun}.`];
  if (sterk.length) zinnen.push(`De partner is het sterkst op ${lijst(sterk.map(criteriumZin))}.`);
  else if (bekend.length) zinnen.push("Op geen van de gewogen criteria is de partner duidelijk sterk.");
  if (zwak.length) zinnen.push(`Minder sterk is de partner op ${lijst(zwak.map(criteriumZin))}.`);
  const treffers = k.semantischeTreffers.filter((t) => !t.startsWith("profiel gevoed door"));
  if (k.semantischeScore !== null && k.semantischeScore >= 25) zinnen.push(`Het profiel sluit inhoudelijk aan bij de projectomschrijving${treffers.length ? ` (onder meer ${lijst(treffers.slice(0, 4))})` : ""}.`);
  if (k.afstandKm !== null && !k.criteria.some((c) => c.factorId === "reisafstand")) zinnen.push(`De vestiging ligt op ${k.afstandKm} km van de projectlocatie.`);
  if (bekend.length) {
    const vg = k.verificatiegraad ?? 0;
    zinnen.push(
      vg >= 100
        ? "Alle gegevens waarop de score rust zijn geverifieerd of komen uit projecthistorie."
        : `${vg}% van de gegevens waarop de score rust is geverifieerd of komt uit projecthistorie; ${lijst(nietGeverifieerd.slice(0, 3).map((c) => c.factorNaam.toLowerCase()))}${nietGeverifieerd.length > 3 ? " en andere" : ""} ${nietGeverifieerd.length === 1 ? "is" : "zijn"} nog niet geverifieerd en ${nietGeverifieerd.length === 1 ? "telt" : "tellen"} daarom minder zwaar mee.`
    );
  } else zinnen.push("Er zijn geen gegevens bekend voor de gewogen criteria; de score rust alleen op de inhoudelijke gelijkenis.");
  if (onbekend.length) zinnen.push(`Voor ${lijst(onbekend.slice(0, 4))}${onbekend.length > 4 ? ` en ${onbekend.length - 4} andere` : ""} zijn geen gegevens bekend; die tellen niet mee.`);
  const aandachtspunten = [...k.waarschuwingen, ...bekend.filter((c) => c.bron === "web" && c.verificatie === "niet").slice(0, 2).map((c) => `${c.factorNaam} komt uit een indicatieve internetbron en is nog niet geverifieerd`)];
  return { tekst: zinnen.join(" "), aandachtspunten };
}

/** Onderbouwing per kandidaat voor de run (regels); gebruikt de bij de matching opgestelde tekst als die er is. */
export function regelOnderbouwingKandidaat(k: Kandidaat) {
  const o = k.onderbouwing ?? onderbouwKandidaat(k);
  return { partnerId: k.partnerId, onderbouwing: o.tekst, aandachtspunten: o.aandachtspunten };
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
