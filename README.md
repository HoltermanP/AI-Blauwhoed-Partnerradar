# Blauwhoed – Slimme Partnerdatabase

Next.js-applicatie die de backlog in [docs/userstories.md](docs/userstories.md) implementeert: een factorenmodel met beheerbare waardenlijsten, uitlegbare hybride matching (harde filters → gewogen score → semantische gelijkenis), historie als bewijs, discovery van onbekende partners, verrijking uit openbare bronnen, kwalificatie en risico, teamsamenstelling, leren van beslissingen en beheer/rechten/AVG.

## Starten

Vereist Node.js 20.9 of nieuwer.

```bash
npm install
npm run dev        # http://localhost:3000
npm run smoke      # rooktest van de domeinlogica (matching, team, afleiding, discovery, verrijking, v3.1)
npm run typecheck
npm run lint       # eslint (next lint bestaat niet meer in Next 16)
node scripts/schermcontrole.mjs http://localhost:3000 /tmp/shots u-beheer / /partners   # schermcontrole desktop/tablet/telefoon (Chrome)
```

> Tip bij lokaal testen: `.env.local` kan naar de echte Neon-database wijzen. Wie lokaal wil experimenteren zonder die data te migreren of te wijzigen, start met `DATABASE_URL= ANTHROPIC_API_KEY= npm run dev` (in-memory, zonder AI-kosten).

## Aanvulling overeenkomst v3.1 (Epic 12, US-49 t/m US-70)

Zie [docs/userstories.md](docs/userstories.md) voor de status per story. Kort:

- **De mens beslist**: elk AI-voorstel (AI-registratie, geaccepteerde discovery-kandidaat, AI-aandraag vanuit een zoekprofiel) is een **concept** en telt nergens mee tot een **beheerder** het vrijgeeft in `/vrijgave`.
- **Goudstandaard en bronrang** (`/beheer/goudstandaard`): per partnertype verplichte/gewenste velden; bronnen in rang 1 (goudstandaard, eigen uitgaven zoals Conceptenboulevard), 2 (documenten, opgave, projecthistorie, KVK, registers) en 3 (internet, "indicatief – niet gevalideerd"). AI overschrijft rang 1 nooit; gevalideerde waarden nooit stilzwijgend.
- **Herkomst per basisveld** (bron, datum, hoog/midden/laag, status) en de markering **"geen betrouwbare bron"**.
- **AI-verbruik in bewerkingen** (`/beheer/verbruik`): één verrijkte partner = één bewerking; budget 750 bewerkingen en € 30, rekenprijzen in euro, signalen 80%/125%/kwartaal 110%, specificatie in CSV/Excel, model per functie.
- **Verrijkingsschema** (Verrijking): frequentie, dag/tijd en omvang; dagelijkse cron via `vercel.json`.
- **Bronnen**: KVK Basisprofiel, tekst uit geüploade PDF/Word-documenten, openbare keurmerkregisters.
- **Projectnummer en tevredenheidsscore** per project; **Excel-exports**; **volledige data-export** (JSON en CSV-zip); **definitief verwijderen** (AVG) van gearchiveerde partners.
- **Inloggen met Microsoft Entra ID** en twee rollen: gebruiker en beheerder.

## Inloggen (US-64)

Auth.js (next-auth v5) met Microsoft Entra ID. Zet in Vercel (en lokaal indien gewenst):

| Variabele | Betekenis |
| --- | --- |
| `AUTH_SECRET` | willekeurige geheime sleutel (`npx auth secret`) |
| `AUTH_MICROSOFT_ENTRA_ID_ID` | Application (client) ID van de app-registratie in de Blauwhoed-tenant |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | client secret van die app-registratie |
| `AUTH_MICROSOFT_ENTRA_ID_ISSUER` | `https://login.microsoftonline.com/<tenant-id>/v2.0/` |
| `AUTH_TOEGESTANE_DOMEINEN` | toegestane e-maildomeinen, kommagescheiden (standaard `blauwhoed.nl`) |
| `EERSTE_BEHEERDER_EMAIL` | e-mailadres dat altijd beheerder is |
| `AUTH_DEMO_MODUS` | alleen voor demo's: `1` opent de app zonder inloggen met de rolwisselaar (nooit in productie) |

