"use client";
// US-03 / US-19: factorwaarden per partner. Afgeleide waarden (bewijs) winnen van opgave; overschrijven kan bewust en zichtbaar.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { slaPartnerFactorOp, verwijderPartnerFactor } from "@/lib/actions";
import { BRON_BETROUWBAARHEID, type Bron, type Factor, type FactorWaarde, type PartnerFactor, type Rol } from "@/lib/domain/types";
import { datum, waardeTekst } from "@/lib/format";
import { Badge, Melding } from "@/components/ui";
import { FactorWaardeVeld, standaardWaarde } from "./FactorWaardeVeld";

const BRONNEN: Bron[] = ["opgave", "projecthistorie", "evaluatie", "web", "certificaat"];

type Props = {
  partnerId: string;
  rollen: Rol[];
  factoren: Factor[];
  effectief: PartnerFactor[];
  /** Handmatig vastgelegde waarden (partner.factoren). */
  handmatig: PartnerFactor[];
  magBewerken: boolean;
};

function bewijsLink(pf: PartnerFactor) {
  if (!pf.bewijs) return <span className="muted">–</span>;
  if (pf.bewijs.soort === "project") return <Link href={`/projecten/${pf.bewijs.ref}`}>{pf.bewijs.label}</Link>;
  return <span title={pf.bewijs.ref}>{pf.bewijs.label}</span>;
}

function waardeMetLabel(f: Factor | undefined, pf: PartnerFactor) {
  if (f?.schaal.soort === "keuze" && f.opties) {
    const ids = Array.isArray(pf.waarde) ? pf.waarde : [String(pf.waarde)];
    return ids.map((id) => f.opties?.find((o) => o.id === id)?.label ?? id).join(", ");
  }
  if (f?.schaal.soort === "percentage") return `${waardeTekst(pf.waarde)}%`;
  if (f?.schaal.soort === "getal" || f?.schaal.soort === "bereik") return `${waardeTekst(pf.waarde)} ${f.schaal.eenheid}`;
  return waardeTekst(pf.waarde);
}

