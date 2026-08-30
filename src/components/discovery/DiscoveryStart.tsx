"use client";
// US-23/US-24: zoekopdracht starten op basis van projectprofiel of vrije trefwoorden.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { startDiscovery } from "@/lib/actions";
import { ROLLEN, type Rol } from "@/lib/domain/types";
import { ROL_LABEL } from "@/lib/format";
import { Melding } from "@/components/ui";

type ProjectOptie = { id: string; naam: string; rollen: Rol[]; omschrijving: string };

export default function DiscoveryStart({ projecten, magStarten }: { projecten: ProjectOptie[]; magStarten: boolean }) {
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

  const toggleRol = (rol: Rol) => setRollen((r) => (r.includes(rol) ? r.filter((x) => x !== rol) : [...r, rol]));

  const verzend = (e: React.FormEvent) => {
    e.preventDefault();
    setFout(null);
    setSucces(null);
    if (!rollen.length) return setFout("Kies minstens één rol.");
    start(async () => {
      const r = await startDiscovery(projectId || null, rollen, trefwoorden);
      if (!r.ok) return setFout(r.fout);
      setSucces(`${r.data ?? 0} nieuwe kandidaat(en) toegevoegd aan de wachtrij.`);
      router.refresh();
    });
  };

  return (
    <form className="formulier" onSubmit={verzend}>
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      {succes ? <Melding soort="succes">{succes}</Melding> : null}
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
        Trefwoorden / projectomschrijving
        <textarea value={trefwoorden} onChange={(e) => setTrefwoorden(e.target.value)} placeholder="bijv. circulaire houtbouw, demontabele gevel, middenhuur" />
      </label>
      <div className="formulierActies">
        <button className="knop" type="submit" disabled={bezig || !magStarten}>
          {bezig ? "Zoeken…" : "Zoekopdracht starten"}
        </button>
        {!magStarten ? <span className="muted">Je rol heeft geen recht &lsquo;bewerken&rsquo;; zoekopdrachten starten is niet mogelijk.</span> : null}
      </div>
    </form>
  );
}
