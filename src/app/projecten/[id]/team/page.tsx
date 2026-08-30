// Epic 8: teamsamenstelling. US-35 t/m US-38.
import Link from "next/link";
import { notFound } from "next/navigation";
import { huidigeGebruiker } from "@/lib/auth";
import { getDb } from "@/lib/store";
import type { TeamVoorstel } from "@/lib/domain/types";
import { ROL_LABEL, datum, datumTijd } from "@/lib/format";
import { Badge, Kaart, Knop, Leeg, PaginaKop, ScoreBalk } from "@/components/ui";
import TeamPaneel from "@/components/projecten/TeamPaneel";

function TeamKaart({ team, ander }: { team: TeamVoorstel; ander?: TeamVoorstel }) {
  const verschilt = (rol: string, partnerId: string) => Boolean(ander && ander.leden.find((l) => l.rol === rol)?.partnerId !== partnerId);
  return (
    <Kaart titel={team.variant === "voorkeur" ? "Voorkeursteam (US-35)" : "Alternatief team (US-37)"} className="teamKaart">
      <p className="muted klein-tekst">Gemaakt {datumTijd(team.gemaaktOp)}</p>
      <div className="teamScore">
        <ScoreBalk score={team.teamScore} label="Teamscore" />
        <span className="muted klein-tekst">Teamscore (US-36): kwaliteit 50%, samenwerkingshistorie 25%, nabijheid 15%, beschikbaarheid 10%</span>
      </div>
      <div className="raster raster-2 teamOnderdelen">
        <div>
          <small>Gemiddelde kwaliteit</small>
          <ScoreBalk score={team.onderdelen.gemiddeldeKwaliteit} klein />
        </div>
        <div>
          <small>Samenwerkingshistorie</small>
          <ScoreBalk score={team.onderdelen.samenwerkingshistorie} klein />
        </div>
        <div>
          <small>Regionale nabijheid</small>
          <ScoreBalk score={team.onderdelen.nabijheid} klein />
        </div>
        <div>
          <small>Gezamenlijke beschikbaarheid</small>
          <ScoreBalk score={team.onderdelen.beschikbaarheid} klein />
        </div>
      </div>
      <table className="tabel">
        <thead>
          <tr>
            <th>Rol</th>
            <th>Partner</th>
            <th className="num">Score</th>
          </tr>
        </thead>
        <tbody>
          {team.leden.map((l) => (
            <tr key={l.rol} className={verschilt(l.rol, l.partnerId) ? "teamVerschil" : ""}>
              <td>{ROL_LABEL[l.rol]}</td>
              <td>
                <Link href={`/partners/${l.partnerId}`}>{l.partnerNaam}</Link>
                {verschilt(l.rol, l.partnerId) ? (
                  <>
                    {" "}
                    <Badge kleur="geel">wijkt af</Badge>
                  </>
                ) : null}
              </td>
              <td className="num">{l.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h4 className="subkop">Onderbouwing per keuze (US-38)</h4>
      <ul className="lijst klein-tekst">
        {team.onderbouwing.map((o, i) => (
          <li key={i}>{o}</li>
        ))}
      </ul>
    </Kaart>
  );
}

export default async function TeamPagina({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ id }, sp, db] = await Promise.all([params, searchParams, getDb()]);
  await huidigeGebruiker();
  const p = db.projecten.find((x) => x.id === id);
  if (!p) notFound();
  const runs = db.matchRuns.filter((r) => r.projectId === p.id).sort((a, b) => b.gestartOp.localeCompare(a.gestartOp));
  const run = runs.find((r) => r.id === sp.run) ?? runs[0];
  const teams = run ? db.teams.filter((t) => t.matchRunId === run.id) : [];
  const voorkeur = teams.find((t) => t.variant === "voorkeur");
  const alternatief = teams.find((t) => t.variant === "alternatief");

  return (
    <>
      <div className="printOnly">
        <h1>Teamvoorstel {p.naam}</h1>
        <p>
          {p.locatie.plaats} · {p.woningen} woningen · planning {datum(p.planning.start)} – {datum(p.planning.eind)} · afgedrukt {datumTijd(new Date().toISOString())}
          {run ? ` · op basis van matchrun „${run.naam}” (${datumTijd(run.gestartOp)})` : ""}
        </p>
      </div>
      <div className="geenPrint">
        <PaginaKop
          eyebrow={`Projecten / ${p.naam}`}
          titel={`Teamsamenstelling: ${p.naam}`}
          intro="Je matcht een team, geen losse partij: samenwerkingshistorie, nabijheid en gezamenlijke beschikbaarheid wegen mee."
          acties={
            <Knop href={`/projecten/${p.id}/match${run ? `?run=${run.id}` : ""}`} variant="secundair">
              Naar matching
            </Knop>
          }
        />
      </div>

      {run ? (
        <>
          <Kaart titel="Matchrun" className="geenPrint">
            <div className="formulierActies">
              <span className="klein-tekst">Kies run:</span>
              {runs.map((r) => (
                <Link key={r.id} href={`/projecten/${p.id}/team?run=${r.id}`} className={`knop klein ${r.id === run.id ? "" : "knop-secundair"}`}>
                  {r.naam}
                </Link>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <TeamPaneel runId={run.id} heeftVoorkeur={Boolean(voorkeur)} />
            </div>
          </Kaart>
          {teams.length ? (
            <div className={`raster ${voorkeur && alternatief ? "raster-2" : ""}`}>
              {voorkeur ? <TeamKaart team={voorkeur} ander={alternatief} /> : null}
              {alternatief ? <TeamKaart team={alternatief} ander={voorkeur} /> : null}
            </div>
          ) : (
            <Kaart>
              <Leeg titel="Nog geen teamvoorstel voor deze run" tekst="Genereer een voorkeursteam; daarna kunt u een bewust afwijkend alternatief laten maken." />
            </Kaart>
          )}
        </>
      ) : (
        <Kaart>
          <Leeg titel="Nog geen matchrun" tekst="Voer eerst een matchrun uit; het teamvoorstel wordt uit die ranglijsten samengesteld." actie={<Knop href={`/projecten/${p.id}/match`}>Naar matching</Knop>} />
        </Kaart>
      )}
    </>
  );
}
