"use client";
// US-10 / US-44: gewichten en gevraagde waarden per rol bewerken, met versiehistorie en terugdraaien.
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { draaiGewichtsprofielTerug, slaGewichtsprofielOp } from "@/lib/actions";
import { valideerGewichten } from "@/lib/domain/matching";
import type { Factor, FactorWaarde, Gewichtsprofiel, RequirementFactor, Rol } from "@/lib/domain/types";
import { ROLLEN } from "@/lib/domain/types";
import { datumTijd, ROL_LABEL, waardeTekst } from "@/lib/format";
import { Badge, Kaart, Melding } from "@/components/ui";

const KLEUREN = ["#003e7e", "#009ade", "#147a4b", "#ad5d13", "#7a5a00", "#5b3d8a", "#666666", "#0f5a45", "#d11f1f"];

function parseWaarde(f: Factor | undefined, tekst: string, huidig: FactorWaarde): FactorWaarde {
  if (!f) return tekst;
  switch (f.schaal.soort) {
    case "niveau":
    case "getal":
    case "percentage": {
      const n = Number(tekst.replace(",", "."));
      return Number.isFinite(n) ? n : huidig;
    }
    case "boolean":
      return tekst === "true" || tekst === "ja";
    case "bereik": {
      const m = tekst.match(/(\d+)\D+(\d+)/);
      return m ? { min: Number(m[1]), max: Number(m[2]) } : huidig;
    }
    case "keuze":
      return f.schaal.meervoudig ? tekst.split(",").map((s) => s.trim()).filter(Boolean) : tekst;
    case "tekst":
      return tekst;
  }
}

