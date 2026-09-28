"use client";
// US-64/65: rollen toekennen, blokkeren en vooraf aanmelden.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { meldGebruikerAan, zetGebruikerActief, zetGebruikersrol } from "@/lib/acties/gebruikers";
import type { Gebruiker, Gebruikersrol } from "@/lib/domain/types";
import { Badge, Melding } from "@/components/ui";

export default function GebruikersBeheer({ gebruikers, mag, eigenId }: { gebruikers: Gebruiker[]; mag: boolean; eigenId: string }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [naam, setNaam] = useState("");
  const [rol, setRol] = useState<Gebruikersrol>("gebruiker");
  const doe = (fn: () => Promise<{ ok: true } | { ok: false; fout: string }>, na?: () => void) => {
    setFout(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) return setFout(r.fout);
      na?.();
      router.refresh();
    });
  };
  return (
    <div className="formulier">
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      {gebruikers.length ? (
        <div className="tabelWrap">
          <table className="tabel">
            <thead>
              <tr>
                <th>Naam</th>
                <th>E-mail</th>
                <th>Rol</th>
                <th>Status</th>
                <th>Laatste inlog</th>
              </tr>
            </thead>
            <tbody>
              {gebruikers.map((g) => (
                <tr key={g.id}>
                  <td>
                    {g.naam} {g.id === eigenId ? <Badge kleur="blauw">u</Badge> : null}
                  </td>
                  <td>{g.email ?? "–"}</td>
                  <td>
                    <select value={g.rol} disabled={!mag || bezig} onChange={(e) => doe(() => zetGebruikersrol(g.id, e.target.value as Gebruikersrol))} aria-label={`Rol van ${g.naam}`}>
                      <option value="gebruiker">Gebruiker</option>
                      <option value="beheerder">Beheerder</option>
                    </select>
                  </td>
                  <td>
                    {g.actief === false ? <Badge kleur="rood">geblokkeerd</Badge> : <Badge kleur="groen">actief</Badge>}{" "}
                    {mag && g.id !== eigenId ? (
                      <button type="button" className="knop knop-tekst klein" disabled={bezig} onClick={() => doe(() => zetGebruikerActief(g.id, g.actief === false))}>
                        {g.actief === false ? "Activeren" : "Blokkeren"}
                      </button>
                    ) : null}
                  </td>
                  <td>{g.laatstIngelogdOp ? new Date(g.laatstIngelogdOp).toLocaleString("nl-NL") : "nog niet"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">Nog geen gebruikers. Accounts ontstaan bij de eerste inlog of door ze hieronder vooraf aan te melden.</p>
      )}
      {mag ? (
        <>
          <h3>Medewerker vooraf aanmelden</h3>
          <div className="rij">
            <label>
              E-mail
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="naam@blauwhoed.nl" />
            </label>
            <label>
              Naam
              <input value={naam} onChange={(e) => setNaam(e.target.value)} />
            </label>
            <label>
              Rol
              <select value={rol} onChange={(e) => setRol(e.target.value as Gebruikersrol)}>
                <option value="gebruiker">Gebruiker</option>
                <option value="beheerder">Beheerder</option>
              </select>
            </label>
          </div>
          <div className="formulierActies">
            <button type="button" className="knop klein" disabled={bezig || !email} onClick={() => doe(() => meldGebruikerAan(email, naam, rol), () => { setEmail(""); setNaam(""); })}>
              Aanmelden
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
