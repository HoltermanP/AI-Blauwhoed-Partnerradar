"use client";
// US-52: een basisveld handmatig bevestigen zet de status op gevalideerd (met naam en datum).
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { bevestigBasisveld } from "@/lib/actions";
import type { BasisVeld } from "@/lib/domain/types";

export default function BasisveldBevestigen({ partnerId, veld }: { partnerId: string; veld: BasisVeld }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="knop knop-tekst klein"
        disabled={bezig}
        title="Ik heb deze waarde gecontroleerd: zet de status op gevalideerd"
        onClick={() =>
          start(async () => {
            const r = await bevestigBasisveld(partnerId, veld);
            if (!r.ok) setFout(r.fout);
            else router.refresh();
          })
        }
      >
        Bevestigen
      </button>
      {fout ? <span className="tekst-rood klein-tekst">{fout}</span> : null}
    </>
  );
}
