# Prompt voor Claude Code – Partnerdatabase aanvullen conform aanvullende overeenkomst v3.1

> Kopieer alles onder de streep als één prompt in Claude Code, gestart in `~/apps/Blauwhoed-partnerradar`.

---

Je werkt in de bestaande Next.js-app **Blauwhoed Partnerradar** (`~/apps/Blauwhoed-partnerradar`). De app is grotendeels gebouwd. Blauwhoed en AI-Group hebben een aanvullende overeenkomst gesloten (v3.1, 11 september 2026) die beschrijft wat de Partnerdatabase moet kunnen. Jouw opdracht: **vul de app aan met alleen de functionaliteit die nog ontbreekt of maar half werkt**. Bouw niets opnieuw dat al werkt en verander geen werkend gedrag zonder dat een story daarom vraagt.

## Werkwijze

1. **Oriënteer je eerst.** Lees `README.md`, `docs/userstories.md` (US-01 t/m US-48), `src/lib/domain/types.ts`, `src/lib/store.ts`, `src/lib/actions.ts`, `src/lib/auth.ts`, `src/lib/ai.ts`, `src/lib/domain/kosten.ts`, `src/lib/domain/herkomst.ts` en `scripts/smoke.ts`.
2. **Controleer per story hieronder of die echt nog ontbreekt.** De inventarisatie is gemaakt door de code te lezen, niet door de app te draaien. Is iets al (grotendeels) aanwezig, dan vul je alleen het gat en meld je dat.
3. **Volg de bestaande architectuur:**
   - Data zit in de JSON-store (`store.ts`) en muteert via `muteer()`, dat ook de auditregel schrijft.
   - Logica komt in `src/lib/domain/*`, server actions in `src/lib/actions.ts` (splits het bestand op per domein als het te groot wordt) en UI in `src/components/<domein>/`.
   - Styling in `src/app/globals.css` (geen Tailwind), iconen uit `lucide-react`, AI via `src/lib/ai.ts` met de bestaande regelgebaseerde fallback zonder API-sleutel.
   - Alle UI-teksten en code-commentaar in het Nederlands.
4. **Schemawijziging = migratie.** Voeg een nieuwe versie toe aan het bestaande migratiemechanisme van de store (zoals v8), zodat bestaande Neon-data blijft werken.
5. **Test.** Breid `scripts/smoke.ts` uit met asserts per story. Draai na elke story `npm run typecheck`, `npm run lint` en `npm run smoke`. Controleer UI-wijzigingen in de browser, ook op tablet- en telefoonbreedte.
6. **Leg vast.** Voeg de nieuwe stories toe aan `docs/userstories.md` als **Epic 12 – Aanvulling overeenkomst v3.1** (US-49 t/m US-70), met per story de status: gebouwd, aangevuld of al aanwezig.
7. **Werk in kleine stappen.** Doe per story (of per logische groep) één commit met het story-nummer in de commitboodschap.

## Harde uitgangspunten uit de overeenkomst

- **De mens beslist.** Een door AI voorgestelde partner is een *concept* en is pas zichtbaar in zoek-, match-, chat-, verband- en exportresultaten nadat een **beheerder** hem heeft vrijgegeven.
- **De goudstandaard van Blauwhoed gaat altijd voor op door AI gegenereerde waarden.**
- **Gevalideerde waarden worden bij herverrijking nooit stilzwijgend overschreven.** Alleen een mens zet een gegeven op *gevalideerd*.
- **Bij elk door AI aangevuld of afgeleid gegeven** tonen we de herkomst, de datum van vaststelling en een betrouwbaarheid *hoog/midden/laag*.
- **Beoordelingen en tevredenheidsscores** worden op organisatieniveau vastgelegd, nooit per contactpersoon. Er worden geen bijzondere persoonsgegevens verwerkt.
- **Gearchiveerde partners worden niet gewist.** Definitief verwijderen gebeurt alleen op expliciet verzoek, conform de AVG.
- **Het aantal gebruikers is onbeperkt.** Het budget ziet op AI-bewerkingen, niet op accounts.
- **Buiten scope:** Ontwerp-assistent, koppeling met ERP of het Agentic Platform, mobiele app, meertaligheid, partnerportaal voor externen, maatwerk-huisstijl, en betaalde bronnen of bronnen achter een login. Bouw daar niets voor.

---

## User stories

### A. Goudstandaard en datakwaliteit

