// Verwerking van verrijkingsvoorstellen vóór ze in de wachtrij komen:
// - conflict met een door een mens gevalideerde waarde (factor én basisveld, US-52);
// - bronrangorde: hoogste rang wint, lager is 'alternatief'; goudstandaard gaat altijd voor (US-49/US-50);
// - velden zonder betrouwbare bron worden gemarkeerd in plaats van gevuld (US-53).
import { basisveldWaarde, bronRang, effectieveStatus, vergelijkHerkomst, geenBronSleutel, markeerAlternatieven, wisGeenBron, zetBasisveldHerkomst } from "./herkomst";
import { veldGevuld } from "./goudstandaard";
import { vaststellingVan, waardePastBijFactor } from "./verificatie";
import { BASISVELD_VAN_LABEL, leesSbi } from "./webverrijking";
import type { BasisVeld, EnrichmentVoorstel, Factor, Partner, PartnerFactor } from "./types";

/** Optie van een factorvoorstel: expliciet, of af te leiden uit het veldlabel ("Bouwsysteem: houtbouw"). */
export function optieVanVoorstel(v: EnrichmentVoorstel, factoren: Factor[]): string | undefined {
  if (v.optieId) return v.optieId;
  if (!v.veld.includes(":")) return undefined;
  const label = v.veld.split(":").slice(1).join(":").trim().toLowerCase();
  return factoren.find((f) => f.id === v.factorId)?.opties?.find((o) => o.label.toLowerCase() === label || o.id === label.replace(/ /g, "_"))?.id;
}

export function huidigeFactorwaarde(p: Partner, v: EnrichmentVoorstel, factoren: Factor[]): PartnerFactor | undefined {
  if (!v.factorId) return undefined;
  const optie = optieVanVoorstel(v, factoren);
  return p.factoren.find((x) => x.factorId === v.factorId && (x.optieId ?? "") === (optie ?? ""));
}

/** Herkomst van de huidige waarde waarop een voorstel betrekking heeft. */
export function huidigeHerkomst(p: Partner, v: EnrichmentVoorstel, factoren: Factor[]) {
  if (v.factorId) {
    const pf = huidigeFactorwaarde(p, v, factoren);
    return pf ? { bron: pf.bron, betrouwbaarheid: pf.betrouwbaarheid, status: effectieveStatus(pf, factoren.find((f) => f.id === pf.factorId)), waarde: pf.waarde } : undefined;
  }
  const veld = BASISVELD_VAN_LABEL[v.veld];
  const h = veld ? p.veldHerkomst?.[veld] : undefined;
  return h ? { bron: h.bron, betrouwbaarheid: h.betrouwbaarheid, status: h.status, waarde: v.huidig } : undefined;
}

/** Markeer conflicten met gevalideerde waarden, de aard (nieuw/gewijzigd) en alternatieven op bronrang. */
export function verwerkVoorstellen(p: Partner, voorstellen: EnrichmentVoorstel[], factoren: Factor[]) {
  voorstellen.forEach((v) => {
    if (v.factorId && !v.optieId) v.optieId = optieVanVoorstel(v, factoren);
    v.aard = v.aard ?? (v.huidig === null || v.huidig === "" ? "nieuw" : "gewijzigd");
    if (v.aard === "niet_bevestigd") return;
    const h = huidigeHerkomst(p, v, factoren);
    if (h && h.status === "gevalideerd" && JSON.stringify(h.waarde) !== JSON.stringify(v.voorgesteld)) v.conflictMetGevalideerd = true;
  });
  markeerAlternatieven(voorstellen, (v) => huidigeHerkomst(p, v, factoren));
}

/** US-53: gezochte velden die leeg zijn gebleven en waarvoor geen enkel voorstel is gevonden. */
export function veldenZonderBron(p: Partner, voorstellen: EnrichmentVoorstel[], gezocht: string[]) {
  const gevonden = new Set(
    voorstellen.map((v) => {
      if (v.factorId) return geenBronSleutel({ factorId: v.factorId });
      const veld = BASISVELD_VAN_LABEL[v.veld];
      return veld ? geenBronSleutel({ basisveld: veld }) : "";
    })
  );
  return gezocht.filter((s) => !veldGevuld(p, s) && !gevonden.has(s.replace(/\/.*$/, "")));
}

// ---------- Automatisch invullen ----------
// Zoveel mogelijk kenmerken gevuld krijgen zonder dat een mens elk voorstel eerst hoeft te accepteren: een gevonden
// waarde gaat direct in het profiel met het label 'niet geverifieerd · feitelijk' of 'niet geverifieerd · ingeschat'
// (telt minder zwaar in de matching, een inschatting het minst), mits
// - het veld leeg is, of de huidige waarde zelf niet geverifieerd is en uit een gelijke of lagere bronrang komt;
//   een feit vervangt altijd een inschatting, een inschatting vervangt nooit een feit;
// - er geen conflict is met een geverifieerde waarde of de goudstandaard, en het voorstel geen alternatief is;
// - de waarde past bij de schaal van de factor.
// Al het andere blijft een voorstel in de wachtrij.

