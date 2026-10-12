"use client";
// B3/US-12/US-13: bronnenlijst met kwaliteitsrang. Beheer voegt bronnen toe en stelt de rang in; iedere gebruiker kan een
// bron voorstellen (URL, omschrijving, voorgestelde rang). Pas na goedkeuring gebruiken verrijking en discovery de bron.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { beoordeelBronvoorstel, slaVerrijkingsBronOp, stelBronVoor } from "@/lib/actions";
import { BRONRANG_LABEL, rangVanBron, RANG_BETROUWBAARHEID, type BronRang } from "@/lib/domain/bronbeleid";
import type { VerrijkingsBron } from "@/lib/domain/types";
import { Badge, Melding } from "@/components/ui";

const RANG_KLEUR: Record<BronRang, "blauw" | "groen" | "grijs"> = { 1: "blauw", 2: "groen", 3: "grijs" };

function RangKiezer({ waarde, onChange, disabled }: { waarde: BronRang; onChange: (r: BronRang) => void; disabled?: boolean }) {
  return (
    <select value={waarde} disabled={disabled} onChange={(e) => onChange(Number(e.target.value) as BronRang)} aria-label="Rang" style={{ maxWidth: 260 }}>
      {([1, 2, 3] as BronRang[]).map((r) => (
        <option key={r} value={r}>
          {BRONRANG_LABEL[r]}
        </option>
      ))}
    </select>
  );
}

