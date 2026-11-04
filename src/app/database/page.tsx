// Databaseverkenner: de hele database met alle (geneste) tabellen vrij doorzoeken. Alleen lezen, alleen voor beheerders
// (bevat ook gebruikers, auditlog en AI-verbruik). Alles via de querystring, zodat elke weergave een deelbare link is.
import Link from "next/link";
import { Kaart, Leeg, Melding, PaginaKop } from "@/components/ui";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { bouwIndex, bouwTabellen, celTekst, GEEN_KOPPELING, GROEPVOLGORDE, sorteer, standaardKolommen, verwijzingenNaar, zoekFilter, type Cel, type IdIndex, type Rij, type Tabel } from "@/lib/domain/databaseverkenner";

const PER_PAGINA = 50;
type Params = { t?: string; q?: string; s?: string; r?: string; p?: string; k?: string; id?: string };
type Invoer = Params & { kol?: string | string[] };

/** Link naar dezelfde pagina met aangepaste parameters (lege waarden vallen weg). */
function link(huidig: Params, wijzig: Partial<Params>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...huidig, ...wijzig })) if (v) sp.set(k, v);
  const qs = sp.toString();
  return `/database${qs ? `?${qs}` : ""}`;
}

export default async function DatabasePagina({ searchParams }: { searchParams: Promise<Invoer> }) {
  // Aangevinkte kolommen (kol=a&kol=b) worden één parameter k=a,b, zodat links de keuze meenemen.
  const { kol, ...rest } = await searchParams;
  const sp: Params = kol !== undefined ? { ...rest, k: [kol].flat().join(",") || undefined } : rest;
  const [db, gebruiker] = await Promise.all([getDb(), huidigeGebruiker()]);
  if (!heeftRecht(gebruiker.rol, "beheer")) {
    return (
      <>
        <PaginaKop eyebrow="Database" titel="Database" />
        <Melding soort="fout">De databaseverkenner is alleen beschikbaar voor beheerders.</Melding>
      </>
    );
  }
  const tabellen = bouwTabellen(db);
  const index = bouwIndex(tabellen);
  const tabel = tabellen.find((t) => t.naam === sp.t);
  const q = (sp.q ?? "").trim();
  const filter = q ? zoekFilter(q) : null;
  const totaalRijen = tabellen.reduce((n, t) => n + t.rijen.length, 0);

  return (
    <>
      <PaginaKop
        eyebrow="Database"
        titel="Database verkennen"
        intro={`Alle ${tabellen.length} tabellen (${totaalRijen.toLocaleString("nl-NL")} records) vrij doorzoeken. Alleen lezen. Blauwe waarden zijn koppelingen naar een record in een andere tabel.`}
      />
      <div className="dbIndeling">
        <aside className="dbZijbalk" aria-label="Tabellen">
          {GROEPVOLGORDE.map((groep) => {
            const inGroep = tabellen.filter((t) => t.groep === groep);
            if (!inGroep.length) return null;
            return (
              <div key={groep} className="dbGroep">
                <h3>{groep}</h3>
                <ul>
                  {inGroep.map((t) => {
                    const aantal = filter ? t.rijen.filter((r) => filter(r, index)).length : t.rijen.length;
                    return (
                      <li key={t.naam} className={t.ouder ? "dbKind" : ""}>
                        <Link href={link({ q: sp.q }, { t: t.naam })} className={t.naam === tabel?.naam ? "active" : ""}>
                          <span>{t.ouder ? `› ${t.naam.split(".").slice(1).join(" › ")}` : t.label}</span>
                          <b className={filter && !aantal ? "nul" : ""}>{aantal}</b>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </aside>
        <div className="dbHoofd">
          <form method="get" action="/database" className="dbZoek">
            {tabel ? <input type="hidden" name="t" value={tabel.naam} /> : null}
            {sp.k ? <input type="hidden" name="k" value={sp.k} /> : null}
            <input name="q" defaultValue={q} placeholder={tabel ? `Zoek in ${tabel.label}… bijv. status:bekend rol:architect -geblokkeerd` : "Zoek in de hele database… bijv. Aalberts, mpg of status:open"} aria-label="Zoekopdracht" />
            <button type="submit" className="knop">Zoeken</button>
            {q ? (
              <Link href={link({ t: sp.t, k: sp.k }, {})} className="knop knop-tekst">
                Wissen
              </Link>
            ) : null}
          </form>
          <p className="muted klein-tekst dbUitleg">
            Woorden moeten allemaal voorkomen · <code>kolom:tekst</code> zoekt in één kolom · <code>-woord</code> sluit uit · <code>&quot;twee woorden&quot;</code> als geheel. Koppelingen zijn ook op naam te vinden.
          </p>
          {sp.id && tabel ? (
            <Detail tabel={tabel} id={sp.id} tabellen={tabellen} index={index} sp={sp} />
          ) : tabel ? (
            <TabelWeergave tabel={tabel} sp={sp} index={index} filter={filter} />
          ) : q ? (
            <Overal tabellen={tabellen} index={index} filter={filter!} sp={sp} />
          ) : (
            <Kaart titel="Kies een tabel of zoek in alles">
              <p className="muted">
                Links staan alle tabellen. Geneste gegevens, zoals de factorwaarden en certificaten van een partner, zijn eigen tabellen (met <b>›</b>) met een kolom <i>ouder</i> die naar het bovenliggende record wijst. Klik op een record voor alle velden en voor alles wat ernaar verwijst.
              </p>
            </Kaart>
          )}
        </div>
      </div>
    </>
  );
}

/** Een cel: koppelingen als link (met label), JSON ingekort, lijsten als komma-lijst. */
function CelWaarde({ kolom, waarde, index, volledig }: { kolom: string; waarde: Cel | undefined; index: IdIndex; volledig?: boolean }) {
  if (waarde === null || waarde === undefined || waarde === "") return <span className="leegWaarde">–</span>;
  const koppel = (v: string) => {
    const doel = GEEN_KOPPELING.has(kolom) ? undefined : index.get(v);
    return doel ? (
      <Link key={v} href={link({ q: undefined }, { t: doel.tabel, id: v, k: undefined })} title={`${doel.tabel} · ${v}`}>
        {doel.label}
      </Link>
    ) : (
      v
    );
  };
  if (typeof waarde === "string") return <>{koppel(waarde)}</>;
  if (Array.isArray(waarde))
    return (
      <>
        {waarde.map((v, i) => (
          <span key={`${v}-${i}`}>
            {i ? ", " : ""}
            {koppel(v)}
          </span>
        ))}
      </>
    );
  if (typeof waarde === "object") {
    const tekst = waarde.json;
    return volledig ? <pre className="dbJson">{JSON.stringify(JSON.parse(tekst), null, 2)}</pre> : <code className="dbJsonKort" title={tekst.slice(0, 600)}>{tekst.length > 90 ? `${tekst.slice(0, 87)}…` : tekst}</code>;
  }
  if (typeof waarde === "boolean") return <>{waarde ? "ja" : "nee"}</>;
  return <>{String(waarde)}</>;
}

function TabelWeergave({ tabel, sp, index, filter }: { tabel: Tabel; sp: Params; index: IdIndex; filter: ((r: Rij, i?: IdIndex) => boolean) | null }) {
  const kolommen = sp.k ? sp.k.split(",").filter((k) => tabel.kolommen.includes(k)) : standaardKolommen(tabel);
  const gefilterd = filter ? tabel.rijen.filter((r) => filter(r, index)) : tabel.rijen;
  const rijen = sorteer(gefilterd, sp.s, sp.r === "1");
  const paginas = Math.max(1, Math.ceil(rijen.length / PER_PAGINA));
  const pagina = Math.min(paginas, Math.max(1, Number(sp.p) || 1));
  const zichtbaar = rijen.slice((pagina - 1) * PER_PAGINA, pagina * PER_PAGINA);
  const csv = `/api/database?${new URLSearchParams({ t: tabel.naam, q: sp.q ?? "", k: kolommen.join(","), s: sp.s ?? "", r: sp.r ?? "" }).toString()}`;
  return (
    <Kaart
      titel={
        <>
          {tabel.label} <span className="muted dbAantal">{gefilterd.length === tabel.rijen.length ? `${tabel.rijen.length} records` : `${gefilterd.length} van ${tabel.rijen.length} records`}</span>
        </>
      }
      acties={
        <a href={csv} className="knop knop-secundair klein">
          CSV van deze weergave
        </a>
      }
    >
      {tabel.ouder ? (
        <p className="muted klein-tekst">
          Kindtabel van <Link href={link({}, { t: tabel.ouder })}>{tabel.ouder}</Link>: de kolom <i>ouder</i> wijst naar het bovenliggende record.
        </p>
      ) : null}
      <details className="uitklap dbKolomKeuze">
        <summary>
          Kolommen ({kolommen.length} van {tabel.kolommen.length})
        </summary>
        <form method="get" action="/database">
          <input type="hidden" name="t" value={tabel.naam} />
          {sp.q ? <input type="hidden" name="q" value={sp.q} /> : null}
          <div className="dbKolommen">
            {tabel.kolommen.map((k) => (
              <label key={k}>
                <input type="checkbox" name="kol" value={k} defaultChecked={kolommen.includes(k)} /> {k}
              </label>
            ))}
          </div>
          <button type="submit" className="knop klein">
            Toepassen
          </button>{" "}
          <Link href={link({ t: tabel.naam, q: sp.q }, {})} className="knop knop-tekst klein">
            Standaard
          </Link>
        </form>
      </details>
      {zichtbaar.length === 0 ? (
        <Leeg titel="Geen records" tekst={sp.q ? "Niets gevonden met deze zoekopdracht in deze tabel." : "Deze tabel is leeg."} />
      ) : (
        <div className="tabelWrap">
          <table className="tabel dbTabel">
            <thead>
              <tr>
                <th>Record</th>
                {kolommen.map((k) => {
                  const actief = sp.s === k;
                  return (
                    <th key={k}>
                      <Link href={link(sp, { s: k, r: actief && sp.r !== "1" ? "1" : undefined, p: undefined, id: undefined })} className="dbSorteer">
                        {k}
                        {actief ? (sp.r === "1" ? " ↓" : " ↑") : ""}
                      </Link>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {zichtbaar.map((r) => (
                <tr key={r._id}>
                  <td>
                    <Link href={link({ q: sp.q, k: sp.k }, { t: tabel.naam, id: r._id })}>{r._label}</Link>
                  </td>
                  {kolommen.map((k) => (
                    <td key={k} className={typeof r.velden[k] === "number" ? "num" : ""}>
                      <CelWaarde kolom={k} waarde={r.velden[k]} index={index} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {paginas > 1 ? (
        <div className="paginering">
          {pagina > 1 ? <Link href={link(sp, { p: String(pagina - 1) })}>← Vorige</Link> : null}
          <span className="muted">
            Pagina {pagina} van {paginas}
          </span>
          {pagina < paginas ? <Link href={link(sp, { p: String(pagina + 1) })}>Volgende →</Link> : null}
        </div>
      ) : null}
    </Kaart>
  );
}

function Overal({ tabellen, index, filter, sp }: { tabellen: Tabel[]; index: IdIndex; filter: (r: Rij, i?: IdIndex) => boolean; sp: Params }) {
  const treffers = tabellen.map((t) => ({ t, rijen: t.rijen.filter((r) => filter(r, index)) })).filter((x) => x.rijen.length);
  if (!treffers.length) return <Leeg titel="Niets gevonden" tekst="Geen enkel record in de database past bij deze zoekopdracht." />;
  return (
    <>
      <p className="muted">
        {treffers.reduce((n, x) => n + x.rijen.length, 0)} records in {treffers.length} tabellen.
      </p>
      {treffers.map(({ t, rijen }) => (
        <Kaart
          key={t.naam}
          titel={
            <>
              {t.label} <span className="muted dbAantal">{rijen.length}</span>
            </>
          }
          acties={<Link href={link({ q: sp.q }, { t: t.naam })}>Alle {rijen.length} in de tabel →</Link>}
        >
          <ul className="dbTreffers">
            {rijen.slice(0, 6).map((r) => (
              <li key={r._id}>
                <Link href={link({ q: sp.q }, { t: t.naam, id: r._id })}>{r._label}</Link>
                <span className="muted klein-tekst"> {treffertekst(r, sp.q ?? "", index)}</span>
              </li>
            ))}
          </ul>
        </Kaart>
      ))}
    </>
  );
}

/** Waar de zoekterm voorkomt: 'kolom: …tekst…' van de eerste passende kolom (koppelingen op naam). */
function treffertekst(r: Rij, q: string, index: IdIndex) {
  const woord = q.replace(/^-?[^\s:]+:/, "").split(/\s+/)[0]?.replace(/"/g, "").toLowerCase();
  if (!woord) return "";
  const velden = Object.entries(r.velden).sort(([a], [b]) => Number(a === "id" || a === "ouder") - Number(b === "id" || b === "ouder"));
  for (const [k, v] of velden) {
    const t = typeof v === "string" && !GEEN_KOPPELING.has(k) && index.has(v) ? index.get(v)!.label : celTekst(v);
    const i = t.toLowerCase().indexOf(woord);
    if (i >= 0) return `· ${k}: ${i > 30 ? "…" : ""}${t.slice(Math.max(0, i - 30), i + 60)}${t.length > i + 60 ? "…" : ""}`;
  }
  return "";
}

function Detail({ tabel, id, tabellen, index, sp }: { tabel: Tabel; id: string; tabellen: Tabel[]; index: IdIndex; sp: Params }) {
  const rij = tabel.rijen.find((r) => r._id === id);
  if (!rij) return <Melding soort="waarschuwing">Record {id} bestaat niet (meer) in {tabel.label}.</Melding>;
  const inkomend = verwijzingenNaar(id, tabellen);
  return (
    <>
      <p>
        <Link href={link({ q: sp.q, k: sp.k }, { t: tabel.naam })}>← {tabel.label}</Link>
      </p>
      <Kaart
        titel={
          <>
            {rij._label} <span className="muted dbAantal">{tabel.label}</span>
          </>
        }
      >
        <div className="tabelWrap">
          <table className="tabel dbVelden">
            <thead>
              <tr>
                <th>Veld</th>
                <th>Waarde</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>id</td>
                <td>
                  <code>{rij._id}</code>
                </td>
              </tr>
              {tabel.kolommen.filter((k) => k !== "id").map((k) => {
                const v = rij.velden[k];
                const kind = tabellen.find((t) => t.naam === `${tabel.naam}.${k}`);
                return (
                  <tr key={k}>
                    <td>{k}</td>
                    <td>
                      {kind ? (
                        <Link href={link({}, { t: kind.naam, q: `ouder:"${rij._id}"` })}>
                          {celTekst(v)} {k} bekijken →
                        </Link>
                      ) : (
                        <CelWaarde kolom={k} waarde={v} index={index} volledig />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Kaart>
      <Kaart titel={`Verwijst hiernaar (${inkomend.reduce((n, x) => n + x.rijen.length, 0)})`}>
        {inkomend.length === 0 ? (
          <p className="muted">Geen andere records verwijzen naar dit record.</p>
        ) : (
          inkomend.map(({ tabel: t, rijen }) => (
            <div key={t.naam} className="dbInkomend">
              <h3>
                {t.label} <span className="muted dbAantal">{rijen.length}</span>
              </h3>
              <ul className="dbTreffers">
                {rijen.slice(0, 25).map(({ rij: r, kolom }) => (
                  <li key={r._id}>
                    <Link href={link({}, { t: t.naam, id: r._id })}>{r._label}</Link> <span className="muted klein-tekst">via {kolom}</span>
                  </li>
                ))}
              </ul>
              {rijen.length > 25 ? (
                <Link href={link({}, { t: t.naam, q: `"${id}"` })} className="klein-tekst">
                  Alle {rijen.length} tonen →
                </Link>
              ) : null}
            </div>
          ))
        )}
      </Kaart>
    </>
  );
}
