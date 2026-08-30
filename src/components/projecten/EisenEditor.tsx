"use client";
// US-09: rollen aanvinken en per rol eisen scherpstellen. US-10: gewichten per project (som = 100 per rol), gewichtsprofiel als startpunt.
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { leidProjectEisenAfActie, slaProjectEisenOp } from "@/lib/actions";
import { valideerGewichten } from "@/lib/domain/matching";
import type { Factor, FactorWaarde, Gewichtsprofiel, ProjectRequirement, RequirementFactor, Rol } from "@/lib/domain/types";
import { ROLLEN } from "@/lib/domain/types";
import { ROL_LABEL, waardeTekst } from "@/lib/format";
import { Melding } from "@/components/ui";

const KLEUREN = ["#003e7e", "#2a6fb5", "#5b8fcf", "#8bb0dc", "#0f5a45", "#3c8c6c", "#6bb096", "#7a5a00", "#b08a20", "#555"];

function standaardWaarde(f: Factor): FactorWaarde {
  switch (f.schaal.soort) {
    case "niveau":
      return 3;
    case "getal":
      return f.schaal.min ?? 0;
    case "percentage":
      return 50;
    case "bereik":
      return 0;
    case "keuze":
      return f.schaal.meervoudig ? [] : (f.opties?.find((o) => o.actief)?.id ?? "");
    case "boolean":
      return true;
    case "tekst":
      return "";
  }
}

