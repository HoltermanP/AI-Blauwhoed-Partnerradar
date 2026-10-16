// Kenmerken van een verrijkingsvoorstel in één weergave: aantoonbaar/geclaimd, aard, conflicten en bronrang (US-49/50/51).
import { Badge, BetrouwbaarheidBadge, BronLabel } from "@/components/ui";
import { VASTSTELLING_UITLEG, vaststellingVan } from "@/lib/domain/verificatie";
import type { EnrichmentVoorstel } from "@/lib/domain/types";

export function VoorstelSoort({ v }: { v: EnrichmentVoorstel }) {
  return (
    <>
      <Badge kleur={v.soort === "aantoonbaar" ? "groen" : "geel"}>{v.soort}</Badge>
      {v.factorId ? <Badge kleur={vaststellingVan(v) === "ingeschat" ? "geel" : "blauw"} titel={VASTSTELLING_UITLEG[vaststellingVan(v)]}>{vaststellingVan(v)}</Badge> : null}
      {v.aard === "niet_bevestigd" ? <Badge kleur="rood" titel="De eerder gevonden waarde is niet meer op de bron terug te vinden; accepteren markeert haar als verouderd">niet bevestigd</Badge> : v.aard === "nieuw" ? <Badge kleur="blauw">nieuw</Badge> : null}
      {v.conflictMetGevalideerd ? <Badge kleur="rood" titel="Wijkt af van een door een mens gevalideerde waarde; wordt nooit stilzwijgend overschreven">wijkt af van gevalideerd</Badge> : null}
      {v.goudstandaardGaatVoor ? <Badge kleur="blauw" titel="De huidige waarde komt uit de goudstandaard of een eigen uitgave van Blauwhoed en gaat altijd voor">goudstandaard gaat voor</Badge> : v.alternatief ? <Badge kleur="grijs" titel="Een bron met een hogere rang (of de huidige waarde) gaat voor; dit is een alternatief">alternatief</Badge> : null}
    </>
  );
}

export function VoorstelBetrouwbaarheid({ v }: { v: EnrichmentVoorstel }) {
  return (
    <>
      <BetrouwbaarheidBadge waarde={v.betrouwbaarheid} /> <span className="muted klein-tekst">{Math.round(v.betrouwbaarheid * 100)}%</span>
    </>
  );
}

export function VoorstelBron({ v }: { v: EnrichmentVoorstel }) {
  return (
    <>
      <BronLabel bron={v.bron} />
      {v.bronNaam ? <Badge kleur={v.bronRangLijst === 1 ? "blauw" : v.bronRangLijst === 2 ? "groen" : "grijs"} titel="Aangewezen bron uit de bronnenlijst; de rang telt mee in de betrouwbaarheid">{v.bronNaam} · rang {v.bronRangLijst}</Badge> : null}
      {v.bronUrl ? (
        <>
          {" · "}
          {/^https?:/.test(v.bronUrl) ? (
            <a href={v.bronUrl} target="_blank" rel="noreferrer">
              {v.bronUrl}
            </a>
          ) : (
            <span className="muted">{v.bronUrl}</span>
          )}
        </>
      ) : null}
      <blockquote>{v.citaat}</blockquote>
      {v.onderbouwing ? (
        <p className="klein-tekst">
          <b>{vaststellingVan(v) === "ingeschat" ? "Inschatting" : "Onderbouwing"}:</b> {v.onderbouwing}
        </p>
      ) : null}
      <span className="muted klein-tekst">{v.status === "open" ? "Voorstel, geen vastgesteld gegeven." : v.status === "geaccepteerd" ? (v.automatischToegepast ? `Automatisch ingevuld: niet geverifieerd · ${vaststellingVan(v)}.` : "Geaccepteerd: gebruikersgeverifieerd.") : "Afgewezen: wordt niet opnieuw voorgesteld."}</span>
    </>
  );
}
