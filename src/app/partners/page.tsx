// US-39: partneroverzicht met filters op elke combinatie van zoektekst, rol, status, certificaat, regio en kenmerk.
import Link from "next/link";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { leidFactorenAf, effectieveFactoren } from "@/lib/domain/derive";
import { afstandKm, geocode, PLAATSEN } from "@/lib/domain/geo";
import { ROLLEN, type CertificaatType, type Factor, type Partner, type PartnerFactor, type PartnerStatus, type Rol } from "@/lib/domain/types";
import { getal, hoofdletter, ROL_LABEL, STATUS_LABEL } from "@/lib/format";
import { getDb } from "@/lib/store";
import { Badge, Kaart, Knop, Leeg, Melding, PaginaKop, StatusBadge } from "@/components/ui";
import { CERTIFICAAT_TYPEN, certificaatStatus } from "@/components/partners/certificaten";
import KenmerkFilters from "@/components/partners/KenmerkFilters";
import PartnerImport from "@/components/partners/PartnerImport";
import { parseKenmerken, type KenmerkEis } from "@/components/partners/kenmerken";
import { leidEisenAf } from "@/lib/domain/projectfactoren";
import { goudstandaardVolledigheid } from "@/lib/domain/goudstandaard";
import { heeftWaardeStatus } from "@/lib/domain/datakwaliteit";
import { zichtbaar } from "@/lib/domain/zichtbaarheid";


