# Blauwhoed – Slimme Partnerdatabase
## Backlog met user stories

---

## 1. Uitgangspunten en scopekeuzes

**1. Twee gescheiden werelden in één systeem.** Bekende partners en onbekende partners (prospects) zitten in dezelfde tabel, met een `status`-veld: `bekend`, `prospect`, `afgewezen`, `preferred`, `geblokkeerd`. Prospects komen nooit automatisch in een advies zonder menselijke goedkeuring.

**2. Bewijs boven zelfbeeld.** Elk kenmerk in het profiel krijgt een `bron` en een `betrouwbaarheid`. Matching weegt daarop.

**3. Het factorenmodel is het hart van het systeem.** Per factor: categorie, type (hard filter, gewogen of semantisch), schaal, bron en betrouwbaarheid. Nieuwe factoren toevoegen is configuratie, geen migratie.

**4. Matching is hybride, niet puur AI.** Harde filters eerst, daarna gewogen score, daarna semantische gelijkenis (pgvector). AI legt uit, AI beslist niet.

**5. Je matcht een team, geen losse partij.** Het systeem stelt een projectteam samen en let op onderlinge samenwerkingshistorie.

**6. Alleen bedrijfsgegevens.** Persoonsgegevens beperkt tot zakelijke contactpersonen met expliciete grondslag. Geen scraping van LinkedIn-profielen.

---

## 2. Datamodel (kern)

```
partner, factor, factor_option, partner_factor, partner_certificate, partner_embedding,
project, project_requirement, requirement_factor, engagement, evaluation, collaboration_edge,
discovery_candidate, match_run, match_feedback
```

---

## 3. Het factorenmodel

- **Hard** – filter vooraf. Voldoet de partner niet, dan valt hij af (met melding, zie US-14).
- **Gewogen** – telt mee in de score van 0–100, met een gewicht dat per project instelbaar is.
- **Semantisch** – vergelijking op tekst en referentieprojecten via pgvector.

Categorieën A t/m G: Projecttype en programma; Bouwstijl en architectuur; Bouwmethode en materialen; Duurzaamheid; Capaciteit en continuïteit; Samenwerking en gedrag; Commercieel en risico. Zie `src/lib/domain/factors.ts` voor de uitwerking.

**Vuistregel voor de weging.** Nooit meer dan zes factoren op een gewicht boven 10%. Standaard 100% over vier tot zes bepalende factoren per project.

---

## Epic 1 – Partnerprofiel en datamodel

**US-01** Als beheerder wil ik een partner vastleggen met KVK-nummer, rechtsvorm, vestigingsplaats en werkgebied, zodat elk profiel uniek en verifieerbaar is.
- KVK-nummer is uniek; dubbele invoer wordt geblokkeerd met verwijzing naar bestaand record.
- Werkgebied als polygoon of straal (PostGIS), niet als vrije tekst.

**US-02** Als beheerder wil ik per partner meerdere rollen vastleggen (architect, aannemer, installateur, adviseur, leverancier, ontwikkelpartner).

**US-03** Als beheerder wil ik per partner scores vastleggen op de factoren uit hoofdstuk 3.
- Waarden komen uit een beheerde waardenlijst per factor, geen vrije invoer.
- Elke waarde heeft bron (`opgave`, `projecthistorie`, `evaluatie`, `web`, `certificaat`), betrouwbaarheid (0–1) en peildatum.

**US-04** Als beheerder wil ik factoren zelf beheren – toevoegen, type wijzigen, waardenlijst aanpassen, archiveren.
- Beheerscherm met toevoegen, hernoemen, samenvoegen en archiveren.
- Samenvoegen hernoemt bestaande koppelingen, verwijdert ze niet.
- Archiveren verwijdert de factor uit nieuwe matchruns maar behoudt historie.

**US-04b** Als systeem wil ik ontbrekende factorwaarden neutraal behandelen in plaats van als nul.
- Ontbrekende gewogen factor telt niet mee; het gewicht wordt herverdeeld over de bekende factoren.
- De score toont de dekkingsgraad.
- Bij een dekkingsgraad onder 60% verschijnt een waarschuwing bij de kandidaat.

