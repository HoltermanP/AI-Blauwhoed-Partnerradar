"use client";
// B3: extra openbare verrijkingsbronnen beheren zonder codewijziging (bijv. Conceptenboulevard, woningconceptenbrochure).
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { slaVerrijkingsBronOp } from "@/lib/actions";
import type { VerrijkingsBron } from "@/lib/domain/types";
import { BronLabel, Melding } from "@/components/ui";

export default function BronnenBeheer({ bronnen, magBeheren }: { bronnen: VerrijkingsBron[]; magBeheren: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const [naam, setNaam] = useState("");
  const [url, setUrl] = useState("");
  const [categorie, setCategorie] = useState<"eigen_uitgave" | "web">("web");

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
      <p className="muted klein-tekst">Naast de eigen website en de zoekmachine leest een ronde deze openbare pagina&apos;s; per partner wordt de tekst rond de bedrijfsnaam geëxtraheerd. Bronnen zijn toevoegbaar zonder codewijziging. De <b>woningconceptenbrochure</b> weegt mee via de Excel-import (conceptgegevens per partner) of als document met geplakte tekst op het partnerdossier; conceptgegevens en documentteksten tellen ook mee in de semantische matchscore en het zoeken.</p>
      {bronnen.length ? (
        <ul className="lijst">
          {bronnen.map((b) => (
            <li key={b.id} className="formulierActies">
              <label className="vinkjes" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <input type="checkbox" checked={b.actief} disabled={!magBeheren || bezig} onChange={(e) => voer(() => slaVerrijkingsBronOp({ ...b, actief: e.target.checked }))} />
                <b>{b.naam}</b>
              </label>
              <BronLabel bron={b.categorie === "eigen_uitgave" ? "eigen_uitgave" : "web"} />
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
          <select value={categorie} onChange={(e) => setCategorie(e.target.value as "eigen_uitgave" | "web")} aria-label="Categorie" style={{ maxWidth: 220 }}>
            <option value="web">Internet (indicatief)</option>
            <option value="eigen_uitgave">Eigen uitgave Blauwhoed (rang 1)</option>
          </select>
          <button type="button" className="knop klein" disabled={bezig || !naam.trim() || !url.trim()} onClick={() => voer(() => slaVerrijkingsBronOp({ naam: naam.trim(), url: url.trim(), actief: true, categorie }))}>
            Bron toevoegen
          </button>
        </div>
      ) : null}
    </div>
  );
}
