"use client";

import { useTransition } from "react";
import { UserRound } from "lucide-react";
import { wisselGebruiker } from "@/lib/actions";
import type { Gebruiker } from "@/lib/domain/types";

export default function RolWisselaar({ gebruikers, huidig }: { gebruikers: Gebruiker[]; huidig: Gebruiker }) {
  const [pending, start] = useTransition();
  return (
    <label className="rolWisselaar" title="Demo: wissel van gebruikersrol (US-45)">
      <UserRound size={16} />
      <select value={huidig.id} disabled={pending} onChange={(e) => start(() => wisselGebruiker(e.target.value))}>
        {gebruikers.map((g) => (
          <option key={g.id} value={g.id}>
            {g.naam} · {g.rol}
          </option>
        ))}
      </select>
    </label>
  );
}