**US-05** Capaciteitsindicatoren vastleggen (omzet, aantal medewerkers, max gelijktijdige projecten, typische projectomvang).

**US-06** Certificaten met geldigheidsdatum vastleggen (ISO 9001/14001, VCA, CO2-prestatieladder, FSC, BREEAM-expertise, Woonkeur).
- Certificaat binnen 90 dagen verlopen: signaal op dashboard.
- Verlopen certificaat telt niet mee in de matchscore.

**US-07** Partner op `geblokkeerd` kunnen zetten met reden en einddatum.

## Epic 2 – Projectprofiel en vraagstelling

**US-08** Project vastleggen met type, locatie, aantal woningen, prijssegment, bouwstijl, ambitieniveau duurzaamheid en planning.

**US-09** Per project de benodigde rollen aanvinken en per rol de eisen scherpstellen.

**US-10** Gewichten van criteria per project instellen.
- Standaardprofielen: "binnenstedelijk hoogbouw", "grondgebonden uitleg", "transformatie", "houtbouw/biobased".
- Gewichten optellen tot 100%, afgedwongen in de UI.

**US-11** Project aanmaken door een projectdocument of programma van eisen te uploaden.
- AI-extractie vult velden voor, elk veld toont herkomst uit het document.
- Niets wordt opgeslagen zonder bevestiging van de gebruiker.

## Epic 3 – Matching en scoring

**US-12** Per rol een gerangschikte lijst kandidaten met een score van 0–100.

**US-13** Per kandidaat zien waaróm hij scoort, per criterium met de onderliggende bewijsstukken.
- Per criterium: score, gewicht, bijdrage aan totaal, bronvermelding.
- Doorklikken naar het referentieproject of de factuurregel achter een claim.

**US-14** Harde uitsluitingen als losse melding.

**US-15** Semantisch zoeken op vrije omschrijving.
- Semantische treffers zijn herkenbaar gemarkeerd, gescheiden van harde criteria.

**US-16** Matchopdracht opslaan en later opnieuw draaien, zodat ik zie of er nieuwe of betere kandidaten zijn.

**US-17** Twee tot vier kandidaten naast elkaar vergelijken op dezelfde criteria.

## Epic 4 – Historie als bewijs

**US-18** Afgeronde en lopende projecten vastleggen met betrokken partners, rol, contractwaarde en periode.
- Import via CSV. Match op KVK of crediteurnummer; onherleidbare regels in een controlewachtrij.

**US-19** Factorwaarden automatisch afleiden uit projecthistorie.
- Bron `projecthistorie`, hogere betrouwbaarheid dan opgave of web. Zichtbaar als afgeleid en handmatig te overschrijven. Recente projecten wegen zwaarder.

**US-20** Kostenvastheid en planningsbetrouwbaarheid per partner over meerdere projecten.

**US-21** Na oplevering een partner beoordelen op kwaliteit, planning, budget, samenwerking en duurzaamheidsprestatie.
- Vijf scores plus vrije toelichting. Herinnering automatisch bij projectfase "opgeleverd".

**US-22** Zien welke partners eerder succesvol samen op één project zaten.

## Epic 5 – Discovery van onbekende partners

**US-23** Zoekopdracht starten naar onbekende partners op basis van een projectprofiel.

**US-24** Kandidaten verzamelen uit externe bronnen. Elke kandidaat legt bron-URL en ophaaldatum vast. Alleen bedrijfsgegevens.

**US-25** Kandidaten beoordelen in een wachtrij met accepteren, afwijzen of parkeren.
- Afwijzen vraagt om een reden; die reden traint de filtering. Geaccepteerde kandidaat wordt partner met status `prospect`.

**US-26** Dubbelen herkennen op KVK, naam en adres.

**US-27** Per prospect een korte AI-samenvatting: wat doet dit bedrijf, referentieprojecten, waarom past het, wat is onzeker.

