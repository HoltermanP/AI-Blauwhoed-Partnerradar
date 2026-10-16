// Back-up en herstel van de database-stand (tabel partnerdb_state) in de tabel partnerdb_backup.
// Gebruik: node --env-file=.env.local scripts/db-backup.mjs maak "<reden>" | lijst | herstel <id>
import { neon } from "@neondatabase/serverless";

const BEWAAR = 30; // oudste back-ups boven dit aantal worden opgeruimd

export async function maakBackup(reden) {
  const sql = neon(process.env.DATABASE_URL);
  await sql`create table if not exists partnerdb_backup (id serial primary key, state jsonb not null, versie text, reden text, gemaakt_op timestamptz not null default now())`;
  const r = await sql`insert into partnerdb_backup (state, versie, reden) select state, state->>'versie', ${reden} from partnerdb_state where id = 1 returning id, versie, gemaakt_op`;
  if (!r.length) throw new Error("Geen database-stand gevonden om te back-uppen.");
  await sql`delete from partnerdb_backup where id not in (select id from partnerdb_backup order by id desc limit ${BEWAAR})`;
  return r[0];
}

export async function lijst() {
  const sql = neon(process.env.DATABASE_URL);
  return sql`select id, versie, reden, gemaakt_op, length(state::text) as bytes from partnerdb_backup order by id desc limit 15`;
}

/** Zet een back-up terug; maakt eerst zelf een back-up van de huidige stand, zodat ook het terugzetten terug te draaien is. */
export async function herstel(id) {
  const sql = neon(process.env.DATABASE_URL);
  const b = await sql`select id from partnerdb_backup where id = ${id}`;
  if (!b.length) throw new Error(`Back-up ${id} bestaat niet.`);
  const vooraf = await maakBackup(`automatisch, vóór terugzetten van back-up ${id}`);
  await sql`update partnerdb_state set state = (select state from partnerdb_backup where id = ${id}), updated_at = now() where id = 1`;
  return vooraf;
}

if (process.argv[1]?.endsWith("db-backup.mjs")) {
  const [actie, arg] = process.argv.slice(2);
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL ontbreekt (staat in .env.local).");
  if (actie === "maak") console.log("Back-up gemaakt:", await maakBackup(arg ?? "handmatig"));
  else if (actie === "lijst") console.table(await lijst());
  else if (actie === "herstel") console.log("Teruggezet. Back-up van de stand ervoor:", await herstel(Number(arg)));
  else console.log("Gebruik: maak <reden> | lijst | herstel <id>");
}
