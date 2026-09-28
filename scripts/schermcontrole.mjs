// Schermcontrole (US-70): screenshots op desktop, tablet (768px) en telefoon (375px) en detectie van horizontale overloop
// en consolefouten. Gebruik: node scripts/schermcontrole.mjs <basis-url> <uitmap> [rol] pad1 pad2 ...
// Vereist Google Chrome (playwright-core gebruikt het geïnstalleerde Chrome-kanaal).
import { chromium } from "playwright-core";

const [basis, uitmap, rol = "u-beheer", ...paden] = process.argv.slice(2);
const breedtes = [
  { naam: "desktop", width: 1280, height: 900 },
  { naam: "tablet", width: 768, height: 1024 },
  { naam: "telefoon", width: 375, height: 812 }
];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const resultaten = [];
for (const b of breedtes) {
  const ctx = await browser.newContext({ viewport: { width: b.width, height: b.height } });
  await ctx.addCookies([{ name: "pr_gebruiker", value: rol, url: basis }]);
  const page = await ctx.newPage();
  const fouten = [];
  page.on("console", (m) => m.type() === "error" && fouten.push(m.text().slice(0, 200)));
  page.on("pageerror", (e) => fouten.push(String(e).slice(0, 200)));
  for (const pad of paden) {
    fouten.length = 0;
    const res = await page.goto(basis + pad, { waitUntil: "networkidle", timeout: 90000 }).catch((e) => ({ status: () => String(e).slice(0, 80) }));
    await page.waitForLoadState("networkidle").catch(() => undefined);
    const meet = () => page.evaluate(() => {
      const breed = document.documentElement.scrollWidth - window.innerWidth;
      const boosdoeners = breed > 1 ? Array.from(document.querySelectorAll("body *")).filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1 && !el.closest(".tabelWrap")).slice(0, 4).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}`) : [];
      return { breed, boosdoeners };
    });
    // Een pagina die na het laden nog navigeert (redirect) opnieuw meten.
    const overloop = await meet().catch(async () => {
      await page.waitForLoadState("networkidle").catch(() => undefined);
      return meet();
    });
    const bestand = `${uitmap}/${b.naam}-${pad.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}.png`;
    await page.screenshot({ path: bestand, fullPage: Boolean(process.env.VOL) });
    resultaten.push({ breedte: b.naam, pad: pad === new URL(page.url()).pathname + new URL(page.url()).search ? pad : `${pad} → ${new URL(page.url()).pathname}`, status: res?.status?.(), overloop: overloop.breed, boosdoeners: overloop.boosdoeners.join(" "), fouten: [...fouten].join(" | ") });
  }
  await ctx.close();
}
await browser.close();
for (const r of resultaten) console.log(`${r.breedte.padEnd(8)} ${String(r.status).padEnd(4)} overloop=${String(r.overloop).padEnd(4)} ${r.pad} ${r.boosdoeners} ${r.fouten ? "FOUTEN: " + r.fouten : ""}`);
