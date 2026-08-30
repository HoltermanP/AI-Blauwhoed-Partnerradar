"use client";
// US-06: certificaten met geldigheidsdatum; verlopen = rood, binnen 90 dagen = geel.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { slaCertificaatOp, verwijderCertificaat } from "@/lib/actions";
import type { Certificaat, CertificaatType } from "@/lib/domain/types";
import { datum } from "@/lib/format";
import { Badge, Melding } from "@/components/ui";
import { CERTIFICAAT_TYPEN, certificaatStatus } from "./certificaten";

type Concept = { id?: string; type: CertificaatType; nummer: string; niveau: string; geldigTot: string; geverifieerdOp: string; bronUrl: string };
const leeg = (): Concept => ({ type: "ISO 9001", nummer: "", niveau: "", geldigTot: "", geverifieerdOp: "", bronUrl: "" });

export default function CertificatenBeheer({ partnerId, certificaten, magBewerken }: { partnerId: string; certificaten: Certificaat[]; magBewerken: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const [concept, setConcept] = useState<Concept | null>(null);

  function bewerk(c: Certificaat) {
    setConcept({ id: c.id, type: c.type, nummer: c.nummer, niveau: c.niveau?.toString() ?? "", geldigTot: c.geldigTot, geverifieerdOp: c.geverifieerdOp ?? "", bronUrl: c.bronUrl ?? "" });
  }

  function verzend(e: React.FormEvent) {
    e.preventDefault();
    if (!concept) return;
    setFout(null);
    start(async () => {
      const r = await slaCertificaatOp(partnerId, {
        id: concept.id,
        type: concept.type,
        nummer: concept.nummer.trim(),
        niveau: concept.type === "CO2-prestatieladder" && concept.niveau ? Number(concept.niveau) : undefined,
        geldigTot: concept.geldigTot,
        geverifieerdOp: concept.geverifieerdOp || undefined,
        bronUrl: concept.bronUrl.trim() || undefined
      });
      if (!r.ok) setFout(r.fout);
      else {
        setConcept(null);
        router.refresh();
      }
    });
  }

  function verwijder(c: Certificaat) {
    if (!confirm(`${c.type} ${c.nummer} verwijderen?`)) return;
    start(async () => {
      const r = await verwijderCertificaat(partnerId, c.id);
      if (!r.ok) setFout(r.fout);
      else router.refresh();
    });
  }

  const gesorteerd = [...certificaten].sort((a, b) => a.geldigTot.localeCompare(b.geldigTot));

  return (
    <div>
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      {gesorteerd.length ? (
        <div className="tabelWrap">
          <table className="tabel">
            <thead>
              <tr>
                <th>Type</th>
                <th>Nummer</th>
                <th>Niveau</th>
                <th>Geldig tot</th>
                <th>Status</th>
                <th>Geverifieerd</th>
                <th>Bron</th>
                {magBewerken ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {gesorteerd.map((c) => {
                const s = certificaatStatus(c.geldigTot);
                return (
                  <tr key={c.id} className={`cert-${s.kleur}`}>
                    <td>
                      <b>{c.type}</b>
                    </td>
                    <td>{c.nummer}</td>
                    <td>{c.type === "CO2-prestatieladder" ? (c.niveau ?? "–") : "–"}</td>
                    <td>{datum(c.geldigTot)}</td>
                    <td>
                      <Badge kleur={s.kleur}>{s.label}</Badge>
                    </td>
                    <td>{c.geverifieerdOp ? datum(c.geverifieerdOp) : <span className="muted">niet geverifieerd</span>}</td>
                    <td>
                      {c.bronUrl ? (
                        <a href={c.bronUrl} target="_blank" rel="noreferrer">
                          bron
                        </a>
                      ) : (
                        <span className="muted">–</span>
                      )}
                    </td>
                    {magBewerken ? (
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button type="button" className="knop knop-tekst klein" onClick={() => bewerk(c)}>
                          Bewerken
                        </button>
                        <button type="button" className="knop knop-tekst klein" onClick={() => verwijder(c)} disabled={bezig}>
                          Verwijderen
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">Geen certificaten vastgelegd.</p>
      )}
      {magBewerken && !concept ? (
        <div className="formulierActies" style={{ marginTop: 14 }}>
          <button type="button" className="knop klein" onClick={() => setConcept(leeg())}>
            Certificaat toevoegen
          </button>
        </div>
      ) : null}
      {concept ? (
        <form className="formulier inlineFormulier" onSubmit={verzend} style={{ marginTop: 14 }}>
          <h3>{concept.id ? "Certificaat bewerken" : "Nieuw certificaat"}</h3>
          <div className="rij">
            <label>
              Type
              <select value={concept.type} onChange={(e) => setConcept({ ...concept, type: e.target.value as CertificaatType })}>
                {CERTIFICAAT_TYPEN.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Certificaatnummer
              <input required value={concept.nummer} onChange={(e) => setConcept({ ...concept, nummer: e.target.value })} />
            </label>
            {concept.type === "CO2-prestatieladder" ? (
              <label>
                Niveau (1–5)
                <select value={concept.niveau} onChange={(e) => setConcept({ ...concept, niveau: e.target.value })} required>
                  <option value="">– kies –</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label>
              Geldig tot
              <input type="date" required value={concept.geldigTot} onChange={(e) => setConcept({ ...concept, geldigTot: e.target.value })} />
            </label>
            <label>
              Geverifieerd op
              <input type="date" value={concept.geverifieerdOp} onChange={(e) => setConcept({ ...concept, geverifieerdOp: e.target.value })} />
            </label>
            <label>
              Bron-URL
              <input type="url" value={concept.bronUrl} onChange={(e) => setConcept({ ...concept, bronUrl: e.target.value })} placeholder="https://" />
            </label>
          </div>
          <div className="formulierActies">
            <button type="submit" className="knop klein" disabled={bezig}>
              {bezig ? "Opslaan…" : "Opslaan"}
            </button>
            <button type="button" className="knop knop-secundair klein" onClick={() => setConcept(null)}>
              Annuleren
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
