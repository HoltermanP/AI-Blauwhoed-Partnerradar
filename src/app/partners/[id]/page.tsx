// US-40: partnerdossier op één pagina, met tabbladen profiel, factoren, certificaten, capaciteit, historie, kwalificatie en contact.
import Link from "next/link";
import { notFound } from "next/navigation";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { effectieveFactoren, huidigeBelasting, leidFactorenAf, samenwerking } from "@/lib/domain/derive";
import { signalenVoor } from "@/lib/domain/signalen";
import type { Database, Partner } from "@/lib/domain/types";
import { datum, datumTijd, euro, getal, ROL_LABEL, waardeTekst } from "@/lib/format";
import { getDb } from "@/lib/store";
import { Badge, Definities, Kaart, Knop, Leeg, Melding, Metriek, PaginaKop, StatusBadge, Tabs } from "@/components/ui";
import CapaciteitBeheer from "@/components/partners/CapaciteitBeheer";
import CertificatenBeheer from "@/components/partners/CertificatenBeheer";
import { certificaatStatus } from "@/components/partners/certificaten";
import ContactBeheer from "@/components/partners/ContactBeheer";
import FactorenBeheer from "@/components/partners/FactorenBeheer";
import { FinancieelFormulier, KwalificatieChecklist } from "@/components/partners/KwalificatieBeheer";
import StatusBeheer from "@/components/partners/StatusBeheer";
import PartnerVerrijken from "@/components/partners/PartnerVerrijken";
import HerkomstActies from "@/components/partners/HerkomstActies";
import DocumentenBeheer from "@/components/partners/DocumentenBeheer";
import VoorstelActies from "@/components/verrijking/VoorstelActies";

// Server actions op deze pagina (verrijking via internet) mogen tot 60 s duren (Vercel).
export const maxDuration = 60;

const TABS = [
  { id: "profiel", label: "Profiel" },
  { id: "factoren", label: "Factoren" },
  { id: "certificaten", label: "Certificaten" },
  { id: "capaciteit", label: "Capaciteit" },
  { id: "historie", label: "Historie" },
  { id: "kwalificatie", label: "Kwalificatie" },
  { id: "contact", label: "Contact" },
  { id: "documenten", label: "Documenten" },
  { id: "brondata", label: "Brondata" }
];

