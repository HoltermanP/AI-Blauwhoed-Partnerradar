"use client";
// US-18: controlewachtrij voor onherleidbare importregels.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { verwijderUitImportWachtrij } from "@/lib/actions";
import { datumTijd } from "@/lib/format";
import { Melding } from "@/components/ui";

export default function WachtrijRegel({ item, magBewerken }: { item: { id: string; regel: Record<string, string>; reden: string; op: string }; magBewerken: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const verwijder = () =>
    start(async () => {
      const r = await verwijderUitImportWachtrij(item.id);
      if (!r.ok) return setFout(r.fout);
      router.refresh();
    });
  return (
    <li>
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      <div className="wachtrijRegel">
        <div>
          <b>{item.reden}</b>
          <div>
            {Object.entries(item.regel)
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <span key={k} className="chip">
                  {k}: {v}
                </span>
              ))}
          </div>
          <small className="muted">{datumTijd(item.op)}</small>
        </div>
        {magBewerken ? (
          <button type="button" className="knop knop-secundair klein" disabled={bezig} onClick={verwijder}>
            Verwijderen
          </button>
        ) : null}
      </div>
    </li>
  );
}
