// US-39: partneroverzicht met filters op elke combinatie van zoektekst, rol, status, certificaat, regio en kenmerk.
import Link from "next/link";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { leidFactorenAf, effectieveFactoren } from "@/lib/domain/derive";
import { afstandKm, geocode, PLAATSEN } from "@/lib/domain/geo";
import { ROLLEN, type CertificaatType, type Partner, type PartnerStatus, type Rol } from "@/lib/domain/types";
import { getal, hoofdletter, ROL_LABEL, STATUS_LABEL } from "@/lib/format";
import { getDb } from "@/lib/store";
import { Badge, Kaart, Knop, Leeg, PaginaKop, StatusBadge } from "@/components/ui";
import { CERTIFICAAT_TYPEN, certificaatStatus } from "@/components/partners/certificaten";

const STATUSSEN: PartnerStatus[] = ["bekend", "preferred", "prospect", "afgewezen", "geblokkeerd"];

export default async function PartnersPagina({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [db, gebruiker] = await Promise.all([getDb(), huidigeGebruiker()]);
  const magBewerken = heeftRecht(gebruiker.rol, "bewerken");
  const nu = new Date();

  const q = (sp.q ?? "").trim().toLowerCase();
  const rol = ROLLEN.includes(sp.rol as Rol) ? (sp.rol as Rol) : undefined;
  const status = STATUSSEN.includes(sp.status as PartnerStatus) ? (sp.status as PartnerStatus) : undefined;
  const cert = CERTIFICAAT_TYPEN.includes(sp.cert as CertificaatType) ? (sp.cert as CertificaatType) : undefined;
  const plaats = (sp.plaats ?? "").trim();
  const straal = sp.straal ? Number(sp.straal) : undefined;
  const centrum = plaats ? geocode(plaats) : null;
  const factorId = sp.factor && db.factoren.some((f) => f.id === sp.factor) ? sp.factor : undefined;
  const minimum = sp.min !== undefined && sp.min !== "" ? Number(sp.min) : undefined;
  const factor = factorId ? db.factoren.find((f) => f.id === factorId) : undefined;

  const rijen = db.partners
    .map((p) => {
      const afgeleid = leidFactorenAf(p, db, nu);
      const eff = factorId ? effectieveFactoren(p, db, nu).filter((f) => f.factorId === factorId) : [];
      const afstand = centrum ? afstandKm(centrum, p.locatie) : null;
      return { p, afgeleid, eff, afstand };
    })
    .filter(({ p, eff, afstand }) => {
      if (q) {
        const tekst = [p.naam, p.vestigingsplaats, p.kvk, p.omschrijving, ...p.tags].join(" ").toLowerCase();
        if (!tekst.includes(q)) return false;
      }
      if (rol && !p.rollen.includes(rol)) return false;
      if (status && p.status !== status) return false;
      if (cert && !p.certificaten.some((c) => c.type === cert && new Date(c.geldigTot) >= nu)) return false;
      if (centrum && afstand !== null && straal && afstand > straal) return false;
      if (factorId) {
        if (!eff.length) return false;
        if (minimum !== undefined && !eff.some((f) => typeof f.waarde === "number" && f.waarde >= minimum)) return false;
      }
      return true;
    })
    .sort((a, b) => a.p.naam.localeCompare(b.p.naam));

  const kenmerkFactoren = db.factoren.filter((f) => f.actief && (f.schaal.soort === "niveau" || f.schaal.soort === "getal" || f.schaal.soort === "percentage"));
  const gefilterd = !!(q || rol || status || cert || plaats || factorId);

  return (
    <>
      <PaginaKop
        eyebrow="Partners"
        titel="Partneroverzicht"
        intro={`${rijen.length} van ${db.partners.length} partners. Filter op rol, regio, kenmerk, certificaat en status; combineer vrij.`}
        acties={magBewerken ? <Knop href="/partners/nieuw">Nieuwe partner</Knop> : <span className="muted klein-tekst">Uw rol mag geen partners toevoegen.</span>}
      />
      <Kaart titel="Filters" acties={gefilterd ? <Link href="/partners">Wis filters</Link> : null}>
        <form method="get" className="formulier partnerFilters">
          <div className="rij">
            <label>
              Zoeken
              <input name="q" defaultValue={sp.q ?? ""} placeholder="Naam, plaats, KVK, tag, omschrijving" />
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
            <label>
              Geldig certificaat
              <select name="cert" defaultValue={cert ?? ""}>
                <option value="">Geen eis</option>
                {CERTIFICAAT_TYPEN.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="rij">
            <label>
              Regio: plaats
              <select name="plaats" defaultValue={plaats.toLowerCase()}>
                <option value="">Heel Nederland</option>
                {Object.keys(PLAATSEN).map((pl) => (
                  <option key={pl} value={pl}>
                    {hoofdletter(pl)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Straal (km)
              <input type="number" name="straal" min={1} max={500} defaultValue={sp.straal ?? "50"} />
            </label>
            <label>
              Kenmerk (factor)
              <select name="factor" defaultValue={factorId ?? ""}>
                <option value="">Geen eis</option>
                {kenmerkFactoren.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.code} {f.naam}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Minimumwaarde
              <input type="number" name="min" step="any" defaultValue={sp.min ?? ""} placeholder="bijv. 3" />
            </label>
          </div>
          <div className="formulierActies">
            <button type="submit" className="knop klein">
              Filteren
            </button>
            {plaats && !centrum ? <span className="muted klein-tekst">Plaats onbekend in de geocoder; regiofilter genegeerd.</span> : null}
            {factor ? (
              <span className="muted klein-tekst">
                Kenmerk {factor.naam}: {factor.omschrijving}
              </span>
            ) : null}
          </div>
        </form>
      </Kaart>
      <Kaart>
        {rijen.length === 0 ? (
          <Leeg titel="Geen partners gevonden" tekst="Pas de filters aan of voeg een partner toe." />
        ) : (
          <div className="tabelWrap">
            <table className="tabel partnerTabel">
              <thead>
                <tr>
                  <th>Partner</th>
                  <th>Status</th>
                  <th>Rollen</th>
                  <th>Plaats</th>
                  {centrum ? <th className="num">Afstand</th> : null}
                  <th className="num">Medewerkers</th>
                  <th>Certificaten</th>
                  {factor ? <th className="num">{factor.naam}</th> : null}
                  <th className="num">Evaluatie</th>
                  <th className="num">Projecten</th>
                </tr>
              </thead>
              <tbody>
                {rijen.map(({ p, afgeleid, eff, afstand }) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/partners/${p.id}`}>
                        <b>{p.naam}</b>
                      </Link>
                      <br />
                      <small className="muted">KVK {p.kvk}</small>
                    </td>
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
                    <td>{p.rollen.map((r) => ROL_LABEL[r]).join(", ")}</td>
                    <td>{p.vestigingsplaats}</td>
                    {centrum ? <td className="num">{afstand !== null ? `${afstand} km` : "–"}</td> : null}
                    <td className="num">{getal(p.medewerkers)}</td>
                    <td>
                      <CertificaatChips partner={p} />
                    </td>
                    {factor ? <td className="num">{eff.map((f) => `${f.optieId ? `${f.optieId}: ` : ""}${String(f.waarde)}`).join("; ") || "–"}</td> : null}
                    <td className="num">{afgeleid.statistieken.evaluatiescore !== null ? getal(afgeleid.statistieken.evaluatiescore, 1) : <span className="muted">–</span>}</td>
                    <td className="num">{afgeleid.statistieken.aantalProjecten}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Kaart>
    </>
  );
}

function CertificaatChips({ partner }: { partner: Partner }) {
  if (!partner.certificaten.length) return <span className="muted">–</span>;
  return (
    <span className="certChips">
      {partner.certificaten.map((c) => {
        const s = certificaatStatus(c.geldigTot);
        return (
          <Badge key={c.id} kleur={s.kleur === "groen" ? "grijs" : s.kleur} titel={`${c.type} ${c.nummer}: ${s.label} (${c.geldigTot})`}>
            {c.type}
          </Badge>
        );
      })}
    </span>
  );
}
