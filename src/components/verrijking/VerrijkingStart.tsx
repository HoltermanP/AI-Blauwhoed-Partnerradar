"use client";
// US-29/US-31: verrijkingsronde starten (alle partners via internet, of één partner met geplakte openbare tekst).
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { startVerrijking } from "@/lib/actions";
import { Melding } from "@/components/ui";

export type RondeSchatting = { batch: number; batchUsd: number; totaal: number; totaalUsd: number; aiActief: boolean; budgetOverschreden: boolean };

export default function VerrijkingStart({ partners, magBewerken, externeBronnen, schatting }: { partners: Array<{ id: string; naam: string }>; magBewerken: boolean; externeBronnen: boolean; schatting: RondeSchatting }) {
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
      const u = r.data!;
      setSucces(`${u.partners} partner(s) geraadpleegd, ${u.voorstellen} voorstel(len) gevonden waarvan ${u.nieuw} nieuw in de wachtrij${u.websitesGevonden ? `; ${u.websitesGevonden} website(s) gevonden` : ""}${u.nogTeGaan ? `. Nog ${u.nogTeGaan} partner(s) te gaan — start de ronde opnieuw.` : "."}`);
      router.refresh();
    });
  };

  return (
    <div className="formulier">
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      {succes ? <Melding soort="succes">{succes}</Melding> : null}
      <p className="muted klein-tekst">
        {externeBronnen
          ? "Per ronde worden maximaal 20 partners via internet verrijkt (minst recent geraadpleegde eerst): website opzoeken als die ontbreekt, home/over ons/projecten/duurzaamheid lezen, en voorstellen doen voor website, KVK, plaats, omschrijving, referenties en factorwaarden."
          : "Externe bronnen staan uit: alleen de vastgelegde profieltekst of geplakte tekst wordt gebruikt."}
      </p>
      <p className="muted klein-tekst">
        Verwacht voor de volgende ronde: <b>{schatting.batch} AI-bewerking(en)</b>{schatting.aiActief ? <>, geschat <b>${schatting.batchUsd.toFixed(2)}</b></> : " (AI staat uit: alleen regelextractie, geen kosten)"}. Heel het bestand: {schatting.totaal} bewerkingen{schatting.aiActief ? ` (≈ $${schatting.totaalUsd.toFixed(2)})` : ""}.
      </p>
      {schatting.budgetOverschreden ? <Melding soort="waarschuwing">AI-maandbudget overschreden: rondes over het hele bestand zijn gepauzeerd. Eén partner verrijken kan nog.</Melding> : null}
      <div className="formulierActies">
        <button type="button" className="knop" disabled={bezig || !magBewerken || schatting.budgetOverschreden} onClick={() => draai()}>
          {bezig ? "Bezig…" : externeBronnen ? "Volgende 20 partners verrijken via internet" : "Alle partners verrijken"}
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
        <textarea value={tekst} onChange={(e) => setTekst(e.target.value)} placeholder="Plak hier openbare bedrijfsinformatie. Zonder tekst wordt de website via internet gelezen (als externe bronnen aan staan), anders de profieltekst." />
      </label>
      <div className="formulierActies">
        <button type="button" className="knop knop-secundair" disabled={bezig || !magBewerken || !partnerId} onClick={() => draai(partnerId, tekst.trim() || undefined)}>
          {bezig ? "Bezig…" : "Partner verrijken"}
        </button>
      </div>
    </div>
  );
}
