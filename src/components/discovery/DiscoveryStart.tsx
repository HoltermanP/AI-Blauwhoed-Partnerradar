"use client";
// US-23/US-24: zoekopdracht starten op basis van projectprofiel of vrije trefwoorden.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { slaZoekprofielOp, startDiscovery, verwijderZoekprofiel } from "@/lib/actions";
import { ROLLEN, type Rol } from "@/lib/domain/types";
import { hoofdletter, ROL_LABEL } from "@/lib/format";
import { PLAATSEN } from "@/lib/domain/geo";
import { Melding } from "@/components/ui";

type ProjectOptie = { id: string; naam: string; rollen: Rol[]; omschrijving: string };
type ProfielOptie = { id: string; naam: string; rollen: Rol[]; trefwoorden: string; regio?: string };

export default function DiscoveryStart({ projecten, profielen, magStarten }: { projecten: ProjectOptie[]; profielen: ProfielOptie[]; magStarten: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [projectId, setProjectId] = useState<string>("");
  const [rollen, setRollen] = useState<Rol[]>([]);
  const [trefwoorden, setTrefwoorden] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  const kiesProject = (id: string) => {
    setProjectId(id);
    const p = projecten.find((x) => x.id === id);
    if (p) {
      setRollen(p.rollen);
      setTrefwoorden(p.omschrijving);
    }
  };

  const [regio, setRegio] = useState("");
  const [profielNaam, setProfielNaam] = useState("");
  const toggleRol = (rol: Rol) => setRollen((r) => (r.includes(rol) ? r.filter((x) => x !== rol) : [...r, rol]));

  const kiesProfiel = (id: string) => {
    const z = profielen.find((x) => x.id === id);
    if (!z) return;
    setRollen(z.rollen);
    setTrefwoorden(z.trefwoorden);
    setRegio(z.regio ?? "");
    setProfielNaam(z.naam);
  };

  const bewaarProfiel = () => {
    setFout(null);
    start(async () => {
      const r = await slaZoekprofielOp(profielNaam, rollen, trefwoorden, regio || undefined);
      if (!r.ok) return setFout(r.fout);
      setSucces(`Zoekprofiel '${profielNaam}' bewaard.`);
      router.refresh();
    });
  };

  const verzend = (e: React.FormEvent) => {
    e.preventDefault();
    setFout(null);
    setSucces(null);
    if (!rollen.length) return setFout("Kies minstens één rol.");
    start(async () => {
      const r = await startDiscovery(projectId || null, rollen, trefwoorden, regio);
      if (!r.ok) return setFout(r.fout);
      const u = r.data!;
      setSucces(
        `${u.gevonden} kandidaat(en) gevonden via ${u.bronnen.join(" + ")}${u.regio ? ` in ${u.regio}` : ""}: ${u.nieuw} nieuw in de wachtrij, ${u.alInWachtrij} stonden er al (gekoppeld aan dit project), ${u.mogelijkeDubbelen} mogelijk dubbel met een bestaande partner.` +
          (u.gevonden === 0 ? " Tip: kies meer rollen of laat de regio leeg." : "")
      );
      router.refresh();
    });
  };

  return (
    <form className="formulier" onSubmit={verzend}>
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      {succes ? <Melding soort="succes">{succes}</Melding> : null}
      {profielen.length ? (
        <label>
          Opgeslagen zoekprofiel
          <select defaultValue="" onChange={(e) => kiesProfiel(e.target.value)}>
            <option value="">Kies zoekprofiel…</option>
            {profielen.map((z) => (
              <option key={z.id} value={z.id}>
                {z.naam} ({z.rollen.map((r) => ROL_LABEL[r]).join(", ")})
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label>
        Project (optioneel)
        <select value={projectId} onChange={(e) => kiesProject(e.target.value)}>
          <option value="">Geen project — vrije zoekopdracht</option>
          {projecten.map((p) => (
            <option key={p.id} value={p.id}>
              {p.naam}
            </option>
          ))}
        </select>
      </label>
      <div className="veld">
        Rollen
        <div className="vinkjes">
          {ROLLEN.map((rol) => (
            <label key={rol}>
              <input type="checkbox" checked={rollen.includes(rol)} onChange={() => toggleRol(rol)} /> {ROL_LABEL[rol]}
            </label>
          ))}
        </div>
      </div>
      <label>
        Regio (optioneel, vestigingsplaats)
        <select value={regio} onChange={(e) => setRegio(e.target.value)}>
          <option value="">Heel Nederland</option>
          {Object.keys(PLAATSEN).map((pl) => (
            <option key={pl} value={pl}>
              {hoofdletter(pl)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Trefwoorden / projectomschrijving
        <textarea value={trefwoorden} onChange={(e) => setTrefwoorden(e.target.value)} placeholder="bijv. circulaire houtbouw, demontabele gevel, middenhuur" />
      </label>
      <div className="formulierActies">
        <button className="knop" type="submit" disabled={bezig || !magStarten}>
          {bezig ? "Zoeken…" : "Zoekopdracht starten"}
        </button>
        {!magStarten ? <span className="muted">Je rol heeft geen recht &lsquo;bewerken&rsquo;; zoekopdrachten starten is niet mogelijk.</span> : null}
      </div>
      {magStarten ? (
        <div className="formulierActies">
          <input placeholder="Naam zoekprofiel" value={profielNaam} onChange={(e) => setProfielNaam(e.target.value)} style={{ maxWidth: 220 }} />
          <button type="button" className="knop knop-secundair klein" disabled={bezig || !profielNaam.trim() || !rollen.length} onClick={bewaarProfiel}>
            Bewaar als zoekprofiel
          </button>
          {profielNaam && profielen.some((z) => z.naam === profielNaam) ? (
            <button
              type="button"
              className="knop knop-tekst klein"
              disabled={bezig}
              onClick={() => {
                const z = profielen.find((x) => x.naam === profielNaam);
                if (!z || !confirm(`Zoekprofiel '${z.naam}' verwijderen?`)) return;
                start(async () => {
                  const r = await verwijderZoekprofiel(z.id);
                  if (!r.ok) return setFout(r.fout);
                  setProfielNaam("");
                  router.refresh();
                });
              }}
            >
              Profiel verwijderen
            </button>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
