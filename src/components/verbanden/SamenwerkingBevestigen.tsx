"use client";
// US-22: een signaal bevestigen als samenwerking (beheerder), met de grond voor de bevestiging; intrekken kan ook.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { bevestigSamenwerking } from "@/lib/acties/analyse";

export default function SamenwerkingBevestigen({ a, b, bevestigd }: { a: string; b: string; bevestigd: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [grond, setGrond] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, start] = useTransition();
  const voer = (intrekken: boolean) =>
    start(async () => {
      setFout(null);
      const r = await bevestigSamenwerking(a, b, grond, intrekken);
      if (!r.ok) return setFout(r.fout);
      setOpen(false);
      router.refresh();
    });
  if (bevestigd)
    return (
      <button type="button" className="knop knop-tekst klein" disabled={bezig} onClick={() => voer(true)}>
        Intrekken
      </button>
    );
  if (!open)
    return (
      <button type="button" className="knop knop-secundair klein" onClick={() => setOpen(true)}>
        Bevestigen
      </button>
    );
  return (
    <span className="redenVeld">
      <input value={grond} onChange={(e) => setGrond(e.target.value)} placeholder="Grond, bijv. projectdossier 2024-017" aria-label="Grond voor bevestiging" autoFocus />
      <button type="button" className="knop klein" disabled={bezig || !grond.trim()} onClick={() => voer(false)}>
        Bevestigen
      </button>
      {fout ? <span className="tekst-rood klein-tekst">{fout}</span> : null}
    </span>
  );
}
