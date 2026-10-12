// US-02/US-03: datakwaliteit per partnertype — vullingsgraad van de verplichte velden (per type en per veld, met doorklikken
// naar de partners waar iets ontbreekt), signalen voor ontbrekende, verouderde en onbetrouwbare waarden (te filteren op soort,
// partnertype en veld) en de verouderingstermijn per veld.
import Link from "next/link";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { DATASIGNAAL_LABEL, dataSignalen, filterSignalen, STANDAARD_BETROUWBAARHEID_DREMPEL, vullingPerRol, type DataSignaalSoort } from "@/lib/domain/datakwaliteit";
import { goudstandaardVoor, veldGevuld, veldnaam } from "@/lib/domain/goudstandaard";
import { STANDAARD_DEKKING_DREMPEL } from "@/lib/domain/herweging";
import { zichtbaar } from "@/lib/domain/zichtbaarheid";
import { BASISVELD_LABEL, ROLLEN, type BasisVeld, type Rol } from "@/lib/domain/types";
import { datum, ROL_LABEL } from "@/lib/format";
import { getDb } from "@/lib/store";
import { Badge, BetrouwbaarheidBadge, GeenBronBadge, Kaart, Leeg, Melding, Metriek, PaginaKop } from "@/components/ui";
import GerichteVerrijking from "@/components/datakwaliteit/GerichteVerrijking";
import TermijnenEditor from "@/components/datakwaliteit/TermijnenEditor";

export const maxDuration = 60;

const TABS = [
  { id: "vulling", label: "Vullingsgraad" },
  { id: "signalen", label: "Signalen" },
  { id: "ontbrekend", label: "Ontbrekende waarden" },
  { id: "termijnen", label: "Verouderingstermijnen" }
] as const;
type Tab = (typeof TABS)[number]["id"];
const SOORTEN: DataSignaalSoort[] = ["ontbreekt", "verouderd", "onbetrouwbaar"];
const MAX_RIJEN = 300;

function url(params: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v && p.set(k, v));
  return `/datakwaliteit?${p.toString()}`;
}

function pctKleur(p: number | null) {
  return p === null ? "grijs" : p >= 80 ? "groen" : p >= 50 ? "geel" : "rood";
}

