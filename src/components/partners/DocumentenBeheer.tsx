"use client";
// Onderdeel 1: documenten per partner (verwijzing en/of geplakte openbare tekst).
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { upload } from "@vercel/blob/client";
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

export default function DocumentenBeheer({ partnerId, documenten, magBewerken, blobActief }: { partnerId: string; documenten: PartnerDocument[]; magBewerken: boolean; blobActief: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const [toon, setToon] = useState(false);
  const [naam, setNaam] = useState("");
  const [soort, setSoort] = useState<PartnerDocument["soort"]>("brochure");
  const [url, setUrl] = useState("");
  const [tekst, setTekst] = useState("");
  const [bestand, setBestand] = useState<File | null>(null);
  const [uploadBezig, setUploadBezig] = useState(false);

  const opslaan = async () => {
    setFout(null);
    // 1. Eventueel bestand eerst naar Vercel Blob (client-upload; de route geeft alleen een token uit).
    let geupload: { url: string; contentType?: string } | null = null;
    if (bestand) {
      if (!blobActief) return setFout("Bestandsopslag (Vercel Blob) is niet geconfigureerd: zet BLOB_READ_WRITE_TOKEN. Een URL of geplakte tekst kan wel.");
      setUploadBezig(true);
      try {
        geupload = await upload(`partnerdocumenten/${partnerId}/${bestand.name}`, bestand, { access: "public", handleUploadUrl: "/api/blob/upload" });
      } catch (e) {
        setUploadBezig(false);
        return setFout(e instanceof Error ? e.message : "Upload mislukt.");
      }
      setUploadBezig(false);
    }
    const grootte = bestand?.size;
    const type = bestand?.type;
    start(async () => {
      const r = await slaPartnerDocumentOp(partnerId, { naam: naam || bestand?.name || "", soort, url: url.trim() || undefined, tekst: tekst.trim() || undefined, bestandUrl: geupload?.url, bestandType: type, bestandGrootte: grootte });
      if (!r.ok) return setFout(r.fout);
      setNaam(""); setUrl(""); setTekst(""); setBestand(null); setToon(false);
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
      <p className="muted klein-tekst">Documenten zijn een geüpload bestand (Vercel Blob), een verwijzing (URL) en/of geplakte openbare tekst; die tekst is direct bruikbaar voor verrijking.</p>
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
                  <td>
                    {d.bestandUrl ? (
                      <a href={d.bestandUrl} target="_blank" rel="noreferrer" className="klein-tekst">
                        Bestand{d.bestandGrootte ? ` (${Math.round(d.bestandGrootte / 1024)} kB)` : ""}
                      </a>
                    ) : null}
                    {d.bestandUrl && d.url ? " · " : null}
                    {d.url ? <a href={d.url} target="_blank" rel="noreferrer" className="klein-tekst">{d.url}</a> : null}
                    {!d.bestandUrl && !d.url ? <span className="muted">–</span> : null}
                  </td>
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
                Bestand uploaden (optioneel{blobActief ? "" : "; vereist BLOB_READ_WRITE_TOKEN"})
                <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.pptx,.txt,.csv" disabled={!blobActief} onChange={(e) => setBestand(e.target.files?.[0] ?? null)} />
              </label>
              <label>
                URL (optioneel)
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
              </label>
              <label>
                Tekst (optioneel; plak openbare documenttekst)
                <textarea value={tekst} onChange={(e) => setTekst(e.target.value)} />
              </label>
              <div className="formulierActies">
                <button type="button" className="knop klein" disabled={bezig || uploadBezig || (!naam.trim() && !bestand) || (!url.trim() && !tekst.trim() && !bestand)} onClick={opslaan}>{uploadBezig ? "Uploaden…" : "Opslaan"}</button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
