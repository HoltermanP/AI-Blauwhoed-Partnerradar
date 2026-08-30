# Blauwhoed – Slimme Partnerdatabase

Next.js-applicatie die de backlog in [docs/userstories.md](docs/userstories.md) implementeert: een factorenmodel met beheerbare waardenlijsten, uitlegbare hybride matching (harde filters → gewogen score → semantische gelijkenis), historie als bewijs, discovery van onbekende partners, verrijking uit openbare bronnen, kwalificatie en risico, teamsamenstelling, leren van beslissingen en beheer/rechten/AVG.

## Starten

Vereist Node.js 20.9 of nieuwer.

```bash
npm install
npm run dev        # http://localhost:3000
npm run smoke      # rooktest van de domeinlogica (matching, team, afleiding, discovery, verrijking)
npm run typecheck
```

## Productiegebruik (echte data)

De database start **leeg** (alleen het factorenmodel en de gewichtsprofielen). Vul hem met:

- **Partners → Importeren (Excel/CSV)** — herkent de kolommen van het Blauwhoed-overzicht houtbouwers en generieke lijsten (Organisatie, KVK, Plaats, Website, Rol, kenmerkkolommen); één klik laadt het meegeleverde overzicht (116 rijen, 103 organisaties).
- **Discovery** — keyless webzoek-connector (zoekt bedrijfswebsites op branchetermen/regio en leest naam, KVK, plaats en profiel) en de **KVK Zoeken API** zodra `KVK_API_KEY` is gezet. Kandidaten komen in de wachtrij; pas na acceptatie worden ze prospect.
- **Verrijking** — leest de website van elke partner en stelt factorwaarden voor (bron `web`, aantoonbaar vs geclaimd); met `ANTHROPIC_API_KEY` doet Claude de extractie, samenvattingen en projectextractie uit documenten.
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
src/lib/actions.ts  alle server actions; rechten (US-45) en auditlog (US-46)
src/lib/auth.ts     rollen en rechten (demo via cookie; koppel aan SSO)
src/lib/store.ts    in-memory database + optionele Neon-snapshot
src/app/            schermen: dashboard, partners, projecten (match, team, evaluaties), zoeken, kaart,
                    historie, discovery, verrijking, beheer (factoren, gewichten, audit, instellingen)
src/app/radar/      legacy prototype (Excel-import houtbouwers)
```

## Rollen (demo)

Wissel rechtsboven van gebruiker: lezer, ontwikkelingsmanager (bewerker), inkoper, beheerder. Prospects promoveren en preferred/geblokkeerd zetten is een inkooprol; factoren en gewichten beheren is een beheerrol.

## AI en externe bronnen

Zonder `ANTHROPIC_API_KEY` draaien extractie, samenvatting en semantiek lokaal met regels en een deterministische embedding. Met sleutel gebruikt `src/lib/ai.ts` Claude (`claude-opus-5`, structured outputs) voor kandidaat-samenvattingen, factor-extractie uit websites en projectextractie uit documenten; er gaan uitsluitend openbare bedrijfs- en projectteksten mee, nooit contactpersonen. Externe bronnen (websites, registers) staan standaard aan en zijn uit te zetten in Beheer.

## Periodieke verrijking

`POST /api/verrijking/run` met header `x-cron-secret: $CRON_SECRET` draait een verrijkingsronde; alleen wijzigingen komen ter controle in de wachtrij (US-31).
