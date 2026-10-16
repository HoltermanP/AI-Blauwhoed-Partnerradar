"use client";
// US-70: onderbouwing van een matchrun in gewone taal (AI of regels), met de verplichte kanttekening (art. 11.3).
// De toelichting per kandidaat staat bij elke kandidaat; hier de samenvatting per rol. Met AI wordt die na de matchrun
// automatisch opgesteld; de pagina ververst zichzelf tot ze er is.
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { onderbouwMatchrun } from "@/lib/acties/analyse";
import type { MatchRun } from "@/lib/domain/types";
import { ROL_LABEL } from "@/lib/format";
import { Melding } from "@/components/ui";

export default function MatchOnderbouwing({ run, namen, aiActief }: { run: MatchRun; namen: Record<string, string>; aiActief: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const o = run.onderbouwing;
  // Kort na de matchrun stelt de AI de toelichting op de achtergrond op: ververs tot ze er is (max. ~2 minuten na de run).
  const [geladenOp] = useState(() => Date.now());
  const wachtOpAI = aiActief && !o && geladenOp - new Date(run.gestartOp).getTime() < 120_000;
  useEffect(() => {
    if (!wachtOpAI) return;
    let n = 0;
    const t = setInterval(() => (++n > 24 ? clearInterval(t) : router.refresh()), 5000);
    return () => clearInterval(t);
  }, [wachtOpAI, router]);
  return (
    <div className="formulier">
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      {o ? (
        <>
          <p className="muted klein-tekst">
            Opgesteld door {o.provider} op verzoek van {o.door} ({new Date(o.op).toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam" })}).
          </p>
          {o.perRol.map((r) => (
            <section key={r.rol} className="onderbouwingRol">
              <h3>{ROL_LABEL[r.rol]}</h3>
              <p>{r.samenvatting}</p>
              {r.perKandidaat.length ? <p className="muted klein-tekst">Toelichting per kandidaat staat bij {r.perKandidaat.map((k) => namen[k.partnerId] ?? k.partnerId).join(", ")} hieronder.</p> : null}
            </section>
          ))}
        </>
      ) : (
        <p className="muted klein-tekst">{wachtOpAI ? "De AI stelt de toelichting op… (de pagina ververst vanzelf). Elke kandidaat heeft hieronder al een toelichting uit de scoregegevens." : "Elke kandidaat heeft hieronder een toelichting uit de scoregegevens."}</p>
      )}
      <div className="formulierActies">
        <button
          type="button"
          className="knop knop-secundair klein"
          disabled={bezig}
          onClick={() =>
            start(async () => {
              setFout(null);
              const r = await onderbouwMatchrun(run.id);
              if (!r.ok) return setFout(r.fout);
              router.refresh();
            })
          }
        >
          {bezig ? "Bezig…" : o ? "Toelichting opnieuw opstellen" : aiActief ? "Toelichting laten opstellen (AI, 1 bewerking)" : "Samenvatting opstellen"}
        </button>
      </div>
    </div>
  );
}