export default async function PartnerDossier({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const [db, gebruiker] = await Promise.all([getDb(), huidigeGebruiker()]);
  const p = db.partners.find((x) => x.id === id);
  if (!p) notFound();

  const tab = TABS.some((t) => t.id === sp.tab) ? (sp.tab as string) : "profiel";
  const magBewerken = heeftRecht(gebruiker.rol, "bewerken");
  const magPromoveren = heeftRecht(gebruiker.rol, "prospect_promoveren");
  const magKwalificeren = heeftRecht(gebruiker.rol, "kwalificeren");
  const nu = new Date();
  const afgeleid = leidFactorenAf(p, db, nu);
  const stats = afgeleid.statistieken;
  const signalen = signalenVoor(db, nu).filter((s) => s.partnerId === p.id);
  const engagements = db.engagements.filter((e) => e.partnerId === p.id);
  const evaluaties = db.evaluaties.filter((e) => e.partnerId === p.id);
  const openVoorstellen = db.verrijkingsvoorstellen.filter((v) => v.partnerId === p.id && v.status === "open");

  const tabItems = TABS.map((t) => ({
    ...t,
    aantal:
      t.id === "certificaten" ? p.certificaten.length : t.id === "historie" ? engagements.length : t.id === "contact" ? p.contactpersonen.length : t.id === "documenten" ? (p.documenten?.length ?? 0) : t.id === "factoren" ? effectieveFactoren(p, db, nu).length : t.id === "brondata" ? (p.brongegevens?.length ?? 0) : undefined
  }));

  return (
    <>
      <PaginaKop
        eyebrow={`Partner · KVK ${p.kvk} · ${p.rechtsvorm}`}
        titel={p.naam}
        intro={
          <span className="partnerKopMeta">
            <StatusBadge status={p.status} /> {p.rollen.map((r) => <Badge key={r} kleur="grijs">{ROL_LABEL[r]}</Badge>)} <span>{p.vestigingsplaats} · werkgebied {p.werkgebiedKm} km</span>
            {p.website ? (
              <a href={p.website} target="_blank" rel="noreferrer">
                {p.website.replace(/^https?:\/\//, "")}
              </a>
            ) : null}
          </span>
        }
        acties={
          <>
            <Knop href="/partners" variant="secundair">
              Overzicht
            </Knop>
            {magBewerken ? <Knop href={`/partners/${p.id}/bewerken`}>Bewerken</Knop> : null}
            <PartnerVerrijken partnerId={p.id} magBewerken={magBewerken} externeBronnen={db.instellingen.externeBronnenToegestaan} heeftWebsite={Boolean(p.website)} />
          </>
        }
      />
      {p.status === "geblokkeerd" ? (
        <Melding soort="fout">
          Geblokkeerd{p.geblokkeerdTot ? ` tot ${datum(p.geblokkeerdTot)}` : ""}: {p.statusReden ?? "geen reden vastgelegd"}. Deze partner wordt in matching uitgesloten.
        </Melding>
      ) : null}
      {signalen.length ? (
        <Kaart titel={`Signalen (${signalen.length})`} className="signaalLijst">
          {signalen.map((s) => (
            <div key={s.id} className="signaal">
              <Badge kleur={s.ernst === "kritiek" ? "rood" : s.ernst === "waarschuwing" ? "geel" : "blauw"}>{s.ernst}</Badge>
              <div>
                <strong>{s.link && !s.link.startsWith(`/partners/${p.id}`) ? <Link href={s.link}>{s.titel}</Link> : s.titel}</strong>
                <p>{s.omschrijving}</p>
              </div>
            </div>
          ))}
        </Kaart>
      ) : null}
      {openVoorstellen.length ? (
        <Kaart titel={`Open verrijkingsvoorstellen (${openVoorstellen.length})`} acties={<Link href="/verrijking">Wachtrij</Link>}>
          <p className="muted klein-tekst">Gevonden op internet of in aangeleverde tekst; bron &lsquo;web&rsquo;. Pas na acceptatie wordt een voorstel overgenomen in het dossier.</p>
          <div className="tabelWrap">
            <table className="tabel">
              <thead>
                <tr>
                  <th>Veld</th>
                  <th>Huidig → voorgesteld</th>
                  <th>Soort</th>
                  <th className="num">Betrouwb.</th>
                  <th>Bron en citaat</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {openVoorstellen.map((v) => (
                  <tr key={v.id}>
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
                      {v.bronUrl && /^https?:/.test(v.bronUrl) ? (
                        <a href={v.bronUrl} target="_blank" rel="noreferrer">
                          {v.bronUrl}
                        </a>
                      ) : (
                        <span className="muted">{v.bronUrl}</span>
                      )}
                      <blockquote>{v.citaat}</blockquote>
                    </td>
                    <td>
                      <VoorstelActies id={v.id} magBewerken={magBewerken} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Kaart>
      ) : null}
      <Tabs items={tabItems} actief={tab} basis={`/partners/${p.id}`} />

      {tab === "profiel" ? <Profiel p={p} db={db} stats={stats} magBewerken={magBewerken} magPromoveren={magPromoveren} /> : null}
      {tab === "factoren" ? (
        <Kaart titel="Factorwaarden">
          <FactorenBeheer partnerId={p.id} rollen={p.rollen} factoren={db.factoren} effectief={effectieveFactoren(p, db, nu)} handmatig={p.factoren} magBewerken={magBewerken} />
        </Kaart>
      ) : null}
      {tab === "certificaten" ? (
        <Kaart titel="Certificaten">
          <p className="muted klein-tekst">Verlopen certificaten tellen niet mee in de matching en geven een signaal; binnen 90 dagen voor afloop kleurt het certificaat geel.</p>
          <CertificatenBeheer partnerId={p.id} certificaten={p.certificaten} magBewerken={magBewerken} />
        </Kaart>
      ) : null}
      {tab === "capaciteit" ? <Capaciteit p={p} db={db} magBewerken={magBewerken} /> : null}
      {tab === "historie" ? <Historie p={p} db={db} afgeleid={afgeleid} /> : null}
      {tab === "kwalificatie" ? (
        <div className="raster raster-zij">
          <div>
            <Kaart titel="Kwalificatiechecklist (US-34)">
              <KwalificatieChecklist partnerId={p.id} kwalificatie={p.kwalificatie} magKwalificeren={magKwalificeren} />
            </Kaart>
            <Kaart titel="Financiële kerncijfers (US-32)">
              <FinancieelFormulier partnerId={p.id} financieel={p.financieel} magKwalificeren={magKwalificeren} />
            </Kaart>
          </div>
          <div>
            <Kaart titel="Risico en afhankelijkheid">
              <Definities
                items={[
                  ["Risicoklasse", p.financieel?.risicoklasse ? <Badge kleur={p.financieel.risicoklasse === "hoog" ? "rood" : p.financieel.risicoklasse === "midden" ? "geel" : "groen"}>{p.financieel.risicoklasse}</Badge> : <span className="muted">nog geen kerncijfers</span>],
                  ["Boekjaar", p.financieel ? String(p.financieel.boekjaar) : "–"],
                  ["Omzet", euro(p.financieel?.omzet ?? p.omzet)],
                  ["Solvabiliteit", p.financieel?.solvabiliteit !== undefined ? `${getal(p.financieel.solvabiliteit, 1)}%` : "–"],
                  ["Laatste deponering", datum(p.financieel?.laatsteDeponering)],
                  ["Aandeel Blauwhoed in omzet (3 jr)", stats.blauwhoedAandeel !== null ? `${stats.blauwhoedAandeel}%` : <span className="muted">omzet onbekend</span>]
                ]}
              />
              {stats.blauwhoedAandeel !== null && stats.blauwhoedAandeel >= 30 ? (
                <Melding soort={stats.blauwhoedAandeel >= 50 ? "fout" : "waarschuwing"}>US-33: Blauwhoed is {stats.blauwhoedAandeel}% van de jaaromzet van deze partner. Bewaak spreiding en continuïteit.</Melding>
              ) : null}
              <p className="muted klein-tekst">Risicoklasse volgt uit omzetdaling (&gt;20%), solvabiliteit (&lt;20/30%), deponering ouder dan 400 dagen, betalingsgedrag en negatief eigen vermogen. Klasse &quot;hoog&quot; is een harde uitsluiting in de matching.</p>
            </Kaart>
          </div>
        </div>
      ) : null}
      {tab === "documenten" ? (
        <Kaart titel="Documenten">
          <DocumentenBeheer partnerId={p.id} documenten={p.documenten ?? []} magBewerken={magBewerken} />
        </Kaart>
      ) : null}
      {tab === "brondata" ? (
        <Kaart titel="Herkomst en AVG (eis 1)">
          <HerkomstActies partnerId={p.id} partnerNaam={p.naam} magBeheren={heeftRecht(gebruiker.rol, "beheer")} />
        </Kaart>
      ) : null}
      {tab === "brondata" ? (
        <Kaart titel="Alle brondata (oorspronkelijke kolommen per geïmporteerde rij)">
          {!p.brongegevens?.length ? (
            <Leeg titel="Geen brondata" tekst="Deze partner is niet uit een import afkomstig, of de import bevatte geen extra kolommen." />
          ) : (
            <div className="raster raster-2">
              {p.brongegevens.map((b, i) => (
                <section key={i} className="brondataBlok">
                  <h3>
                    {b.titel ? `Concept: ${b.titel}` : `Rij ${i + 1}`} <small className="muted">· {b.bron} · {datum(b.op)}</small>
                  </h3>
                  <div className="tabelWrap">
                    <table className="tabel brondataTabel">
                      <tbody>
                        {Object.entries(b.velden).map(([k, v]) => (
                          <tr key={k}>
                            <td className="muted">{k}</td>
                            <td>{/^https?:\/\//.test(v) ? <a href={v} target="_blank" rel="noreferrer">{v}</a> : v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          )}
        </Kaart>
      ) : null}
      {tab === "contact" ? (
        <Kaart titel="Contactpersonen (US-47)">
          <ContactBeheer partnerId={p.id} contactpersonen={p.contactpersonen} magBewerken={magBewerken} />
        </Kaart>
      ) : null}
    </>
  );
}

function Profiel({ p, db, stats, magBewerken, magPromoveren }: { p: Partner; db: Database; stats: ReturnType<typeof leidFactorenAf>["statistieken"]; magBewerken: boolean; magPromoveren: boolean }) {
  const belasting = huidigeBelasting(p, db);
  return (
    <div className="raster raster-zij">
      <div>
        <Kaart titel="Profiel">
          <p>{p.omschrijving}</p>
          <Definities
            items={[
              ["Vestigingsplaats", `${p.vestigingsplaats}${p.adres ? `, ${p.adres}` : ""}`],
              ["Werkgebied", `${p.werkgebiedKm} km rond vestiging`],
              ["Rechtsvorm", p.rechtsvorm],
              ["Website", p.website ? <a href={p.website} target="_blank" rel="noreferrer">{p.website}</a> : "–"],
              ["Aangemaakt", datum(p.aangemaaktOp)],
              ["Bijgewerkt", datumTijd(p.bijgewerktOp)]
            ]}
          />
          {p.tags.length ? (
            <p style={{ marginTop: 14 }}>
              {p.tags.map((t) => (
                <span key={t} className="chip">
                  {t}
                </span>
              ))}
            </p>
          ) : null}
        </Kaart>
        <Kaart titel="Referentieprojecten (opgave)">
          {p.referenties.length ? (
            <ul className="lijst">
              {p.referenties.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">Geen referenties opgegeven.</p>
          )}
          <p className="muted klein-tekst">Referenties zijn zelfbeeld (bron opgave, betrouwbaarheid 60%). Projecthistorie in het tabblad Historie is bewijs.</p>
        </Kaart>
        <Kaart titel="Capaciteitsindicatoren (US-05)" acties={magBewerken ? <Link href={`/partners/${p.id}/bewerken`}>Bewerken</Link> : null}>
          <div className="metriekRij">
            <Metriek waarde={euro(p.omzet)} label="Jaaromzet" sub="opgave" />
            <Metriek waarde={getal(p.medewerkers)} label="Medewerkers" />
            <Metriek waarde={getal(p.maxGelijktijdigeProjecten)} label="Max. gelijktijdig" />
            <Metriek waarde={p.typischeProjectomvang ? `${p.typischeProjectomvang.min}–${p.typischeProjectomvang.max}` : "–"} label="Typische omvang (woningen)" sub={stats.omvang ? `gerealiseerd ${stats.omvang.min}–${stats.omvang.max}` : undefined} />
            <Metriek waarde={belasting.aantal} label="Lopende projecten" sub={`${euro(belasting.contractwaarde)} contractwaarde`} />
          </div>
          {p.maxGelijktijdigeProjecten && belasting.aantal >= p.maxGelijktijdigeProjecten ? <Melding soort="waarschuwing">Huidige belasting bereikt het maximum aantal gelijktijdige projecten.</Melding> : null}
        </Kaart>
        <Kaart titel="Bronnen">
          {p.bronnen.length ? (
            <ul className="lijst">
              {p.bronnen.map((b, i) => (
                <li key={i}>
                  <a href={b.url} target="_blank" rel="noreferrer">
                    {b.url}
                  </a>{" "}
                  <span className="muted klein-tekst">
                    {b.soort} · opgehaald {datum(b.opgehaaldOp)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Geen externe bronnen geregistreerd.</p>
          )}
        </Kaart>
      </div>
      <div>
        <Kaart titel="Status (US-07)">
          <p>
            <StatusBadge status={p.status} />
            {p.statusReden ? <span className="muted klein-tekst"> · {p.statusReden}</span> : null}
            {p.geblokkeerdTot ? <span className="muted klein-tekst"> · tot {datum(p.geblokkeerdTot)}</span> : null}
          </p>
          <StatusBeheer partnerId={p.id} huidig={p.status} reden={p.statusReden} geblokkeerdTot={p.geblokkeerdTot} magBewerken={magBewerken} magPromoveren={magPromoveren} />
        </Kaart>
        <Kaart titel="Uit de historie">
          <Definities
            items={[
              ["Projecten", String(stats.aantalProjecten)],
              ["Contractwaarde totaal", euro(stats.totaleContractwaarde)],
              ["Evaluatiescore", stats.evaluatiescore !== null ? `${getal(stats.evaluatiescore, 1)} / 5` : "–"],
              ["Kostenvastheid", stats.kostenvastheid !== null ? `${getal(stats.kostenvastheid, 1)}% afwijking` : "–"],
              ["Planningsbetrouwbaarheid", stats.planningsbetrouwbaarheid !== null ? `${getal(stats.planningsbetrouwbaarheid)}%` : "–"]
            ]}
          />
          <p className="muted klein-tekst">
            <Link href={`/partners/${p.id}?tab=historie`}>Volledige historie</Link>
          </p>
        </Kaart>
        <Kaart titel="Certificaten">
          {p.certificaten.length ? (
            <ul className="lijst">
              {p.certificaten.map((c) => {
                const s = certificaatStatus(c.geldigTot);
                return (
                  <li key={c.id}>
                    <b>{c.type}</b> {c.niveau ? `niveau ${c.niveau}` : ""} <Badge kleur={s.kleur}>{s.label}</Badge>
                    <br />
                    <small className="muted">geldig tot {datum(c.geldigTot)}</small>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="muted">Geen certificaten.</p>
          )}
        </Kaart>
      </div>
    </div>
  );
}

function Capaciteit({ p, db, magBewerken }: { p: Partner; db: Database; magBewerken: boolean }) {
  const belasting = huidigeBelasting(p, db);
  return (
    <div className="raster raster-zij">
      <Kaart titel="Beschikbaarheid per periode">
        <CapaciteitBeheer partnerId={p.id} beschikbaarheid={p.beschikbaarheid} magBewerken={magBewerken} />
      </Kaart>
      <Kaart titel="Capaciteitsindicatoren" acties={magBewerken ? <Link href={`/partners/${p.id}/bewerken`}>Bewerken</Link> : null}>
        <Definities
          items={[
            ["Jaaromzet", euro(p.omzet)],
            ["Medewerkers", getal(p.medewerkers)],
            ["Max. gelijktijdige projecten", getal(p.maxGelijktijdigeProjecten)],
            ["Typische projectomvang", p.typischeProjectomvang ? `${p.typischeProjectomvang.min}–${p.typischeProjectomvang.max} woningen` : "–"],
            ["Lopende projecten nu", `${belasting.aantal} (${euro(belasting.contractwaarde)})`]
          ]}
        />
      </Kaart>
    </div>
  );
}

function Historie({ p, db, afgeleid }: { p: Partner; db: Database; afgeleid: ReturnType<typeof leidFactorenAf> }) {
  const stats = afgeleid.statistieken;
  const engagements = db.engagements.filter((e) => e.partnerId === p.id).sort((a, b) => b.periode.van.localeCompare(a.periode.van));
  const evaluaties = db.evaluaties.filter((e) => e.partnerId === p.id).sort((a, b) => b.datum.localeCompare(a.datum));
  const projectNaam = (id: string) => db.projecten.find((x) => x.id === id)?.naam ?? id;
  const collegas = db.partners
    .filter((o) => o.id !== p.id)
    .map((o) => ({ o, s: samenwerking(db, p.id, o.id) }))
    .filter(({ s }) => s.aantal > 0)
    .sort((a, b) => b.s.aantal - a.s.aantal);

  return (
    <>
      <div className="metriekRij">
        <Metriek waarde={stats.aantalProjecten} label="Projecten" sub={`${stats.aantalEvaluaties} evaluatie(s)`} />
        <Metriek waarde={euro(stats.totaleContractwaarde)} label="Totale contractwaarde" />
        <Metriek waarde={stats.kostenvastheid !== null ? `${getal(stats.kostenvastheid, 1)}%` : "–"} label="Kostenvastheid (afwijking)" sub="bron projecthistorie" />
        <Metriek waarde={stats.planningsbetrouwbaarheid !== null ? `${getal(stats.planningsbetrouwbaarheid)}%` : "–"} label="Planningsbetrouwbaarheid" sub="opgeleverd binnen 30 dagen" />
        <Metriek waarde={stats.evaluatiescore !== null ? getal(stats.evaluatiescore, 1) : "–"} label="Evaluatiescore (1–5)" sub="recent weegt zwaarder" />
        <Metriek waarde={stats.blauwhoedAandeel !== null ? `${stats.blauwhoedAandeel}%` : "–"} label="Aandeel Blauwhoed in omzet" />
      </div>
      <Kaart titel="Projecten (US-18, US-20)">
        {engagements.length ? (
          <div className="tabelWrap">
            <table className="tabel">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Rol</th>
                  <th>Periode</th>
                  <th className="num">Contractwaarde</th>
                  <th className="num">Raming</th>
                  <th className="num">Eindafrekening</th>
                  <th className="num">Afwijking</th>
                  <th>Oplevering gepland</th>
                  <th>Oplevering werkelijk</th>
                  <th>Bouwsysteem</th>
                  <th>Bron</th>
                </tr>
              </thead>
              <tbody>
                {engagements.map((e) => {
                  const afwijking = e.ramingBijStart && e.eindafrekening ? ((e.eindafrekening - e.ramingBijStart) / e.ramingBijStart) * 100 : null;
                  const teLaat = e.geplandeOplevering && e.werkelijkeOplevering ? (new Date(e.werkelijkeOplevering).getTime() - new Date(e.geplandeOplevering).getTime()) / 86_400_000 > 30 : false;
                  return (
                    <tr key={e.id}>
                      <td>
                        <Link href={`/projecten/${e.projectId}`}>{projectNaam(e.projectId)}</Link>
                      </td>
                      <td>{ROL_LABEL[e.rol]}</td>
                      <td>
                        {datum(e.periode.van)} – {e.periode.tot ? datum(e.periode.tot) : "lopend"}
                      </td>
                      <td className="num">{euro(e.contractwaarde)}</td>
                      <td className="num">{euro(e.ramingBijStart)}</td>
                      <td className="num">{euro(e.eindafrekening)}</td>
                      <td className="num">{afwijking !== null ? <span className={Math.abs(afwijking) > 5 ? "tekst-rood" : "tekst-groen"}>{afwijking > 0 ? "+" : ""}{getal(afwijking, 1)}%</span> : "–"}</td>
                      <td>{datum(e.geplandeOplevering)}</td>
                      <td className={teLaat ? "tekst-rood" : ""}>{datum(e.werkelijkeOplevering)}</td>
                      <td>{e.bouwsysteem ?? "–"}</td>
                      <td className="muted klein-tekst">{e.bron}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Leeg titel="Nog geen projecthistorie" tekst="Leg engagements vast bij een project of importeer ze via CSV." />
        )}
      </Kaart>
      <div className="raster raster-2">
        <Kaart titel="Evaluaties">
          {evaluaties.length ? (
            <div className="tabelWrap">
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Datum</th>
                    <th className="num">Kwal.</th>
                    <th className="num">Plan.</th>
                    <th className="num">Budget</th>
                    <th className="num">Samenw.</th>
                    <th className="num">Duurz.</th>
                    <th>Toelichting</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluaties.map((ev) => (
                    <tr key={ev.id}>
                      <td>
                        <Link href={`/projecten/${ev.projectId}/evaluaties`}>{projectNaam(ev.projectId)}</Link>
                      </td>
                      <td>
                        {datum(ev.datum)}
                        <br />
                        <small className="muted">{ev.door}</small>
                      </td>
                      <td className="num">{ev.kwaliteit}</td>
                      <td className="num">{ev.planning}</td>
                      <td className="num">{ev.budget}</td>
                      <td className="num">{ev.samenwerking}</td>
                      <td className="num">{ev.duurzaamheid}</td>
                      <td className="klein-tekst">{ev.toelichting}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">Nog geen evaluaties.</p>
          )}
        </Kaart>
        <Kaart titel="Werkte samen met (US-22)">
          {collegas.length ? (
            <div className="tabelWrap">
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Partner</th>
                    <th className="num">Gezamenlijke projecten</th>
                    <th className="num">Gem. samenwerking</th>
                  </tr>
                </thead>
                <tbody>
                  {collegas.map(({ o, s }) => (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/partners/${o.id}`}>{o.naam}</Link> <span className="muted klein-tekst">{o.rollen.map((r) => ROL_LABEL[r]).join(", ")}</span>
                      </td>
                      <td className="num">{s.aantal}</td>
                      <td className="num">{s.gemiddeldeSamenwerking !== null ? `${getal(s.gemiddeldeSamenwerking, 1)} / 5` : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">Geen gezamenlijke projecten met andere partners.</p>
          )}
        </Kaart>
      </div>
    </>
  );
}