**US-28** Signaal wanneer een onbekende partij structureel beter scoort dan de vaste kring.

## Epic 6 – Verrijking en AI-extractie

**US-29** Openbare bedrijfsinformatie ophalen en kenmerken extraheren volgens de taxonomie. Bron `web`, lagere betrouwbaarheid.

**US-30** Duurzaamheidsclaims scheiden in aantoonbaar en geclaimd.

**US-31** Verrijkingsronde periodiek automatisch, alleen wijzigingen ter controle.

## Epic 7 – Kwalificatie, risico en compliance

**US-32** Financiële kerncijfers en risicosignaal per partner.

**US-33** Afhankelijkheid signaleren: partners waar Blauwhoed een groot deel van de omzet is, en projecten waar één partner onmisbaar is.

**US-34** Kwalificatiechecklist per partner (verzekering, KAM, gedragscode, ketenaansprakelijkheid); pas `preferred` na volledige toetsing.

## Epic 8 – Teamsamenstelling

**US-35** Compleet teamvoorstel voor alle rollen tegelijk.

**US-36** Teamscore die samenwerkingshistorie, regionale nabijheid en gezamenlijke beschikbaarheid meeweegt.

**US-37** Alternatief teamvoorstel dat bewust afwijkt.

**US-38** Teamvoorstel exporteren naar PDF met onderbouwing per keuze.

## Epic 9 – Zoeken en gebruik

**US-39** Filteren en zoeken op elke combinatie van rol, regio, kenmerk, certificaat en status.

**US-40** Partnerdossier met profiel, projecten, facturen, beoordelingen en contactmomenten op één pagina.

**US-41** Partners op een kaart ten opzichte van de projectlocatie.

## Epic 10 – Leren en feedback

**US-42** Vastleggen welke kandidaat gekozen is en waarom de anderen afvielen.

**US-43** Zien hoe vaak de top-3 van de matching daadwerkelijk gekozen wordt.

**US-44** Gewichten en scoringsregels aanpassen met versiebeheer.

## Epic 11 – Beheer, rechten en AVG

**US-45** Rollen en rechten (lezen, bewerken, discovery goedkeuren, beheer).

**US-46** Auditlog van elke wijziging aan partnergegevens en scoringsregels.

**US-47** Contactpersonen apart vastleggen met grondslag, bewaartermijn en verwijderfunctie.

**US-48** AI-verrijking en discovery op een afgeschermde omgeving zonder dat brongegevens bij modelleveranciers blijven.

---

## 4. Fasering

- **Fase 1 – fundament**: US-01 t/m US-09, US-04b, US-12, US-13, US-39, US-40, US-45.
- **Fase 2 – bewijs uit historie**: US-10, US-14, US-17, US-18 t/m US-22, US-42, US-43.
- **Fase 3 – discovery en team**: US-15, US-16, US-23 t/m US-31, US-35 t/m US-38, US-41.
- **Fase 4 – hardening**: US-32 t/m US-34, US-44, US-46 t/m US-48.

## 5. Vijf punten om met Blauwhoed scherp te krijgen

1. Wie is eigenaar van het factorenmodel?
2. Welke factoren zijn echt onderscheidend bij Blauwhoed?
3. Wie mag een prospect promoveren tot partner? Dat is een inkooprol.
4. Wordt de beoordeling na oplevering afgedwongen in het projectproces?
5. Wat is het beleid op externe bronnen?

---

## Epic 12 – Aanvulling overeenkomst v3.1

Aanvullende overeenkomst Blauwhoed – AI-Group (v3.1, 11 september 2026). Harde uitgangspunten: de mens beslist (AI-voorstellen zijn concepten tot een beheerder ze vrijgeeft), de goudstandaard van Blauwhoed gaat altijd voor, gevalideerde waarden worden nooit stilzwijgend overschreven, elk AI-gegeven toont herkomst, datum en betrouwbaarheid (hoog/midden/laag), beoordelingen zijn op organisatieniveau, archiveren wist niet, het aantal gebruikers is onbeperkt en het budget gaat over AI-bewerkingen.

