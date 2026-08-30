"use client";
// US-32 / US-33 / US-34: kwalificatiechecklist, financiële kerncijfers, risicoklasse en afhankelijkheid.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { slaFinancieelOp, vinkKwalificatieAf } from "@/lib/actions";
import { KWALIFICATIE_ITEMS, type Financieel, type Kwalificatie, type KwalificatieItem } from "@/lib/domain/types";
import { datum } from "@/lib/format";
import { Badge, Melding } from "@/components/ui";

export function KwalificatieChecklist({ partnerId, kwalificatie, magKwalificeren }: { partnerId: string; kwalificatie: Kwalificatie[]; magKwalificeren: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const [toelichting, setToelichting] = useState<Record<string, string>>({});

  function vink(item: KwalificatieItem, afgevinkt: boolean) {
    setFout(null);
    start(async () => {
      const r = await vinkKwalificatieAf(partnerId, item, afgevinkt, toelichting[item]?.trim() || undefined);
      if (!r.ok) setFout(r.fout);
      else router.refresh();
    });
  }

  const klaar = KWALIFICATIE_ITEMS.filter((k) => kwalificatie.find((q) => q.item === k.id && q.afgevinkt)).length;

  return (
    <div>
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      <p>
        <b>
          {klaar} van {KWALIFICATIE_ITEMS.length}
        </b>{" "}
        onderdelen afgevinkt.{" "}
        {klaar === KWALIFICATIE_ITEMS.length ? <Badge kleur="groen">Kwalificatie volledig</Badge> : <Badge kleur="geel">Preferred nog niet mogelijk</Badge>}
      </p>
      <div className="tabelWrap">
        <table className="tabel">
          <thead>
            <tr>
              <th />
              <th>Onderdeel</th>
              <th>Door</th>
              <th>Op</th>
              <th>Toelichting</th>
            </tr>
          </thead>
          <tbody>
            {KWALIFICATIE_ITEMS.map((k) => {
              const q = kwalificatie.find((x) => x.item === k.id);
              return (
                <tr key={k.id}>
                  <td>
                    <input type="checkbox" checked={!!q?.afgevinkt} disabled={!magKwalificeren || bezig} onChange={(e) => vink(k.id, e.target.checked)} aria-label={k.label} />
                  </td>
                  <td>{k.label}</td>
                  <td>{q?.door ?? <span className="muted">–</span>}</td>
                  <td>{q?.op ? datum(q.op) : <span className="muted">–</span>}</td>
                  <td>
                    {magKwalificeren ? (
                      <input className="inlineInvoer" placeholder={q?.toelichting ?? "Toelichting (optioneel, bij afvinken)"} value={toelichting[k.id] ?? ""} onChange={(e) => setToelichting({ ...toelichting, [k.id]: e.target.value })} />
                    ) : (
                      q?.toelichting ?? ""
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!magKwalificeren ? <p className="muted klein-tekst">Kwalificeren vereist de rol inkoper of beheerder.</p> : null}
    </div>
  );
}

export function FinancieelFormulier({ partnerId, financieel, magKwalificeren }: { partnerId: string; financieel?: Financieel; magKwalificeren: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);
  const [boekjaar, setBoekjaar] = useState(financieel?.boekjaar?.toString() ?? String(new Date().getFullYear() - 1));
  const [omzet, setOmzet] = useState(financieel?.omzet?.toString() ?? "");
  const [omzetVorig, setOmzetVorig] = useState(financieel?.omzetVorigJaar?.toString() ?? "");
  const [ev, setEv] = useState(financieel?.eigenVermogen?.toString() ?? "");
  const [solv, setSolv] = useState(financieel?.solvabiliteit?.toString() ?? "");
  const [deponering, setDeponering] = useState(financieel?.laatsteDeponering ?? "");
  const [betaling, setBetaling] = useState<Financieel["betalingsgedrag"] | "">(financieel?.betalingsgedrag ?? "");
  const [toelichting, setToelichting] = useState(financieel?.toelichting ?? "");

  const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

  function verzend(e: React.FormEvent) {
    e.preventDefault();
    setFout(null);
    setSucces(false);
    start(async () => {
      const r = await slaFinancieelOp(partnerId, {
        boekjaar: Number(boekjaar),
        omzet: Number(omzet),
        omzetVorigJaar: num(omzetVorig),
        eigenVermogen: num(ev),
        solvabiliteit: num(solv),
        laatsteDeponering: deponering || undefined,
        betalingsgedrag: betaling || undefined,
        toelichting: toelichting.trim() || undefined
      });
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
      {succes ? <Melding soort="succes">Kerncijfers opgeslagen; risicoklasse opnieuw berekend.</Melding> : null}
      <fieldset disabled={!magKwalificeren} style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 14 }}>
        <div className="rij">
          <label>
            Boekjaar
            <input type="number" required value={boekjaar} onChange={(e) => setBoekjaar(e.target.value)} />
          </label>
          <label>
            Omzet (€)
            <input type="number" required min={0} value={omzet} onChange={(e) => setOmzet(e.target.value)} />
          </label>
          <label>
            Omzet vorig jaar (€)
            <input type="number" min={0} value={omzetVorig} onChange={(e) => setOmzetVorig(e.target.value)} />
          </label>
          <label>
            Eigen vermogen (€)
            <input type="number" value={ev} onChange={(e) => setEv(e.target.value)} />
          </label>
          <label>
            Solvabiliteit (%)
            <input type="number" min={-100} max={100} step="0.1" value={solv} onChange={(e) => setSolv(e.target.value)} />
          </label>
          <label>
            Laatste deponering
            <input type="date" value={deponering} onChange={(e) => setDeponering(e.target.value)} />
          </label>
          <label>
            Betalingsgedrag
            <select value={betaling} onChange={(e) => setBetaling(e.target.value as Financieel["betalingsgedrag"] | "")}>
              <option value="">– onbekend –</option>
              <option value="goed">Goed</option>
              <option value="matig">Matig</option>
              <option value="slecht">Slecht</option>
            </select>
          </label>
        </div>
        <label>
          Toelichting
          <textarea value={toelichting} onChange={(e) => setToelichting(e.target.value)} />
        </label>
      </fieldset>
      <div className="formulierActies">
        <button type="submit" className="knop klein" disabled={bezig || !magKwalificeren}>
          {bezig ? "Opslaan…" : "Kerncijfers opslaan"}
        </button>
        {!magKwalificeren ? <span className="muted klein-tekst">Alleen inkoper/beheerder mag kerncijfers vastleggen.</span> : null}
      </div>
    </form>
  );
}