export default async function DatakwaliteitPagina({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [db, gebruiker] = await Promise.all([getDb(), huidigeGebruiker()]);
  const tab: Tab = TABS.some((t) => t.id === sp.tab) ? (sp.tab as Tab) : "vulling";
  const rol = ROLLEN.includes(sp.rol as Rol) ? (sp.rol as Rol) : undefined;
  const soort = SOORTEN.includes(sp.soort as DataSignaalSoort) ? (sp.soort as DataSignaalSoort) : undefined;
  const veld = sp.veld && /^(basis|factor):/.test(sp.veld) ? sp.veld : undefined;
  const magBewerken = heeftRecht(gebruiker.rol, "bewerken");
  const partners = db.partners.filter(zichtbaar);
  const vulling = vullingPerRol(db, partners);
  const alleSignalen = dataSignalen(db, partners);
  const gekozenVulling = rol ? vulling.find((v) => v.rol === rol) : undefined;

  return (
    <>
      <PaginaKop
        eyebrow="Datakwaliteit"
        titel="Datakwaliteit per partnertype"
        intro="Hoeveel van de verplichte velden per partnertype gevuld zijn, welke waarden ontbreken, verouderd of te weinig betrouwbaar zijn, en waar verrijken het meest oplevert. Welke velden verplicht zijn, stelt de beheerder per type in bij de goudstandaard."
        acties={
          <>
            <Link href="/beheer/goudstandaard" className="knop knop-secundair">Goudstandaard per type</Link>
            <Link href="/verrijking" className="knop knop-secundair">Verrijking</Link>
          </>
        }
      />
      <div className="metriekRij">
        {SOORTEN.map((s) => (
          <Metriek key={s} waarde={alleSignalen.filter((x) => x.soort === s).length} label={DATASIGNAAL_LABEL[s]} sub={<Link href={url({ tab: "signalen", soort: s })}>Bekijk</Link>} />
        ))}
        <Metriek waarde={partners.length} label="Partners (zonder concepten en archief)" />
      </div>
      <nav className="tabs" aria-label="Onderdeel">
        {TABS.map((t) => (
          <Link key={t.id} href={url({ tab: t.id, rol })} className={t.id === tab ? "active" : ""} scroll={false}>
            {t.label}
            {t.id === "signalen" ? <span>{alleSignalen.length}</span> : null}
          </Link>
        ))}
      </nav>

      {tab === "vulling" ? (
        <div className="raster raster-zij">
          <Kaart titel="Vullingsgraad verplichte velden per partnertype">
            {vulling.length ? (
              <div className="tabelWrap">
                <table className="tabel">
                  <thead>
                    <tr>
                      <th>Partnertype</th>
                      <th className="num">Partners</th>
                      <th>Verplicht gevuld</th>
                      <th className="num">Gewenst</th>
                      <th className="num">Onvolledig</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vulling.map((v) => (
                      <tr key={v.rol} className={v.rol === rol ? "geselecteerd" : ""}>
                        <td>
                          <Link href={url({ tab: "vulling", rol: v.rol })} scroll={false}>
                            <b>{ROL_LABEL[v.rol]}</b>
                          </Link>
                        </td>
                        <td className="num">{v.partners}</td>
                        <td>
                          <div className="voortgang" aria-label={`${v.verplichtPct ?? 0}% gevuld`}>
                            <span style={{ width: `${v.verplichtPct ?? 0}%` }} />
                          </div>
                          <Badge kleur={pctKleur(v.verplichtPct)}>{v.verplichtPct ?? "–"}%</Badge>
                        </td>
                        <td className="num">{v.gewenstPct ?? "–"}%</td>
                        <td className="num">
                          <Link href={url({ tab: "signalen", soort: "ontbreekt", rol: v.rol })}>{v.onvolledig}</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Leeg titel="Nog geen partners" />
            )}
            <p className="muted klein-tekst">Vullingsgraad = gevulde verplichte velden gedeeld door (partners × verplichte velden) van dat type. Een afgewezen waarde telt als leeg. Klik op een type voor de stand per veld.</p>
          </Kaart>
          <Kaart titel={gekozenVulling ? `Per veld: ${ROL_LABEL[gekozenVulling.rol].toLowerCase()} (${gekozenVulling.partners})` : "Per veld"}>
            {gekozenVulling ? (
              <div className="tabelWrap">
                <table className="tabel">
                  <thead>
                    <tr>
                      <th>Veld</th>
                      <th>Niveau</th>
                      <th>Gevuld</th>
                      <th className="num">Ontbreekt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gekozenVulling.velden.map((v) => (
                      <tr key={v.sleutel}>
                        <td>{v.naam}</td>
                        <td>
                          <Badge kleur={v.niveau === "verplicht" ? "blauw" : "grijs"}>{v.niveau}</Badge>
                        </td>
                        <td>
                          <Badge kleur={pctKleur(v.pct)}>{v.pct}%</Badge> <span className="muted klein-tekst">{v.gevuld}/{v.totaal}</span>
                        </td>
                        <td className="num">{v.totaal - v.gevuld ? <Link href={url({ tab: "ontbrekend", rol: gekozenVulling.rol, veld: v.sleutel })}>{v.totaal - v.gevuld} partners</Link> : "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">Kies links een partnertype.</p>
            )}
          </Kaart>
        </div>
      ) : null}

      {tab === "signalen" ? <Signalen db={db} signalen={filterSignalen(alleSignalen, { soort, rol, veld })} totaal={alleSignalen.length} soort={soort} rol={rol} veld={veld} veldOpties={Array.from(new Map(alleSignalen.map((s) => [s.sleutel, s.veld.split(":")[0]])).entries()).sort((a, b) => a[1].localeCompare(b[1]))} /> : null}

      {tab === "ontbrekend" ? <Ontbrekend db={db} rol={rol} veld={veld} magBewerken={magBewerken} /> : null}

      {tab === "termijnen" ? (
        <Kaart titel="Verouderingstermijn per veld en drempels">
          <TermijnenEditor
            magBeheren={heeftRecht(gebruiker.rol, "beheer")}
            betrouwbaarheidDrempel={db.instellingen.betrouwbaarheidDrempel ?? STANDAARD_BETROUWBAARHEID_DREMPEL}
            dekkingDrempel={db.instellingen.dekkingDrempel ?? STANDAARD_DEKKING_DREMPEL}
            velden={[
              ...(Object.keys(BASISVELD_LABEL) as BasisVeld[]).map((v) => ({ sleutel: `basis:${v}`, naam: BASISVELD_LABEL[v], groep: "Basisvelden", maanden: db.instellingen.basisveldVerval?.[v] })),
              ...db.factoren.filter((f) => f.actief && !f.afgeleid).map((f) => ({ sleutel: `factor:${f.id}`, naam: `${f.code} ${f.naam}`, groep: f.categorie, maanden: f.vervalMaanden }))
            ]}
          />
        </Kaart>
      ) : null}
    </>
  );
}

function Signalen({ signalen, totaal, soort, rol, veld, veldOpties }: { db: Awaited<ReturnType<typeof getDb>>; signalen: ReturnType<typeof dataSignalen>; totaal: number; soort?: DataSignaalSoort; rol?: Rol; veld?: string; veldOpties: Array<[string, string]> }) {
  return (
    <Kaart titel={`Signalen (${signalen.length}${signalen.length !== totaal ? ` van ${totaal}` : ""})`}>
      <form method="get" className="formulierActies">
        <input type="hidden" name="tab" value="signalen" />
        <label>
          Soort
          <select name="soort" defaultValue={soort ?? ""}>
            <option value="">Alle soorten</option>
            {SOORTEN.map((s) => (
              <option key={s} value={s}>
                {DATASIGNAAL_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Partnertype
          <select name="rol" defaultValue={rol ?? ""}>
            <option value="">Alle types</option>
            {ROLLEN.map((r) => (
              <option key={r} value={r}>
                {ROL_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Veld
          <select name="veld" defaultValue={veld ?? ""}>
            <option value="">Alle velden</option>
            {veldOpties.map(([s, n]) => (
              <option key={s} value={s}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="knop klein">Filteren</button>
        {soort || rol || veld ? <Link href="/datakwaliteit?tab=signalen">Wissen</Link> : null}
      </form>
      {signalen.length ? (
        <div className="tabelWrap">
          <table className="tabel">
            <thead>
              <tr>
                <th>Soort</th>
                <th>Partner</th>
                <th>Veld</th>
                <th>Waarde</th>
                <th>Toelichting</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {signalen.slice(0, MAX_RIJEN).map((s, i) => (
                <tr key={`${s.partnerId}-${s.sleutel}-${s.soort}-${i}`}>
                  <td>
                    <Badge kleur={s.soort === "ontbreekt" ? "rood" : s.soort === "verouderd" ? "geel" : "mint"}>{DATASIGNAAL_LABEL[s.soort]}</Badge>
                  </td>
                  <td>
                    <Link href={`/partners/${s.partnerId}`}>{s.partnerNaam}</Link>
                    <div className="muted klein-tekst">{s.rollen.map((r) => ROL_LABEL[r]).join(", ")}</div>
                  </td>
                  <td>{s.veld}</td>
                  <td className="klein-tekst">
                    {s.waarde ?? <span className="muted">leeg</span>} {s.betrouwbaarheid !== undefined ? <BetrouwbaarheidBadge waarde={s.betrouwbaarheid} /> : null}
                    {s.datum ? <div className="muted">{datum(s.datum)}</div> : null}
                  </td>
                  <td className="klein-tekst">{s.detail}</td>
                  <td>
                    <Link href={`/partners/${s.partnerId}?tab=${s.sleutel.startsWith("factor:") ? "factoren" : "profiel"}`} className="knop knop-tekst klein">
                      {s.soort === "ontbreekt" ? "Aanvullen" : "Controleren"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {signalen.length > MAX_RIJEN ? <p className="muted klein-tekst">De eerste {MAX_RIJEN} van {signalen.length} signalen; verfijn met de filters.</p> : null}
        </div>
      ) : (
        <Leeg titel="Geen signalen" tekst="Voor deze selectie zijn alle verplichte velden gevuld en is niets verouderd of te weinig betrouwbaar." />
      )}
    </Kaart>
  );
}

function Ontbrekend({ db, rol, veld, magBewerken }: { db: Awaited<ReturnType<typeof getDb>>; rol?: Rol; veld?: string; magBewerken: boolean }) {
  if (!rol || !veld) {
    return (
      <Kaart titel="Ontbrekende waarden">
        <Melding soort="info">Kies op het tabblad Vullingsgraad een partnertype en klik bij een veld op het aantal partners, of open deze lijst vanuit de dekking van een matchrun.</Melding>
      </Kaart>
    );
  }
  const verplicht = goudstandaardVoor(db, rol).velden.find((v) => v.sleutel === veld)?.niveau;
  const zonder = db.partners.filter((p) => zichtbaar(p) && p.rollen.includes(rol) && !veldGevuld(p, veld)).sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
  return (
    <Kaart titel={`${ROL_LABEL[rol]}s zonder ${veldnaam(veld, db.factoren).toLowerCase()} (${zonder.length})`} acties={verplicht ? <Badge kleur={verplicht === "verplicht" ? "blauw" : "grijs"}>{verplicht} in de goudstandaard</Badge> : <Badge>matchcriterium</Badge>}>
      <GerichteVerrijking ids={zonder.slice(0, 200).map((p) => p.id)} magBewerken={magBewerken} externeBronnen={db.instellingen.externeBronnenToegestaan} />
      {zonder.length ? (
        <div className="tabelWrap">
          <table className="tabel">
            <thead>
              <tr>
                <th>Partner</th>
                <th>Plaats</th>
                <th>Laatst verrijkt</th>
                <th>Markering</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {zonder.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/partners/${p.id}`}>{p.naam}</Link>
                  </td>
                  <td>{p.vestigingsplaats || <span className="muted">–</span>}</td>
                  <td>{datum(p.laatstVerrijktOp)}</td>
                  <td>
                    <GeenBronBadge markering={p.geenBron?.[veld]} />
                  </td>
                  <td>
                    <Link href={`/partners/${p.id}?tab=${veld.startsWith("factor:") ? "factoren" : "profiel"}`} className="knop knop-tekst klein">
                      Aanvullen
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Leeg titel="Niets ontbreekt" tekst="Alle partners van dit type hebben een waarde voor dit veld." />
      )}
    </Kaart>
  );
}
