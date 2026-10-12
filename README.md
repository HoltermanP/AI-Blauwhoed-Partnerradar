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

## User stories demo oktober 2026 (US-01 t/m US-33)

Status per story in [docs/userstories-demo-oktober-2026.md](docs/userstories-demo-oktober-2026.md). De belangrijkste wijzigingen:

- **Partnertypes houtbouwer en constructeur** met een eigen goudstandaard. Houtbouwer: MPG, Paris Proof, productietijd, levertijd, kosten per m² en productinformatie verplicht (nieuwe factoren D7, E5, E6, G6, C5); de architect heeft een kleinere vaste set. Per veld instelbaar of een beheerdersverificatie nodig is.
- **Datakwaliteit** (`/datakwaliteit`): vullingsgraad van de verplichte velden per type en per veld met doorklik naar de partners waar iets ontbreekt (en direct verrijken), signalen voor ontbrekende, verouderde en onbetrouwbare waarden (filter op soort, type en veld) en de verouderingstermijn per veld (ook basisvelden).
- **Status per waarde**: voorstel, gebruikersgeverifieerd, beheerdersgeverifieerd of afgewezen, met bron-URL, ophaaldatum en betrouwbaarheid. Afwijzen en corrigeren gaan met reden; een afgewezen waarde komt niet automatisch terug. Projectclassificaties zijn te corrigeren.
- **Voorstellen**: zonder bron geen voorstel; per stuk accepteren, aanpassen of afwijzen, of in bulk. Accepteren = gebruikersgeverifieerd; kritische velden valideert een beheerder in de werklijst (`/vrijgave` → Beheerdersvalidatie).
- **Bronbeleid**: bronnen met een kwaliteitsrang (eigen uitgave 1, branchebron 2, web 3) die meetelt in de betrouwbaarheid; gebruikers stellen bronnen voor, beheer keurt goed. Startlijst met branchebronnen en prijzen/nominaties (discovery-modus *upcoming*).
- **Concepten**: vrijgeven, afwijzen of samenvoegen met een bestaande partner. AI-registratie werkt ook met alleen een vrije omschrijving (de app zoekt de website op).
- **Matching**: per rol een dekkingspercentage met waarschuwing onder de drempel en links naar de ontbrekende criteria; schuifjes per criterium die de rangschikking direct herberekenen, op te slaan op het project of als profiel. De onderbouwing legt uit hoe betrouwbaarheid en eigen evaluaties meewegen en citeert de ervaringstekst.
- **Evaluaties**: tussentijds of na oplevering, over de organisatie (geen personen), met vrije ervaringstekst; alleen geaccepteerde evaluaties tellen mee. Evaluatieoverzicht per project en verantwoordelijke ontwikkelaar met herinnering (`/evaluaties`).
- **Verbanden**: signaal of door een beheerder bevestigde samenwerking; terugkerende teamcombinaties; bewezen teams als voorstel op de teampagina.
- **Projecten**: import uit Business Central/ERP (CSV/Excel, projectnummer als sleutel, samenvoegen met webprojecten, bron zichtbaar); API voor de tenderapplicatie.
- **Zoeken**: de AI-chat is de primaire ingang (ook vanaf het dashboard), klassiek zoeken staat ernaast; resultaten met label database/internet en de melding dat zoeken geen matchadvies is.
- **Verbruik** uitgesplitst naar verrijking, discovery en chat; meldingen bij 80% en 100%.
- **Privacy** (`/privacy`): AI-aanbieder en modellen, verwerkingslocatie, geen training, geen contactpersonen (velden verwijderd; oude registraties alleen op verzoek wissen) en inloggen via Entra ID (SSO, 2FA via Conditional Access).

**Standaardweging** (Beheer → Gewichten): aandeel eigen ervaring (geaccepteerde evaluaties) per rol tegenover openbare bronnen, aandeel samenwerking in de teamscore, standaardprofiel en de correctie voor lage dekking (ontbrekende criteria tellen als neutraal, zodat een partner met weinig gegevens niet bovenaan eindigt). **Eigenaarschap evaluaties** (`/evaluaties`): ontwikkelaar per project levert, procesbewaker bewaakt, instelbare herinneringstermijn, filter op eigen projecten. **Externe projecten** (`/verbanden`): uit een openbare bron, met automatisch herkende partners; alleen samenwerkingssignaal. LinkedIn wordt niet gelezen, alleen als bronvermelding gebruikt.

De database migreert automatisch naar versie 14 (nieuwe factoren, types, bronnen, evaluatiestatus); bestaande gegevens blijven staan.

| Variabele | Betekenis |
| --- | --- |
| `TENDER_API_KEY` | sleutel voor `POST /api/tender/selectie` (header `Authorization: Bearer …`); zonder sleutel staat de koppeling uit |
| `AI_VERWERKING_REGIO` | zet op `eu` zodra Europese AI-verwerking contractueel is vastgelegd; de privacypagina toont het dan als aangetoond |

