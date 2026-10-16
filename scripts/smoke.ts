// Rooktest van de domeinlogica zonder browser: npm run smoke
import { maakSeedDatabase } from "../src/lib/domain/seed";
import { matchProject, profielBronnen, profieltekst, semantischZoeken, valideerGewichten } from "../src/lib/domain/matching";
import { stelTeamSamen } from "../src/lib/domain/team";
import { signalenVoor } from "../src/lib/domain/signalen";
import { leidFactorenAf } from "../src/lib/domain/derive";
import { kandidaatNaarConcept, kandidaatNaarPartner, vindDubbel } from "../src/lib/domain/discovery";
import { heeftRecht, normaliseerRol, vindOfRegistreer } from "../src/lib/domain/gebruikers";
import { chatContext } from "../src/lib/domain/chat";
import type { Gebruiker } from "../src/lib/domain/types";
import { extraheerVoorstellen, factorNogBevestigd, inhoudsHash, splitsClaims } from "../src/lib/domain/enrichment";
import { extraheerProjectprofiel } from "../src/lib/domain/extractie";
import { importeerEngagements } from "../src/lib/domain/csv";
import { maakLegeDatabase } from "../src/lib/domain/seed";
import { AANVULLING, laadAanvulling } from "../src/lib/domain/aanvulling";
import { rijNaarPartner, voegPartnersToe, voegRijenSamen } from "../src/lib/domain/partnerimport";
import houtbouwers from "../src/data/houtbouwers-seed.json";
import { kiesSubpaginas, leesReferenties, pastBijNaam, vindDetailLink } from "../src/lib/domain/webverrijking";
import { maakSeedIdGenerator, migreerDatabase } from "../src/lib/domain/migratie";
import { effectieveStatus, herkomstExport, wisHerkomst } from "../src/lib/domain/herkomst";
import { leidVerbandenAf } from "../src/lib/domain/verbanden";
import { naamGelijkenis } from "../src/lib/domain/fuzzy";
import { naarCsv, partnersCsv } from "../src/lib/domain/export";
import { veldKwaliteit } from "../src/lib/domain/datakwaliteit";
import { geldigeRollen, normaliseerWebsite, raadRollen, regelConcept, vrijgaveBlokkades } from "../src/lib/domain/registratie";
import { aiBudget, budgetStatus, kostenEur, kwartaalVan, maandVan, maandVerbruik, modelVoor, schatVerrijkingsronde, verbruikPerPeriode, verbruikSpecificatie } from "../src/lib/domain/kosten";
import { selecteerPartners, standaardSchema, teDraaienRonde, volgendeRonde } from "../src/lib/domain/schema";
import type { AIBewerking } from "../src/lib/domain/types";
import { leesBasisprofiel, sbiTekst } from "../src/lib/domain/kvk";
import { bingDoelUrl, diagnoseTekst } from "../src/lib/domain/webzoek";
import { MATCH_DISCLAIMER, matchRijen, waardenRijen } from "../src/lib/domain/export";
import { regelOnderbouwingRol, regelVerbandAnalyse } from "../src/lib/domain/onderbouwing";
import { controleerVerwijderen, pseudoniem, verwijderPartnerDefinitief, VERWIJDERD } from "../src/lib/domain/verwijderen";
import { volledigeExportJson, volledigeExportTabellen } from "../src/lib/domain/volledigeExport";
import { naarXlsx } from "../src/lib/xlsx";
import leesExcel, { readSheetNames } from "read-excel-file/node";
import { afgeleideTotaalscore, controleerTotaal, historieTreft } from "../src/lib/domain/tevredenheid";
import { aanbiedersUitOverzicht, ontdubbel, regelOnderbouwing, regelZoekvragen } from "../src/lib/domain/aandragen";
import { leesSbi } from "../src/lib/domain/webverrijking";
import { leesZipBestand, maakZip } from "../src/lib/zip";
import { bepaalOmgeving, databaseAanduiding } from "../src/lib/domain/omgeving";
import { VERIFICATIE_WEGING, verificatieVan } from "../src/lib/domain/verificatie";
import { automatischToepasbaar, pasAutomatischToe } from "../src/lib/domain/voorstellen";
import { docxTekst, leesTekstUitBestand } from "../src/lib/documenttekst";
import { controleerRegisters, partnerInRegister, registerUrl, verwerkRegisterUitkomsten } from "../src/lib/domain/registers";
import { certificaatStatus } from "../src/components/partners/certificaten";
import { jsPDF } from "jspdf";
import { BRON_LABEL } from "../src/lib/domain/types";
import { betrouwbaarheidNiveau, bronRang, bronTekst, markeerGeenBron, registreerHandmatigeBasisvelden, zetBasisveldHerkomst } from "../src/lib/domain/herkomst";
import { verwerkVoorstellen, veldenZonderBron } from "../src/lib/domain/voorstellen";
import { goudstandaardVoorPartner, gezochteVelden } from "../src/lib/domain/goudstandaard";
import { basisVeldKwaliteit, statusVerdeling } from "../src/lib/domain/datakwaliteit";
import { BASISVELDEN } from "../src/lib/domain/webverrijking";
import { BRON_BETROUWBAARHEID, type Bron, type EnrichmentVoorstel } from "../src/lib/domain/types";

import { ROLLEN } from "../src/lib/domain/types";
import { standaardGoudstandaard, veldGevuld } from "../src/lib/domain/goudstandaard";
import { productFactoren } from "../src/lib/domain/partnerimport";
import { NIEUWE_TYPES } from "../src/lib/domain/gewichten";
import { dataSignalen, filterSignalen, vullingPerRol, wachtOpBeheerder } from "../src/lib/domain/datakwaliteit";
import { effectieveFactoren } from "../src/lib/domain/derive";
import { VERIFICATIE_LABEL } from "../src/lib/domain/verificatie";
import { onderbouwKandidaat } from "../src/lib/domain/onderbouwing";
import { bronVoorUrl, heeftBronEnOnderbouwing, pasBronrangToe, STANDAARD_BRANCHEBRONNEN } from "../src/lib/domain/bronbeleid";
import { dekkingVanRol, herweegResultaat, normaliseerGewichten, wegingVanEis } from "../src/lib/domain/herweging";
import { ervaringenVan } from "../src/lib/domain/matching";
import { persoonsgegevensInTekst } from "../src/lib/domain/tevredenheid";
import { openstaandeEvaluaties } from "../src/lib/domain/evaluatieproces";
import { teamCombinaties } from "../src/lib/domain/verbanden";
import { bewezenTeams } from "../src/lib/domain/team";
import { importeerProjecten } from "../src/lib/domain/projectimport";
import { migreerV14, migreerV15 } from "../src/lib/domain/migratie";
import { beoordeelRelevantie, isUitgeslotenDomein, zoektermenVoorProject } from "../src/lib/domain/relevantie";
import { externeBedrijfsLinks } from "../src/lib/domain/webzoek";
import { CATEGORIEEN, categorieVan } from "../src/lib/domain/kosten";

import { aiVerwerking } from "../src/lib/aiplatform";
import { dempVoorDekking } from "../src/lib/domain/matching";
import { pasErvaringsgewichtToe, teamWeging } from "../src/lib/domain/gewichten";
import { herinneringDagen, isVerantwoordelijke } from "../src/lib/domain/evaluatieproces";
import { genoemdePartners, isLinkedIn } from "../src/lib/domain/externprojecten";

let fouten = 0;
function check(naam: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "OK " : "FOUT"} ${naam}${detail !== undefined ? ` — ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`);
  if (!ok) fouten++;
}

const db = maakSeedDatabase();

// Factorenmodel en gewichtsprofielen
db.gewichtsprofielen.forEach((gp) =>
  Object.entries(gp.perRol).forEach(([rol, eisen]) => {
    const v = valideerGewichten(eisen ?? [], db.factoren);
    check(`gewichten ${gp.id}/${rol} = 100`, v.geldig, v.som);
  })
);

// Matching
const groeneLoper = db.projecten.find((p) => p.id === "proj-groene-loper")!;
const res = matchProject({ db, project: groeneLoper });
const aannemer = res.find((r) => r.rol === "aannemer")!;
check("US-12 aannemer top-1 is Woudbouw", aannemer.kandidaten[0]?.partnerId === "p-woudbouw", aannemer.kandidaten.map((k) => `${k.partnerNaam}:${k.score}`));
check("US-14 geblokkeerde BetonFix in uitsluitingen", aannemer.uitsluitingen.some((u) => u.partnerId === "p-betonfix" && u.soort === "status"));
check("US-14 Dorpsbouw niet beschikbaar in periode", aannemer.uitsluitingen.some((u) => u.partnerId === "p-dorpsbouw"), aannemer.uitsluitingen.find((u) => u.partnerId === "p-dorpsbouw")?.reden);
check("uitgangspunt 1: prospect apart van advies", aannemer.prospects.some((k) => k.partnerId === "p-hollands-hout") && !aannemer.kandidaten.some((k) => k.isProspect));
check("US-13 criteria met bron en bijdrage", aannemer.kandidaten[0].criteria.every((c) => c.fit === null || (c.bron && c.effectiefGewicht >= 0)));
const adviseur = res.find((r) => r.rol === "adviseur")!;
check("US-04b dekkingsgraad-waarschuwing bij dun profiel", adviseur.kandidaten.some((k) => k.dekkingsgraad < 60 && k.waarschuwingen.some((w) => w.includes("Dekkingsgraad"))));
check("US-15 semantische treffers gemarkeerd", aannemer.kandidaten[0].semantischeTreffers.length > 0, aannemer.kandidaten[0].semantischeTreffers);

// Team
const run = { id: "r", projectId: groeneLoper.id, naam: "t", gestartOp: "", door: "", input: { eisen: groeneLoper.eisen }, resultaat: res };
const team = stelTeamSamen(run, db, groeneLoper);
check("US-35 team voor alle rollen", team?.leden.length === groeneLoper.eisen.length, team?.leden.map((l) => `${l.rol}:${l.partnerNaam}`));
check("US-36 samenwerkingshistorie in teamscore", (team?.onderdelen.samenwerkingshistorie ?? 0) > 50, team?.onderdelen);
const alt = stelTeamSamen(run, db, groeneLoper, "alternatief", team?.leden.map((l) => l.partnerId) ?? []);
check("US-37 alternatief team wijkt af", !!alt && alt.leden.every((l) => !team?.leden.some((t) => t.partnerId === l.partnerId)), alt?.leden.map((l) => l.partnerNaam));

// Historie als bewijs
const woud = leidFactorenAf(db.partners.find((p) => p.id === "p-woudbouw")!, db);
check("US-19 afgeleide projecttype-ervaring", woud.factoren.some((f) => f.factorId === "projecttype" && f.afgeleid && f.bron === "projecthistorie"));
check("US-20 kostenvastheid en planningsbetrouwbaarheid", woud.statistieken.kostenvastheid !== null && woud.statistieken.planningsbetrouwbaarheid !== null, woud.statistieken);

// Semantisch zoeken
const sem = semantischZoeken(db, "circulaire houtbouw met demontabele gevel");
check("US-15 zoeken vindt houtbouwers bovenaan", sem[0]?.partner.id === "p-woudbouw", sem.slice(0, 3).map((r) => `${r.partner.naam}:${r.score}`));

// Signalen
const sig = signalenVoor(db);
check("US-06 certificaat-signaal binnen 90 dagen", sig.some((s) => s.soort === "certificaat" && s.ernst === "waarschuwing"));
check("US-32 risicosignaal", sig.some((s) => s.soort === "risico"));
check("US-33 afhankelijkheidssignaal", sig.some((s) => s.soort === "afhankelijkheid"));
check("US-21 evaluatieherinnering bij opgeleverd", sig.some((s) => s.soort === "evaluatie"));

// Discovery dubbelen
check("US-26 dubbel op KVK", vindDubbel({ naam: "X", kvk: "34123456" }, db.partners)?.partner.id === "p-woudbouw");
check("US-26 dubbel op naam", vindDubbel({ naam: "Woudbouw Groep" }, db.partners)?.partner.id === "p-woudbouw");

// Verrijking
const voorstellen = extraheerVoorstellen(db.partners.find((p) => p.id === "p-steenhuis")!, "Wij bouwen in CLT en houtskeletbouw; onze MPG-berekening (NMD) van 0,52 is gerealiseerd in het opgeleverde project X. Wij zijn de duurzaamste bouwer van Nederland en 100% duurzaam.", "https://example.org");
check("US-29 extractie levert voorstellen met bron web", voorstellen.length > 0 && voorstellen.every((v) => v.bron === "web"), voorstellen.map((v) => `${v.veld}:${v.soort}`));
check("US-30 aantoonbaar vs geclaimd", voorstellen.some((v) => v.soort === "aantoonbaar"));
const claims = splitsClaims("Onze MPG-berekening van 0,45 is gemeten. Wij zijn de groenste bouwer.");
check("US-30 claims gesplitst", claims.aantoonbaar.length === 1 && claims.geclaimd.length === 1, claims);

