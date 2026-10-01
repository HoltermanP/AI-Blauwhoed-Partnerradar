"use client";
// AI-chat over het partnerbestand, optioneel aangevuld met zoeken op internet. Antwoorden worden opgemaakt getoond
// (kopjes, opsommingen, tabellen) en verwijzen naar de onderliggende partnerrecords; internetbronnen staan er apart bij.
import Link from "next/link";
import { useState, useTransition } from "react";
import { stelChatVraag, type ChatAntwoord } from "@/lib/actions";
import { Disclaimer, Melding } from "@/components/ui";
import OpgemaaktAntwoord from "./OpgemaaktAntwoord";

type Beurt = ChatAntwoord & { vraag: string };

export default function ChatPaneel({ aiActief, internetMogelijk }: { aiActief: boolean; internetMogelijk: boolean }) {
  const [bezig, start] = useTransition();
  const [vraag, setVraag] = useState("");
  const [metInternet, setMetInternet] = useState(false);
  const [beurten, setBeurten] = useState<Beurt[]>([]);
  const [fout, setFout] = useState<string | null>(null);

  const verzend = (e: React.FormEvent) => {
    e.preventDefault();
    const v = vraag.trim();
    if (!v) return;
    setFout(null);
    start(async () => {
      const r = await stelChatVraag(v, beurten.map((b) => ({ vraag: b.vraag, antwoord: b.antwoord })), metInternet && internetMogelijk);
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
          <p className="chatVraag">
            <b>Jij:</b> {b.vraag} {b.metInternet ? <span className="muted klein-tekst">(ook op internet gezocht)</span> : null}
          </p>
          <div className="chatAntwoord">
            <OpgemaaktAntwoord tekst={b.antwoord} />
            {b.partners.length ? (
              <p className="klein-tekst chatVoet">
                Onderliggende partners:{" "}
                {b.partners.map((p, j) => (
                  <span key={p.id}>
                    {j > 0 ? " · " : ""}
                    <Link href={`/partners/${p.id}`}>{p.naam}</Link>
                  </span>
                ))}
              </p>
            ) : null}
            {b.bronnen.length ? (
              <details className="uitklap chatVoet" open={b.bronnen.length <= 4}>
                <summary className="klein-tekst">Bronnen van internet ({b.bronnen.length}) — indicatief, niet gevalideerd</summary>
                <ol className="klein-tekst">
                  {b.bronnen.map((x) => (
                    <li key={x.url}>
                      <a href={x.url} target="_blank" rel="noreferrer">
                        {x.titel}
                      </a>
                    </li>
                  ))}
                </ol>
              </details>
            ) : null}
            {b.viaAI ? <p className="muted klein-tekst chatVoet">AI-antwoord (geregistreerd als AI-bewerking). Gegevens over partners komen uit de database; internetinformatie is indicatief. Een samenvatting, geen vastgesteld gegeven: controleer het partnerdossier.</p> : null}
          </div>
        </div>
      ))}
      <form onSubmit={verzend} className="chatInvoer">
        <div className="formulierActies" style={{ alignItems: "stretch" }}>
          <input value={vraag} onChange={(e) => setVraag(e.target.value)} placeholder="Bijv. welke aannemers hebben CLT-ervaring én een geldig ISO 9001-certificaat?" style={{ flex: 1, minWidth: 220 }} disabled={bezig} />
          <button type="submit" className="knop" disabled={bezig || !vraag.trim()}>
            {bezig ? (metInternet ? "Zoeken…" : "Bezig…") : "Vraag"}
          </button>
        </div>
        <label className="vinkjes chatInternet" title={internetMogelijk ? undefined : "Externe bronnen staan uit (Beheer)"}>
          <input type="checkbox" checked={metInternet && internetMogelijk} disabled={!internetMogelijk || bezig} onChange={(e) => setMetInternet(e.target.checked)} />
          Ook op internet zoeken {!internetMogelijk ? <span className="muted klein-tekst">(externe bronnen staan uit in Beheer)</span> : null}
        </label>
      </form>
      {metInternet ? <Disclaimer>Informatie van internet is indicatief en niet gevalideerd; ze wordt apart getoond met bron en nooit in het partnerbestand overgenomen. Partijen die alleen op internet staan, zijn geen partners van Blauwhoed.</Disclaimer> : null}
    </div>
  );
}
