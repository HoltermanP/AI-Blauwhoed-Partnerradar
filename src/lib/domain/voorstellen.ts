// Verwerking van verrijkingsvoorstellen vóór ze in de wachtrij komen:
// - conflict met een door een mens gevalideerde waarde (factor én basisveld, US-52);
// - bronrangorde: hoogste rang wint, lager is 'alternatief'; goudstandaard gaat altijd voor (US-49/US-50);
// - velden zonder betrouwbare bron worden gemarkeerd in plaats van gevuld (US-53).
import { effectieveStatus, geenBronSleutel, markeerAlternatieven } from "./herkomst";
import { veldGevuld } from "./goudstandaard";
import { BASISVELD_VAN_LABEL } from "./webverrijking";
import type { EnrichmentVoorstel, Factor, Partner, PartnerFactor } from "./types";

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