// Aanvullende dataset (echte partners/projecten) bovenop het houtbouwersoverzicht
{
  const leeg = maakLegeDatabase();
  let t = 0;
  const id = (p: string) => `${p}-${++t}`;
  const bron = houtbouwers as { sourceFile: string; partners: Array<{ values: Record<string, string | number | boolean> }> };
  const rijen = voegRijenSamen(bron.partners.map((p) => rijNaarPartner(p.values)).filter((p): p is NonNullable<typeof p> => Boolean(p)));
  voegPartnersToe(leeg, rijen, new Map(), bron.sourceFile, id);
  const voor = leeg.partners.length;
  const u = laadAanvulling(leeg, new Map(), id);
  const metWebsite = leeg.partners.filter((p) => p.website).length;
  check("Aanvulling: projecten geladen", u.projectenNieuw === AANVULLING.projecten.length && leeg.projecten.length === AANVULLING.projecten.length, u);
  check("Aanvulling: nieuwe partners en aanvulling bestaande", u.partnersNieuw > 50 && u.partnersAangevuld >= 5 && leeg.partners.length === voor + u.partnersNieuw, u);
  check("Aanvulling: websites bestaande houtbouwers aangevuld", u.websitesAangevuld >= 70 && metWebsite > voor * 0.8, { voor, metWebsite, u });
  check("Aanvulling: betrokkenheden gekoppeld aan bestaande partners", u.engagementsNieuw >= 40 && leeg.engagements.every((e) => leeg.partners.some((p) => p.id === e.partnerId) && leeg.projecten.some((p) => p.id === e.projectId)), u.engagementsNieuw);
  const u2 = laadAanvulling(leeg, new Map(), id);
  check("Aanvulling: herladen is idempotent", u2.partnersNieuw === 0 && u2.projectenNieuw === 0 && u2.engagementsNieuw === 0 && leeg.partners.length === voor + u.partnersNieuw, u2);
  check("Aanvulling: geen dubbele partners op naam", new Set(leeg.partners.map((p) => p.naam.toLowerCase())).size === leeg.partners.length);
}

// Eis 1: herkomst en status per veldwaarde — bron, validatie, afwijkende herverrijking, veroudering, AVG
{
  const p = db.partners.find((x) => x.id === "p-woudbouw")!;
  const factorDef = { ...db.factoren.find((f) => f.id === "mpg")!, vervalMaanden: 24 };
  // 1. Waarde uit een bron (web) is 'voorgesteld', nooit stilzwijgend leidend.
  const web: (typeof p.factoren)[number] = { factorId: "mpg", waarde: 0.52, bron: "web", betrouwbaarheid: 0.55, peildatum: "2026-08-01", status: "voorgesteld" };
  check("Eis 1: bronwaarde is voorgesteld", effectieveStatus(web, factorDef, new Date("2026-08-30")) === "voorgesteld");
  // 2. Menselijke validatie.
  const gevalideerd = { ...web, status: "gevalideerd" as const, gevalideerdDoor: "Inkoper", gevalideerdOp: "2026-08-15" };
  check("Eis 1: mens valideert", effectieveStatus(gevalideerd, factorDef, new Date("2026-08-30")) === "gevalideerd" && gevalideerd.gevalideerdDoor === "Inkoper");
  // 3. Herverrijking vindt iets anders: voorstel wordt conflictsignaal, gevalideerde waarde blijft staan.
  p.factoren = p.factoren.filter((f) => f.factorId !== "mpg");
  p.factoren.push(gevalideerd);
  const her = extraheerVoorstellen(p, "MPG-berekening (NMD) van 0,61 gerealiseerd in opgeleverd project.", "https://example.org/nieuw");
  const mpgVoorstel = her.find((v) => v.factorId === "mpg")!;
  const conflict = JSON.stringify(p.factoren.find((f) => f.factorId === "mpg")!.waarde) !== JSON.stringify(mpgVoorstel.voorgesteld);
  check("Eis 1: herverrijking overschrijft gevalideerd niet — signaal ernaast", conflict && p.factoren.find((f) => f.factorId === "mpg")!.waarde === 0.52 && mpgVoorstel.voorgesteld === 0.61);
  // 4. Automatische veroudering na de vervaltermijn.
  check("Eis 1: automatisch verouderd na termijn", effectieveStatus(gevalideerd, factorDef, new Date("2028-09-15")) === "verouderd");
  // 5. AVG: export en verwijdering van herkomst.
  const exp = herkomstExport(p, db.factoren, new Date("2026-08-30"));
  check("Eis 1: herkomst exporteerbaar", exp.waarden.some((w) => w.bron === "web" && w.status === "gevalideerd") && exp.waarden.every((w) => ["hoog", "midden", "laag"].includes(w.betrouwbaarheid)));
  const kopie = JSON.parse(JSON.stringify(p)) as typeof p;
  kopie.bronnen.push({ url: "https://example.org", opgehaaldOp: "2026-08-01", soort: "verrijking" });
  kopie.factoren[0].bewijs = { soort: "url", ref: "https://example.org", label: "web" };
  const n = wisHerkomst(kopie);
  check("Eis 1: herkomst verwijderbaar (AVG)", n > 0 && kopie.bronnen.length === 0 && kopie.factoren.every((f) => !f.bewijs && !f.toelichting) && kopie.factoren.length === p.factoren.length);
}

// Eis 2 / US-58: AI-verbruik in bewerkingen en euro — bewerking -> aanroepen, maand/kwartaal, budget, signalen
{
  const nu = new Date("2026-09-15T10:00:00Z");
  const aanroep = (inT: number, uitT: number) => ({ model: "claude-haiku-4-5", doel: "extractie", invoerTokens: inT, uitvoerTokens: uitT, kostenEur: kostenEur(inT, uitT), op: nu.toISOString() });
  const bewerking = (soort: AIBewerking["soort"], op = nu.toISOString()): AIBewerking => ({ id: `b-${Math.random()}`, soort, door: "t", op, aanroepen: [aanroep(7000, 800), aanroep(6000, 700)], invoerTokens: 13000, uitvoerTokens: 1500, kostenEur: kostenEur(13000, 1500) });
  check("US-58 rekenprijs € 2,50 in / € 10,00 uit per miljoen tokens", Math.abs(kostenEur(1_000_000, 1_000_000) - 12.5) < 1e-9);
  const b1 = bewerking("verrijking");
  check("US-58 één bewerking met meerdere aanroepen", b1.aanroepen.length === 2 && Math.abs(b1.kostenEur - b1.aanroepen[0].kostenEur - b1.aanroepen[1].kostenEur) < 1e-9);
  const v = maandVerbruik([b1, bewerking("chat"), bewerking("match"), bewerking("aandraag"), bewerking("verrijking", "2026-08-01T00:00:00Z")], nu);
  check("US-58 maandverbruik per categorie", v.bewerkingen === 4 && v.perCategorie.verrijking === 1 && v.perCategorie.chat === 1 && v.perCategorie["match/verband"] === 1 && v.perCategorie.discovery === 1, v.perCategorie);
  const kw = verbruikPerPeriode([b1, bewerking("chat", "2026-08-01T00:00:00Z"), bewerking("chat", "2026-03-01T00:00:00Z")], "kwartaal");
  check("US-58 verbruik per kwartaal", kw.length === 2 && kw[0].periode === "2026-K3" && kw[0].bewerkingen === 2);
  const dbK = maakLegeDatabase();
  check("US-58 standaardbudget 750 bewerkingen en € 30", aiBudget(dbK).bewerkingenPerMaand === 750 && aiBudget(dbK).tokenbudgetEur === 30);
  dbK.instellingen.aiBudget = { ...aiBudget(dbK), bewerkingenPerMaand: 10 };
  dbK.aiBewerkingen = Array.from({ length: 8 }, () => bewerking("chat"));
  const bs = budgetStatus(dbK, nu);
  check("US-58 signaal bij 80% van het budget in bewerkingen", bs.waarschuwing && !bs.overschreden && Math.round(bs.pct) === 80);
  dbK.aiBewerkingen = Array.from({ length: 13 }, () => bewerking("chat"));
  check("US-58 apart signaal boven 125% in een maand", budgetStatus(dbK, nu).boven125 && signalenVoor(dbK, nu).some((x) => x.id === "ai-budget-125"));
  dbK.aiBewerkingen = [...Array.from({ length: 12 }, () => bewerking("chat", "2026-07-10T00:00:00Z")), ...Array.from({ length: 12 }, () => bewerking("chat", "2026-08-10T00:00:00Z")), ...Array.from({ length: 11 }, () => bewerking("chat"))];
  check("US-58 signaal gemiddeld > 110% over het kwartaal", budgetStatus(dbK, nu).kwartaalBoven110 && signalenVoor(dbK, nu).some((x) => x.id === "ai-budget-kwartaal"));
  const spec = verbruikSpecificatie({ ...dbK, aiBewerkingen: [b1] });
  check("US-58 specificatie met bewerkingen, tokens en providerkosten", spec.regels.length === 1 && spec.regels[0]["Invoertokens"] === 13000 && spec.perMaand[0].Bewerkingen === 1);
  // US-59: model per functie
  check("US-59 licht model voor extractie, zwaarder voor chat", modelVoor(dbK, "extractie") === "claude-haiku-4-5" && modelVoor(dbK, "chat") === "claude-sonnet-5");
  dbK.instellingen.modellen = { ...dbK.instellingen.modellen, chat: "claude-opus-5" };
  check("US-59 modelkeuze instelbaar", modelVoor(dbK, "chat") === "claude-opus-5");
  // US-57: schatting in bewerkingen
  dbK.aiBewerkingen = [];
  dbK.instellingen.aiBudget.bewerkingenPerMaand = 750;
  dbK.verrijkingsrondes = [{ id: "r", gestartOp: "", bijgewerktOp: "", door: "", totaal: 20, partnerIdsVerwerkt: Array.from({ length: 20 }, (_, i) => `p${i}`), ongewijzigd: 15, nieuw: 0, gewijzigd: 0, nietBevestigd: 0 }];
  const partnersS = [...Array.from({ length: 4 }, () => ({ webHash: undefined, website: "x" })), ...Array.from({ length: 8 }, () => ({ webHash: "h", website: "x" }))];
  const sch = schatVerrijkingsronde(partnersS, dbK, true);
  check("US-57 verwachte bewerkingen = partners die echt verrijkt worden", sch.bewerkingen === 6 && sch.overgeslagen === 6 && sch.resterendNa === 744, sch);
  check("US-57 zonder AI geen bewerkingen", schatVerrijkingsronde(partnersS, dbK, false).bewerkingen === 0);
  dbK.instellingen.aiBudget.bewerkingenPerMaand = 5;
  check("US-57 ronde die het budget zou overschrijden wordt herkend", schatVerrijkingsronde(partnersS, dbK, true).overschrijdtBudget);
  dbK.instellingen.aiBudget = { ...dbK.instellingen.aiBudget, bewerkingenPerMaand: 750, tokenbudgetEur: 0.05 };
  check("Budget telt alleen in bewerkingen (geen bedragen)", !schatVerrijkingsronde(partnersS, dbK, true).overschrijdtBudget);
  check("Verbruiksexport zonder bedragen", !JSON.stringify(verbruikSpecificatie(dbK)).match(/EUR|€|kosten/i));
  check("US-58 maandindeling in Nederlandse tijd", maandVan("2026-09-30T22:30:00Z") === "2026-10" && kwartaalVan("2026-09-30T22:30:00Z") === "2026-K4" && maandVan("2026-01-31T12:00:00Z") === "2026-01");
}

// Migratie v11: budget in euro/bewerkingen, modellen, schema en registers; kosten herrekend
{
  const oud = maakLegeDatabase() as ReturnType<typeof maakLegeDatabase> & { instellingen: { aiBudgetUsdPerMaand?: number } };
  oud.versie = 10;
  delete (oud.instellingen as Partial<typeof oud.instellingen>).aiBudget;
  delete (oud.instellingen as Partial<typeof oud.instellingen>).modellen;
  delete (oud.instellingen as Partial<typeof oud.instellingen>).verrijkingsschema;
  delete (oud.instellingen as Partial<typeof oud.instellingen>).registerbronnen;
  oud.instellingen.aiBudgetUsdPerMaand = 100;
  oud.aiBewerkingen = [{ id: "x", soort: "verrijkingsronde", door: "s", op: "2026-08-01T00:00:00Z", aanroepen: [{ model: "claude-opus-5", doel: "d", invoerTokens: 1_000_000, uitvoerTokens: 0, kostenUsd: 5, op: "" } as unknown as AIBewerking["aanroepen"][number]], invoerTokens: 1_000_000, uitvoerTokens: 0, kostenUsd: 5 } as unknown as AIBewerking];
  migreerDatabase(oud, new Map());
  const i = oud.instellingen;
  check("Migratie v11: budget, modellen, schema, registers en kosten in euro", i.aiBudget?.bewerkingenPerMaand === 750 && i.modellen?.extractie === "claude-haiku-4-5" && i.verrijkingsschema?.frequentie === "uit" && i.registerbronnen?.length === 3 && oud.aiBewerkingen[0].kostenEur === 2.5 && !("aiBudgetUsdPerMaand" in i));
}

