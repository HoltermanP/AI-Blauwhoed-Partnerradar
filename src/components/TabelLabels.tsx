"use client";

import { useEffect } from "react";

/**
 * Responsieve tabellen voor de hele app (zie globals.css):
 * - zet bij elke cel een data-label met de kolomkop, zodat een rij als kaartje ("Kop: waarde") kan worden getoond;
 * - zet .tabel-kaarten op een tabel die niet in zijn kader past, zodat er nooit horizontaal gescrold hoeft te worden.
 * Werkt ook voor tabellen die later verschijnen en bij het wijzigen van de schermbreedte.
 */
export default function TabelLabels() {
  useEffect(() => {
    let wacht: number | undefined;
    const verwerk = () => {
      document.querySelectorAll<HTMLTableElement>("table.tabel").forEach((tabel) => {
        const koppen = Array.from(tabel.querySelectorAll<HTMLTableCellElement>("thead tr:last-child th")).map((th) => th.textContent?.trim() ?? "");
        if (koppen.length) {
          tabel.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach((tr) => {
            let kolom = 0;
            Array.from(tr.cells).forEach((cel) => {
              if (!cel.hasAttribute("data-label") && cel.colSpan === 1) cel.setAttribute("data-label", koppen[kolom] ?? "");
              kolom += cel.colSpan;
            });
          });
        }
        // De partnertabel heeft een eigen responsieve opmaak; de databaseverkenner scrolt bewust als een spreadsheet.
        if (tabel.classList.contains("partnerTabel") || tabel.classList.contains("dbTabel")) return;
        const kader = tabel.closest<HTMLElement>(".tabelWrap") ?? tabel.parentElement;
        if (!kader) return;
        tabel.classList.remove("tabel-kaarten");
        if (kader.scrollWidth > kader.clientWidth + 2) tabel.classList.add("tabel-kaarten");
      });
    };
    const straks = () => {
      window.clearTimeout(wacht);
      wacht = window.setTimeout(verwerk, 100);
    };
    verwerk();
    const waarnemer = new MutationObserver(straks);
    waarnemer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", straks);
    return () => {
      waarnemer.disconnect();
      window.removeEventListener("resize", straks);
      window.clearTimeout(wacht);
    };
  }, []);
  return null;
}
