// B8-vervolg: PDF-export met jsPDF (werkt serverless, geen fontbestanden nodig).
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { STATUS_LABEL, ROL_LABEL, datum } from "../format";
import { effectieveStatus } from "./herkomst";
import type { Database, Partner } from "./types";

const BLAUW: [number, number, number] = [0, 62, 126];

function nieuwDoc(liggend = false) {
  return new jsPDF({ orientation: liggend ? "landscape" : "portrait", unit: "mm", format: "a4" });
}

function kop(doc: jsPDF, titel: string, sub: string) {
  doc.setFontSize(16);
  doc.setTextColor(...BLAUW);
  doc.text(titel, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(sub, 14, 22);
  doc.setTextColor(20);
}

function voetnoten(doc: jsPDF) {
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(`Blauwhoed Partnerdatabase · geëxporteerd ${datum(new Date().toISOString())} · pagina ${i} van ${paginas}`, 14, doc.internal.pageSize.getHeight() - 7);
  }
}

function uit(doc: jsPDF): Buffer {
  voetnoten(doc);
  return Buffer.from(doc.output("arraybuffer"));
}

/** Partneroverzicht als PDF (liggend A4). */
export function partnersPdf(db: Database, metGearchiveerd = false): Buffer {
  const partners = db.partners.filter((p) => metGearchiveerd || p.status !== "gearchiveerd").sort((a, b) => a.naam.localeCompare(b.naam));
  const doc = nieuwDoc(true);
  kop(doc, "Partneroverzicht", `${partners.length} partners · statussen en kerngegevens`);
  autoTable(doc, {
    startY: 28,
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: BLAUW },
    head: [["Partner", "KVK", "Status", "Rollen", "Plaats", "Website", "Medew.", "Certificaten", "Proj."]],
    body: partners.map((p) => [
      p.naam,
      p.kvk || "-",
      STATUS_LABEL[p.status],
      p.rollen.map((r) => ROL_LABEL[r]).join(", "),
      p.vestigingsplaats || "-",
      p.website?.replace(/^https?:\/\/(www\.)?/, "") ?? "-",
      p.medewerkers ?? "-",
      p.certificaten.map((c) => c.type).join(", ") || "-",
      db.engagements.filter((e) => e.partnerId === p.id).length || "-"
    ])
  });
  return uit(doc);
}

/** Projecthistorie als PDF. */
export function historiePdf(db: Database): Buffer {
  const doc = nieuwDoc(true);
  kop(doc, "Projecthistorie", `${db.engagements.length} engagements · ${db.evaluaties.length} evaluaties`);
  autoTable(doc, {
    startY: 28,
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: BLAUW },
    head: [["Partner", "Project", "Rol", "Periode", "Contractwaarde", "Oplevering (gepland/werkelijk)", "Evaluatie (gem.)"]],
    body: db.engagements.map((e) => {
      const p = db.partners.find((x) => x.id === e.partnerId);
      const proj = db.projecten.find((x) => x.id === e.projectId);
      const ev = db.evaluaties.filter((x) => x.engagementId === e.id || (x.partnerId === e.partnerId && x.projectId === e.projectId));
      const gem = ev.length ? (ev.reduce((s, x) => s + (x.kwaliteit + x.planning + x.budget + x.samenwerking + x.duurzaamheid) / 5, 0) / ev.length).toFixed(1) : "-";
      return [p?.naam ?? e.partnerId, proj?.naam ?? e.projectId, ROL_LABEL[e.rol], `${datum(e.periode.van)} - ${e.periode.tot ? datum(e.periode.tot) : "heden"}`, e.contractwaarde ? `EUR ${e.contractwaarde.toLocaleString("nl-NL")}` : "-", `${e.geplandeOplevering ? datum(e.geplandeOplevering) : "-"} / ${e.werkelijkeOplevering ? datum(e.werkelijkeOplevering) : "-"}`, gem];
    })
  });
  return uit(doc);
}