De issuer met de tenant-ID van Blauwhoed is verplicht; accounts uit andere tenants worden geweigerd (controle op `tid`). Redirect-URI in Entra ID: `https://<domein>/api/auth/callback/microsoft-entra-id`. Zonder deze configuratie is de app in productie **dicht** (alleen de inlogpagina); in ontwikkelmodus werkt de rolwisselaar (gebruiker/beheerder). Accounts ontstaan bij de eerste inlog; de beheerder kent rollen toe onder Beheer → Gebruikers.

## Nieuw in deze fase (acht onderdelen + twee dwarsdoorsnijdende eisen)

- **Eis 1 — herkomst en status per gegeven**: elke waarde draagt bron, datum, betrouwbaarheid en status (voorgesteld / gevalideerd / verouderd). Alleen een mens valideert; een herverrijking die iets anders vindt wordt een signaal naast de gevalideerde waarde ("wijkt af van gevalideerd"); per veld is een vervaltermijn instelbaar (Beheer → Factoren); herkomst is per partner exporteerbaar en verwijderbaar (AVG, partnertab Brondata).
- **Eis 2 — kosten per AI-bewerking**: één gebruikershandeling = één bewerking met daaronder de modelaanroepen (tokens, model, kosten, tijdstip, gebruiker of "systeem"). Beheer toont maandverbruik tegen een instelbaar budget met 80%-melding; boven budget starten geplande rondes niet en houden interactieve functies voorrang; het verrijkingsscherm toont vooraf verwachte bewerkingen en kosten.
- **Verrijking**: bij aanmaken, op verzoek (knop op elk dossier) en als hervatbare ronde (knop of cron). Rondes hebben een verschillenoverzicht (nieuw / gewijzigd / niet langer bevestigd / ongewijzigd overgeslagen via inhoudshash); extra openbare bronnen zijn configuratie, geen code.
- **Zoeken — drie ingangen**: AI-chat (/chat, verwijst altijd naar onderliggende partnerrecords), klassiek filteren met kolomkeuze (/partners), semantisch zoeken (/zoeken).
- **Verbanden** (/verbanden): afgeleid uit gedeelde projecthistorie en openbare vermeldingen, altijd met bron, gepresenteerd als signaal.
- **Overig**: archiveren i.p.v. verwijderen (status gearchiveerd, buiten zoeken/matching/verbanden), documenten per partner (URL/tekst), CSV- én PDF-export van partners en projecthistorie plus een PDF-dossier per partner (incl. herkomststatus per waarde), bestandsuploads bij partnerdocumenten via Vercel Blob (zet `BLOB_READ_WRITE_TOKEN`; zonder token blijven URL/tekst-documenten werken), datakwaliteit per veld en partnertype (Beheer), veldkoppeling en fuzzy dubbelencontrole bij import, opgeslagen zoekprofielen voor discovery.
- **Partnerregistratie door AI**: op *Nieuwe partner* kan een bewerker een partner laten registreren uit naam, website en/of geplakte tekst. Claude (of zonder sleutel de regelgebaseerde extractie) vult de basisgegevens met herkomst per veld; de partner krijgt status `ter_controle` en telt niet mee in zoeken, matching, verbanden, chat en exports. Alleen de beheerder (recht `partners_vrijgeven`) geeft hem vrij als bekend of prospect, of wijst hem af; daarna volgt automatisch een verrijking van de factorwaarden.

## Productiegebruik (echte data)

**Hosting**: stel op productie `DATABASE_URL` (Neon) in. Zonder die variabele bouwt elke serverless-instantie zijn eigen in-memory database op; lezen werkt (IDs zijn stabiel en naam-gebaseerd, bijv. `p-giesbers`), maar wijzigingen gaan verloren zodra een instantie wordt gerecycled. Een opgeslagen database wordt bij het laden automatisch gemigreerd naar de huidige versie (`src/lib/domain/migratie.ts`: tijdstempel-IDs → stabiele IDs, aanvullende dataset) en direct teruggeschreven.

