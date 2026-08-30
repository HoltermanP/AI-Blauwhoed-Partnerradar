// Epic 2: projectoverzicht.
import Link from "next/link";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { datum, datumTijd, getal, hoofdletter } from "@/lib/format";
import { Badge, Kaart, Knop, Leeg, PaginaKop } from "@/components/ui";
import type { Projectfase } from "@/lib/domain/types";

const FASE_KLEUR: Record<Projectfase, "grijs" | "blauw" | "groen" | "geel" | "rood" | "mint"> = { initiatief: "grijs", planvorming: "blauw", realisatie: "geel", opgeleverd: "groen", nazorg: "mint" };

export default async function ProjectenPagina() {
  const [db, gebruiker] = await Promise.all([getDb(), huidigeGebruiker()]);
  const magBewerken = heeftRecht(gebruiker.rol, "bewerken");
  const projecten = [...db.projecten].sort((a, b) => b.bijgewerktOp.localeCompare(a.bijgewerktOp));

  return (
    <>
      <PaginaKop
        eyebrow="Projecten"
        titel="Projecten"
        intro="Projectprofielen met rollen, eisen en gewichten; vanuit hier start u matching, teamsamenstelling en evaluaties."
        acties={
          magBewerken ? (
            <>
              <Knop href="/projecten/nieuw?bron=document" variant="secundair">
                Uit document
              </Knop>
              <Knop href="/projecten/nieuw">Nieuw project</Knop>
            </>
          ) : (
            <span className="muted klein-tekst">Alleen-lezen: geen recht &apos;bewerken&apos;.</span>
          )
        }
      />
      <Kaart>
        {projecten.length ? (
          <div className="tabelWrap">
            <table className="tabel">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Type</th>
                  <th>Plaats</th>
                  <th className="num">Woningen</th>
                  <th>Fase</th>
                  <th className="num">Ambitie</th>
                  <th>Planning</th>
                  <th className="num">Rollen met eisen</th>
                  <th>Laatste matchrun</th>
                </tr>
              </thead>
              <tbody>
                {projecten.map((p) => {
                  const laatste = db.matchRuns.filter((r) => r.projectId === p.id).sort((a, b) => b.gestartOp.localeCompare(a.gestartOp))[0];
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/projecten/${p.id}`}>
                          <b>{p.naam}</b>
                        </Link>
                      </td>
                      <td>{hoofdletter(p.type)}</td>
                      <td>{p.locatie.plaats}</td>
                      <td className="num">{getal(p.woningen)}</td>
                      <td>
                        <Badge kleur={FASE_KLEUR[p.fase]}>{hoofdletter(p.fase)}</Badge>
                      </td>
                      <td className="num" title="Ambitie duurzaamheid 1–5">
                        {p.ambitieDuurzaamheid}/5
                      </td>
                      <td>
                        {datum(p.planning.start)} – {datum(p.planning.eind)}
                      </td>
                      <td className="num">{p.eisen.length}</td>
                      <td>{laatste ? <Link href={`/projecten/${p.id}/match?run=${laatste.id}`}>{datumTijd(laatste.gestartOp)}</Link> : <span className="muted">–</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Leeg titel="Nog geen projecten" tekst="Maak een project aan of vul er een voor uit een projectdocument." actie={magBewerken ? <Knop href="/projecten/nieuw">Nieuw project</Knop> : undefined} />
        )}
      </Kaart>
    </>
  );
}
