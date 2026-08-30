// Opslag: in-memory database met optionele Neon-snapshot (JSONB). Elke mutatie loopt via `muteer` en schrijft een auditregel (US-46).
// Het genormaliseerde Postgres-schema (PostGIS + pgvector) staat in db/schema.sql voor de productiefase.
import { neon } from "@neondatabase/serverless";
import { maakLegeDatabase, maakSeedDatabase } from "./domain/seed";
import { geocodeer } from "./domain/geocode";
import { geocode as lokaalGeocode } from "./domain/geo";
import { rijNaarPartner, voegPartnersToe, voegRijenSamen } from "./domain/partnerimport";
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

let opslaanTimer: ReturnType<typeof setTimeout> | null = null;
function planOpslaan(db: Database) {
  if (!process.env.DATABASE_URL) return;
  if (opslaanTimer) clearTimeout(opslaanTimer);
  opslaanTimer = setTimeout(async () => {
    try {
      const sql = neon(process.env.DATABASE_URL!);
      await sql`insert into partnerdb_state (id, state, updated_at) values (1, ${JSON.stringify(db)}::jsonb, now()) on conflict (id) do update set state = excluded.state, updated_at = now()`;
    } catch (e) {
      console.warn("Neon opslaan mislukt:", e);
    }
  }, 500);
}

export async function getDb(): Promise<Database> {
  if (g.__partnerDb) return g.__partnerDb;
  if (!g.__partnerDbGeladen) {
    g.__partnerDbGeladen = (async () => {
      // Standaard leeg (echte data via invoer/import/discovery). DEMO_DATA=1 laadt de fictieve demoset.
      const uitNeon = await laadUitNeon();
      if (uitNeon) g.__partnerDb = uitNeon;
      else if (process.env.DEMO_DATA === "1") g.__partnerDb = maakSeedDatabase();
      else g.__partnerDb = await maakStartDatabase();
    })();
  }
  await g.__partnerDbGeladen;
  return g.__partnerDb!;
}

/** Eerste start zonder opgeslagen staat: lege database plus de echte partners uit het Blauwhoed-overzicht houtbouwers. */
async function maakStartDatabase(): Promise<Database> {
  const db = maakLegeDatabase();
  const bron = houtbouwers as { sourceFile: string; partners: Array<{ values: Record<string, string | number | boolean> }> };
  const partners = voegRijenSamen(bron.partners.map((p) => rijNaarPartner(p.values)).filter((p): p is NonNullable<typeof p> => Boolean(p)));
  // Eerst de lokale plaatsenlijst (direct), daarna op de achtergrond PDOK voor onbekende plaatsen zodat de eerste pagina niet wacht.
  const plaatsen = Array.from(new Set(partners.map((p) => p.plaats).filter((x): x is string => Boolean(x))));
  const locaties = new Map<string, Geo | null>(plaatsen.map((pl) => [pl, lokaalGeocode(pl)]));
  const u = voegPartnersToe(db, partners, locaties, bron.sourceFile, nieuwId);
  void Promise.all(
    plaatsen
      .filter((pl) => !locaties.get(pl))
      .map(async (pl) => {
        const r = await geocodeer(pl);
        if (!r) return;
        db.partners.forEach((p) => {
          if (p.vestigingsplaats === pl) {
            p.locatie = r.locatie;
            p.tags = p.tags.filter((t) => t !== "locatie onbekend");
          }
        });
        planOpslaan(db);
      })
  );
  db.audit.unshift({ id: nieuwId("audit"), op: new Date().toISOString(), door: "systeem", gebruikersrol: "beheerder", entiteit: "partner", entiteitId: "import", actie: "houtbouwersoverzicht geladen bij eerste start", details: `${u.nieuw} organisaties uit ${bron.sourceFile}` });
  planOpslaan(db);
  return db;
}

let teller = 0;
export function nieuwId(prefix: string) {
  teller += 1;
  return `${prefix}-${Date.now().toString(36)}${teller.toString(36)}`;
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
  try {
    const sql = neon(process.env.DATABASE_URL);
    await sql`insert into partnerdb_state (id, state, updated_at) values (1, ${JSON.stringify(g.__partnerDb)}::jsonb, now()) on conflict (id) do update set state = excluded.state, updated_at = now()`;
  } catch (e) {
    console.warn("Neon opslaan mislukt:", e);
  }
}
