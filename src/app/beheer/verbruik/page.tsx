// US-58/US-59: AI-verbruik in bewerkingen (art. 8) met budget, signalen, rapportage per maand en kwartaal, specificatie-export
// en het model per functie.
import Link from "next/link";
import { AIBudgetEditor, ModellenEditor } from "@/components/beheer/AIInstellingen";
import { Badge, Kaart, Knop, Melding, Metriek, PaginaKop } from "@/components/ui";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { aiBudget, BESCHIKBARE_MODELLEN, bewerkingKosten, budgetStatus, CATEGORIEEN, categorieVan, FUNCTIE_LABEL, STANDAARD_MODELLEN, verbruikPerPeriode, type Verbruik } from "@/lib/domain/kosten";
import type { AIFunctie } from "@/lib/domain/types";
import { datumTijd } from "@/lib/format";
import { getDb } from "@/lib/store";

const euro = (n: number) => `€ ${n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function PeriodeTabel({ rijen, budget, kop }: { rijen: Verbruik[]; budget: number; kop: string }) {
  if (!rijen.length) return <p className="muted">Nog geen AI-bewerkingen geregistreerd.</p>;
  return (
    <div className="tabelWrap">
      <table className="tabel">
        <thead>
          <tr>
            <th>{kop}</th>
            <th className="num">Bewerkingen</th>
            <th className="num">% budget</th>
            {CATEGORIEEN.map((c) => (
              <th key={c} className="num">{c}</th>
            ))}
            <th className="num">Tokens in/uit</th>
            <th className="num">Kosten</th>
          </tr>
        </thead>
        <tbody>
          {rijen.map((v) => {
            const pct = budget ? Math.round((v.bewerkingen / budget) * 100) : 0;
            return (
              <tr key={v.periode}>
                <td>{v.periode}</td>
                <td className="num">{v.bewerkingen}</td>
                <td className="num"><Badge kleur={pct > 110 ? "rood" : pct >= 80 ? "geel" : "groen"}>{pct}%</Badge></td>
                {CATEGORIEEN.map((c) => (
                  <td key={c} className="num">{v.perCategorie[c]}</td>
                ))}
                <td className="num">{v.invoerTokens.toLocaleString("nl-NL")} / {v.uitvoerTokens.toLocaleString("nl-NL")}</td>
                <td className="num">{euro(v.kostenEur)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function VerbruikPagina() {
  const [db, gebruiker] = await Promise.all([getDb(), huidigeGebruiker()]);
  const magBeheren = heeftRecht(gebruiker.rol, "beheer");
  const budget = aiBudget(db);
  const status = budgetStatus(db);
  const bewerkingen = db.aiBewerkingen ?? [];
  const perMaand = verbruikPerPeriode(bewerkingen, "maand", budget);
  const perKwartaal = verbruikPerPeriode(bewerkingen, "kwartaal", budget);
  const modellen = { ...STANDAARD_MODELLEN, ...(db.instellingen.modellen ?? {}) };
  return (
    <>
      <PaginaKop
        eyebrow="Beheer"
        titel="AI-verbruik"
        intro="Verbruik in AI-bewerkingen conform art. 8: één bewerking is één handeling die tot verwerking door een extern taalmodel leidt, inclusief alle onderliggende aanroepen. Eén verrijking van één partner is één bewerking, ook binnen een ronde; een chat-, match- of verbandvraag en een AI-voorstelronde zijn elk één bewerking. Onderhoudsprocessen tellen niet mee."
        acties={
          magBeheren ? (
            <>
              <Knop href="/api/export/verbruik?formaat=xlsx" variant="secundair">Specificatie (Excel)</Knop>
              <Knop href="/api/export/verbruik" variant="secundair">Specificatie (CSV)</Knop>
            </>
          ) : null
        }
      />
      {!magBeheren ? <Melding soort="info">Alleen de beheerder wijzigt budget en modellen en exporteert de specificatie.</Melding> : null}
      {status.boven125 ? <Melding soort="fout">Verbruik boven 125% van het maandbudget: aanleiding voor overleg over nacalculatie (art. 8).</Melding> : null}
      {status.kwartaalBoven110 ? <Melding soort="fout">Gemiddeld verbruik dit kwartaal boven 110% van het maandbudget.</Melding> : null}
      {status.overschreden ? <Melding soort="waarschuwing">Maandbudget bereikt: geplande verrijkingsrondes starten niet; interactieve functies gaan voor.</Melding> : status.waarschuwing ? <Melding soort="waarschuwing">Verbruik boven 80% van het maandbudget.</Melding> : null}
      <div className="metriekRij">
        <Metriek waarde={`${status.bewerkingen} / ${status.budgetBewerkingen}`} label="AI-bewerkingen deze maand" sub={`${Math.round(status.pct)}% van het budget`} />
        <Metriek waarde={euro(status.kostenEur)} label="Tokenkosten deze maand" sub={`${Math.round(status.pctEur)}% van ${euro(status.tokenbudgetEur)}`} />
        <Metriek waarde={`${Math.round(status.kwartaalGemPct)}%`} label="Gemiddeld per maand dit kwartaal" sub="signaal boven 110%" />
        <Metriek waarde={process.env.ANTHROPIC_API_KEY ? "actief" : "uit"} label="Extern taalmodel" sub={process.env.ANTHROPIC_API_KEY ? "ANTHROPIC_API_KEY gezet" : "regels, geen bewerkingen"} />
      </div>
      <Kaart titel="Verbruik per maand">
        <PeriodeTabel rijen={perMaand} budget={budget.bewerkingenPerMaand} kop="Maand" />
      </Kaart>
      <Kaart titel="Verbruik per kwartaal">
        <PeriodeTabel rijen={perKwartaal} budget={budget.bewerkingenPerMaand * 3} kop="Kwartaal" />
      </Kaart>
      <div className="raster raster-2">
        <Kaart titel="Budget en rekenprijzen">
          <AIBudgetEditor budget={budget} magBeheren={magBeheren} />
        </Kaart>
        <Kaart titel="Model per functie">
          <p className="muted klein-tekst">Het lichtste passende model per functie houdt het verbruik laag (art. 8.9). Eerdere resultaten worden hergebruikt: een partner waarvan de website niet is gewijzigd, wordt niet opnieuw door het model gelezen.</p>
          <ModellenEditor modellen={modellen} functies={(Object.keys(FUNCTIE_LABEL) as AIFunctie[]).map((id) => ({ id, label: FUNCTIE_LABEL[id] }))} opties={BESCHIKBARE_MODELLEN} magBeheren={magBeheren} />
        </Kaart>
      </div>
      <Kaart titel="Laatste bewerkingen" acties={<Link href="/beheer">Terug naar beheer</Link>}>
        {bewerkingen.length ? (
          <div className="tabelWrap">
            <table className="tabel">
              <thead>
                <tr>
                  <th>Wanneer</th>
                  <th>Categorie</th>
                  <th>Omschrijving</th>
                  <th>Door</th>
                  <th className="num">Aanroepen</th>
                  <th>Model</th>
                  <th className="num">Tokens in/uit</th>
                  <th className="num">Kosten</th>
                </tr>
              </thead>
              <tbody>
                {bewerkingen.slice(0, 25).map((b) => (
                  <tr key={b.id}>
                    <td>{datumTijd(b.op)}</td>
                    <td>{categorieVan(b.soort)}</td>
                    <td className="klein-tekst">{b.omschrijving}</td>
                    <td>{b.door}</td>
                    <td className="num">{b.aanroepen.length}</td>
                    <td className="klein-tekst">{Array.from(new Set(b.aanroepen.map((a) => a.model))).join(", ")}</td>
                    <td className="num">{b.invoerTokens.toLocaleString("nl-NL")} / {b.uitvoerTokens.toLocaleString("nl-NL")}</td>
                    <td className="num">{euro(bewerkingKosten(b, budget))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Nog geen AI-bewerkingen. Zonder ANTHROPIC_API_KEY draaien extractie, chat en samenvattingen op regels en tellen ze niet als bewerking.</p>
        )}
      </Kaart>
    </>
  );
}
