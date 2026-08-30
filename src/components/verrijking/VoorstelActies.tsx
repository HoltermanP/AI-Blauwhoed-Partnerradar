"use client";
// US-31: voorstellen accepteren of afwijzen.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { beoordeelVoorstel } from "@/lib/actions";
import { Melding } from "@/components/ui";

export default function VoorstelActies({ id, magBewerken }: { id: string; magBewerken: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const beslis = (accepteer: boolean) => {
    setFout(null);
    start(async () => {
      const r = await beoordeelVoorstel(id, accepteer);
      if (!r.ok) return setFout(r.fout);
      router.refresh();
    });
  };
  if (!magBewerken) return <span className="muted">Recht &lsquo;bewerken&rsquo; vereist.</span>;
  return (
    <div className="formulierActies">
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      <button type="button" className="knop klein" disabled={bezig} onClick={() => beslis(true)}>
        Accepteren
      </button>
      <button type="button" className="knop knop-secundair klein" disabled={bezig} onClick={() => beslis(false)}>
        Afwijzen
      </button>
    </div>
  );
}