export default function BronnenBeheer({ bronnen, magBeheren, magVoorstellen = true }: { bronnen: VerrijkingsBron[]; magBeheren: boolean; magVoorstellen?: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [melding, setMelding] = useState<{ soort: "fout" | "succes"; tekst: string } | null>(null);
  const [naam, setNaam] = useState("");
  const [url, setUrl] = useState("");
  const [omschrijving, setOmschrijving] = useState("");
  const [rang, setRang] = useState<BronRang>(2);
  const [afwijsReden, setAfwijsReden] = useState<Record<string, string>>({});
  const [goedRang, setGoedRang] = useState<Record<string, BronRang>>({});

  const voer = (fn: () => Promise<{ ok: boolean; fout?: string }>, succes?: string) => {
    setMelding(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) return setMelding({ soort: "fout", tekst: (r as { fout: string }).fout });
      setNaam("");
      setUrl("");
      setOmschrijving("");
      if (succes) setMelding({ soort: "succes", tekst: succes });
      router.refresh();
    });
  };

  const goedgekeurd = bronnen.filter((b) => (b.status ?? "goedgekeurd") === "goedgekeurd");
  const voorstellen = bronnen.filter((b) => b.status === "voorgesteld");
  const afgewezen = bronnen.filter((b) => b.status === "afgewezen");

  return (
    <div className="formulier">
      {melding ? <Melding soort={melding.soort}>{melding.tekst}</Melding> : null}
      <p className="muted klein-tekst">
        Aangewezen bronnen krijgen een kwaliteitsrang. Komt een gevonden waarde van een domein uit deze lijst, dan krijgt ze minimaal de betrouwbaarheid van die rang (rang 1: {Math.round(RANG_BETROUWBAARHEID[1] * 100)}%, rang 2: {Math.round(RANG_BETROUWBAARHEID[2] * 100)}%, gewoon web: {Math.round(RANG_BETROUWBAARHEID[3] * 100)}%); dat telt door in de matching. Een actieve bron wordt bovendien elke ronde gelezen (per partner de tekst rond de bedrijfsnaam). Bronnen voor prijzen en nominaties (label upcoming) gebruikt discovery in de zoekmodus &lsquo;upcoming&rsquo;.
      </p>
      <div className="tabelWrap">
        <table className="tabel">
          <thead>
            <tr>
              <th>Bron</th>
              <th>Rang</th>
              <th>Gelezen per ronde</th>
              <th>Omschrijving</th>
              {magBeheren ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {goedgekeurd.map((b) => (
              <tr key={b.id}>
                <td>
                  <b>{b.naam}</b> {b.upcoming ? <Badge kleur="mint">upcoming</Badge> : null}
                  <div className="klein-tekst">
                    <a href={b.url} target="_blank" rel="noreferrer">
                      {b.url}
                    </a>
                  </div>
                </td>
                <td>{magBeheren ? <RangKiezer waarde={rangVanBron(b)} disabled={bezig} onChange={(r) => voer(() => slaVerrijkingsBronOp({ ...b, rang: r, categorie: r === 1 ? "eigen_uitgave" : r === 2 ? "branche" : "web" }))} /> : <Badge kleur={RANG_KLEUR[rangVanBron(b)]}>{BRONRANG_LABEL[rangVanBron(b)]}</Badge>}</td>
                <td>
                  <label className="vinkjes" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                    <input type="checkbox" checked={b.actief} disabled={!magBeheren || bezig} onChange={(e) => voer(() => slaVerrijkingsBronOp({ ...b, actief: e.target.checked }))} />
                    {b.actief ? "aan" : "uit"}
                  </label>
                </td>
                <td className="klein-tekst">
                  {b.omschrijving ?? <span className="muted">–</span>}
                  {b.voorgesteldDoor ? <div className="muted">voorgesteld door {b.voorgesteldDoor}, goedgekeurd door {b.beoordeeldDoor}</div> : null}
                </td>
                {magBeheren ? (
                  <td>
                    <button type="button" className="knop knop-tekst klein" disabled={bezig} onClick={() => voer(() => slaVerrijkingsBronOp({ verwijderId: b.id }))}>
                      Verwijderen
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Voorgestelde bronnen ({voorstellen.length})</h3>
      {voorstellen.length ? (
        <ul className="lijst">
          {voorstellen.map((b) => (
            <li key={b.id}>
              <b>{b.naam}</b> · <a href={b.url} target="_blank" rel="noreferrer" className="klein-tekst">{b.url}</a> · <Badge kleur={RANG_KLEUR[rangVanBron(b)]}>voorgesteld: rang {rangVanBron(b)}</Badge>
              <div className="klein-tekst">{b.omschrijving}</div>
              <div className="muted klein-tekst">Voorgesteld door {b.voorgesteldDoor} op {b.voorgesteldOp ? new Date(b.voorgesteldOp).toLocaleDateString("nl-NL") : "–"}</div>
              {magBeheren ? (
                <div className="formulierActies">
                  <RangKiezer waarde={goedRang[b.id] ?? rangVanBron(b)} onChange={(r) => setGoedRang((x) => ({ ...x, [b.id]: r }))} />
                  <button type="button" className="knop klein" disabled={bezig} onClick={() => voer(() => beoordeelBronvoorstel(b.id, "goedgekeurd", goedRang[b.id] ?? rangVanBron(b)), "Bron goedgekeurd; verrijking en discovery gebruiken haar vanaf nu.")}>
                    Goedkeuren
                  </button>
                  <input value={afwijsReden[b.id] ?? ""} onChange={(e) => setAfwijsReden((x) => ({ ...x, [b.id]: e.target.value }))} placeholder="Reden bij afwijzen" style={{ maxWidth: 240 }} />
                  <button type="button" className="knop knop-secundair klein" disabled={bezig || !(afwijsReden[b.id] ?? "").trim()} onClick={() => voer(() => beoordeelBronvoorstel(b.id, "afgewezen", undefined, afwijsReden[b.id]))}>
                    Afwijzen
                  </button>
                </div>
              ) : (
                <p className="muted klein-tekst">Wacht op beoordeling door beheer.</p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted klein-tekst">Geen voorstellen in behandeling.</p>
      )}
      {afgewezen.length ? (
        <details className="uitklap klein-tekst">
          <summary>Afgewezen voorstellen ({afgewezen.length})</summary>
          <ul className="lijst">
            {afgewezen.map((b) => (
              <li key={b.id}>
                {b.naam} ({b.url}) — afgewezen door {b.beoordeeldDoor}: {b.afwijsreden}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {magVoorstellen || magBeheren ? (
        <>
          <h3>{magBeheren ? "Bron toevoegen" : "Nieuwe bron voorstellen"}</h3>
          <div className="rij">
            <label>
              Naam
              <input value={naam} onChange={(e) => setNaam(e.target.value)} placeholder="bijv. NLingenieurs" />
            </label>
            <label>
              URL
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
            </label>
            <label>
              {magBeheren ? "Rang" : "Voorgestelde rang"}
              <RangKiezer waarde={rang} onChange={setRang} />
            </label>
          </div>
          <label>
            Omschrijving (wat is het, waarom betrouwbaar)
            <input value={omschrijving} onChange={(e) => setOmschrijving(e.target.value)} placeholder="bijv. ledenlijst van de beroepsvereniging, met KVK-nummers" />
          </label>
          <div className="formulierActies">
            {magBeheren ? (
              <button type="button" className="knop klein" disabled={bezig || !naam.trim() || !url.trim()} onClick={() => voer(() => slaVerrijkingsBronOp({ naam: naam.trim(), url: url.trim(), actief: false, rang, categorie: rang === 1 ? "eigen_uitgave" : rang === 2 ? "branche" : "web", omschrijving: omschrijving.trim() || undefined }), "Bron toegevoegd.")}>
                Bron toevoegen
              </button>
            ) : (
              <button type="button" className="knop klein" disabled={bezig || !naam.trim() || !url.trim() || !omschrijving.trim()} onClick={() => voer(() => stelBronVoor({ naam, url, omschrijving, rang }), "Voorstel ingediend; beheer beoordeelt het.")}>
                Bron voorstellen
              </button>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
