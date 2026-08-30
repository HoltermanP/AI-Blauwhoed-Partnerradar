"use client";
// US-18: CSV-import van projectadministratie (bestand of geplakte tekst).
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { importeerCsv } from "@/lib/actions";
import { Melding } from "@/components/ui";

export const CSV_KOP = "kvk;crediteurnummer;project;rol;van;tot;contractwaarde;raming;eindafrekening;geplande oplevering;werkelijke oplevering;bouwsysteem";
export const CSV_VOORBEELD = "34123456;CR-1001;Houtwijk Vathorst;aannemer;2023-03-01;2025-02-28;18500000;18200000;18650000;2025-02-15;2025-02-28;CLT";

export default function CsvImport({ magBewerken }: { magBewerken: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [csv, setCsv] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [resultaat, setResultaat] = useState<{ geimporteerd: number; wachtrij: number } | null>(null);

  const leesBestand = (f: File | undefined) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ""));
    reader.readAsText(f);
  };

  const importeer = () => {
    setFout(null);
    setResultaat(null);
    if (!csv.trim()) return setFout("Geen CSV-inhoud.");
    start(async () => {
      const r = await importeerCsv(csv);
      if (!r.ok) return setFout(r.fout);
      setResultaat(r.data ?? { geimporteerd: 0, wachtrij: 0 });
      router.refresh();
    });
  };

  return (
    <div className="formulier">
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      {resultaat ? (
        <Melding soort={resultaat.wachtrij ? "waarschuwing" : "succes"}>
          {resultaat.geimporteerd} regel(s) geïmporteerd, {resultaat.wachtrij} naar de controlewachtrij.
        </Melding>
      ) : null}
      <label>
        CSV-bestand (.csv)
        <input type="file" accept=".csv,text/csv" onChange={(e) => leesBestand(e.target.files?.[0])} />
      </label>
      <label>
        Of plak CSV-tekst
        <textarea value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={`${CSV_KOP}\n${CSV_VOORBEELD}`} />
      </label>
      <div className="formulierActies">
        <button type="button" className="knop" disabled={bezig || !magBewerken} onClick={importeer}>
          {bezig ? "Importeren…" : "Importeren"}
        </button>
        <button type="button" className="knop knop-tekst klein" onClick={() => setCsv(`${CSV_KOP}\n${CSV_VOORBEELD}`)}>
          Voorbeeld invullen
        </button>
        {!magBewerken ? <span className="muted">Recht &lsquo;bewerken&rsquo; vereist.</span> : null}
      </div>
      <details className="uitklap">
        <summary>Verwacht kolomformaat</summary>
        <pre className="csvVoorbeeld">
          {CSV_KOP}
          {"\n"}
          {CSV_VOORBEELD}
        </pre>
        <p className="muted">Scheidingsteken ; of ,. Match op KVK of crediteurnummer; project op naam of id; rol in kleine letters. Onherleidbare regels gaan naar de controlewachtrij.</p>
      </details>
    </div>
  );
}
