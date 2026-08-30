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
