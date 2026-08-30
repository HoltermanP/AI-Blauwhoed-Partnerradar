"use client";
// US-04: client-editor voor factoren. Alle mutaties via server actions; fouten via Melding; daarna router.refresh().
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { archiveerFactor, heractiveerFactor, slaFactorOp, slaFactorOptieOp, voegFactorenSamen } from "@/lib/actions";
import type { ActieResultaat } from "@/lib/actions";
import type { Factor, FactorCategorie, FactorSchaal, FactorType, Rol } from "@/lib/domain/types";
import { ROLLEN } from "@/lib/domain/types";
import { datum, ROL_LABEL } from "@/lib/format";
import { Badge, Kaart, Melding } from "@/components/ui";

export type FactorGebruik = { partners: number; projecteisen: number; profielen: number };

const TYPE_KLEUR: Record<FactorType, "rood" | "blauw" | "mint"> = { hard: "rood", gewogen: "blauw", semantisch: "mint" };
const SCHAAL_SOORTEN: Array<FactorSchaal["soort"]> = ["niveau", "getal", "percentage", "bereik", "keuze", "boolean", "tekst"];

function schaalTekst(s: FactorSchaal) {
  switch (s.soort) {
    case "niveau":
      return "niveau 0–5";
    case "getal":
      return `getal (${s.eenheid})${s.lagerIsBeter ? ", lager is beter" : ""}`;
    case "percentage":
      return `percentage${s.lagerIsBeter ? ", lager is beter" : ""}`;
    case "bereik":
      return `bereik (${s.eenheid})`;
    case "keuze":
      return `keuze${s.meervoudig ? " (meervoudig)" : ""}`;
    case "boolean":
      return "ja/nee";
    case "tekst":
      return "tekst";
  }
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

type NieuweFactor = { id: string; code: string; naam: string; omschrijving: string; categorie: FactorCategorie; type: FactorType; schaalSoort: FactorSchaal["soort"]; eenheid: string; lagerIsBeter: boolean; meervoudig: boolean; rollen: Rol[] };

function bouwSchaal(n: Pick<NieuweFactor, "schaalSoort" | "eenheid" | "lagerIsBeter" | "meervoudig">): FactorSchaal {
  switch (n.schaalSoort) {
    case "niveau":
      return { soort: "niveau", min: 0, max: 5 };
    case "getal":
      return { soort: "getal", eenheid: n.eenheid || "eenheid", lagerIsBeter: n.lagerIsBeter || undefined };
    case "percentage":
      return { soort: "percentage", lagerIsBeter: n.lagerIsBeter || undefined };
    case "bereik":
      return { soort: "bereik", eenheid: n.eenheid || "eenheid" };
    case "keuze":
      return { soort: "keuze", meervoudig: n.meervoudig };
    case "boolean":
      return { soort: "boolean" };
    case "tekst":
      return { soort: "tekst" };
  }
}

export function FactorenBeheer({ factoren, categorieen, gebruik, magBeheren }: { factoren: Factor[]; categorieen: FactorCategorie[]; gebruik: Record<string, FactorGebruik>; magBeheren: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [bewerkId, setBewerkId] = useState<string | null>(null);
  const [toonNieuw, setToonNieuw] = useState(false);
  const [toonGearchiveerd, setToonGearchiveerd] = useState(false);

  const voer = (melding: string, fn: () => Promise<ActieResultaat<unknown>>, na?: () => void) => {
    setFout(null);
    setSucces(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setFout(r.fout);
      else {
        setSucces(melding);
        na?.();
        router.refresh();
      }
    });
  };

  const zichtbaar = factoren.filter((f) => toonGearchiveerd || f.actief);
  const actief = factoren.filter((f) => f.actief);

  return (
    <>
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      {succes ? <Melding soort="succes">{succes}</Melding> : null}

      <div className="formulierActies" style={{ marginBottom: 16 }}>
        {magBeheren ? (
          <button type="button" className="knop klein" onClick={() => setToonNieuw((v) => !v)}>
            {toonNieuw ? "Sluiten" : "Nieuwe factor"}
          </button>
        ) : null}
        <label className="vinkjes" style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 14 }}>
          <input type="checkbox" checked={toonGearchiveerd} onChange={(e) => setToonGearchiveerd(e.target.checked)} /> Gearchiveerde factoren tonen ({factoren.length - actief.length})
        </label>
      </div>

      {toonNieuw && magBeheren ? <NieuweFactorFormulier categorieen={categorieen} bezig={bezig} onOpslaan={(f) => voer(`Factor ${f.naam} aangemaakt.`, () => slaFactorOp(f), () => setToonNieuw(false))} /> : null}

      {magBeheren ? <Samenvoegen factoren={actief} bezig={bezig} onSamenvoegen={(bron, doel) => voer("Factoren samengevoegd: koppelingen hernoemd, niets verwijderd.", () => voegFactorenSamen(bron, doel))} /> : null}

      {categorieen.map((cat) => {
        const lijst = zichtbaar.filter((f) => f.categorie === cat);
        if (lijst.length === 0) return null;
        return (
          <Kaart key={cat} titel={cat}>
            <div className="tabelWrap">
              <table className="tabel factorTabel">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Naam</th>
                    <th>Type</th>
                    <th>Schaal</th>
                    <th>Rollen</th>
                    <th>Opties</th>
                    <th>Gebruik</th>
                    <th>Status</th>
                    <th className="num">Versie</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lijst.map((f) => {
                    const g = gebruik[f.id] ?? { partners: 0, projecteisen: 0, profielen: 0 };
                    return (
                      <FactorRij
                        key={f.id}
                        factor={f}
                        gebruik={g}
                        magBeheren={magBeheren}
                        bezig={bezig}
                        bewerkt={bewerkId === f.id}
                        onBewerk={() => setBewerkId(bewerkId === f.id ? null : f.id)}
                        onOpslaan={(nf) => voer(`Factor ${nf.naam} opgeslagen.`, () => slaFactorOp(nf), () => setBewerkId(null))}
                        onOptie={(optie) => voer(`Optie ${optie.label} opgeslagen.`, () => slaFactorOptieOp(f.id, optie))}
                        onArchiveer={() => {
                          if (confirm(`Factor ${f.naam} archiveren? Historie blijft behouden; nieuwe matchruns gebruiken hem niet meer.`)) voer(`Factor ${f.naam} gearchiveerd.`, () => archiveerFactor(f.id));
                        }}
                        onHeractiveer={() => voer(`Factor ${f.naam} geheractiveerd.`, () => heractiveerFactor(f.id))}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Kaart>
        );
      })}
    </>
  );
}

function FactorRij({ factor: f, gebruik: g, magBeheren, bezig, bewerkt, onBewerk, onOpslaan, onOptie, onArchiveer, onHeractiveer }: { factor: Factor; gebruik: FactorGebruik; magBeheren: boolean; bezig: boolean; bewerkt: boolean; onBewerk: () => void; onOpslaan: (f: Factor) => void; onOptie: (o: NonNullable<Factor["opties"]>[number]) => void; onArchiveer: () => void; onHeractiveer: () => void }) {
  const [naam, setNaam] = useState(f.naam);
  const [omschrijving, setOmschrijving] = useState(f.omschrijving);
  const [type, setType] = useState<FactorType>(f.type);
  const [rollen, setRollen] = useState<Rol[]>(f.rollen);
  const [nieuweOptie, setNieuweOptie] = useState("");
  const [hernoem, setHernoem] = useState<{ id: string; label: string } | null>(null);
  const magOpties = f.schaal.soort === "niveau" || f.schaal.soort === "keuze";

  return (
    <>
      <tr className={f.actief ? "" : "gearchiveerd"}>
        <td><b>{f.code}</b></td>
        <td>
          {f.naam}
          {f.afgeleid ? <> <Badge kleur="mint" titel="Afgeleid uit projecthistorie/evaluaties (US-19/20)">afgeleid</Badge></> : null}
          <div className="muted klein-tekst">{f.omschrijving}</div>
          {f.samengevoegdIn ? <div className="muted klein-tekst">Samengevoegd in: {f.samengevoegdIn}</div> : null}
        </td>
        <td><Badge kleur={TYPE_KLEUR[f.type]}>{f.type}</Badge></td>
        <td className="klein-tekst">{schaalTekst(f.schaal)}</td>
        <td className="klein-tekst">{f.rollen.length === 0 ? <span className="muted">alle</span> : f.rollen.map((r) => ROL_LABEL[r]).join(", ")}</td>
        <td>
          {f.opties?.map((o) => (
            <span key={o.id} className="chip" style={o.actief ? undefined : { textDecoration: "line-through", opacity: 0.6 }} title={o.id}>
              {o.label}
            </span>
          ))}
        </td>
        <td className="klein-tekst" title="Partners met waarde / projecteisen / gewichtsprofielen">
          {g.partners} partners · {g.projecteisen} projecten · {g.profielen} profielen
        </td>
        <td>{f.actief ? <Badge kleur="groen">actief</Badge> : <Badge kleur="grijs" titel={f.gearchiveerdOp ? `Gearchiveerd op ${datum(f.gearchiveerdOp)}` : undefined}>gearchiveerd</Badge>}</td>
        <td className="num">{f.versie}</td>
        <td>
          {magBeheren ? (
            <div className="formulierActies" style={{ flexWrap: "nowrap" }}>
              <button type="button" className="knop knop-tekst klein" onClick={onBewerk} disabled={bezig}>
                {bewerkt ? "Sluiten" : "Bewerken"}
              </button>
              {f.actief ? (
                <button type="button" className="knop knop-tekst klein" onClick={onArchiveer} disabled={bezig}>Archiveren</button>
              ) : f.samengevoegdIn ? null : (
                <button type="button" className="knop knop-tekst klein" onClick={onHeractiveer} disabled={bezig}>Heractiveren</button>
              )}
            </div>
          ) : null}
        </td>
      </tr>
      {bewerkt && magBeheren ? (
        <tr>
          <td colSpan={10} className="bewerkRij">
            <div className="formulier">
              <div className="rij">
                <label>
                  Naam
                  <input value={naam} onChange={(e) => setNaam(e.target.value)} />
                </label>
                <label>
                  Type
                  <select value={type} onChange={(e) => setType(e.target.value as FactorType)}>
                    <option value="hard">hard (uitsluitend filter)</option>
                    <option value="gewogen">gewogen (telt in score)</option>
                    <option value="semantisch">semantisch (tekstvergelijking)</option>
                  </select>
                </label>
              </div>
              <label>
                Omschrijving
                <textarea value={omschrijving} onChange={(e) => setOmschrijving(e.target.value)} />
              </label>
              <div className="vinkjes">
                <span className="muted klein-tekst">Rollen (geen = alle):</span>
                {ROLLEN.map((r) => (
                  <label key={r}>
                    <input type="checkbox" checked={rollen.includes(r)} onChange={(e) => setRollen(e.target.checked ? [...rollen, r] : rollen.filter((x) => x !== r))} /> {ROL_LABEL[r]}
                  </label>
                ))}
              </div>
              <div className="formulierActies">
                <button type="button" className="knop klein" disabled={bezig || !naam.trim()} onClick={() => onOpslaan({ ...f, naam: naam.trim(), omschrijving, type, rollen })}>
                  Factor opslaan (nieuwe versie)
                </button>
                <span className="muted klein-tekst">Schaal en categorie wijzigen niet: dat zou bestaande partnerwaarden onvergelijkbaar maken. Maak dan een nieuwe factor en voeg samen.</span>
              </div>

              {magOpties ? (
                <div>
                  <p className="eyebrow klein">Waardenlijst</p>
                  <ul className="lijst">
                    {(f.opties ?? []).map((o) => (
                      <li key={o.id} className="formulierActies">
                        {hernoem?.id === o.id ? (
                          <>
                            <input value={hernoem.label} onChange={(e) => setHernoem({ id: o.id, label: e.target.value })} style={{ maxWidth: 240 }} />
                            <button type="button" className="knop klein" disabled={bezig || !hernoem.label.trim()} onClick={() => { onOptie({ ...o, label: hernoem.label.trim() }); setHernoem(null); }}>Opslaan</button>
                            <button type="button" className="knop knop-tekst klein" onClick={() => setHernoem(null)}>Annuleren</button>
                          </>
                        ) : (
                          <>
                            <span style={o.actief ? undefined : { textDecoration: "line-through", opacity: 0.6 }}>{o.label}</span>
                            <code className="muted klein-tekst">{o.id}</code>
                            <button type="button" className="knop knop-tekst klein" disabled={bezig} onClick={() => setHernoem({ id: o.id, label: o.label })}>Hernoemen</button>
                            <button type="button" className="knop knop-tekst klein" disabled={bezig} onClick={() => onOptie({ ...o, actief: !o.actief })}>{o.actief ? "Deactiveren" : "Activeren"}</button>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                  <div className="formulierActies">
                    <input placeholder="Nieuwe optie (label)" value={nieuweOptie} onChange={(e) => setNieuweOptie(e.target.value)} style={{ maxWidth: 240 }} />
                    <button
                      type="button"
                      className="knop knop-secundair klein"
                      disabled={bezig || !nieuweOptie.trim() || (f.opties ?? []).some((o) => o.id === slug(nieuweOptie))}
                      onClick={() => { onOptie({ id: slug(nieuweOptie), label: nieuweOptie.trim(), actief: true }); setNieuweOptie(""); }}
                    >
                      Optie toevoegen
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function NieuweFactorFormulier({ categorieen, bezig, onOpslaan }: { categorieen: FactorCategorie[]; bezig: boolean; onOpslaan: (f: Factor) => void }) {
  const [n, setN] = useState<NieuweFactor>({ id: "", code: "", naam: "", omschrijving: "", categorie: categorieen[0], type: "gewogen", schaalSoort: "niveau", eenheid: "", lagerIsBeter: false, meervoudig: false, rollen: [] });
  const zet = <K extends keyof NieuweFactor>(k: K, v: NieuweFactor[K]) => setN((s) => ({ ...s, [k]: v }));
  const id = n.id || slug(n.naam);
  const geldig = !!id && !!n.code.trim() && !!n.naam.trim();
  return (
    <Kaart titel="Nieuwe factor">
      <div className="formulier">
        <div className="rij">
          <label>
            Naam
            <input value={n.naam} onChange={(e) => zet("naam", e.target.value)} placeholder="bijv. Houtskeletbouw-ervaring" />
          </label>
          <label>
            Id (slug)
            <input value={id} onChange={(e) => zet("id", slug(e.target.value))} placeholder="houtskeletbouw" />
          </label>
          <label>
            Code
            <input value={n.code} onChange={(e) => zet("code", e.target.value.toUpperCase())} placeholder="C9" />
          </label>
          <label>
            Categorie
            <select value={n.categorie} onChange={(e) => zet("categorie", e.target.value as FactorCategorie)}>
              {categorieen.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Omschrijving
          <textarea value={n.omschrijving} onChange={(e) => zet("omschrijving", e.target.value)} />
        </label>
        <div className="rij">
          <label>
            Type
            <select value={n.type} onChange={(e) => zet("type", e.target.value as FactorType)}>
              <option value="hard">hard</option>
              <option value="gewogen">gewogen</option>
              <option value="semantisch">semantisch</option>
            </select>
          </label>
          <label>
            Schaal
            <select value={n.schaalSoort} onChange={(e) => zet("schaalSoort", e.target.value as FactorSchaal["soort"])}>
              {SCHAAL_SOORTEN.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          {n.schaalSoort === "getal" || n.schaalSoort === "bereik" ? (
            <label>
              Eenheid
              <input value={n.eenheid} onChange={(e) => zet("eenheid", e.target.value)} placeholder="km, woningen, €" />
            </label>
          ) : null}
        </div>
        <div className="vinkjes">
          {n.schaalSoort === "getal" || n.schaalSoort === "percentage" ? (
            <label>
              <input type="checkbox" checked={n.lagerIsBeter} onChange={(e) => zet("lagerIsBeter", e.target.checked)} /> Lager is beter
            </label>
          ) : null}
          {n.schaalSoort === "keuze" ? (
            <label>
              <input type="checkbox" checked={n.meervoudig} onChange={(e) => zet("meervoudig", e.target.checked)} /> Meervoudige keuze
            </label>
          ) : null}
        </div>
        <div className="vinkjes">
          <span className="muted klein-tekst">Rollen (geen = alle):</span>
          {ROLLEN.map((r) => (
            <label key={r}>
              <input type="checkbox" checked={n.rollen.includes(r)} onChange={(e) => zet("rollen", e.target.checked ? [...n.rollen, r] : n.rollen.filter((x) => x !== r))} /> {ROL_LABEL[r]}
            </label>
          ))}
        </div>
        <div className="formulierActies">
          <button
            type="button"
            className="knop"
            disabled={bezig || !geldig}
            onClick={() =>
              onOpslaan({ id, code: n.code.trim(), naam: n.naam.trim(), omschrijving: n.omschrijving, categorie: n.categorie, type: n.type, schaal: bouwSchaal(n), opties: n.schaalSoort === "niveau" || n.schaalSoort === "keuze" ? [] : undefined, rollen: n.rollen, actief: true, versie: 1 })
            }
          >
            Factor aanmaken
          </button>
          <span className="muted klein-tekst">Opties voegt u daarna toe via Bewerken.</span>
        </div>
      </div>
    </Kaart>
  );
}

function Samenvoegen({ factoren, bezig, onSamenvoegen }: { factoren: Factor[]; bezig: boolean; onSamenvoegen: (bron: string, doel: string) => void }) {
  const [bron, setBron] = useState("");
  const [doel, setDoel] = useState("");
  return (
    <details className="uitklap kaart">
      <summary>Factoren samenvoegen</summary>
      <p className="muted klein-tekst">Samenvoegen hernoemt alle koppelingen (partnerwaarden, projecteisen, gewichtsprofielen) van de bronfactor naar de doelfactor en archiveert de bron. Er wordt niets verwijderd.</p>
      <div className="formulier">
        <div className="rij">
          <label>
            Bron (gaat op in…)
            <select value={bron} onChange={(e) => setBron(e.target.value)}>
              <option value="">— kies —</option>
              {factoren.map((f) => (
                <option key={f.id} value={f.id}>{f.code} {f.naam}</option>
              ))}
            </select>
          </label>
          <label>
            Doel
            <select value={doel} onChange={(e) => setDoel(e.target.value)}>
              <option value="">— kies —</option>
              {factoren.filter((f) => f.id !== bron).map((f) => (
                <option key={f.id} value={f.id}>{f.code} {f.naam}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="formulierActies">
          <button type="button" className="knop knop-secundair klein" disabled={bezig || !bron || !doel || bron === doel} onClick={() => { if (confirm(`${bron} samenvoegen in ${doel}?`)) { onSamenvoegen(bron, doel); setBron(""); setDoel(""); } }}>
            Samenvoegen
          </button>
        </div>
      </div>
    </details>
  );
}
