// US-54/55: controle van een concept (AI-voorstel): herkomst, onderbouwing, waarschuwingen, mogelijke dubbel en het besluit
// van de beheerder. Gebruikt op het partnerdossier en in de vrijgavewachtrij.
import Link from "next/link";
import RegistratieBeoordeling from "@/components/partners/RegistratieBeoordeling";
import { Badge, BetrouwbaarheidBadge, Disclaimer, Kaart, Melding } from "@/components/ui";
import { vrijgaveBlokkades } from "@/lib/domain/registratie";
import type { Partner } from "@/lib/domain/types";
import { datumTijd, ROL_LABEL } from "@/lib/format";

export const HERKOMST_LABEL = { "ai-registratie": "AI-registratie", discovery: "Discovery", "ai-aandraag": "AI-aandraag (zoekprofiel)" } as const;

export default function ConceptControle({ p, magVrijgeven, compact = false }: { p: Partner; magVrijgeven: boolean; compact?: boolean }) {
  const r = p.registratie;
  const blokkades = vrijgaveBlokkades(p);
  const [dubbelId, dubbelReden] = r?.mogelijkeDubbelVan?.split("|") ?? [];
  return (
    <Kaart
      titel={
        compact ? (
          <>
            <Link href={`/partners/${p.id}`}>{p.naam || "(naam onbekend)"}</Link> <Badge kleur="mint">{HERKOMST_LABEL[r?.herkomstSoort ?? "ai-registratie"]}</Badge>
          </>
        ) : (
          "Controle concept (AI-voorstel)"
        )
      }
    >
      <Disclaimer>Dit is een voorstel, geen vastgesteld gegeven. Het concept telt niet mee in zoeken, filteren, matchen, verbanden, chat en exports tot een beheerder het vrijgeeft.</Disclaimer>
      <p className="klein-tekst">
        {HERKOMST_LABEL[r?.herkomstSoort ?? "ai-registratie"]} door {r?.provider ?? "onbekend"} op verzoek van <b>{r?.aangevraagdDoor ?? "onbekend"}</b> ({datumTijd(r?.op ?? p.aangemaaktOp)}).{" "}
        {p.rollen.length ? p.rollen.map((x) => ROL_LABEL[x]).join(", ") : "geen rol"} · {p.vestigingsplaats || "plaats onbekend"}
        {p.kvk ? ` · KVK ${p.kvk}` : ""}
        {p.website ? (
          <>
            {" · "}
            <a href={p.website} target="_blank" rel="noreferrer">
              {p.website.replace(/^https?:\/\//, "")}
            </a>
          </>
        ) : null}
      </p>
      {r?.onderbouwing ? (
        <div className="samenvatting">
          <div>
            <h4>Waarom past deze partij</h4>
            <p>{r.onderbouwing.waaromPast || <span className="muted">Geen onderbouwing vastgelegd.</span>}</p>
          </div>
          <div>
            <h4>Bron</h4>
            <p>
              {r.onderbouwing.bron}
              {r.onderbouwing.bronUrl ? (
                <>
                  {" · "}
                  <a href={r.onderbouwing.bronUrl} target="_blank" rel="noreferrer">
                    {r.onderbouwing.bronUrl}
                  </a>
                </>
              ) : null}
              <br />
              <small className="muted">opgehaald {datumTijd(r.onderbouwing.opgehaaldOp)}{r.onderbouwing.zoekvraag ? ` · zoekvraag: ${r.onderbouwing.zoekvraag}` : ""}</small>
            </p>
          </div>
          <div>
            <h4>Wat is onzeker</h4>
            {r.onderbouwing.onzeker.length ? (
              <ul>
                {r.onderbouwing.onzeker.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">Niets vermeld.</p>
            )}
          </div>
        </div>
      ) : null}
      {dubbelId ? (
        <Melding soort="waarschuwing">
          Mogelijke dubbel: {dubbelReden}. <Link href={`/partners/${dubbelId}`}>Open bestaande partner</Link>
        </Melding>
      ) : null}
      {r?.waarschuwingen.length && !r.onderbouwing ? (
        <>
          <h4>Te controleren</h4>
          <ul className="lijst klein-tekst">
            {r.waarschuwingen.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </>
      ) : null}
      {r?.herkomst.length && !compact ? (
        <>
          <h4>Herkomst per veld</h4>
          <div className="tabelWrap">
            <table className="tabel">
              <thead>
                <tr>
                  <th>Veld</th>
                  <th>Citaat uit de bron</th>
                  <th className="num">Betrouwb.</th>
                </tr>
              </thead>
              <tbody>
                {r.herkomst.map((h, i) => (
                  <tr key={i}>
                    <td>{h.veld}</td>
                    <td className="citaatCel">{h.citaat}</td>
                    <td className="num">
                      <BetrouwbaarheidBadge waarde={h.betrouwbaarheid} /> <small className="muted">{Math.round(h.betrouwbaarheid * 100)}%</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      {!compact ? <p className="muted klein-tekst">Bronnen: {r?.bronnen.length ? r.bronnen.join(", ") : "–"}</p> : null}
      {magVrijgeven ? (
        <RegistratieBeoordeling partnerId={p.id} blokkades={blokkades} dubbel={Boolean(dubbelId)} />
      ) : (
        <p className="muted klein-tekst">Vrijgeven of afwijzen is voorbehouden aan de beheerder.</p>
      )}
      {compact ? (
        <p className="klein-tekst">
          <Link href={`/partners/${p.id}`}>Dossier openen</Link> · <Link href={`/partners/${p.id}/bewerken`}>Gegevens aanvullen</Link>
        </p>
      ) : null}
    </Kaart>
  );
}
