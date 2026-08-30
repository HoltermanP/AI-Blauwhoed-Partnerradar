"use client";
// Beschikbaarheid per periode (voedt factor E2 en de capaciteitscheck in de matching).
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { slaBeschikbaarheidOp } from "@/lib/actions";
import type { Beschikbaarheid } from "@/lib/domain/types";
import { Melding } from "@/components/ui";

export default function CapaciteitBeheer({ partnerId, beschikbaarheid, magBewerken }: { partnerId: string; beschikbaarheid: Beschikbaarheid[]; magBewerken: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);
  const [items, setItems] = useState<Beschikbaarheid[]>(beschikbaarheid);

  const zet = (i: number, patch: Partial<Beschikbaarheid>) => setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  function verzend(e: React.FormEvent) {
    e.preventDefault();
    setFout(null);
    setSucces(false);
    for (const it of items) {
      if (!it.van || !it.tot) {
        setFout("Elke periode heeft een begin- en einddatum nodig.");
        return;
      }
      if (it.tot < it.van) {
        setFout("Einddatum ligt vóór begindatum.");
        return;
      }
    }
    start(async () => {
      const r = await slaBeschikbaarheidOp(partnerId, items.map((it) => ({ ...it, toelichting: it.toelichting?.trim() || undefined })));
      if (!r.ok) setFout(r.fout);
      else {
        setSucces(true);
        router.refresh();
      }
    });
  }

  return (
    <form className="formulier" onSubmit={verzend}>
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      {succes ? <Melding soort="succes">Beschikbaarheid opgeslagen.</Melding> : null}
      {items.length === 0 ? <p className="muted">Geen periodes vastgelegd. Zonder periodes geldt de partner als beschikbaar (met lage betrouwbaarheid).</p> : null}
      {items.map((it, i) => (
        <div key={i} className="rij periodeRij">
          <label>
            Van
            <input type="date" value={it.van} disabled={!magBewerken} onChange={(e) => zet(i, { van: e.target.value })} />
          </label>
          <label>
            Tot
            <input type="date" value={it.tot} disabled={!magBewerken} onChange={(e) => zet(i, { tot: e.target.value })} />
          </label>
          <label>
            Beschikbaar
            <select value={it.beschikbaar ? "ja" : "nee"} disabled={!magBewerken} onChange={(e) => zet(i, { beschikbaar: e.target.value === "ja" })}>
              <option value="ja">Ja</option>
              <option value="nee">Nee</option>
            </select>
          </label>
          <label>
            Toelichting
            <input value={it.toelichting ?? ""} disabled={!magBewerken} onChange={(e) => zet(i, { toelichting: e.target.value })} />
          </label>
          {magBewerken ? (
            <div className="veld">
              &nbsp;
              <button type="button" className="knop knop-secundair klein" onClick={() => setItems(items.filter((_, j) => j !== i))}>
                Verwijderen
              </button>
            </div>
          ) : null}
        </div>
      ))}
      {magBewerken ? (
        <div className="formulierActies">
          <button type="button" className="knop knop-secundair klein" onClick={() => setItems([...items, { van: "", tot: "", beschikbaar: true }])}>
            Periode toevoegen
          </button>
          <button type="submit" className="knop klein" disabled={bezig}>
            {bezig ? "Opslaan…" : "Beschikbaarheid opslaan"}
          </button>
        </div>
      ) : (
        <p className="muted klein-tekst">Uw rol mag de beschikbaarheid niet bewerken.</p>
      )}
    </form>
  );
}
