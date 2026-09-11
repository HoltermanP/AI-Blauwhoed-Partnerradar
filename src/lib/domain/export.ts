// B8: export naar CSV (opent direct in Excel; puntkomma + BOM voor NL-instellingen).
import { effectieveStatus } from "./herkomst";
import { STATUS_LABEL } from "../format";
import type { Database } from "./types";

function cel(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function naarCsv(rijen: Array<Record<string, unknown>>): string {
  if (!rijen.length) return "";
  const kolommen = Object.keys(rijen[0]);
  return "﻿" + [kolommen.join(";"), ...rijen.map((r) => kolommen.map((k) => cel(r[k])).join(";"))].join("\r\n");
}

/** Partnerexport: kerngegevens + per actieve factor de waarde en status (eis 1: herkomst reist mee). */
export function partnersCsv(db: Database, metGearchiveerd = false) {
  const factoren = db.factoren.filter((f) => f.actief && !f.afgeleid);
  const partners = db.partners.filter((p) => metGearchiveerd || p.status !== "gearchiveerd");
  return naarCsv(
    partners.map((p) => {
      const basis: Record<string, unknown> = {
        Naam: p.naam,
        KVK: p.kvk,
        Status: STATUS_LABEL[p.status],
        Rollen: p.rollen.join(", "),
        Plaats: p.vestigingsplaats,
        Website: p.website ?? "",
        Medewerkers: p.medewerkers ?? "",
        Omzet: p.omzet ?? "",
        Certificaten: p.certificaten.map((c) => `${c.type} t/m ${c.geldigTot}`).join(" | "),
        Projecten: db.engagements.filter((e) => e.partnerId === p.id).length,
        Omschrijving: p.omschrijving.slice(0, 500)
      };
      factoren.forEach((f) => {
        const w = p.factoren.filter((x) => x.factorId === f.id);
        basis[f.naam] = w
          .map((x) => {
            const optie = x.optieId ? `${f.opties?.find((o) => o.id === x.optieId)?.label ?? x.optieId}: ` : "";
            return `${optie}${Array.isArray(x.waarde) ? x.waarde.join("+") : x.waarde} [${effectieveStatus(x, f) ?? "berekend"}, ${x.bron}, ${x.peildatum}]`;
          })
          .join(" | ");
      });
      return basis;
    })
  );
}

/** Historie-export: engagements met evaluatiegemiddelde. */
export function historieCsv(db: Database) {
  return naarCsv(
    db.engagements.map((e) => {
      const p = db.partners.find((x) => x.id === e.partnerId);
      const proj = db.projecten.find((x) => x.id === e.projectId);
      const ev = db.evaluaties.filter((x) => x.engagementId === e.id || (x.partnerId === e.partnerId && x.projectId === e.projectId));
      const gem = ev.length ? Math.round((ev.reduce((s, x) => s + (x.kwaliteit + x.planning + x.budget + x.samenwerking + x.duurzaamheid) / 5, 0) / ev.length) * 10) / 10 : "";
      return {
        Partner: p?.naam ?? e.partnerId,
        Project: proj?.naam ?? e.projectId,
        Rol: e.rol,
        Van: e.periode.van,
        Tot: e.periode.tot ?? "",
        Contractwaarde: e.contractwaarde || "",
        "Geplande oplevering": e.geplandeOplevering ?? "",
        "Werkelijke oplevering": e.werkelijkeOplevering ?? "",
        Bouwsysteem: e.bouwsysteem ?? "",
        "Evaluatie (gem.)": gem,
        Bron: e.bron
      };
    })
  );
}
