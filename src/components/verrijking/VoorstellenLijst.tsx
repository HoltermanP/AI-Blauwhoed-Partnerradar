"use client";
// US-07: verrijkingsvoorstellen per stuk accepteren, aanpassen of afwijzen, of meerdere tegelijk afhandelen. Elk voorstel
// heeft een bron en een onderbouwing (citaat); zonder bron komt er geen voorstel. Accepteren = gebruikersgeverifieerd.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { beoordeelVoorstel, beoordeelVoorstellen } from "@/lib/actions";
import type { EnrichmentVoorstel, Factor, FactorWaarde } from "@/lib/domain/types";
import { datumTijd, waardeTekst } from "@/lib/format";
import { Badge, Melding } from "@/components/ui";
import { FactorWaardeVeld } from "@/components/partners/FactorWaardeVeld";
import { VoorstelBetrouwbaarheid, VoorstelBron, VoorstelSoort } from "./VoorstelKenmerken";

type Props = {
  voorstellen: EnrichmentVoorstel[];
  partnerNamen?: Record<string, string>;
  factoren: Factor[];
  magBewerken: boolean;
  open: boolean;
};

function Aanpassen({ v, factor, onKlaar }: { v: EnrichmentVoorstel; factor?: Factor; onKlaar: () => void }) {
  const router = useRouter();
  const [waarde, setWaarde] = useState<FactorWaarde>(v.voorgesteld);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, start] = useTransition();
  return (
    <div className="inlineFormulier formulier">
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      <div className="veld">
        Aangepaste waarde
        {factor ? <FactorWaardeVeld factor={factor} waarde={waarde} onChange={setWaarde} /> : <input value={String(waarde ?? "")} onChange={(e) => setWaarde(e.target.value)} />}
      </div>
      <div className="formulierActies">
        <button
          type="button"
          className="knop klein"
          disabled={bezig}
          onClick={() =>
            start(async () => {
              const r = await beoordeelVoorstel(v.id, true, waarde);
              if (!r.ok) return setFout(r.fout);
              onKlaar();
              router.refresh();
            })
          }
        >
          Aangepast accepteren
        </button>
        <button type="button" className="knop knop-tekst klein" onClick={onKlaar}>
          Annuleren
        </button>
      </div>
    </div>
  );
}

