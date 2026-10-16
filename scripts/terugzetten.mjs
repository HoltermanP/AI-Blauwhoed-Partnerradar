// Terug naar de vorige productieversie. Met --database ook de database terug naar de back-up van vóór de laatste deploy.
// Gebruik: npm run terugzetten   of   npm run terugzetten -- --database
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { herstel } from "./db-backup.mjs";

const sh = (cmd, stil) => execSync(cmd, { stdio: stil ? "pipe" : "inherit", encoding: "utf8" });
const metDatabase = process.argv.includes("--database");
const log = existsSync(".deploys.json") ? JSON.parse(readFileSync(".deploys.json", "utf8")) : [];

// Vorige productie-deployment: de tweede in de lijst van Vercel (de eerste is de huidige).
const lijst = sh("vercel ls --prod --yes 2>&1", true);
// Alleen gelukte deployments (Ready): nooit terug naar een mislukte build.
const urls = Array.from(new Set(lijst.split("\n").filter((r) => /Ready/.test(r)).map((r) => r.match(/https:\/\/[a-z0-9-]+\.vercel\.app/)?.[0]).filter(Boolean)));
if (urls.length < 2) {
  console.error("Geen vorige productieversie gevonden.\n" + lijst);
  process.exit(1);
}
const [huidig, vorige] = urls;
console.log(`Huidig: ${huidig}\nTerug naar: ${vorige}`);

if (metDatabase) {
  const laatste = log[0];
  if (!laatste?.backupId) {
    console.error("Geen back-up van de laatste deploy bekend; zet de database met de hand terug: npm run db -- lijst / herstel <id>");
    process.exit(1);
  }
  const vooraf = await herstel(laatste.backupId);
  console.log(`Database teruggezet naar back-up ${laatste.backupId} (van vóór deploy ${laatste.commit}); de stand van daarnet staat in back-up ${vooraf.id}.`);
}

sh(`vercel rollback ${vorige} --yes`);
console.log(`\n✔ Vorige versie staat weer live.${metDatabase ? "" : " De database is niet aangeraakt."}`);
console.log("Let op: Vercel deployt nieuwe pushes niet automatisch; de volgende npm run deploy zet weer de nieuwste versie live.");