**US-49 – Goudstandaard per partnertype**
Als beheerder wil ik per partnertype (rol) de datavelden en beoordelingscriteria vastleggen als *goudstandaard*, zodat de applicatie weet welke velden per type verplicht of gewenst zijn en welke waarden leidend zijn.
- Nieuw beheerscherm onder `/beheer` (of een uitbreiding van Beheer → Factoren): per partnertype de velden/factoren, of ze verplicht zijn, en de beoordelingscriteria.
- Het partnerformulier en het profiel tonen per type de goudstandaardvelden, en welke daarvan nog leeg zijn.
- Waarden met bron *goudstandaard/eigen uitgave* hebben de hoogste rang en worden door AI nooit overschreven. AI mag er hooguit een voorstel naast zetten.

**US-50 – Bronrangorde en label "niet gevalideerd"**
Als gebruiker wil ik zien uit welke categorie bron een gegeven komt, zodat ik weet hoe zwaar ik het kan laten wegen.
- Breid de bron-enum en `BRON_BETROUWBAARHEID` uit naar de rangorde uit art. 11.2:
  1. goudstandaard en eigen uitgaven van Blauwhoed (o.a. woningconceptenbrochure, Conceptenboulevard);
  2. aangeleverde documenten, projecthistorie en gevalideerde registraties (KVK-handelsregister);
  3. indicatieve markt- en internetbronnen.
- Bronnen uit categorie 3 krijgen in de UI en in exports zichtbaar het label **"indicatief – niet gevalideerd"**.
- Bij conflicterende voorstellen wint de hoogste rang, en de lagere wordt als alternatief getoond.

**US-51 – Betrouwbaarheid hoog/midden/laag in de hele UI**
Als gebruiker wil ik bij elk door AI afgeleid gegeven een betrouwbaarheid *hoog/midden/laag* zien (nu alleen in de export), plus de bron en de datum van vaststelling.
- Eén centrale mapping van de numerieke betrouwbaarheid naar hoog/midden/laag in `herkomst.ts`, hergebruikt in profiel, verrijkingsreview, zoekresultaten en export.

**US-52 – Herkomst en status ook voor basisvelden**
Als beheerder wil ik dat ook basisvelden (website, KVK-nummer, rechtsvorm, plaats/adres, omschrijving, contactgegevens) per veld een herkomst, datum, betrouwbaarheid en status (*voorgesteld/gevalideerd/verouderd*) hebben.
- Een geaccepteerd verrijkingsvoorstel mag een **gevalideerd** basisveld niet stilzwijgend overschrijven. Het wordt dan een conflict dat een mens moet beoordelen, net als nu bij factoren (`conflictMetGevalideerd`).
- Een basisveld handmatig bevestigen zet de status op gevalideerd, met naam en datum.

**US-53 – "Geen betrouwbare bron": leeg en gemarkeerd**
Als gebruiker wil ik dat een veld waarvoor geen betrouwbare bron is gevonden leeg blijft en expliciet gemarkeerd wordt, in plaats van gevuld met een onzekere waarde.
- De verrijking legt per gezocht veld vast dat er *geen betrouwbare bron* gevonden is, met datum en de doorzochte bronnen.
- De UI toont dit als een aparte, herkenbare markering (niet als "onbekend" of leeg zonder uitleg). Het telt mee in de datakwaliteitscijfers.
- De AI-extractie krijgt de instructie om bij twijfel niets in te vullen.

### B. AI-voorstellen en vrijgave

**US-54 – Eén status "concept" voor AI-voorstellen, alleen vrij te geven door een beheerder**
Als beheerder wil ik dat elke door AI voorgestelde nieuwe partner (via `registreerPartnerViaAI` én via discovery) de status **concept** krijgt en pas na mijn vrijgave meetelt.
- Voeg de huidige `ter_controle` en geaccepteerde discovery-kandidaten samen tot één status *concept*, met een migratie voor bestaande data.
- Alleen de rol beheerder mag vrijgeven. Haal het vrijgeven weg bij de inkoper; `prospect_promoveren` mag dus niet meer leiden tot een zichtbare partner zonder beheerder.
- Concepten zijn uitgesloten van zoeken, filteren, matchen, verbanden, chat en export, en staan in één vrijgavewachtrij voor de beheerder. Vrijgave en afwijzing komen in de auditlog.

