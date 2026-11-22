"use client";
// VE-01: kies een project en ga direct naar de geschikte partners (matchpagina van dat project).
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

export default function ProjectKiezer({ projecten }: { projecten: Array<{ id: string; label: string }> }) {
  const router = useRouter();
  const [id, setId] = useState("");
  return (
    <form
      className="projectKiezer"
      onSubmit={(e) => {
        e.preventDefault();
        if (id) router.push(`/projecten/${id}`);
      }}
    >
      <label className="veld">
        Project
        <select value={id} onChange={(e) => setId(e.target.value)} aria-label="Kies een project">
          <option value="">Kies een project…</option>
          {projecten.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="knop knop-primair" disabled={!id}>
        <Search size={16} aria-hidden /> Partners zoeken
      </button>
    </form>
  );
}
