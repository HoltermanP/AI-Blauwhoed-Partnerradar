"use client";
// Partnerregistratie door AI: naam, website en/of tekst → partner met status 'concept', vrij te geven door een beheerder.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { registreerPartnerViaAI } from "@/lib/actions";
import { Melding } from "@/components/ui";

export default function AIRegistratie({ aiActief, externeBronnen }: { aiActief: boolean; externeBronnen: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const [naam, setNaam] = useState("");
  const [website, setWebsite] = useState("");
  const [tekst, setTekst] = useState("");

  function verzend(e: React.FormEvent) {
    e.preventDefault();
    setFout(null);
    start(async () => {
      const r = await registreerPartnerViaAI({ naam, website, tekst });
      if (!r.ok) {
        setFout(r.fout);
        return;
      }
      router.push(`/partners/${r.data}`);
      router.refresh();
    });
  }

  const dubbelId = fout?.startsWith("KVK") ? /\(([^)]+)\)\.?$/.exec(fout)?.[1] : undefined;

  return (
    <form className="formulier" onSubmit={verzend}>
      <p className="muted klein-tekst">
        Geef een bedrijfsnaam, website of een stuk tekst (brochure, e-mail, projectblad). {aiActief ? "Claude" : "De regelgebaseerde extractie (geen AI-sleutel ingesteld)"} vult de basisgegevens met herkomst per veld. De partner wordt een <b>concept</b> (voorstel, geen vastgesteld gegeven) en telt pas mee in zoeken en matching nadat een beheerder hem heeft vrijgegeven in de vrijgavewachtrij.
      </p>
      {!externeBronnen ? <Melding soort="info">Externe bronnen staan uit: de website wordt niet gelezen, alleen de geplakte tekst.</Melding> : null}
      {fout ? (
        <Melding soort="fout">
          {fout} {dubbelId ? <Link href={`/partners/${dubbelId}`}>Open bestaande partner</Link> : null}
        </Melding>
      ) : null}
      <div className="rij">
        <label>
          Bedrijfsnaam
          <input value={naam} onChange={(e) => setNaam(e.target.value)} placeholder="Bijv. Bouwbedrijf Van der Linden" />
        </label>
        <label>
          Website
          <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="www.voorbeeld.nl" />
        </label>
      </div>
      <label>
        Tekst over de partner (optioneel)
        <textarea value={tekst} onChange={(e) => setTekst(e.target.value)} rows={5} placeholder="Plak hier openbare informatie. Geen persoonsgegevens: contactpersonen legt u na vrijgave vast in het dossier." />
      </label>
      <div className="formulierActies">
        <button type="submit" className="knop" disabled={bezig}>
          {bezig ? "Bezig met registreren… (tot een halve minuut)" : "Laat AI registreren"}
        </button>
      </div>
    </form>
  );
}