export default function FactorenBeheer({ partnerId, rollen, factoren, effectief, handmatig, magBewerken }: Props) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const [openRij, setOpenRij] = useState<string | null>(null);
  const [toonToevoegen, setToonToevoegen] = useState(false);

  const factorMap = useMemo(() => new Map(factoren.map((f) => [f.id, f])), [factoren]);
  const sleutel = (pf: PartnerFactor) => `${pf.factorId}::${pf.optieId ?? ""}`;
  const handmatigMap = useMemo(() => new Map(handmatig.map((pf) => [sleutel(pf), pf])), [handmatig]);

  const perCategorie = useMemo(() => {
    const groepen = new Map<string, PartnerFactor[]>();
    [...effectief]
      .sort((a, b) => (factorMap.get(a.factorId)?.code ?? "").localeCompare(factorMap.get(b.factorId)?.code ?? "") || (a.optieId ?? "").localeCompare(b.optieId ?? ""))
      .forEach((pf) => {
        const cat = factorMap.get(pf.factorId)?.categorie ?? "Overig";
        groepen.set(cat, [...(groepen.get(cat) ?? []), pf]);
      });
    return Array.from(groepen.entries());
  }, [effectief, factorMap]);

  function verwijder(pf: PartnerFactor) {
    if (!confirm("Handmatige waarde verwijderen?")) return;
    setFout(null);
    start(async () => {
      const r = await verwijderPartnerFactor(partnerId, pf.factorId, pf.optieId);
      if (!r.ok) setFout(r.fout);
      else router.refresh();
    });
  }

  return (
    <div>
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      <p className="muted klein-tekst">
        Bewijs boven zelfbeeld: waarden uit projecthistorie, evaluaties en certificaten (badge <Badge kleur="mint">afgeleid</Badge>) wegen zwaarder dan opgave of web. Een handmatige overschrijving van een afgeleide waarde is zichtbaar en gelogd.
      </p>
      {magBewerken ? (
        <div className="formulierActies" style={{ marginBottom: 14 }}>
          <button type="button" className="knop klein" onClick={() => setToonToevoegen((v) => !v)}>
            {toonToevoegen ? "Sluiten" : "Factorwaarde toevoegen"}
          </button>
        </div>
      ) : null}
      {toonToevoegen && magBewerken ? (
        <ToevoegFormulier
          partnerId={partnerId}
          rollen={rollen}
          factoren={factoren}
          onKlaar={() => {
            setToonToevoegen(false);
            router.refresh();
          }}
        />
      ) : null}
      {perCategorie.length === 0 ? <p className="muted">Nog geen factorwaarden. Voeg een opgave toe of leg projecthistorie vast.</p> : null}
      {perCategorie.map(([cat, rijen]) => (
        <div key={cat} className="factorGroep">
          <h3>{cat}</h3>
          <div className="tabelWrap">
            <table className="tabel factorTabel">
              <thead>
                <tr>
                  <th>Factor</th>
                  <th>Optie</th>
                  <th>Waarde</th>
                  <th>Bron</th>
                  <th className="num">Betrouwb.</th>
                  <th>Peildatum</th>
                  <th>Bewijs</th>
                  <th>Toelichting</th>
                  {magBewerken ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {rijen.map((pf) => {
                  const f = factorMap.get(pf.factorId);
                  const k = sleutel(pf);
                  const eigen = handmatigMap.get(k);
                  const open = openRij === k;
                  return (
                    <RijMetFormulier key={k} open={open} kolommen={magBewerken ? 9 : 8} formulier={
                      f && open ? (
                        <OverschrijfFormulier
                          partnerId={partnerId}
                          factor={f}
                          huidig={pf}
                          bestaandHandmatig={eigen}
                          onKlaar={() => {
                            setOpenRij(null);
                            router.refresh();
                          }}
                          onAnnuleer={() => setOpenRij(null)}
                        />
                      ) : null
                    }>
                      <td>
                        <b>{f?.naam ?? pf.factorId}</b>
                        <br />
                        <small className="muted">{f?.code}</small>
                      </td>
                      <td>{pf.optieId ? (f?.opties?.find((o) => o.id === pf.optieId)?.label ?? pf.optieId) : <span className="muted">–</span>}</td>
                      <td>
                        <b>{waardeMetLabel(f, pf)}</b>
                        {f?.schaal.soort === "niveau" ? <small className="muted"> / 5</small> : null}
                      </td>
                      <td>
                        {pf.bron} {pf.afgeleid ? <Badge kleur="mint">afgeleid</Badge> : null} {pf.overschrijving ? <Badge kleur="geel">overschreven</Badge> : null}
                      </td>
                      <td className="num">{Math.round(pf.betrouwbaarheid * 100)}%</td>
                      <td>{datum(pf.peildatum)}</td>
                      <td>{bewijsLink(pf)}</td>
                      <td className="klein-tekst">{pf.toelichting ?? ""}</td>
                      {magBewerken ? (
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button type="button" className="knop knop-tekst klein" onClick={() => setOpenRij(open ? null : k)} disabled={!f}>
                            Overschrijven
                          </button>
                          {eigen ? (
                            <button type="button" className="knop knop-tekst klein" onClick={() => verwijder(eigen)} disabled={bezig}>
                              Verwijderen
                            </button>
                          ) : null}
                        </td>
                      ) : null}
                    </RijMetFormulier>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function RijMetFormulier({ children, open, kolommen, formulier }: { children: React.ReactNode; open: boolean; kolommen: number; formulier: React.ReactNode }) {
  return (
    <>
      <tr>{children}</tr>
      {open ? (
        <tr className="inlineFormulierRij">
          <td colSpan={kolommen}>{formulier}</td>
        </tr>
      ) : null}
    </>
  );
}

function OverschrijfFormulier({ partnerId, factor, huidig, bestaandHandmatig, onKlaar, onAnnuleer }: { partnerId: string; factor: Factor; huidig: PartnerFactor; bestaandHandmatig?: PartnerFactor; onKlaar: () => void; onAnnuleer: () => void }) {
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const [waarde, setWaarde] = useState<FactorWaarde>(bestaandHandmatig?.waarde ?? huidig.waarde);
  const [bron, setBron] = useState<Bron>(bestaandHandmatig?.bron ?? "opgave");
  const [betrouwbaarheid, setBetrouwbaarheid] = useState(bestaandHandmatig?.betrouwbaarheid ?? BRON_BETROUWBAARHEID.opgave);
  const [toelichting, setToelichting] = useState(bestaandHandmatig?.toelichting ?? "");
  const wasAfgeleid = !!huidig.afgeleid || !!huidig.overschrijving;

  function verzend(e: React.FormEvent) {
    e.preventDefault();
    setFout(null);
    start(async () => {
      const r = await slaPartnerFactorOp(partnerId, {
        factorId: factor.id,
        optieId: huidig.optieId,
        waarde,
        bron,
        betrouwbaarheid,
        toelichting: toelichting.trim() || undefined,
        overschrijving: wasAfgeleid ? true : undefined
      });
      if (!r.ok) setFout(r.fout);
      else onKlaar();
    });
  }

  return (
    <form className="formulier inlineFormulier" onSubmit={verzend}>
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      {wasAfgeleid ? <Melding soort="waarschuwing">U overschrijft een afgeleide waarde ({waardeTekst(huidig.waarde)}, bron {huidig.bron}). De overschrijving wordt zichtbaar gemarkeerd en gelogd.</Melding> : null}
      <div className="rij">
        <div className="veld">
          Waarde ({factor.schaal.soort})
          <FactorWaardeVeld factor={factor} waarde={waarde} onChange={setWaarde} />
        </div>
        <label>
          Bron
          <select
            value={bron}
            onChange={(e) => {
              const b = e.target.value as Bron;
              setBron(b);
              setBetrouwbaarheid(BRON_BETROUWBAARHEID[b]);
            }}
          >
            {BRONNEN.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <label>
          Betrouwbaarheid: {Math.round(betrouwbaarheid * 100)}%
          <input type="range" min={0} max={1} step={0.05} value={betrouwbaarheid} onChange={(e) => setBetrouwbaarheid(Number(e.target.value))} />
        </label>
      </div>
      <label>
        Toelichting
        <textarea value={toelichting} onChange={(e) => setToelichting(e.target.value)} />
      </label>
      <div className="formulierActies">
        <button type="submit" className="knop klein" disabled={bezig}>
          {bezig ? "Opslaan…" : "Opslaan"}
        </button>
        <button type="button" className="knop knop-secundair klein" onClick={onAnnuleer}>
          Annuleren
        </button>
      </div>
    </form>
  );
}

function ToevoegFormulier({ partnerId, rollen, factoren, onKlaar }: { partnerId: string; rollen: Rol[]; factoren: Factor[]; onKlaar: () => void }) {
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const keuze = useMemo(
    () => factoren.filter((f) => f.actief && !f.afgeleid && (f.rollen.length === 0 || f.rollen.some((r) => rollen.includes(r)))).sort((a, b) => a.code.localeCompare(b.code)),
    [factoren, rollen]
  );
  const [factorId, setFactorId] = useState(keuze[0]?.id ?? "");
  const factor = keuze.find((f) => f.id === factorId);
  const [optieId, setOptieId] = useState<string>("");
  const [waarde, setWaarde] = useState<FactorWaarde>(factor ? standaardWaarde(factor) : 0);
  const [bron, setBron] = useState<Bron>("opgave");
  const [betrouwbaarheid, setBetrouwbaarheid] = useState(BRON_BETROUWBAARHEID.opgave);
  const [toelichting, setToelichting] = useState("");

  const metOpties = !!factor?.opties?.length && factor.schaal.soort !== "keuze";

  function kiesFactor(id: string) {
    setFactorId(id);
    const f = keuze.find((x) => x.id === id);
    setOptieId("");
    if (f) setWaarde(standaardWaarde(f));
  }

  function verzend(e: React.FormEvent) {
    e.preventDefault();
    setFout(null);
    if (!factor) return;
    if (metOpties && !optieId) {
      setFout("Kies een optie uit de waardenlijst.");
      return;
    }
    start(async () => {
      const r = await slaPartnerFactorOp(partnerId, { factorId: factor.id, optieId: metOpties ? optieId : undefined, waarde, bron, betrouwbaarheid, toelichting: toelichting.trim() || undefined });
      if (!r.ok) setFout(r.fout);
      else onKlaar();
    });
  }

  if (!factor) return <p className="muted">Geen invulbare factoren voor de rollen van deze partner.</p>;

  return (
    <form className="formulier inlineFormulier" onSubmit={verzend} style={{ marginBottom: 20 }}>
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      <div className="rij">
        <label>
          Factor
          <select value={factorId} onChange={(e) => kiesFactor(e.target.value)}>
            {keuze.map((f) => (
              <option key={f.id} value={f.id}>
                {f.code} {f.naam}
              </option>
            ))}
          </select>
        </label>
        {metOpties ? (
          <label>
            Optie
            <select value={optieId} onChange={(e) => setOptieId(e.target.value)} required>
              <option value="">– kies –</option>
              {factor.opties?.filter((o) => o.actief).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="veld">
          Waarde ({factor.schaal.soort})
          <FactorWaardeVeld factor={factor} waarde={waarde} onChange={setWaarde} />
        </div>
      </div>
      <p className="muted klein-tekst" style={{ margin: 0 }}>{factor.omschrijving}</p>
      <div className="rij">
        <label>
          Bron
          <select
            value={bron}
            onChange={(e) => {
              const b = e.target.value as Bron;
              setBron(b);
              setBetrouwbaarheid(BRON_BETROUWBAARHEID[b]);
            }}
          >
            {BRONNEN.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <label>
          Betrouwbaarheid: {Math.round(betrouwbaarheid * 100)}%
          <input type="range" min={0} max={1} step={0.05} value={betrouwbaarheid} onChange={(e) => setBetrouwbaarheid(Number(e.target.value))} />
        </label>
        <label>
          Toelichting
          <input value={toelichting} onChange={(e) => setToelichting(e.target.value)} />
        </label>
      </div>
      <div className="formulierActies">
        <button type="submit" className="knop klein" disabled={bezig}>
          {bezig ? "Opslaan…" : "Waarde vastleggen"}
        </button>
      </div>
    </form>
  );
}