Status: **gebouwd** = nieuw; **aangevuld** = bestond deels en is afgemaakt; **al aanwezig** = er hoefde niets te gebeuren.

### A. Goudstandaard en datakwaliteit

**US-49 – Goudstandaard per partnertype** — *gebouwd*
Per rol verplichte/gewenste velden (basisvelden en factoren) en beoordelingscriteria, beheerd door de beheerder (`/beheer/goudstandaard`, versie en auditregel per wijziging). Het profiel toont per type welke velden gevuld en leeg zijn. Waarden met bron goudstandaard/eigen uitgave (rang 1) zijn leidend: een AI-voorstel ernaast is een alternatief en kan ze niet overschrijven. Zolang Blauwhoed nog geen goudstandaard heeft aangeleverd, geldt een startpunt per rol.

**US-50 – Bronrangorde en label "niet gevalideerd"** — *aangevuld*
Bron-enum uitgebreid (goudstandaard, eigen uitgave, opgave, document, projecthistorie, evaluatie, KVK, register, certificaat, web) met rang 1/2/3 volgens art. 11.2. Rang 3 krijgt in UI en exports het label "indicatief – niet gevalideerd". Bij conflicterende voorstellen wint de hoogste rang; de lagere wordt als alternatief getoond. Conceptenboulevard en de woningconceptenbrochure zijn eigen uitgaven (rang 1); de bron van een import is kiesbaar.

**US-51 – Betrouwbaarheid hoog/midden/laag** — *aangevuld*
Eén mapping in `herkomst.ts` (`betrouwbaarheidNiveau`), gebruikt in profiel, factorwaarden, verrijkingsreview, zoekresultaten, AI-registratie en CSV/Excel/PDF-export.

**US-52 – Herkomst en status voor basisvelden** — *gebouwd*
Website, KVK, rechtsvorm, plaats, adres, omschrijving, algemene telefoon/e-mail en de KVK-velden hebben per veld bron, datum, betrouwbaarheid en status. Handmatige invoer en bevestigen = gevalideerd met naam en datum; een voorstel op een gevalideerd basisveld wordt een conflict dat een mens beoordeelt. Migratie v9 geeft bestaande velden een afgeleide herkomst met status voorgesteld.

**US-53 – "Geen betrouwbare bron"** — *gebouwd*
De verrijking legt per gezocht veld (basisvelden en goudstandaardvelden) vast dat er niets betrouwbaars is gevonden, met datum en doorzochte bronnen. Zichtbaar als aparte markering, telt mee in de datakwaliteit, verdwijnt zodra het veld gevuld wordt. De AI-prompts vragen bij twijfel niets in te vullen.

### B. AI-voorstellen en vrijgave

**US-54 – Eén status "concept", alleen vrij te geven door een beheerder** — *aangevuld*
`ter_controle` en geaccepteerde discovery-kandidaten zijn samengevoegd tot `concept` (migratie v10). Accepteren in discovery maakt geen zichtbare prospect meer. Eén vrijgavewachtrij (`/vrijgave`) voor AI-registratie, discovery en AI-aandraag; alleen de beheerder geeft vrij (als bekend of prospect) of wijst af (gearchiveerd, niet gewist); beide in de auditlog. Concepten zijn uitgesloten van zoeken, filteren, kaart, matchen, verbanden, chat en export.

**US-55 – AI draagt zelf ontbrekende partners aan** — *gebouwd*
Vanuit een opgeslagen zoekprofiel (Discovery): gerichte zoekvragen (AI of regels), kandidaten uit eigen uitgaven van Blauwhoed (aanbieders op Conceptenboulevard), KVK (met sleutel) en open web/vakmedia, ontdubbeld tegen het bestand (KVK, naam, fuzzy naam, adres), als concept met onderbouwing (waarom past het, bron, wat is onzeker), bron-URL en ophaaldatum. Eén aandraagronde = één AI-bewerking.

### C. Verrijking

