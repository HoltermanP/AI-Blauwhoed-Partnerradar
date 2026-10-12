# User stories partnerdatabase — demo oktober 2026

Status van de user stories uit de demo van oktober 2026 (P1 = vóór de volgende demo, P2 = volgende sprint, P3 = latere fase of eerst uitzoeken). "Bestond" = was er al en is aangescherpt.

| Story | Prio | Status | Waar |
| --- | --- | --- | --- |
| US-01 Verplichte velden per partnertype | P1 | gereed; types houtbouwer en constructeur, nieuwe factoren (Paris Proof, productietijd, levertijd, kosten per m², productinformatie), startset per type, aan te passen zonder ontwikkelaar | Beheer → Goudstandaard |
| US-02 Vullingsgraad op het dashboard | P1 | gereed; per type en per veld, doorklikken naar partners met ontbrekende verplichte velden en direct verrijken | Dashboard, `/datakwaliteit` |
| US-03 Signalen verouderd/onbetrouwbaar | P1 | gereed; verouderingstermijn per veld (ook basisvelden), drempel instelbaar, filter op soort, type en veld | `/datakwaliteit` |
| US-04 Bron, datum, betrouwbaarheid, status | P1 | gereed; statussen voorstel, gebruikers-, beheerdersgeverifieerd en afgewezen, bron-URL klikbaar | partnerdossier |
| US-05 Betrouwbaarheid weegt mee | P2 | bestond; uitleg in de matchonderbouwing en de factorentabel | matchpagina |
| US-06 Herkomst classificaties corrigeren | P1 | gereed; correctie met reden en gebruiker, gaat voor op het AI-label (partner en project) | partnerdossier, projectpagina |
| US-07 Verrijkingsvoorstellen beoordelen | P1 | gereed; zonder bron geen voorstel, aanpassen vóór accepteren, bulk, accepteren = gebruikersgeverifieerd | `/verrijking`, partnerdossier |
| US-08 Beheerdersverificatie | P2 | gereed; per type per veld instelbaar, werklijst met (bulk)validatie | Goudstandaard, `/vrijgave` |
| US-09 Partner toevoegen met AI | P1 | bestond; nu ook vanuit alleen een vrije omschrijving | Nieuwe partner |
| US-10 Concept en vrijgave | P1 | bestond; samenvoegen met een bestaande partner toegevoegd | `/vrijgave` |
| US-11 Upcoming partners | P3 | eerste versie; zoekmodus, bronnen voor prijzen en nominaties (nog te testen), label upcoming | Discovery |
| US-12 Bronnen met kwaliteitsrang | P2 | gereed; rang telt mee in de betrouwbaarheid | Verrijking → Bronnen |
| US-13 Nieuwe bron voorstellen | P2 | gereed; voorstel met URL, omschrijving en rang → goedkeuren of afwijzen | Verrijking → Bronnen |
| US-14 Matchrun per rol | P1 | bestond; uitsplitsing per criterium | matchpagina |
| US-15 Dekking van de match | P1 | gereed; percentage per rol, waarschuwing onder drempel, ontbrekende criteria met link naar verrijking | matchpagina |
| US-16 Gewichten instellen | P2 | gereed; schuifjes, direct effect, opslaan op project of als profiel | matchpagina |
| US-17 Standaardweging | P2 | gereed; beheer stelt eigen ervaring, samenwerking, standaardprofiel en dekkingscorrectie in (nieuwe versie per profiel) | Beheer → Gewichten |
| US-18 Projectevaluatie | P2 | gereed; tussentijds of na oplevering, over de organisatie, nooit een persoon | project → Evaluaties |
| US-19 Vrije evaluatietekst | P2 | gereed; gebruikt in de chat en de matchonderbouwing | project → Evaluaties |
| US-20 Evaluatieproces bewaken | P3 | gereed; ontwikkelaar levert, procesbewaker bewaakt, herinneringstermijn instelbaar, filter op eigen projecten | `/evaluaties` |
| US-21 Evaluaties in de matching | P2 | gereed; alleen geaccepteerde tellen, aandeel eigen ervaring tegenover openbare bronnen instelbaar en zichtbaar | `/vrijgave` → Evaluaties, Beheer → Gewichten |
| US-22 Samenwerkingssignalen | P2 | gereed; signaal vs. bevestigde samenwerking, bevestigen door beheerder | `/verbanden` |
| US-23 Terugkerende teamcombinaties | P2 | gereed | `/verbanden` |
| US-24 Teamvoorstel in de matching | P3 | eerste versie; bewezen teams met teamscore en onderbouwing | project → Team |
| US-25 Externe projecten als bron | P3 | gereed; extern project uit openbare bron met herkende partners, samenwerkingssignaal met bron; LinkedIn alleen als bronvermelding (niet gelezen) | `/verbanden` |
| US-26 Projecten uit Business Central/ERP | P2 | gereed (upload CSV/Excel); API-koppeling later | Projecten → Importeren uit ERP |
| US-27 Selectie vanuit tender | P3 | API gereed (`POST /api/tender/selectie`); koppeling met de tenderapplicatie nog niet | – |
| US-28 AI-chat prominent | P1 | gereed | `/zoeken`, dashboard |
| US-29 Chat met bronvermelding | P1 | bestond; labels database/internet | `/zoeken` |
| US-30 Zoeken ≠ matchadvies | P2 | gereed; melding met knop Matchrun starten | `/zoeken` |
| US-31 Verbruik AI-bewerkingen | P1 | bestond; uitsplitsing verrijking/discovery/chat, meldingen bij 80% en 100% | Beheer → AI-verbruik, dashboard |
| US-32 2FA/SSO | P3 | SSO via Entra ID; 2FA afdwingen in Entra (Conditional Access) | `/privacy` |
| US-33 Privacy aantoonbaar | P2 | gereed; verwerkingspagina, contactpersoonvelden verwijderd; AI via de Anthropic-API, Europese verwerking nog contractueel vast te leggen (`AI_VERWERKING_REGIO=eu`) | `/privacy` |

## Open punten

Gebouwd: standaardweging (US-17), eigenaarschap evaluaties (US-20), gewicht eigen ervaring (US-21), externe projecten (US-25) en de correctie voor lage dekking in de rangschikking. Buiten de app: Europese AI-verwerking contractueel vastleggen (de app gebruikt de Anthropic-API) en de koppeling vanuit de tenderapplicatie zelf.