// US-56: verrijkingsschema — volgende ronde (Nederlandse tijd), omvang
{
  const basis = { ...standaardSchema(new Date("2026-09-01T00:00:00Z")), frequentie: "wekelijks" as const, dag: 3, tijd: "06:00" };
  const volgende = volgendeRonde(basis, new Date("2026-09-01T00:00:00Z"))!;
  check("US-56 wekelijks op woensdag 06:00 NL-tijd", volgende.toISOString() === "2026-09-02T04:00:00.000Z", volgende.toISOString());
  const wissel = volgendeRonde({ ...basis, frequentie: "maandelijks", dag: 25, tijd: "02:30" }, new Date("2026-10-01T00:00:00Z"))!;
  check("US-56 tijd rond de wintertijdwissel (25 okt 2026)", wissel.toISOString() === "2026-10-25T01:30:00.000Z" || wissel.toISOString() === "2026-10-25T00:30:00.000Z", wissel.toISOString());
  const winter = volgendeRonde({ ...basis, frequentie: "maandelijks", dag: 5 }, new Date("2026-11-10T00:00:00Z"))!;
  check("US-56 maandelijks, wintertijd", winter.toISOString() === "2026-12-05T05:00:00.000Z", winter.toISOString());
  const kwartaal = volgendeRonde({ ...basis, frequentie: "kwartaal", dag: 1 }, new Date("2026-09-15T00:00:00Z"))!;
  check("US-56 per kwartaal (1 oktober)", kwartaal.toISOString().startsWith("2026-10-01"), kwartaal.toISOString());
  const twee = { ...basis, frequentie: "tweewekelijks" as const, laatsteGeplandeRonde: "2026-09-02T04:00:00.000Z" };
  check("US-56 tweewekelijks slaat een week over", volgendeRonde(twee, new Date("2026-09-02T04:00:00.000Z"))!.toISOString() === "2026-09-16T04:00:00.000Z");
  check("US-56 te draaien zodra het moment verstreken is", teDraaienRonde(basis, new Date("2026-09-02T05:00:00Z"))?.toISOString() === "2026-09-02T04:00:00.000Z" && teDraaienRonde(basis, new Date("2026-09-01T12:00:00Z")) === null && teDraaienRonde({ ...basis, frequentie: "uit" }, new Date("2027-01-01")) === null);
  const dbS = maakSeedDatabase();
  const oud = dbS.partners[0];
  oud.laatstVerrijktOp = "2025-01-01T00:00:00Z";
  dbS.partners[1].laatstVerrijktOp = new Date().toISOString();
  const sel = selecteerPartners(dbS, { omvang: "niet_verrijkt_sinds", rollen: [], maanden: 6 });
  check("US-56 omvang: niet verrijkt sinds X maanden", sel.some((p) => p.id === oud.id) && !sel.some((p) => p.id === dbS.partners[1].id));
  check("US-56 omvang: per partnertype", selecteerPartners(dbS, { omvang: "partnertype", rollen: ["architect"], maanden: 6 }).every((p) => p.rollen.includes("architect")));
  check("US-56 omvang: gewijzigde website = partners met website", selecteerPartners(dbS, { omvang: "gewijzigde_website", rollen: [], maanden: 6 }).every((p) => p.website));
}

// B3: delta-hash en 'niet langer bevestigd'
{
  const t1 = "Wij bouwen in CLT met een MPG-berekening van 0,52.";
  check("B3: inhoudshash stabiel en gevoelig", inhoudsHash(t1) === inhoudsHash(t1) && inhoudsHash(t1) !== inhoudsHash(t1 + "!"));
  check("B3: factor nog bevestigd", factorNogBevestigd("mpg", t1) && factorNogBevestigd("bouwsysteem", t1));
  check("B3: factor niet langer bevestigd", !factorNogBevestigd("mpg", "Wij bouwen traditioneel.") && factorNogBevestigd("evaluatiescore", "geen patroon voor deze factor"));
}

// B7: verbanden met bron, als signaal
{
  const verbanden = leidVerbandenAf(db);
  check("B7: verbanden uit gedeelde projecthistorie met bron", verbanden.length > 0 && verbanden.every((v) => v.bronnen.length > 0) && verbanden.some((v) => v.bronnen.some((b) => b.soort === "project")));
}

// B8: fuzzy dubbelen, export, datakwaliteit, archiveren
{
  check("B8: fuzzy naamvergelijking", naamGelijkenis("Giesbers Ontwikkelen en Bouwen", "Giesbers Wijchen") > 0.4 && naamGelijkenis("Van Wijnen B.V.", "van wijnen") === 1 && naamGelijkenis("Dura Vermeer", "Heijmans") < 0.3);
  check("B8: dubbel via fuzzy naam", vindDubbel({ naam: "Woudbouw Group" }, db.partners)?.partner.id === "p-woudbouw");
  const csv = partnersCsv(db);
  check("B8: partnerexport CSV met herkomststatus", csv.includes("Naam;KVK;Status") && csv.includes("[gevalideerd") && csv.split("\r\n").length > db.partners.length);
  check("B8: naarCsv ontsnapt", naarCsv([{ a: 'x;"y"' }]).includes('"x;""y"""'));
  const kwaliteit = veldKwaliteit(db);
  check("B8: datakwaliteit per veld", kwaliteit.length > 10 && kwaliteit.every((k) => k.pctVolledig >= 0 && k.pctVolledig <= 100));
  const gearchiveerd = { ...db.partners[0], id: "p-arch-test", naam: "Archieftest BV", status: "gearchiveerd" as const };
  db.partners.push(gearchiveerd);
  check("B8: gearchiveerd buiten verbanden en semantisch zoeken", !leidVerbandenAf(db).some((v) => v.a.id === gearchiveerd.id || v.b.id === gearchiveerd.id) && !semantischZoeken(db, "houtbouw", 200).some((t) => t.partner.id === gearchiveerd.id));
  db.partners = db.partners.filter((p) => p.id !== gearchiveerd.id);
}

// Bronnen in de matching: brochure-/Conceptenboulevard-gegevens en documenten voeden het semantische profiel
{
  const p = JSON.parse(JSON.stringify(db.partners.find((x) => x.id === "p-woudbouw")!)) as (typeof db.partners)[number];
  const zonder = profieltekst(p);
  p.brongegevens = [{ bron: "Woningconceptenbrochure - maart 2026", op: "2026-03-01", titel: "Concept X", velden: { "Mogelijke (woning)types": "Grondgebonden", "Biobased - % massa": "0.42", Kapconstructie: "Zadeldak instelbaar" } }];
  p.documenten = [{ id: "d1", naam: "Conceptenboulevard-profiel", soort: "brochure", tekst: "Fabrieksmatige houtbouw met demontabele gevelelementen en zadeldak.", toegevoegdDoor: "test", op: "2026-09-01" }];
  const met = profieltekst(p);
  check("Match-bronnen: brondata en documenten in semantisch profiel", met.length > zonder.length && met.includes("Zadeldak") && met.includes("demontabele gevelelementen"));
  check("Match-bronnen: bronvermelding voor de uitleg", profielBronnen(p).includes("Woningconceptenbrochure - maart 2026") && profielBronnen(p).some((b) => b.startsWith("document: Conceptenboulevard")));
  const treffers = semantischZoeken({ ...db, partners: [p] } as typeof db, "zadeldak demontabele gevel houtbouw", 5);
  check("Match-bronnen: zoekvraag matcht op brochuregegevens", treffers.length === 1 && treffers[0].score > 0);
}

// Bronwebsites: detaillink van een partner op een overzichtspagina (Conceptenboulevard-stijl)
{
  const html = '<a href="/aanbieders/bam-wonen/id=5">BAM Wonen</a><a href="/aanbieders/barli/id=47">Barli</a><a href="/nieuws/x">Nieuws</a><a href="mailto:x@y.nl">mail</a>';
  check("Bronwebsites: detaillink gevonden op naam", vindDetailLink(html, "https://conceptenboulevard.nl/aanbieders/", "Barli") === "https://conceptenboulevard.nl/aanbieders/barli/id=47");
  check("Bronwebsites: geen valse detaillink", vindDetailLink(html, "https://conceptenboulevard.nl/aanbieders/", "Nimbel") === null);
}

// Migratie versie 1 → 2 (stabiele IDs + aanvulling) van een opgeslagen database met tijdstempel-IDs
{
  const oud = maakLegeDatabase();
  oud.versie = 1;
  let t = 0;
  const tijdId = (p: string) => `${p}-m${Date.now().toString(36)}${(++t).toString(36)}`;
  const bron = houtbouwers as { sourceFile: string; partners: Array<{ values: Record<string, string | number | boolean> }> };
  voegPartnersToe(oud, voegRijenSamen(bron.partners.map((p) => rijNaarPartner(p.values)).filter((p): p is NonNullable<typeof p> => Boolean(p))), new Map(), bron.sourceFile, tijdId);
  const giesbers = oud.partners.find((p) => p.naam === "Giesbers")!;
  oud.engagements.push({ id: "eng-x", partnerId: giesbers.id, projectId: "proj-x", rol: "aannemer", periode: { van: "2024-01-01" }, contractwaarde: 1, bron: "handmatig" });
  const u = migreerDatabase(oud, new Map())!;
  check("Migratie: versie en hernoemde IDs", oud.versie >= 3 && u.hernoemd === 103 && giesbers.id === "p-giesbers", { versie: oud.versie, hernoemd: u.hernoemd, id: giesbers.id });
  check("Migratie: verwijzingen meegeschreven", oud.engagements[0].partnerId === "p-giesbers");
  check("Migratie: aanvulling geladen met stabiele IDs", oud.projecten.some((p) => p.id === "proj-casa-vita") && oud.partners.some((p) => p.id === "p-kow"), oud.projecten.map((p) => p.id).slice(0, 3));
  check("Migratie: tweede keer geen effect", migreerDatabase(oud, new Map()) === null);
  const gen = maakSeedIdGenerator(["p-kow"]);
  check("Migratie: botsende naam krijgt volgnummer", gen("p", "KOW") === "p-kow-2" && gen("audit") === "audit-seed-1");
}

// Internetverrijking (pure delen)
check("Webverrijking: website past bij naam", pastBijNaam("Giesbers Ontwikkelen en Bouwen", "https://giesberswijchen.nl") && !pastBijNaam("Giesbers", "https://www.funda.nl"));
const sub = kiesSubpaginas('<a href="/over-ons">Over</a><a href="/projecten">P</a><a href="https://x.nl/duurzaamheid">D</a><a href="/contact">C</a>', "https://x.nl");
check("Webverrijking: subpagina's gekozen", sub.length === 3 && sub[0] === "https://x.nl/over-ons", sub);
const refs = leesReferenties("<h2>Casa Vita Pijnacker</h2><h3>Contact</h3><h2>84 woningen Houtwijk</h2>");
check("Webverrijking: referenties uit koppen", refs.length === 2, refs);

// Documentextractie
const ex = extraheerProjectprofiel("Projectnaam: Zonnehof\nLocatie: Utrecht\n72 appartementen in middenhuur, hoogstedelijk, circulair en Paris Proof. Start bouw 2027-09, oplevering 2029.");
check("US-11 extractie met herkomst", ex.velden.woningen === 72 && ex.velden.plaats === "Utrecht" && ex.velden.type === "appartementen" && ex.herkomst.length > 3, ex.velden);

// CSV-import
const csv = importeerEngagements("kvk;project;rol;van;contractwaarde\n34123456;Houtwijk Vathorst;aannemer;2024-01-01;1000\n99999999;Onbekend;aannemer;2024-01-01;1", db);
check("US-18 CSV match op KVK + wachtrij", csv.engagements.length === 1 && csv.wachtrij.length === 1, csv.wachtrij[0]?.reden);

// Partnerregistratie door AI (regelterugval, vrijgavecontrole, uitsluiting tot vrijgave)
const rc = regelConcept({ naam: "Bouwbedrijf Voorbeeld B.V." }, "Bouwbedrijf Voorbeeld is aannemer van nieuwbouwwoningen. Kerkstraat 1, 3811 AB Amersfoort. KvK-nummer: 12345678.", []);
check("Registratie: regels lezen KVK, plaats en rol", rc.velden.kvk === "12345678" && rc.velden.vestigingsplaats === "Amersfoort" && rc.velden.rollen.includes("aannemer") && rc.velden.rechtsvorm === "B.V." && rc.herkomst.length >= 3, rc.velden);
check("Registratie: rollen raden en valideren", raadRollen("architectenbureau en constructeur").join() === "architect,adviseur" && geldigeRollen(["Aannemer", "timmerman", "aannemer"]).join() === "aannemer");
check("Registratie: website genormaliseerd", normaliseerWebsite("www.x.nl/over") === "https://www.x.nl" && normaliseerWebsite("") === undefined);
check("Registratie: vrijgave geblokkeerd zonder rol/plaats", vrijgaveBlokkades({ naam: "X", rollen: [], vestigingsplaats: "", kvk: "123" }).length === 3 && vrijgaveBlokkades({ naam: "X", rollen: ["aannemer"], vestigingsplaats: "Utrecht", kvk: "" }).length === 0);
{
  const dbR = maakSeedDatabase();
  const doel = dbR.partners.find((p) => p.rollen.includes("aannemer"))!;
  doel.status = "concept";
  const r = matchProject({ db: dbR, project: dbR.projecten[0] });
  const inAdvies = r.some((rr) => [...rr.kandidaten, ...rr.prospects].some((k) => k.partnerId === doel.id));
  check("Registratie: partner ter controle telt niet mee in matching en zoeken", !inAdvies && !semantischZoeken(dbR, doel.omschrijving || doel.naam).some((t) => t.partner.id === doel.id));
}

