// Beheeroverzicht: instellingen (US-48), rollen/rechten (US-45), links naar factoren (US-04), gewichten (US-44), audit (US-46).
import Link from "next/link";
import { heeftRecht, GEBRUIKERSROL_LABEL } from "@/lib/auth";
import { huidigeGebruiker } from "@/lib/auth";
import type { Gebruikersrol } from "@/lib/domain/types";
import { getDb } from "@/lib/store";
import { Badge, Kaart, Melding, PaginaKop } from "@/components/ui";
import { Instellingen } from "@/components/beheer/Instellingen";
import { DemoReset } from "@/components/beheer/DemoReset";
import { budgetStatus, maandVerbruik } from "@/lib/domain/kosten";
import { basisVeldKwaliteit, veldKwaliteit } from "@/lib/domain/datakwaliteit";
import { ROLLEN, type Rol } from "@/lib/domain/types";
import { ROL_LABEL } from "@/lib/format";

// US-45: lokale kopie van de RECHTEN-matrix uit src/lib/auth.ts (die exporteert de tabel niet; auth.ts wordt niet gewijzigd).
// Houd deze tabel gelijk aan auth.ts; de weergave hieronder controleert dat via heeftRecht().
const RECHTEN: Array<{ id: Parameters<typeof heeftRecht>[1]; label: string; uitleg: string }> = [
  { id: "lezen", label: "Lezen", uitleg: "Partners, projecten, matches en historie inzien." },
  { id: "bewerken", label: "Bewerken", uitleg: "Partner- en projectgegevens, factorwaarden en certificaten wijzigen." },
  { id: "evalueren", label: "Evalueren", uitleg: "Partners na oplevering beoordelen (US-21)." },
  { id: "discovery_goedkeuren", label: "Discovery goedkeuren", uitleg: "Discovery-kandidaten accepteren, parkeren of afwijzen (US-25)." },
  { id: "prospect_promoveren", label: "Status preferred/geblokkeerd", uitleg: "Partner op preferred of geblokkeerd zetten (na kwalificatie)." },
  { id: "kwalificeren", label: "Kwalificeren", uitleg: "Kwalificatiechecklist en financiële toets afvinken." },
  { id: "beheer", label: "Beheer", uitleg: "Weging (gewichtsprofielen), goudstandaard, verrijkingsschema, bronnen, budget en modellen, factoren en instellingen." },
  { id: "partners_vrijgeven", label: "AI-voorstellen vrijgeven", uitleg: "Concepten (AI-registratie, discovery, AI-aandraag) vrijgeven of afwijzen (US-54)." },
  { id: "gebruikers_beheren", label: "Gebruikers beheren", uitleg: "Rollen toekennen en accounts blokkeren (US-64)." },
  { id: "definitief_verwijderen", label: "Definitief verwijderen", uitleg: "Gearchiveerde partner op verzoek wissen (AVG, US-69)." },
  { id: "volledige_export", label: "Volledige data-export", uitleg: "Het complete bestand exporteren als CSV en JSON (US-68)." }
];
const ROLLEN_GEBRUIKER: Gebruikersrol[] = ["gebruiker", "beheerder"];

