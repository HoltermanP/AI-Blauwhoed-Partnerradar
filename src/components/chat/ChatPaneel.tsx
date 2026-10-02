"use client";
// AI-chat over het partnerbestand, optioneel aangevuld met zoeken op internet. Antwoorden worden opgemaakt getoond
// (kopjes, opsommingen, tabellen) en hebben altijd een bronvermelding: de partnerrecords uit de database en, met
// internet, de webpagina's waarop het antwoord steunt.
import Link from "next/link";
import { useState, useTransition } from "react";
import { stelChatVraag, type ChatAntwoord } from "@/lib/actions";
import { Melding } from "@/components/ui";
import OpgemaaktAntwoord from "./OpgemaaktAntwoord";

type Beurt = ChatAntwoord & { vraag: string };

function domein(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function PartnerLinks({ partners }: { partners: Array<{ id: string; naam: string }> }) {
  return (
    <>
      {partners.map((p, j) => (
        <span key={p.id}>
          {j > 0 ? " · " : ""}
          <Link href={`/partners/${p.id}`}>{p.naam}</Link>
        </span>
      ))}
    </>
  );
}

/** Bronvermelding bij elk antwoord: wat uit de database komt en wat van internet. */
function Bronnen({ b }: { b: Beurt }) {
  const nietGenoemd = b.geraadpleegd.filter((g) => !b.partners.some((p) => p.id === g.id));
  return (
    <div className="chatBronnen klein-tekst">
      <b>Bronnen</b>
      <ul>
        <li>
          <span className="muted">Partnerbestand: </span>
          {b.partners.length ? <PartnerLinks partners={b.partners} /> : b.geraadpleegd.length ? <span className="muted">geen specifieke partner genoemd</span> : <span className="muted">geen passende records gevonden</span>}
          {nietGenoemd.length ? (
            <details className="uitklap">
              <summary className="muted">{b.partners.length ? "Ook geraadpleegd" : "Geraadpleegde records"} ({nietGenoemd.length})</summary>
              <PartnerLinks partners={nietGenoemd} />
            </details>
          ) : null}
        </li>
        {b.metInternet ? (
          <li>
            <span className="muted">Internet (indicatief, niet gevalideerd): </span>
            {b.bronnen.length ? (
              <ol>
                {b.bronnen.map((x) => (
                  <li key={x.url}>
                    <a href={x.url} target="_blank" rel="noreferrer">
                      {x.titel}
                    </a>{" "}
                    <span className="muted">{domein(x.url)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <span className="muted">geen internetbronnen gevonden</span>
            )}
          </li>
        ) : (
          <li className="muted">Alleen in de database gezocht.</li>
        )}
      </ul>
    </div>
  );
}

export default function ChatPaneel({ aiActief, metInternet }: { aiActief: boolean; metInternet: boolean }) {
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
      const r = await stelChatVraag(v, beurten.map((b) => ({ vraag: b.vraag, antwoord: b.antwoord })), metInternet);
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
            <b>Jij:</b> {b.vraag} <span className="muted klein-tekst">({b.metInternet ? "database + internet" : "alleen database"})</span>
          </p>
          <div className="chatAntwoord">
            <OpgemaaktAntwoord tekst={b.antwoord} />
            <Bronnen b={b} />
            {b.viaAI ? <p className="muted klein-tekst chatVoet">AI-antwoord (geregistreerd als AI-bewerking). Een samenvatting, geen vastgesteld gegeven: controleer het partnerdossier.</p> : null}
          </div>
        </div>
      ))}
      <form onSubmit={verzend} className="chatInvoer">
        <div className="formulierActies" style={{ alignItems: "stretch" }}>
          <input value={vraag} onChange={(e) => setVraag(e.target.value)} placeholder="Bijv. welke aannemers hebben CLT-ervaring én een geldig ISO 9001-certificaat?" aria-label="Chatvraag" style={{ flex: 1, minWidth: 200 }} disabled={bezig} />
          <button type="submit" className="knop" disabled={bezig || !vraag.trim()}>
            {bezig ? (metInternet ? "Zoeken…" : "Bezig…") : "Vraag"}
          </button>
        </div>
      </form>
    </div>
  );
}
