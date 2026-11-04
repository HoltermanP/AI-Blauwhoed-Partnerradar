// Beheer → Instellingen: AI-verrijking en discovery (US-48), rollen en rechten (US-45), volledige export en opslag. De overige
// beheeronderdelen (factoren, gewichten, goudstandaard, gebruikers, AI-verbruik, audit) staan als eigen pagina in het menu;
// de datakwaliteit per veld staat op Kwaliteit → Datakwaliteit.
import Link from "next/link";
import { bepaalOmgeving, databaseAanduiding, OMGEVING_LABEL } from "@/lib/domain/omgeving";
import { heeftRecht, GEBRUIKERSROL_LABEL } from "@/lib/auth";
import { huidigeGebruiker } from "@/lib/auth";
import type { Gebruikersrol } from "@/lib/domain/types";
import { getDb } from "@/lib/store";
import { Badge, Kaart, Melding, PaginaKop } from "@/components/ui";
import { Instellingen } from "@/components/beheer/Instellingen";
import { DemoReset } from "@/components/beheer/DemoReset";

// US-45: lokale kopie van de RECHTEN-matrix uit src/lib/auth.ts (die exporteert de tabel niet; auth.ts wordt niet gewijzigd).
// Houd deze tabel gelijk aan auth.ts; de weergave hieronder controleert dat via heeftRecht().
const RECHTEN: Array<{ id: Parameters<typeof heeftRecht>[1]; label: string; uitleg: string }> = [
  { id: "lezen", label: "Lezen", uitleg: "Partners, projecten, matches en historie inzien." },
  { id: "bewerken", label: "Bewerken", uitleg: "Partner- en projectgegevens, factorwaarden en certificaten wijzigen." },
  { id: "evalueren", label: "Evalueren", uitleg: "Partners na oplevering beoordelen." },
  { id: "discovery_goedkeuren", label: "Discovery goedkeuren", uitleg: "Discovery-kandidaten accepteren, parkeren of afwijzen." },
  { id: "prospect_promoveren", label: "Status preferred/geblokkeerd", uitleg: "Partner op preferred of geblokkeerd zetten (na kwalificatie)." },
  { id: "kwalificeren", label: "Kwalificeren", uitleg: "Kwalificatiechecklist en financiële toets afvinken." },
  { id: "beheer", label: "Beheer", uitleg: "Weging (gewichtsprofielen), goudstandaard, verrijkingsschema, bronnen, budget en modellen, factoren en instellingen." },
  { id: "partners_vrijgeven", label: "AI-voorstellen vrijgeven", uitleg: "Concepten (AI-registratie, discovery, AI-aandraag) vrijgeven of afwijzen." },
  { id: "gebruikers_beheren", label: "Gebruikers beheren", uitleg: "Rollen toekennen en accounts blokkeren." },
  { id: "definitief_verwijderen", label: "Definitief verwijderen", uitleg: "Gearchiveerde partner op verzoek wissen (AVG)." },
  { id: "volledige_export", label: "Volledige data-export", uitleg: "Het complete bestand exporteren als CSV en JSON." }
];
const ROLLEN_GEBRUIKER: Gebruikersrol[] = ["gebruiker", "beheerder"];

export default async function BeheerPagina() {
  const [db, gebruiker] = await Promise.all([getDb(), huidigeGebruiker()]);
  const magBeheren = heeftRecht(gebruiker.rol, "beheer");

  return (
    <>
      <PaginaKop eyebrow="Beheer" titel="Instellingen" intro="AI-verrijking en discovery, rollen en rechten, volledige export en opslag. Factoren, gewichten, goudstandaard, gebruikers, AI-verbruik en auditlog staan in het menu onder Beheer." />
      {!magBeheren ? <Melding soort="waarschuwing">U bent ingelogd als {gebruiker.naam} ({gebruiker.rol}). Beheerfuncties zijn alleen-lezen; wissel rechtsboven naar Beheerder om te wijzigen.</Melding> : null}



      <div className="raster raster-zij">
        <div>
          {/* US-48 */}
          <Kaart titel="AI-verrijking en discovery">
            <Instellingen instellingen={db.instellingen} magBeheren={magBeheren} />
            <details className="uitklap" style={{ marginTop: 14 }}>
              <summary>Hoe werkt de afscherming?</summary>
              <ul className="lijst klein-tekst" style={{ marginTop: 8 }}>
                <li>Zonder ingericht taalmodel draaien verrijking, discovery, chat en samenvattingen volledig lokaal op regels; er gaat geen data naar een modelleverancier en er worden geen AI-bewerkingen geteld.</li>
                <li>Met sleutel gebruikt elke functie het ingestelde model (Beheer → AI-verbruik). Alleen openbare bedrijfsteksten (website, referenties, aangeleverde documenten) gaan mee; nooit contactpersonen, financiële cijfers of evaluaties.</li>
                <li>&ldquo;Afgeschermde omgeving&rdquo; markeert dat verwerking binnen de eigen (Blauwhoed-)omgeving blijft; &ldquo;externe bronnen&rdquo; bepaalt of partnerwebsites opgehaald mogen worden.</li>
              </ul>
            </details>
          </Kaart>

          {/* US-45 */}
          <Kaart titel="Rollen en rechten">
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
            <p className="muted klein-tekst">Twee rollen conform de overeenkomst; het aantal gebruikers is onbeperkt. Rollen toekennen: <Link href="/beheer/gebruikers">gebruikersbeheer</Link>.</p>
          </Kaart>
        </div>

        <div>
          <Kaart titel="Volledige data-export">
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
              <div><dt>Omgeving</dt><dd>{OMGEVING_LABEL[bepaalOmgeving()]}</dd></div>
              <div><dt>Opslag</dt><dd>{process.env.DATABASE_URL ? `Neon (JSONB-snapshot) · ${databaseAanduiding(process.env.DATABASE_URL)}` : "In-memory (seed)"}</dd></div>
            </dl>
          </Kaart>
        </div>
      </div>
    </>
  );
}
