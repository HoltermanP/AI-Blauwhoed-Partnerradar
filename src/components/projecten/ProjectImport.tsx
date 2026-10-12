"use client";
// US-26: projecten uploaden uit Business Central of het ERP (CSV of Excel). Het projectnummer is de sleutel; bestaande
// projecten uit webbronnen worden samengevoegd. Een API-koppeling volgt later.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import readXlsxFile from "read-excel-file";
import { importeerProjectenActie } from "@/lib/actions";
import type { ProjectImportUitkomst, ProjectRij } from "@/lib/domain/projectimport";
import { Melding } from "@/components/ui";

function naarRijen(rijen: unknown[][]): ProjectRij[] {
  const kop = Math.max(0, rijen.slice(0, 15).findIndex((r) => r.some((c) => /project\s*(nummer|nr|no)|^nummer$|^nr\.?$|^no\.?$/i.test(String(c ?? "").trim()))));
  const koppen = (rijen[kop] ?? []).map((c) => String(c ?? "").trim());
  return rijen
    .slice(kop + 1)
    .filter((r) => r.some((c) => c !== null && c !== undefined && String(c).trim() !== ""))
    .map((r) => {
      const obj: ProjectRij = {};
      koppen.forEach((k, i) => {
        if (k) obj[k] = r[i] instanceof Date ? (r[i] as Date).toISOString().slice(0, 10) : (r[i] as ProjectRij[string]);
      });
      return obj;
    });
}

function parseCsv(tekst: string): unknown[][] {
  const eerste = tekst.split("\n")[0];
  const sep = (eerste.match(/;/g)?.length ?? 0) >= (eerste.match(/,/g)?.length ?? 0) ? ";" : ",";
  return tekst
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, "")));
}

export default function ProjectImport() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const [uitkomst, setUitkomst] = useState<ProjectImportUitkomst | null>(null);

  async function lees(bestand: File) {
    setFout(null);
    setUitkomst(null);
    try {
      const rijen = /\.csv$/i.test(bestand.name) ? parseCsv(await bestand.text()) : ((await readXlsxFile(bestand)) as unknown as unknown[][]);
      const data = naarRijen(rijen);
      start(async () => {
        const r = await importeerProjectenActie(data, bestand.name);
        if (!r.ok) return setFout(r.fout);
        setUitkomst(r.data!);
        router.refresh();
      });
    } catch (e) {
      setFout(`Het bestand kon niet worden gelezen: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (!open)
    return (
      <button type="button" className="knop knop-secundair" onClick={() => setOpen(true)}>
        Importeren uit ERP
      </button>
    );
  return (
    <div className="kaart formulier importPaneel">
      <h3>Projecten importeren uit Business Central / ERP</h3>
      <p className="muted klein-tekst">
        CSV of Excel met minimaal de kolom <b>Projectnummer</b>; verder herkend: Projectnaam, Plaats, Type, Aantal woningen, Fase/Status, Startdatum, Einddatum/Oplevering en Verantwoordelijke/Projectleider. Het ERP is leidend: een bestaand project met hetzelfde nummer (of, zonder nummer, dezelfde naam uit een webbron) wordt bijgewerkt en samengevoegd. Een API-koppeling volgt later.
      </p>
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      {uitkomst ? (
        <Melding soort={uitkomst.overgeslagen.length ? "waarschuwing" : "succes"}>
          {uitkomst.gelezen} regels gelezen: {uitkomst.nieuw} nieuw, {uitkomst.bijgewerkt} bijgewerkt, {uitkomst.samengevoegd} samengevoegd met een project uit een webbron
          {uitkomst.overgeslagen.length ? `; ${uitkomst.overgeslagen.length} overgeslagen (${uitkomst.overgeslagen.slice(0, 4).map((o) => `regel ${o.regel}: ${o.reden}`).join("; ")}${uitkomst.overgeslagen.length > 4 ? " …" : ""})` : ""}.
        </Melding>
      ) : null}
      <div className="formulierActies">
        <input type="file" accept=".csv,.xlsx" disabled={bezig} onChange={(e) => e.target.files?.[0] && lees(e.target.files[0])} />
        {bezig ? <span className="muted">Importeren…</span> : null}
        <button type="button" className="knop knop-tekst klein" onClick={() => setOpen(false)}>
          Sluiten
        </button>
      </div>
    </div>
  );
}
