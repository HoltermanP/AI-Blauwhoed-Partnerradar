// Dashboard: metrieken, signalen (US-06/21/28/32/33), matchkwaliteit (US-43), recente runs en audit (US-46).
import Link from "next/link";
import { huidigeGebruiker, heeftRecht } from "@/lib/auth";
import { signalenVoor } from "@/lib/domain/signalen";
import type { Rol, Signaal } from "@/lib/domain/types";
import { ROLLEN } from "@/lib/domain/types";
import { datumTijd, ROL_LABEL, STATUS_LABEL } from "@/lib/format";
import { getDb } from "@/lib/store";
import { Badge, Kaart, Knop, Leeg, Melding, Metriek, PaginaKop } from "@/components/ui";
import { SignaalLijst } from "@/components/dashboard/SignaalLijst";

const SOORTEN: Array<{ id: Signaal["soort"] | "alle"; label: string }> = [
  { id: "alle", label: "Alle" },
  { id: "certificaat", label: "Certificaten" },
  { id: "risico", label: "Risico" },
  { id: "afhankelijkheid", label: "Afhankelijkheid" },
  { id: "evaluatie", label: "Evaluaties" },
  { id: "prospect", label: "Prospects" },
  { id: "dekking", label: "Dekking" }
];

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { soort } = await searchParams;
  const [db, gebruiker] = await Promise.all([getDb(), huidigeGebruiker()]);
  const magBewerken = heeftRecht(gebruiker.rol, "bewerken");

  const perStatus = (s: string) => db.partners.filter((p) => p.status === s).length;
  const openKandidaten = db.kandidaten.filter((k) => k.status === "nieuw").length;
  const openVoorstellen = db.verrijkingsvoorstellen.filter((v) => v.status === "open").length;
  const alleSignalen = signalenVoor(db);
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

  const recenteRuns = [...db.matchRuns].sort((a, b) => b.gestartOp.localeCompare(a.gestartOp)).slice(0, 6);
  const recenteAudit = db.audit.slice(0, 5);

  return (
    <>
      <PaginaKop
        eyebrow="Slimme partnerdatabase"
        titel="Dashboard"
        intro="Overzicht van de partnerkring, signalen die aandacht vragen en de kwaliteit van de matching. AI legt uit, AI beslist niet."
        acties={
          magBewerken ? (
            <>
              <Knop href="/partners/nieuw">Nieuwe partner</Knop>
              <Knop href="/projecten/nieuw" variant="secundair">Nieuw project</Knop>
              <Knop href="/discovery" variant="secundair">Discovery</Knop>
              <Knop href="/verrijking" variant="secundair">Verrijking</Knop>
            </>
          ) : (
            <span className="muted klein-tekst">Rol {gebruiker.rol}: alleen lezen.</span>
          )
        }
      />

      <div className="metriekRij">
        <Metriek waarde={perStatus("bekend")} label={`Partners ${STATUS_LABEL.bekend.toLowerCase()}`} sub={<Link href="/partners?status=bekend">Bekijk</Link>} />
        <Metriek waarde={perStatus("preferred")} label={STATUS_LABEL.preferred} sub={<Link href="/partners?status=preferred">Bekijk</Link>} />
        <Metriek waarde={perStatus("prospect")} label="Prospects" sub={<Link href="/partners?status=prospect">Bekijk</Link>} />
        <Metriek waarde={perStatus("geblokkeerd")} label={STATUS_LABEL.geblokkeerd} sub={<Link href="/partners?status=geblokkeerd">Bekijk</Link>} />
        <Metriek waarde={db.projecten.length} label="Projecten" sub={<Link href="/projecten">Bekijk</Link>} />
        <Metriek waarde={db.matchRuns.length} label="Matchruns" />
        <Metriek waarde={openKandidaten} label="Open discovery-kandidaten" sub={<Link href="/discovery">Beoordelen</Link>} />
        <Metriek waarde={openVoorstellen} label="Open verrijkingsvoorstellen" sub={<Link href="/verrijking">Beoordelen</Link>} />
        <Metriek waarde={<span style={{ color: kritiek ? "var(--red)" : undefined }}>{kritiek}</span>} label="Kritieke signalen" sub={<a href="#signalen">Bekijk</a>} />
      </div>

      <div className="raster raster-zij">
        <div>
          <Kaart
            id="signalen"
            titel={`Signalen (${signalen.length})`}
            acties={
              <nav className="soortFilter" aria-label="Filter signalen">
                {SOORTEN.map((s) => (
                  <Link key={s.id} href={s.id === "alle" ? "/" : `/?soort=${s.id}`} className={(soort ?? "alle") === s.id ? "active" : ""} scroll={false}>
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
                Nog geen feedback. De top-3-hitrate ontstaat zodra op de matchpagina (<Link href="/projecten">project → Match</Link>) wordt vastgelegd welke kandidaat gekozen is en waarom (US-42). Dan wordt hier zichtbaar hoe vaak de gekozen partner in de top-3 van de ranking stond.
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

          <Kaart titel="Snelkoppelingen">
            <ul className="lijst">
              <li><Link href="/partners/nieuw">Nieuwe partner</Link></li>
              <li><Link href="/projecten/nieuw">Nieuw project</Link></li>
              <li><Link href="/discovery">Discovery: kandidaten beoordelen</Link></li>
              <li><Link href="/verrijking">Verrijking: voorstellen beoordelen</Link></li>
              <li><Link href="/kaart">Kaart: partners bij projectlocatie</Link></li>
              <li><Link href="/beheer">Beheer: factoren, gewichten, audit</Link></li>
              <li>
                <Link href="/radar" className="muted">Legacy: Excel-radar (houtbouwers)</Link>
              </li>
            </ul>
          </Kaart>
        </div>
      </div>
    </>
  );
}
