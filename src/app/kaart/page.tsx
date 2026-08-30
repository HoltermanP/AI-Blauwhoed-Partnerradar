// US-41: partners op een kaart ten opzichte van de projectlocatie.
import Link from "next/link";
import { afstandKm } from "@/lib/domain/geo";
import type { PartnerStatus, Rol } from "@/lib/domain/types";
import { ROLLEN } from "@/lib/domain/types";
import { getal, ROL_LABEL, STATUS_LABEL } from "@/lib/format";
import { getDb } from "@/lib/store";
import { Kaart, Leeg, PaginaKop, StatusBadge } from "@/components/ui";
import { NederlandKaart, STATUS_KLEUR, type KaartKoppeling } from "@/components/kaart/NederlandKaart";

const STATUSSEN: PartnerStatus[] = ["bekend", "preferred", "prospect", "afgewezen", "geblokkeerd"];
const isRol = (r: string | undefined): r is Rol => !!r && (ROLLEN as string[]).includes(r);
const isStatus = (s: string | undefined): s is PartnerStatus => !!s && (STATUSSEN as string[]).includes(s);

export default async function KaartPagina({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const db = await getDb();
  const rol = isRol(sp.rol) ? sp.rol : undefined;
  const status = isStatus(sp.status) ? sp.status : undefined;
  const project = db.projecten.find((p) => p.id === sp.project);

  const partners = db.partners.filter((p) => (!rol || p.rollen.includes(rol)) && (!status || p.status === status));
  const koppelingen: KaartKoppeling[] = project
    ? partners
        .map((p) => {
          const km = afstandKm(p.locatie, project.locatie);
          return { partner: p, afstandKm: km, binnenWerkgebied: km <= p.werkgebiedKm };
        })
        .sort((a, b) => a.afstandKm - b.afstandKm)
    : [];

  const url = (wijzig: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const alles = { project: sp.project, rol, status, ...wijzig };
    Object.entries(alles).forEach(([k, v]) => v && q.set(k, v));
    const s = q.toString();
    return s ? `/kaart?${s}` : "/kaart";
  };

  return (
    <>
      <PaginaKop
        eyebrow="Geografie"
        titel="Kaart"
        intro={project ? <>Partners rond <b>{project.naam}</b> ({project.locatie.plaats}). Gestippelde cirkels tonen het werkgebied van partners die de projectlocatie dekken.</> : "Alle partners en projecten. Selecteer een project om werkgebieden en afstanden te zien."}
      />

      <form className="formulier kaartFilters" method="get" action="/kaart">
        <div className="rij">
          <label>
            Project
            <select name="project" defaultValue={sp.project ?? ""}>
              <option value="">— geen —</option>
              {db.projecten.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.naam} ({p.locatie.plaats})
                </option>
              ))}
            </select>
          </label>
          <label>
            Rol
            <select name="rol" defaultValue={rol ?? ""}>
              <option value="">Alle rollen</option>
              {ROLLEN.map((r) => (
                <option key={r} value={r}>
                  {ROL_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select name="status" defaultValue={status ?? ""}>
              <option value="">Alle statussen</option>
              {STATUSSEN.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <div className="formulierActies" style={{ alignSelf: "end" }}>
            <button type="submit" className="knop klein">Toepassen</button>
            <Link href="/kaart" className="knop knop-tekst klein">Wissen</Link>
          </div>
        </div>
      </form>

      <div className="raster raster-zij">
        <Kaart>
          <NederlandKaart partners={partners} projecten={db.projecten} geselecteerd={project} koppelingen={koppelingen} />
          <div className="legenda">
            {STATUSSEN.map((s) => (
              <span key={s}>
                <i style={{ background: STATUS_KLEUR[s], borderRadius: "50%" }} /> {STATUS_LABEL[s]}
              </span>
            ))}
            <span>
              <i style={{ background: "#009ade" }} /> Project
            </span>
            <span className="muted">Cirkelgrootte = aantal medewerkers</span>
          </div>
        </Kaart>

        <div>
          <Kaart titel={`Partners op de kaart (${partners.length})`}>
            <p className="muted klein-tekst">
              {rol ? `Rol: ${ROL_LABEL[rol]}. ` : ""}
              {status ? `Status: ${STATUS_LABEL[status]}. ` : ""}
              Klik een cirkel voor het partnerdossier; klik een vierkant om dat project te selecteren.
            </p>
            {project ? (
              <p className="klein-tekst">
                {koppelingen.filter((k) => k.binnenWerkgebied).length} van {koppelingen.length} partners dekken {project.locatie.plaats} binnen hun werkgebied. <Link href={url({ project: undefined })}>Selectie opheffen</Link> · <Link href={`/projecten/${project.id}`}>Naar project</Link>
              </p>
            ) : null}
          </Kaart>
        </div>
      </div>

      {project ? (
        <Kaart titel={`Afstand tot ${project.naam}`}>
          {koppelingen.length === 0 ? (
            <Leeg titel="Geen partners binnen de filters" />
          ) : (
            <div className="tabelWrap">
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Partner</th>
                    <th>Status</th>
                    <th>Rollen</th>
                    <th>Plaats</th>
                    <th className="num">Afstand (km)</th>
                    <th className="num">Werkgebied (km)</th>
                    <th>Binnen werkgebied</th>
                  </tr>
                </thead>
                <tbody>
                  {koppelingen.map((k) => (
                    <tr key={k.partner.id}>
                      <td>
                        <Link href={`/partners/${k.partner.id}`}>{k.partner.naam}</Link>
                      </td>
                      <td>
                        <StatusBadge status={k.partner.status} />
                      </td>
                      <td>{k.partner.rollen.map((r) => ROL_LABEL[r]).join(", ")}</td>
                      <td>{k.partner.vestigingsplaats}</td>
                      <td className="num">{getal(k.afstandKm)}</td>
                      <td className="num">{getal(k.partner.werkgebiedKm)}</td>
                      <td>{k.binnenWerkgebied ? <b style={{ color: "var(--green)" }}>Ja</b> : <span className="muted">Nee</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Kaart>
      ) : null}
    </>
  );
}
