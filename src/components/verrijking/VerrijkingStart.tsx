"use client";
// US-29/US-31: verrijkingsronde starten (alle partners of één partner met geplakte openbare tekst).
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { startVerrijking } from "@/lib/actions";
import { Melding } from "@/components/ui";

export default function VerrijkingStart({ partners, magBewerken }: { partners: Array<{ id: string; naam: string }>; magBewerken: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [partnerId, setPartnerId] = useState("");
  const [tekst, setTekst] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  const draai = (id?: string, t?: string) => {
    setFout(null);
    setSucces(null);
    start(async () => {
      const r = await startVerrijking(id, t);
      if (!r.ok) return setFout(r.fout);
      setSucces(`${r.data ?? 0} voorstel(len) gevonden; nieuwe voorstellen staan in de wachtrij ter controle.`);
      router.refresh();
    });
  };

  return (
    <div className="formulier">
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      {succes ? <Melding soort="succes">{succes}</Melding> : null}
      <div className="formulierActies">
        <button type="button" className="knop" disabled={bezig || !magBewerken} onClick={() => draai()}>
          {bezig ? "Bezig…" : "Alle partners verrijken"}
        </button>
        {!magBewerken ? <span className="muted">Recht &lsquo;bewerken&rsquo; vereist.</span> : null}
      </div>
      <hr className="scheiding" />
      <label>
        Eén partner verrijken
        <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
          <option value="">Kies partner</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.naam}
            </option>
          ))}
        </select>
      </label>
      <label>
        Openbare tekst plakken (bijv. van website) — optioneel
        <textarea value={tekst} onChange={(e) => setTekst(e.target.value)} placeholder="Plak hier openbare bedrijfsinformatie. Zonder tekst wordt de profieltekst gebruikt, of de website als externe bronnen aan staan." />
      </label>
      <div className="formulierActies">
        <button type="button" className="knop knop-secundair" disabled={bezig || !magBewerken || !partnerId} onClick={() => draai(partnerId, tekst.trim() || undefined)}>
          Partner verrijken
        </button>
      </div>
    </div>
  );
}