// ---------- Aanvulling overeenkomst v3.1 — groep A: goudstandaard en datakwaliteit (US-49 t/m US-53) ----------
{
  const dbA = maakSeedDatabase();
  const p = JSON.parse(JSON.stringify(dbA.partners.find((x) => x.id === "p-woudbouw")!)) as (typeof dbA.partners)[number];
  // US-51: centrale mapping
  check("US-51 betrouwbaarheid hoog/midden/laag", betrouwbaarheidNiveau(0.9) === "hoog" && betrouwbaarheidNiveau(0.5) === "midden" && betrouwbaarheidNiveau(0.2) === "laag");
  // US-50: rangorde en label
  check("US-50 rangorde art. 11.2", bronRang("goudstandaard") === 1 && bronRang("eigen_uitgave") === 1 && bronRang("kvk") === 2 && bronRang("document") === 2 && bronRang("web") === 3);
  check("US-50 label indicatief – niet gevalideerd", bronTekst("web").includes("indicatief – niet gevalideerd") && !bronTekst("kvk").includes("indicatief"));
  const basisV = (bron: Bron, waarde: string, id: string): EnrichmentVoorstel => ({ id, partnerId: p.id, veld: BASISVELDEN.omschrijving, huidig: null, voorgesteld: waarde, bron, betrouwbaarheid: BRON_BETROUWBAARHEID[bron], soort: "geclaimd", citaat: "", status: "open", gevondenOp: "2026-09-01" });
  p.omschrijving = "";
  const vs = [basisV("web", "Van internet", "a"), basisV("eigen_uitgave", "Uit Conceptenboulevard", "b")];
  verwerkVoorstellen(p, vs, dbA.factoren);
  check("US-50 hoogste rang wint, lagere is alternatief", !vs[1].alternatief && vs[0].alternatief === true);
  // US-52: handmatige invoer = gevalideerd; verrijking tegen gevalideerd veld = conflict
  p.omschrijving = "Houtbouwer";
  const voor = {};
  registreerHandmatigeBasisvelden(p, voor, "Tester");
  check("US-52 basisveld handmatig = gevalideerd met naam en datum", p.veldHerkomst?.omschrijving?.status === "gevalideerd" && p.veldHerkomst?.omschrijving?.gevalideerdDoor === "Tester" && p.veldHerkomst?.omschrijving?.bron === "opgave");
  const conflict = [{ ...basisV("web", "Iets anders", "c"), huidig: p.omschrijving }];
  verwerkVoorstellen(p, conflict, dbA.factoren);
  check("US-52 voorstel op gevalideerd basisveld wordt conflict", conflict[0].conflictMetGevalideerd === true && conflict[0].aard === "gewijzigd");
  // US-49: goudstandaard gaat voor
  zetBasisveldHerkomst(p, "omschrijving", { bron: "goudstandaard", vastgesteldOp: "2026-09-01", status: "gevalideerd", gevalideerdDoor: "Beheerder" });
  const gsV = [{ ...basisV("web", "AI-waarde", "d"), huidig: p.omschrijving }];
  verwerkVoorstellen(p, gsV, dbA.factoren);
  check("US-49 goudstandaard gaat voor op AI-voorstel", gsV[0].goudstandaardGaatVoor === true && gsV[0].alternatief === true);
  const gs = goudstandaardVoorPartner(p, dbA);
  check("US-49 goudstandaard per partnertype met verplichte velden", gs.some((r) => r.sleutel === "basis:kvk" && r.niveau === "verplicht") && gs.some((r) => r.sleutel.startsWith("factor:")));
  dbA.goudstandaard.aannemer = { rol: "aannemer", velden: [{ sleutel: "factor:mpg", niveau: "verplicht" }], criteria: [], versie: 1, bijgewerktOp: "", door: "Beheerder" };
  check("US-49 vastgestelde goudstandaard vervangt het startpunt", goudstandaardVoorPartner(p, dbA).length === 1 && gezochteVelden(p, dbA).includes("factor:mpg"));
  // US-53: geen betrouwbare bron
  p.website = undefined;
  const zonder = veldenZonderBron(p, [], ["basis:website", "basis:omschrijving"]);
  check("US-53 leeg veld zonder voorstel = geen betrouwbare bron", zonder.join() === "basis:website");
  markeerGeenBron(p, "basis:website", ["https://example.org", "document: brochure"], new Date("2026-09-10"));
  check("US-53 markering met datum en doorzochte bronnen", p.geenBron?.["basis:website"]?.op === "2026-09-10" && p.geenBron["basis:website"].doorzocht.length === 2);
  dbA.partners = [p];
  check("US-53 telt mee in datakwaliteit", basisVeldKwaliteit(dbA).find((b) => b.veld === "Website")?.geenBron === 1);
  const sv = statusVerdeling([p], dbA.factoren);
  check("US-66 statusverdeling over factoren én basisvelden", sv.totaal > 0 && sv.gevalideerd > 0);
  // Migratie v9: herkomst voor bestaande basisvelden, categorie verrijkingsbronnen
  const oud = maakLegeDatabase();
  oud.versie = 8;
  delete (oud as Partial<typeof oud>).goudstandaard;
  oud.partners = [JSON.parse(JSON.stringify(dbA.partners[0]))];
  delete oud.partners[0].veldHerkomst;
  oud.instellingen.verrijkingsbronnen = [{ id: "x", naam: "Conceptenboulevard", url: "https://conceptenboulevard.nl/", actief: true }];
  migreerDatabase(oud, new Map());
  const naMigratie = oud.partners.slice()[0];
  check("Migratie v9: herkomst aangevuld (voorgesteld) en bron eigen uitgave", naMigratie.veldHerkomst?.omschrijving?.status === "voorgesteld" && oud.instellingen.verrijkingsbronnen[0].categorie === "eigen_uitgave" && typeof oud.goudstandaard === "object");
}

// ---------- Groep B: concept, vrijgave en twee rollen (US-54, US-64, US-65) ----------
{
  check("US-65 gebruiker mag bewerken, niet vrijgeven/wegen/verwijderen", heeftRecht("gebruiker", "bewerken") && heeftRecht("gebruiker", "discovery_goedkeuren") && !heeftRecht("gebruiker", "partners_vrijgeven") && !heeftRecht("gebruiker", "beheer") && !heeftRecht("gebruiker", "definitief_verwijderen") && !heeftRecht("gebruiker", "gebruikers_beheren"));
  check("US-65 beheerder heeft alle beheerrechten", ["partners_vrijgeven", "beheer", "definitief_verwijderen", "gebruikers_beheren", "volledige_export"].every((r) => heeftRecht("beheerder", r as Parameters<typeof heeftRecht>[1])));
  check("US-65 oude rollen worden gebruiker", normaliseerRol("inkoper") === "gebruiker" && normaliseerRol("lezer") === "gebruiker" && normaliseerRol("beheerder") === "beheerder");
  process.env.EERSTE_BEHEERDER_EMAIL = "Baas@Blauwhoed.nl";
  const lijst: Gebruiker[] = [];
  const eerste = vindOfRegistreer(lijst, "baas@blauwhoed.nl", "Baas");
  const tweede = vindOfRegistreer(lijst, "collega@blauwhoed.nl", "Collega");
  check("US-64 unieke gebruikers-ID's", vindOfRegistreer(lijst, "jan.de.vries@blauwhoed.nl", "a").gebruiker.id !== vindOfRegistreer(lijst, "jan-de-vries@blauwhoed.nl", "b").gebruiker.id);
  lijst.splice(2);
  check("US-64 eerste beheerder uit env, overige medewerkers gebruiker, onbeperkt", eerste.gebruiker.rol === "beheerder" && tweede.gebruiker.rol === "gebruiker" && lijst.length === 2 && !vindOfRegistreer(lijst, "COLLEGA@blauwhoed.nl", "x").nieuw);
  const dbB = maakSeedDatabase();
  const kand = { id: "k1", naam: "Nieuwbouw Test B.V.", rollen: ["aannemer" as const], bron: "Webzoek", bronUrl: "https://example.org", opgehaaldOp: "2026-09-01T10:00:00Z", ruweData: { profiel: "Bouwer" }, status: "geaccepteerd" as const, vestigingsplaats: "Utrecht", samenvatting: { watDoetHetBedrijf: "x", referentieprojecten: [], waaromPastHet: "Past bij houtbouw", watIsOnzeker: ["KVK onbekend"], gegenereerdOp: "", provider: "regels" } };
  const concept = kandidaatNaarConcept(kand, "Gebruiker");
  check("US-54 geaccepteerde discovery-kandidaat wordt concept met onderbouwing", concept.status === "concept" && concept.registratie?.herkomstSoort === "discovery" && concept.registratie.onderbouwing?.waaromPast === "Past bij houtbouw" && concept.veldHerkomst?.vestigingsplaats?.status === "voorgesteld");
  dbB.partners.push({ ...concept, rollen: ["aannemer"], omschrijving: "houtbouw CLT woningen" });
  const rC = matchProject({ db: dbB, project: dbB.projecten[0] });
  check("US-54 concept uitgesloten van matchen, zoeken, verbanden, chat en export", !rC.some((rr) => [...rr.kandidaten, ...rr.prospects].some((k) => k.partnerId === concept.id)) && !semantischZoeken(dbB, "houtbouw CLT").some((t) => t.partner.id === concept.id) && !leidVerbandenAf(dbB).some((v) => v.a.id === concept.id || v.b.id === concept.id) && !chatContext(dbB, "houtbouw").partners.some((p) => p.id === concept.id) && !partnersCsv(dbB).includes("Nieuwbouw Test"));
  // Migratie v10
  const oud = maakLegeDatabase();
  oud.versie = 9;
  const tc = JSON.parse(JSON.stringify(concept)) as typeof concept;
  (tc as { status: string }).status = "ter_controle";
  tc.id = "p-tc";
  const prospect = kandidaatNaarPartner({ ...kand, id: "k2", naam: "Prospect B.V." });
  oud.partners = [tc, prospect];
  oud.kandidaten = [{ ...kand, id: "k2", naam: "Prospect B.V.", gepromoveerdTot: prospect.id, beoordeeldDoor: "Inkoper" }];
  oud.gebruikers = [{ id: "u1", naam: "X", rol: "inkoper" as unknown as "gebruiker" }];
  oud.audit.push({ id: "a-oud", op: "", door: "Inkoper", gebruikersrol: "inkoper" as unknown as "gebruiker", entiteit: "partner", entiteitId: "x", actie: "y" });
  const u10 = migreerDatabase(oud, new Map())!;
  const [na1, na2] = oud.partners.slice();
  check("Migratie v10: ter_controle en geaccepteerde discovery-prospect worden concept", na1.status === "concept" && na2.status === "concept" && na2.registratie?.herkomstSoort === "discovery" && u10.concepten === 2);
  check("Migratie v10: rollen naar gebruiker (ook audit)", oud.gebruikers[0].rol === "gebruiker" && oud.audit.find((a) => a.id === "a-oud")?.gebruikersrol === "gebruiker");
}

// ---------- Groep D: bronnen — KVK Basisprofiel, documenten, registers (US-60 t/m US-62) ----------
// ---------- US-55: AI draagt ontbrekende partners aan vanuit een zoekprofiel ----------
{
  const profiel = { naam: "Houtbouw Noord", rollen: ["aannemer" as const, "architect" as const], trefwoorden: "houtbouw CLT biobased woningen", regio: "Groningen" };
  const vragen = regelZoekvragen(profiel);
  check("US-55 gerichte zoekvragen per rol met trefwoorden en regio", vragen.length === 4 && vragen.every((v) => v.vraag.includes("Groningen") && v.vraag.includes("houtbouw")) && vragen.some((v) => v.rol === "architect"));
  const html = '<a href="/aanbieders/nimbel/id=12">Nimbel Woningbouw</a><a href="/aanbieders/barli/id=47">Barli</a><a href="/aanbieders/">Alle</a><a href="/nieuws/x">Nieuws</a><a href="https://elders.nl/x">Extern</a>';
  const aanb = aanbiedersUitOverzicht(html, "https://conceptenboulevard.nl/aanbieders/");
  check("US-55 aanbieders uit eigen uitgave (Conceptenboulevard-overzicht)", aanb.length === 2 && aanb[0].url === "https://conceptenboulevard.nl/aanbieders/nimbel/id=12", aanb);
  const dbA2 = maakSeedDatabase();
  const k = (naam: string, kvk?: string) => ({ naam, kvk, rollen: ["aannemer" as const], bron: "Open web", bronUrl: `https://${naam.replace(/\s/g, "")}.nl`, ruweData: { profiel: "Wij bouwen houtbouw woningen in CLT" }, zoekvraag: "houtbouw", vestigingsplaats: "Groningen" });
  const od = ontdubbel([k("Woudbouw Groep"), k("Nieuwe Houtbouwer B.V."), k("Nieuwe Houtbouwer BV"), k("Anders", "34123456")], dbA2.partners);
  check("US-55 ontdubbelen tegen het bestand (naam, KVK) en binnen de set", od.nieuw.length === 1 && od.nieuw[0].naam === "Nieuwe Houtbouwer B.V." && od.dubbel.length === 2, od);
  const ob = regelOnderbouwing(od.nieuw[0], profiel);
  check("US-55 onderbouwing: waarom past het, bron, wat is onzeker", ob.waaromPastHet.includes("Houtbouw Noord") && ob.watIsOnzeker.some((o) => o.includes("nog niet vastgesteld")));
  const c = kandidaatNaarConcept({ ...od.nieuw[0], id: "a1", status: "geaccepteerd", opgehaaldOp: "2026-09-20T10:00:00Z", samenvatting: ob }, "Beheerder", new Date(), "ai-aandraag");
  check("US-55 aangedragen partij wordt concept met bron-URL en ophaaldatum", c.status === "concept" && c.registratie?.herkomstSoort === "ai-aandraag" && c.registratie.onderbouwing?.bronUrl === od.nieuw[0].bronUrl && c.registratie.onderbouwing?.opgehaaldOp === "2026-09-20T10:00:00Z");
}

