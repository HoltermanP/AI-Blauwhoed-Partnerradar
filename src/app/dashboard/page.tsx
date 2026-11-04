// Dashboard en startpagina: chatten en zoeken in partners én projecten (US-28), kerncijfers en openstaand werk, signalen
// (US-06/21/28/32/33), matchkwaliteit (US-43), recente runs en wijzigingen (US-46). De details per onderwerp staan op hun
// eigen pagina (datakwaliteit, verrijking, discovery); hier alleen de samenvatting met doorklik.
import Link from "next/link";
import { huidigeGebruiker, heeftRecht } from "@/lib/auth";
import { signalenVoor } from "@/lib/domain/signalen";
import type { Rol, Signaal } from "@/lib/domain/types";
import { ROLLEN } from "@/lib/domain/types";
import { datumTijd, ROL_LABEL } from "@/lib/format";
import { getDb } from "@/lib/store";
import { Badge, Kaart, Knop, Leeg, Melding, Metriek, ScoreBalk, StatusBadge } from "@/components/ui";
import { SignaalLijst } from "@/components/dashboard/SignaalLijst";
import { zichtbaar } from "@/lib/domain/zichtbaarheid";
import { dataSignalen, statusVerdeling } from "@/lib/domain/datakwaliteit";
import StartZoeker from "@/components/chat/StartZoeker";
import { semantischZoeken } from "@/lib/domain/matching";
import { zoekProjecten } from "@/lib/domain/chat";
import { aiAan } from "@/lib/aiplatform";
import type { Database } from "@/lib/domain/types";

export const maxDuration = 60;
import { budgetStatus } from "@/lib/domain/kosten";

