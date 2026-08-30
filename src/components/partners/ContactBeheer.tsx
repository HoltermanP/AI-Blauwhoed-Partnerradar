"use client";
// US-47: contactpersonen met AVG-grondslag, bewaartermijn en verwijderfunctie.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { slaContactpersoonOp, verwijderContactpersoon } from "@/lib/actions";
import type { Contactpersoon } from "@/lib/domain/types";
import { datum } from "@/lib/format";
import { Badge, Melding } from "@/components/ui";

type Grondslag = Contactpersoon["grondslag"];
const GRONDSLAGEN: Grondslag[] = ["overeenkomst", "gerechtvaardigd belang", "toestemming"];

export function verwijderdatum(cp: Contactpersoon) {
  const d = new Date(cp.vastgelegdOp);
  d.setMonth(d.getMonth() + cp.bewaartermijnMaanden);
  return d;
}

export default function ContactBeheer({ partnerId, contactpersonen, magBewerken }: { partnerId: string; contactpersonen: Contactpersoon[]; magBewerken: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const [toon, setToon] = useState(false);
  const [naam, setNaam] = useState("");
  const [functie, setFunctie] = useState("");
  const [email, setEmail] = useState("");
  const [telefoon, setTelefoon] = useState("");
  const [grondslag, setGrondslag] = useState<Grondslag>("overeenkomst");
  const [maanden, setMaanden] = useState(24);
  const nu = new Date();

  function verzend(e: React.FormEvent) {
    e.preventDefault();
    setFout(null);
    start(async () => {
      const r = await slaContactpersoonOp(partnerId, { naam: naam.trim(), functie: functie.trim(), email: email.trim() || undefined, telefoon: telefoon.trim() || undefined, grondslag, bewaartermijnMaanden: maanden });
      if (!r.ok) setFout(r.fout);
      else {
        setToon(false);
        setNaam("");
        setFunctie("");
        setEmail("");
        setTelefoon("");
        router.refresh();
      }
    });
  }

  function verwijder(cp: Contactpersoon) {
    if (!confirm(`${cp.naam} verwijderen? Dit wordt gelogd als AVG-verwijdering.`)) return;
    start(async () => {
      const r = await verwijderContactpersoon(partnerId, cp.id);
      if (!r.ok) setFout(r.fout);
      else router.refresh();
    });
  }

  return (
    <div>
      <Melding soort="info">
        AVG: alleen zakelijke contactpersonen, met een vastgelegde grondslag en bewaartermijn. Na de verwijderdatum hoort de persoon verwijderd te worden; de verwijdering wordt gelogd. Geen persoonsgegevens in factorwaarden of vrije tekst.
      </Melding>
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      {contactpersonen.length ? (
        <div className="tabelWrap">
          <table className="tabel">
            <thead>
              <tr>
                <th>Naam</th>
                <th>Functie</th>
                <th>E-mail</th>
                <th>Telefoon</th>
                <th>Grondslag</th>
                <th>Vastgelegd</th>
                <th className="num">Bewaartermijn</th>
                <th>Verwijderdatum</th>
                {magBewerken ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {contactpersonen.map((cp) => {
                const vd = verwijderdatum(cp);
                const verstreken = vd < nu;
                return (
                  <tr key={cp.id} className={verstreken ? "cert-rood" : ""}>
                    <td>
                      <b>{cp.naam}</b>
                    </td>
                    <td>{cp.functie}</td>
                    <td>{cp.email ?? "–"}</td>
                    <td>{cp.telefoon ?? "–"}</td>
                    <td>{cp.grondslag}</td>
                    <td>{datum(cp.vastgelegdOp)}</td>
                    <td className="num">{cp.bewaartermijnMaanden} mnd</td>
                    <td>
                      {datum(vd.toISOString())} {verstreken ? <Badge kleur="rood">verstreken</Badge> : null}
                    </td>
                    {magBewerken ? (
                      <td>
                        <button type="button" className="knop knop-tekst klein" onClick={() => verwijder(cp)} disabled={bezig}>
                          Verwijderen
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">Geen contactpersonen vastgelegd.</p>
      )}
      {magBewerken && !toon ? (
        <div className="formulierActies" style={{ marginTop: 14 }}>
          <button type="button" className="knop klein" onClick={() => setToon(true)}>
            Contactpersoon toevoegen
          </button>
        </div>
      ) : null}
      {toon ? (
        <form className="formulier inlineFormulier" onSubmit={verzend} style={{ marginTop: 14 }}>
          <div className="rij">
            <label>
              Naam
              <input required value={naam} onChange={(e) => setNaam(e.target.value)} />
            </label>
            <label>
              Functie
              <input required value={functie} onChange={(e) => setFunctie(e.target.value)} />
            </label>
            <label>
              Zakelijk e-mailadres
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label>
              Telefoon
              <input value={telefoon} onChange={(e) => setTelefoon(e.target.value)} />
            </label>
            <label>
              Grondslag (AVG)
              <select value={grondslag} onChange={(e) => setGrondslag(e.target.value as Grondslag)}>
                {GRONDSLAGEN.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Bewaartermijn (maanden)
              <input type="number" min={1} max={120} required value={maanden} onChange={(e) => setMaanden(Number(e.target.value))} />
            </label>
          </div>
          <div className="formulierActies">
            <button type="submit" className="knop klein" disabled={bezig}>
              {bezig ? "Opslaan…" : "Opslaan"}
            </button>
            <button type="button" className="knop knop-secundair klein" onClick={() => setToon(false)}>
              Annuleren
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