**US-56 – Instelbaar verrijkingsschema** — *gebouwd*
Frequentie (uit/wekelijks/tweewekelijks/maandelijks/kwartaal), dag en tijd (Nederlandse tijd) en omvang (hele bestand, per partnertype, niet verrijkt sinds X maanden, gewijzigde website). Alleen de beheerder. `vercel.json` roept dagelijks `/api/verrijking/run` aan; het endpoint beslist op het schema, hervat een lopende geplande ronde en toont de volgende. Een ronde die het budget zou overschrijden start niet; de beheerder krijgt een signaal.

**US-57 – Verwachte AI-bewerkingen vóór een ronde** — *aangevuld*
De schatting telt de partners die na het overslaan van ongewijzigde websites echt verrijkt worden (op basis van eerdere rondes) en toont het resterende budget na de ronde, per omvang.

**US-58 – AI-verbruik in bewerkingen** — *aangevuld*
Eén verrijking van één partner = één bewerking, ook binnen een ronde; chat, match-onderbouwing, verbandanalyse en aandraagronde zijn elk één bewerking; zonder extern taalmodel geen bewerking. Budget 750 bewerkingen en € 30 tokenbudget, rekenprijzen € 2,50/€ 10,00 per miljoen tokens (instelbaar), kosten in euro. Signalen bij 80%, boven 125% in een maand en gemiddeld boven 110% over een kwartaal. Rapportage per maand en kwartaal per categorie (`/beheer/verbruik`) en een specificatie als CSV en Excel. Migratie v11.

**US-59 – Lichtste passende model per functie** — *gebouwd*
Model per functie (extractie, chat, match, verband, aandragen) instelbaar; standaard Claude Haiku 4.5 voor extractie/aandragen en Claude Sonnet 5 voor chat/match/verband. Ongewijzigde websites (webHash) worden niet opnieuw door het model gelezen.

### D. Bronnen

**US-60 – KVK-handelsregister (Basisprofiel)** — *gebouwd*
Bij partners met KVK-nummer: statutaire naam, rechtsvorm, SBI-activiteiten, vestigingsadres en oprichtingsdatum als voorstel met bron "KVK – gevalideerde registratie" (rang 2). Zonder `KVK_API_KEY` toont de UI dat de koppeling niet actief is.

**US-61 – Geüploade documenten als bron** — *gebouwd*
Tekst uit PDF, Word (.docx) en tekstbestanden wordt direct na upload gelezen (en is opnieuw te lezen) en telt bij verrijking als bron "aangeleverd document" (rang 2) met verwijzing naar het document. Scans en oude .doc-bestanden krijgen een melding.

**US-62 – Keurmerk- en brancheregisters** — *gebouwd*
Beheerbare lijst openbare registers (naam, zoekpatroon met `{naam}`/`{kvk}`, certificaat). Gevonden: een voorstel dat een mens bevestigt, waarna het certificaat geverifieerd is met het register als bron en datum (ook voor nog niet vastgelegde certificaten); niet gevonden: blijft geclaimd. De echo van de zoekterm op een resultatenpagina telt niet als vondst. Drie voorbeeldregisters staan standaard uit.

### E. Projecthistorie en tevredenheid

**US-63 – Projectnummer en tevredenheidsscore** — *gebouwd*
Uniek projectnummer (zichtbaar, doorzoekbaar, koppeling in de historie-CSV). Totale tevredenheidsscore per evaluatie, standaard het gemiddelde van de vijf deelscores, handmatig bij te stellen met verplichte toelichting; weegt mee in de evaluatiescore van de matching. Historie doorzoekbaar op projectnummer, naam, rol, periode en toelichting; de chat vindt projecten op nummer. De UI vermeldt dat scores oordelen van Blauwhoed zijn op organisatieniveau. Migratie v12.

### F. Toegang, overzicht en export