// ---------- US-63: projectnummer en tevredenheid per project ----------
{
  const dbP = maakSeedDatabase();
  const proj = dbP.projecten.find((p) => p.id === "proj-groene-loper")!;
  proj.projectnummer = "2024-017";
  const imp = importeerEngagements("kvk;projectnummer;rol;van;contractwaarde\n34123456;2024-017;aannemer;2024-02-01;1000\n34123456;9999-999;aannemer;2024-01-01;1", dbP);
  check("US-63 historie-CSV koppelt op projectnummer", imp.engagements.length === 1 && imp.engagements[0].projectId === proj.id && imp.wachtrij[0].reden.includes("Projectnummer '9999-999'"), imp.wachtrij);
  const ev = { kwaliteit: 5, planning: 4, budget: 4, samenwerking: 5, duurzaamheid: 2 };
  check("US-63 totaalscore standaard afgeleid uit 5 deelscores", afgeleideTotaalscore(ev) === 4);
  check("US-63 bijstellen vraagt toelichting", controleerTotaal({ ...ev, totaalscore: 3 }) !== null && controleerTotaal({ ...ev, totaalscore: 3, totaalToelichting: "Oplevering kwam te laat voor de bewoners" }) === null && controleerTotaal({ ...ev, totaalscore: 7, totaalToelichting: "x" }) !== null);
  const evWoud = dbP.evaluaties.filter((e) => e.partnerId === "p-woudbouw");
  const voor = leidFactorenAf(dbP.partners.find((p) => p.id === "p-woudbouw")!, dbP).statistieken.evaluatiescore;
  evWoud.forEach((e) => {
    e.totaalscore = 1;
    e.totaalToelichting = "test";
  });
  const na = leidFactorenAf(dbP.partners.find((p) => p.id === "p-woudbouw")!, dbP).statistieken.evaluatiescore;
  check("US-63 totale score weegt mee in de matchscore (evaluatiescore)", voor !== null && na === 1 && voor > 1, { voor, na });
  check("US-63 historie doorzoekbaar op projectnummer en toelichting", historieTreft("2024-017 aannemer", ["2024-017", "Groene Loper", "aannemer"]) && !historieTreft("2025", ["2024-017"]));
  const eem = dbP.projecten.find((p) => p.id === "proj-eemkwartier")!;
  eem.projectnummer = "2021-003";
  const ctx = chatContext(dbP, "Welke partners werkten op project 2021-003?");
  check("US-63 chat vindt partners op projectnummer", ctx.partners.some((p) => dbP.engagements.some((e) => e.partnerId === p.id && e.projectId === eem.id)) && ctx.records.some((r) => r.projecten.some((x) => x.projectnummer === "2021-003")));
}

// ---------- US-69: definitief verwijderen (AVG) ----------
{
  const dbV = maakSeedDatabase();
  const p = dbV.partners.find((x) => x.id === "p-woudbouw")!;
  const proj = dbV.projecten.find((x) => x.id === "proj-groene-loper")!;
  dbV.matchRuns.push({ id: "run-v", projectId: proj.id, naam: "t", gestartOp: "", door: "", input: { eisen: proj.eisen }, resultaat: matchProject({ db: dbV, project: proj }) });
  dbV.teams.push({ id: "t1", projectId: proj.id, matchRunId: "run-v", variant: "voorkeur", leden: [{ rol: "aannemer", partnerId: p.id, partnerNaam: p.naam, score: 80 }], teamScore: 80, onderdelen: { gemiddeldeKwaliteit: 0, samenwerkingshistorie: 0, nabijheid: 0, beschikbaarheid: 0 }, onderbouwing: [], gemaaktOp: "" });
  dbV.kandidaten.push({ id: "k-v", naam: p.naam, rollen: ["aannemer"], bron: "x", bronUrl: "https://x", opgehaaldOp: "", ruweData: {}, status: "geaccepteerd", gepromoveerdTot: p.id });
  p.documenten = [{ id: "d", naam: "brochure", soort: "brochure", bestandUrl: "https://blob.example/x.pdf", toegevoegdDoor: "t", op: "" }];
  dbV.audit.push({ id: "a1", op: "", door: "t", gebruikersrol: "gebruiker", entiteit: "partner", entiteitId: "ander", actie: "x", details: `vergeleken met ${p.naam.toUpperCase()} (kvk ${p.kvk})` });
  dbV.audit.push({ id: "a2", op: "", door: "t", gebruikersrol: "gebruiker", entiteit: "partner", entiteitId: p.id, actie: "status gearchiveerd", details: "reden" });
  dbV.matchRuns[0].onderbouwing = { provider: "x", op: "", door: "", perRol: [{ rol: "aannemer", samenvatting: "", perKandidaat: [{ partnerId: p.id, onderbouwing: "x", aandachtspunten: [] }] }] };
  check("US-69 alleen gearchiveerd, met reden en exacte naam", controleerVerwijderen(p, "verzoek", p.naam) !== null && (p.status = "gearchiveerd") && controleerVerwijderen(p, "", p.naam) !== null && controleerVerwijderen(p, "verzoek", "Woudbouw") !== null && controleerVerwijderen(p, "verzoek Blauwhoed", p.naam) === null);
  const engVoor = dbV.engagements.filter((e) => e.partnerId === p.id).length;
  const u = verwijderPartnerDefinitief(dbV, p.id);
  const json = JSON.stringify(dbV);
  check("US-69 partner, historie, beoordelingen, voorstellen en kandidaat weg", !dbV.partners.some((x) => x.id === p.id) && u.engagements === engVoor && engVoor > 0 && u.evaluaties > 0 && u.kandidaten === 1 && !dbV.evaluaties.some((e) => e.partnerId === p.id), u);
  check("US-69 matchruns opgeschoond, team geanonimiseerd, blob opgeruimd", u.matchruns === 1 && dbV.teams[0].leden[0].partnerNaam === VERWIJDERD && u.blobs[0] === "https://blob.example/x.pdf");
  check("US-69 geen naam, KVK of id meer in de gegevens (ook niet in audit of onderbouwing)", !json.toLowerCase().includes("woudbouw groep") && !json.includes("p-woudbouw") && !json.includes("34123456") && dbV.audit.find((a) => a.id === "a2")?.entiteitId === pseudoniem("p-woudbouw"));
}

// ---------- US-70: onderbouwing en verbandanalyse (regels), disclaimers ----------
{
  const dbO = maakSeedDatabase();
  const res = matchProject({ db: dbO, project: dbO.projecten.find((p) => p.id === "proj-groene-loper")! });
  const r = regelOnderbouwingRol(res.find((x) => x.rol === "aannemer")!);
  check("US-70 onderbouwing per kandidaat in gewone taal (score, verificatie) met aandachtspunten", r.perKandidaat.length > 0 && /scoort \d+ van 100/.test(r.perKandidaat[0].onderbouwing) && /geverifieerd/.test(r.perKandidaat[0].onderbouwing) && Array.isArray(r.perKandidaat[0].aandachtspunten) && typeof r.samenvatting === "string");
  check("Elke kandidaat en prospect krijgt bij de matching een onderbouwing", res.every((x) => [...x.kandidaten, ...x.prospects].every((k) => (k.onderbouwing?.tekst.length ?? 0) > 40)));
  const va = regelVerbandAnalyse(leidVerbandenAf(dbO));
  check("US-70 verbandanalyse met bronnen en kanttekening (art. 11.4)", va.patronen.length > 0 && va.patronen.every((p) => p.bronnen.length > 0) && va.kanttekeningen.some((k) => k.includes("geen bevestiging")));
  check("US-70 disclaimer matchscore (art. 11.3)", MATCH_DISCLAIMER.includes("geen oordeel over geschiktheid, betrouwbaarheid of financiële gezondheid"));
}

// ---------- US-67/US-68: exports ----------
const groepExport = (async () => {
  const dbE = maakSeedDatabase();
  const proj = dbE.projecten.find((p) => p.id === "proj-groene-loper")!;
  const run = { id: "run-x", projectId: proj.id, naam: "Test", gestartOp: "2026-09-01T10:00:00Z", door: "t", input: { eisen: proj.eisen }, resultaat: matchProject({ db: dbE, project: proj }) };
  const mr = matchRijen(run, dbE);
  check("US-67 matchresultaten met criteria, bron en betrouwbaarheid", mr.kandidaten.length > 0 && mr.criteria.some((c) => ["hoog", "midden", "laag"].includes(String(c.Betrouwbaarheid))) && mr.uitsluitingen.length > 0 && String(mr.toelichting[0].Toelichting).includes("eerste selectie"));
  const buf = await naarXlsx([{ naam: "Kandidaten", rijen: mr.kandidaten }, { naam: "Waarden", rijen: waardenRijen(dbE) }]);
  const bladen = await readSheetNames(buf);
  const terug = await leesExcel(buf, { sheet: "Waarden" });
  check("US-67 echt Excel-bestand met status en betrouwbaarheid per veld", bladen.join() === "Kandidaten,Waarden" && terug[0].includes("Status") && terug[0].includes("Betrouwbaarheid") && terug.length > 10);
  dbE.partners.push({ ...kandidaatNaarConcept({ id: "k9", naam: "Concept BV", rollen: ["aannemer"], bron: "x", bronUrl: "https://x.nl", opgehaaldOp: "2026-09-01T00:00:00Z", ruweData: {}, status: "geaccepteerd" }, "B"), id: "p-concept-x" });
  const tab = volledigeExportTabellen(dbE);
  check("US-68 volledige export: alle tabellen incl. concepten, verbanden en verbruik", ["partners", "waarden-met-herkomst", "concepten", "projecten", "evaluaties", "verbanden", "ai-verbruik", "factoren"].every((k) => k in tab) && tab.concepten.length === 1 && tab.verbanden.length > 0 && tab["waarden-met-herkomst"].every((r) => "Status" in r && "Betrouwbaarheid" in r && "Bron" in r));
  const json = volledigeExportJson(dbE, "Beheerder");
  check("US-68 JSON bevat volledige staat en herkomst per partner", json.database.partners.length === dbE.partners.length && json.afgeleid.herkomstPerPartner.length === dbE.partners.length && json.afgeleid.verbanden.length > 0);
  const zipE = maakZip(Object.entries(tab).map(([n, r]) => ({ naam: `${n}.csv`, inhoud: naarCsv(r.length ? r : [{ Melding: "geen" }]) })));
  check("US-68 CSV-bundel als zip", (leesZipBestand(zipE, "concepten.csv")?.toString() ?? "").includes("Concept BV"));
})();

// Discovery: zoekketen DuckDuckGo → Bing met diagnose
{
  check("Discovery: Bing-doel-URL gedecodeerd", bingDoelUrl("https://www.bing.com/ck/a?!&amp;&amp;p=x&amp;u=a1aHR0cHM6Ly90aW1tZXJ1Z2NoZWxlbi5ubC8&amp;ntb=1") === "https://timmerugchelen.nl/");
  check("Discovery: diagnose noemt geblokkeerde zoekmachines", diagnoseTekst([{ zoekmachine: "DuckDuckGo", status: 202, resultaten: 0, geblokkeerd: true }, { zoekmachine: "Bing", status: 200, resultaten: 5, geblokkeerd: false }]) === "DuckDuckGo: geweigerd of geblokkeerd (1×), Bing: 5 resultaten");
}

const groepD = (async () => {
  const prof = leesBasisprofiel({ kvkNummer: "12345678", statutaireNaam: "Bouwbedrijf Voorbeeld B.V.", materieleRegistratie: { datumAanvang: "19870401" }, sbiActiviteiten: [{ sbiCode: "4120", sbiOmschrijving: "Algemene burgerlijke en utiliteitsbouw", indHoofdactiviteit: "Ja" }, { sbiCode: "7111", sbiOmschrijving: "Architecten", indHoofdactiviteit: "Nee" }], _embedded: { eigenaar: { rechtsvorm: "BeslotenVennootschap" }, hoofdvestiging: { adressen: [{ type: "bezoekadres", straatnaam: "Kerkstraat", huisnummer: 1, postcode: "3811AB", plaats: "Amersfoort" }] } } });
  check("US-60 KVK Basisprofiel: statutaire naam, rechtsvorm, SBI, adres, oprichtingsdatum", prof.statutaireNaam === "Bouwbedrijf Voorbeeld B.V." && prof.rechtsvorm === "B.V." && prof.sbiActiviteiten.length === 2 && prof.sbiActiviteiten[0].hoofd === true && prof.adres === "Kerkstraat 1 3811AB" && prof.plaats === "Amersfoort" && prof.oprichtingsdatum === "1987-04-01", prof);
  check("US-60 KVK-bron is rang 2 (gevalideerde registratie)", bronRang("kvk") === 2 && BRON_LABEL.kvk.startsWith("KVK"));
  check("US-60 SBI-tekst terug te lezen", leesSbi(sbiTekst(prof.sbiActiviteiten)).length === 2 && leesSbi(sbiTekst(prof.sbiActiviteiten))[1].code === "7111");
  // US-61: zip/docx en echte PDF-extractie
  const zip = maakZip([{ naam: "a.txt", inhoud: "hallo" }, { naam: "word/document.xml", inhoud: "<w:document><w:body><w:p><w:r><w:t>Wij bouwen in CLT</w:t></w:r></w:p><w:p><w:r><w:t>MPG-berekening van 0,48</w:t></w:r></w:p></w:body></w:document>" }]);
  check("US-61 zip lezen en schrijven", leesZipBestand(zip, "a.txt")?.toString() === "hallo");
  check("US-61 Word (.docx) tekst", docxTekst(zip) === "Wij bouwen in CLT\nMPG-berekening van 0,48");
  const pdf = new jsPDF();
  pdf.text("Houtskeletbouw met MPG-berekening (NMD) van 0,52 gerealiseerd.", 10, 20);
  const pdfTekstUit = await leesTekstUitBestand(Buffer.from(pdf.output("arraybuffer")), "application/pdf", "brochure.pdf");
  check("US-61 PDF-tekst gelezen", Boolean(pdfTekstUit.tekst?.includes("0,52")), pdfTekstUit);
  check("US-61 oud .doc geeft melding", Boolean((await leesTekstUitBestand(Buffer.from("x"), "application/msword", "x.doc")).melding));
  const dbD = maakSeedDatabase();
  const pw = dbD.partners.find((x) => x.id === "p-steenhuis")!;
  const docV = extraheerVoorstellen(pw, pdfTekstUit.tekst ?? "", "document: brochure.pdf", new Date(), "document");
  check("US-61 documenttekst = bron aangeleverd document (rang 2)", docV.length > 0 && docV.every((v) => v.bron === "document" && v.betrouwbaarheid > 0.5));
  // US-62: registers
  const reg = { id: "r1", naam: "VCA-register", url: "https://example.org/zoek?q={naam}", certificaat: "VCA" as const, actief: true };
  check("US-62 zoekpatroon met {naam}", registerUrl(reg, { naam: "Bouw & Co", kvk: "" }) === "https://example.org/zoek?q=Bouw%20%26%20Co");
  const pr = JSON.parse(JSON.stringify(pw)) as typeof pw;
  pr.certificaten = [{ id: "c1", type: "VCA", nummer: "1", geldigTot: "2027-01-01" }, { id: "c2", type: "FSC", nummer: "2", geldigTot: "2027-01-01" }];
  check("US-62 echo van de zoekterm telt niet als vondst", !partnerInRegister(`Resultaten voor ${pr.naam}: geen certificaathouders`, pr, true) && partnerInRegister(`Resultaten voor ${pr.naam}: ${pr.naam} te Utrecht, geldig`, pr, true));
  const uitk = await controleerRegisters(pr, [reg, { ...reg, id: "r2", naam: "FSC", url: "https://example.org/fsc?q={naam}", certificaat: "FSC" }, { ...reg, id: "r3", naam: "CO2", certificaat: "CO2-prestatieladder" }], async (url) => (url.includes("/fsc") ? `Zoekresultaten voor ${pr.naam}: geen resultaten` : `Zoekresultaten voor ${pr.naam}: ${pr.naam} te Utrecht`));
  const bevestigen = verwerkRegisterUitkomsten(pr, uitk);
  const vca = pr.certificaten.find((c) => c.type === "VCA")!;
  const fsc = pr.certificaten.find((c) => c.type === "FSC")!;
  check("US-62 vondst wordt een voorstel, nooit automatisch geverifieerd", vca.verificatie !== "geverifieerd" && vca.registerControle?.gevonden === true && bevestigen.map((u) => u.certificaat).sort().join() === "CO2-prestatieladder,VCA");
  check("US-62 niet gevonden = blijft geclaimd", fsc.verificatie === "geclaimd" && fsc.registerControle?.gevonden === false);
  check("US-62 certificaat zonder geldigheid", certificaatStatus("").label === "geldigheid onbekend");
})();

