// Rooktest van de domeinlogica zonder browser: npm run smoke
import { maakSeedDatabase } from "../src/lib/domain/seed";
import { matchProject, semantischZoeken, valideerGewichten } from "../src/lib/domain/matching";
import { stelTeamSamen } from "../src/lib/domain/team";
import { signalenVoor } from "../src/lib/domain/signalen";
import { leidFactorenAf } from "../src/lib/domain/derive";
import { vindDubbel } from "../src/lib/domain/discovery";
import { extraheerVoorstellen, splitsClaims } from "../src/lib/domain/enrichment";
import { extraheerProjectprofiel } from "../src/lib/domain/extractie";
import { importeerEngagements } from "../src/lib/domain/csv";

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

// Documentextractie
const ex = extraheerProjectprofiel("Projectnaam: Zonnehof\nLocatie: Utrecht\n72 appartementen in middenhuur, hoogstedelijk, circulair en Paris Proof. Start bouw 2027-09, oplevering 2029.");
check("US-11 extractie met herkomst", ex.velden.woningen === 72 && ex.velden.plaats === "Utrecht" && ex.velden.type === "appartementen" && ex.herkomst.length > 3, ex.velden);

// CSV-import
const csv = importeerEngagements("kvk;project;rol;van;contractwaarde\n34123456;Houtwijk Vathorst;aannemer;2024-01-01;1000\n99999999;Onbekend;aannemer;2024-01-01;1", db);
check("US-18 CSV match op KVK + wachtrij", csv.engagements.length === 1 && csv.wachtrij.length === 1, csv.wachtrij[0]?.reden);

console.log(fouten ? `\n${fouten} controle(s) mislukt` : "\nAlle controles geslaagd");
process.exit(fouten ? 1 : 0);
