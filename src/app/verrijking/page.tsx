// Epic 6: verrijking en AI-extractie (US-29 t/m US-31, US-48).
import Link from "next/link";
import ClaimsSplitser from "@/components/verrijking/ClaimsSplitser";
import VerrijkingStart from "@/components/verrijking/VerrijkingStart";
import VoorstelActies from "@/components/verrijking/VoorstelActies";
import BronnenBeheer from "@/components/verrijking/BronnenBeheer";
import { Badge, Definities, Kaart, Leeg, Melding, PaginaKop } from "@/components/ui";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import type { EnrichmentVoorstel } from "@/lib/domain/types";
import { datumTijd, waardeTekst } from "@/lib/format";
import { getDb } from "@/lib/store";
import { budgetStatus, schatVerrijkingsronde } from "@/lib/domain/kosten";

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
  const partners = db.partners.filter((p) => p.status !== "geblokkeerd").map((p) => ({ id: p.id, naam: p.naam }));
  const voorstellen = db.verrijkingsvoorstellen.filter((v) => v.status === status && (!rondeParam || v.rondeId === rondeParam));
  const laatstGeraadpleegd = (p: (typeof db.partners)[number]) => p.bronnen.filter((b) => b.soort === "web-verrijking").map((b) => b.opgehaaldOp).sort().pop() ?? "";
  const wachtend = db.partners.filter((p) => p.status !== "geblokkeerd");
  const volgendeBatch = Math.min(20, wachtend.length);
  const schatting = schatVerrijkingsronde(volgendeBatch);
  const schattingHeleBestand = schatVerrijkingsronde(wachtend.length);
  const budget = budgetStatus(db);
  void laatstGeraadpleegd;
  const partnerNaam = (id: string) => db.partners.find((p) => p.id === id)?.naam ?? id;
  const i = db.instellingen;

  return (
    <>
      <PaginaKop eyebrow="Epic 6" titel="Verrijking" intro="Openbare bedrijfsinformatie ophalen en kenmerken extraheren volgens de taxonomie. Extracties krijgen bron 'web' met lage betrouwbaarheid en worden pas na controle overgenomen." />

      <div className="raster raster-zij">
        <Kaart titel="Verrijkingsronde">
          <VerrijkingStart partners={partners} magBewerken={magBewerken} externeBronnen={i.externeBronnenToegestaan} schatting={{ batch: volgendeBatch, batchUsd: schatting.geschatteKostenUsd, totaal: wachtend.length, totaalUsd: schattingHeleBestand.geschatteKostenUsd, aiActief: i.aiProvider === "anthropic", budgetOverschreden: budget.overschreden }} />
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
            US-48: de extractie draait lokaal met regels uit de taxonomie. Er gaan geen brongegevens naar modelleveranciers. Instellingen wijzig je onder <Link href="/beheer">Beheer</Link>.
          </Melding>
          <h4>Periodiek (US-31)</h4>
          <p className="muted">
            Een cron-job draait dezelfde ronde via <code>POST /api/verrijking/run</code> met header <code>x-cron-secret</code> (waarde uit <code>CRON_SECRET</code>). Alleen wijzigingen ten opzichte van het huidige profiel komen in de wachtrij.
          </p>
        </Kaart>
      </div>

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
                      <Badge kleur={v.soort === "aantoonbaar" ? "groen" : "geel"}>{v.soort}</Badge>
                      {v.aard === "niet_bevestigd" ? <Badge kleur="rood" titel="De eerder gevonden waarde is niet meer op de bron terug te vinden; accepteren markeert haar als verouderd">niet bevestigd</Badge> : v.aard === "nieuw" ? <Badge kleur="blauw">nieuw</Badge> : null}
                      {v.conflictMetGevalideerd ? <Badge kleur="rood" titel="Wijkt af van een door een mens gevalideerde waarde; wordt nooit stilzwijgend overschreven">wijkt af van gevalideerd</Badge> : null}
                    </td>
                    <td className="num">{Math.round(v.betrouwbaarheid * 100)}%</td>
                    <td className="citaatCel">
                      <span className="muted">{v.bron}</span>
                      {v.bronUrl ? (
                        <>
                          {" · "}
                          {/^https?:/.test(v.bronUrl) ? (
                            <a href={v.bronUrl} target="_blank" rel="noreferrer">
                              {v.bronUrl}
                            </a>
                          ) : (
                            v.bronUrl
                          )}
                        </>
                      ) : null}
                      <blockquote>{v.citaat}</blockquote>
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