/** Volledig partnerdossier als PDF: profiel, factorwaarden met herkomst/status (eis 1), certificaten, historie, documenten. */
export function partnerDossierPdf(p: Partner, db: Database): Buffer {
  const doc = nieuwDoc();
  kop(doc, p.naam, `KVK ${p.kvk || "-"} · ${STATUS_LABEL[p.status]} · ${p.rollen.map((r) => ROL_LABEL[r]).join(", ")} · ${p.vestigingsplaats || "-"}`);
  autoTable(doc, {
    startY: 28,
    styles: { fontSize: 9, cellPadding: 1.6 },
    theme: "plain",
    body: [
      ["Website", p.website ?? "-"],
      ["Medewerkers / omzet", `${p.medewerkers ?? "-"} / ${p.omzet ? `EUR ${p.omzet.toLocaleString("nl-NL")}` : "-"}`],
      ["Werkgebied", `${p.werkgebiedKm} km rond ${p.vestigingsplaats || "vestiging"}`],
      ["Omschrijving", p.omschrijving.slice(0, 700) || "-"],
      ["Referenties", p.referenties.slice(0, 6).join("\n") || "-"]
    ],
    columnStyles: { 0: { cellWidth: 42, fontStyle: "bold" } }
  });

  const fmap = new Map(db.factoren.map((f) => [f.id, f]));
  const naY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60;
  doc.setFontSize(12);
  doc.setTextColor(...BLAUW);
  doc.text("Factorwaarden (met herkomst en status, eis 1)", 14, naY + 10);
  autoTable(doc, {
    startY: naY + 13,
    styles: { fontSize: 8, cellPadding: 1.4 },
    headStyles: { fillColor: BLAUW },
    head: [["Veld", "Waarde", "Bron", "Status", "Betrouwb.", "Peildatum"]],
    body: p.factoren.map((f) => {
      const def = fmap.get(f.factorId);
      const veld = def ? (f.optieId ? `${def.naam}: ${def.opties?.find((o) => o.id === f.optieId)?.label ?? f.optieId}` : def.naam) : f.factorId;
      return [veld, Array.isArray(f.waarde) ? f.waarde.join(", ") : String(f.waarde), f.bron, effectieveStatus(f, def) ?? "berekend", `${Math.round(f.betrouwbaarheid * 100)}%`, datum(f.peildatum)];
    })
  });

  const y2 = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60;
  if (p.certificaten.length) {
    autoTable(doc, {
      startY: y2 + 8,
      styles: { fontSize: 8, cellPadding: 1.4 },
      headStyles: { fillColor: BLAUW },
      head: [["Certificaat", "Nummer", "Geldig tot", "Geverifieerd"]],
      body: p.certificaten.map((c) => [c.type + (c.niveau ? ` niveau ${c.niveau}` : ""), c.nummer, datum(c.geldigTot), c.geverifieerdOp ? datum(c.geverifieerdOp) : "-"])
    });
  }
  const eng = db.engagements.filter((e) => e.partnerId === p.id);
  if (eng.length) {
    const y3 = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60;
    autoTable(doc, {
      startY: y3 + 8,
      styles: { fontSize: 8, cellPadding: 1.4 },
      headStyles: { fillColor: BLAUW },
      head: [["Project (historie)", "Rol", "Periode"]],
      body: eng.map((e) => [db.projecten.find((x) => x.id === e.projectId)?.naam ?? e.projectId, ROL_LABEL[e.rol], `${datum(e.periode.van)} - ${e.periode.tot ? datum(e.periode.tot) : "heden"}`])
    });
  }
  if (p.documenten?.length) {
    const y4 = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60;
    autoTable(doc, {
      startY: y4 + 8,
      styles: { fontSize: 8, cellPadding: 1.4 },
      headStyles: { fillColor: BLAUW },
      head: [["Document", "Soort", "Verwijzing"]],
      body: p.documenten.map((d) => [d.naam, d.soort, d.bestandUrl ?? d.url ?? (d.tekst ? `tekst (${d.tekst.length} tekens)` : "-")])
    });
  }
  return uit(doc);
}
