// US-61: tekst uit geüploade documenten (PDF, Word .docx, tekst/CSV) lezen, zodat aangeleverde stukken als bron
// 'aangeleverd document' (rang 2) meetellen in de verrijking. Alleen serverzijde.
import { extractText, getDocumentProxy } from "unpdf";
import { leesZipBestand } from "./zip";

export type DocumentTekst = { tekst?: string; melding?: string };

const MAX = 60000;

function normaliseer(t: string) {
  return t.replace(/\u0000/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX);
}

/** Tekst uit een Word-document (.docx): word/document.xml, alinea's als regels. */
export function docxTekst(buffer: Buffer): string | null {
  const xml = leesZipBestand(buffer, "word/document.xml");
  if (!xml) return null;
  return normaliseer(
    xml
      .toString("utf8")
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
  );
}

export async function pdfTekst(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return normaliseer(Array.isArray(text) ? text.join("\n") : text);
}

export async function leesTekstUitBestand(buffer: Buffer, type = "", naam = ""): Promise<DocumentTekst> {
  const ext = naam.toLowerCase().split(".").pop() ?? "";
  try {
    if (type === "application/pdf" || ext === "pdf") {
      const tekst = await pdfTekst(buffer);
      return tekst.length > 20 ? { tekst } : { melding: "Geen tekst gevonden in de PDF (mogelijk een scan zonder tekstlaag)." };
    }
    if (type.includes("wordprocessingml") || ext === "docx") {
      const tekst = docxTekst(buffer);
      return tekst ? { tekst } : { melding: "Het Word-document kon niet worden gelezen." };
    }
    if (type === "application/msword" || ext === "doc") return { melding: "Het oude Word-formaat (.doc) wordt niet gelezen; sla het op als .docx of PDF." };
    if (type.startsWith("text/") || ["txt", "csv", "md"].includes(ext)) return { tekst: normaliseer(buffer.toString("utf8")) };
    return { melding: "Dit bestandstype bevat geen leesbare tekst (bijv. een afbeelding)." };
  } catch (e) {
    return { melding: `Tekst lezen mislukt: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Haal een geüpload (Blob-)bestand op en lees de tekst. */
export async function haalDocumentTekst(url: string, type?: string, naam?: string): Promise<DocumentTekst> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return { melding: `Bestand kon niet worden opgehaald (HTTP ${res.status}).` };
    return leesTekstUitBestand(Buffer.from(await res.arrayBuffer()), type ?? res.headers.get("content-type") ?? "", naam ?? url);
  } catch (e) {
    return { melding: `Bestand ophalen mislukt: ${e instanceof Error ? e.message : String(e)}` };
  }
}
