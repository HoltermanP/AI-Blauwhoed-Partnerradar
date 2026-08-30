"use client";
// US-08: project vastleggen. US-11: voorvullen uit projectdocument met herkomst per veld; niets wordt opgeslagen zonder expliciet opslaan.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { extraheerProject, slaProjectOp, type ProjectInvoer } from "@/lib/actions";
import type { Extractie } from "@/lib/domain/extractie";
import type { Bouwstijl, Herkomst, Prijssegment, Projectfase, Projecttype } from "@/lib/domain/types";
import { hoofdletter } from "@/lib/format";
import { Melding } from "@/components/ui";

const TYPEN: Projecttype[] = ["grondgebonden", "appartementen", "hoogbouw", "transformatie", "zorgwonen", "gebiedsontwikkeling"];
const SEGMENTEN: Prijssegment[] = ["sociaal", "middenhuur", "koop", "vrije sector"];
const STIJLEN: Bouwstijl[] = ["traditioneel", "modern", "industrieel", "dorps", "hoogstedelijk"];
const FASEN: Projectfase[] = ["initiatief", "planvorming", "realisatie", "opgeleverd", "nazorg"];

export type ProjectFormWaarden = {
  naam: string;
  type: Projecttype;
  plaats: string;
  woningen: number;
  prijssegment: Prijssegment[];
  bouwstijl: Bouwstijl;
  ambitieDuurzaamheid: 1 | 2 | 3 | 4 | 5;
  start: string;
  eind: string;
  fase: Projectfase;
  omschrijving: string;
};

const VELD_LABEL: Record<keyof Extractie["velden"], string> = {
  naam: "Naam",
  type: "Type",
  plaats: "Plaats",
  woningen: "Woningen",
  prijssegment: "Prijssegment",
  bouwstijl: "Bouwstijl",
  ambitieDuurzaamheid: "Ambitie duurzaamheid",
  start: "Start",
  eind: "Oplevering",
  omschrijving: "Omschrijving"
};

function toon(v: unknown): string {
  if (Array.isArray(v)) return v.join(", ");
  if (v === undefined || v === null) return "–";
  return String(v);
}