// US-54: concepten zijn uitgesloten van filteren; ze staan in de vrijgavewachtrij (/vrijgave).
const STATUSSEN: PartnerStatus[] = ["bekend", "preferred", "prospect", "afgewezen", "geblokkeerd", "gearchiveerd"];

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
  const waardeStatus = (["gevalideerd", "voorgesteld", "verouderd"] as const).find((x) => x === sp.waardestatus);
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
      const alle = effectieveFactoren(p, db, nu);
      const eff = alle.filter((f) => kenmerken.some((k) => k.factorId === f.factorId && (!k.optieId || f.optieId === k.optieId)));
      const perKenmerk = kenmerken.map((k, i) => alle.some((f) => f.factorId === k.factorId && voldoetAan(f, k, kenmerkFactorenActief[i])));
      const voldoet = kmode === "een" ? perKenmerk.some(Boolean) : perKenmerk.every(Boolean);
      const afstand = centrum ? afstandKm(centrum, p.locatie) : null;
      return { p, afgeleid, eff, alle, afstand, voldoet, perKenmerk };
    })
    .filter(({ p, afstand, voldoet }) => {
      if (q) {
        const tekst = [p.naam, p.vestigingsplaats, p.kvk, p.omschrijving, ...p.tags].join(" ").toLowerCase();
        if (!tekst.includes(q)) return false;
      }
      if (rol && !p.rollen.includes(rol)) return false;
      if (status && p.status !== status) return false;
      if (p.status === "concept") return false; // concepten: alleen in de vrijgavewachtrij
      if (!status && p.status === "gearchiveerd") return false; // alleen via het statusfilter
      if (cert && !p.certificaten.some((c) => c.type === cert && new Date(c.geldigTot) >= nu)) return false;
      if (centrum && afstand !== null && straal && afstand > straal) return false;
      if (kenmerken.length && !voldoet) return false;
      // US-66: doorklikfilters vanaf het dashboard.
      if (sp.gs === "onvolledig" && !goudstandaardVolledigheid(p, db).verplichtOpen.length) return false;
      if (waardeStatus && !heeftWaardeStatus(p, waardeStatus, db.factoren, nu)) return false;
      if (sp.geenbron === "1" && !Object.keys(p.geenBron ?? {}).length) return false;
      return true;
    })
    .sort((a, b) => a.p.naam.localeCompare(b.p.naam));

  const telling = kenmerken.map((k, i) => db.partners.filter((p) => zichtbaar(p) && effectieveFactoren(p, db, nu).some((f) => f.factorId === k.factorId && voldoetAan(f, k, kenmerkFactorenActief[i]))).length);
  const kenmerkFactoren = db.factoren.filter((f) => f.actief && (f.schaal.soort === "niveau" || f.schaal.soort === "getal" || f.schaal.soort === "percentage"));
  const gefilterd = !!(q || rol || status || cert || plaats || factorId || project || sp.gs || waardeStatus || sp.geenbron);
  // B5: kolomkeuze via de querystring (checkboxes in het filterformulier).
  const KOLOMMEN: Array<{ id: string; label: string }> = [
    { id: "status", label: "Status" },
    { id: "rollen", label: "Rollen" },
    { id: "plaats", label: "Plaats" },
    { id: "medewerkers", label: "Medewerkers" },
    { id: "kenmerken", label: "Kernkenmerken" },
    { id: "certificaten", label: "Certificaten" },
    { id: "evaluatie", label: "Evaluatie" },
    { id: "projecten", label: "Projecten" },
    { id: "website", label: "Website" }
  ];
  const kolomKeuze = typeof sp.kolommen === "string" && sp.kolommen ? new Set(sp.kolommen.split(",")) : new Set(KOLOMMEN.map((k) => k.id).filter((id) => id !== "website"));
  const kol = (id: string) => kolomKeuze.has(id);

  return (
    <div className="partnerPagina">
      <PaginaKop
        eyebrow="Partners"
        titel="Partneroverzicht"
        intro={`${rijen.length} van ${db.partners.filter((p) => p.status !== "concept").length} partners. Filter op rol, regio, kenmerk, certificaat en status; combineer vrij.`}
        acties={
          magBewerken ? (
            <>
              <PartnerImport magBewerken={magBewerken} />
              <Knop href="/api/export/partners?formaat=xlsx" variant="secundair">Export (Excel)</Knop>
              <Knop href="/api/export/partners" variant="secundair">Export (CSV)</Knop>
              <Knop href="/api/export/partners?formaat=pdf" variant="secundair">Export (PDF)</Knop>
              <Knop href="/partners/nieuw">Nieuwe partner</Knop>
            </>
          ) : (
            <><Knop href="/api/export/partners?formaat=xlsx" variant="secundair">Export (Excel)</Knop>
              <Knop href="/api/export/partners" variant="secundair">Export (CSV)</Knop><Knop href="/api/export/partners?formaat=pdf" variant="secundair">Export (PDF)</Knop></>
          )
        }
      />
      {db.partners.some((p) => p.status === "concept") ? (
        <Melding soort="info">
          {db.partners.filter((p) => p.status === "concept").length} concept(en) (AI-voorstellen) wachten op vrijgave door een beheerder en tellen nog niet mee.{" "}
          <Link href="/vrijgave">Naar de vrijgavewachtrij</Link>
        </Melding>
      ) : null}
      {sp.verwijderd === "1" ? <Melding soort="succes">De partner is definitief verwijderd (AVG). De auditlog bewaart alleen dát er verwijderd is.</Melding> : null}
      {project && afgeleid ? (
        <Melding soort="info">
          Kenmerken afgeleid uit project <Link href={`/projecten/${project.id}`}><b>{project.naam}</b></Link>: {afgeleid.kenmerken.map((k) => k.label).join(", ")}. Pas ze hieronder aan of{" "}
          <Link href={`/projecten/${project.id}/match`}>voer de volledige matching uit</Link> voor een gerangschikt advies met uitleg.
        </Melding>
      ) : null}
      <Kaart titel="Filters" acties={gefilterd ? <Link href="/partners">Wis filters</Link> : null}>
        {sp.gs || waardeStatus || sp.geenbron ? (
          <Melding soort="info">
            Actief datakwaliteitsfilter: {[sp.gs === "onvolledig" ? "verplichte Blauwdruk-Data-velden onvolledig" : "", waardeStatus ? `heeft waarden met status ${waardeStatus}` : "", sp.geenbron === "1" ? "velden zonder betrouwbare bron" : ""].filter(Boolean).join(", ")}.
          </Melding>
        ) : null}
        <form method="get" className="formulier partnerFilters">
          {sp.gs ? <input type="hidden" name="gs" value={sp.gs} /> : null}
          {waardeStatus ? <input type="hidden" name="waardestatus" value={waardeStatus} /> : null}
          {sp.geenbron ? <input type="hidden" name="geenbron" value={sp.geenbron} /> : null}
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
          <details open={kenmerken.length > 0}>
            <summary className="muted klein-tekst" style={{ cursor: "pointer" }}>Kenmerken (meerdere tegelijk){kenmerken.length ? ` — ${kenmerken.length} actief` : ""}</summary>
            <div className="veld" style={{ marginTop: 6 }}>
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
          </details>
          <details>
            <summary className="muted klein-tekst" style={{ cursor: "pointer" }}>Kolommen kiezen ({kolomKeuze.size} van {KOLOMMEN.length})</summary>
            <div className="vinkjes" style={{ marginTop: 6 }}>
              {KOLOMMEN.map((k) => (
                <label key={k.id}>
                  <input type="checkbox" name="kolommen" value={k.id} defaultChecked={kol(k.id)} /> {k.label}
                </label>
              ))}
            </div>
          </details>
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
                  <th className="kolPartner">Partner</th>
                  {kol("kenmerken") ? <th className="kolKenmerken">Kernkenmerken</th> : null}
                  {kol("certificaten") ? <th className="kolCert">Certificaten</th> : null}
                  {centrum ? <th className="num kolGetal">Afstand</th> : null}
                  {kol("medewerkers") ? <th className="num kolGetal">Medewerkers</th> : null}
                  {kol("evaluatie") ? <th className="num kolGetal">Evaluatie</th> : null}
                  {kol("projecten") ? <th className="num kolGetal">Projecten</th> : null}
                  {kol("website") ? <th className="kolWebsite">Website</th> : null}
                </tr>
              </thead>
              <tbody>
                {rijen.map(({ p, afgeleid, alle, afstand }) => {
                  // Rollen, plaats en KVK (als die kolommen gekozen zijn) als subregel onder de naam; status als badge erachter.
                  const subregel = [kol("rollen") ? p.rollen.map((r) => ROL_LABEL[r]).join(", ") : "", kol("plaats") ? p.vestigingsplaats : "", p.kvk ? `KVK ${p.kvk}` : ""].filter(Boolean);
                  return (
                    <tr key={p.id}>
                      <td className="kolPartner">
                        <div className="partnerNaamRegel">
                          <Link href={`/partners/${p.id}`}>{p.naam}</Link>
                          {kol("status") ? <StatusBadge status={p.status} /> : null}
                        </div>
                        <small className="partnerSubregel">
                          {subregel.join(" · ")}
                          {subregel.length ? " · " : ""}
                          <Link href={`/partners/${p.id}?tab=brondata`}>alle data</Link>
                        </small>
                      </td>
                      {kol("kenmerken") ? (
                        <td className="kolKenmerken" data-label="Kernkenmerken">
                          <KernKenmerken factoren={db.factoren} alle={alle} />
                        </td>
                      ) : null}
                      {kol("certificaten") ? (
                        <td className="kolCert" data-label="Certificaten">
                          <CertificaatChips partner={p} />
                        </td>
                      ) : null}
                      {centrum ? <td className="num" data-label="Afstand">{afstand !== null ? `${afstand} km` : <span className="leegWaarde">–</span>}</td> : null}
                      {kol("medewerkers") ? <td className="num" data-label="Medewerkers">{p.medewerkers ? getal(p.medewerkers) : <span className="leegWaarde">–</span>}</td> : null}
                      {kol("evaluatie") ? <td className="num" data-label="Evaluatie">{afgeleid.statistieken.evaluatiescore !== null ? getal(afgeleid.statistieken.evaluatiescore, 1) : <span className="leegWaarde">–</span>}</td> : null}
                      {kol("projecten") ? <td className="num" data-label="Projecten">{afgeleid.statistieken.aantalProjecten || <span className="leegWaarde">–</span>}</td> : null}
                      {kol("website") ? <td className="kolWebsite" data-label="Website">{p.website ? <a href={p.website} target="_blank" rel="noreferrer">{p.website.replace(/^https?:\/\/(www\.)?/, "")}</a> : <span className="leegWaarde">–</span>}</td> : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Kaart>
    </div>
  );
}

// Belangrijke factoren in het overzicht: compact per partner, met bron in de title.
const KERNFACTOREN: Array<{ id: string; label: string }> = [
  { id: "bouwsysteem", label: "Bouwsysteem" },
  { id: "projecttype", label: "Projecttype" },
  { id: "projectomvang", label: "Omvang" },
  { id: "mpg", label: "MPG" },
  { id: "prefabricage", label: "Prefabricage" },
  { id: "conceptbouw", label: "Conceptbouw" },
  { id: "demontabel", label: "Demontabel" }
];

/** Alle kernkenmerken van een partner in één cel: per waarde een chip met label (meerkeuzefactoren tonen de optie). */
function KernKenmerken({ factoren, alle }: { factoren: Factor[]; alle: PartnerFactor[] }) {
  const chips = KERNFACTOREN.flatMap((k) => {
    const f = factoren.find((x) => x.id === k.id);
    if (!f) return [];
    return alle
      .filter((x) => x.factorId === k.id && !(typeof x.waarde === "number" && x.waarde === 0))
      .map((w) => {
        const optie = w.optieId ? f.opties?.find((o) => o.id === w.optieId)?.label ?? w.optieId : "";
        const tekst = typeof w.waarde === "object" && !Array.isArray(w.waarde) ? `${w.waarde.min}–${w.waarde.max}` : String(w.waarde);
        return { sleutel: `${w.factorId}-${w.optieId ?? ""}`, label: optie || k.label, tekst, titel: `${f.naam}${optie ? ` · ${optie}` : ""}: ${tekst} · bron ${w.bron} (${Math.round(w.betrouwbaarheid * 100)}%)${w.afgeleid ? " · afgeleid" : ""}` };
      });
  });
  if (!chips.length) return <span className="leegWaarde">Nog geen kenmerken</span>;
  return (
    <span className="kernFactor">
      {chips.map((c) => (
        <span key={c.sleutel} className="chip" title={c.titel}>
          {c.label} <b>{c.tekst}</b>
        </span>
      ))}
    </span>
  );
}

function CertificaatChips({ partner }: { partner: Partner }) {
  if (!partner.certificaten.length) return <span className="leegWaarde">–</span>;
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
