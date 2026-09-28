// Epic 6: verrijking en AI-extractie (US-29 t/m US-31, US-48).
import Link from "next/link";
import ClaimsSplitser from "@/components/verrijking/ClaimsSplitser";
import VerrijkingStart from "@/components/verrijking/VerrijkingStart";
import VoorstelActies from "@/components/verrijking/VoorstelActies";
import { VoorstelBetrouwbaarheid, VoorstelBron, VoorstelSoort } from "@/components/verrijking/VoorstelKenmerken";
import BronnenBeheer from "@/components/verrijking/BronnenBeheer";
import { Badge, Definities, Kaart, Leeg, Melding, PaginaKop } from "@/components/ui";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import type { EnrichmentVoorstel } from "@/lib/domain/types";
import { datumTijd, waardeTekst } from "@/lib/format";
import { getDb } from "@/lib/store";
import { budgetStatus, schatVerrijkingsronde } from "@/lib/domain/kosten";
import { FREQUENTIE_LABEL, OMVANG_LABEL, schemaVan, selecteerPartners, volgendeGeplandeRonde } from "@/lib/domain/schema";
import SchemaBeheer from "@/components/verrijking/SchemaBeheer";
import RegisterBeheer from "@/components/verrijking/RegisterBeheer";
import { CERTIFICAAT_TYPEN } from "@/components/partners/certificaten";
import type { SchattingPerOmvang } from "@/components/verrijking/VerrijkingStart";

// Server actions op deze pagina (verrijking via internet) mogen tot 60 s duren (Vercel).
export const maxDuration = 60;

type VStatus = EnrichmentVoorstel["status"];
const STATUSSEN: Array<{ id: VStatus; label: string }> = [
  { id: "open", label: "Open" },
  { id: "geaccepteerd", label: "Geaccepteerd" },
  { id: "afgewezen", label: "Afgewezen" }
];

