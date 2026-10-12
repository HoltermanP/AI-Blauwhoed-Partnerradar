"use client";
// US-03: verouderingstermijn per veld (factoren en basisvelden) en de drempels voor 'onbetrouwbaar' en matchdekking.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { slaTermijnenOp } from "@/lib/acties/datakwaliteit";
import type { BasisVeld } from "@/lib/domain/types";
import { Melding } from "@/components/ui";

type Veld = { sleutel: string; naam: string; groep: string; maanden?: number };

export default function TermijnenEditor({ velden, betrouwbaarheidDrempel, dekkingDrempel, magBeheren }: { velden: Veld[]; betrouwbaarheidDrempel: number; dekkingDrempel: number; magBeheren: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [waarden, setWaarden] = useState<Record<string, string>>(() => Object.fromEntries(velden.map((v) => [v.sleutel, v.maanden ? String(v.maanden) : ""])));
  const [drempel, setDrempel] = useState(Math.round(betrouwbaarheidDrempel * 100));
  const [dekking, setDekking] = useState(dekkingDrempel);
  const [melding, setMelding] = useState<{ soort: "succes" | "fout"; tekst: string } | null>(null);
  const groepen = Array.from(new Set(velden.map((v) => v.groep)));
  const getal = (s: string) => (s.trim() ? Number(s) : null);

  const opslaan = () =>
    start(async () => {
      setMelding(null);
      const factoren: Record<string, number | null> = {};
      const basis: Partial<Record<BasisVeld, number | null>> = {};
      velden.forEach((v) => {
        if (v.sleutel.startsWith("factor:")) factoren[v.sleutel.slice(7)] = getal(waarden[v.sleutel] ?? "");
        else basis[v.sleutel.slice(6) as BasisVeld] = getal(waarden[v.sleutel] ?? "");
      });
      const r = await slaTermijnenOp({ factoren, basis, betrouwbaarheidDrempel: drempel / 100, dekkingDrempel: dekking });
      setMelding(r.ok ? { soort: "succes", tekst: "Opgeslagen. Signalen en matchdekking gebruiken de nieuwe instellingen direct." } : { soort: "fout", tekst: r.fout });
      if (r.ok) router.refresh();
    });

  return (
    <div className="formulier">
      {melding ? <Melding soort={melding.soort}>{melding.tekst}</Melding> : null}
      <div className="rij">
        <label>
          Onbetrouwbaar onder: {drempel}%
          <input type="range" min={10} max={90} step={5} value={drempel} disabled={!magBeheren} onChange={(e) => setDrempel(Number(e.target.value))} />
          <small className="muted">Een niet-geverifieerde waarde met een lagere betrouwbaarheid geeft een signaal.</small>
        </label>
        <label>
          Matchdekking indicatief onder: {dekking}%
          <input type="range" min={20} max={90} step={5} value={dekking} disabled={!magBeheren} onChange={(e) => setDekking(Number(e.target.value))} />
          <small className="muted">Per rol in een matchrun; daaronder krijgt de uitkomst een waarschuwing.</small>
        </label>
      </div>
      {groepen.map((gr) => (
        <details key={gr} className="uitklap" open={gr.startsWith("Basis")}>
          <summary>{gr}</summary>
          <div className="termijnRaster">
            {velden
              .filter((v) => v.groep === gr)
              .map((v) => (
                <label key={v.sleutel}>
                  <span>{v.naam}</span>
                  <span className="metEenheid">
                    <input type="number" min={0} max={240} value={waarden[v.sleutel] ?? ""} disabled={!magBeheren} placeholder="geen" onChange={(e) => setWaarden((w) => ({ ...w, [v.sleutel]: e.target.value }))} />
                    <small>mnd</small>
                  </span>
                </label>
              ))}
          </div>
        </details>
      ))}
      {magBeheren ? (
        <div className="formulierActies">
          <button type="button" className="knop" disabled={bezig} onClick={opslaan}>
            {bezig ? "Opslaan…" : "Termijnen en drempels opslaan"}
          </button>
          <span className="muted klein-tekst">Leeg = verjaart niet. Een waarde ouder dan de termijn (gerekend vanaf de peildatum of de laatste verificatie) geldt als verouderd.</span>
        </div>
      ) : (
        <p className="muted klein-tekst">Alleen de beheerder wijzigt termijnen en drempels.</p>
      )}
    </div>
  );
}
