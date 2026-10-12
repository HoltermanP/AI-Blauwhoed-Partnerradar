"use client";
// US-08: werklijst met waarden die een gebruiker heeft geverifieerd en die volgens de goudstandaard nog een tweede controle
// door een beheerder vragen. Per stuk of in bulk valideren (label 'beheerdersgeverifieerd'), of afwijzen met reden.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { valideerAlsBeheerder } from "@/lib/acties/waarden";
import type { ValidatieItem } from "@/lib/domain/datakwaliteit";
import { ROL_LABEL, datum } from "@/lib/format";
import { BetrouwbaarheidBadge, BronLabel, Melding } from "@/components/ui";
import WaardeAfwijzen from "@/components/partners/WaardeAfwijzen";

const sleutel = (x: ValidatieItem) => `${x.partnerId}|${x.basisveld ?? x.factorId}|${x.optieId ?? ""}`;

export default function ValidatieWerklijst({ items, magValideren }: { items: ValidatieItem[]; magValideren: boolean }) {
  const router = useRouter();
  const [selectie, setSelectie] = useState<string[]>([]);
  const [melding, setMelding] = useState<{ soort: "succes" | "fout"; tekst: string } | null>(null);
  const [bezig, start] = useTransition();
  const valideer = (lijst: ValidatieItem[]) =>
    start(async () => {
      setMelding(null);
      const r = await valideerAlsBeheerder(lijst.map((x) => ({ partnerId: x.partnerId, factorId: x.factorId, optieId: x.optieId, basisveld: x.basisveld })));
      if (!r.ok) return setMelding({ soort: "fout", tekst: r.fout });
      setMelding({ soort: "succes", tekst: `${r.data ?? 0} waarde(n) beheerdersgeverifieerd.` });
      setSelectie([]);
      router.refresh();
    });
  return (
    <div>
      {melding ? <Melding soort={melding.soort}>{melding.tekst}</Melding> : null}
      {magValideren ? (
        <div className="formulierActies bulkBalk">
          <span className="muted klein-tekst">{selectie.length} geselecteerd</span>
          <button type="button" className="knop klein" disabled={bezig || !selectie.length} onClick={() => valideer(items.filter((x) => selectie.includes(sleutel(x))))}>
            Geselecteerde valideren
          </button>
        </div>
      ) : null}
      <div className="tabelWrap">
        <table className="tabel">
          <thead>
            <tr>
              {magValideren ? (
                <th>
                  <input type="checkbox" aria-label="Alles selecteren" checked={selectie.length === items.length && items.length > 0} onChange={(e) => setSelectie(e.target.checked ? items.map(sleutel) : [])} />
                </th>
              ) : null}
              <th>Partner</th>
              <th>Veld</th>
              <th>Waarde</th>
              <th>Bron</th>
              <th>Gebruikersgeverifieerd door</th>
              {magValideren ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {items.map((x) => (
              <tr key={sleutel(x)}>
                {magValideren ? (
                  <td>
                    <input type="checkbox" aria-label={`Selecteer ${x.veld}`} checked={selectie.includes(sleutel(x))} onChange={(e) => setSelectie((s) => (e.target.checked ? [...s, sleutel(x)] : s.filter((y) => y !== sleutel(x))))} />
                  </td>
                ) : null}
                <td>
                  <Link href={`/partners/${x.partnerId}?tab=${x.factorId ? "factoren" : "profiel"}`}>{x.partnerNaam}</Link>
                  <div className="muted klein-tekst">{x.rollen.map((r) => ROL_LABEL[r]).join(", ")}</div>
                </td>
                <td>{x.veld}</td>
                <td>
                  <b>{x.waarde}</b>
                </td>
                <td className="klein-tekst">
                  <BronLabel bron={x.bron} /> <BetrouwbaarheidBadge waarde={x.betrouwbaarheid} />
                  {x.bronDetail && /^https?:/.test(x.bronDetail) ? (
                    <div>
                      <a href={x.bronDetail} target="_blank" rel="noreferrer">
                        {x.bronDetail.replace(/^https?:\/\/(www\.)?/, "").slice(0, 50)}
                      </a>
                    </div>
                  ) : null}
                </td>
                <td className="klein-tekst">
                  {x.door ?? "–"}
                  {x.op ? `, ${datum(x.op)}` : ""}
                </td>
                {magValideren ? (
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button type="button" className="knop klein" disabled={bezig} onClick={() => valideer([x])}>
                      Valideren
                    </button>{" "}
                    <WaardeAfwijzen waarde={{ partnerId: x.partnerId, factorId: x.factorId, optieId: x.optieId, basisveld: x.basisveld }} />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
