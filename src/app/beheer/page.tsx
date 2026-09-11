// Beheeroverzicht: instellingen (US-48), rollen/rechten (US-45), links naar factoren (US-04), gewichten (US-44), audit (US-46).
import Link from "next/link";
import { heeftRecht, GEBRUIKERS } from "@/lib/auth";
import { huidigeGebruiker } from "@/lib/auth";
import type { Gebruikersrol } from "@/lib/domain/types";
import { getDb } from "@/lib/store";
import { Badge, Kaart, Melding, PaginaKop } from "@/components/ui";
import { Instellingen } from "@/components/beheer/Instellingen";
import { DemoReset } from "@/components/beheer/DemoReset";
import AIKosten from "@/components/beheer/AIKosten";
import { budgetStatus, maandVerbruik } from "@/lib/domain/kosten";
import { basisVeldKwaliteit, veldKwaliteit } from "@/lib/domain/datakwaliteit";
import { ROLLEN, type Rol } from "@/lib/domain/types";
import { ROL_LABEL } from "@/lib/format";
import { datumTijd } from "@/lib/format";

// US-45: lokale kopie van de RECHTEN-matrix uit src/lib/auth.ts (die exporteert de tabel niet; auth.ts wordt niet gewijzigd).
// Houd deze tabel gelijk aan auth.ts; de weergave hieronder controleert dat via heeftRecht().
const RECHTEN: Array<{ id: Parameters<typeof heeftRecht>[1]; label: string; uitleg: string }> = [
  { id: "lezen", label: "Lezen", uitleg: "Partners, projecten, matches en historie inzien." },
  { id: "bewerken", label: "Bewerken", uitleg: "Partner- en projectgegevens, factorwaarden en certificaten wijzigen." },
  { id: "evalueren", label: "Evalueren", uitleg: "Partners na oplevering beoordelen (US-21)." },
  { id: "discovery_goedkeuren", label: "Discovery goedkeuren", uitleg: "Discovery-kandidaten accepteren, parkeren of afwijzen (US-25)." },
  { id: "prospect_promoveren", label: "Prospect promoveren", uitleg: "Prospect kwalificeren tot bekende partner (US-29)." },
  { id: "kwalificeren", label: "Kwalificeren", uitleg: "Kwalificatiechecklist en financiële toets afvinken." },
  { id: "beheer", label: "Beheer", uitleg: "Factoren, gewichtsprofielen, instellingen en demo-reset." }
];
const ROLLEN_GEBRUIKER: Gebruikersrol[] = ["lezer", "bewerker", "inkoper", "beheerder"];