export default async function VerrijkingPagina({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { status: statusParam, ronde: rondeParam } = await searchParams;
  const status: VStatus = STATUSSEN.some((s) => s.id === statusParam) ? (statusParam as VStatus) : "open";
  const [db, gebruiker] = await Promise.all([getDb(), huidigeGebruiker()]);
  const magBewerken = heeftRecht(gebruiker.rol, "bewerken");
  const partners = db.partners.filter((p) => p.status !== "geblokkeerd" && p.status !== "gearchiveerd" && p.status !== "concept").map((p) => ({ id: p.id, naam: p.naam }));
  const voorstellen = db.verrijkingsvoorstellen.filter((v) => v.status === status && (!rondeParam || v.rondeId === rondeParam));
  const budget = budgetStatus(db);
  // US-57: verwachte AI-bewerkingen per omvang (na het overslaan van ongewijzigde websites) en het effect op het budget.
  const schema = schemaVan(db);
  const aiActief = Boolean(process.env.ANTHROPIC_API_KEY);
  const schattingen = Object.fromEntries(
    (["alles", "partnertype", "niet_verrijkt_sinds", "gewijzigde_website"] as const).map((o) => [o, schatVerrijkingsronde(selecteerPartners(db, { ...schema, omvang: o }), db, aiActief, { alleenGewijzigd: o === "gewijzigde_website" })])
  ) as SchattingPerOmvang;
  const openRonde = db.verrijkingsrondes.find((r) => !r.klaarOp);
  const volgende = volgendeGeplandeRonde(schema);
  const geplandeSelectie = selecteerPartners(db, schema);
  const geplandeSchatting = schatVerrijkingsronde(geplandeSelectie, db, aiActief, { alleenGewijzigd: schema.omvang === "gewijzigde_website" });
  const partnerNaam = (id: string) => db.partners.find((p) => p.id === id)?.naam ?? id;
  const i = db.instellingen;

  return (
    <>
      <PaginaKop eyebrow="Epic 6" titel="Verrijking" intro="Openbare bedrijfsinformatie ophalen en kenmerken extraheren volgens de taxonomie. Extracties krijgen bron 'web' met lage betrouwbaarheid en worden pas na controle overgenomen." />

      <div className="raster raster-zij">
        <Kaart titel="Verrijkingsronde">
          <VerrijkingStart partners={partners} magBewerken={magBewerken} externeBronnen={i.externeBronnenToegestaan} schattingen={schattingen} budgetOverschreden={budget.overschreden} openRonde={openRonde ? `${openRonde.partnerIdsVerwerkt.length} van ${openRonde.totaal} verwerkt` : null} />
        </Kaart>
        <Kaart titel="Instellingen en beleid">
          <Definities
            items={[
              ["Laatste ronde", datumTijd(i.laatsteVerrijking)],
              ["Externe bronnen", i.externeBronnenToegestaan ? "toegestaan (website wordt opgehaald)" : "uit (alleen profieltekst of geplakte tekst)"],
              ["Afgeschermde omgeving", i.afgeschermdeOmgeving ? "ja" : "nee"],
              ["AI-provider", i.aiProvider]
            ]}
          />
          <Melding soort="info">
            US-48/US-59: zonder ANTHROPIC_API_KEY draait de extractie op regels uit de taxonomie. Met sleutel leest het per functie ingestelde model (zie <Link href="/beheer/verbruik">AI-verbruik</Link>) uitsluitend openbare bedrijfsteksten; nooit contactpersonen. Elke verrijkte partner telt als één AI-bewerking.
          </Melding>
        </Kaart>
      </div>

      <Kaart titel="Verrijkingsschema (US-56)">
        <div className="raster raster-2">
          <SchemaBeheer schema={schema} magBeheren={heeftRecht(gebruiker.rol, "beheer")} />
          <div>
            <Definities
              items={[
                ["Status", schema.frequentie === "uit" ? "uit" : `${FREQUENTIE_LABEL[schema.frequentie].toLowerCase()}, ${OMVANG_LABEL[schema.omvang].toLowerCase()}`],
                ["Volgende geplande ronde", volgende ? datumTijd(volgende.toISOString()) : "–"],
                ["Verwacht bij die ronde", schema.frequentie === "uit" ? "–" : `${geplandeSchatting.bewerkingen} AI-bewerking(en) voor ${geplandeSchatting.partners} partner(s); resterend budget daarna ${geplandeSchatting.resterendNa}`],
                ["Laatste geplande ronde", datumTijd(schema.laatsteGeplandeRonde)],
                ["Laatste controle (cron)", datumTijd(schema.laatsteControle)]
              ]}
            />
            {schema.overgeslagen ? <Melding soort="waarschuwing">Niet gestart op {datumTijd(schema.overgeslagen.op)}: {schema.overgeslagen.reden}</Melding> : null}
            <p className="muted klein-tekst">
              Een dagelijkse cron (vercel.json) roept <code>/api/verrijking/run</code> aan; dat endpoint start een ronde zodra het geplande moment is verstreken. Een ronde die het maandbudget zou overschrijden, start niet automatisch: de beheerder krijgt een signaal. Alleen wijzigingen komen in de wachtrij.
            </p>
          </div>
        </div>
      </Kaart>

      <Kaart titel="Rondes en verschillenoverzicht">
        {db.verrijkingsrondes.length ? (
          <div className="tabelWrap">
            <table className="tabel">
              <thead>
                <tr>
                  <th>Gestart</th>
                  <th>Door</th>
                  <th>Voortgang</th>
                  <th className="num">Nieuw</th>
                  <th className="num">Gewijzigd</th>
                  <th className="num">Niet bevestigd</th>
                  <th className="num">Ongewijzigd</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {db.verrijkingsrondes.slice(0, 8).map((r) => (
                  <tr key={r.id}>
                    <td>{datumTijd(r.gestartOp)}</td>
                    <td>{r.door}</td>
                    <td>{r.klaarOp ? <Badge kleur="groen">afgerond {datumTijd(r.klaarOp)}</Badge> : <Badge kleur="geel">{r.partnerIdsVerwerkt.length} van {r.totaal}</Badge>}</td>
                    <td className="num">{r.nieuw}</td>
                    <td className="num">{r.gewijzigd}</td>
                    <td className="num">{r.nietBevestigd}</td>
                    <td className="num" title="Delta-selectie: broninhoud niet gewijzigd sinds de vorige ronde">{r.ongewijzigd}</td>
                    <td>
                      <Link href={`/verrijking?ronde=${r.id}`}>Alleen verschillen van deze ronde</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Leeg titel="Nog geen rondes" tekst="Start een verrijkingsronde; alleen de gevonden verschillen (nieuw / gewijzigd / niet langer bevestigd) hoeven beoordeeld te worden." />
        )}
      </Kaart>

      <Kaart titel="Extra bronnen (configuratie)">
        <BronnenBeheer bronnen={i.verrijkingsbronnen ?? []} magBeheren={heeftRecht(gebruiker.rol, "beheer")} />
      </Kaart>

      <Kaart titel="Keurmerk- en brancheregisters (US-62)">
        <RegisterBeheer registers={i.registerbronnen ?? []} certificaten={CERTIFICAAT_TYPEN} magBeheren={heeftRecht(gebruiker.rol, "beheer")} />
      </Kaart>

      <Kaart titel={rondeParam ? "Verschillen van de gekozen ronde" : "Wachtrij voorstellen"} acties={rondeParam ? <Link href="/verrijking">Alle voorstellen</Link> : null}>
        <nav className="tabs" aria-label="Status">
          {STATUSSEN.map((s) => (
            <Link key={s.id} href={`/verrijking?status=${s.id}`} className={s.id === status ? "active" : ""} scroll={false}>
              {s.label}
              <span>{db.verrijkingsvoorstellen.filter((v) => v.status === s.id).length}</span>
            </Link>
          ))}
        </nav>
        {voorstellen.length ? (
          <div className="tabelWrap">
            <table className="tabel">
              <thead>
                <tr>
                  <th>Partner</th>
                  <th>Veld</th>
                  <th>Huidig → voorgesteld</th>
                  <th>Soort</th>
                  <th className="num">Betrouwb.</th>
                  <th>Bron en citaat</th>
                  <th>Gevonden</th>
                  {status === "open" ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {voorstellen.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <Link href={`/partners/${v.partnerId}`}>{partnerNaam(v.partnerId)}</Link>
                    </td>
                    <td>{v.veld}</td>
                    <td>
                      <span className="muted">{waardeTekst(v.huidig)}</span> → <b>{waardeTekst(v.voorgesteld)}</b>
                    </td>
                    <td>
                      <VoorstelSoort v={v} />
                    </td>
                    <td className="num"><VoorstelBetrouwbaarheid v={v} /></td>
                    <td className="citaatCel">
                      <VoorstelBron v={v} />
                    </td>
                    <td>{datumTijd(v.gevondenOp)}</td>
                    {status === "open" ? (
                      <td>
                        <VoorstelActies id={v.id} magBewerken={magBewerken} />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Leeg titel={`Geen ${STATUSSEN.find((s) => s.id === status)?.label.toLowerCase()} voorstellen`} tekst={status === "open" ? "Start een verrijkingsronde om voorstellen te verzamelen." : undefined} />
        )}
      </Kaart>

      <Kaart titel="Claims splitsen (US-30)">
        <p className="muted">Scheid duurzaamheidsclaims in aantoonbaar (certificaat, meting, berekening) en geclaimd (marketingtekst). Draait volledig in de browser.</p>
        <ClaimsSplitser />
      </Kaart>
    </>
  );
}
