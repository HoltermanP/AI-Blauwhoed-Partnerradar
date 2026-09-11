// Opslag: in-memory database met optionele Neon-snapshot (JSONB). Elke mutatie loopt via `muteer` en schrijft een auditregel (US-46).
// Het genormaliseerde Postgres-schema (PostGIS + pgvector) staat in db/schema.sql voor de productiefase.
import { neon } from "@neondatabase/serverless";
import { maakLegeDatabase, maakSeedDatabase } from "./domain/seed";
import { geocodeer } from "./domain/geocode";
import { geocode as lokaalGeocode } from "./domain/geo";
import { rijNaarPartner, voegPartnersToe, voegRijenSamen } from "./domain/partnerimport";
import { aanvullingPlaatsen, laadAanvulling } from "./domain/aanvulling";
import { HUIDIGE_VERSIE, maakSeedIdGenerator, migreerDatabase } from "./domain/migratie";
import houtbouwers from "@/data/houtbouwers-seed.json";
import type { Geo } from "./domain/types";
import type { AuditEntry, Database, Gebruiker } from "./domain/types";

type Globaal = typeof globalThis & { __partnerDb?: Database; __partnerDbGeladen?: Promise<void> };
const g = globalThis as Globaal;

async function laadUitNeon(): Promise<Database | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const sql = neon(process.env.DATABASE_URL);
    await sql`create table if not exists partnerdb_state (id int primary key default 1, state jsonb not null, updated_at timestamptz not null default now())`;
    const rows = (await sql`select state from partnerdb_state where id = 1`) as Array<{ state: Database }>;
    return rows[0]?.state ?? null;
  } catch (e) {
    console.warn("Neon laden mislukt, val terug op seed:", e);
    return null;
  }
}

async function schrijfNaarNeon(db: Database) {
  if (!process.env.DATABASE_URL) return;
  try {
    const sql = neon(process.env.DATABASE_URL);
    await sql`insert into partnerdb_state (id, state, updated_at) values (1, ${JSON.stringify(db)}::jsonb, now()) on conflict (id) do update set state = excluded.state, updated_at = now()`;
  } catch (e) {
    console.warn("Neon opslaan mislukt:", e);
  }
}

let opslaanTimer: ReturnType<typeof setTimeout> | null = null;
function planOpslaan(db: Database) {
  if (!process.env.DATABASE_URL) return;
  if (opslaanTimer) clearTimeout(opslaanTimer);
  opslaanTimer = setTimeout(() => void schrijfNaarNeon(db), 500);
}

export async function getDb(): Promise<Database> {
  if (g.__partnerDb) return g.__partnerDb;
  if (!g.__partnerDbGeladen) {
    g.__partnerDbGeladen = (async () => {
      // Standaard leeg (echte data via invoer/import/discovery). DEMO_DATA=1 laadt de fictieve demoset.
      const uitNeon = await laadUitNeon();
      if (uitNeon) {
        g.__partnerDb = uitNeon;
        await migreerOpgeslagen(uitNeon);
      }
      else if (process.env.DEMO_DATA === "1") g.__partnerDb = maakSeedDatabase();
      else g.__partnerDb = await maakStartDatabase();
    })();
  }
  await g.__partnerDbGeladen;
  return g.__partnerDb!;
}

/** Migreert een opgeslagen database naar de huidige versie (stabiele IDs, aanvullende dataset) en schrijft direct terug. */
async function migreerOpgeslagen(db: Database) {
  if ((db.versie ?? 1) >= HUIDIGE_VERSIE) return;
  const plaatsen = aanvullingPlaatsen();
  const locaties = new Map<string, Geo | null>(plaatsen.map((pl) => [pl, lokaalGeocode(pl)]));
  const u = migreerDatabase(db, locaties);
  if (!u) return;
  console.info(`Database gemigreerd ${u.van} → ${u.naar}: ${u.hernoemd} IDs hernoemd`, u.aanvulling);
  geocodeerOpAchtergrond(db, plaatsen.filter((pl) => !locaties.get(pl)));
  await schrijfNaarNeon(db);
}

/** PDOK-geocoding voor plaatsen buiten de lokale lijst; werkt de database bij zodra resultaten binnen zijn. */
function geocodeerOpAchtergrond(db: Database, plaatsen: string[]) {
  void Promise.all(
    plaatsen.map(async (pl) => {
      const r = await geocodeer(pl);
      if (!r) return;
      db.partners.forEach((p) => {
        if (p.vestigingsplaats === pl) {
          p.locatie = r.locatie;
          p.tags = p.tags.filter((t) => t !== "locatie onbekend");
        }
      });
      db.projecten.forEach((pr) => {
        if (pr.locatie.plaats === pl) pr.locatie = { ...pr.locatie, ...r.locatie };
      });
      planOpslaan(db);
    })
  );
}

