// Kenmerken van een verrijkingsvoorstel in één weergave: aantoonbaar/geclaimd, aard, conflicten en bronrang (US-49/50/51).
import { Badge, BetrouwbaarheidBadge, BronLabel } from "@/components/ui";
import type { EnrichmentVoorstel } from "@/lib/domain/types";

export function VoorstelSoort({ v }: { v: EnrichmentVoorstel }) {
  return (
    <>
      <Badge kleur={v.soort === "aantoonbaar" ? "groen" : "geel"}>{v.soort}</Badge>
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
      <span className="muted klein-tekst">Voorstel, geen vastgesteld gegeven.</span>
    </>
  );
}
