"use client";
// US-12 ranglijst, US-13 uitleg per criterium met bewijs, US-14 uitsluitingen, US-15 semantische score,
// US-04b dekkingsgraad, US-17 vergelijken (2–4 kandidaten), US-42 feedback op de ranking.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { geefMatchFeedback } from "@/lib/actions";
import { DEKKING_WAARSCHUWING } from "@/lib/domain/matching";
import type { CriteriumScore, Kandidaat, MatchFeedback, RolResultaat, Uitsluiting } from "@/lib/domain/types";
import { ROL_LABEL, datumTijd, waardeTekst } from "@/lib/format";
import { Badge, Melding, ScoreBalk, StatusBadge } from "@/components/ui";

const SOORT_LABEL: Record<Uitsluiting["soort"], string> = { status: "Status", rol: "Rol", regio: "Regio", capaciteit: "Capaciteit", beschikbaarheid: "Beschikbaarheid", certificaat: "Certificaat", factor: "Factor" };
const BESLISSING_LABEL: Record<MatchFeedback["beslissing"], string> = { gekozen: "Gekozen", shortlist: "Shortlist", afgewezen: "Afgewezen" };
const BESLISSING_KLEUR: Record<MatchFeedback["beslissing"], "groen" | "blauw" | "grijs"> = { gekozen: "groen", shortlist: "blauw", afgewezen: "grijs" };

export type Verschil = { nieuw: string[]; weg: string[]; gewijzigd: Array<{ naam: string; van: number; naar: number }> };

function BewijsLink({ c }: { c: CriteriumScore }) {
  const b = c.bewijs;
  if (!b) return <span className="muted">–</span>;
  if (b.soort === "project") return <Link href={`/projecten/${b.ref}`}>{b.label}</Link>;
  if (b.soort === "evaluatie") return <Link href={`/partners/${b.ref}?tab=historie`}>{b.label}</Link>;
  return <span title={b.ref}>{b.label}</span>;
}

