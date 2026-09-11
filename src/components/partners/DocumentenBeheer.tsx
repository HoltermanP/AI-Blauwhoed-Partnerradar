"use client";
// Onderdeel 1: documenten per partner (verwijzing en/of geplakte openbare tekst).
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { slaPartnerDocumentOp, verwijderPartnerDocument } from "@/lib/actions";
import type { PartnerDocument } from "@/lib/domain/types";
import { datum } from "@/lib/format";
import { Leeg, Melding } from "@/components/ui";

const SOORTEN: Array<{ id: PartnerDocument["soort"]; label: string }> = [
  { id: "brochure", label: "Brochure / conceptdocument" },
  { id: "certificaat", label: "Certificaat" },
  { id: "contract", label: "Contract / overeenkomst" },
  { id: "referentie", label: "Referentie / projectblad" },
  { id: "overig", label: "Overig" }
];

export default function DocumentenBeheer({ partnerId, documenten, magBewerken }: { partnerId: string; documenten: PartnerDocument[]; magBewerken: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const [toon, setToon] = useState(false);
  const [naam, setNaam] = useState("");
  const [soort, setSoort] = useState<PartnerDocument["soort"]>("brochure");
  const [url, setUrl] = useState("");
  const [tekst, setTekst] = useState("");

  const opslaan = () => {
    setFout(null);
    start(async () => {
      const r = await slaPartnerDocumentOp(partnerId, { naam, soort, url: url.trim() || undefined, tekst: tekst.trim() || undefined });
      if (!r.ok) return setFout(r.fout);
      setNaam(""); setUrl(""); setTekst(""); setToon(false);
      router.refresh();
    });
  };

  const verwijder = (d: PartnerDocument) => {
    if (!confirm(`Document '${d.naam}' verwijderen?`)) return;
    start(async () => {
      const r = await verwijderPartnerDocument(partnerId, d.id);
      if (!r.ok) return setFout(r.fout);
      router.refresh();
    });
  };

  return (
    <div className="formulier">
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      <p className="muted klein-tekst">Documenten zijn verwijzingen (URL) en/of geplakte openbare tekst; die tekst is direct bruikbaar voor verrijking. Bestandsopslag (uploads) vergt een blobdienst en is bewust buiten scope gelaten.</p>
      {documenten.length ? (
        <div className="tabelWrap">
          <table className="tabel">
            <thead>
              <tr><th>Naam</th><th>Soort</th><th>Verwijzing</th><th>Tekst</th><th>Toegevoegd</th>{magBewerken ? <th /> : null}</tr>
            </thead>
            <tbody>
              {documenten.map((d) => (
                <tr key={d.id}>
                  <td><b>{d.naam}</b>{d.toelichting ? <div className="muted klein-tekst">{d.toelichting}</div> : null}</td>
                  <td>{SOORTEN.find((s) => s.id === d.soort)?.label ?? d.soort}</td>
                  <td>{d.url ? <a href={d.url} target="_blank" rel="noreferrer" className="klein-tekst">{d.url}</a> : <span className="muted">–</span>}</td>
                  <td className="klein-tekst">{d.tekst ? `${d.tekst.slice(0, 80)}… (${d.tekst.length} tekens)` : <span className="muted">–</span>}</td>
                  <td className="klein-tekst">{datum(d.op)} · {d.toegevoegdDoor}</td>
                  {magBewerken ? (
                    <td><button type="button" className="knop knop-tekst klein" disabled={bezig} onClick={() => verwijder(d)}>Verwijderen</button></td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Leeg titel="Nog geen documenten" tekst="Voeg een brochure, certificaat of projectblad toe als verwijzing of geplakte tekst." />
      )}
      {magBewerken ? (
        <>
          <div className="formulierActies">
            <button type="button" className="knop klein" onClick={() => setToon((v) => !v)}>{toon ? "Sluiten" : "Document toevoegen"}</button>
          </div>
          {toon ? (
            <div className="formulier">
              <div className="rij">
                <label>
                  Naam
                  <input value={naam} onChange={(e) => setNaam(e.target.value)} placeholder="bijv. Woningconceptenbrochure 2026" />
                </label>
                <label>
                  Soort
                  <select value={soort} onChange={(e) => setSoort(e.target.value as PartnerDocument["soort"]) }>
                    {SOORTEN.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </label>
              </div>
              <label>
                URL (optioneel)
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
              </label>
              <label>
                Tekst (optioneel; plak openbare documenttekst)
                <textarea value={tekst} onChange={(e) => setTekst(e.target.value)} />
              </label>
              <div className="formulierActies">
                <button type="button" className="knop klein" disabled={bezig || !naam.trim() || (!url.trim() && !tekst.trim())} onClick={opslaan}>Opslaan</button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