// Verificatielabels: labels, weging in de matching, automatisch invullen en migratie
{
  const dbV = maakSeedDatabase();
  const fac = (id: string) => dbV.factoren.find((f) => f.id === id);
  const basis = { factorId: "x", waarde: 3, bron: "web" as const, betrouwbaarheid: 0.6, peildatum: new Date().toISOString().slice(0, 10) };
  check("Verificatie: labels beheerder/gebruiker/niet/berekend", verificatieVan({ ...basis, status: "gevalideerd", gevalideerdDoorRol: "beheerder" }, undefined) === "beheerder" && verificatieVan({ ...basis, status: "gevalideerd" }, undefined) === "gebruiker" && verificatieVan({ ...basis, status: "voorgesteld" }, undefined) === "niet" && verificatieVan({ ...basis, afgeleid: true }, undefined) === "berekend");
  check("Verificatie: weging beheerder ≥ gebruiker > niet geverifieerd > verouderd", VERIFICATIE_WEGING.beheerder >= VERIFICATIE_WEGING.gebruiker && VERIFICATIE_WEGING.gebruiker > VERIFICATIE_WEGING.niet && VERIFICATIE_WEGING.niet > VERIFICATIE_WEGING.verouderd);
  // Dezelfde waarde scoort hoger als ze geverifieerd is dan als ze dat niet is.
  const project = dbV.projecten.find((p) => p.id === "proj-groene-loper")!;
  const rol = matchProject({ db: dbV, project }).find((x) => x.rol === "aannemer")!;
  const k = rol.kandidaten.find((x) => x.criteria.some((c) => (c.basisFit ?? 0) >= 0.9 && c.verificatie !== "berekend"));
  const c = k?.criteria.find((x) => (x.basisFit ?? 0) >= 0.9 && x.verificatie !== "berekend");
  const partner = dbV.partners.find((p) => p.id === k?.partnerId);
  const pf = partner?.factoren.find((f) => f.factorId === c?.factorId && (f.optieId ?? "") === (c?.optieId ?? ""));
  if (pf && k) {
    pf.status = "gevalideerd";
    pf.gevalideerdDoorRol = "beheerder";
    pf.peildatum = new Date().toISOString().slice(0, 10);
    const geverifieerd = matchProject({ db: dbV, project }).find((x) => x.rol === "aannemer")!.kandidaten.find((x) => x.partnerId === k.partnerId)!;
    pf.status = "voorgesteld";
    const niet = matchProject({ db: dbV, project }).find((x) => x.rol === "aannemer")!.kandidaten.find((x) => x.partnerId === k.partnerId)!;
    check("Verificatie telt mee in de matchscore (geverifieerd > niet geverifieerd)", geverifieerd.gewogenScore > niet.gewogenScore && (geverifieerd.verificatiegraad ?? 0) > (niet.verificatiegraad ?? 0), { geverifieerd: geverifieerd.gewogenScore, niet: niet.gewogenScore });
    check("Criterium draagt het verificatielabel", niet.criteria.find((x) => x.factorId === c!.factorId && x.optieId === c!.optieId)?.verificatie === "niet");
  } else check("Verificatie telt mee in de matchscore (testdata gevonden)", false);
  // Automatisch invullen
  const p = dbV.partners[0];
  const niveau = dbV.factoren.find((f) => f.actief && f.schaal.soort === "niveau" && !f.opties?.length && !f.afgeleid)!;
  p.factoren = p.factoren.filter((f) => f.factorId !== niveau.id);
  const voorstel = (w: unknown, extra: Partial<EnrichmentVoorstel> = {}): EnrichmentVoorstel => ({ id: `ev-t-${Math.random()}`, partnerId: p.id, factorId: niveau.id, veld: niveau.naam, huidig: null, voorgesteld: w as EnrichmentVoorstel["voorgesteld"], bron: "web", bronUrl: "https://voorbeeld.nl", betrouwbaarheid: 0.6, soort: "aantoonbaar", citaat: "test", status: "open", gevondenOp: new Date().toISOString(), aard: "nieuw", ...extra });
  check("Automatisch invullen: leeg veld met geldige waarde", automatischToepasbaar(p, voorstel(4), dbV.factoren));
  check("Automatisch invullen: ongeldige waarde voor de schaal niet", !automatischToepasbaar(p, voorstel(9), dbV.factoren) && !automatischToepasbaar(p, voorstel("veel"), dbV.factoren));
  check("Automatisch invullen: geen alternatief of conflict", !automatischToepasbaar(p, voorstel(4, { alternatief: true }), dbV.factoren) && !automatischToepasbaar(p, voorstel(4, { conflictMetGevalideerd: true }), dbV.factoren));
  const v1 = voorstel(4);
  pasAutomatischToe(p, v1, dbV.factoren);
  const ingevuld = p.factoren.find((f) => f.factorId === niveau.id)!;
  check("Automatisch ingevuld = 'niet geverifieerd' en voorstel afgehandeld", ingevuld.status === "voorgesteld" && ingevuld.automatisch === true && verificatieVan(ingevuld, niveau) === "niet" && v1.status === "geaccepteerd" && v1.automatischToegepast === true);
  check("Automatisch invullen overschrijft een niet-geverifieerde waarde uit een gelijke bron", automatischToepasbaar(p, voorstel(5, { aard: "gewijzigd", huidig: 4 }), dbV.factoren));
  ingevuld.status = "gevalideerd";
  check("Automatisch invullen overschrijft nooit een geverifieerde waarde", !automatischToepasbaar(p, voorstel(5, { aard: "gewijzigd", huidig: 4 }), dbV.factoren));
  ingevuld.status = "voorgesteld";
  ingevuld.bron = "goudstandaard";
  check("Automatisch invullen vervangt geen betere bron (goudstandaard)", !automatischToepasbaar(p, voorstel(5, { aard: "gewijzigd", huidig: 4 }), dbV.factoren));
  // Feitelijk vs ingeschat
  ingevuld.bron = "web";
  ingevuld.vaststelling = "ingeschat";
  check("Verificatie: ingeschatte, niet-geverifieerde waarde krijgt label 'ingeschat' en telt minder dan feitelijk", verificatieVan(ingevuld, niveau) === "ingeschat" && VERIFICATIE_WEGING.niet > VERIFICATIE_WEGING.ingeschat && VERIFICATIE_WEGING.ingeschat > 0);
  check("Automatisch invullen: een feit vervangt een inschatting, ook uit een zwakkere bron", automatischToepasbaar(p, voorstel(5, { aard: "gewijzigd", huidig: 4, vaststelling: "feitelijk", betrouwbaarheid: 0.2 }), dbV.factoren));
  ingevuld.vaststelling = "feitelijk";
  check("Automatisch invullen: een inschatting vervangt nooit een feit", !automatischToepasbaar(p, voorstel(5, { aard: "gewijzigd", huidig: 4, vaststelling: "ingeschat", betrouwbaarheid: 0.9 }), dbV.factoren));
  const vIng = voorstel(3, { vaststelling: "ingeschat", onderbouwing: "Drie opgeleverde projecten genoemd." });
  p.factoren = p.factoren.filter((f) => f.factorId !== niveau.id);
  pasAutomatischToe(p, vIng, dbV.factoren);
  const ingIngevuld = p.factoren.find((f) => f.factorId === niveau.id)!;
  check("Automatisch ingevuld neemt vaststelling en onderbouwing over", ingIngevuld.vaststelling === "ingeschat" && ingIngevuld.onderbouwing === "Drie opgeleverde projecten genoemd." && verificatieVan(ingIngevuld, niveau) === "ingeschat");
  const regelV = extraheerVoorstellen(p, "Wij bouwen in houtskeletbouw en CLT. MPG 0,62 volgens NMD-berekening.", "https://voorbeeld.nl");
  check("Regelextractie: vast niveau = ingeschat, gelezen getal = feitelijk", regelV.find((v) => v.factorId === "bouwsysteem")?.vaststelling === "ingeschat" && regelV.find((v) => v.factorId === "mpg")?.vaststelling === "feitelijk", regelV.map((v) => [v.factorId, v.vaststelling]));
  // Migratie v13: rol bij bestaande validaties
  const dbM = maakSeedDatabase();
  dbM.versie = 12;
  const beheerder = dbM.gebruikers.find((g) => g.rol === "beheerder");
  const doelPf = dbM.partners.flatMap((x) => x.factoren).find((f) => !f.afgeleid)!;
  Object.assign(doelPf, { status: "gevalideerd", gevalideerdDoor: beheerder?.naam ?? "onbekend", gevalideerdDoorRol: undefined });
  migreerDatabase(dbM, new Map());
  check("Migratie v13: bestaande validatie krijgt de rol van de medewerker", doelPf.gevalideerdDoorRol === (beheerder ? "beheerder" : "gebruiker") && dbM.instellingen.automatischInvullen === true);
  void fac;
}

// OTAP: omgeving herkennen
check("OTAP productie-deployment is productie", bepaalOmgeving({ VERCEL_ENV: "production" }) === "productie");
check("OTAP branch acceptatie is acceptatie", bepaalOmgeving({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "acceptatie" }) === "acceptatie");
check("OTAP overige previews zijn test", bepaalOmgeving({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "test" }) === "test" && bepaalOmgeving({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "feature-x" }) === "test");
check("OTAP OMGEVING gaat voor", bepaalOmgeving({ OMGEVING: "Acceptatie", VERCEL_ENV: "production" }) === "acceptatie");
check("OTAP lokaal is ontwikkeling", bepaalOmgeving({ NODE_ENV: "development" }) === "ontwikkeling");
check("OTAP database-aanduiding toont het Neon-endpoint", databaseAanduiding("postgresql://u:p@ep-cool-bird-123-pooler.eu-central-1.aws.neon.tech/db") === "ep-cool-bird-123" && databaseAanduiding(undefined) === "in-memory");

