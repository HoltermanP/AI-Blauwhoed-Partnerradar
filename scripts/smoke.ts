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
import { budgetStatus, kostenUsd, maandVerbruik, schatVerrijkingsronde } from "../src/lib/domain/kosten";
import { betrouwbaarheidNiveau, bronRang, bronTekst, markeerGeenBron, registreerHandmatigeBasisvelden, zetBasisveldHerkomst } from "../src/lib/domain/herkomst";
import { verwerkVoorstellen, veldenZonderBron } from "../src/lib/domain/voorstellen";
import { goudstandaardVoorPartner, gezochteVelden } from "../src/lib/domain/goudstandaard";
import { basisVeldKwaliteit, statusVerdeling } from "../src/lib/domain/datakwaliteit";
import { BASISVELDEN } from "../src/lib/domain/webverrijking";
import { BRON_BETROUWBAARHEID, type Bron, type EnrichmentVoorstel } from "../src/lib/domain/types";

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

// Eis 2: kosten per AI-bewerking — bewerking -> aanroepen, maandverbruik, budget, schatting vooraf
{
  const nu = new Date();
  const bewerking = { id: "aib-1", soort: "verrijkingsronde" as const, door: "systeem", op: nu.toISOString(), aanroepen: [
    { model: "claude-opus-5", doel: "factorextractie A", invoerTokens: 7000, uitvoerTokens: 800, kostenUsd: kostenUsd("claude-opus-5", 7000, 800), op: nu.toISOString() },
    { model: "claude-opus-5", doel: "factorextractie B", invoerTokens: 6000, uitvoerTokens: 700, kostenUsd: kostenUsd("claude-opus-5", 6000, 700), op: nu.toISOString() }
  ], invoerTokens: 13000, uitvoerTokens: 1500, kostenUsd: kostenUsd("claude-opus-5", 13000, 1500) };
  check("Eis 2: één bewerking, meerdere aanroepen", bewerking.aanroepen.length === 2 && Math.abs(bewerking.kostenUsd - (bewerking.aanroepen[0].kostenUsd + bewerking.aanroepen[1].kostenUsd)) < 1e-9);
  check("Eis 2: prijstabel klopt (opus-5 $5/$25 per MTok)", Math.abs(kostenUsd("claude-opus-5", 1_000_000, 1_000_000) - 30) < 1e-9);
  const verbruik = maandVerbruik([bewerking], nu);
  check("Eis 2: maandverbruik aggregeert", verbruik.bewerkingen === 1 && verbruik.aanroepen === 2 && verbruik.invoerTokens === 13000);
  db.aiBewerkingen = [{ ...bewerking, kostenUsd: 85 }];
  db.instellingen.aiBudgetUsdPerMaand = 100;
  const b = budgetStatus(db, nu);
  check("Eis 2: 80%-melding", b.waarschuwing && !b.overschreden && Math.round(b.pct) === 85);
  db.aiBewerkingen = [{ ...bewerking, kostenUsd: 120 }];
  check("Eis 2: budget overschreden blokkeert geplande rondes", budgetStatus(db, nu).overschreden);
  db.aiBewerkingen = [];
  const schatting = schatVerrijkingsronde(20);
  check("Eis 2: schatting vooraf", schatting.bewerkingen === 20 && schatting.geschatteKostenUsd > 0);
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

console.log(fouten ? `\n${fouten} controle(s) mislukt` : "\nAlle controles geslaagd");
process.exit(fouten ? 1 : 0);