export default function ProjectFormulier({ id, initieel, plaatsen, herkomstBestaand, toonExtractie }: { id: string | null; initieel: ProjectFormWaarden; plaatsen: string[]; herkomstBestaand?: Herkomst[]; toonExtractie: boolean }) {
  const router = useRouter();
  const [w, setW] = useState<ProjectFormWaarden>(initieel);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, start] = useTransition();
  const [herkomst, setHerkomst] = useState<Herkomst[]>(herkomstBestaand ?? []);

  // --- Extractie (US-11) ---
  const [docTekst, setDocTekst] = useState("");
  const [extractie, setExtractie] = useState<Extractie | null>(null);
  const [overnemen, setOvernemen] = useState<Record<string, boolean>>({});
  const [extractieBezig, startExtractie] = useTransition();

  const zet = <K extends keyof ProjectFormWaarden>(k: K, v: ProjectFormWaarden[K]) => setW((s) => ({ ...s, [k]: v }));

  function leesBestand(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDocTekst(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  function extraheer() {
    setFout(null);
    startExtractie(async () => {
      const r = await extraheerProject(docTekst);
      if (!r.ok) return setFout(r.fout);
      const e = r.data ?? null;
      setExtractie(e);
      const aan: Record<string, boolean> = {};
      if (e) (Object.keys(e.velden) as Array<keyof Extractie["velden"]>).forEach((k) => (aan[k] = e.velden[k] !== undefined));
      setOvernemen(aan);
    });
  }

  function neemOver() {
    if (!extractie) return;
    const v = extractie.velden;
    setW((s) => {
      const n = { ...s };
      if (overnemen.naam && v.naam) n.naam = v.naam;
      if (overnemen.type && v.type) n.type = v.type;
      if (overnemen.plaats && v.plaats) n.plaats = v.plaats;
      if (overnemen.woningen && v.woningen !== undefined) n.woningen = v.woningen;
      if (overnemen.prijssegment && v.prijssegment) n.prijssegment = v.prijssegment;
      if (overnemen.bouwstijl && v.bouwstijl) n.bouwstijl = v.bouwstijl;
      if (overnemen.ambitieDuurzaamheid && v.ambitieDuurzaamheid) n.ambitieDuurzaamheid = v.ambitieDuurzaamheid;
      if (overnemen.start && v.start) n.start = v.start;
      if (overnemen.eind && v.eind) n.eind = v.eind;
      if (overnemen.omschrijving && v.omschrijving) n.omschrijving = v.omschrijving;
      return n;
    });
    setHerkomst(extractie.herkomst.filter((h) => overnemen[h.veld]));
  }

  function opslaan(e: React.FormEvent) {
    e.preventDefault();
    setFout(null);
    if (!w.naam.trim()) return setFout("Naam is verplicht.");
    if (!w.plaats) return setFout("Kies een plaats.");
    if (!w.start || !w.eind) return setFout("Planning start en eind zijn verplicht.");
    if (w.eind < w.start) return setFout("Einddatum ligt vóór de startdatum.");
    const invoer: ProjectInvoer = {
      naam: w.naam.trim(),
      type: w.type,
      plaats: w.plaats,
      woningen: w.woningen,
      prijssegment: w.prijssegment,
      bouwstijl: w.bouwstijl,
      ambitieDuurzaamheid: w.ambitieDuurzaamheid,
      planning: { start: w.start, eind: w.eind },
      fase: w.fase,
      omschrijving: w.omschrijving,
      herkomst: herkomst.length ? herkomst : undefined
    };
    start(async () => {
      const r = await slaProjectOp(id, invoer);
      if (!r.ok) return setFout(r.fout);
      router.refresh();
      router.push(`/projecten/${r.data ?? id}`);
    });
  }

  const veldenGevonden = extractie ? (Object.keys(extractie.velden) as Array<keyof Extractie["velden"]>).filter((k) => extractie.velden[k] !== undefined) : [];

  return (
    <div className="raster">
      {toonExtractie ? (
        <section className="kaart">
          <header className="kaartKop">
            <h2>Voorvullen uit projectdocument</h2>
          </header>
          <p className="muted klein-tekst">Plak de tekst van een programma van eisen of upload een .txt/.md-bestand. Elk gevonden veld toont zijn herkomst (citaat en betrouwbaarheid). Er wordt niets opgeslagen tot u expliciet opslaat.</p>
          <div className="formulier">
            <label>
              Documenttekst
              <textarea value={docTekst} onChange={(e) => setDocTekst(e.target.value)} rows={6} placeholder="Projectnaam: … / 84 woningen / locatie: Amersfoort / start bouw 2027 …" />
            </label>
            <label>
              Bestand (.txt, .md)
              <input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={(e) => leesBestand(e.target.files?.[0])} />
            </label>
            <div className="formulierActies">
              <button type="button" className="knop knop-secundair" disabled={!docTekst.trim() || extractieBezig} onClick={extraheer}>
                {extractieBezig ? "Bezig…" : "Velden herkennen"}
              </button>
            </div>
          </div>
          {extractie ? (
            <div style={{ marginTop: 14 }}>
              <p className="muted klein-tekst">Provider: {extractie.provider}. {veldenGevonden.length} veld(en) gevonden.</p>
              {veldenGevonden.length ? (
                <div className="tabelWrap">
                  <table className="tabel">
                    <thead>
                      <tr>
                        <th>Overnemen</th>
                        <th>Veld</th>
                        <th>Gevonden waarde</th>
                        <th>Herkomst (citaat)</th>
                        <th className="num">Betrouwbaarheid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {veldenGevonden.map((k) => {
                        const hs = extractie.herkomst.filter((h) => h.veld === k);
                        return (
                          <tr key={k}>
                            <td>
                              <input type="checkbox" checked={Boolean(overnemen[k])} onChange={(e) => setOvernemen((o) => ({ ...o, [k]: e.target.checked }))} aria-label={`Overnemen ${VELD_LABEL[k]}`} />
                            </td>
                            <td>{VELD_LABEL[k]}</td>
                            <td>{toon(extractie.velden[k])}</td>
                            <td className="klein-tekst">
                              {hs.map((h, i) => (
                                <div key={i} className="citaat">„{h.citaat}”</div>
                              ))}
                            </td>
                            <td className="num">{hs.length ? `${Math.round(Math.max(...hs.map((h) => h.betrouwbaarheid)) * 100)}%` : "–"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Melding soort="waarschuwing">Geen velden herkend in de tekst.</Melding>
              )}
              <div className="formulierActies" style={{ marginTop: 10 }}>
                <button type="button" className="knop" disabled={!veldenGevonden.length} onClick={neemOver}>
                  Overnemen in formulier
                </button>
                <span className="muted klein-tekst">Alleen aangevinkte velden worden in het formulier gezet.</span>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <form className="kaart formulier" onSubmit={opslaan}>
        <header className="kaartKop">
          <h2>{id ? "Project bewerken" : "Projectgegevens"}</h2>
        </header>
        {fout ? <Melding soort="fout">{fout}</Melding> : null}
        <div className="rij">
          <label>
            Naam
            <input value={w.naam} onChange={(e) => zet("naam", e.target.value)} required />
          </label>
          <label>
            Type
            <select value={w.type} onChange={(e) => zet("type", e.target.value as Projecttype)}>
              {TYPEN.map((t) => (
                <option key={t} value={t}>
                  {hoofdletter(t)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fase
            <select value={w.fase} onChange={(e) => zet("fase", e.target.value as Projectfase)}>
              {FASEN.map((f) => (
                <option key={f} value={f}>
                  {hoofdletter(f)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="rij">
          <label>
            Plaats
            <select value={w.plaats} onChange={(e) => zet("plaats", e.target.value)} required>
              <option value="">– kies –</option>
              {plaatsen.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label>
            Aantal woningen
            <input type="number" min={0} value={w.woningen} onChange={(e) => zet("woningen", Number(e.target.value))} />
          </label>
          <label>
            Bouwstijl
            <select value={w.bouwstijl} onChange={(e) => zet("bouwstijl", e.target.value as Bouwstijl)}>
              {STIJLEN.map((s) => (
                <option key={s} value={s}>
                  {hoofdletter(s)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ambitie duurzaamheid (1–5)
            <select value={w.ambitieDuurzaamheid} onChange={(e) => zet("ambitieDuurzaamheid", Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="veld">
          Prijssegment
          <div className="vinkjes">
            {SEGMENTEN.map((s) => (
              <label key={s}>
                <input type="checkbox" checked={w.prijssegment.includes(s)} onChange={(e) => zet("prijssegment", e.target.checked ? [...w.prijssegment, s] : w.prijssegment.filter((x) => x !== s))} />
                {hoofdletter(s)}
              </label>
            ))}
          </div>
        </div>
        <div className="rij">
          <label>
            Planning start
            <input type="date" value={w.start} onChange={(e) => zet("start", e.target.value)} required />
          </label>
          <label>
            Planning eind
            <input type="date" value={w.eind} onChange={(e) => zet("eind", e.target.value)} required />
          </label>
        </div>
        <label>
          Omschrijving (voedt de semantische vergelijking)
          <textarea value={w.omschrijving} onChange={(e) => zet("omschrijving", e.target.value)} />
        </label>
        {herkomst.length ? (
          <div className="veld">
            Herkomst uit document
            <ul className="lijst klein-tekst">
              {herkomst.map((h, i) => (
                <li key={i}>
                  <b>{VELD_LABEL[h.veld as keyof Extractie["velden"]] ?? h.veld}</b> · betrouwbaarheid {Math.round(h.betrouwbaarheid * 100)}% · <span className="muted">„{h.citaat}”</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="formulierActies">
          <button type="submit" className="knop" disabled={bezig}>
            {bezig ? "Opslaan…" : id ? "Wijzigingen opslaan" : "Project opslaan"}
          </button>
          <button type="button" className="knop knop-tekst" onClick={() => router.back()}>
            Annuleren
          </button>
        </div>
      </form>
    </div>
  );
}