/** Basisvelden die (alleen als ze leeg zijn) automatisch worden ingevuld; plaats vraagt geocodering en blijft handmatig. */
const AUTOMATISCHE_BASISVELDEN: BasisVeld[] = ["website", "kvk", "omschrijving", "adres", "statutaireNaam", "oprichtingsdatum", "telefoon", "email", "sbiActiviteiten"];

export function automatischToepasbaar(p: Partner, v: EnrichmentVoorstel, factoren: Factor[], nu = new Date()): boolean {
  if (v.status !== "open" || v.aard === "niet_bevestigd" || v.alternatief || v.conflictMetGevalideerd || v.goudstandaardGaatVoor) return false;
  if (v.factorId) {
    const factor = factoren.find((f) => f.id === v.factorId);
    if (!factor || !factor.actief || factor.afgeleid) return false;
    const optie = optieVanVoorstel(v, factoren);
    if (!waardePastBijFactor(factor, v.voorgesteld, optie)) return false;
    const huidig = huidigeFactorwaarde(p, v, factoren);
    if (!huidig) return true;
    if (huidig.afgeleid || huidig.overschrijving) return false;
    // US-04: een afgewezen waarde komt niet automatisch terug; een andere waarde mag het veld wel (opnieuw als voorstel) vullen.
    if (huidig.status === "afgewezen") return JSON.stringify(huidig.waarde) !== JSON.stringify(v.voorgesteld);
    const st = effectieveStatus(huidig, factor, nu);
    if (st === "gevalideerd") return false;
    if (st !== "verouderd" && vaststellingVan(v) !== vaststellingVan(huidig)) return vaststellingVan(v) === "feitelijk";
    // Alleen vervangen door een minstens zo goede bron (lagere rang = beter).
    return bronRang(v.bron) < bronRang(huidig.bron) || (bronRang(v.bron) === bronRang(huidig.bron) && v.betrouwbaarheid >= huidig.betrouwbaarheid) || st === "verouderd";
  }
  const veld = BASISVELD_VAN_LABEL[v.veld];
  if (!veld || !AUTOMATISCHE_BASISVELDEN.includes(veld) || basisveldWaarde(p, veld)) return false;
  const w = String(v.voorgesteld ?? "").trim();
  if (!w) return false;
  if (p.veldHerkomst?.[veld]?.afwijzing?.waarde === w) return false;
  if (veld === "kvk") return /^\d{8}$/.test(w);
  if (veld === "website") return /^https?:\/\//.test(w);
  return true;
}

/** Volgorde voor automatisch invullen: feiten vóór inschattingen, daarna de beste bron. */
export function vergelijkVoorAutomatisch(a: EnrichmentVoorstel, b: EnrichmentVoorstel) {
  return (vaststellingVan(a) === "ingeschat" ? 1 : 0) - (vaststellingVan(b) === "ingeschat" ? 1 : 0) || vergelijkHerkomst(a, b);
}

/** Zet een toepasbaar voorstel in het profiel als 'niet geverifieerd' en markeer het voorstel als automatisch toegepast. */
export function pasAutomatischToe(p: Partner, v: EnrichmentVoorstel, factoren: Factor[], nu = new Date()) {
  const dag = v.gevondenOp.slice(0, 10) || nu.toISOString().slice(0, 10);
  if (v.factorId) {
    const optie = optieVanVoorstel(v, factoren);
    const record: PartnerFactor = { factorId: v.factorId, optieId: optie, waarde: v.voorgesteld, bron: v.bron, betrouwbaarheid: v.betrouwbaarheid, bewijs: { soort: v.bron === "document" ? "document" : "url", ref: v.bronUrl ?? "", label: v.bronNaam ?? v.bronUrl ?? v.bron }, peildatum: dag, status: "voorgesteld", automatisch: true, vaststelling: vaststellingVan(v), onderbouwing: v.onderbouwing, toelichting: `${v.soort}: ${v.citaat}` };
    const idx = p.factoren.findIndex((x) => x.factorId === record.factorId && (x.optieId ?? "") === (record.optieId ?? ""));
    if (idx >= 0) p.factoren[idx] = record;
    else p.factoren.push(record);
    wisGeenBron(p, geenBronSleutel({ factorId: v.factorId }));
  } else {
    const veld = BASISVELD_VAN_LABEL[v.veld];
    const w = String(v.voorgesteld).trim();
    if (veld === "sbiActiviteiten") p.sbiActiviteiten = leesSbi(w);
    else (p as unknown as Record<string, string>)[veld] = w;
    zetBasisveldHerkomst(p, veld, { bron: v.bron, bronDetail: v.bronUrl, vastgesteldOp: dag, betrouwbaarheid: v.betrouwbaarheid, status: "voorgesteld", automatisch: true });
  }
  v.status = "geaccepteerd";
  v.automatischToegepast = true;
  p.bijgewerktOp = nu.toISOString();
}
