// US-49: goudstandaard per partnertype — verplichte en gewenste velden plus beoordelingscriteria. Alleen de beheerder wijzigt.
import Link from "next/link";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { goudstandaardPerRol, goudstandaardVoor } from "@/lib/domain/goudstandaard";
import { BASISVELD_LABEL, ROLLEN, type Rol } from "@/lib/domain/types";
import { datumTijd, ROL_LABEL } from "@/lib/format";
import { getDb } from "@/lib/store";
import { Badge, Kaart, Melding, PaginaKop } from "@/components/ui";
import GoudstandaardEditor from "@/components/beheer/GoudstandaardEditor";
import { zichtbaar } from "@/lib/domain/zichtbaarheid";

export default async function GoudstandaardPagina({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const rol: Rol = ROLLEN.includes(sp.rol as Rol) ? (sp.rol as Rol) : "aannemer";
  const [db, gebruiker] = await Promise.all([getDb(), huidigeGebruiker()]);
  const magBeheren = heeftRecht(gebruiker.rol, "beheer");
  const profiel = goudstandaardVoor(db, rol);
  const vulling = goudstandaardPerRol(db, db.partners.filter(zichtbaar));
  const opties = [
    ...Object.entries(BASISVELD_LABEL).map(([k, label]) => ({ sleutel: `basis:${k}`, label: `Basisveld · ${label}` })),
    ...db.factoren.filter((f) => f.actief && !f.afgeleid).map((f) => ({ sleutel: `factor:${f.id}`, label: `${f.categorie.slice(0, 2)} ${f.naam}` }))
  ];
  return (
    <>
      <PaginaKop
        eyebrow="Beheer"
        titel="Goudstandaard"
        intro="Per partnertype de velden die Blauwhoed verplicht of gewenst vindt en de beoordelingscriteria. Waarden met bron goudstandaard of eigen uitgave van Blauwhoed zijn leidend: AI overschrijft ze nooit en zet er hooguit een voorstel naast."
        acties={<Link href="/beheer" className="knop knop-secundair">Terug naar beheer</Link>}
      />
      {!magBeheren ? <Melding soort="waarschuwing">Alleen-lezen: alleen de beheerder stelt de goudstandaard vast.</Melding> : null}
      <nav className="tabs" aria-label="Partnertype">
        {ROLLEN.map((r) => (
          <Link key={r} href={`/beheer/goudstandaard?rol=${r}`} className={r === rol ? "active" : ""} scroll={false}>
            {ROL_LABEL[r]}
            <span>{vulling.find((v) => v.rol === r)?.pct ?? "–"}%</span>
          </Link>
        ))}
      </nav>
      <div className="raster raster-zij">
        <Kaart titel={`Goudstandaard ${ROL_LABEL[rol].toLowerCase()}`}>
          <p className="muted klein-tekst">
            Versie {profiel.versie} · {profiel.versie ? `vastgesteld door ${profiel.door} op ${datumTijd(profiel.bijgewerktOp)}` : <Badge kleur="geel">startpunt, nog niet door Blauwhoed vastgesteld</Badge>}
          </p>
          <GoudstandaardEditor key={rol} rol={rol} profiel={profiel} opties={opties} magBeheren={magBeheren} />
        </Kaart>
        <Kaart titel="Vulling per partnertype">
          <div className="tabelWrap">
          <table className="tabel">
            <thead>
              <tr>
                <th>Partnertype</th>
                <th className="num">Partners</th>
                <th className="num">Gevuld</th>
                <th className="num">Verplicht onvolledig</th>
              </tr>
            </thead>
            <tbody>
              {vulling.map((v) => (
                <tr key={v.rol}>
                  <td>{ROL_LABEL[v.rol]}</td>
                  <td className="num">{v.partners}</td>
                  <td className="num">{v.pct ?? "–"}%</td>
                  <td className="num">
                    <Link href={`/partners?rol=${v.rol}&gs=onvolledig`}>{v.onvolledig}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <p className="muted klein-tekst">Goudstandaardwaarden per partner leg je vast op het partnerdossier (tab Factoren, bron &ldquo;Goudstandaard Blauwhoed&rdquo;) of via een import met bron goudstandaard of eigen uitgave.</p>
        </Kaart>
      </div>
    </>
  );
}
