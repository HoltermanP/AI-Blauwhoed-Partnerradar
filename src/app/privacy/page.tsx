// US-33: op één plek nagaan hoe de applicatie gegevens verwerkt: welke AI, waar, wat er meegaat, of er op getraind wordt en
// dat er geen persoonsgegevens van contactpersonen worden verwerkt. US-32: inloggen via SSO (Microsoft Entra ID) met 2FA.
// De statussen hieronder zijn afgeleid uit de actuele configuratie; wat contractueel moet worden vastgelegd staat erbij.
import Link from "next/link";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { authGeconfigureerd, demoModus } from "@/authjs";
import { FUNCTIE_LABEL, STANDAARD_MODELLEN } from "@/lib/domain/kosten";
import type { AIFunctie } from "@/lib/domain/types";
import { getDb } from "@/lib/store";
import { Badge, Kaart, Melding, PaginaKop } from "@/components/ui";
import ContactpersonenWissen from "@/components/privacy/ContactpersonenWissen";
import { aiVerwerking } from "@/lib/aiplatform";

function regioVanDatabase(url: string | undefined) {
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    return host.match(/\.((?:aws|azure|gcp)-)?([a-z]{2}-[a-z]+-\d)\./)?.[2] ?? host.match(/\.([a-z]{2}-[a-z]+-\d)\.aws\.neon/)?.[1] ?? null;
  } catch {
    return null;
  }
}

function Status({ ok, label, nvt }: { ok: boolean | null; label: string; nvt?: boolean }) {
  if (nvt) return <Badge kleur="grijs">n.v.t.</Badge>;
  return <Badge kleur={ok === null ? "geel" : ok ? "groen" : "rood"}>{label}</Badge>;
}

