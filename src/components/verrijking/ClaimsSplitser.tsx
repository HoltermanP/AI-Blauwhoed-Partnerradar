"use client";
// US-30: duurzaamheidsclaims scheiden in aantoonbaar en geclaimd (pure functie, draait in de browser).
import { useState } from "react";
import { splitsClaims } from "@/lib/domain/enrichment";
import { Badge } from "@/components/ui";

const VOORBEELD =
  "Wij zijn het duurzaamste bouwbedrijf van Nederland. Ons project Houtwijk is opgeleverd met een MPG van 0,48 volgens NMD-berekening. Al onze woningen zijn circulair en klimaatneutraal. Wij zijn gecertificeerd op CO2-prestatieladder niveau 5.";

export default function ClaimsSplitser() {
  const [tekst, setTekst] = useState("");
  const res = tekst.trim() ? splitsClaims(tekst) : null;
  return (
    <div className="formulier">
      <label>
        Tekst met duurzaamheidsclaims
        <textarea value={tekst} onChange={(e) => setTekst(e.target.value)} placeholder="Plak marketing- of websitetekst…" />
      </label>
      <div className="formulierActies">
        <button type="button" className="knop knop-tekst klein" onClick={() => setTekst(VOORBEELD)}>
          Voorbeeldtekst invullen
        </button>
      </div>
      {res ? (
        <div className="raster raster-2 claimsKolommen">
          <div>
            <h4>
              <Badge kleur="groen">aantoonbaar</Badge> {res.aantoonbaar.length}
            </h4>
            {res.aantoonbaar.length ? (
              <ul className="lijst">
                {res.aantoonbaar.map((z) => (
                  <li key={z}>{z}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">Geen aantoonbare claims (certificaat, meting, berekening).</p>
            )}
          </div>
          <div>
            <h4>
              <Badge kleur="geel">geclaimd</Badge> {res.geclaimd.length}
            </h4>
            {res.geclaimd.length ? (
              <ul className="lijst">
                {res.geclaimd.map((z) => (
                  <li key={z}>{z}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">Geen onbewezen claims.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
