// Naar productie: controleren, database back-uppen, deployen en nagaan of de site werkt.
// Gebruik: npm run deploy
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { maakBackup } from "./db-backup.mjs";

const PRODUCTIE = "https://ai-blauwhoed-partnerradar.vercel.app";
const LOG = ".deploys.json";
const sh = (cmd, opts = {}) => execSync(cmd, { stdio: opts.stil ? "pipe" : "inherit", encoding: "utf8", ...opts });
const stap = (t) => console.log(`\n▶ ${t}`);

stap("Werkkopie controleren");
const open = sh("git status --porcelain", { stil: true }).split("\n").filter((r) => r.trim() && !r.endsWith("next-env.d.ts"));
if (open.length) {
  console.error("Er staan nog wijzigingen open die niet gecommit zijn:\n" + open.join("\n") + "\nCommit ze eerst (dan weet je precies wat er live staat).");
  process.exit(1);
}
const commit = sh("git rev-parse --short HEAD", { stil: true }).trim();
const branch = sh("git rev-parse --abbrev-ref HEAD", { stil: true }).trim();

stap("Typecheck, tests en build");
sh("npm run typecheck");
sh("npm run smoke");
sh("npm run build");

stap("Back-up van de database");
const backup = await maakBackup(`vóór deploy ${commit}`);
console.log(`Back-up ${backup.id} (versie ${backup.versie})`);

stap("Naar GitHub");
sh(`git push origin ${branch}`);

stap("Deployen naar productie");
const uit = sh("vercel deploy --prod --yes", { stil: true });
const url = (uit.match(/https:\/\/[a-z0-9-]+\.vercel\.app/g) ?? []).find((u) => u !== PRODUCTIE) ?? "";
console.log(uit.trim().split("\n").slice(-3).join("\n"));

stap("Controleren of de site werkt");
let fout = null;
for (const pad of ["/", "/partners", "/zoeken", "/datakwaliteit"]) {
  const r = await fetch(PRODUCTIE + pad).catch((e) => ({ status: String(e) }));
  console.log(`${r.status}  ${pad}`);
  if (r.status !== 200) fout = `${pad} gaf ${r.status}`;
}

const log = existsSync(LOG) ? JSON.parse(readFileSync(LOG, "utf8")) : [];
log.unshift({ op: new Date().toISOString(), commit, url, backupId: backup.id, ok: !fout });
writeFileSync(LOG, JSON.stringify(log.slice(0, 50), null, 2));

if (fout) {
  console.error(`\n✖ Controle mislukt (${fout}). Terugzetten: npm run terugzetten  (met database: npm run terugzetten -- --database)`);
  process.exit(1);
}
console.log(`\n✔ Live: ${PRODUCTIE} (commit ${commit}, database-back-up ${backup.id}). Bij problemen: npm run terugzetten`);