// ---------- User stories demo oktober 2026 ----------
{
  // US-01: partnertypes en goudstandaard per type
  const dbU = maakSeedDatabase();
  check("US-01 houtbouwer en constructeur zijn partnertypes", ROLLEN.includes("houtbouwer") && ROLLEN.includes("constructeur"));
  const gsHout = standaardGoudstandaard("houtbouwer", dbU.factoren);
  const verplichtHout = gsHout.velden.filter((v) => v.niveau === "verplicht").map((v) => v.sleutel);
  check("US-01 houtbouwer: MPG, Paris Proof, productietijd, levertijd, kosten per m² en productinformatie verplicht", ["mpg", "paris_proof", "productietijd", "levertijd", "kosten_m2", "productinformatie"].every((id) => verplichtHout.includes(`factor:${id}`)), verplichtHout);
  const gsArch = standaardGoudstandaard("architect", dbU.factoren);
  check("US-01 architect heeft een kleinere vaste set", gsArch.velden.filter((v) => v.niveau === "verplicht").length < verplichtHout.length);
  const pf = productFactoren({ "Paris Proof - Materiaalgebonden CO2-uitstoot (A1 tm A5) - Totaal": 159.28, "Prijs per m2 BVO - vanaf prijs": "€ 1.087 - € 1.202", "Productietijd fabriek (weken)": "> 39", Conceptnaam: "Woonkas", "Mogelijke (woning)types": "Grondgebonden, appartementen" });
  check("US-01 productkenmerken uit importkolommen", pf.some((x) => x.factorId === "paris_proof" && x.waarde === 159) && pf.some((x) => x.factorId === "kosten_m2" && x.waarde === 1087) && pf.some((x) => x.factorId === "productietijd" && x.waarde === 39) && pf.some((x) => x.factorId === "productinformatie"), pf.map((x) => `${x.factorId}=${x.waarde}`));
  check("US-01 een '-' in het overzicht is geen waarde", productFactoren({ "Paris Proof - Materiaalgebonden CO2-uitstoot (A1 tm A5) - Totaal": "-", Conceptnaam: "-", "BVO m2 range per woning": "-", "Maximaal aantal lagen": "-" }).length === 0);
  const hb = rijNaarPartner((houtbouwers as { partners: Array<{ values: Record<string, string | number | boolean> }> }).partners[0].values);
  check("US-01 rij uit het houtbouwersoverzicht wordt type houtbouwer", Boolean(hb?.rollen.includes("houtbouwer")), hb?.rollen);
  check("US-01 standaardgewichten voor houtbouwer tellen op tot 100", valideerGewichten(NIEUWE_TYPES.houtbouwer!, dbU.factoren).geldig && valideerGewichten(NIEUWE_TYPES.constructeur!, dbU.factoren).geldig);

  // US-02: vullingsgraad verplichte velden per type en per veld
  const vulling = vullingPerRol(dbU, dbU.partners);
  const aann = vulling.find((v) => v.rol === "aannemer");
  check("US-02 vullingsgraad per type en per veld", Boolean(aann) && aann!.verplichtPct !== null && aann!.verplichtPct >= 0 && aann!.verplichtPct <= 100 && aann!.velden.length > 0 && aann!.velden.every((v) => v.totaal === aann!.partners), aann && { pct: aann.verplichtPct, velden: aann.velden.length });

  // US-03: signalen voor ontbrekend, verouderd en onbetrouwbaar
  const p0 = structuredClone(dbU.partners[0]);
  p0.factoren = [
    { factorId: "mpg", waarde: 0.7, bron: "web", betrouwbaarheid: 0.35, peildatum: new Date().toISOString().slice(0, 10), status: "voorgesteld" },
    { factorId: "co2_ladder", waarde: 3, bron: "opgave", betrouwbaarheid: 0.6, peildatum: "2019-01-01", status: "gevalideerd", gevalideerdDoorRol: "gebruiker" }
  ];
  const sig = dataSignalen(dbU, [p0]);
  check("US-03 onbetrouwbare waarde gesignaleerd", sig.some((s) => s.soort === "onbetrouwbaar" && s.sleutel === "factor:mpg"), sig.map((s) => `${s.soort}:${s.sleutel}`));
  check("US-03 verouderde waarde gesignaleerd (vervaltermijn)", sig.some((s) => s.soort === "verouderd" && s.sleutel === "factor:co2_ladder"));
  check("US-03 ontbrekend verplicht veld gesignaleerd", sig.some((s) => s.soort === "ontbreekt"));
  check("US-03 filter op soort, type en veld", filterSignalen(sig, { soort: "onbetrouwbaar", rol: p0.rollen[0], veld: "factor:mpg" }).length === 1 && filterSignalen(sig, { rol: "houtbouwer" }).length === 0);
  const dbT = { ...dbU, instellingen: { ...dbU.instellingen, basisveldVerval: { website: 1 } } };
  const p1 = structuredClone(dbU.partners[0]);
  p1.website = "https://voorbeeld.nl";
  p1.veldHerkomst = { website: { bron: "web", vastgesteldOp: "2020-01-01", betrouwbaarheid: 0.4, status: "voorgesteld" } };
  check("US-03 verouderingstermijn per basisveld", dataSignalen(dbT, [p1]).some((s) => s.soort === "verouderd" && s.sleutel === "basis:website"));

  // US-04: afgewezen waarde telt nergens mee en komt niet automatisch terug
  const p2 = structuredClone(dbU.partners[0]);
  p2.factoren = [{ factorId: "projecttype", optieId: "zorgwonen", waarde: 4, bron: "web", betrouwbaarheid: 0.4, peildatum: "2026-09-01", status: "afgewezen", afwijzing: { door: "t", rol: "gebruiker", op: "2026-10-01", reden: "geen zorgwoningen" } }];
  check("US-04 afgewezen waarde niet in effectief profiel", !effectieveFactoren(p2, dbU).some((f) => f.factorId === "projecttype" && f.optieId === "zorgwonen"));
  check("US-04 afgewezen waarde telt niet als gevuld", !veldGevuld(p2, "factor:projecttype"));
  check("US-04 label afgewezen", verificatieVan(p2.factoren[0], dbU.factoren.find((f) => f.id === "projecttype")) === "afgewezen" && VERIFICATIE_LABEL.gebruiker === "gebruikersgeverifieerd" && VERIFICATIE_LABEL.beheerder === "beheerdersgeverifieerd" && VERIFICATIE_LABEL.niet === "niet geverifieerd · feitelijk");
  const vZelfde: EnrichmentVoorstel = { id: "v1", partnerId: p2.id, factorId: "projecttype", optieId: "zorgwonen", veld: "Projecttype: Zorgwonen", huidig: 4, voorgesteld: 4, bron: "web", bronUrl: "https://x.nl", betrouwbaarheid: 0.5, soort: "geclaimd", citaat: "zorg", status: "open", gevondenOp: "2026-10-02" };
  check("US-04 afgewezen waarde wordt niet automatisch opnieuw ingevuld", !automatischToepasbaar(p2, vZelfde, dbU.factoren) && automatischToepasbaar(p2, { ...vZelfde, voorgesteld: 2 }, dbU.factoren));

  // US-05: uitleg van de weging in de onderbouwing
  const runU = matchProject({ db: dbU, project: dbU.projecten[0] });
  const kU = runU.flatMap((r) => r.kandidaten).find((k) => k.criteria.some((c) => c.verificatie === "niet" || c.verificatie === "gebruiker"));
  check("US-05 onderbouwing legt de weging van betrouwbaarheid uit", !kU || /weegt mee/.test(onderbouwKandidaat(kU).tekst));

  // US-07/US-12: zonder bron geen voorstel; bronrang telt mee in de betrouwbaarheid
  check("US-07 zonder bron geen voorstel", !heeftBronEnOnderbouwing({ bronUrl: "", citaat: "x", bron: "web" }) && heeftBronEnOnderbouwing({ bronUrl: "https://x.nl", citaat: "x", bron: "web" }));
  const vb: EnrichmentVoorstel = { ...vZelfde, id: "v2", bronUrl: "https://bna.nl/leden/abc", betrouwbaarheid: 0.4 };
  pasBronrangToe(vb, STANDAARD_BRANCHEBRONNEN);
  check("US-12 branchebron verhoogt betrouwbaarheid en wordt bij naam genoemd", vb.betrouwbaarheid >= 0.7 && vb.bronRangLijst === 2 && /BNA/.test(vb.bronNaam ?? ""), vb);
  check("US-13 voorgestelde bron telt pas na goedkeuring", !bronVoorUrl("https://bna.nl/x", [{ ...STANDAARD_BRANCHEBRONNEN[1], status: "voorgesteld" }]) && Boolean(bronVoorUrl("https://bna.nl/x", STANDAARD_BRANCHEBRONNEN)));

  // US-15/US-16: dekking per rol en herweging zonder nieuwe run
  const projU = dbU.projecten.find((pr) => matchProject({ db: dbU, project: pr }).some((r) => r.kandidaten.length >= 2)) ?? dbU.projecten[0];
  const r0 = [...matchProject({ db: dbU, project: projU })].sort((a, b) => b.kandidaten.length - a.kandidaten.length)[0];
  const d0 = dekkingVanRol(r0, 60);
  check("US-15 dekking per rol met drempel en ontbrekende criteria", d0.pct >= 0 && d0.pct <= 100 && d0.indicatief === d0.pct < 60 && Array.isArray(d0.ontbrekend), { pct: d0.pct, ontbrekend: d0.ontbrekend.map((c) => c.naam) });
  const eis0 = projU.eisen.find((e) => e.rol === r0.rol);
  const w0 = wegingVanEis(eis0, r0);
  const zelfde = herweegResultaat(r0, w0);
  check("US-16 herweging met dezelfde weging geeft dezelfde scores", zelfde.kandidaten.every((k) => k.score === r0.kandidaten.find((x) => x.partnerId === k.partnerId)!.score), zelfde.kandidaten.map((k) => k.score));
  const eerste = Object.keys(w0.gewichten)[0];
  const anders = herweegResultaat(r0, { ...w0, gewichten: Object.fromEntries(Object.keys(w0.gewichten).map((k) => [k, k === eerste ? 60 : 1])) });
  check("US-16 andere weging werkt direct door in de rangschikking", anders.kandidaten.length === r0.kandidaten.length && anders.kandidaten.every((k, i, a) => i === 0 || a[i - 1].score >= k.score));
  const norm = normaliseerGewichten({ a: 10, b: 10, c: 20 });
  check("US-16 weging wordt genormaliseerd naar 100", Object.values(norm).reduce((s, x) => s + x, 0) === 100 && norm.c === 50);

  // US-18/US-21: alleen geaccepteerde evaluaties tellen mee; organisatie, geen persoon
  const dbE = maakSeedDatabase();
  const ev = dbE.evaluaties[0];
  const voor = leidFactorenAf(dbE.partners.find((p) => p.id === ev.partnerId)!, dbE).statistieken.aantalEvaluaties;
  dbE.evaluaties.filter((e) => e.partnerId === ev.partnerId).forEach((e) => (e.status = "ingediend"));
  const na = leidFactorenAf(dbE.partners.find((p) => p.id === ev.partnerId)!, dbE).statistieken.aantalEvaluaties;
  check("US-21 ingediende evaluaties tellen niet mee", voor > 0 && na === 0, { voor, na });
  check("US-18 persoonsgegevens in evaluatietekst worden herkend", Boolean(persoonsgegevensInTekst("bel jan@bouw.nl")) && Boolean(persoonsgegevensInTekst("tel 06-12345678")) && !persoonsgegevensInTekst("Goed projectbegrip en sterke ideeën"));
  check("US-19 ervaringstekst gaat mee in de matching", ervaringenVan(ev.partnerId, maakSeedDatabase()).length > 0 || !ev.toelichting);

  // US-20: openstaande evaluaties per afgerond project
  const dbO = maakSeedDatabase();
  const opgeleverd = dbO.projecten.find((p) => p.fase === "opgeleverd" || p.fase === "nazorg");
  if (opgeleverd) {
    dbO.evaluaties = dbO.evaluaties.filter((e) => e.projectId !== opgeleverd.id);
    opgeleverd.verantwoordelijke = "Ontwikkelaar A";
    const open = openstaandeEvaluaties(dbO, new Date("2030-01-01")).find((x) => x.project.id === opgeleverd.id);
    check("US-20 openstaande evaluaties met verantwoordelijke en herinnering", Boolean(open && open.open.length > 0 && open.verantwoordelijke === "Ontwikkelaar A" && open.herinnering));
  }

  // US-23/US-24: terugkerende teamcombinaties en bewezen teams
  const dbC = maakSeedDatabase();
  const arch = dbC.partners.find((p) => p.rollen.includes("architect"))!;
  const adv = dbC.partners.find((p) => p.rollen.includes("adviseur"))!;
  dbC.engagements = [];
  dbC.projecten.slice(0, 2).forEach((pr, i) => {
    dbC.engagements.push({ id: `e-a${i}`, partnerId: arch.id, projectId: pr.id, rol: "architect", periode: { van: "2024-01-01" }, contractwaarde: 1, bron: "handmatig" });
    dbC.engagements.push({ id: `e-b${i}`, partnerId: adv.id, projectId: pr.id, rol: "adviseur", periode: { van: "2024-01-01" }, contractwaarde: 1, bron: "handmatig" });
  });
  dbC.evaluaties = [];
  const combi = teamCombinaties(dbC);
  check("US-23 terugkerende combinatie herkend en gerangschikt", combi.length === 1 && combi[0].aantal === 2 && combi[0].leden.length === 2, combi.map((c) => c.sleutel));
  const nieuwProject = { ...dbC.projecten[2], eisen: [{ rol: "architect" as const, eisen: [], semantischGewicht: 20 }, { rol: "adviseur" as const, eisen: [], semantischGewicht: 20 }] };
  const runC = { id: "r", projectId: nieuwProject.id, naam: "t", gestartOp: "", door: "t", input: { eisen: nieuwProject.eisen }, resultaat: matchProject({ db: dbC, project: nieuwProject }) };
  const bt = bewezenTeams(runC, dbC, nieuwProject);
  check("US-24 teamvoorstel met teamscore en onderbouwing", bt.length === 1 && bt[0].teamScore > 0 && bt[0].onderbouwing.length >= 3 && bt[0].gedeeldeProjecten.length === 2, { bt: bt.map((t) => t.teamScore), run: runC.resultaat.map((r) => `${r.rol}:${r.kandidaten.map((k) => k.partnerId).join("/")}:${r.uitsluitingen.map((u) => u.partnerId + "=" + u.reden).join("; ")}` ) });

  // US-26: ERP-import met projectnummer als sleutel
  const dbP = maakSeedDatabase();
  const bestaandProj = dbP.projecten[0];
  bestaandProj.projectnummer = "2024-001";
  const webProj = dbP.projecten[1];
  delete webProj.projectnummer;
  webProj.herkomst = [{ veld: "omschrijving", citaat: "https://x", betrouwbaarheid: 0.6 }];
  const locaties = new Map([["Utrecht", { lat: 52.09, lng: 5.12 }]]);
  let teller = 0;
  const u = importeerProjecten(dbP, [{ Projectnummer: "2024-001", Fase: "Opgeleverd" }, { Projectnummer: "2024-002", Projectnaam: webProj.naam }, { Projectnummer: "2025-010", Projectnaam: "Nieuw ERP-project", Plaats: "Utrecht", Startdatum: "01-03-2026", "Aantal woningen": "48" }, { Projectnaam: "zonder nummer" }], locaties, (p) => `${p}-t${++teller}`);
  check("US-26 ERP-import: bijwerken, samenvoegen op naam, nieuw en overslaan", u.bijgewerkt === 1 && u.samengevoegd === 1 && u.nieuw === 1 && u.overgeslagen.length === 1, u);
  check("US-26 bron zichtbaar: ERP, samengevoegd met webbron", bestaandProj.bron === "erp" && bestaandProj.fase === "opgeleverd" && webProj.projectnummer === "2024-002" && webProj.ookWebbron === true && dbP.projecten.some((p) => p.projectnummer === "2025-010" && p.woningen === 48 && p.planning.start === "2026-03-01"));

  // Migratie v14
  const dbM = maakSeedDatabase();
  dbM.versie = 13;
  dbM.factoren = dbM.factoren.filter((f) => !["paris_proof", "productietijd", "levertijd", "kosten_m2", "productinformatie"].includes(f.id));
  dbM.partners[0].bronnen.push({ url: "Overzicht Houtbouwers v0.3.xlsx", opgehaaldOp: "2026-01-01", soort: "import" });
  dbM.partners[0].brongegevens = [{ bron: "Overzicht Houtbouwers v0.3.xlsx", op: "2026-01-01", velden: { "Paris Proof - Materiaalgebonden CO2-uitstoot (A1 tm A5) - Totaal": "180" } }];
  dbM.evaluaties.forEach((e) => delete e.status);
  dbM.instellingen.verrijkingsbronnen = [];
  migreerV14(dbM);
  check("US-01 migratie v14: nieuwe factoren, type houtbouwer en productkenmerken uit brondata", dbM.factoren.some((f) => f.id === "paris_proof") && dbM.partners[0].rollen.includes("houtbouwer") && dbM.partners[0].factoren.some((f) => f.factorId === "paris_proof" && f.waarde === 180));
  check("US-12/US-21 migratie v14: branchebronnen en evaluatiestatus", dbM.instellingen.verrijkingsbronnen.some((b) => b.categorie === "branche" && b.rang === 2) && dbM.evaluaties.every((e) => e.status === "geaccepteerd"));

  // Migratie v15: niet-geverifieerde niveauwaarden uit internet worden 'ingeschat'
  {
    const db15 = maakSeedDatabase();
    const niv = db15.factoren.find((f) => f.schaal.soort === "niveau" && f.actief)!;
    const co2 = db15.factoren.find((f) => f.id === "co2_ladder");
    const pp = db15.partners[0];
    const basis15 = { bron: "web" as const, betrouwbaarheid: 0.5, peildatum: "2026-01-01", status: "voorgesteld" as const };
    pp.factoren = [
      { ...basis15, factorId: niv.id, optieId: "a", waarde: 3, automatisch: true, toelichting: "geclaimd: …wij bouwen in hout…" },
      { ...basis15, factorId: niv.id, optieId: "b", waarde: 4, status: "gevalideerd", toelichting: "geclaimd: …hout…" },
      ...(co2?.schaal.soort === "niveau" ? [{ ...basis15, factorId: "co2_ladder", waarde: 5, toelichting: "aantoonbaar: CO2-prestatieladder trede 5" }] : [])
    ] as typeof pp.factoren;
    const n = migreerV15(db15);
    check("Migratie v15: niveau van internet → ingeschat; geverifieerd en letterlijk genoemd niveau blijven feitelijk", pp.factoren[0].vaststelling === "ingeschat" && Boolean(pp.factoren[0].onderbouwing) && !pp.factoren[1].vaststelling && (pp.factoren[2] ? !pp.factoren[2].vaststelling : true) && n >= 1, { n, labels: pp.factoren.map((f) => f.vaststelling) });
  }

  // Discovery: alleen echte bouwpartners
  {
    check("Discovery: woningportalen, media en overheid uitgesloten", ["https://www.funda.nl/koop/utrecht", "https://www.pararius.nl", "https://www.nieuwbouw-nederland.nl", "https://www.cobouw.nl/x", "https://www.gemeente.nl", "https://www.blauwhoed.nl"].every(isUitgeslotenDomein) && !isUitgeslotenDomein("https://www.bouwbedrijfjansen.nl"));
    const portaal = beoordeelRelevantie("https://www.woonzoeker-x.nl", "Zoek je nieuwe woning? Bekijk alle woningen. Vraagprijs € 425.000 k.k. Plan een bezichtiging met de makelaar. Bereken je hypotheek en maandlasten. Bewaar je zoekopdracht.", ["aannemer"]);
    const aannemer = beoordeelRelevantie("https://www.bouwbedrijfjansen.nl", "Bouwbedrijf Jansen is aannemer voor woningbouw en utiliteitsbouw. Onze projecten: 48 grondgebonden woningen opgeleverd in bouwteam met de ontwikkelaar. Nieuwbouw en renovatie.", ["aannemer"]);
    const gemeente = beoordeelRelevantie("https://www.utrecht.nl", "Gemeente Utrecht. Burgerzaken: paspoort en rijbewijs aanvragen. Afvalkalender. Gemeenteraad en wethouder. Woningbouw in Utrecht: onze projecten.", ["aannemer"]);
    check("Discovery: gemeentesite (plaatsnaam als domein) valt af op de tekst", !gemeente.relevant, gemeente);
    const kapper = beoordeelRelevantie("https://www.kapsalon-x.nl", "Welkom bij onze kapsalon. Maak een afspraak voor knippen en kleuren.", ["aannemer"]);
    check("Discovery: portaaltekst valt af, aannemer blijft, niet-bouwbedrijf valt af", !portaal.relevant && portaal.soort === "woningportaal of makelaar" && aannemer.relevant && aannemer.score > 50 && !kapper.relevant, { portaal, aannemer, kapper });
    const termen = zoektermenVoorProject({ type: "appartementen", omschrijving: "Nieuwbouw van 120 appartementen in Utrecht, in CLT en houtskeletbouw, natuurinclusief." });
    check("Discovery: zoektermen uit projecttype en vaktermen, niet de omschrijving", termen.includes("appartementenbouw") && termen.includes("clt") && termen.includes("natuurinclusief") && !/utrecht|120|nieuwbouw van/i.test(termen), termen);
  }

  // US-08: werklijst beheerdersvalidatie
  const dbV = maakSeedDatabase();
  const pv = dbV.partners.find((p) => p.rollen.includes("aannemer"))!;
  dbV.goudstandaard = { aannemer: { ...standaardGoudstandaard("aannemer", dbV.factoren), velden: [{ sleutel: "factor:mpg", niveau: "verplicht", beheerderVerificatie: true }] } };
  pv.factoren = [{ factorId: "mpg", waarde: 0.7, bron: "web", betrouwbaarheid: 0.5, peildatum: "2026-10-01", status: "gevalideerd", gevalideerdDoor: "Gebruiker", gevalideerdDoorRol: "gebruiker" }];
  check("US-08 gebruikersgeverifieerde waarde van een kritisch veld wacht op beheerder", wachtOpBeheerder(dbV, dbV.partners).some((x) => x.partnerId === pv.id && x.factorId === "mpg"));
  pv.factoren[0].gevalideerdDoorRol = "beheerder";
  check("US-08 na beheerdersvalidatie niet meer in de werklijst", !wachtOpBeheerder(dbV, dbV.partners).some((x) => x.partnerId === pv.id));

  // US-11: externe bedrijfslinks op een prijzenpagina
  const links = externeBedrijfsLinks('<a href="https://www.bureau-x.nl/projecten">X</a><a href="https://abebonnemaprijs.nl/2025">intern</a><a href="https://www.linkedin.com/x">li</a>', "https://abebonnemaprijs.nl/");
  check("US-11 prijzenpagina levert externe bedrijfswebsites", links.length === 1 && links[0] === "https://www.bureau-x.nl", links);

  // US-31: verbruik uitgesplitst naar verrijking, discovery en chat
  check("US-31 categorieën verrijking, discovery en chat", CATEGORIEEN.includes("verrijking") && CATEGORIEEN.includes("discovery") && CATEGORIEEN.includes("chat") && categorieVan("aandraag") === "discovery" && categorieVan("partnerregistratie") === "verrijking");
}