Voorbeeld tenderkoppeling:

```bash
curl -X POST https://<domein>/api/tender/selectie -H "Authorization: Bearer $TENDER_API_KEY" -H "content-type: application/json" \
  -d '{"project":{"naam":"Tender Wijk X","plaats":"Utrecht","woningen":80,"type":"appartementen","ambitieDuurzaamheid":4,"tenderId":"T-2026-12"},"rollen":["architect","houtbouwer"]}'
```

## Aanvulling overeenkomst v3.1 (Epic 12, US-49 t/m US-70)

Zie [docs/userstories.md](docs/userstories.md) voor de status per story. Kort:

- **Automatisch invullen met verificatielabel**: de verrijking (AI, websites, KVK, registers, eigen uitgaven, documenten) vult lege en niet-geverifieerde kenmerken en basisvelden direct in met het label *niet geverifieerd*; een gebruiker of beheerder verifieert ze met één klik (label *geverifieerd door gebruiker* resp. *geverifieerd door beheerder*). Een geverifieerde waarde of de goudstandaard wordt nooit automatisch overschreven: afwijkingen blijven een voorstel in de wachtrij. Uit te zetten in Beheer → Instellingen.
- **Verificatie telt mee in de matching**: de fit van een waarde werkt volledig door als een beheerder of de projecthistorie haar onderbouwt, voor 85% als een gebruiker haar verifieerde, voor 50% als ze niet geverifieerd is en voor 30% als ze verouderd is (`VERIFICATIE_WEGING` in `src/lib/domain/verificatie.ts`). Per kandidaat staan de verificatiegraad en het label per criterium; harde eisen die alleen op niet-geverifieerde waarden zijn doorstaan krijgen een waarschuwing.
- **Onderbouwing bij elke match**: elke kandidaat krijgt bij de matching een toelichting in gewone taal (waarom hij past, waar hij minder sterk is, wat geverifieerd is en wat ontbreekt). Met AI-sleutel schrijft het model na elke matchrun automatisch een lopende toelichting voor de top van elke rol (één AI-bewerking per run).
- **De mens beslist**: elk AI-voorstel (AI-registratie, geaccepteerde discovery-kandidaat, AI-aandraag vanuit een zoekprofiel) is een **concept** en telt nergens mee tot een **beheerder** het vrijgeeft in `/vrijgave`.
- **Goudstandaard en bronrang** (`/beheer/goudstandaard`): per partnertype verplichte/gewenste velden; bronnen in rang 1 (goudstandaard, eigen uitgaven zoals Conceptenboulevard), 2 (documenten, opgave, projecthistorie, KVK, registers) en 3 (internet, "indicatief – niet gevalideerd"). AI overschrijft rang 1 nooit; gevalideerde waarden nooit stilzwijgend.
- **Herkomst per basisveld** (bron, datum, hoog/midden/laag, status) en de markering **"geen betrouwbare bron"**.
- **AI-verbruik in bewerkingen** (`/beheer/verbruik`): één verrijkte partner = één bewerking; budget 750 bewerkingen per maand (zonder bedragen; verbruik in bewerkingen en tokens), signalen 80%/100%/125%/kwartaal 110%, specificatie in CSV/Excel, model per functie.
- **Verrijkingsschema** (Verrijking): frequentie, dag/tijd en omvang; dagelijkse cron via `vercel.json`.
- **Bronnen**: KVK Basisprofiel, tekst uit geüploade PDF/Word-documenten, openbare keurmerkregisters.
- **Projectnummer en tevredenheidsscore** per project; **Excel-exports**; **volledige data-export** (JSON en CSV-zip); **definitief verwijderen** (AVG) van gearchiveerde partners.
- **Inloggen met Microsoft Entra ID** en twee rollen: gebruiker en beheerder.

## Omgevingen (OTAP)

Eén Vercel-project, drie omgevingen, elk met een eigen Neon-database:

| Omgeving | Git-branch | Vercel | Database (Neon-branch) | Inloggen |
| --- | --- | --- | --- | --- |
| Test | `test` | Preview, branch-domein bijv. `test-partnerradar.vercel.app` | `test` (lege of demodata) | open met rolwisselaar (`AUTH_DEMO_MODUS=1`) |
| Acceptatie | `acceptatie` | Preview, branch-domein bijv. `acceptatie-partnerradar.vercel.app` | `acceptatie` (kopie van productie) | Entra ID, zoals productie |
| Productie | `master` | Production | `main` | Entra ID |

Werkwijze: wijzigingen gaan eerst naar `test` (merge of push), na akkoord van het team door naar `acceptatie` (gebruikers testen met realistische data) en pas daarna naar `master`:

