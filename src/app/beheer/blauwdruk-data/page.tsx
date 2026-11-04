// US-49: Blauwdruk-Data per partnertype — verplichte en gewenste velden plus beoordelingscriteria. Alleen de beheerder wijzigt.
import Link from "next/link";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { goudstandaardVoor } from "@/lib/domain/goudstandaard";
import { vullingPerRol } from "@/lib/domain/datakwaliteit";
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
  const vulling = vullingPerRol(db, db.partners.filter(zichtbaar));
  const opties = [
    ...Object.entries(BASISVELD_LABEL).map(([k, label]) => ({ sleutel: `basis:${k}`, label: `Basisveld · ${label}` })),
    ...db.factoren.filter((f) => f.actief && !f.afgeleid).map((f) => ({ sleutel: `factor:${f.id}`, label: `${f.categorie.slice(0, 2)} ${f.naam}` }))
  ];
  return (
    <>
      <PaginaKop
        eyebrow="Beheer"
        titel="Blauwdruk-Data"
        intro="Per partnertype de velden die Blauwhoed verplicht of gewenst vindt, welke velden een tweede controle door een beheerder vragen, en de beoordelingscriteria. Aan te passen zonder ontwikkelaar. Waarden met bron Blauwdruk-Data of eigen uitgave van Blauwhoed zijn leidend: AI overschrijft ze nooit en zet er hooguit een voorstel naast."
      />
      {!magBeheren ? <Melding soort="waarschuwing">Alleen-lezen: alleen de beheerder stelt de Blauwdruk-Data vast.</Melding> : null}
      <nav className="tabs" aria-label="Partnertype">
        {ROLLEN.map((r) => (
          <Link key={r} href={`/beheer/blauwdruk-data?rol=${r}`} className={r === rol ? "active" : ""} scroll={false}>
            {ROL_LABEL[r]}
            <span>{vulling.find((v) => v.rol === r)?.verplichtPct ?? "–"}%</span>
          </Link>
        ))}
      </nav>
      <Kaart titel={`Blauwdruk-Data ${ROL_LABEL[rol].toLowerCase()}`} acties={<Link href={`/datakwaliteit?rol=${rol}`}>Vulling bij de partners</Link>}>
          <p className="muted klein-tekst">
            Versie {profiel.versie} · {profiel.versie ? `vastgesteld door ${profiel.door} op ${datumTijd(profiel.bijgewerktOp)}` : <Badge kleur="geel">startpunt, nog niet door Blauwhoed vastgesteld</Badge>}
          </p>
          <GoudstandaardEditor key={rol} rol={rol} profiel={profiel} opties={opties} magBeheren={magBeheren} />
          <p className="muted klein-tekst">Blauwdruk-Data-waarden per partner leg je vast op het partnerdossier (tab Factoren, bron &ldquo;Blauwdruk-Data Blauwhoed&rdquo;) of via een import met bron Blauwdruk-Data of eigen uitgave. Hoe ver de partners per type gevuld zijn: <Link href="/datakwaliteit">Kwaliteit → Datakwaliteit</Link> (het percentage staat ook in de tabbladen hierboven).</p>
      </Kaart>
    </>
  );
}