// ---------- Open punten (vervolg) ----------
{
  // AI via de Anthropic-API; Europese verwerking alleen als aangetoond vastgelegd
  check("AI: Anthropic-API met sleutel, EU alleen als vastgelegd", aiVerwerking({ ANTHROPIC_API_KEY: "x" }).aan && !aiVerwerking({ ANTHROPIC_API_KEY: "x" }).europees && aiVerwerking({ ANTHROPIC_API_KEY: "x", AI_VERWERKING_REGIO: "eu" }).europees && !aiVerwerking({}).aan);

  // Correctie voor lage dekking
  check("Dekking: weinig bekend schuift naar neutraal", dempVoorDekking(98, 5) < dempVoorDekking(71, 44) && dempVoorDekking(80, 100) === 80 && dempVoorDekking(0, 0) === 50);
  const dbD = maakSeedDatabase();
  const prD = dbD.projecten.find((pr) => matchProject({ db: dbD, project: pr }).some((r) => r.kandidaten.length >= 2))!;
  const metD = matchProject({ db: dbD, project: prD });
  dbD.instellingen.dekkingDemping = false;
  const zonderD = matchProject({ db: dbD, project: prD });
  check("Dekking: correctie is uit te zetten", metD.flatMap((r) => r.kandidaten).some((k) => k.ongedempteGewogenScore !== undefined) && zonderD.flatMap((r) => r.kandidaten).every((k) => k.ongedempteGewogenScore === undefined));

  // US-17/US-21: standaardweging
  const isG = (id: string) => dbD.factoren.find((f) => f.id === id)?.type === "gewogen";
  const nieuw = pasErvaringsgewichtToe(NIEUWE_TYPES.constructeur!, 30, isG);
  check("US-21 eigen ervaring krijgt het ingestelde aandeel, totaal blijft 100", nieuw.find((e) => e.factorId === "evaluatiescore")?.gewicht === 30 && valideerGewichten(nieuw, dbD.factoren).geldig, nieuw.map((e) => `${e.factorId}:${e.gewicht}`));
  const zonderEv = pasErvaringsgewichtToe([{ factorId: "mpg", gevraagd: 0.8, gewicht: 100 }], 20, isG);
  check("US-21 eigen ervaring wordt toegevoegd waar ze ontbrak", zonderEv.some((e) => e.factorId === "evaluatiescore" && e.gewicht === 20) && valideerGewichten(zonderEv, dbD.factoren).geldig);
  const tw = teamWeging(40);
  check("US-17 samenwerking in de teamscore instelbaar", Math.abs(tw.kwaliteit + tw.samenwerking + tw.nabijheid + tw.beschikbaarheid - 1) < 1e-9 && tw.samenwerking === 0.4);

  // US-20: eigenaarschap
  check("US-20 verantwoordelijke op naam of e-mail", isVerantwoordelijke({ verantwoordelijke: "Jan Smit" }, { naam: "jan smit" }) && isVerantwoordelijke({ verantwoordelijke: "j.smit@blauwhoed.nl" }, { naam: "X", email: "J.Smit@blauwhoed.nl" }) && !isVerantwoordelijke({}, { naam: "x" }));
  const dbH = maakSeedDatabase();
  dbH.instellingen.evaluatieProces = { herinneringDagen: 60 };
  check("US-20 herinneringstermijn instelbaar", herinneringDagen(dbH) === 60);

  // US-25: externe projecten
  const dbX = maakSeedDatabase();
  const [pa, pb] = dbX.partners;
  check("US-25 genoemde partners op een openbare pagina", genoemdePartners(`Het ontwerp is van ${pa.naam}, uitgevoerd door ${pb.naam}.`, dbX.partners).length >= 2);
  check("US-25 LinkedIn wordt herkend en niet gelezen", isLinkedIn("https://www.linkedin.com/posts/abc") && !isLinkedIn("https://bna.nl/x"));
  const voorX = leidFactorenAf(pa, dbX).statistieken.aantalProjecten;
  dbX.projecten.push({ ...dbX.projecten[0], id: "proj-ext", extern: true, naam: "Extern" });
  dbX.engagements.push({ id: "e-x1", partnerId: pa.id, projectId: "proj-ext", rol: pa.rollen[0], periode: { van: "2024-01-01" }, contractwaarde: 0, bron: "extern", bronUrl: "https://x.nl" }, { id: "e-x2", partnerId: pb.id, projectId: "proj-ext", rol: pb.rollen[0], periode: { van: "2024-01-01" }, contractwaarde: 0, bron: "extern", bronUrl: "https://x.nl" });
  check("US-25 extern project telt niet als eigen prestatie", leidFactorenAf(pa, dbX).statistieken.aantalProjecten === voorX);
  check("US-25 extern project levert een samenwerkingssignaal met bron", leidVerbandenAf(dbX).some((v) => [v.a.id, v.b.id].includes(pa.id) && [v.a.id, v.b.id].includes(pb.id) && v.bronnen.some((b) => /extern project, bron: https:\/\/x\.nl/.test(b.label))));
}

Promise.all([groepD, groepExport]).then(() => {
  console.log(fouten ? `\n${fouten} controle(s) mislukt` : "\nAlle controles geslaagd");
  process.exit(fouten ? 1 : 0);
});