const SOORTEN: Array<{ id: Signaal["soort"] | "alle"; label: string }> = [
  { id: "alle", label: "Alle" },
  { id: "risico", label: "Risico" },
  { id: "afhankelijkheid", label: "Afhankelijkheid" },
  { id: "evaluatie", label: "Evaluaties" },
  { id: "prospect", label: "Prospects" },
  { id: "dekking", label: "Dekking" },
  { id: "budget", label: "AI-budget" }
];

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { soort, q = "", web, vraag } = await searchParams;
  const [db, gebruiker] = await Promise.all([getDb(), huidigeGebruiker()]);
  const magBewerken = heeftRecht(gebruiker.rol, "bewerken");

  const perStatus = (s: string) => db.partners.filter((p) => p.status === s).length;
  const openKandidaten = db.kandidaten.filter((k) => k.status === "nieuw").length;
  const openVoorstellen = db.verrijkingsvoorstellen.filter((v) => v.status === "open").length;
  // Certificaatsignalen staan bewust niet op het dashboard: ze verschijnen bij de kandidaat in een matchrun en in het partnerdossier.
  const alleSignalen = signalenVoor(db).filter((s) => s.soort !== "certificaat");
  const kritiek = alleSignalen.filter((s) => s.ernst === "kritiek").length;
  const signalen = soort && soort !== "alle" ? alleSignalen.filter((s) => s.soort === soort) : alleSignalen;

  // US-43: top-3 hitrate uit feedback met beslissing "gekozen".
  const gekozen = db.feedback.filter((f) => f.beslissing === "gekozen");
  const top3 = gekozen.filter((f) => f.positieInRanking <= 3).length;
  const hitrate = gekozen.length ? Math.round((top3 / gekozen.length) * 100) : null;
  const perRol = ROLLEN.map((rol: Rol) => {
    const g = gekozen.filter((f) => f.rol === rol);
    const t = g.filter((f) => f.positieInRanking <= 3).length;
    return { rol, totaal: g.length, top3: t };
  }).filter((r) => r.totaal > 0);
  const runsZonderFeedback = db.matchRuns.filter((r) => !db.feedback.some((f) => f.matchRunId === r.id)).length;

  // US-66: datakwaliteit op het overzichtsscherm (alleen zichtbare partners: geen concepten of gearchiveerde).
  const zichtbarePartners = db.partners.filter(zichtbaar);
  const dataSign = dataSignalen(db, zichtbarePartners);
  const verdeling = statusVerdeling(zichtbarePartners, db.factoren);
  const pctVan = (n: number) => (verdeling.totaal ? Math.round((n / verdeling.totaal) * 100) : 0);
  const geenBronPartners = zichtbarePartners.filter((p) => Object.keys(p.geenBron ?? {}).length).length;
  const openConcepten = db.partners.filter((p) => p.status === "concept").length;
  const verbruik = budgetStatus(db);

  const recenteRuns = [...db.matchRuns].sort((a, b) => b.gestartOp.localeCompare(a.gestartOp)).slice(0, 6);
  const recenteAudit = db.audit.slice(0, 5);

  return (
    <>
      <StartZoeker
        q={q}
        web={web === "1"}
        beginVraag={vraag}
        internetMogelijk={db.instellingen.externeBronnenToegestaan}
        aiActief={aiAan()}
        acties={
          magBewerken ? (
            <>
              <Knop href="/partners/nieuw" variant="secundair">Nieuwe partner</Knop>
              <Knop href="/projecten/nieuw" variant="secundair">Nieuw project</Knop>
            </>
          ) : null
        }
        resultaten={q.trim() ? <DirecteResultaten db={db} q={q} /> : undefined}
      />

      {verbruik.overschreden ? (
        <Melding soort="fout">AI-budget bereikt: {verbruik.bewerkingen} van {verbruik.budgetBewerkingen} bewerkingen deze maand (100%). Geplande verrijkingsrondes starten niet; chat en verrijking van één partner blijven werken. <Link href="/beheer/verbruik">AI-verbruik</Link></Melding>
      ) : verbruik.waarschuwing ? (
        <Melding soort="waarschuwing">AI-verbruik boven 80%: {verbruik.bewerkingen} van {verbruik.budgetBewerkingen} bewerkingen deze maand. <Link href="/beheer/verbruik">AI-verbruik</Link></Melding>
      ) : null}

      <h2 className="sectieKop">In één oogopslag</h2>
      <div className="metriekRij">
        <Metriek waarde={perStatus("bekend") + perStatus("preferred")} label="Partners" sub={<Link href="/partners">{perStatus("preferred")} preferred · {perStatus("prospect")} prospects</Link>} />
        <Metriek waarde={db.projecten.length} label="Projecten" sub={<Link href="/projecten">{db.matchRuns.length} matchruns</Link>} />
        <Metriek waarde={`${pctVan(verdeling.gevalideerd)}%`} label="Waarden gevalideerd" sub={<Link href="/datakwaliteit">{dataSign.length} datasignalen · {geenBronPartners} zonder bron</Link>} />
        <Metriek waarde={openVoorstellen} label="Verrijkingsvoorstellen" sub={<Link href="/verrijking">Beoordelen</Link>} />
        <Metriek waarde={openKandidaten} label="Nieuwe kandidaten" sub={<Link href="/discovery">Beoordelen</Link>} />
        <Metriek waarde={openConcepten} label="Wacht op vrijgave" sub={<Link href="/vrijgave">Vrijgave</Link>} />
        <Metriek waarde={<span style={{ color: kritiek ? "var(--red)" : undefined }}>{kritiek}</span>} label="Kritieke signalen" sub={<a href="#signalen">Bekijk</a>} />
        <Metriek waarde={`${verbruik.bewerkingen}/${verbruik.budgetBewerkingen}`} label="AI-bewerkingen" sub={<Link href="/beheer/verbruik">{Math.round(verbruik.pct)}% van budget</Link>} />
      </div>

      <div className="raster raster-zij">
        <div>
          <Kaart
            id="signalen"
            titel={`Signalen (${signalen.length})`}
            acties={
              <nav className="soortFilter" aria-label="Filter signalen">
                {SOORTEN.map((s) => (
                  <Link key={s.id} href={s.id === "alle" ? "/dashboard" : `/dashboard?soort=${s.id}`} className={(soort ?? "alle") === s.id ? "active" : ""} scroll={false}>
                    {s.label}
                    <span>{s.id === "alle" ? alleSignalen.length : alleSignalen.filter((x) => x.soort === s.id).length}</span>
                  </Link>
                ))}
              </nav>
            }
          >
            <SignaalLijst signalen={signalen} />
          </Kaart>

          <Kaart titel="Recente matchruns">
            {recenteRuns.length === 0 ? (
              <Leeg titel="Nog geen matchruns" tekst="Start een match vanaf een projectpagina." />
            ) : (
              <div className="tabelWrap">
                <table className="tabel">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Run</th>
                      <th>Datum</th>
                      <th>Door</th>
                      <th className="num">Rollen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recenteRuns.map((r) => {
                      const proj = db.projecten.find((p) => p.id === r.projectId);
                      return (
                        <tr key={r.id}>
                          <td>
                            <Link href={`/projecten/${r.projectId}`}>{proj?.naam ?? r.projectId}</Link>
                          </td>
                          <td>
                            <Link href={`/projecten/${r.projectId}/match?run=${r.id}`}>{r.naam}</Link>
                          </td>
                          <td>{datumTijd(r.gestartOp)}</td>
                          <td>{r.door}</td>
                          <td className="num">{r.resultaat.length}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Kaart>
        </div>

        <div>
          {/* US-43: matchkwaliteit */}
          <Kaart titel="Matchkwaliteit">
            {gekozen.length === 0 ? (
              <Melding soort="info">
                Nog geen feedback. De top-3-hitrate ontstaat zodra op de matchpagina (<Link href="/projecten">project → Match</Link>) wordt vastgelegd welke kandidaat gekozen is en waarom. Dan wordt hier zichtbaar hoe vaak de gekozen partner in de top-3 van de ranking stond.
              </Melding>
            ) : (
              <>
                <div className="hitrate">
                  <span>{hitrate}%</span>
                  <p>
                    top-3 hitrate · {top3} van {gekozen.length} gekozen kandidaten stonden in de top-3
                  </p>
                </div>
                <table className="tabel">
                  <thead>
                    <tr>
                      <th>Rol</th>
                      <th className="num">Gekozen</th>
                      <th className="num">In top-3</th>
                      <th className="num">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perRol.map((r) => (
                      <tr key={r.rol}>
                        <td>{ROL_LABEL[r.rol]}</td>
                        <td className="num">{r.totaal}</td>
                        <td className="num">{r.top3}</td>
                        <td className="num">{Math.round((r.top3 / r.totaal) * 100)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            <p className="muted klein-tekst" style={{ marginTop: 10 }}>
              {runsZonderFeedback} van {db.matchRuns.length} matchruns zonder feedback. Gewichten bijstellen: <Link href="/beheer/gewichten">gewichtsprofielen</Link>.
            </p>
          </Kaart>

          <Kaart titel="Recente wijzigingen" acties={<Link href="/beheer/audit">Volledige audit</Link>}>
            {recenteAudit.length === 0 ? (
              <p className="muted">Nog geen wijzigingen.</p>
            ) : (
              <ul className="lijst auditLijst">
                {recenteAudit.map((a) => (
                  <li key={a.id}>
                    <small className="muted">
                      {datumTijd(a.op)} · {a.door} <Badge>{a.gebruikersrol}</Badge>
                    </small>
                    <div>
                      <b>{a.entiteit}</b> {a.entiteitId} — {a.actie}
                      {a.details ? <span className="muted"> · {a.details}</span> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Kaart>

        </div>
      </div>
    </>
  );
}

/** Directe treffers zonder AI: partners (semantisch, kenmerk-matches eerst) en projecten (woordtreffers). */
function DirecteResultaten({ db, q }: { db: Database; q: string }) {
  const partners = semantischZoeken(db, q, 40).filter((r) => zichtbaar(r.partner));
  const projecten = zoekProjecten(db, q);
  return (
    <div className="directeTreffers">
      <Kaart titel={`Partners (${partners.length})`} acties={partners.length ? <Link href={`/partners?q=${encodeURIComponent(q)}`}>In het overzicht</Link> : null}>
        {partners.length ? (
          <ul className="trefferLijst">
            {partners.slice(0, 8).map((r) => (
              <li key={r.partner.id}>
                <div>
                  <Link href={`/partners/${r.partner.id}`}>{r.partner.naam}</Link> <StatusBadge status={r.partner.status} />
                  {r.structureel ? <Badge kleur="blauw" titel="Heeft het gevraagde kenmerk aantoonbaar">kenmerk</Badge> : null}
                  <small>
                    {r.partner.rollen.map((rol) => ROL_LABEL[rol]).join(", ")} · {r.partner.vestigingsplaats || "–"}
                  </small>
                </div>
                <ScoreBalk score={r.score} label="Relevantie" klein />
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Geen partners gevonden.</p>
        )}
      </Kaart>
      <Kaart titel={`Projecten (${projecten.length})`} acties={projecten.length ? <Link href={`/database?t=projecten&q=${encodeURIComponent(q)}`}>Alle treffers</Link> : null}>
        {projecten.length ? (
          <ul className="trefferLijst">
            {projecten.slice(0, 8).map((pr) => (
              <li key={pr.id}>
                <div>
                  <Link href={`/projecten/${pr.id}`}>{pr.naam}</Link> {pr.extern ? <Badge>extern</Badge> : null}
                  <small>
                    {pr.locatie.plaats || "–"} · {pr.type} · {pr.woningen} woningen · {pr.fase}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Geen projecten gevonden.</p>
        )}
      </Kaart>
    </div>
  );
}