**US-55 – AI draagt zelf ontbrekende partners aan op basis van een zoekprofiel**
Als beheerder wil ik dat de applicatie op basis van een zoekprofiel zelf partners aandraagt die nog ontbreken in het bestand, zodat ik niet alleen op webzoekresultaten hoef te vertrouwen.
- AI stelt vanuit het zoekprofiel en de bronnen (eigen uitgaven van Blauwhoed, KVK, open web, vakmedia, keurmerkregisters) gerichte zoekvragen op, verzamelt kandidaten, ontdubbelt ze tegen het bestaande bestand (bestaande `fuzzy.ts`/KVK-check) en maakt er concepten van (US-54). Elk concept krijgt:
  - een onderbouwing: waarom past deze partij, welke bron, wat is onzeker;
  - de bron-URL en ophaaldatum.
- Het is een voorstel, geen vastgesteld gegeven. Dat staat er ook zo bij.
- Elke aandraagronde telt als AI-bewerkingen (US-58).

### C. Verrijking

**US-56 – Instelbaar verrijkingsschema**
Als beheerder wil ik frequentie en omvang van de periodieke verrijking zelf instellen, zodat Blauwhoed het AI-verbruik kan sturen.
- Instellingen:
  - **frequentie:** uit, wekelijks, tweewekelijks, maandelijks, per kwartaal;
  - **dag en tijd;**
  - **omvang:** hele bestand, per partnertype, alleen partners die langer dan X maanden niet verrijkt zijn, of alleen partners met een gewijzigde website (de bestaande `webHash`).
- Alleen voor de rol beheerder.
- Voeg `vercel.json` toe met een cron die dagelijks `api/verrijking/run` aanroept. Dat endpoint beslist aan de hand van het schema of er een ronde moet draaien, en toont de volgende geplande ronde.
- Een ronde die het maandbudget zou overschrijden, wordt niet automatisch gestart. De beheerder krijgt een signaal (sluit aan op de bestaande blokkade boven 100%).

**US-57 – Verwachte AI-bewerkingen vóór een ronde**
Als beheerder wil ik vóór een geplande of handmatige verrijkingsronde het verwachte aantal **AI-bewerkingen** zien (niet alleen een bedrag), plus het effect op het maandbudget.
- Pas `schatVerrijkingsronde` aan: het aantal partners dat echt verrijkt wordt (na het overslaan van ongewijzigde sites) is het aantal bewerkingen. Toon ook "resterend budget na deze ronde".

**US-58 – AI-verbruik tellen in bewerkingen, met budget en rapportage**
Als beheerder wil ik het AI-verbruik zien in *AI-bewerkingen* conform art. 8, zodat de afspraken met AI-Group controleerbaar zijn.
- **Wat telt als één bewerking:** één handeling die tot verwerking door een extern taalmodel leidt, inclusief alle onderliggende aanroepen.
  - Eén verrijking van één partner is één bewerking, ook binnen een ronde. Nu telt een hele ronde als één; dat moet per partner worden.
  - Eén chatvraag, één matchvraag, één verbandanalyse en één AI-voorstelronde zijn elk één bewerking.
  - Onderhoudsprocessen tellen niet mee.
- **Budget:** instelbaar maandbudget in bewerkingen (standaard **750**) en een tokenbudget in euro (standaard **€ 30**). Leg de rekenprijzen vast in instellingen (standaard input **€ 2,50** en output **€ 10,00** per miljoen tokens) en reken kosten in euro in plaats van in USD.
- **Signalen:** een signaal aan de beheerder bij **80%** van het maandbudget (bestaat al voor het USD-budget, pas aan naar bewerkingen). Een apart signaal bij meer dan **125%** in een maand of gemiddeld meer dan **110%** over een kwartaal.
- **Rapportage:** een overzichtspagina met verbruik per maand en per kwartaal, uitgesplitst naar verrijking, chat, match/verband en AI-voorstellen. Een exporteerbare specificatie (CSV en Excel) met bewerkingen, tokens en providerkosten, als basis voor een eventuele nacalculatie.

**US-59 – Lichtste passende model per functie**
Als AI-Group wil ik per functie (extractie/verrijking, chat, match-onderbouwing, verbandanalyse, aandragen) instellen welk model wordt gebruikt, zodat het verbruik laag blijft (art. 8.9).
- Centrale modelkeuze per functie in `ai.ts` en de instellingen, met verstandige standaarden: een licht model voor extractie en samenvatten, een zwaarder model alleen waar nodig.
- Hergebruik eerdere resultaten: verrijk alleen wat gewijzigd kan zijn (sluit aan op de bestaande `webHash`).

### D. Bronnen

