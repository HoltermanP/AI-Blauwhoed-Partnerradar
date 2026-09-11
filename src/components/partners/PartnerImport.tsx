"use client";
// Partners importeren uit Excel (.xlsx) of CSV, of het meegeleverde Blauwhoed-overzicht houtbouwers laden.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import readXlsxFile, { readSheetNames } from "read-excel-file";
import { importeerPartners, laadHoutbouwersOverzicht } from "@/lib/actions";
import type { ImportUitkomst } from "@/lib/domain/partnerimport";
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

// Veldkoppeling (onderdeel 3): doelvelden waar een kolom aan gekoppeld kan worden. "behouden" = kolomnaam ongewijzigd
// meenemen (kenmerkherkenning + brondata); "negeren" = kolom overslaan.
const DOELVELDEN: Array<{ id: string; label: string; patroon: RegExp }> = [
  { id: "organisatie", label: "Organisatienaam", patroon: /^(organisatie|naam|bedrijf|bedrijfsnaam|partner)$/i },
  { id: "kvk", label: "KVK-nummer", patroon: /kvk/i },
  { id: "plaats", label: "Vestigingsplaats", patroon: /plaats|stad|vestiging/i },
  { id: "website", label: "Website", patroon: /website|url|site|bron 1/i },
  { id: "ketenrol", label: "Rol(len)", patroon: /^rol(len)?$|ketenrol/i },
  { id: "omschrijving", label: "Omschrijving", patroon: /omschrijving|profiel|beschrijving/i },
  { id: "referenties", label: "Referentieprojecten", patroon: /referentie/i },
  { id: "medewerkers", label: "Medewerkers", patroon: /medewerker|fte/i },
  { id: "omzet", label: "Omzet", patroon: /omzet/i }
];

type Voorbeeld = { naam: string; koppen: string[]; rijen: ImportRij[] };

function raadDoel(kop: string): string {
  return DOELVELDEN.find((d) => d.patroon.test(kop))?.id ?? "behouden";
}

export default function PartnerImport({ magBewerken }: { magBewerken: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const [uitkomst, setUitkomst] = useState<ImportUitkomst | null>(null);
  const [open, setOpen] = useState(false);
  const [voorbeeld, setVoorbeeld] = useState<Voorbeeld | null>(null);
  const [koppeling, setKoppeling] = useState<Record<string, string>>({});

  const verwerk = (rijen: ImportRij[], naam: string) =>
    start(async () => {
      const r = await importeerPartners(rijen, naam);
      if (!r.ok) return setFout(r.fout);
      setUitkomst(r.data ?? null);
      setVoorbeeld(null);
      router.refresh();
    });

  const importeerMetKoppeling = () => {
    if (!voorbeeld) return;
    const rijen = voorbeeld.rijen.map((rij) => {
      const nieuw: ImportRij = {};
      Object.entries(rij).forEach(([kop, waarde]) => {
        const doel = koppeling[kop] ?? "behouden";
        if (doel === "negeren") return;
        nieuw[doel === "behouden" ? kop : doel] = waarde;
      });
      return nieuw;
    });
    verwerk(rijen, voorbeeld.naam);
  };

  const onBestand = async (file: File | undefined) => {
    if (!file) return;
    setFout(null);
    setUitkomst(null);
    setVoorbeeld(null);
    try {
      let rijen: unknown[][];
      if (file.name.toLowerCase().endsWith(".csv")) rijen = parseCsv(await file.text());
      else {
        const bladen = await readSheetNames(file);
        const blad = bladen.find((b) => /partner|organisatie|houtbouw|leverancier|bedrij/i.test(b)) ?? bladen[0];
        rijen = (await readXlsxFile(file, { sheet: blad })) as unknown[][];
      }
      const geparsed = naarRijen(rijen);
      const koppen = Array.from(new Set(geparsed.flatMap((r) => Object.keys(r))));
      setVoorbeeld({ naam: file.name, koppen, rijen: geparsed });
      setKoppeling(Object.fromEntries(koppen.map((k) => [k, raadDoel(k)])));
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
          {voorbeeld ? (
            <div className="formulier" style={{ marginBottom: 12 }}>
              <p className="muted klein-tekst"><b>{voorbeeld.rijen.length} rijen</b> gelezen uit {voorbeeld.naam}. Controleer de veldkoppeling; onbekende kolommen blijven behouden als kenmerk/brondata. Dubbelencontrole: exact op KVK, fuzzy op naam.</p>
              <div className="tabelWrap" style={{ maxHeight: 260, overflowY: "auto" }}>
                <table className="tabel">
                  <thead><tr><th>Kolom in bestand</th><th>Doelveld</th><th>Voorbeeldwaarde</th></tr></thead>
                  <tbody>
                    {voorbeeld.koppen.map((k) => (
                      <tr key={k}>
                        <td>{k}</td>
                        <td>
                          <select value={koppeling[k] ?? "behouden"} onChange={(e) => setKoppeling((m) => ({ ...m, [k]: e.target.value }))}>
                            {DOELVELDEN.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                            <option value="behouden">Behouden als kenmerk/brondata</option>
                            <option value="negeren">Negeren</option>
                          </select>
                        </td>
                        <td className="klein-tekst muted">{String(voorbeeld.rijen.find((r) => r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== "")?.[k] ?? "").slice(0, 40)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="formulierActies">
                <button type="button" className="knop klein" disabled={bezig} onClick={importeerMetKoppeling}>{bezig ? "Bezig…" : `Importeren (${voorbeeld.rijen.length} rijen)`}</button>
                <button type="button" className="knop knop-tekst klein" onClick={() => setVoorbeeld(null)}>Annuleren</button>
              </div>
            </div>
          ) : null}
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
