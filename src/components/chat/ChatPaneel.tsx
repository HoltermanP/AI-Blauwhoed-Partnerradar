"use client";
// B5: AI-chat over het partnerbestand. Antwoorden verwijzen altijd naar de onderliggende partnerrecords.
import Link from "next/link";
import { useState, useTransition } from "react";
import { stelChatVraag } from "@/lib/actions";
import { Melding } from "@/components/ui";

type Beurt = { vraag: string; antwoord: string; partners: Array<{ id: string; naam: string }>; viaAI: boolean };

export default function ChatPaneel({ aiActief }: { aiActief: boolean }) {
  const [bezig, start] = useTransition();
  const [vraag, setVraag] = useState("");
  const [beurten, setBeurten] = useState<Beurt[]>([]);
  const [fout, setFout] = useState<string | null>(null);

  const verzend = (e: React.FormEvent) => {
    e.preventDefault();
    const v = vraag.trim();
    if (!v) return;
    setFout(null);
    start(async () => {
      const r = await stelChatVraag(v, beurten.map((b) => ({ vraag: b.vraag, antwoord: b.antwoord })));
      if (!r.ok) return setFout(r.fout);
      setBeurten((b) => [...b, { vraag: v, ...r.data! }]);
      setVraag("");
    });
  };

  return (
    <div className="formulier">
      {!aiActief ? <Melding soort="info">AI staat uit (geen ANTHROPIC_API_KEY): vragen leveren de best passende partnerrecords op, zonder gegenereerd antwoord.</Melding> : null}
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      {beurten.map((b, i) => (
        <div key={i} className="chatBeurt">
          <p className="chatVraag"><b>Jij:</b> {b.vraag}</p>
          <div className="chatAntwoord">
            <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{b.antwoord}</p>
            {b.partners.length ? (
              <p className="klein-tekst" style={{ marginTop: 6 }}>
                Onderliggende partners:{" "}
                {b.partners.map((p, j) => (
                  <span key={p.id}>
                    {j > 0 ? " · " : ""}
                    <Link href={`/partners/${p.id}`}>{p.naam}</Link>
                  </span>
                ))}
              </p>
            ) : null}
            {b.viaAI ? <p className="muted klein-tekst" style={{ marginTop: 4 }}>Antwoord op basis van uitsluitend databaserecords; geregistreerd als AI-bewerking.</p> : null}
          </div>
        </div>
      ))}
      <form onSubmit={verzend} className="formulierActies" style={{ alignItems: "stretch" }}>
        <input value={vraag} onChange={(e) => setVraag(e.target.value)} placeholder="Bijv. welke aannemers hebben CLT-ervaring én een geldig ISO 9001-certificaat?" style={{ flex: 1, minWidth: 260 }} disabled={bezig} />
        <button type="submit" className="knop" disabled={bezig || !vraag.trim()}>
          {bezig ? "Bezig…" : "Vraag"}
        </button>
      </form>
    </div>
  );
}
