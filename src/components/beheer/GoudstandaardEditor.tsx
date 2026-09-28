"use client";
// US-49: velden (verplicht/gewenst) en beoordelingscriteria per partnertype bewerken.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { slaGoudstandaardOp } from "@/lib/acties/goudstandaard";
import type { Beoordelingscriterium, GoudstandaardProfiel, GoudstandaardVeld, Rol } from "@/lib/domain/types";
import { Melding } from "@/components/ui";

type Optie = { sleutel: string; label: string };

export default function GoudstandaardEditor({ rol, profiel, opties, magBeheren }: { rol: Rol; profiel: GoudstandaardProfiel; opties: Optie[]; magBeheren: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [velden, setVelden] = useState<GoudstandaardVeld[]>(profiel.velden);
  const [criteria, setCriteria] = useState<Beoordelingscriterium[]>(profiel.criteria);
  const [nieuw, setNieuw] = useState("");
  const label = (s: string) => opties.find((o) => o.sleutel === s)?.label ?? s;

  const opslaan = () => {
    setFout(null);
    setOk(false);
    start(async () => {
      const r = await slaGoudstandaardOp(rol, { velden, criteria });
      if (!r.ok) return setFout(r.fout);
      setOk(true);
      router.refresh();
    });
  };

  return (
    <div className="formulier">
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      {ok ? <Melding soort="succes">Goudstandaard opgeslagen (nieuwe versie in de auditlog).</Melding> : null}
      <h3>Velden</h3>
      <div className="tabelWrap">
        <table className="tabel">
          <thead>
            <tr>
              <th>Veld</th>
              <th>Niveau</th>
              <th>Toelichting</th>
              {magBeheren ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {velden.map((v, i) => (
              <tr key={v.sleutel}>
                <td>{label(v.sleutel)}</td>
                <td>
                  <select value={v.niveau} disabled={!magBeheren} onChange={(e) => setVelden(velden.map((x, j) => (j === i ? { ...x, niveau: e.target.value as GoudstandaardVeld["niveau"] } : x)))}>
                    <option value="verplicht">verplicht</option>
                    <option value="gewenst">gewenst</option>
                  </select>
                </td>
                <td>
                  <input value={v.toelichting ?? ""} disabled={!magBeheren} onChange={(e) => setVelden(velden.map((x, j) => (j === i ? { ...x, toelichting: e.target.value || undefined } : x)))} placeholder="bijv. welke bron leidend is" />
                </td>
                {magBeheren ? (
                  <td>
                    <button type="button" className="knop knop-tekst klein" onClick={() => setVelden(velden.filter((_, j) => j !== i))}>
                      Verwijderen
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {magBeheren ? (
        <div className="formulierActies">
          <select value={nieuw} onChange={(e) => setNieuw(e.target.value)} aria-label="Veld toevoegen">
            <option value="">Veld toevoegen…</option>
            {opties
              .filter((o) => !velden.some((v) => v.sleutel === o.sleutel))
              .map((o) => (
                <option key={o.sleutel} value={o.sleutel}>
                  {o.label}
                </option>
              ))}
          </select>
          <button
            type="button"
            className="knop knop-secundair klein"
            disabled={!nieuw}
            onClick={() => {
              setVelden([...velden, { sleutel: nieuw, niveau: "gewenst" }]);
              setNieuw("");
            }}
          >
            Toevoegen
          </button>
        </div>
      ) : null}
      <h3>Beoordelingscriteria</h3>
      {criteria.map((c, i) => (
        <div key={c.id || i} className="rij">
          <label>
            Criterium
            <input value={c.naam} disabled={!magBeheren} onChange={(e) => setCriteria(criteria.map((x, j) => (j === i ? { ...x, naam: e.target.value } : x)))} />
          </label>
          <label>
            Omschrijving
            <input value={c.omschrijving} disabled={!magBeheren} onChange={(e) => setCriteria(criteria.map((x, j) => (j === i ? { ...x, omschrijving: e.target.value } : x)))} />
          </label>
          {magBeheren ? (
            <button type="button" className="knop knop-tekst klein" onClick={() => setCriteria(criteria.filter((_, j) => j !== i))}>
              Verwijderen
            </button>
          ) : null}
        </div>
      ))}
      {magBeheren ? (
        <div className="formulierActies">
          <button type="button" className="knop knop-secundair klein" onClick={() => setCriteria([...criteria, { id: `crit-${Date.now().toString(36)}`, naam: "", omschrijving: "" }])}>
            Criterium toevoegen
          </button>
          <button type="button" className="knop" disabled={bezig} onClick={opslaan}>
            {bezig ? "Opslaan…" : "Goudstandaard opslaan"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