**US-60 – KVK-handelsregister (Basisprofiel) in de verrijking**
Als gebruiker wil ik dat een partner met een KVK-nummer bij het verrijken wordt aangevuld uit het KVK-handelsregister (Basisprofiel: statutaire naam, rechtsvorm, SBI-activiteiten, vestigingsadres, oprichtingsdatum).
- De API-sleutel is van Blauwhoed en staat in instellingen/env. Zonder sleutel werkt alles zoals nu en toont de UI dat de KVK-koppeling niet actief is.
- Deze gegevens krijgen bron *KVK – gevalideerde registratie* (rang 2 in US-50).

**US-61 – Geüploade documenten als bron**
Als gebruiker wil ik dat geüploade documenten bij een partner (PDF, Word, tekst) worden gelezen en gebruikt als bron voor verrijking, zodat aangeleverde stukken meetellen.
- Tekstextractie uit de Blob-bestanden van `DocumentenBeheer.tsx`. De bron is *aangeleverd document* (rang 2), met een verwijzing naar het document.

**US-62 – Keurmerk- en brancheregisters als bron**
Als beheerder wil ik openbare keurmerk- en brancheregisters (bijvoorbeeld registers van certificaten zoals VCA, CO2-prestatieladder, FSC) als bron kunnen toevoegen, zodat certificaten verifieerbaar worden.
- Beheerbare lijst van registerbronnen (naam, URL of zoekpatroon, welk certificaat), naast de bestaande verrijkingsbronnen. Alleen openbare bronnen zonder login of betaling.
- Een certificaat dat in een register is gevonden, krijgt de bron en de datum. Een certificaat dat niet gevonden is, blijft *geclaimd* (sluit aan op US-30).

### E. Projecthistorie en tevredenheid

**US-63 – Projectnummer en tevredenheidsscore met toelichting per project**
Als gebruiker wil ik per partner vastleggen op welke Blauwhoed-projecten hij heeft gewerkt, **op basis van projectnummer**, met rol en periode, en per project een **tevredenheidsscore met toelichting**.
- Voeg een apart veld `projectnummer` toe aan Project: uniek, zichtbaar, doorzoekbaar en importeerbaar via de bestaande historie-CSV.
- Voeg aan Evaluatie een totale tevredenheidsscore toe. Die is standaard afgeleid van de 5 deelscores, maar kan handmatig worden bijgesteld, met een verplichte toelichting.
- Maak de projecthistorie doorzoekbaar op projectnummer, projectnaam, rol, periode en toelichting (klassiek zoeken én chat). De totale score weegt mee in de matchscore via het bestaande gewichtsprofiel.
- De tekst in de UI vermeldt dat scores oordelen van Blauwhoed over de eigen samenwerking zijn, op organisatieniveau.

### F. Toegang, overzicht en export

**US-64 – Echte authenticatie**
Als Blauwhoed wil ik dat alleen eigen medewerkers kunnen inloggen, zodat de database niet openbaar toegankelijk is.
- Vervang de cookie-rolwisselaar door echte authenticatie. Kies een lichte oplossing die bij Next.js 16 past, bij voorkeur Auth.js met Microsoft Entra ID (Blauwhoed-tenant), eventueel met een e-mail-magic-link als terugvaloptie. Toegang alleen voor het Blauwhoed-e-maildomein (instelbaar).
- Er is geen limiet op het aantal gebruikers. De eerste beheerder komt uit een env-variabele. De beheerder kent rollen toe op een gebruikersbeheerscherm.
- De `RolWisselaar` blijft alleen beschikbaar in ontwikkelmodus.
- Elke auditregel legt de ingelogde gebruiker vast.

**US-65 – Twee rollen: gebruiker en beheerder**
Als beheerder wil ik dat de rollen aansluiten op de overeenkomst: **gebruiker** en **beheerder**.
- Breng lezer, bewerker en inkoper samen onder *gebruiker*. Houd de bestaande fijnmazige rechten eventueel intern aan, maar toon alleen deze twee rollen, met migratie van bestaande toekenningen.
- **Alleen voor de beheerder:**
  - AI-voorstellen vrijgeven (US-54);
  - de weging instellen (gewichtsprofielen);
  - het verrijkingsschema beheren (US-56);
  - de goudstandaard beheren (US-49);
  - bronnen, budget en modelinstellingen beheren;
  - definitief verwijderen (US-68);
  - gebruikers beheren.

**US-66 – Datakwaliteit op het overzichtsscherm**
Als gebruiker wil ik op het dashboard naast aantallen en statussen ook de datakwaliteit zien. Die staat nu alleen op `/beheer`. Het gaat om:
- het percentage gevulde goudstandaardvelden per partnertype;
- het aandeel gevalideerd, voorgesteld en verouderd;
- het aantal velden met "geen betrouwbare bron";
- het aantal openstaande concepten en verrijkingsvoorstellen;
- het AI-verbruik van deze maand.

