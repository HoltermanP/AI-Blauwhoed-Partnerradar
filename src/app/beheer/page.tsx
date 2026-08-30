// Beheeroverzicht: instellingen (US-48), rollen/rechten (US-45), links naar factoren (US-04), gewichten (US-44), audit (US-46).
import Link from "next/link";
import { heeftRecht, GEBRUIKERS } from "@/lib/auth";
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
  { id: "evalueren", label: "Evalueren", uitleg: "Partners na oplevering beoordelen (US-21)." },
  { id: "discovery_goedkeuren", label: "Discovery goedkeuren", uitleg: "Discovery-kandidaten accepteren, parkeren of afwijzen (US-25)." },
  { id: "prospect_promoveren", label: "Prospect promoveren", uitleg: "Prospect kwalificeren tot bekende partner (US-29)." },
  { id: "kwalificeren", label: "Kwalificeren", uitleg: "Kwalificatiechecklist en financiële toets afvinken." },
  { id: "beheer", label: "Beheer", uitleg: "Factoren, gewichtsprofielen, instellingen en demo-reset." }
];
const ROLLEN_GEBRUIKER: Gebruikersrol[] = ["lezer", "bewerker", "inkoper", "beheerder"];

export default async function BeheerPagina() {
  const [db, gebruiker] = await Promise.all([getDb(), huidigeGebruiker()]);
  const magBeheren = heeftRecht(gebruiker.rol, "beheer");
  const actieveFactoren = db.factoren.filter((f) => f.actief).length;

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