function CriteriumTabel({ criteria }: { criteria: CriteriumScore[] }) {
  if (!criteria.length) return <p className="muted klein-tekst">Geen gewogen criteria in deze rol.</p>;
  return (
    <div className="tabelWrap">
      <table className="tabel criteriumTabel klein-tekst">
        <thead>
          <tr>
            <th>Criterium</th>
            <th>Gevraagd</th>
            <th>Waarde</th>
            <th className="num">Fit</th>
            <th className="num">Betrouwb.</th>
            <th>Bron</th>
            <th className="num">Gewicht</th>
            <th className="num">Effectief</th>
            <th>Bijdrage</th>
            <th>Bewijs</th>
            <th>Toelichting</th>
          </tr>
        </thead>
        <tbody>
          {criteria.map((c, i) => (
            <tr key={i} className={c.fit === null ? "muted" : ""}>
              <td>{c.factorNaam}</td>
              <td>{waardeTekst(c.gevraagd)}</td>
              <td>{waardeTekst(c.waarde)}</td>
              <td className="num">{c.fit === null ? "–" : `${Math.round(c.fit * 100)}%`}</td>
              <td className="num">{c.betrouwbaarheid === undefined ? "–" : `${Math.round(c.betrouwbaarheid * 100)}%`}</td>
              <td>{c.bron ?? "–"}</td>
              <td className="num">{c.gewicht}%</td>
              <td className="num">{c.effectiefGewicht}%</td>
              <td>
                <div className="bijdrageBalk" title={`${c.bijdrage} punten`}>
                  <i style={{ width: `${Math.min(100, c.bijdrage)}%` }} />
                </div>
                <span>{c.bijdrage}</span>
              </td>
              <td>
                <BewijsLink c={c} />
              </td>
              <td>{c.toelichting}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Vergelijking({ kandidaten, onSluit }: { kandidaten: Kandidaat[]; onSluit: () => void }) {
  const namen = new Map<string, string>();
  kandidaten.forEach((k) => k.criteria.forEach((c) => namen.set(`${c.factorId}|${c.optieId ?? ""}`, c.factorNaam)));
  const sleutels = Array.from(namen.entries());
  const cel = (k: Kandidaat, sleutel: string) => {
    const c = k.criteria.find((x) => `${x.factorId}|${x.optieId ?? ""}` === sleutel);
    if (!c) return <span className="muted">n.v.t.</span>;
    if (c.fit === null) return <span className="muted">onbekend</span>;
    return (
      <>
        <b>{waardeTekst(c.waarde)}</b> · {Math.round(c.fit * 100)}%<br />
        <span className="muted">{c.bron} {c.betrouwbaarheid !== undefined ? `(${Math.round(c.betrouwbaarheid * 100)}%)` : ""}</span>
      </>
    );
  };
  return (
    <section className="kaart vergelijking">
      <header className="kaartKop">
        <h3>Vergelijking (US-17)</h3>
        <button type="button" className="knop knop-tekst klein" onClick={onSluit}>
          Sluiten
        </button>
      </header>
      <div className="tabelWrap">
        <table className="tabel klein-tekst">
          <thead>
            <tr>
              <th>Criterium</th>
              {kandidaten.map((k) => (
                <th key={k.partnerId}>
                  <Link href={`/partners/${k.partnerId}`}>{k.partnerNaam}</Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Score</td>
              {kandidaten.map((k) => (
                <td key={k.partnerId}>
                  <ScoreBalk score={k.score} klein />
                </td>
              ))}
            </tr>
            <tr>
              <td>Gewogen score</td>
              {kandidaten.map((k) => (
                <td key={k.partnerId}>{k.gewogenScore}</td>
              ))}
            </tr>
            <tr>
              <td>Semantisch</td>
              {kandidaten.map((k) => (
                <td key={k.partnerId}>{k.semantischeScore ?? "–"}</td>
              ))}
            </tr>
            <tr>
              <td>Dekkingsgraad</td>
              {kandidaten.map((k) => (
                <td key={k.partnerId} className={k.dekkingsgraad < DEKKING_WAARSCHUWING ? "waarschuwing-tekst" : ""}>
                  {k.dekkingsgraad}%
                </td>
              ))}
            </tr>
            <tr>
              <td>Afstand</td>
              {kandidaten.map((k) => (
                <td key={k.partnerId}>{k.afstandKm === null ? "–" : `${k.afstandKm} km`}</td>
              ))}
            </tr>
            {sleutels.map(([s, naam]) => (
              <tr key={s}>
                <td>{naam}</td>
                {kandidaten.map((k) => (
                  <td key={k.partnerId}>{cel(k, s)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function KandidaatKaart({ k, rang, feedback, magFeedback, geselecteerd, onSelecteer, selectieVol, onFeedback }: { k: Kandidaat; rang: number; feedback?: MatchFeedback; magFeedback: boolean; geselecteerd: boolean; onSelecteer: (aan: boolean) => void; selectieVol: boolean; onFeedback: (beslissing: MatchFeedback["beslissing"], reden: string) => void }) {
  const [redenOpen, setRedenOpen] = useState<MatchFeedback["beslissing"] | null>(null);
  const [reden, setReden] = useState("");
  return (
    <article className={`kandidaatRij ${k.isProspect ? "prospect" : ""}`}>
      <div className="rang">{rang}</div>
      <div>
        <div className="kandidaatKop">
          <label className="vergelijkVink">
            <input type="checkbox" checked={geselecteerd} disabled={!geselecteerd && selectieVol} onChange={(e) => onSelecteer(e.target.checked)} aria-label={`Vergelijk ${k.partnerNaam}`} />
          </label>
          <Link href={`/partners/${k.partnerId}`}>
            <b>{k.partnerNaam}</b>
          </Link>
          <StatusBadge status={k.status} />
          {feedback ? (
            <Badge kleur={BESLISSING_KLEUR[feedback.beslissing]} titel={`${feedback.door}, ${datumTijd(feedback.op)}: ${feedback.reden}`}>
              {BESLISSING_LABEL[feedback.beslissing]}
            </Badge>
          ) : null}
        </div>
        <div className="kandidaatCijfers klein-tekst">
          <span>
            Gewogen <b>{k.gewogenScore}</b>
          </span>
          {k.semantischeScore !== null ? (
            <span>
              <Badge kleur="mint" titel="Semantische gelijkenis met de projectomschrijving; apart van de gewogen factoren">
                semantisch {k.semantischeScore}
              </Badge>
            </span>
          ) : null}
          <span className={k.dekkingsgraad < DEKKING_WAARSCHUWING ? "waarschuwing-tekst" : ""}>
            Dekking <b>{k.dekkingsgraad}%</b>
            {k.dekkingsgraad < DEKKING_WAARSCHUWING ? " (laag: weinig bekende data)" : ""}
          </span>
          <span>{k.afstandKm === null ? "" : `${k.afstandKm} km`}</span>
        </div>
        {k.semantischeTreffers.length ? (
          <div className="klein-tekst">
            {k.semantischeTreffers.map((t) => (
              <span key={t} className="chip">
                {t}
              </span>
            ))}
          </div>
        ) : null}
        {k.waarschuwingen.length ? (
          <ul className="lijst klein-tekst waarschuwingen">
            {k.waarschuwingen.map((w, i) => (
              <li key={i}>⚠ {w}</li>
            ))}
          </ul>
        ) : null}
        {feedback ? (
          <p className="klein-tekst muted">
            {BESLISSING_LABEL[feedback.beslissing]} door {feedback.door} op {datumTijd(feedback.op)} (positie {feedback.positieInRanking}): {feedback.reden || "geen reden opgegeven"}
          </p>
        ) : null}
        <details className="uitklap">
          <summary>Waarom deze score</summary>
          <CriteriumTabel criteria={k.criteria} />
        </details>
        {magFeedback ? (
          <div className="feedbackRij geenPrint">
            {(["gekozen", "shortlist", "afgewezen"] as const).map((b) => (
              <button key={b} type="button" className={`knop klein ${b === "gekozen" ? "" : "knop-secundair"}`} onClick={() => setRedenOpen(redenOpen === b ? null : b)}>
                {BESLISSING_LABEL[b]}
              </button>
            ))}
            {redenOpen ? (
              <span className="redenVeld">
                <input value={reden} onChange={(e) => setReden(e.target.value)} placeholder={`Reden voor '${BESLISSING_LABEL[redenOpen]}'`} aria-label="Reden" />
                <button
                  type="button"
                  className="knop klein"
                  onClick={() => {
                    onFeedback(redenOpen, reden);
                    setRedenOpen(null);
                    setReden("");
                  }}
                >
                  Vastleggen
                </button>
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div>
        <ScoreBalk score={k.score} label="Score" />
      </div>
    </article>
  );
}

export default function RolResultaatWeergave({ resultaat, runId, projectId, feedback, magFeedback, verschil }: { resultaat: RolResultaat; runId: string; projectId: string; feedback: MatchFeedback[]; magFeedback: boolean; verschil?: Verschil }) {
  const router = useRouter();
  const [selectie, setSelectie] = useState<string[]>([]);
  const [vergelijk, setVergelijk] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [, start] = useTransition();
  const alle = [...resultaat.kandidaten, ...resultaat.prospects];

  function selecteer(id: string, aan: boolean) {
    setSelectie((s) => (aan ? (s.length < 4 ? [...s, id] : s) : s.filter((x) => x !== id)));
  }

  function geefFeedback(k: Kandidaat, rang: number, beslissing: MatchFeedback["beslissing"], reden: string) {
    setFout(null);
    start(async () => {
      const r = await geefMatchFeedback({ matchRunId: runId, projectId, rol: resultaat.rol, partnerId: k.partnerId, beslissing, reden, positieInRanking: rang });
      if (!r.ok) return setFout(r.fout);
      router.refresh();
    });
  }

  const fbVan = (id: string) => feedback.find((f) => f.rol === resultaat.rol && f.partnerId === id);
  const geselecteerdeKandidaten = selectie.map((id) => alle.find((k) => k.partnerId === id)).filter((k): k is Kandidaat => Boolean(k));

  return (
    <section className="kaart rolResultaat">
      <header className="kaartKop">
        <h2>
          {ROL_LABEL[resultaat.rol]} <span className="muted klein-tekst">{resultaat.kandidaten.length} kandidaten · {resultaat.prospects.length} prospects · {resultaat.uitsluitingen.length} uitgesloten</span>
        </h2>
        <div className="formulierActies geenPrint">
          <span className="muted klein-tekst">{selectie.length}/4 geselecteerd</span>
          <button type="button" className="knop knop-secundair klein" disabled={selectie.length < 2} onClick={() => setVergelijk(true)}>
            Vergelijken
          </button>
        </div>
      </header>
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      {verschil && (verschil.nieuw.length || verschil.weg.length || verschil.gewijzigd.length) ? (
        <Melding soort="info">
          <b>Verschil met vorige run (US-16):</b>{" "}
          {verschil.nieuw.length ? <span>nieuw: {verschil.nieuw.join(", ")}. </span> : null}
          {verschil.gewijzigd.length ? <span>gewijzigd: {verschil.gewijzigd.map((g) => `${g.naam} ${g.van}→${g.naar}`).join(", ")}. </span> : null}
          {verschil.weg.length ? <span>weggevallen: {verschil.weg.join(", ")}.</span> : null}
        </Melding>
      ) : verschil ? (
        <p className="muted klein-tekst">Geen verschillen van betekenis ten opzichte van de vorige run.</p>
      ) : null}
      {vergelijk && geselecteerdeKandidaten.length >= 2 ? <Vergelijking kandidaten={geselecteerdeKandidaten} onSluit={() => setVergelijk(false)} /> : null}

      {resultaat.kandidaten.length ? (
        resultaat.kandidaten.map((k, i) => (
          <KandidaatKaart key={k.partnerId} k={k} rang={i + 1} feedback={fbVan(k.partnerId)} magFeedback={magFeedback} geselecteerd={selectie.includes(k.partnerId)} onSelecteer={(aan) => selecteer(k.partnerId, aan)} selectieVol={selectie.length >= 4} onFeedback={(b, r) => geefFeedback(k, i + 1, b, r)} />
        ))
      ) : (
        <p className="muted">Geen kandidaten die door de harde filters komen.</p>
      )}

      {resultaat.prospects.length ? (
        <>
          <h3 className="subkop">Prospects (niet in advies, nog te kwalificeren)</h3>
          {resultaat.prospects.map((k, i) => (
            <KandidaatKaart key={k.partnerId} k={k} rang={i + 1} feedback={fbVan(k.partnerId)} magFeedback={magFeedback} geselecteerd={selectie.includes(k.partnerId)} onSelecteer={(aan) => selecteer(k.partnerId, aan)} selectieVol={selectie.length >= 4} onFeedback={(b, r) => geefFeedback(k, i + 1, b, r)} />
          ))}
        </>
      ) : null}

      {resultaat.uitsluitingen.length ? (
        <details className="uitklap">
          <summary>Uitgesloten door harde filters ({resultaat.uitsluitingen.length}) — US-14</summary>
          <div className="tabelWrap">
            <table className="tabel klein-tekst">
              <thead>
                <tr>
                  <th>Partner</th>
                  <th>Soort</th>
                  <th>Reden</th>
                </tr>
              </thead>
              <tbody>
                {resultaat.uitsluitingen.map((u) => (
                  <tr key={u.partnerId}>
                    <td>
                      <Link href={`/partners/${u.partnerId}`}>{u.partnerNaam}</Link>
                    </td>
                    <td>
                      <Badge kleur={u.soort === "status" ? "rood" : "geel"}>{SOORT_LABEL[u.soort]}</Badge>
                    </td>
                    <td>{u.reden}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </section>
  );
}
