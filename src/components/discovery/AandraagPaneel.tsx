"use client";
// US-55: laat de applicatie vanuit een zoekprofiel ontbrekende partners aandragen. Uitkomst: concepten in de vrijgavewachtrij.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { draagPartnersAan, type AandraagUitkomst } from "@/lib/acties/aandragen";
import { Disclaimer, Melding } from "@/components/ui";

export default function AandraagPaneel({ profielen, magAandragen, aiActief }: { profielen: Array<{ id: string; naam: string; trefwoorden: string }>; magAandragen: boolean; aiActief: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [keuze, setProfielId] = useState("");
  // Standaard het eerste profiel, ook als dat pas na het opslaan (router.refresh) verschijnt.
  const profielId = profielen.some((p) => p.id === keuze) ? keuze : (profielen[0]?.id ?? "");
  const [fout, setFout] = useState<string | null>(null);
  const [uitkomst, setUitkomst] = useState<AandraagUitkomst | null>(null);
  return (
    <div className="formulier">
      <p className="muted klein-tekst">
        Op basis van een opgeslagen zoekprofiel stelt de applicatie {aiActief ? "met AI" : "(zonder AI-sleutel: met regels)"} gerichte zoekvragen op, zoekt in de eigen uitgaven van Blauwhoed, het KVK-register (als de koppeling actief is), het open web en vakmedia, ontdubbelt tegen het bestand en maakt van nieuwe partijen concepten met onderbouwing, bron-URL en ophaaldatum. Eén aandraagronde telt als één AI-bewerking.
      </p>
      <Disclaimer>Aangedragen partijen zijn voorstellen, geen vastgestelde gegevens. Ze tellen pas mee nadat een beheerder ze in de vrijgavewachtrij heeft vrijgegeven.</Disclaimer>
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      {uitkomst ? (
        <Melding soort="succes">
          {uitkomst.concepten.length} concept(en) aangedragen uit {uitkomst.gevonden} gevonden kandidaat/kandidaten; {uitkomst.ontdubbeld.length} stonden al in het bestand.{" "}
          <Link href="/vrijgave?soort=ai-aandraag">Naar de vrijgavewachtrij</Link>
          <details className="uitklap">
            <summary>Zoekvragen en bronnen</summary>
            <ul className="lijst klein-tekst">
              {uitkomst.zoekvragen.map((z) => (
                <li key={z}>{z}</li>
              ))}
              <li>Bronnen: {uitkomst.bronnen.join(", ")}</li>
              {uitkomst.ontdubbeld.map((d) => (
                <li key={d.naam}>
                  Overgeslagen: {d.naam} — {d.reden}
                </li>
              ))}
            </ul>
          </details>
        </Melding>
      ) : null}
      {profielen.length ? (
        <div className="formulierActies">
          <select value={profielId} onChange={(e) => setProfielId(e.target.value)} aria-label="Zoekprofiel">
            {profielen.map((p) => (
              <option key={p.id} value={p.id}>
                {p.naam}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="knop"
            disabled={!magAandragen || bezig || !profielId}
            onClick={() => {
              setFout(null);
              setUitkomst(null);
              start(async () => {
                const r = await draagPartnersAan(profielId);
                if (!r.ok) return setFout(r.fout);
                setUitkomst(r.data);
                router.refresh();
              });
            }}
          >
            {bezig ? "Bezig met zoeken…" : "Partners laten aandragen"}
          </button>
          {!magAandragen ? <span className="muted klein-tekst">Alleen de beheerder start een aandraagronde.</span> : null}
        </div>
      ) : (
        <p className="muted">Sla eerst een zoekprofiel op (hierboven) om partners te laten aandragen.</p>
      )}
    </div>
  );
}
