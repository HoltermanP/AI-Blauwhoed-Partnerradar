"use client";
// B3: extra openbare verrijkingsbronnen beheren zonder codewijziging (bijv. Conceptenboulevard, woningconceptenbrochure).
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { slaVerrijkingsBronOp } from "@/lib/actions";
import type { VerrijkingsBron } from "@/lib/domain/types";
import { Melding } from "@/components/ui";

export default function BronnenBeheer({ bronnen, magBeheren }: { bronnen: VerrijkingsBron[]; magBeheren: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const [naam, setNaam] = useState("");
  const [url, setUrl] = useState("");

  const voer = (fn: () => ReturnType<typeof slaVerrijkingsBronOp>) => {
    setFout(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) return setFout(r.fout);
      setNaam("");
      setUrl("");
      router.refresh();
    });
  };

  return (
    <div className="formulier">
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      <p className="muted klein-tekst">Naast de eigen website en de zoekmachine leest een ronde deze openbare pagina&apos;s; per partner wordt de tekst rond de bedrijfsnaam geëxtraheerd. Bronnen zijn toevoegbaar zonder codewijziging.</p>
      {bronnen.length ? (
        <ul className="lijst">
          {bronnen.map((b) => (
            <li key={b.id} className="formulierActies">
              <label className="vinkjes" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <input type="checkbox" checked={b.actief} disabled={!magBeheren || bezig} onChange={(e) => voer(() => slaVerrijkingsBronOp({ ...b, actief: e.target.checked }))} />
                <b>{b.naam}</b>
              </label>
              <a href={b.url} target="_blank" rel="noreferrer" className="klein-tekst">{b.url}</a>
              {magBeheren ? (
                <button type="button" className="knop knop-tekst klein" disabled={bezig} onClick={() => voer(() => slaVerrijkingsBronOp({ verwijderId: b.id }))}>Verwijderen</button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted klein-tekst">Nog geen extra bronnen geconfigureerd.</p>
      )}
      {magBeheren ? (
        <div className="formulierActies">
          <input placeholder="Naam (bijv. Conceptenboulevard)" value={naam} onChange={(e) => setNaam(e.target.value)} style={{ maxWidth: 220 }} />
          <input placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} style={{ maxWidth: 280 }} />
          <button type="button" className="knop klein" disabled={bezig || !naam.trim() || !url.trim()} onClick={() => voer(() => slaVerrijkingsBronOp({ naam: naam.trim(), url: url.trim(), actief: true }))}>
            Bron toevoegen
          </button>
        </div>
      ) : null}
    </div>
  );
}
