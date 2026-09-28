"use client";
// US-62: openbare keurmerk- en brancheregisters als bron. Zoekpatroon met {naam} of {kvk}; alleen openbaar, zonder login of betaling.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { slaRegisterbronOp } from "@/lib/acties/beheer";
import type { CertificaatType, RegisterBron } from "@/lib/domain/types";
import { Badge, Melding } from "@/components/ui";

export default function RegisterBeheer({ registers, certificaten, magBeheren }: { registers: RegisterBron[]; certificaten: CertificaatType[]; magBeheren: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const [naam, setNaam] = useState("");
  const [url, setUrl] = useState("");
  const [cert, setCert] = useState<CertificaatType>(certificaten[0]);
  const voer = (fn: () => ReturnType<typeof slaRegisterbronOp>, reset = false) => {
    setFout(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) return setFout(r.fout);
      if (reset) {
        setNaam("");
        setUrl("");
      }
      router.refresh();
    });
  };
  return (
    <div className="formulier">
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      <p className="muted klein-tekst">
        Bij elke verrijking zoekt de applicatie in actieve registers op bedrijfsnaam of KVK-nummer. Gevonden: het certificaat krijgt het register als bron met datum (geverifieerd). Niet gevonden: het certificaat blijft <b>geclaimd</b>. Controleer het zoekpatroon voordat u een register activeert.
      </p>
      <ul className="lijst">
        {registers.map((r) => (
          <li key={r.id} className="formulierActies">
            <label className="vinkjes" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" checked={r.actief} disabled={!magBeheren || bezig} onChange={(e) => voer(() => slaRegisterbronOp({ ...r, actief: e.target.checked }))} />
              <b>{r.naam}</b>
            </label>
            <Badge kleur="blauw">{r.certificaat}</Badge>
            <span className="klein-tekst muted breekWoord">{r.url}</span>
            {magBeheren ? (
              <button type="button" className="knop knop-tekst klein" disabled={bezig} onClick={() => voer(() => slaRegisterbronOp({ verwijderId: r.id }))}>
                Verwijderen
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {magBeheren ? (
        <div className="rij">
          <label>
            Naam
            <input value={naam} onChange={(e) => setNaam(e.target.value)} placeholder="bijv. KOMO-certificaten" />
          </label>
          <label>
            Zoekpatroon (https, met {"{naam}"} of {"{kvk}"})
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…?q={naam}" />
          </label>
          <label>
            Certificaat
            <select value={cert} onChange={(e) => setCert(e.target.value as CertificaatType)}>
              {certificaten.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <button type="button" className="knop klein" disabled={bezig || !naam.trim() || !url.trim()} onClick={() => voer(() => slaRegisterbronOp({ naam, url, certificaat: cert, actief: true }), true)}>
            Register toevoegen
          </button>
        </div>
      ) : null}
    </div>
  );
}
