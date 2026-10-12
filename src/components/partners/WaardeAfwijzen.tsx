"use client";
// US-04: een waarde afwijzen met reden (wie en wanneer worden vastgelegd). De waarde telt daarna nergens meer mee.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { wijsWaardeAf, type WaardeRef } from "@/lib/acties/waarden";

export default function WaardeAfwijzen({ waarde, label = "Afwijzen" }: { waarde: WaardeRef; label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reden, setReden] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, start] = useTransition();
  if (!open)
    return (
      <button type="button" className="knop knop-tekst klein" onClick={() => setOpen(true)} title="Deze waarde klopt niet: afwijzen met reden. Ze telt dan niet meer mee en wordt niet opnieuw automatisch ingevuld.">
        {label}
      </button>
    );
  return (
    <span className="redenVeld">
      <input value={reden} onChange={(e) => setReden(e.target.value)} placeholder="Waarom klopt deze waarde niet?" aria-label="Reden van afwijzing" autoFocus />
      <button
        type="button"
        className="knop klein knop-gevaar"
        disabled={bezig || !reden.trim()}
        onClick={() =>
          start(async () => {
            setFout(null);
            const r = await wijsWaardeAf(waarde, reden);
            if (!r.ok) return setFout(r.fout);
            setOpen(false);
            setReden("");
            router.refresh();
          })
        }
      >
        Afwijzen
      </button>
      <button type="button" className="knop knop-tekst klein" onClick={() => setOpen(false)}>
        Annuleren
      </button>
      {fout ? <span className="tekst-rood klein-tekst">{fout}</span> : null}
    </span>
  );
}