**US-64 – Echte authenticatie** — *gebouwd*
Auth.js (next-auth v5) met Microsoft Entra ID; alleen accounts uit de eigen tenant (issuer met tenant-ID verplicht, controle op `tid`) met een toegestaan e-maildomein (`AUTH_TOEGESTANE_DOMEINEN`, standaard blauwhoed.nl). `src/proxy.ts` schermt alle pagina's en API's af; in productie is de app dicht zolang inloggen niet is geconfigureerd (tenzij expliciet `AUTH_DEMO_MODUS=1`). Eerste beheerder uit `EERSTE_BEHEERDER_EMAIL`; gebruikersbeheer onder `/beheer/gebruikers`. De rolwisselaar werkt alleen in ontwikkel-/demomodus. Elke auditregel legt naam, id en e-mail vast. Magic-link als terugval is niet gebouwd (zie openstaande wensen).

**US-65 – Twee rollen** — *aangevuld*
Lezer, bewerker en inkoper zijn samengevoegd tot gebruiker (migratie v10, ook in de auditlog). Alleen de beheerder: AI-voorstellen vrijgeven, weging, verrijkingsschema, goudstandaard, bronnen/budget/modellen, definitief verwijderen, volledige export en gebruikersbeheer.

**US-66 – Datakwaliteit op het dashboard** — *gebouwd*
Gevulde goudstandaardvelden per partnertype, aandeel gevalideerd/voorgesteld/verouderd, velden zonder betrouwbare bron, open concepten en verrijkingsvoorstellen en het AI-verbruik van deze maand; elk getal linkt naar de gefilterde lijst.

**US-67 – Export naar Excel** — *gebouwd*
Partnerlijst (met een blad "Waarden met herkomst": status en betrouwbaarheid per veld), projecthistorie, matchresultaten (kandidaten, criteria, uitsluitingen, toelichting) en verbruik als .xlsx via write-excel-file. CSV- en PDF-exports blijven.

**US-68 – Volledige data-export met herkomst** — *gebouwd*
Beheer → Volledige data-export: JSON (volledige staat plus afgeleide verbanden en herkomst per partner) en CSV (zip met een tabel per onderdeel). Alleen de beheerder; het downloaden wordt gelogd.

**US-69 – Definitief verwijderen op verzoek (AVG)** — *gebouwd*
Alleen de beheerder, alleen gearchiveerde partners, dubbele bevestiging (naam typen) en verplichte reden. Verwijdert contactpersonen, documenten (ook in Blob), herkomst, historie en beoordelingen, schoont matchruns, feedback en discovery-kandidaten op en anonimiseert teams en auditdetails; de auditlog bewaart alleen dát er verwijderd is. Losse contactpersonen verwijderen bestond al (US-47).

### G. Zorgvuldige presentatie van AI-output

**US-70 – Disclaimers en responsiviteit** — *aangevuld*
Vaste teksten bij de matchscore (art. 11.3), bij verbanden (art. 11.4, bron per verband) en bij AI-voorstellen, chat en discovery-samenvattingen. Nieuw: onderbouwing van een matchrun en verbandanalyse in gewone taal (AI of regels). Alle hoofdschermen gecontroleerd op 768 en 375 px (`scripts/schermcontrole.mjs`): mobiele kopbalk met scrollend menu, tabbladen niet langer verborgen, gridkolommen en tabellen krimpen mee.

### Openstaande wensen

Logisch, maar niet gevraagd in de overeenkomst — daarom niet gebouwd:

- **Magic-link-inloggen als terugval** naast Entra ID (vraagt een mailprovider en een Auth.js-adapter voor verificatietokens).
- **Vaker dan dagelijks controleren van het verrijkingsschema**: met een uurlijkse cron (Vercel Pro) start een ronde vrijwel op het ingestelde tijdstip; nu bij de eerste dagelijkse controle erna.
- **Registers via een API bevragen** in plaats van een zoekpatroon-URL (sommige registers zijn alleen via een formulier of API te doorzoeken).
- **Goudstandaard-import per partnertype** uit een aangeleverd Excel-bestand (nu per partner via factorwaarden of een import met bron goudstandaard).
- **Opruimen van de legacy-onderdelen** `api/partners`, `api/enrich`, `api/discover` en de `radar`-pagina.