export default async function PrivacyPagina() {
  const [db, gebruiker] = await Promise.all([getDb(), huidigeGebruiker()]);
  const verwerking = aiVerwerking();
  const ai = verwerking.aan;
  const dbRegio = regioVanDatabase(process.env.DATABASE_URL);
  const dbEu = dbRegio ? dbRegio.startsWith("eu-") : null;
  const vercelRegio = process.env.VERCEL_REGION ?? null;
  const contactpersonen = db.partners.reduce((n, p) => n + p.contactpersonen.length, 0);
  const modellen = { ...STANDAARD_MODELLEN, ...(db.instellingen.modellen ?? {}) };
  const sso = authGeconfigureerd();
  const open = demoModus();
  return (
    <>
      <PaginaKop eyebrow="Verwerking en privacy" titel="Hoe de partnerdatabase gegevens verwerkt" intro="Voor ICT en privacy: welke AI wordt gebruikt en waar, welke gegevens meegaan, of er op wordt getraind, en dat er geen persoonsgegevens van contactpersonen worden verwerkt. De statussen zijn afgeleid uit de actuele configuratie van deze omgeving." />
      <Kaart titel="Samenvatting">
        <div className="tabelWrap">
          <table className="tabel">
            <tbody>
              <tr>
                <td>Geen persoonsgegevens van contactpersonen</td>
                <td>
                  <Status ok={contactpersonen === 0} label={contactpersonen === 0 ? "voldoet" : `${contactpersonen} oude registraties`} />
                </td>
                <td className="klein-tekst">Er zijn geen velden voor contactpersonen. Algemene bedrijfsgegevens (algemeen telefoonnummer, info-adres) zijn organisatiegegevens. Evaluaties gaan over de organisatie, nooit over een persoon; e-mailadressen en telefoonnummers in evaluatieteksten worden geweigerd.</td>
              </tr>
              <tr>
                <td>Niet trainen op gegevens</td>
                <td>
                  <Status ok={ai ? null : true} label={ai ? "contractueel bevestigen" : "geen externe AI"} />
                </td>
                <td className="klein-tekst">
                  {ai ? (
                    <>
                      De AI-functies gebruiken de commerciële API van Anthropic (Claude). Volgens de{" "}
                      <a href="https://www.anthropic.com/legal/commercial-terms" target="_blank" rel="noreferrer">
                        commerciële voorwaarden
                      </a>{" "}
                      worden API-invoer en -uitvoer standaard niet gebruikt om modellen te trainen. Leg dit vast in de verwerkersovereenkomst (DPA).
                    </>
                  ) : (
                    "Er is geen taalmodel ingericht: alle AI-functies draaien op lokale regels; er gaan geen gegevens naar een taalmodel."
                  )}
                </td>
              </tr>
              <tr>
                <td>Europese AI-verwerking</td>
                <td>
                  <Status ok={!ai ? true : verwerking.europees ? true : null} label={!ai ? "geen externe AI" : verwerking.europees ? "EU (vastgelegd)" : "niet aangetoond"} />
                </td>
                <td className="klein-tekst">
                  {!ai
                    ? "Niet van toepassing: er wordt geen extern taalmodel gebruikt."
                    : verwerking.europees
                      ? "Volgens de configuratie (AI_VERWERKING_REGIO=eu) is Europese verwerking contractueel vastgelegd."
                      : "De AI-functies gebruiken de Anthropic-API. Europese verwerking is daarbij niet vanzelf gegarandeerd; leg dit contractueel vast en zet daarna AI_VERWERKING_REGIO=eu, zodat deze status klopt."}
                </td>
              </tr>
              <tr>
                <td>Database</td>
                <td>
                  <Status ok={dbEu} label={dbRegio ?? (process.env.DATABASE_URL ? "regio onbekend" : "in-memory")} />
                </td>
                <td className="klein-tekst">Neon Postgres{dbRegio ? ` in regio ${dbRegio}` : ""}. De regio is afgeleid uit de verbindings-URL.</td>
              </tr>
              <tr>
                <td>Applicatieserver</td>
                <td>
                  <Status ok={vercelRegio ? /^(fra|cdg|arn|dub|lhr)/.test(vercelRegio) : null} label={vercelRegio ?? "onbekend"} />
                </td>
                <td className="klein-tekst">Vercel{vercelRegio ? `, functieregio ${vercelRegio}` : ""}. Stel de functieregio in op een Europese regio (bijv. fra1) in de Vercel-projectinstellingen.</td>
              </tr>
              <tr>
                <td>Inloggen met SSO en 2FA</td>
                <td>
                  <Status ok={sso && !open} label={open ? "open (testfase)" : sso ? "Entra ID (SSO)" : "niet ingericht"} />
                </td>
                <td className="klein-tekst">
                  Inloggen loopt via Microsoft Entra ID van Blauwhoed (single sign-on); accounts uit andere tenants worden geweigerd. Tweefactorauthenticatie wordt afgedwongen in Entra ID (Conditional Access of security defaults), niet in de app: daarmee geldt 2FA voor alle accounts.
                  {open ? " Let op: deze omgeving staat open zonder inloggen (demomodus); zet AUTH_DEMO_MODUS=0 voor productie." : ""}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Kaart>
      {contactpersonen > 0 ? (
        <Kaart titel="Oude registraties van contactpersonen">
          <Melding soort="waarschuwing">Er staan nog {contactpersonen} contactpersonen uit een eerdere versie in de database. Ze worden niet meer getoond of gebruikt, en gaan nooit mee naar AI. Wissen gebeurt alleen op uw verzoek.</Melding>
          {heeftRecht(gebruiker.rol, "beheer") ? <ContactpersonenWissen aantal={contactpersonen} /> : <p className="muted klein-tekst">Alleen de beheerder kan ze wissen.</p>}
        </Kaart>
      ) : null}
      <div className="raster raster-2">
        <Kaart titel="Wat gaat er naar het taalmodel?">
          <ul className="lijst klein-tekst">
            <li><b>Verrijking en AI-registratie:</b> openbare tekst van bedrijfswebsites, registers en door Blauwhoed aangeleverde documenten.</li>
            <li><b>Discovery:</b> zoekopdrachten (rol, trefwoorden, regio) en openbare bedrijfswebsites.</li>
            <li><b>Chat:</b> de vraag en een selectie partnerrecords: bedrijfsgegevens, kenmerken met bron en status, projecthistorie en de evaluatie op organisatieniveau (score en ervaringstekst).</li>
            <li><b>Matchonderbouwing:</b> scores per criterium en de ervaringstekst uit geaccepteerde evaluaties.</li>
            <li><b>Nooit:</b> contactpersonen, inloggegevens, financiële kerncijfers.</li>
          </ul>
          <p className="muted klein-tekst">Elke AI-handeling wordt geregistreerd (wie, wanneer, model, tokens): <Link href="/beheer/verbruik">AI-verbruik</Link>.</p>
        </Kaart>
        <Kaart titel="Model per functie">
          <ul className="lijst klein-tekst">
            {(Object.keys(FUNCTIE_LABEL) as AIFunctie[]).map((f) => (
              <li key={f}>
                {FUNCTIE_LABEL[f]}: <code>{modellen[f]}</code>
              </li>
            ))}
          </ul>
          <p className="muted klein-tekst">{ai ? `Aanbieder: ${verwerking.label}.` : "Geen taalmodel ingericht: deze modellen worden niet aangeroepen."}</p>
        </Kaart>
      </div>
      <Kaart titel="Bronnen buiten de eigen portefeuille">
        <ul className="lijst klein-tekst">
          <li>Projecten buiten de eigen portefeuille uit openbare bronnen leveren alleen samenwerkingssignalen op (met bron), nooit persoonsgegevens.</li>
          <li>LinkedIn wordt niet automatisch gelezen of gescraped (voorwaarden van LinkedIn en de AVG); een LinkedIn-bericht kan alleen als bronvermelding bij een handmatig vastgelegd extern project dienen.</li>
        </ul>
      </Kaart>
    </>
  );
}
