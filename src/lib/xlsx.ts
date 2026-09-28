// US-67: echte Excel-bestanden (.xlsx) via write-excel-file (tegenhanger van het al gebruikte read-excel-file).
import writeXlsxFile from "write-excel-file/node";
import type { Row, SheetData } from "write-excel-file/node";

export type Blad = { naam: string; rijen: Array<Record<string, unknown>> };

function cel(v: unknown) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? { value: v, type: Number } : null;
  if (typeof v === "boolean") return { value: v ? "ja" : "nee", type: String };
  return { value: String(v).slice(0, 32000), type: String };
}

/** Maak een .xlsx met één of meer bladen; de eerste rij is de (vetgedrukte) kop. */
export async function naarXlsx(bladen: Blad[]): Promise<Buffer> {
  const sheets = bladen.map((b) => {
    const kolommen = Array.from(new Set(b.rijen.flatMap((r) => Object.keys(r))));
    const data: SheetData = [kolommen.map((k) => ({ value: k, fontWeight: "bold" as const })) as Row, ...b.rijen.map((r) => kolommen.map((k) => cel(r[k])) as Row)];
    return { data, sheet: b.naam.replace(/[\\/?*[\]:]/g, " ").slice(0, 31), columns: kolommen.map((k) => ({ width: Math.min(60, Math.max(10, k.length + 2)) })), stickyRowsCount: 1 };
  });
  return writeXlsxFile(sheets).toBuffer();
}

export function xlsxAntwoord(buffer: Buffer, bestandsnaam: string) {
  return new Response(new Uint8Array(buffer), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="${bestandsnaam}.xlsx"` } });
}