De database start **leeg** (alleen het factorenmodel en de gewichtsprofielen). Vul hem met:

- **Partners → Importeren (Excel/CSV)** — herkent de kolommen van het Blauwhoed-overzicht houtbouwers en generieke lijsten (Organisatie, KVK, Plaats, Website, Rol, kenmerkkolommen); één klik laadt het meegeleverde overzicht (116 rijen, 103 organisaties).
- **Discovery** — keyless webzoek-connector (zoekt bedrijfswebsites op branchetermen/regio en leest naam, KVK, plaats en profiel) en de **KVK Zoeken API** zodra `KVK_API_KEY` is gezet. Kandidaten komen in de wachtrij; pas na acceptatie worden ze prospect.
- **Aanvullende dataset** (`src/data/aanvulling-seed.json`, peildatum 30-08-2026) — wordt bij de eerste start automatisch bovenop het houtbouwersoverzicht geladen en is via **Beheer → Aanvullende partners en projecten laden** herlaadbaar in een bestaande database (alleen aanvullen, nooit overschrijven). Inhoud, samengesteld uit openbare webbronnen (bedrijfswebsites, persberichten, projectpagina's van blauwhoed.nl en partners): 20 echte Blauwhoed-projecten (o.a. Casa Vita, Ons Erf/Lincolnpark, Timbr Zaandam, De Glasfabriek, Defensie-eiland, Poort van Hoorn), ±80 partners die daar aantoonbaar bij betrokken zijn of relevant zijn voor duurzame woningbouw (architecten, constructeurs/houtbouwadviseurs, bouwfysica, installateurs met warmtepomp/WKO, CLT/HSB-leveranciers, corporaties/beleggers/mede-ontwikkelaars) met bron-URL, betrokkenheden per project, en websites/plaatsen van 83 houtbouwers uit het overzicht. Planning en woningaantallen die niet gepubliceerd zijn, staan als schatting gemarkeerd in de projectomschrijving.
- **Verrijking via internet** — per partner (knop *Verrijken via internet* op het dossier) of in rondes van 20 (Verrijking-pagina). Zoekt de website op als die ontbreekt (DuckDuckGo, hostnaam moet bij de naam passen), leest home/over ons/projecten/duurzaamheid en doet voorstellen voor website, KVK-nummer, vestigingsplaats, omschrijving, referentieprojecten en factorwaarden (bron `web`, aantoonbaar vs geclaimd). Voorstellen staan op het partnerdossier en in de wachtrij; pas na acceptatie worden ze overgenomen. Met `ANTHROPIC_API_KEY` doet Claude daarnaast de factorextractie, samenvattingen en projectextractie uit documenten.
- **Historie → CSV-import** van de projectadministratie (match op KVK of crediteurnummer).

Geocoding loopt via de PDOK Locatieserver (Kadaster, gratis, geen sleutel); elke plaats of adres in Nederland werkt. Persistentie: zet `DATABASE_URL` (Neon) — de staat wordt direct na elke wijziging weggeschreven in `partnerdb_state`. Zonder `DATABASE_URL` leeft de data alleen in het procesgeheugen. Het genormaliseerde doelschema met PostGIS en pgvector staat in [db/schema.sql](db/schema.sql).

Demodata (fictieve bedrijven) is alleen voor demonstraties: `DEMO_DATA=1` bij het starten of Beheer → "Demodata laden".

## Structuur

```
src/lib/domain/
  types.ts        domeinmodel (partner, factor, project, engagement, evaluatie, discovery, matchrun, team, ...)
  factors.ts      factorencatalogus hoofdstuk 3 (configuratie, geen migratie)
  gewichten.ts    standaard gewichtsprofielen (US-10) met versiebeheer (US-44)
  matching.ts     harde filters (US-14), gewogen score met dekkingsgraad (US-04b), semantiek (US-15), uitleg (US-13)
  derive.ts       afleiding uit projecthistorie en evaluaties (US-19/20/22/33)
  team.ts         teamsamenstelling en teamscore (US-35 t/m US-37)
  signalen.ts     dashboard-signalen: certificaten, risico, afhankelijkheid, prospects, evaluaties
  discovery.ts    bronconnectors, dubbelherkenning (US-26), samenvatting (US-27), promotie naar prospect
  enrichment.ts   extractie volgens taxonomie (US-29), aantoonbaar vs geclaimd (US-30)
  extractie.ts    projectprofiel voorvullen uit document met herkomst (US-11)
  csv.ts          import projectadministratie met controlewachtrij (US-18)
  embedding.ts    lokale deterministische embedding (geen data naar modelleveranciers, US-48)
  geo.ts          afstand en geocoding zonder externe dienst
  seed.ts         demodata
src/lib/actions.ts  server actions (partners, projecten, historie, discovery, verrijking); rechten en auditlog
src/lib/acties/     server actions per domein (v3.1): goudstandaard, gebruikers, beheer (budget, modellen, schema,
                    registers), aandragen, analyse (match-onderbouwing, verbanden), sessie
src/lib/auth.ts     rollen en rechten; src/lib/sessie.ts ingelogde gebruiker; src/authjs.ts Auth.js + Entra ID;
                    src/proxy.ts afscherming van alle routes
src/lib/domain/     (v3.1) herkomst, goudstandaard, voorstellen, kosten, schema, aandragen, registers, kvk, tevredenheid,
                    verwijderen, volledigeExport, onderbouwing, zichtbaarheid, gebruikers
src/lib/xlsx.ts     Excel-export; src/lib/zip.ts zip lezen/schrijven; src/lib/documenttekst.ts tekst uit PDF/Word
src/lib/store.ts    in-memory database + optionele Neon-snapshot
src/app/            schermen: dashboard, partners, projecten (match, team, evaluaties), zoeken, kaart,
                    historie, discovery, verrijking, beheer (factoren, gewichten, audit, instellingen)
src/app/radar/      legacy prototype (Excel-import houtbouwers)
```

## Rollen (US-65)

Twee rollen: **gebruiker** (lezen, bewerken, evalueren, discovery beoordelen, kwalificeren, preferred/geblokkeerd) en **beheerder** (daarnaast: AI-voorstellen vrijgeven, weging, verrijkingsschema, goudstandaard, bronnen/budget/modellen, factoren, definitief verwijderen, volledige export, gebruikersbeheer). Het aantal gebruikers is onbeperkt. In ontwikkelmodus wissel je rechtsboven tussen de twee demo-rollen.

## AI en externe bronnen

Zonder `ANTHROPIC_API_KEY` draaien extractie, samenvatting en semantiek lokaal met regels en een deterministische embedding. Met sleutel gebruikt `src/lib/ai.ts` Claude met per functie een instelbaar model (standaard Haiku 4.5 voor extractie en aandragen, Sonnet 5 voor chat, match en verband; structured outputs) voor kandidaat-samenvattingen, factor-extractie uit websites en projectextractie uit documenten; er gaan uitsluitend openbare bedrijfs- en projectteksten mee, nooit contactpersonen. Externe bronnen (websites, registers) staan standaard aan en zijn uit te zetten in Beheer.

## Periodieke verrijking (US-56)

`vercel.json` laat Vercel Cron dagelijks om 05:00 UTC `GET /api/verrijking/run` aanroepen (met `Authorization: Bearer $CRON_SECRET`; handmatig kan ook `POST` met header `x-cron-secret`). Het endpoint start een ronde zodra het in het verrijkingsschema geplande moment is verstreken, hervat een lopende geplande ronde en geeft de volgende geplande ronde terug. Een ronde die het AI-maandbudget zou overschrijden start niet; de beheerder krijgt een signaal. In productie is `CRON_SECRET` verplicht. Alleen wijzigingen komen ter controle in de wachtrij (US-31).
