// Epic 5: discovery van onbekende partners (US-23 t/m US-28).
import Link from "next/link";
import DiscoveryStart from "@/components/discovery/DiscoveryStart";
import KandidaatKaart from "@/components/discovery/KandidaatKaart";
import { Badge, Kaart, Leeg, Melding, PaginaKop } from "@/components/ui";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { demoConnector } from "@/lib/domain/discovery";
import { webzoekConnector } from "@/lib/domain/webzoek";
import { signalenVoor } from "@/lib/domain/signalen";
import type { DiscoveryStatus } from "@/lib/domain/types";
import { datumTijd } from "@/lib/format";
import { getDb } from "@/lib/store";

const STATUSSEN: Array<{ id: DiscoveryStatus; label: string }> = [
  { id: "nieuw", label: "Nieuw" },
  { id: "geparkeerd", label: "Geparkeerd" },
  { id: "geaccepteerd", label: "Geaccepteerd" },
  { id: "afgewezen", label: "Afgewezen" }
];

export default async function DiscoveryPagina({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { status: statusParam } = await searchParams;
  const status: DiscoveryStatus = STATUSSEN.some((s) => s.id === statusParam) ? (statusParam as DiscoveryStatus) : "nieuw";
  const [db, gebruiker] = await Promise.all([getDb(), huidigeGebruiker()]);
  const rechten = {
    goedkeuren: heeftRecht(gebruiker.rol, "discovery_goedkeuren"),
    promoveren: heeftRecht(gebruiker.rol, "prospect_promoveren")
  };
  const magStarten = heeftRecht(gebruiker.rol, "bewerken");
  const projecten = db.projecten.map((p) => ({ id: p.id, naam: p.naam, rollen: p.eisen.map((e) => e.rol), omschrijving: p.omschrijving }));
  const kandidaten = db.kandidaten.filter((k) => k.status === status).sort((a, b) => b.opgehaaldOp.localeCompare(a.opgehaaldOp));
  const projectNaam = (id?: string) => db.projecten.find((p) => p.id === id)?.naam;
  const partnerNaam = (id?: string) => db.partners.find((p) => p.id === id)?.naam;
  const prospectSignalen = signalenVoor(db).filter((s) => s.soort === "prospect"); // US-28

  return (
    <>
      <PaginaKop eyebrow="Epic 5" titel="Discovery" intro="Onbekende partijen vinden op basis van een projectprofiel. Kandidaten komen nooit zonder menselijke goedkeuring in een advies." />

      <div className="raster raster-zij">
        <Kaart titel="Zoekopdracht starten">
          <DiscoveryStart projecten={projecten} magStarten={magStarten} />
        </Kaart>
        <Kaart titel="Bronnen en beleid">
          <ul className="lijst">
            <li>
              <b>{webzoekConnector.naam}</b> {db.instellingen.externeBronnenToegestaan ? <Badge kleur="groen">actief</Badge> : <Badge kleur="geel">uit</Badge>}
              <p className="muted">{webzoekConnector.omschrijving}</p>
            </li>
            <li>
              <b>KVK Zoeken API</b> {process.env.KVK_API_KEY && db.instellingen.externeBronnenToegestaan ? <Badge kleur="groen">actief</Badge> : <Badge kleur="grijs">KVK_API_KEY niet gezet</Badge>}
              <p className="muted">Officieel handelsregister (developers.kvk.nl); zoekt op branchetermen per rol, trefwoorden en regio.</p>
            </li>
            {process.env.DEMO_DATA === "1" ? (
              <li>
                <b>{demoConnector.naam}</b> <Badge kleur="geel">demo</Badge>
                <p className="muted">{demoConnector.omschrijving}</p>
              </li>
            ) : null}
            <li>
              <b>AI-samenvatting</b> {process.env.ANTHROPIC_API_KEY ? <Badge kleur="groen">Claude actief</Badge> : <Badge kleur="grijs">regels (ANTHROPIC_API_KEY niet gezet)</Badge>}
              <p className="muted">Per kandidaat: wat doet het bedrijf, referenties, waarom past het, wat is onzeker — op basis van de openbare websitetekst.</p>
            </li>
          </ul>
          <Melding soort="info">
            Alleen bedrijfsgegevens; geen persoonsgegevens (US-24). Elke kandidaat legt bron-URL en ophaaldatum vast.
          </Melding>
          <p>
            Externe bronnen: {db.instellingen.externeBronnenToegestaan ? <Badge kleur="groen">toegestaan</Badge> : <Badge kleur="geel">uit</Badge>}{" "}
            <span className="muted">— aan/uit via <Link href="/beheer">Beheer</Link>. Zolang externe bronnen uit staan, worden er geen websites of registers geraadpleegd.</span>
          </p>
          <p className="muted">
            Afgeschermde omgeving: {db.instellingen.afgeschermdeOmgeving ? "ja" : "nee"} · AI-provider: {db.instellingen.aiProvider} (US-48)
          </p>
        </Kaart>
      </div>

      <Kaart titel="Wachtrij kandidaten">
        <nav className="tabs" aria-label="Status">
          {STATUSSEN.map((s) => (
            <Link key={s.id} href={`/discovery?status=${s.id}`} className={s.id === status ? "active" : ""} scroll={false}>
              {s.label}
              <span>{db.kandidaten.filter((k) => k.status === s.id).length}</span>
            </Link>
          ))}
        </nav>
        {kandidaten.length ? (
          kandidaten.map((k) => <KandidaatKaart key={k.id} kandidaat={k} projectNaam={projectNaam(k.projectId)} dubbelNaam={partnerNaam(k.mogelijkeDubbelVan?.split("|")[0])} rechten={rechten} />)
        ) : (
          <Leeg titel={`Geen kandidaten met status '${STATUSSEN.find((s) => s.id === status)?.label}'`} tekst={status === "nieuw" ? "Start een zoekopdracht om kandidaten te verzamelen." : undefined} />
        )}
      </Kaart>

      <div className="raster raster-2">
        <Kaart titel="Wat de filtering leerde">
          {db.afwijsredenen.length ? (
            <ul className="lijst">
              {[...db.afwijsredenen]
                .sort((a, b) => b.op.localeCompare(a.op))
                .map((r, i) => (
                  <li key={`${r.op}-${i}`}>
                    <b>{r.reden}</b>
                    <p className="muted">
                      {r.kandidaatNaam} · {datumTijd(r.op)}
                    </p>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="muted">Nog geen afwijsredenen. Elke afwijzing met reden verlaagt de voorlopige score van vergelijkbare kandidaten (US-25).</p>
          )}
        </Kaart>
        <Kaart titel="Prospects die structureel beter scoren">
          {prospectSignalen.length ? (
            <div className="signaalLijst">
              {prospectSignalen.map((s) => (
                <div key={s.id} className="signaal">
                  <Badge kleur={s.ernst === "kritiek" ? "rood" : s.ernst === "waarschuwing" ? "geel" : "blauw"}>{s.ernst}</Badge>
                  <div>
                    <b>{s.link ? <Link href={s.link}>{s.titel}</Link> : s.titel}</b>
                    <p className="muted">{s.omschrijving}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Geen signaal: geen prospect scoort momenteel structureel beter dan de vaste kring (US-28).</p>
          )}
        </Kaart>
      </div>
    </>
  );
}
