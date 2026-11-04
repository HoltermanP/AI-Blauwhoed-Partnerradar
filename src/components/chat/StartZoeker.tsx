"use client";
// Startpagina: chatten en zoeken in één invoer, over partners én projecten (US-28: de chat is de primaire ingang).
// "Vraag aan AI" start een chatgesprek (één AI-bewerking per vraag) en toont tegelijk de directe treffers; "Zoek direct"
// toont alleen de treffers uit de database, zonder AI. Vervolgvragen stel je in het chatpaneel.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Search, Sparkles } from "lucide-react";
import ChatPaneel from "./ChatPaneel";
import { Disclaimer } from "@/components/ui";

const VOORBEELDEN = [
  "Welke houtbouwers kunnen binnen 20 weken leveren?",
  "Welke partners werkten mee aan Ons Erf?",
  "Architecten met ervaring in transformatie",
  "Projecten met appartementen in Utrecht"
];

function zoekUrl(pad: string, q: string, web: boolean, vraag?: string) {
  const p = new URLSearchParams();
  if (q.trim()) p.set("q", q.trim());
  if (web) p.set("web", "1");
  if (vraag) p.set("vraag", vraag);
  const s = p.toString();
  return s ? `${pad}?${s}` : pad;
}

export default function StartZoeker({
  q,
  web,
  beginVraag,
  internetMogelijk,
  aiActief,
  acties,
  resultaten
}: {
  q: string;
  web: boolean;
  beginVraag?: string;
  internetMogelijk: boolean;
  aiActief: boolean;
  acties?: ReactNode;
  resultaten?: ReactNode;
}) {
  const router = useRouter();
  const pad = usePathname();
  const [bezig, start] = useTransition();
  const [term, setTerm] = useState(beginVraag ?? q);
  const [metInternet, setMetInternet] = useState(web && internetMogelijk);
  // Elke nieuwe vraag start een nieuw gesprek (nieuwe sleutel); vervolgvragen gaan in het chatpaneel.
  const [gesprek, setGesprek] = useState<{ vraag: string; sleutel: number } | null>(beginVraag?.trim() ? { vraag: beginVraag.trim(), sleutel: 0 } : null);

  const vraagAI = (tekst: string) => {
    const v = tekst.trim();
    if (!v) return;
    setGesprek((g) => ({ vraag: v, sleutel: (g?.sleutel ?? 0) + 1 }));
    // Tegelijk de directe treffers (zonder AI) laten zien.
    start(() => router.replace(zoekUrl(pad, v, metInternet), { scroll: false }));
  };
  const zoekDirect = (tekst: string) => {
    setGesprek(null);
    start(() => router.push(zoekUrl(pad, tekst, metInternet), { scroll: false }));
  };

  return (
    <>
      <section className="zoekHero">
        <div className="zoekHeroKop">
          <div>
            <p className="eyebrow">Blauwhoed partnerdatabase</p>
            <h1>Waar ben je naar op zoek?</h1>
          </div>
          {acties ? <div className="paginaActies">{acties}</div> : null}
        </div>
        <form
          className="zoekHeroForm"
          onSubmit={(e) => {
            e.preventDefault();
            vraagAI(term);
          }}
        >
          <div className="zoekHeroVeld">
            <Search size={20} aria-hidden="true" />
            <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Stel een vraag of zoek in partners en projecten…" aria-label="Vraag of zoekterm" autoFocus />
          </div>
          <button type="submit" className="knop" disabled={!term.trim()}>
            <Sparkles size={16} aria-hidden="true" /> Vraag aan AI
          </button>
          <button type="button" className="knop knop-secundair" disabled={!term.trim() || bezig} onClick={() => zoekDirect(term)}>
            Zoek direct
          </button>
        </form>
        <div className="zoekHeroOpties">
          <div className="bereikKeuze" role="radiogroup" aria-label="Waar zoeken">
            <button type="button" role="radio" aria-checked={!metInternet} className={!metInternet ? "aan" : ""} onClick={() => setMetInternet(false)}>
              Alleen database
            </button>
            <button type="button" role="radio" aria-checked={metInternet} className={metInternet ? "aan" : ""} disabled={!internetMogelijk} title={internetMogelijk ? undefined : "Externe bronnen staan uit (Beheer)"} onClick={() => setMetInternet(true)}>
              Database + internet
            </button>
          </div>
          <div className="zoekVoorbeelden">
            {VOORBEELDEN.map((v) => (
              <button
                key={v}
                type="button"
                className="voorbeeld"
                onClick={() => {
                  setTerm(v);
                  vraagAI(v);
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </section>

      {metInternet ? <Disclaimer>Informatie van internet is indicatief en niet gevalideerd; ze wordt apart getoond met bron en nooit in het partnerbestand overgenomen.</Disclaimer> : null}

      {gesprek || resultaten ? (
        <div className={gesprek && resultaten ? "zoekUitkomst metChat" : "zoekUitkomst"}>
          {gesprek ? (
            <section className="kaart chatKaart" aria-label="Antwoord van de AI">
              <div className="kaartKop">
                <h2>Antwoord</h2>
                <button type="button" className="knop knop-tekst klein" onClick={() => setGesprek(null)}>
                  Sluiten
                </button>
              </div>
              <ChatPaneel key={gesprek.sleutel} aiActief={aiActief} metInternet={metInternet} beginVraag={gesprek.vraag} />
            </section>
          ) : null}
          {resultaten ? <div aria-busy={bezig}>{resultaten}</div> : null}
        </div>
      ) : null}
      {!gesprek && !resultaten ? null : (
        <p className="muted klein-tekst zoekVoetnoot">
          Zoeken en chatten zijn geen matchadvies; voor een gerangschikt advies met harde eisen: <Link href="/projecten">project → Match</Link>.
        </p>
      )}
    </>
  );
}