Elk getal linkt door naar de bijbehorende gefilterde lijst.

**US-67 – Export naar Excel (.xlsx)**
Als gebruiker wil ik partnerlijsten, projecthistorie, matchresultaten en het verbruiksoverzicht als echt Excel-bestand (.xlsx) exporteren. Nu is dat alleen CSV.
- Gebruik een lichte bibliotheek die aansluit op wat er al is (bijvoorbeeld `write-excel-file`, de tegenhanger van het al gebruikte `read-excel-file`).
- Neem per veld de status en de betrouwbaarheid (hoog/midden/laag) op. De bestaande PDF- en CSV-exports blijven.

**US-68 – Volledige data-export met herkomst (CSV en JSON)**
Als beheerder wil ik het complete bestand met één actie exporteren als CSV én als JSON. Dat omvat alle partners, velden, factoren, projecten, evaluaties, verbanden, concepten en het verbruik, inclusief herkomst en status per gegeven. Zo kan Blauwhoed bij beëindiging over alle gegevens beschikken (art. 15.4).
- Alleen voor de beheerder. Het downloaden van de export wordt gelogd.

**US-69 – Definitief verwijderen op verzoek (AVG)**
Als beheerder wil ik een partner, inclusief contactpersonen, documenten (Blob) en herkomstgegevens, definitief kunnen verwijderen op verzoek van Blauwhoed.
- Alleen voor de beheerder, alleen voor een partner die eerst gearchiveerd is, met een dubbele bevestiging en een verplichte reden. Archiveren blijft gewoon niet-wissend.
- Verwijdering haalt de partner ook weg uit engagements, evaluaties, verbanden, matchruns en discovery-kandidaten, of anonimiseert die verwijzingen.
- De auditlog bewaart alleen *dat* er verwijderd is (wie, wanneer, reden, intern id), zonder persoonsgegevens.
- Daarnaast kan de beheerder een losse contactpersoon verwijderen (sluit aan op US-47).

### G. Zorgvuldige presentatie van AI-output

**US-70 – Disclaimers bij matchscore en verbanden, en responsiviteit**
Als gebruiker wil ik bij AI-uitkomsten helder zien wat ze wel en niet betekenen.
- **Bij de matchscore:** vermeld dat het een onderbouwde eerste selectie is en geen oordeel over geschiktheid, betrouwbaarheid of financiële gezondheid (art. 11.3).
- **Bij verbanden:** vermeld dat het uit bronnen afgeleide signalen zijn, zonder bevestiging van samenwerking of exclusiviteit, en niet bedoeld voor extern gebruik (art. 11.4). Toon per verband altijd de bron.
- **Bij AI-voorstellen:** vermeld dat het een voorstel is en geen vastgesteld gegeven.
- **Responsiviteit:** loop alle hoofdschermen na op tablet (768px) en telefoon (375px). Denk aan partnerlijst, profiel, chat, match, verrijkingsreview, vrijgavewachtrij en dashboard. Herstel wat niet werkt. De app is browsergebaseerd; er komt geen aparte mobiele app.

---

## Niet doen

- De dode stubs `api/partners`, `api/enrich` en `api/discover` en de `radar`-prototypepagina **niet** uitbreiden. Meld ze in de eindsamenvatting als kandidaat om op te ruimen, maar verwijder ze niet zonder te vragen.
- Geen overstap naar een ORM of genormaliseerde tabellen (`db/schema.sql`). Blijf bij de JSON-store met migraties.
- Geen nieuwe features buiten deze lijst. Zie je een wens die logisch lijkt maar hier niet staat, zet hem dan op een lijst "openstaande wensen" onderaan `docs/userstories.md`.

## Oplevering

Sluit af met een beknopt overzicht met:
- per story (US-49 t/m US-70) de status: gebouwd, aangevuld of al aanwezig, en de belangrijkste bestanden;
- de nieuwe env-variabelen (auth, KVK-sleutel, cron-secret, eerste beheerder);
- de uitgevoerde migraties;
- de testresultaten (`typecheck`, `lint`, `smoke`);
- wat Blauwhoed nog moet aanleveren om alles werkend te krijgen:
  - de goudstandaard per partnertype;
  - de KVK API-sleutel;
  - de Entra ID-app-registratie;
  - de projecthistorie met projectnummers;
  - de bronbestanden voor import.