export function GewichtenEditor({ profiel, factoren, magBeheren, inProjecten }: { profiel: Gewichtsprofiel; factoren: Factor[]; magBeheren: boolean; inProjecten: number }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [perRol, setPerRol] = useState<Partial<Record<Rol, RequirementFactor[]>>>(() => JSON.parse(JSON.stringify(profiel.perRol)));
  const [semantisch, setSemantisch] = useState(profiel.semantischGewicht);
  const [toelichting, setToelichting] = useState("");
  const [bewerken, setBewerken] = useState(false);
  const [nieuweFactor, setNieuweFactor] = useState<Partial<Record<Rol, string>>>({});

  const factor = (id: string) => factoren.find((f) => f.id === id);
  const rollen = ROLLEN.filter((r) => perRol[r] !== undefined || bewerken);
  const validatie = useMemo(() => {
    const uit: Partial<Record<Rol, ReturnType<typeof valideerGewichten>>> = {};
    ROLLEN.forEach((r) => { if (perRol[r]) uit[r] = valideerGewichten(perRol[r] ?? [], factoren); });
    return uit;
  }, [perRol, factoren]);
  const allesGeldig = Object.values(validatie).every((v) => v.geldig);
  const gewijzigd = JSON.stringify(perRol) !== JSON.stringify(profiel.perRol) || semantisch !== profiel.semantischGewicht;

  const wijzig = (rol: Rol, idx: number, patch: Partial<RequirementFactor>) =>
    setPerRol((s) => ({ ...s, [rol]: (s[rol] ?? []).map((e, i) => (i === idx ? { ...e, ...patch } : e)) }));
  const verwijder = (rol: Rol, idx: number) => setPerRol((s) => ({ ...s, [rol]: (s[rol] ?? []).filter((_, i) => i !== idx) }));
  const voegToe = (rol: Rol) => {
    const id = nieuweFactor[rol];
    const f = factor(id ?? "");
    if (!f) return;
    const standaard: FactorWaarde = f.schaal.soort === "niveau" ? 3 : f.schaal.soort === "boolean" ? true : f.schaal.soort === "percentage" ? 50 : f.schaal.soort === "bereik" ? { min: 0, max: 100 } : f.schaal.soort === "keuze" ? (f.opties?.[0]?.id ?? "") : f.schaal.soort === "getal" ? 0 : "";
    setPerRol((s) => ({ ...s, [rol]: [...(s[rol] ?? []), { factorId: f.id, optieId: f.schaal.soort === "niveau" && f.opties?.length ? f.opties[0].id : undefined, gevraagd: standaard, gewicht: f.type === "gewogen" ? 0 : 0 }] }));
    setNieuweFactor((s) => ({ ...s, [rol]: "" }));
  };

  const opslaan = () => {
    setFout(null);
    setSucces(null);
    if (!toelichting.trim()) { setFout("Een toelichting is verplicht bij een nieuwe versie."); return; }
    const schoon: Partial<Record<Rol, RequirementFactor[]>> = {};
    ROLLEN.forEach((r) => { if (perRol[r] && perRol[r]!.length) schoon[r] = perRol[r]; });
    start(async () => {
      const r = await slaGewichtsprofielOp(profiel.id, schoon, semantisch, toelichting.trim());
      if (!r.ok) setFout(r.fout);
      else { setSucces(`Versie ${profiel.versie + 1} opgeslagen.`); setToelichting(""); setBewerken(false); router.refresh(); }
    });
  };
  const terugdraaien = (versie: number) => {
    if (!confirm(`Terugdraaien naar versie ${versie}? Dit maakt een nieuwe versie aan met die inhoud.`)) return;
    setFout(null);
    start(async () => {
      const r = await draaiGewichtsprofielTerug(profiel.id, versie);
      if (!r.ok) setFout(r.fout);
      else { setSucces(`Teruggedraaid naar versie ${versie}.`); router.refresh(); }
    });
  };

  return (
    <>
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      {succes ? <Melding soort="succes">{succes}</Melding> : null}
      <Kaart
        titel={<>{profiel.naam} <Badge kleur="blauw">v{profiel.versie}</Badge>{profiel.standaard ? <> <Badge>standaard</Badge></> : null}</>}
        acties={
          magBeheren ? (
            <div className="formulierActies">
              {bewerken ? (
                <button type="button" className="knop knop-tekst klein" disabled={bezig} onClick={() => { setPerRol(JSON.parse(JSON.stringify(profiel.perRol))); setSemantisch(profiel.semantischGewicht); setBewerken(false); }}>Annuleren</button>
              ) : null}
              <button type="button" className="knop klein" disabled={bezig} onClick={() => setBewerken((v) => !v)}>{bewerken ? "Sluiten" : "Bewerken"}</button>
            </div>
          ) : <span className="muted klein-tekst">Alleen-lezen</span>
        }
      >
        <p className="muted">{profiel.omschrijving}</p>
        <p className="klein-tekst">Gebruikt door {inProjecten} project{inProjecten === 1 ? "" : "en"}. Semantisch gewicht (gelijkenis van vrije omschrijving en referenties in de eindscore, 0–40):{" "}
          {bewerken ? <input type="number" min={0} max={40} value={semantisch} onChange={(e) => setSemantisch(Math.max(0, Math.min(40, Number(e.target.value))))} style={{ width: 70, padding: 4, border: "1px solid var(--line)" }} /> : <b>{profiel.semantischGewicht}</b>}
        </p>

        {rollen.map((rol) => {
          const eisen = perRol[rol] ?? [];
          const v = validatie[rol];
          const gewogen = eisen.filter((e) => factor(e.factorId)?.type === "gewogen");
          const beschikbaar = factoren.filter((f) => f.actief && (f.rollen.length === 0 || f.rollen.includes(rol)) && !eisen.some((e) => e.factorId === f.id));
          if (eisen.length === 0 && !bewerken) return null;
          return (
            <div key={rol} className="rolBlok">
              <h3>
                {ROL_LABEL[rol]}{" "}
                {v ? (v.geldig ? <Badge kleur="groen">som {v.som}%</Badge> : <Badge kleur="rood">som {v.som}% (moet 100)</Badge>) : null}
                {v?.teveelZwaar ? <> <Badge kleur="geel">{v.zwaar} factoren &gt; 10%</Badge></> : null}
              </h3>
              {gewogen.length ? (
                <div className="gewichtBalk" aria-label="Gewichtsverdeling">
                  {gewogen.map((e, i) => (
                    <span key={`${e.factorId}-${e.optieId ?? ""}`} style={{ width: `${e.gewicht}%`, background: KLEUREN[i % KLEUREN.length] }} title={`${factor(e.factorId)?.naam ?? e.factorId}: ${e.gewicht}%`}>
                      {e.gewicht >= 8 ? `${factor(e.factorId)?.naam ?? e.factorId} ${e.gewicht}%` : ""}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="tabelWrap">
                <table className="tabel criteriumTabel">
                  <thead>
                    <tr>
                      <th>Factor</th>
                      <th>Type</th>
                      <th>Optie</th>
                      <th>Gevraagd</th>
                      <th className="num">Gewicht %</th>
                      <th>Minimumeis</th>
                      {bewerken ? <th /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {eisen.map((e, idx) => {
                      const f = factor(e.factorId);
                      const optieLabel = f?.opties?.find((o) => o.id === e.optieId)?.label ?? e.optieId;
                      return (
                        <tr key={`${e.factorId}-${e.optieId ?? ""}-${idx}`}>
                          <td>
                            {f?.naam ?? <span className="muted">{e.factorId} (onbekend)</span>}
                            {f ? <div className="muted klein-tekst" style={{ fontWeight: 400 }}>{f.code} · {f.categorie}</div> : null}
                          </td>
                          <td>{f ? <Badge kleur={f.type === "hard" ? "rood" : f.type === "gewogen" ? "blauw" : "mint"}>{f.type}</Badge> : null}</td>
                          <td>
                            {bewerken && f?.opties?.length ? (
                              <select value={e.optieId ?? ""} onChange={(ev) => wijzig(rol, idx, { optieId: ev.target.value || undefined })}>
                                <option value="">—</option>
                                {f.opties.filter((o) => o.actief || o.id === e.optieId).map((o) => (
                                  <option key={o.id} value={o.id}>{o.label}</option>
                                ))}
                              </select>
                            ) : (optieLabel ?? <span className="muted">–</span>)}
                          </td>
                          <td>
                            {bewerken ? (
                              f?.schaal.soort === "boolean" ? (
                                <select value={String(e.gevraagd)} onChange={(ev) => wijzig(rol, idx, { gevraagd: ev.target.value === "true" })}>
                                  <option value="true">Ja</option>
                                  <option value="false">Nee</option>
                                </select>
                              ) : f?.schaal.soort === "keuze" && !f.schaal.meervoudig && f.opties?.length ? (
                                <select value={String(e.gevraagd)} onChange={(ev) => wijzig(rol, idx, { gevraagd: ev.target.value })}>
                                  {f.opties.map((o) => (
                                    <option key={o.id} value={o.id}>{o.label}</option>
                                  ))}
                                </select>
                              ) : (
                                <input defaultValue={waardeTekst(e.gevraagd)} onBlur={(ev) => wijzig(rol, idx, { gevraagd: parseWaarde(f, ev.target.value, e.gevraagd) })} style={{ maxWidth: 120 }} title={f?.schaal.soort === "bereik" ? "min–max" : f?.schaal.soort === "niveau" ? "0–5" : undefined} />
                              )
                            ) : (
                              <>{waardeTekst(e.gevraagd)}{f?.schaal.soort === "getal" ? <span className="muted"> {f.schaal.eenheid}</span> : f?.schaal.soort === "percentage" ? "%" : null}</>
                            )}
                          </td>
                          <td className="num">
                            {bewerken && f?.type === "gewogen" ? (
                              <input type="number" min={0} max={100} value={e.gewicht} onChange={(ev) => wijzig(rol, idx, { gewicht: Math.max(0, Math.min(100, Number(ev.target.value))) })} style={{ width: 70 }} />
                            ) : f?.type === "gewogen" ? e.gewicht : <span className="muted">–</span>}
                          </td>
                          <td>
                            {bewerken && f?.type === "gewogen" ? (
                              <input type="checkbox" checked={!!e.minimumeis} onChange={(ev) => wijzig(rol, idx, { minimumeis: ev.target.checked || undefined })} />
                            ) : e.minimumeis ? <Badge kleur="rood">ja</Badge> : f?.type === "hard" ? <span className="muted">hard filter</span> : <span className="muted">–</span>}
                          </td>
                          {bewerken ? (
                            <td><button type="button" className="knop knop-tekst klein" onClick={() => verwijder(rol, idx)}>Verwijderen</button></td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {bewerken ? (
                <div className="formulierActies" style={{ marginTop: 8 }}>
                  <select value={nieuweFactor[rol] ?? ""} onChange={(ev) => setNieuweFactor((s) => ({ ...s, [rol]: ev.target.value }))} style={{ maxWidth: 320 }}>
                    <option value="">— factor toevoegen —</option>
                    {beschikbaar.map((f) => (
                      <option key={f.id} value={f.id}>{f.code} {f.naam} ({f.type})</option>
                    ))}
                  </select>
                  <button type="button" className="knop knop-secundair klein" disabled={!nieuweFactor[rol]} onClick={() => voegToe(rol)}>Toevoegen</button>
                </div>
              ) : null}
            </div>
          );
        })}

        {bewerken ? (
          <div className="formulier" style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
            {!allesGeldig ? <Melding soort="waarschuwing">Gewogen factoren moeten per rol optellen tot 100%. Corrigeer de rood gemarkeerde rollen.</Melding> : null}
            <label>
              Toelichting bij deze versie (verplicht)
              <textarea value={toelichting} onChange={(e) => setToelichting(e.target.value)} placeholder="Waarom wijzigen de gewichten? Bijv. evaluaties tonen dat planningsbetrouwbaarheid zwaarder moet wegen." />
            </label>
            <div className="formulierActies">
              <button type="button" className="knop" disabled={bezig || !allesGeldig || !gewijzigd || !toelichting.trim()} onClick={opslaan}>
                {bezig ? "Bezig…" : `Opslaan als versie ${profiel.versie + 1}`}
              </button>
              {!gewijzigd ? <span className="muted klein-tekst">Geen wijzigingen.</span> : null}
            </div>
          </div>
        ) : null}
      </Kaart>

      <Kaart titel="Versiehistorie">
        <div className="tabelWrap">
          <table className="tabel">
            <thead>
              <tr>
                <th className="num">Versie</th>
                <th>Datum</th>
                <th>Door</th>
                <th>Toelichting</th>
                <th className="num">Factoren</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {[...profiel.versies].sort((a, b) => b.versie - a.versie).map((v) => (
                <tr key={v.versie}>
                  <td className="num"><b>v{v.versie}</b>{v.versie === profiel.versie ? <> <Badge kleur="groen">actueel</Badge></> : null}</td>
                  <td>{datumTijd(v.op)}</td>
                  <td>{v.door}</td>
                  <td>{v.toelichting}</td>
                  <td className="num">{Object.values(v.snapshot).reduce((s, l) => s + (l?.length ?? 0), 0)}</td>
                  <td>
                    {magBeheren && v.versie !== profiel.versie ? (
                      <button type="button" className="knop knop-tekst klein" disabled={bezig} onClick={() => terugdraaien(v.versie)}>Terugdraaien naar deze versie</button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Kaart>
    </>
  );
}
