"use client";
// Eén zoekpagina met twee ingangen naast elkaar: klassiek zoeken (links) en de AI-chat (rechts). De keuze
// "alleen database" of "database + internet" geldt voor beide; bronnen worden altijd vermeld.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import ChatPaneel from "@/components/chat/ChatPaneel";
import { Disclaimer, Kaart } from "@/components/ui";

const VOORBEELDEN = ["circulaire houtbouw met demontabele gevel", "hoogstedelijke woontoren", "transformatie monument", "zorgwonen met sterke planningsdiscipline"];

function zoekUrl(pad: string, q: string, web: boolean) {
  const p = new URLSearchParams();
  if (q.trim()) p.set("q", q.trim());
  if (web) p.set("web", "1");
  const s = p.toString();
  return s ? `${pad}?${s}` : pad;
}

export default function ZoekWerkblad({ q, web, internetMogelijk, aiActief, resultaten }: { q: string; web: boolean; internetMogelijk: boolean; aiActief: boolean; resultaten: ReactNode }) {
  const router = useRouter();
  const pad = usePathname();
  const [bezig, start] = useTransition();
  const [term, setTerm] = useState(q);
  const [metInternet, setMetInternet] = useState(web && internetMogelijk);

  const naar = (nieuweQ: string, nieuwWeb: boolean) => start(() => router.push(zoekUrl(pad, nieuweQ, nieuwWeb)));

  const wisselBereik = (internet: boolean) => {
    setMetInternet(internet);
    // Lopende zoekopdracht direct opnieuw tonen met het nieuwe bereik (de chat gebruikt het vanaf de volgende vraag).
    if (q.trim()) start(() => router.replace(zoekUrl(pad, q, internet), { scroll: false }));
  };

  return (
    <>
      <div className="zoekBereik" role="radiogroup" aria-label="Waar zoeken">
        <span className="muted klein-tekst">Zoeken in:</span>
        <label>
          <input type="radio" name="bereik" checked={!metInternet} onChange={() => wisselBereik(false)} /> Alleen de database
        </label>
        <label title={internetMogelijk ? undefined : "Externe bronnen staan uit (Beheer)"}>
          <input type="radio" name="bereik" checked={metInternet} disabled={!internetMogelijk} onChange={() => wisselBereik(true)} /> Database + internet
          {!internetMogelijk ? <span className="muted klein-tekst"> (externe bronnen staan uit in Beheer)</span> : null}
        </label>
      </div>
      {metInternet ? <Disclaimer>Informatie van internet is indicatief en niet gevalideerd; ze wordt apart getoond met bron en nooit in het partnerbestand overgenomen. Partijen die alleen op internet staan, zijn geen partners van Blauwhoed.</Disclaimer> : null}

      <div className="raster raster-2 zoekWerkblad">
        <Kaart titel="Zoeken">
          <p className="muted klein-tekst">Klassiek zoeken op een vrije omschrijving, zonder AI. Treffers zijn geen matchadvies: harde eisen worden hier niet getoetst.</p>
          <form
            className="formulier"
            onSubmit={(e) => {
              e.preventDefault();
              naar(term, metInternet);
            }}
          >
            <div className="formulierActies" style={{ alignItems: "stretch" }}>
              <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="bijv. circulaire houtbouw met demontabele gevel" aria-label="Zoekterm" style={{ flex: 1, minWidth: 200 }} />
              <button className="knop" type="submit" disabled={bezig || !term.trim()}>
                {bezig ? "Zoeken…" : "Zoeken"}
              </button>
            </div>
            <div className="formulierActies">
              <span className="muted klein-tekst">Voorbeelden:</span>
              {VOORBEELDEN.map((v) => (
                <Link key={v} href={zoekUrl(pad, v, metInternet)} className="chip" onClick={() => setTerm(v)}>
                  {v}
                </Link>
              ))}
            </div>
          </form>
          <div aria-busy={bezig}>{resultaten}</div>
        </Kaart>

        <Kaart titel="Chat">
          <p className="muted klein-tekst">Stel een vraag in gewone taal; de AI doorzoekt de database{metInternet ? " en internet" : ""} en vermeldt bij elk antwoord de bronnen. Elke vraag telt als AI-bewerking.</p>
          <ChatPaneel aiActief={aiActief} metInternet={metInternet && internetMogelijk} />
        </Kaart>
      </div>
    </>
  );
}
