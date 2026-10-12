// US-20: evaluatieproces bewaken — welke afgeronde projecten nog evaluaties missen, met de verantwoordelijke ontwikkelaar,
// en welke ingediende evaluaties nog op acceptatie wachten (US-21).
import Link from "next/link";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { herinneringDagen, isVerantwoordelijke, openstaandeEvaluaties } from "@/lib/domain/evaluatieproces";
import EvaluatieprocesEditor from "@/components/projecten/EvaluatieprocesEditor";
import { datum, ROL_LABEL } from "@/lib/format";
import { getDb } from "@/lib/store";
import { Badge, Kaart, Leeg, Melding, Metriek, PaginaKop } from "@/components/ui";
import EvaluatieAcceptatie from "@/components/projecten/EvaluatieAcceptatie";

export default async function EvaluatieOverzicht({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [db, gebruiker] = await Promise.all([getDb(), huidigeGebruiker()]);
  const overzicht = openstaandeEvaluaties(db);
  const alleenIk = sp.ik === "1";
  const metOpen = overzicht.filter((x) => x.open.length && (!alleenIk || isVerantwoordelijke(x.project, gebruiker)));
  const mijn = overzicht.filter((x) => x.open.length && isVerantwoordelijke(x.project, gebruiker)).reduce((s, x) => s + x.open.length, 0);
  const termijn = herinneringDagen(db);
  const bewaker = db.instellingen.evaluatieProces?.procesbewaker;
  const ingediend = db.evaluaties.filter((e) => e.status === "ingediend");
  const perOntwikkelaar = new Map<string, number>();
  metOpen.forEach((x) => perOntwikkelaar.set(x.verantwoordelijke ?? "(niet vastgelegd)", (perOntwikkelaar.get(x.verantwoordelijke ?? "(niet vastgelegd)") ?? 0) + x.open.length));
  return (
    <>
      <PaginaKop
        eyebrow="Projecten"
        titel="Evaluatieoverzicht"
        intro="Welke afgeronde projecten nog evaluaties missen, per verantwoordelijke ontwikkelaar. Na de herinneringstermijn volgt een herinnering op het dashboard. Evaluaties gaan over de organisatie, nooit over een persoon."
        acties={<Link href="/projecten" className="knop knop-secundair">Projecten</Link>}
      />
      <Melding soort={bewaker ? "info" : "waarschuwing"}>
        Eigenaarschap: de verantwoordelijke ontwikkelaar per project levert de evaluaties; {bewaker ? <b>{bewaker}</b> : "de procesbewaker (nog niet ingesteld)"} bewaakt het proces. {mijn ? <Link href="/evaluaties?ik=1">U heeft zelf {mijn} openstaande evaluatie(s).</Link> : null}
      </Melding>
      <div className="metriekRij">
        <Metriek waarde={metOpen.length} label="Afgeronde projecten met open evaluaties" />
        <Metriek waarde={metOpen.reduce((s, x) => s + x.open.length, 0)} label="Openstaande evaluaties" />
        <Metriek waarde={metOpen.filter((x) => x.herinnering).length} label={`Herinnering (> ${termijn} dagen na oplevering)`} />
        <Metriek waarde={ingediend.length} label="Wachten op acceptatie" sub={<Link href="/vrijgave?lijst=evaluaties">Werklijst</Link>} />
      </div>
      <div className="raster raster-zij">
        <Kaart titel={alleenIk ? "Mijn openstaande evaluaties" : "Openstaande evaluaties per project"} acties={alleenIk ? <Link href="/evaluaties">Alle projecten</Link> : mijn ? <Link href="/evaluaties?ik=1">Alleen mijn projecten</Link> : null}>
          {metOpen.length ? (
            <div className="tabelWrap">
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Verantwoordelijke</th>
                    <th>Opgeleverd</th>
                    <th>Nog te evalueren</th>
                    <th className="num">Gedaan</th>
                  </tr>
                </thead>
                <tbody>
                  {metOpen.map((x) => (
                    <tr key={x.project.id}>
                      <td>
                        <Link href={`/projecten/${x.project.id}/evaluaties`}>
                          <b>{x.project.naam}</b>
                        </Link>
                        {x.project.projectnummer ? <div className="muted klein-tekst">nr. {x.project.projectnummer}</div> : null}
                      </td>
                      <td>{x.verantwoordelijke ?? <span className="muted">niet vastgelegd</span>}</td>
                      <td>
                        {datum(x.opgeleverdOp)}
                        <div className="klein-tekst">{x.herinnering ? <Badge kleur="geel">{x.dagenSindsOplevering} dagen geleden</Badge> : <span className="muted">{x.dagenSindsOplevering} dagen geleden</span>}</div>
                      </td>
                      <td className="klein-tekst">
                        {x.open.map((o, i) => (
                          <span key={o.engagement.id}>
                            {i ? " · " : ""}
                            <Link href={`/projecten/${x.project.id}/evaluaties?engagement=${o.engagement.id}`}>{o.partnerNaam}</Link> <span className="muted">({ROL_LABEL[o.engagement.rol]})</span>
                          </span>
                        ))}
                      </td>
                      <td className="num">
                        {x.totaal - x.open.length}/{x.totaal}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Leeg titel="Geen openstaande evaluaties" tekst="Alle betrokken organisaties van afgeronde projecten zijn geëvalueerd." />
          )}
        </Kaart>
        <div>
        <Kaart titel="Eigenaarschap">
          <EvaluatieprocesEditor procesbewaker={bewaker} herinneringDagen={termijn} magBeheren={heeftRecht(gebruiker.rol, "beheer")} />
        </Kaart>
        <Kaart titel="Per ontwikkelaar">
          {perOntwikkelaar.size ? (
            <ul className="lijst">
              {Array.from(perOntwikkelaar.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([naam, n]) => (
                  <li key={naam}>
                    {naam}: <b>{n}</b> open
                  </li>
                ))}
            </ul>
          ) : (
            <p className="muted">Niets open.</p>
          )}
        </Kaart>
        </div>
      </div>
      {ingediend.length ? (
        <Kaart titel={`Ingediende evaluaties (${ingediend.length})`}>
          <EvaluatieAcceptatie evaluaties={ingediend.map((e) => ({ ...e, partnerNaam: db.partners.find((p) => p.id === e.partnerId)?.naam ?? e.partnerId, projectNaam: db.projecten.find((p) => p.id === e.projectId)?.naam ?? e.projectId }))} magAccepteren={heeftRecht(gebruiker.rol, "beheer")} />
        </Kaart>
      ) : null}
    </>
  );
}