function GevraagdInvoer({ factor, waarde, onChange }: { factor: Factor; waarde: FactorWaarde; onChange: (v: FactorWaarde) => void }) {
  const s = factor.schaal;
  const num = typeof waarde === "number" ? waarde : Number(waarde) || 0;
  switch (s.soort) {
    case "niveau":
      return (
        <select value={num} onChange={(e) => onChange(Number(e.target.value))} aria-label="Gevraagd niveau">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      );
    case "getal":
      return <input type="number" step="any" min={s.min} max={s.max} value={num} onChange={(e) => onChange(Number(e.target.value))} aria-label={`Gevraagd (${s.eenheid})`} title={s.eenheid} />;
    case "percentage":
      return <input type="number" min={0} max={100} value={num} onChange={(e) => onChange(Number(e.target.value))} aria-label="Gevraagd percentage" />;
    case "bereik":
      return <input type="number" min={0} value={num} onChange={(e) => onChange(Number(e.target.value))} aria-label={`Gevraagde waarde (${s.eenheid})`} title={`Moet binnen bereik van partner vallen (${s.eenheid})`} />;
    case "keuze": {
      const opties = (factor.opties ?? []).filter((o) => o.actief);
      if (s.meervoudig) {
        const lijst = Array.isArray(waarde) ? waarde : [];
        return (
          <div className="vinkjes">
            {opties.map((o) => (
              <label key={o.id}>
                <input type="checkbox" checked={lijst.includes(o.id)} onChange={(e) => onChange(e.target.checked ? [...lijst, o.id] : lijst.filter((x) => x !== o.id))} />
                {o.label}
              </label>
            ))}
          </div>
        );
      }
      return (
        <select value={String(waarde)} onChange={(e) => onChange(e.target.value)} aria-label="Gevraagde optie">
          {opties.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }
    case "boolean":
      return (
        <select value={waarde ? "ja" : "nee"} onChange={(e) => onChange(e.target.value === "ja")} aria-label="Gevraagd">
          <option value="ja">Ja</option>
          <option value="nee">Nee</option>
        </select>
      );
    case "tekst":
      return <input value={String(waarde)} onChange={(e) => onChange(e.target.value)} aria-label="Gevraagde tekst" />;
  }
}

type RolStaat = Record<Rol, ProjectRequirement | undefined>;

export default function EisenEditor({ projectId, eisen, gewichtsprofielId, profielen, factoren, magBewerken }: { projectId: string; eisen: ProjectRequirement[]; gewichtsprofielId?: string; profielen: Gewichtsprofiel[]; factoren: Factor[]; magBewerken: boolean }) {
  const router = useRouter();
  const [profielId, setProfielId] = useState(gewichtsprofielId ?? "");
  const [staat, setStaat] = useState<RolStaat>(() => {
    const s = {} as RolStaat;
    ROLLEN.forEach((r) => (s[r] = eisen.find((e) => e.rol === r)));
    return s;
  });
  const [fout, setFout] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [bezig, start] = useTransition();
  const [afleidToelichting, setAfleidToelichting] = useState<string[]>([]);

  // Factoren vaststellen op basis van projectinformatie; het voorstel landt in de editor en wordt pas opgeslagen na bevestiging.
  function leidAf() {
    setFout(null);
    setSucces(null);
    start(async () => {
      const res = await leidProjectEisenAfActie(projectId);
      if (!res.ok || !res.data) return setFout(res.ok ? "Geen voorstel." : res.fout);
      const v = res.data;
      setProfielId(v.profielId);
      setStaat(() => {
        const n = {} as RolStaat;
        ROLLEN.forEach((r) => (n[r] = v.eisen.find((e) => e.rol === r)));
        return n;
      });
      setAfleidToelichting(v.toelichting);
    });
  }

  const actieveFactoren = useMemo(() => factoren.filter((f) => f.actief && f.type !== "semantisch"), [factoren]);
  const factorenVoorRol = (rol: Rol) => actieveFactoren.filter((f) => !f.rollen.length || f.rollen.includes(rol));
  const factorVan = (id: string) => factoren.find((f) => f.id === id);

  function pasProfielToe(id: string) {
    setProfielId(id);
    const p = profielen.find((x) => x.id === id);
    if (!p) return;
    setStaat((s) => {
      const n = { ...s };
      ROLLEN.forEach((rol) => {
        const lijst = p.perRol[rol];
        if (!lijst) return;
        const bestaand = n[rol];
        n[rol] = { rol, eisen: JSON.parse(JSON.stringify(lijst)) as RequirementFactor[], semantischGewicht: p.semantischGewicht, vrijeOmschrijving: bestaand?.vrijeOmschrijving };
      });
      return n;
    });
  }

  function zetRol(rol: Rol, aan: boolean) {
    setStaat((s) => ({ ...s, [rol]: aan ? { rol, eisen: [], semantischGewicht: 15 } : undefined }));
  }

  function update(rol: Rol, fn: (r: ProjectRequirement) => ProjectRequirement) {
    setStaat((s) => {
      const r = s[rol];
      if (!r) return s;
      return { ...s, [rol]: fn(r) };
    });
  }

  function voegEisToe(rol: Rol) {
    const f = factorenVoorRol(rol)[0];
    if (!f) return;
    update(rol, (r) => ({ ...r, eisen: [...r.eisen, { factorId: f.id, optieId: f.opties?.length && f.schaal.soort === "niveau" ? f.opties[0].id : undefined, gevraagd: standaardWaarde(f), gewicht: 0 }] }));
  }

  function wijzigEis(rol: Rol, idx: number, patch: Partial<RequirementFactor>) {
    update(rol, (r) => ({ ...r, eisen: r.eisen.map((e, i) => (i === idx ? { ...e, ...patch } : e)) }));
  }

  function wisselFactor(rol: Rol, idx: number, factorId: string) {
    const f = factorVan(factorId);
    if (!f) return;
    wijzigEis(rol, idx, { factorId, optieId: f.opties?.length && f.schaal.soort === "niveau" ? f.opties[0].id : undefined, gevraagd: standaardWaarde(f), minimumeis: false });
  }

  function verwijderEis(rol: Rol, idx: number) {
    update(rol, (r) => ({ ...r, eisen: r.eisen.filter((_, i) => i !== idx) }));
  }

  const actieveRollen = ROLLEN.filter((r) => staat[r]);
  const validaties = actieveRollen.map((rol) => ({ rol, ...valideerGewichten(staat[rol]!.eisen, factoren) }));
  const alleGeldig = validaties.every((v) => v.geldig);

  function opslaan() {
    setFout(null);
    setSucces(null);
    const lijst = actieveRollen.map((r) => staat[r]!);
    start(async () => {
      const res = await slaProjectEisenOp(projectId, lijst, profielId || undefined);
      if (!res.ok) return setFout(res.fout);
      setSucces("Eisen opgeslagen.");
      router.refresh();
    });
  }

  return (
    <div className="eisenEditor">
      {!magBewerken ? <Melding soort="info">U heeft geen recht om eisen te bewerken (rol zonder &apos;bewerken&apos;). De editor is alleen-lezen.</Melding> : null}
      <fieldset disabled={!magBewerken} className="formulier" style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="formulierActies">
          <button type="button" className="knop knop-secundair klein" onClick={leidAf} disabled={bezig}>
            Factoren vaststellen uit projectinformatie
          </button>
          <Link href={`/partners?project=${projectId}`} className="knop knop-tekst klein">
            Partners filteren op dit project →
          </Link>
          <span className="muted klein-tekst">Type, omvang, bouwstijl, prijssegment, ambitie en omschrijving worden vertaald naar eisen per rol; u controleert en slaat op.</span>
        </div>
        {afleidToelichting.length ? (
          <Melding soort="info">
            <ul className="lijst klein-tekst" style={{ margin: 0 }}>
              {afleidToelichting.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </Melding>
        ) : null}
        <div className="rij">
          <label>
            Gewichtsprofiel als startpunt (US-10)
            <select value={profielId} onChange={(e) => pasProfielToe(e.target.value)}>
              <option value="">– geen / handmatig –</option>
              {profielen.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.naam} (v{p.versie})
                </option>
              ))}
            </select>
          </label>
          <div className="veld">
            Rollen in dit project (US-09)
            <div className="vinkjes">
              {ROLLEN.map((r) => (
                <label key={r}>
                  <input type="checkbox" checked={Boolean(staat[r])} onChange={(e) => zetRol(r, e.target.checked)} />
                  {ROL_LABEL[r]}
                </label>
              ))}
            </div>
          </div>
        </div>
        {profielId ? <p className="muted klein-tekst">{profielen.find((p) => p.id === profielId)?.omschrijving}</p> : null}

        {actieveRollen.map((rol) => {
          const r = staat[rol]!;
          const v = validaties.find((x) => x.rol === rol)!;
          const gewogen = r.eisen.filter((e) => factorVan(e.factorId)?.type === "gewogen");
          return (
            <section key={rol} className="rolBlok">
              <header className="kaartKop">
                <h3>{ROL_LABEL[rol]}</h3>
                <button type="button" className="knop knop-secundair klein" onClick={() => voegEisToe(rol)}>
                  + Eis toevoegen
                </button>
              </header>
              {r.eisen.length ? (
                <div className="tabelWrap">
                  <table className="tabel eisenTabel">
                    <thead>
                      <tr>
                        <th>Factor</th>
                        <th>Optie</th>
                        <th>Gevraagd</th>
                        <th className="num">Gewicht %</th>
                        <th>Minimumeis</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.eisen.map((e, idx) => {
                        const f = factorVan(e.factorId);
                        const opties = (f?.opties ?? []).filter((o) => o.actief);
                        const heeftOptie = f?.schaal.soort === "niveau" && opties.length > 0;
                        return (
                          <tr key={idx}>
                            <td>
                              <select value={e.factorId} onChange={(ev) => wisselFactor(rol, idx, ev.target.value)} aria-label="Factor">
                                {factorenVoorRol(rol).map((x) => (
                                  <option key={x.id} value={x.id}>
                                    {x.code} {x.naam} ({x.type})
                                  </option>
                                ))}
                                {f && !factorenVoorRol(rol).some((x) => x.id === f.id) ? <option value={f.id}>{f.naam} (niet voor deze rol)</option> : null}
                              </select>
                            </td>
                            <td>
                              {heeftOptie ? (
                                <select value={e.optieId ?? ""} onChange={(ev) => wijzigEis(rol, idx, { optieId: ev.target.value || undefined })} aria-label="Optie">
                                  {opties.map((o) => (
                                    <option key={o.id} value={o.id}>
                                      {o.label}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="muted">–</span>
                              )}
                            </td>
                            <td>{f ? <GevraagdInvoer factor={f} waarde={e.gevraagd} onChange={(w) => wijzigEis(rol, idx, { gevraagd: w })} /> : waardeTekst(e.gevraagd)}</td>
                            <td className="num">
                              {f?.type === "gewogen" ? (
                                <input type="number" min={0} max={100} value={e.gewicht} onChange={(ev) => wijzigEis(rol, idx, { gewicht: Number(ev.target.value) })} aria-label="Gewicht" style={{ width: 80 }} />
                              ) : (
                                <span className="muted" title="Harde factor: filter, geen gewicht">
                                  filter
                                </span>
                              )}
                            </td>
                            <td>{f?.type === "gewogen" ? <input type="checkbox" checked={Boolean(e.minimumeis)} onChange={(ev) => wijzigEis(rol, idx, { minimumeis: ev.target.checked })} aria-label="Minimumeis" /> : <span className="muted">–</span>}</td>
                            <td>
                              <button type="button" className="knop knop-tekst klein" onClick={() => verwijderEis(rol, idx)}>
                                Verwijder
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted klein-tekst">Nog geen eisen voor deze rol.</p>
              )}
              <div className="gewichtBalk" aria-label={`Gewichtverdeling ${ROL_LABEL[rol]}`}>
                {gewogen.map((e, i) => (
                  <span key={i} style={{ width: `${Math.max(0, e.gewicht)}%`, background: KLEUREN[i % KLEUREN.length] }} title={`${factorVan(e.factorId)?.naam}: ${e.gewicht}%`}>
                    {e.gewicht >= 8 ? `${factorVan(e.factorId)?.code} ${e.gewicht}%` : ""}
                  </span>
                ))}
              </div>
              <p className={`klein-tekst ${v.geldig ? "muted" : "fout-tekst"}`}>
                Som gewogen factoren: <b>{v.som}%</b> {v.geldig ? "(in orde)" : "— moet precies 100% zijn"}
                {v.teveelZwaar ? <span className="waarschuwing-tekst"> · Vuistregel: {v.zwaar} factoren boven 10%; houd het bij maximaal 6 zwaarwegende factoren.</span> : null}
              </p>
              <div className="rij">
                <label>
                  Semantisch gewicht (0–40)
                  <input type="number" min={0} max={40} value={r.semantischGewicht} onChange={(ev) => update(rol, (x) => ({ ...x, semantischGewicht: Math.max(0, Math.min(40, Number(ev.target.value))) }))} />
                </label>
                <label style={{ gridColumn: "span 2" }}>
                  Vrije omschrijving voor semantische vergelijking (US-15)
                  <input value={r.vrijeOmschrijving ?? ""} onChange={(ev) => update(rol, (x) => ({ ...x, vrijeOmschrijving: ev.target.value || undefined }))} placeholder="bijv. houtbouwarchitect met ervaring in welstandsgevoelige binnensteden" />
                </label>
              </div>
            </section>
          );
        })}

        {fout ? <Melding soort="fout">{fout}</Melding> : null}
        {succes ? <Melding soort="succes">{succes}</Melding> : null}
        <div className="formulierActies">
          <button type="button" className="knop" disabled={bezig || !alleGeldig || !magBewerken} onClick={opslaan}>
            {bezig ? "Opslaan…" : "Eisen opslaan"}
          </button>
          {!alleGeldig ? <span className="muted klein-tekst">Opslaan is geblokkeerd zolang niet elke rol op 100% staat.</span> : null}
        </div>
      </fieldset>
    </div>
  );
}
