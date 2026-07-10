"use client";

import readXlsxFile, { readSheetNames } from "read-excel-file";
import type { CriterionHeader, PartnerDataset, PartnerRecord } from "./types";

const preferredSheetNames = ["Houtbouwers", "Partners", "Organisaties", "Sheet1"];

function normalize(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim();
  return value;
}

function text(value: unknown) {
  const clean = normalize(value);
  return typeof clean === "string" ? clean : String(clean);
}

function findHeaderRow(rows: unknown[][]) {
  const likelyLabels = ["Organisatie", "Conceptnaam", "Bron 1 - Website", "Wie"];
  let best = 0;
  let bestScore = 0;

  rows.slice(0, 12).forEach((row, index) => {
    const cells = row.map(text);
    const score = likelyLabels.reduce((sum, label) => sum + (cells.includes(label) ? 1 : 0), 0);
    if (score > bestScore) {
      best = index;
      bestScore = score;
    }
  });

  return bestScore > 0 ? best : 0;
}

function buildHeaders(rows: unknown[][], headerRowIndex: number): CriterionHeader[] {
  const headerRow = rows[headerRowIndex] ?? [];
  const groupRow = rows[Math.max(0, headerRowIndex - 2)] ?? [];
  const hintRow = rows[Math.max(0, headerRowIndex - 1)] ?? [];
  const headers: CriterionHeader[] = [];
  let group = "Algemeen";

  for (let index = 0; index < headerRow.length; index += 1) {
    const nextGroup = text(groupRow[index]);
    const label = text(headerRow[index]);
    const hint = text(hintRow[index]);

    if (nextGroup && nextGroup !== label) group = nextGroup;
    if (!label) continue;
    headers.push({ index, group, hint, label });
  }

  return headers;
}

function makeRecord(row: unknown[], headers: CriterionHeader[], rowNumber: number): PartnerRecord | null {
  const values: PartnerRecord["values"] = {};

  headers.forEach((header) => {
    const value = normalize(row[header.index]);
    values[header.label] = value as string | number | boolean;
  });

  const organization = text(values.Organisatie);
  if (!organization) return null;

  const filledCriteria = Object.values(values).filter((value) => value !== "").length;

  return {
    id: `import-${rowNumber}-${organization.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    sourceRow: rowNumber,
    category: "Geimporteerde partners",
    organization,
    concept: text(values.Conceptnaam),
    type: text(values["Concept / Maatwerk"]),
    website: text(values["Bron 1 - Website"]),
    owner: text(values.Wie),
    filledCriteria,
    values
  };
}

export async function importPartnerWorkbook(file: File): Promise<PartnerDataset> {
  const rows =
    file.name.toLowerCase().endsWith(".csv")
      ? parseCsv(await file.text())
      : await readWorkbookRows(file);
  const headerRowIndex = findHeaderRow(rows);
  const headers = buildHeaders(rows, headerRowIndex);
  const partners = rows
    .slice(headerRowIndex + 1)
    .map((row, index) => makeRecord(row, headers, headerRowIndex + index + 2))
    .filter((record): record is PartnerRecord => Boolean(record));

  return {
    sourceFile: file.name,
    generatedFrom: `Import uit ${file.name}`,
    headers,
    partners
  };
}

async function readWorkbookRows(file: File) {
  const sheetNames = await readSheetNames(file);
  const sheetName = preferredSheetNames.find((name) => sheetNames.includes(name)) ?? sheetNames[0];
  return readXlsxFile(file, { sheet: sheetName });
}

function parseCsv(input: string) {
  return input
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => line.split(";").map((cell) => cell.trim()));
}