export default async function BeheerPagina({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const dkRol = ROLLEN.includes(sp.dkrol as Rol) ? (sp.dkrol as Rol) : undefined;
  const [db, gebruiker] = await Promise.all([getDb(), huidigeGebruiker()]);
  const magBeheren = heeftRecht(gebruiker.rol, "beheer");
  const actieveFactoren = db.factoren.filter((f) => f.actief).length;
  const verbruik = maandVerbruik(db.aiBewerkingen ?? []);
  const budget = budgetStatus(db);
  const laatsteBewerkingen = (db.aiBewerkingen ?? []).slice(0, 10);
  const kwaliteit = veldKwaliteit(db, dkRol);
  const basisKwaliteit = basisVeldKwaliteit(db, dkRol);
  const SOORT_LABEL: Record<string, string> = { verrijking: "verrijking (1 partner)", verrijkingsronde: "verrijkingsronde", discovery: "discovery", projectextractie: "projectextractie", chat: "chat", samenvatting: "samenvatting", overig: "overig" };

  return (
    <>
      <PaginaKop eyebrow="Beheer" titel="Beheer" intro="Factorenmodel, gewichtsprofielen, rollen en rechten, auditlog en instellingen voor AI-verrijking." />
      {!magBeheren ? <Melding soort="waarschuwing">U bent ingelogd als {gebruiker.naam} ({gebruiker.rol}). Beheerfuncties zijn alleen-lezen; wissel rechtsboven naar Beheerder om te wijzigen.</Melding> : null}

      <div className="raster raster-3">
        <Kaart titel="Factoren">
          <p className="muted">{actieveFactoren} actieve factoren, {db.factoren.length - actieveFactoren} gearchiveerd. Toevoegen, hernoemen, samenvoegen, archiveren (US-04).</p>
          <Link href="/beheer/factoren" className="knop knop-secundair klein">Factoren beheren</Link>
        </Kaart>
        <Kaart titel="Gewichtsprofielen">
          <p className="muted">{db.gewichtsprofielen.length} profielen met versiehistorie. Gewichten en gevraagde waarden per rol (US-10, US-44).</p>
          <Link href="/beheer/gewichten" className="knop knop-secundair klein">Gewichten beheren</Link>
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
                <li>Verrijking (US-35) en discovery (US-23) draaien nu volledig lokaal met regels: tekstextractie, trefwoorden en de factorencatalogus. Er gaat geen data naar een modelleverancier.</li>
                <li>Bij AI-provider = Anthropic wordt uitsluitend een provider met zero-data-retention verwacht. Alleen openbare bedrijfsteksten (website, referenties) gaan mee; nooit contactpersonen, financiële cijfers of evaluaties.</li>
                <li>Eerlijkheidshalve: dit is op dit moment een instelling. De daadwerkelijke aanroep naar een AI-provider is nog niet gebouwd; de instelling bepaalt straks welk pad de verrijking neemt.</li>
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
                      <th key={r}>{r}{r === gebruiker.rol ? <Badge kleur="blauw">u</Badge> : null}</th>
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
            <p className="muted klein-tekst">Demo-accounts: {GEBRUIKERS.map((g) => `${g.naam} (${g.rol})`).join(", ")}. Authenticatie via cookie; koppeling aan SSO (Entra ID) volgt.</p>
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
            <p className="muted klein-tekst">Basisvelden: {basisKwaliteit.map((b) => `${b.veld} ${b.pct}%`).join(" · ")}</p>
            <div className="tabelWrap">
              <table className="tabel">
                <thead>
                  <tr><th>Veld</th><th className="num">Relevant</th><th className="num">Volledig</th><th className="num">Gevalideerd</th><th className="num">Verouderd</th><th className="num">Gem. betrouwb.</th></tr>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Kaart>
          <Kaart titel="AI-verbruik en kosten (eis 2)">
            {budget.overschreden ? <Melding soort="fout">Maandbudget overschreden: geplande verrijkingsrondes zijn gepauzeerd; interactieve functies gaan voor.</Melding> : budget.waarschuwing ? <Melding soort="waarschuwing">Verbruik boven 80% van het maandbudget.</Melding> : null}
            <dl className="definities">
              <div><dt>Maand</dt><dd>{verbruik.maand}</dd></div>
              <div><dt>Verbruik</dt><dd>${verbruik.kostenUsd.toFixed(2)} van ${budget.budgetUsd.toFixed(0)} ({Math.round(budget.pct)}%)</dd></div>
              <div><dt>Bewerkingen</dt><dd>{verbruik.bewerkingen} (met {verbruik.aanroepen} modelaanroepen)</dd></div>
              <div><dt>Tokens</dt><dd>{verbruik.invoerTokens.toLocaleString("nl-NL")} in · {verbruik.uitvoerTokens.toLocaleString("nl-NL")} uit</dd></div>
            </dl>
            <AIKosten budget={db.instellingen.aiBudgetUsdPerMaand ?? 0} magBeheren={magBeheren} />
            {laatsteBewerkingen.length ? (
              <div className="tabelWrap">
                <table className="tabel">
                  <thead>
                    <tr><th>Wanneer</th><th>Soort</th><th>Door</th><th className="num">Aanroepen</th><th className="num">Tokens in/uit</th><th className="num">Kosten</th></tr>
                  </thead>
                  <tbody>
                    {laatsteBewerkingen.map((b) => (
                      <tr key={b.id}>
                        <td>{datumTijd(b.op)}</td>
                        <td title={b.omschrijving}>{SOORT_LABEL[b.soort] ?? b.soort}</td>
                        <td>{b.door}</td>
                        <td className="num">{b.aanroepen.length}</td>
                        <td className="num">{b.invoerTokens.toLocaleString("nl-NL")} / {b.uitvoerTokens.toLocaleString("nl-NL")}</td>
                        <td className="num">${b.kostenUsd.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted klein-tekst">Nog geen AI-bewerkingen geregistreerd. Elke gebruikershandeling met AI (verrijking, discovery, projectextractie, chat) verschijnt hier met tokens en kosten.</p>
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
