"use client";
// Partners importeren uit Excel (.xlsx) of CSV, of het meegeleverde Blauwhoed-overzicht houtbouwers laden.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import readXlsxFile, { readSheetNames } from "read-excel-file";
import { importeerPartners, laadHoutbouwersOverzicht, type ImportUitkomst } from "@/lib/actions";
import type { ImportRij } from "@/lib/domain/partnerimport";
import { Melding } from "@/components/ui";

function vindKopRij(rijen: unknown[][]) {
  const labels = ["organisatie", "naam", "bedrijf", "partner", "kvk", "website"];
  let beste = 0;
  let besteScore = 0;
  rijen.slice(0, 15).forEach((r, i) => {
    const score = r.filter((c) => labels.includes(String(c ?? "").trim().toLowerCase())).length;
    if (score > besteScore) {
      beste = i;
      besteScore = score;
    }
  });
  return beste;
}

function naarRijen(rijen: unknown[][]): ImportRij[] {
  const kop = vindKopRij(rijen);
  const koppen = (rijen[kop] ?? []).map((c) => String(c ?? "").trim());
  return rijen.slice(kop + 1).map((r) => {
    const obj: ImportRij = {};
    koppen.forEach((k, i) => {
      if (k) obj[k] = r[i] as ImportRij[string];
    });
    return obj;
  });
}

function parseCsv(tekst: string): unknown[][] {
  const scheidingsteken = (tekst.split("\n")[0].match(/;/g)?.length ?? 0) >= (tekst.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  return tekst
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => l.split(scheidingsteken).map((c) => c.trim().replace(/^"|"$/g, "")));
}

export default function PartnerImport({ magBewerken }: { magBewerken: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const [uitkomst, setUitkomst] = useState<ImportUitkomst | null>(null);
  const [open, setOpen] = useState(false);

  const verwerk = (rijen: ImportRij[], naam: string) =>
    start(async () => {
      const r = await importeerPartners(rijen, naam);
      if (!r.ok) return setFout(r.fout);
      setUitkomst(r.data ?? null);
      router.refresh();
    });

  const onBestand = async (file: File | undefined) => {
    if (!file) return;
    setFout(null);
    setUitkomst(null);
    try {
      let rijen: unknown[][];
      if (file.name.toLowerCase().endsWith(".csv")) rijen = parseCsv(await file.text());
      else {
        const bladen = await readSheetNames(file);
        const blad = bladen.find((b) => /partner|organisatie|houtbouw|leverancier|bedrij/i.test(b)) ?? bladen[0];
        rijen = (await readXlsxFile(file, { sheet: blad })) as unknown[][];
      }
      verwerk(naarRijen(rijen), file.name);
    } catch (e) {
      setFout(e instanceof Error ? e.message : "Bestand kon niet worden gelezen.");
    }
  };

  if (!magBewerken) return null;

  return (
    <div className="partnerImport">
      <button type="button" className="knop knop-secundair" onClick={() => setOpen((o) => !o)}>
        Importeren (Excel/CSV)
      </button>
      {open ? (
        <div className="kaart" style={{ marginTop: 12 }}>
          {fout ? <Melding soort="fout">{fout}</Melding> : null}
          {uitkomst ? (
            <Melding soort="succes">
              {uitkomst.gelezen} rijen gelezen: {uitkomst.nieuw} nieuwe partners, {uitkomst.bijgewerkt} bestaande aangevuld{uitkomst.zonderLocatie ? `, ${uitkomst.zonderLocatie} zonder herkenbare plaats (tag 'locatie onbekend')` : ""}. Rijen van dezelfde organisatie zijn samengevoegd. Draai daarna een verrijkingsronde om websites te lezen.
            </Melding>
          ) : null}
          <p className="muted klein-tekst">
            Kolommen worden herkend op naam: <b>Organisatie/Naam</b>, KVK, Plaats, Website (of Bron 1 - Website), Rol/Ketenrol, Omschrijving, en de kenmerkkolommen uit het houtbouwersoverzicht (woningtypes, minimale projectgrootte, MPG, BENG 2, biobased %, losmaakbaarheid, materiaalopbouw, industrialisatie, contractvorm, doelgroepen). Kenmerken krijgen bron <em>opgave</em> (betrouwbaarheid 60%). Bestaande partners worden alleen aangevuld, nooit overschreven.
          </p>
          <div className="formulierActies">
            <label className="knop klein">
              <input type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={(e) => onBestand(e.target.files?.[0])} disabled={bezig} />
              {bezig ? "Bezig…" : "Bestand kiezen"}
            </label>
            <button
              type="button"
              className="knop knop-secundair klein"
              disabled={bezig}
              onClick={() => {
                setFout(null);
                setUitkomst(null);
                start(async () => {
                  const r = await laadHoutbouwersOverzicht();
                  if (!r.ok) return setFout(r.fout);
                  setUitkomst(r.data ?? null);
                  router.refresh();
                });
              }}
            >
              Blauwhoed-overzicht houtbouwers laden (116 rijen)
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
