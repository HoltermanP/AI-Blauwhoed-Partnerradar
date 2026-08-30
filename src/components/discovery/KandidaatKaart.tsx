"use client";
// US-25 wachtrij, US-26 dubbelen, US-27 AI-samenvatting. Beslissingen lopen via beoordeelKandidaat / markeerGeenDubbel.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { beoordeelKandidaat, markeerGeenDubbel } from "@/lib/actions";
import type { DiscoveryCandidate } from "@/lib/domain/types";
import { datumTijd, ROL_LABEL } from "@/lib/format";
import { Badge, Melding, ScoreBalk } from "@/components/ui";

type Rechten = { goedkeuren: boolean; promoveren: boolean };

export default function KandidaatKaart({ kandidaat, projectNaam, dubbelNaam, rechten }: { kandidaat: DiscoveryCandidate; projectNaam?: string; dubbelNaam?: string; rechten: Rechten }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const [reden, setReden] = useState("");
  const [afwijzen, setAfwijzen] = useState(false);
  const k = kandidaat;
  const [dubbelId, dubbelReden] = k.mogelijkeDubbelVan ? k.mogelijkeDubbelVan.split("|") : [undefined, undefined];
  const profiel = typeof k.ruweData.profiel === "string" ? k.ruweData.profiel : "";

  const beslis = (beslissing: "geaccepteerd" | "afgewezen" | "geparkeerd") => {
    setFout(null);
    start(async () => {
      const r = await beoordeelKandidaat(k.id, beslissing, beslissing === "afgewezen" ? reden : undefined);
      if (!r.ok) return setFout(r.fout);
      setAfwijzen(false);
      router.refresh();
    });
  };

  const geenDubbel = () => {
    setFout(null);
    start(async () => {
      const r = await markeerGeenDubbel(k.id);
      if (!r.ok) return setFout(r.fout);
      router.refresh();
    });
  };

  const open = k.status === "nieuw" || k.status === "geparkeerd";

  return (
    <article className={`kandidaatKaart ${k.mogelijkeDubbelVan ? "dubbel" : ""}`}>
      <header className="kandidaatKaartKop">
        <div>
          <h3>{k.naam}</h3>
          <p className="muted">
            {k.rollen.map((r) => ROL_LABEL[r]).join(", ")} · {k.vestigingsplaats ?? "plaats onbekend"}
            {k.kvk ? ` · KVK ${k.kvk}` : ""}
          </p>
        </div>
        <div className="kandidaatScore">
          {k.voorlopigeScore !== undefined ? <ScoreBalk score={k.voorlopigeScore} label="Voorlopige score" klein /> : <span className="muted">Geen voorlopige score</span>}
          <small className="muted">voorlopig, op basis van bron</small>
        </div>
      </header>

      <p className="kandidaatBron">
        <Badge kleur="grijs">bron</Badge> {k.bron} ·{" "}
        <a href={k.bronUrl} target="_blank" rel="noreferrer">
          {k.bronUrl}
        </a>{" "}
        · opgehaald {datumTijd(k.opgehaaldOp)}
        {projectNaam && k.projectId ? (
          <>
            {" "}
            · project <Link href={`/projecten/${k.projectId}`}>{projectNaam}</Link>
          </>
        ) : (
          " · niet aan een project gekoppeld"
        )}
      </p>

      {k.mogelijkeDubbelVan && dubbelId ? (
        <Melding soort="waarschuwing">
          <b>Mogelijke dubbel</b> van <Link href={`/partners/${dubbelId}`}>{dubbelNaam ?? dubbelId}</Link>: {dubbelReden}.{" "}
          {rechten.goedkeuren ? (
            <button type="button" className="knop knop-tekst klein" onClick={geenDubbel} disabled={bezig}>
              Geen dubbel
            </button>
          ) : (
            <span className="muted">(recht discovery_goedkeuren nodig om als geen dubbel te markeren)</span>
          )}
        </Melding>
      ) : null}

      {k.samenvatting ? (
        <div className="samenvatting">
          <div>
            <h4>Wat doet het bedrijf</h4>
            <p>{k.samenvatting.watDoetHetBedrijf || profiel}</p>
          </div>
          <div>
            <h4>Referentieprojecten</h4>
            {k.samenvatting.referentieprojecten.length ? (
              <ul>
                {k.samenvatting.referentieprojecten.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">Geen referenties gevonden.</p>
            )}
          </div>
          <div>
            <h4>Waarom past het</h4>
            <p>{k.samenvatting.waaromPastHet}</p>
          </div>
          <div>
            <h4>Wat is onzeker</h4>
            <ul>
              {k.samenvatting.watIsOnzeker.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          <p className="muted samenvattingVoet">
            Samenvatting door: {k.samenvatting.provider} · {datumTijd(k.samenvatting.gegenereerdOp)}
          </p>
        </div>
      ) : null}

      {fout ? <Melding soort="fout">{fout}</Melding> : null}

      {k.status === "geaccepteerd" && k.gepromoveerdTot ? (
        <Melding soort="succes">
          Geaccepteerd als prospect: <Link href={`/partners/${k.gepromoveerdTot}`}>naar partnerprofiel</Link> · door {k.beoordeeldDoor} op {datumTijd(k.beoordeeldOp)}
        </Melding>
      ) : null}
      {k.status === "afgewezen" ? (
        <p className="muted">
          Afgewezen door {k.beoordeeldDoor} op {datumTijd(k.beoordeeldOp)}: {k.reden}
        </p>
      ) : null}

      {open ? (
        <div className="formulierActies">
          {rechten.promoveren ? (
            <button type="button" className="knop klein" onClick={() => beslis("geaccepteerd")} disabled={bezig}>
              Accepteren als prospect
            </button>
          ) : (
            <span className="muted">Accepteren vereist recht prospect_promoveren.</span>
          )}
          {rechten.goedkeuren ? (
            <>
              <button type="button" className="knop knop-secundair klein" onClick={() => setAfwijzen((v) => !v)} disabled={bezig}>
                Afwijzen
              </button>
              {k.status !== "geparkeerd" ? (
                <button type="button" className="knop knop-secundair klein" onClick={() => beslis("geparkeerd")} disabled={bezig}>
                  Parkeren
                </button>
              ) : null}
            </>
          ) : (
            <span className="muted">Afwijzen/parkeren vereist recht discovery_goedkeuren.</span>
          )}
        </div>
      ) : null}

      {afwijzen && open ? (
        <div className="formulier afwijsBlok">
          <label>
            Reden van afwijzing (verplicht; traint de filtering)
            <input value={reden} onChange={(e) => setReden(e.target.value)} placeholder="bijv. alleen utiliteitsbouw, geen woningbouw" />
          </label>
          <div className="formulierActies">
            <button type="button" className="knop knop-gevaar klein" onClick={() => beslis("afgewezen")} disabled={bezig}>
              Bevestig afwijzing
            </button>
            <button type="button" className="knop knop-tekst klein" onClick={() => setAfwijzen(false)}>
              Annuleren
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