```bash
git checkout test && git merge <feature-branch> && git push        # → testomgeving
git checkout acceptatie && git merge test && git push              # → acceptatieomgeving
git checkout master && git merge acceptatie && git push            # → productie
```

Buiten productie staat bovenaan een gekleurde balk met de omgeving en het Neon-endpoint van de database; de paginatitel krijgt `[Test]` of `[Acceptatie]` en zoekmachines worden geweerd. De omgeving wordt afgeleid uit Vercel (branch `acceptatie` = acceptatie, overige previews = test) en kan worden vastgezet met `OMGEVING`. De dagelijkse verrijkingscron draait alleen op productie (Vercel Cron draait niet op previews).

### Eenmalig inrichten

1. **Neon**: maak in het Neon-project twee branches vanaf `main`: `acceptatie` (krijgt een kopie van de productiedata; ververs later met *Reset from parent*) en `test` (maak daarna leeg via Beheer → "Database leegmaken", of laad demodata). Kopieer per branch de connection string (pooled).
2. **Vercel → Settings → Environment Variables**: zet de huidige waarden alleen op *Production* en voeg per branch *Preview*-waarden toe (bij "Preview" een specifieke branch kiezen):
   - `DATABASE_URL`: de connection string van de Neon-branch **(nooit de productiedatabase op een preview)**;
   - `test`: `AUTH_DEMO_MODUS=1`, eventueel `DEMO_DATA=1`; `acceptatie`: de Entra-variabelen en een eigen `AUTH_SECRET`;
   - `ANTHROPIC_API_KEY`, `KVK_API_KEY`: eigen (of dezelfde) sleutels; het AI-budget geldt per database, dus per omgeving;
   - `BLOB_READ_WRITE_TOKEN`: bij voorkeur een aparte Blob-store voor test/acceptatie.
3. **Vercel → Settings → Domains**: voeg de twee domeinen toe en koppel ze aan *Git Branch* `test` resp. `acceptatie`.
4. **Entra ID**: voeg voor acceptatie de redirect-URI `https://<acceptatiedomein>/api/auth/callback/microsoft-entra-id` toe aan de app-registratie.
5. Controleer na de eerste deployment op elke omgeving de balk bovenaan (en Beheer → Omgeving/Opslag): het Neon-endpoint moet bij de juiste branch horen.

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
| `AUTH_DEMO_MODUS` | testfase: `1` = altijd open zonder inloggen (rolwisselaar), ook met Entra ingericht; `0` = altijd dicht; leeg = open zolang Entra niet is ingericht |

De issuer met de tenant-ID van Blauwhoed is verplicht; accounts uit andere tenants worden geweigerd (controle op `tid`). Redirect-URI in Entra ID: `https://<domein>/api/auth/callback/microsoft-entra-id`. Zolang Entra ID niet is ingericht staat de app (testfase) open met de rolwisselaar (gebruiker/beheerder); zet `AUTH_DEMO_MODUS=0` of richt Entra in om hem af te sluiten. **Let op:** in de testfase is de app voor iedereen met de URL toegankelijk. Accounts ontstaan bij de eerste inlog; de beheerder kent rollen toe onder Beheer → Gebruikers.

## Nieuw in deze fase (acht onderdelen + twee dwarsdoorsnijdende eisen)

- **Eis 1 — herkomst en status per gegeven**: elke waarde draagt bron, datum, betrouwbaarheid en status (voorgesteld / gevalideerd / verouderd). Alleen een mens valideert; een herverrijking die iets anders vindt wordt een signaal naast de gevalideerde waarde ("wijkt af van gevalideerd"); per veld is een vervaltermijn instelbaar (Beheer → Factoren); herkomst is per partner exporteerbaar en verwijderbaar (AVG, partnertab Brondata).
- **Eis 2 — kosten per AI-bewerking**: één gebruikershandeling = één bewerking met daaronder de modelaanroepen (tokens, model, kosten, tijdstip, gebruiker of "systeem"). Beheer toont maandverbruik tegen een instelbaar budget met 80%-melding; boven budget starten geplande rondes niet en houden interactieve functies voorrang; het verrijkingsscherm toont vooraf verwachte bewerkingen en kosten.
- **Verrijking**: bij aanmaken, op verzoek (knop op elk dossier) en als hervatbare ronde (knop of cron). Rondes hebben een verschillenoverzicht (nieuw / gewijzigd / niet langer bevestigd / ongewijzigd overgeslagen via inhoudshash); extra openbare bronnen zijn configuratie, geen code.
- **Zoeken**: op /zoeken staan klassiek zoeken (semantisch, zonder AI) en een AI-chat die de database doorzoekt naast elkaar, met de keuze "alleen database" of "database + internet". Elk resultaat en elk chatantwoord vermeldt zijn bronnen (partnerdossiers en, met internet, de webpagina's). Gecombineerd filteren met kolomkeuze staat op /partners; /chat verwijst door naar /zoeken.
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