export default function VoorstellenLijst({ voorstellen, partnerNamen, factoren, magBewerken, open }: Props) {
  const router = useRouter();
  const [selectie, setSelectie] = useState<string[]>([]);
  const [aanpassen, setAanpassen] = useState<string | null>(null);
  const [melding, setMelding] = useState<{ soort: "succes" | "fout" | "waarschuwing"; tekst: string } | null>(null);
  const [bezig, start] = useTransition();
  const kan = open && magBewerken;
  const factor = (v: EnrichmentVoorstel) => (v.factorId ? factoren.find((f) => f.id === v.factorId) : undefined);

  const beslis = (ids: string[], accepteer: boolean) =>
    start(async () => {
      setMelding(null);
      if (ids.length === 1) {
        const r = await beoordeelVoorstel(ids[0], accepteer);
        if (!r.ok) return setMelding({ soort: "fout", tekst: r.fout });
      } else {
        const r = await beoordeelVoorstellen(ids, accepteer);
        if (!r.ok) return setMelding({ soort: "fout", tekst: r.fout });
        const d = r.data!;
        setMelding({ soort: d.overgeslagen ? "waarschuwing" : "succes", tekst: `${d.gelukt} voorstel(len) ${accepteer ? "geaccepteerd (gebruikersgeverifieerd)" : "afgewezen"}${d.overgeslagen ? `; ${d.overgeslagen} overgeslagen: ${d.redenen.join(" ")}` : "."}` });
      }
      setSelectie([]);
      router.refresh();
    });

  const alle = voorstellen.map((v) => v.id);
  const kolommen = 7 + (partnerNamen ? 1 : 0) + (kan ? 2 : 0);
  return (
    <div>
      {melding ? <Melding soort={melding.soort}>{melding.tekst}</Melding> : null}
      {kan && voorstellen.length > 1 ? (
        <div className="formulierActies bulkBalk">
          <span className="muted klein-tekst">{selectie.length} geselecteerd</span>
          <button type="button" className="knop klein" disabled={bezig || !selectie.length} onClick={() => beslis(selectie, true)}>
            Geselecteerde accepteren
          </button>
          <button type="button" className="knop knop-secundair klein" disabled={bezig || !selectie.length} onClick={() => beslis(selectie, false)}>
            Geselecteerde afwijzen
          </button>
          <span className="muted klein-tekst">Accepteren maakt een waarde gebruikersgeverifieerd; een beheerder valideert kritische velden daarna definitief.</span>
        </div>
      ) : null}
      <div className="tabelWrap">
        <table className="tabel">
          <thead>
            <tr>
              {kan ? (
                <th>
                  <input type="checkbox" aria-label="Alles selecteren" checked={selectie.length === alle.length && alle.length > 0} onChange={(e) => setSelectie(e.target.checked ? alle : [])} />
                </th>
              ) : null}
              {partnerNamen ? <th>Partner</th> : null}
              <th>Veld</th>
              <th>Huidig → voorgesteld</th>
              <th>Soort</th>
              <th className="num">Betrouwb.</th>
              <th>Bron en onderbouwing</th>
              <th>Gevonden</th>
              <th>{open ? "" : "Beoordeeld"}</th>
              {kan ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {voorstellen.map((v) => (
              <FragmentRij key={v.id} kolommen={kolommen} extra={aanpassen === v.id ? <Aanpassen v={v} factor={factor(v)} onKlaar={() => setAanpassen(null)} /> : null}>
                {kan ? (
                  <td>
                    <input type="checkbox" aria-label={`Selecteer ${v.veld}`} checked={selectie.includes(v.id)} onChange={(e) => setSelectie((s) => (e.target.checked ? [...s, v.id] : s.filter((x) => x !== v.id)))} />
                  </td>
                ) : null}
                {partnerNamen ? (
                  <td>
                    <Link href={`/partners/${v.partnerId}`}>{partnerNamen[v.partnerId] ?? v.partnerId}</Link>
                  </td>
                ) : null}
                <td>{v.veld}</td>
                <td>
                  <span className="muted">{waardeTekst(v.huidig)}</span> → <b>{waardeTekst(v.voorgesteld)}</b>
                  {v.aangepasteWaarde !== undefined ? <Badge kleur="grijs">aangepast</Badge> : null}
                </td>
                <td>
                  <VoorstelSoort v={v} />
                </td>
                <td className="num">
                  <VoorstelBetrouwbaarheid v={v} />
                </td>
                <td className="citaatCel">
                  <VoorstelBron v={v} />
                </td>
                <td>{datumTijd(v.gevondenOp)}</td>
                <td className="klein-tekst">{!open && v.beoordeeldDoor ? `${v.beoordeeldDoor}, ${datumTijd(v.beoordeeldOp)}` : null}</td>
                {kan ? (
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button type="button" className="knop klein" disabled={bezig} onClick={() => beslis([v.id], true)}>
                      Accepteren
                    </button>{" "}
                    {v.aard !== "niet_bevestigd" && !v.veld.startsWith("Certificaat:") ? (
                      <button type="button" className="knop knop-secundair klein" disabled={bezig} onClick={() => setAanpassen(aanpassen === v.id ? null : v.id)}>
                        Aanpassen
                      </button>
                    ) : null}{" "}
                    <button type="button" className="knop knop-tekst klein" disabled={bezig} onClick={() => beslis([v.id], false)}>
                      Afwijzen
                    </button>
                  </td>
                ) : null}
              </FragmentRij>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FragmentRij({ children, extra, kolommen }: { children: React.ReactNode; extra: React.ReactNode; kolommen: number }) {
  return (
    <>
      <tr>{children}</tr>
      {extra ? (
        <tr className="inlineFormulierRij">
          <td colSpan={kolommen}>{extra}</td>
        </tr>
      ) : null}
    </>
  );
}
