"use client";
// US-29/US-31: verrijkingsronde starten (alle partners via internet, of één partner met geplakte openbare tekst).
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { startRonde, startVerrijking } from "@/lib/actions";
import type { RondeSchatting } from "@/lib/domain/kosten";
import type { VerrijkingsSchema } from "@/lib/domain/types";
import { Melding } from "@/components/ui";

export type SchattingPerOmvang = Record<VerrijkingsSchema["omvang"], RondeSchatting>;

const OMVANGEN: Array<{ id: VerrijkingsSchema["omvang"]; label: string }> = [
  { id: "alles", label: "Hele bestand" },
  { id: "gewijzigde_website", label: "Alleen gewijzigde websites" },
  { id: "niet_verrijkt_sinds", label: "Langer dan X maanden niet verrijkt (zie schema)" },
  { id: "partnertype", label: "Partnertypen uit het schema" }
];

const euro = (n: number) => `€ ${n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function VerrijkingStart({ partners, magBewerken, externeBronnen, schattingen, budgetOverschreden, openRonde }: { partners: Array<{ id: string; naam: string }>; magBewerken: boolean; externeBronnen: boolean; schattingen: SchattingPerOmvang; budgetOverschreden: boolean; openRonde: string | null }) {
  const [omvang, setOmvang] = useState<VerrijkingsSchema["omvang"]>("alles");
  const schatting = schattingen[omvang];
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
      const r = id ? await startVerrijking(id, t) : await startRonde(omvang);
      if (!r.ok) return setFout(r.fout);
      const u = r.data!;
      setSucces(`${u.partners} partner(s) geraadpleegd (${u.overgeslagen} ongewijzigd overgeslagen), ${u.voorstellen} voorstel(len) gevonden waarvan ${u.nieuw} nieuw in de wachtrij${u.websitesGevonden ? `; ${u.websitesGevonden} website(s) gevonden` : ""}${u.nogTeGaan ? `. Nog ${u.nogTeGaan} partner(s) te gaan in deze ronde — klik opnieuw om te hervatten.` : ". Ronde afgerond; bekijk het verschillenoverzicht hieronder."}`);
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
      {openRonde ? (
        <p className="klein-tekst">Er loopt een ronde ({openRonde}); de knop hervat die ronde met de volgende 20 partners.</p>
      ) : (
        <label>
          Omvang van de ronde
          <select value={omvang} onChange={(e) => setOmvang(e.target.value as VerrijkingsSchema["omvang"])}>
            {OMVANGEN.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label} ({schattingen[o.id].partners} partners)
              </option>
            ))}
          </select>
        </label>
      )}
      {/* US-57: verwachte AI-bewerkingen en het effect op het maandbudget, vóór de start. */}
      <div className="schatting">
        <p>
          Verwacht: <b>{schatting.bewerkingen} AI-bewerking(en)</b> voor {schatting.partners} partner(s)
          {schatting.aiActief ? (
            <>
              {" "}
              — {schatting.overgeslagen} naar verwachting ongewijzigd en overgeslagen; geschat <b>{euro(schatting.geschatteKostenEur)}</b>.
            </>
          ) : (
            " — AI staat uit: alleen regelextractie, geen bewerkingen."
          )}
        </p>
        <p className="muted klein-tekst">
          Maandbudget: {schatting.verbruiktDezeMaand} van {schatting.budgetBewerkingen} bewerkingen gebruikt. Resterend na deze ronde: <b className={schatting.overschrijdtBudget ? "tekst-rood" : ""}>{schatting.resterendNa} bewerkingen</b> ({Math.round(schatting.pctNa)}% van het budget); tokenbudget daarna € {schatting.resterendEurNa.toFixed(2)}.
        </p>
      </div>
      {budgetOverschreden ? <Melding soort="waarschuwing">AI-maandbudget bereikt: rondes zijn gepauzeerd. Eén partner verrijken kan nog.</Melding> : schatting.overschrijdtBudget ? <Melding soort="waarschuwing">Deze ronde zou het maandbudget overschrijden. Een geplande ronde start in dat geval niet automatisch; handmatig starten verwerkt 20 partners per klik.</Melding> : null}
      <div className="formulierActies">
        <button type="button" className="knop" disabled={bezig || !magBewerken || budgetOverschreden || (!openRonde && !schatting.partners)} onClick={() => draai()}>
          {bezig ? "Bezig…" : openRonde ? "Ronde hervatten (volgende 20)" : "Ronde starten (per 20 partners)"}
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