export default async function BeheerPagina({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const dkRol = ROLLEN.includes(sp.dkrol as Rol) ? (sp.dkrol as Rol) : undefined;
  const [db, gebruiker] = await Promise.all([getDb(), huidigeGebruiker()]);
  const magBeheren = heeftRecht(gebruiker.rol, "beheer");
  const actieveFactoren = db.factoren.filter((f) => f.actief).length;
  const terControle = db.partners.filter((p) => p.status === "concept");
  const verbruik = maandVerbruik(db.aiBewerkingen ?? []);
  const budget = budgetStatus(db);
  const kwaliteit = veldKwaliteit(db, dkRol);
  const basisKwaliteit = basisVeldKwaliteit(db, dkRol);

  return (
    <>
      <PaginaKop eyebrow="Beheer" titel="Beheer" intro="Factorenmodel, gewichtsprofielen, rollen en rechten, auditlog en instellingen voor AI-verrijking." />
      {!magBeheren ? <Melding soort="waarschuwing">U bent ingelogd als {gebruiker.naam} ({gebruiker.rol}). Beheerfuncties zijn alleen-lezen; wissel rechtsboven naar Beheerder om te wijzigen.</Melding> : null}

      {terControle.length ? (
        <Melding soort="info">
          {terControle.length} concept(en) wachten op vrijgave. <Link href="/vrijgave">Naar de vrijgavewachtrij</Link>
        </Melding>
      ) : null}

      <div className="raster raster-3 beheerTegels">
        <Kaart titel="Factoren">
          <p className="muted">{actieveFactoren} actieve factoren, {db.factoren.length - actieveFactoren} gearchiveerd. Toevoegen, hernoemen, samenvoegen, archiveren (US-04).</p>
          <Link href="/beheer/factoren" className="knop knop-secundair klein">Factoren beheren</Link>
        </Kaart>
        <Kaart titel="Gewichtsprofielen">
          <p className="muted">{db.gewichtsprofielen.length} profielen met versiehistorie. Gewichten en gevraagde waarden per rol (US-10, US-44).</p>
          <Link href="/beheer/gewichten" className="knop knop-secundair klein">Gewichten beheren</Link>
        </Kaart>
        <Kaart titel="Goudstandaard">
          <p className="muted">Per partnertype de verplichte en gewenste velden en de beoordelingscriteria (US-49). Goudstandaardwaarden gaan altijd voor op AI.</p>
          <Link href="/beheer/goudstandaard" className="knop knop-secundair klein">Goudstandaard beheren</Link>
        </Kaart>
        <Kaart titel="Gebruikers">
          <p className="muted">{db.gebruikers.length} account(s). Rollen gebruiker en beheerder toekennen, blokkeren en vooraf aanmelden (US-64/65).</p>
          <Link href="/beheer/gebruikers" className="knop knop-secundair klein">Gebruikers beheren</Link>
        </Kaart>
        <Kaart titel="Auditlog">
          <p className="muted">{db.audit.length} regels. Elke wijziging aan partnergegevens en scoringsregels (US-46).</p>
          <Link href="/beheer/audit" className="knop knop-secundair klein">Audit bekijken</Link>
        </Kaart>
      </div>

      <div className="raster raster-zij">
        <div>
          {/* US-48 */}
          <Kaart titel="AI-verrijking en discovery (US-48)">
            <Instellingen instellingen={db.instellingen} magBeheren={magBeheren} />
            <details className="uitklap" style={{ marginTop: 14 }}>
              <summary>Hoe werkt de afscherming?</summary>
              <ul className="lijst klein-tekst" style={{ marginTop: 8 }}>
                <li>Zonder ANTHROPIC_API_KEY draaien verrijking, discovery, chat en samenvattingen volledig lokaal op regels; er gaat geen data naar een modelleverancier en er worden geen AI-bewerkingen geteld.</li>
                <li>Met sleutel gebruikt elke functie het ingestelde model (Beheer → AI-verbruik). Alleen openbare bedrijfsteksten (website, referenties, aangeleverde documenten) gaan mee; nooit contactpersonen, financiële cijfers of evaluaties.</li>
                <li>&ldquo;Afgeschermde omgeving&rdquo; markeert dat verwerking binnen de eigen (Blauwhoed-)omgeving blijft; &ldquo;externe bronnen&rdquo; bepaalt of partnerwebsites opgehaald mogen worden.</li>
              </ul>
            </details>
          </Kaart>

          {/* US-45 */}
          <Kaart titel="Rollen en rechten (US-45)">
            <div className="tabelWrap">
              <table className="tabel rechtenMatrix">
                <thead>
                  <tr>
                    <th>Recht</th>
                    {ROLLEN_GEBRUIKER.map((r) => (
                      <th key={r}>{GEBRUIKERSROL_LABEL[r]}{r === gebruiker.rol ? <Badge kleur="blauw">u</Badge> : null}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RECHTEN.map((recht) => (
                    <tr key={recht.id}>
                      <td>
                        <b>{recht.label}</b>
                        <div className="muted klein-tekst">{recht.uitleg}</div>
                      </td>
                      {ROLLEN_GEBRUIKER.map((r) => (
                        <td key={r} className="vink">{heeftRecht(r, recht.id) ? <span className="ja">Ja</span> : <span className="muted">–</span>}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted klein-tekst">Twee rollen conform de overeenkomst (US-65); het aantal gebruikers is onbeperkt. Rollen toekennen: <Link href="/beheer/gebruikers">gebruikersbeheer</Link>.</p>
          </Kaart>
        </div>

        <div>
          <Kaart titel="Datakwaliteit per veld (B8)">
            <form method="get" className="formulierActies" style={{ marginBottom: 10 }}>
              <label>
                Partnertype
                <select name="dkrol" defaultValue={dkRol ?? ""}>
                  <option value="">Alle rollen</option>
                  {ROLLEN.map((r) => (
                    <option key={r} value={r}>{ROL_LABEL[r]}</option>
                  ))}
                </select>
              </label>
              <button type="submit" className="knop klein">Tonen</button>
            </form>
            <p className="muted klein-tekst">Basisvelden (gevuld / gevalideerd / geen betrouwbare bron): {basisKwaliteit.map((b) => `${b.veld} ${b.pct}% / ${b.gevalideerd}% / ${b.geenBron}`).join(" · ")}</p>
            <div className="tabelWrap">
              <table className="tabel">
                <thead>
                  <tr><th>Veld</th><th className="num">Relevant</th><th className="num">Volledig</th><th className="num">Gevalideerd</th><th className="num">Verouderd</th><th className="num">Gem. betrouwb.</th><th className="num">Geen bron</th></tr>
                </thead>
                <tbody>
                  {kwaliteit.map((k) => (
                    <tr key={k.factorId}>
                      <td><b>{k.naam}</b><div className="muted klein-tekst">{k.categorie}</div></td>
                      <td className="num">{k.relevant}</td>
                      <td className="num"><Badge kleur={k.pctVolledig >= 60 ? "groen" : k.pctVolledig >= 25 ? "geel" : "rood"}>{k.pctVolledig}%</Badge></td>
                      <td className="num">{k.pctGevalideerd}%</td>
                      <td className="num">{k.pctVerouderd ? <Badge kleur="rood">{k.pctVerouderd}%</Badge> : "0%"}</td>
                      <td className="num">{k.gemBetrouwbaarheid !== null ? `${k.gemBetrouwbaarheid}%` : "–"}</td>
                      <td className="num">{k.geenBron ? <Badge kleur="mint">{k.geenBron}</Badge> : "0"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Kaart>
          <Kaart titel="AI-verbruik (US-58)" acties={<Link href="/beheer/verbruik">Rapportage</Link>}>
            {budget.overschreden ? <Melding soort="fout">Maandbudget bereikt: geplande verrijkingsrondes zijn gepauzeerd; interactieve functies gaan voor.</Melding> : budget.waarschuwing ? <Melding soort="waarschuwing">Verbruik boven 80% van het maandbudget.</Melding> : null}
            <dl className="definities">
              <div><dt>Maand</dt><dd>{verbruik.periode}</dd></div>
              <div><dt>Bewerkingen</dt><dd>{budget.bewerkingen} van {budget.budgetBewerkingen} ({Math.round(budget.pct)}%)</dd></div>
              <div><dt>Tokenkosten</dt><dd>€ {budget.kostenEur.toFixed(2)} van € {budget.tokenbudgetEur.toFixed(0)}</dd></div>
              <div><dt>Tokens</dt><dd>{verbruik.invoerTokens.toLocaleString("nl-NL")} in · {verbruik.uitvoerTokens.toLocaleString("nl-NL")} uit</dd></div>
            </dl>
            <Link href="/beheer/verbruik" className="knop knop-secundair klein">Budget, modellen en specificatie</Link>
          </Kaart>
          <Kaart titel="Volledige data-export (US-68)">
            <p className="muted klein-tekst">Het complete bestand met herkomst en status per gegeven: alle partners (ook concepten en gearchiveerde), velden, factoren, projecten, evaluaties, verbanden en het AI-verbruik. Zo beschikt Blauwhoed altijd over alle gegevens (art. 15.4). Het downloaden wordt gelogd.</p>
            {heeftRecht(gebruiker.rol, "volledige_export") ? (
              <div className="formulierActies">
                <a className="knop klein" href="/api/export/volledig?formaat=json">Volledige export (JSON)</a>
                <a className="knop knop-secundair klein" href="/api/export/volledig?formaat=csv">Volledige export (CSV, zip)</a>
              </div>
            ) : (
              <p className="muted klein-tekst">Alleen de beheerder maakt een volledige export.</p>
            )}
          </Kaart>
          <Kaart titel="Demo">
            <DemoReset magBeheren={magBeheren} />
          </Kaart>
          <Kaart titel="Gegevens">
            <dl className="definities">
              <div><dt>Partners</dt><dd>{db.partners.length}</dd></div>
              <div><dt>Projecten</dt><dd>{db.projecten.length}</dd></div>
              <div><dt>Engagements</dt><dd>{db.engagements.length}</dd></div>
              <div><dt>Evaluaties</dt><dd>{db.evaluaties.length}</dd></div>
              <div><dt>Matchruns</dt><dd>{db.matchRuns.length}</dd></div>
              <div><dt>Importwachtrij</dt><dd>{db.importWachtrij.length}</dd></div>
              <div><dt>Opslag</dt><dd>{process.env.DATABASE_URL ? "Neon (JSONB-snapshot)" : "In-memory (seed)"}</dd></div>
            </dl>
          </Kaart>
        </div>
      </div>
    </>
  );
}
