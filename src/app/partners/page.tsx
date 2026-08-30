// US-39: partneroverzicht met filters op elke combinatie van zoektekst, rol, status, certificaat, regio en kenmerk.
import Link from "next/link";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { leidFactorenAf, effectieveFactoren } from "@/lib/domain/derive";
import { afstandKm, geocode, PLAATSEN } from "@/lib/domain/geo";
import { ROLLEN, type CertificaatType, type Partner, type PartnerStatus, type Rol } from "@/lib/domain/types";
import { getal, hoofdletter, ROL_LABEL, STATUS_LABEL } from "@/lib/format";
import { getDb } from "@/lib/store";
import { Badge, Kaart, Knop, Leeg, Melding, PaginaKop, StatusBadge } from "@/components/ui";
import { CERTIFICAAT_TYPEN, certificaatStatus } from "@/components/partners/certificaten";
import KenmerkFilters from "@/components/partners/KenmerkFilters";
import PartnerImport from "@/components/partners/PartnerImport";
import { parseKenmerken, type KenmerkEis } from "@/components/partners/kenmerken";
import { leidEisenAf } from "@/lib/domain/projectfactoren";


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
  // Kenmerken: meerdere factoren tegelijk (EN). Oud formaat factor+min blijft werken. Met ?project= worden ze uit het project afgeleid.
  const project = sp.project ? db.projecten.find((p) => p.id === sp.project) : undefined;
  const afgeleid = project ? leidEisenAf(project, db.factoren, db.gewichtsprofielen) : null;
  let kenmerken: KenmerkEis[] = parseKenmerken(sp.k);
  if (!kenmerken.length && sp.factor) kenmerken = [{ factorId: sp.factor, optieId: "", min: sp.min ?? "" }];
  if (!kenmerken.length && afgeleid) kenmerken = afgeleid.kenmerken.map((k) => ({ factorId: k.factorId, optieId: k.optieId ?? "", min: k.min !== undefined ? String(k.min) : "" }));
  kenmerken = kenmerken.filter((k) => db.factoren.some((f) => f.id === k.factorId));
  const kenmerkFactorenActief = kenmerken.map((k) => db.factoren.find((f) => f.id === k.factorId)!);
  const kmode: "alle" | "een" = sp.kmode === "een" ? "een" : "alle";
  const factorId = kenmerken.length ? "meerdere" : undefined;
  const factor = kenmerken.length ? { naam: kenmerken.map((k, i) => `${kenmerkFactorenActief[i].naam}${k.optieId ? ` (${k.optieId})` : ""}${k.min ? ` ${"lagerIsBeter" in kenmerkFactorenActief[i].schaal && (kenmerkFactorenActief[i].schaal as { lagerIsBeter?: boolean }).lagerIsBeter ? "≤" : "≥"} ${k.min}` : ""}`).join(" én "), omschrijving: "alle kenmerken moeten kloppen" } : undefined;
  const voldoetAan = (f: { waarde: unknown; optieId?: string }, k: KenmerkEis, fac: (typeof db.factoren)[number]) => {
    if (k.optieId && f.optieId !== k.optieId) return false;
    if (k.min === "") return true;
    if (typeof f.waarde !== "number") return false;
    const lager = "lagerIsBeter" in fac.schaal && (fac.schaal as { lagerIsBeter?: boolean }).lagerIsBeter;
    return lager ? f.waarde <= Number(k.min) : f.waarde >= Number(k.min);
  };

  const rijen = db.partners
    .map((p) => {
      const afgeleid = leidFactorenAf(p, db, nu);
      const alle = kenmerken.length ? effectieveFactoren(p, db, nu) : [];
      const eff = alle.filter((f) => kenmerken.some((k) => k.factorId === f.factorId && (!k.optieId || f.optieId === k.optieId)));
      const perKenmerk = kenmerken.map((k, i) => alle.some((f) => f.factorId === k.factorId && voldoetAan(f, k, kenmerkFactorenActief[i])));
      const voldoet = kmode === "een" ? perKenmerk.some(Boolean) : perKenmerk.every(Boolean);
      const afstand = centrum ? afstandKm(centrum, p.locatie) : null;
      return { p, afgeleid, eff, afstand, voldoet, perKenmerk };
    })
    .filter(({ p, afstand, voldoet }) => {
      if (q) {
        const tekst = [p.naam, p.vestigingsplaats, p.kvk, p.omschrijving, ...p.tags].join(" ").toLowerCase();
        if (!tekst.includes(q)) return false;
      }
      if (rol && !p.rollen.includes(rol)) return false;
      if (status && p.status !== status) return false;
      if (cert && !p.certificaten.some((c) => c.type === cert && new Date(c.geldigTot) >= nu)) return false;
      if (centrum && afstand !== null && straal && afstand > straal) return false;
      if (kenmerken.length && !voldoet) return false;
      return true;
    })
    .sort((a, b) => a.p.naam.localeCompare(b.p.naam));

  const telling = kenmerken.map((k, i) => db.partners.filter((p) => effectieveFactoren(p, db, nu).some((f) => f.factorId === k.factorId && voldoetAan(f, k, kenmerkFactorenActief[i]))).length);
  const kenmerkFactoren = db.factoren.filter((f) => f.actief && (f.schaal.soort === "niveau" || f.schaal.soort === "getal" || f.schaal.soort === "percentage"));
  const gefilterd = !!(q || rol || status || cert || plaats || factorId || project);

  return (
    <>
      <PaginaKop
        eyebrow="Partners"
        titel="Partneroverzicht"
        intro={`${rijen.length} van ${db.partners.length} partners. Filter op rol, regio, kenmerk, certificaat en status; combineer vrij.`}
        acties={
          magBewerken ? (
            <>
              <PartnerImport magBewerken={magBewerken} />
              <Knop href="/partners/nieuw">Nieuwe partner</Knop>
            </>
          ) : (
            <span className="muted klein-tekst">Uw rol mag geen partners toevoegen.</span>
          )
        }
      />
      {project && afgeleid ? (
        <Melding soort="info">
          Kenmerken afgeleid uit project <Link href={`/projecten/${project.id}`}><b>{project.naam}</b></Link>: {afgeleid.kenmerken.map((k) => k.label).join(", ")}. Pas ze hieronder aan of{" "}
          <Link href={`/projecten/${project.id}/match`}>voer de volledige matching uit</Link> voor een gerangschikt advies met uitleg.
        </Melding>
      ) : null}
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
          </div>
          <div className="veld">
            Kenmerken (meerdere tegelijk)
            <KenmerkFilters factoren={kenmerkFactoren} initieel={kenmerken} />
            <label style={{ maxWidth: 320 }}>
              Combinatie
              <select name="kmode" defaultValue={kmode}>
                <option value="alle">Alle kenmerken moeten kloppen (EN)</option>
                <option value="een">Minstens één kenmerk (OF)</option>
              </select>
            </label>
            {kenmerken.length ? (
              <p className="muted klein-tekst" style={{ margin: 0, textTransform: "none", fontWeight: 400 }}>
                Per kenmerk voldoen: {kenmerken.map((k, i) => `${kenmerkFactorenActief[i].naam}${k.optieId ? ` (${k.optieId})` : ""}${k.min ? ` ${k.min}` : ""}: ${telling[i]}`).join(" · ")}
              </p>
            ) : null}
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
                  {factor ? <th className="num">Kenmerken</th> : null}
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