/** Eerste start zonder opgeslagen staat: lege database plus de echte partners uit het Blauwhoed-overzicht houtbouwers en de aanvullende dataset (partners, projecten, websites). */
async function maakStartDatabase(): Promise<Database> {
  const db = maakLegeDatabase();
  // Deterministische IDs: op serverless-hosting (bijv. Vercel) bouwt elke instantie zijn eigen in-memory database op.
  // Met tijdstempel-IDs zou een link van instantie A op instantie B een 404 geven; met vaste IDs zijn ze overal gelijk.
  const seedId = maakSeedIdGenerator();
  db.versie = HUIDIGE_VERSIE;
  const bron = houtbouwers as { sourceFile: string; partners: Array<{ values: Record<string, string | number | boolean> }> };
  const partners = voegRijenSamen(bron.partners.map((p) => rijNaarPartner(p.values)).filter((p): p is NonNullable<typeof p> => Boolean(p)));
  // Eerst de lokale plaatsenlijst (direct), daarna op de achtergrond PDOK voor onbekende plaatsen zodat de eerste pagina niet wacht.
  const plaatsen = Array.from(new Set([...partners.map((p) => p.plaats).filter((x): x is string => Boolean(x)), ...aanvullingPlaatsen()]));
  const locaties = new Map<string, Geo | null>(plaatsen.map((pl) => [pl, lokaalGeocode(pl)]));
  const u = voegPartnersToe(db, partners, locaties, bron.sourceFile, seedId);
  const a = laadAanvulling(db, locaties, seedId);
  geocodeerOpAchtergrond(db, plaatsen.filter((pl) => !locaties.get(pl)));
  db.audit.unshift({ id: seedId("audit"), op: new Date().toISOString(), door: "systeem", gebruikersrol: "beheerder", entiteit: "partner", entiteitId: "import", actie: "houtbouwersoverzicht en aanvulling geladen bij eerste start", details: `${u.nieuw} organisaties uit ${bron.sourceFile}; aanvulling: ${a.partnersNieuw} partners, ${a.projectenNieuw} projecten, ${a.websitesAangevuld} websites` });
  // Direct wegschrijven (niet met vertraging): in een serverless-functie bestaat de timer na het antwoord mogelijk niet meer.
  await schrijfNaarNeon(db);
  return db;
}

let teller = 0;
export function nieuwId(prefix: string) {
  teller += 1;
  return `${prefix}-${Date.now().toString(36)}${teller.toString(36)}`;
}

/** Eis 2: schrijf een AI-bewerking (met haar aanroepen, tokens en kosten) naar de administratie. */
export async function registreerAIBewerking(b: import("./domain/types").AIBewerking) {
  const db = await getDb();
  db.aiBewerkingen.unshift(b);
  if (db.aiBewerkingen.length > 5000) db.aiBewerkingen.length = 5000;
  planOpslaan(db);
}

/** Voer een mutatie uit met auditregel. */
export async function muteer<T>(gebruiker: Gebruiker, audit: Omit<AuditEntry, "id" | "op" | "door" | "gebruikersrol">, fn: (db: Database) => T): Promise<T> {
  const db = await getDb();
  const resultaat = fn(db);
  db.audit.unshift({ id: nieuwId("audit"), op: new Date().toISOString(), door: gebruiker.naam, gebruikersrol: gebruiker.rol, ...audit });
  if (db.audit.length > 2000) db.audit.length = 2000;
  planOpslaan(db);
  return resultaat;
}

export async function resetNaarSeed(gebruiker: Gebruiker, modus: "demo" | "leeg" = "leeg") {
  g.__partnerDb = modus === "demo" ? maakSeedDatabase() : maakLegeDatabase();
  g.__partnerDb.audit.unshift({ id: nieuwId("audit"), op: new Date().toISOString(), door: gebruiker.naam, gebruikersrol: gebruiker.rol, entiteit: "database", entiteitId: "seed", actie: modus === "demo" ? "demodata geladen" : "database leeggemaakt" });
  planOpslaan(g.__partnerDb);
  await slaNuOp();
}

/** Direct wegschrijven naar Neon (na grote wijzigingen zoals import of reset). */
export async function slaNuOp() {
  if (!process.env.DATABASE_URL || !g.__partnerDb) return;
  if (opslaanTimer) clearTimeout(opslaanTimer);
  await schrijfNaarNeon(g.__partnerDb);
}
