"use client";
// US-03 / US-19: factorwaarden per partner. Afgeleide waarden (bewijs) winnen van opgave; overschrijven kan bewust en zichtbaar.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { slaPartnerFactorOp, verifieerFactorwaarde, verwijderPartnerFactor } from "@/lib/actions";
import { herstelAfgewezen } from "@/lib/acties/waarden";
import WaardeAfwijzen from "./WaardeAfwijzen";
import { BRON_BETROUWBAARHEID, BRON_LABEL, BRONNEN as ALLE_BRONNEN, type Bron, type Factor, type FactorWaarde, type PartnerFactor, type Rol } from "@/lib/domain/types";
import { datum, waardeTekst } from "@/lib/format";
import { VASTSTELLING_UITLEG, VERIFICATIE_KLEUR, VERIFICATIE_LABEL, VERIFICATIE_WEGING, verificatieVan, WEGING_UITLEG } from "@/lib/domain/verificatie";
import { isIndicatief } from "@/lib/domain/herkomst";
import { Badge, BetrouwbaarheidBadge, BronLabel, Melding } from "@/components/ui";
import { FactorWaardeVeld, standaardWaarde } from "./FactorWaardeVeld";

// US-50: alle bronnen in rangorde; goudstandaard vastleggen is voorbehouden aan de beheerder (server controleert).
const BRONNEN: Bron[] = ALLE_BRONNEN;

type Props = {
  partnerId: string;
  rollen: Rol[];
  factoren: Factor[];
  effectief: PartnerFactor[];
  /** Handmatig vastgelegde waarden (partner.factoren). */
  handmatig: PartnerFactor[];
  magBewerken: boolean;
  /** Een beheerder kan ook waarden verifiëren die al door een gebruiker zijn geverifieerd. */
  beheerder?: boolean;
};

/** Verificatielabel per waarde: door beheerder, door gebruiker, niet geverifieerd, verouderd of berekend uit historie. */
function WaardeStatus({ pf, factor }: { pf: PartnerFactor; factor?: Factor }) {
  const v = verificatieVan(pf, factor);
  const weging = `Telt in de matching voor ${Math.round(VERIFICATIE_WEGING[v] * 100)}% mee.`;
  const titel =
    v === "beheerder" || v === "gebruiker"
      ? `Geverifieerd door ${pf.gevalideerdDoor ?? "?"} (${v}) op ${pf.gevalideerdOp ? datum(pf.gevalideerdOp) : "?"}. ${weging}`
      : v === "verouderd"
        ? `Ouder dan de vervaltermijn van dit veld, of door een mens vervallen verklaard. ${weging}`
        : v === "berekend"
          ? `Berekend uit projecthistorie en evaluaties; geen verificatie nodig. ${weging}`
          : `${v === "ingeschat" ? VASTSTELLING_UITLEG.ingeschat : VASTSTELLING_UITLEG.feitelijk} ${pf.automatisch ? "Automatisch ingevuld door de verrijking, nog" : "Nog"} niet door een gebruiker of beheerder bevestigd. ${weging}`;
  return (
    <Badge kleur={VERIFICATIE_KLEUR[v]} titel={titel}>
      {VERIFICATIE_LABEL[v]}
    </Badge>
  );
}

/** US-04: de bron met URL (klikbaar) en, bij een aangewezen bron, de naam ervan. */
function bewijsLink(pf: PartnerFactor) {
  if (!pf.bewijs) return <span className="muted">–</span>;
  if (pf.bewijs.soort === "project") return <Link href={`/projecten/${pf.bewijs.ref}`}>{pf.bewijs.label}</Link>;
  const url = /^https?:\/\//.test(pf.bewijs.ref) ? pf.bewijs.ref : null;
  const label = pf.bewijs.label && pf.bewijs.label !== pf.bewijs.ref ? pf.bewijs.label : url ? url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 48) : pf.bewijs.label;
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" title={url}>
      {label}
    </a>
  ) : (
    <span title={pf.bewijs.ref}>{label}</span>
  );
}

/** US-06: een correctie door een mens, met reden en de vorige (AI-)waarde. */
function CorrectieRegel({ pf }: { pf: PartnerFactor }) {
  if (!pf.correctie) return null;
  const c = pf.correctie;
  return (
    <div className="klein-tekst correctieRegel">
      Gecorrigeerd door {c.door} ({c.rol}) op {datum(c.op)}: {c.reden}
      {c.vorigeWaarde !== null ? <span className="muted"> · was {waardeTekst(c.vorigeWaarde)}{c.vorigeBron ? ` (${c.vorigeBron})` : ""}</span> : null}
    </div>
  );
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

export default function FactorenBeheer({ partnerId, rollen, factoren, effectief, handmatig, magBewerken, beheerder = false }: Props) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const [openRij, setOpenRij] = useState<string | null>(null);
  const [toonToevoegen, setToonToevoegen] = useState(false);

  const factorMap = useMemo(() => new Map(factoren.map((f) => [f.id, f])), [factoren]);
  const sleutel = (pf: PartnerFactor) => `${pf.factorId}::${pf.optieId ?? ""}`;
  const handmatigMap = useMemo(() => new Map(handmatig.map((pf) => [sleutel(pf), pf])), [handmatig]);

  const afgewezen = useMemo(() => handmatig.filter((pf) => pf.status === "afgewezen"), [handmatig]);

  function ruimOp(pf: PartnerFactor) {
    setFout(null);
    start(async () => {
      const r = await herstelAfgewezen({ partnerId, factorId: pf.factorId, optieId: pf.optieId });
      if (!r.ok) setFout(r.fout);
      else router.refresh();
    });
  }

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

  function verifieerWaarde(pf: PartnerFactor) {
    setFout(null);
    start(async () => {
      const r = await verifieerFactorwaarde(partnerId, pf.factorId, pf.optieId);
      if (!r.ok) setFout(r.fout);
      else router.refresh();
    });
  }

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
        Per waarde: de bron (met link), de ophaaldatum, de betrouwbaarheid en de status (voorstel, gebruikersgeverifieerd, beheerdersgeverifieerd of afgewezen). Bewijs boven zelfbeeld: waarden uit projecthistorie, evaluaties en certificaten (badge <Badge kleur="mint">afgeleid</Badge>) wegen zwaarder dan opgave of web. Een correctie legt u vast met reden; die gaat altijd voor op het AI-label.
      </p>
      <details className="uitklap klein-tekst">
        <summary>Hoe telt de betrouwbaarheid mee in de matching?</summary>
        {WEGING_UITLEG}
      </details>
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
                  <th>Status</th>
                  <th className="num">Betrouwb.</th>
                  <th>Opgehaald</th>
                  <th>Bron-URL / bewijs</th>
                  <th>Onderbouwing</th>
                  {magBewerken ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {rijen.map((pf) => {
                  const f = factorMap.get(pf.factorId);
                  const k = sleutel(pf);
                  const eigen = handmatigMap.get(k);
                  const open = openRij === k;
                  const verificatie = verificatieVan(pf, f);
                  const magVerifieren = Boolean(eigen) && (verificatie === "niet" || verificatie === "ingeschat" || verificatie === "verouderd" || (beheerder && verificatie === "gebruiker"));
                  // US-04: elke vastgelegde waarde kan worden afgewezen (een berekende waarde uit de historie niet).
                  const magAfwijzen = Boolean(eigen) && !pf.afgeleid;
                  return (
                    <RijMetFormulier key={k} open={open} kolommen={magBewerken ? 10 : 9} formulier={
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
                        {pf.aangepast ? <Badge kleur="grijs" titel="Bij acceptatie van het voorstel aangepast door de gebruiker">aangepast</Badge> : null}
                        <CorrectieRegel pf={pf} />
                      </td>
                      <td>
                        <BronLabel bron={pf.bron} /> {pf.afgeleid ? <Badge kleur="mint">afgeleid</Badge> : null} {pf.overschrijving ? <Badge kleur="geel">overschreven</Badge> : null}
                      </td>
                      <td><WaardeStatus pf={pf} factor={f} /></td>
                      <td className="num"><BetrouwbaarheidBadge waarde={pf.betrouwbaarheid} /> <small className="muted">{Math.round(pf.betrouwbaarheid * 100)}%</small></td>
                      <td>{datum(pf.peildatum)}</td>
                      <td>{bewijsLink(pf)}</td>
                      <td className="klein-tekst">
                        {pf.onderbouwing ? (
                          <>
                            <b>{pf.vaststelling === "ingeschat" ? "Inschatting" : "Onderbouwing"}:</b> {pf.onderbouwing}
                            <br />
                          </>
                        ) : null}
                        {pf.toelichting ?? ""}
                      </td>
                      {magBewerken ? (
                        <td style={{ whiteSpace: "nowrap" }}>
                          {magVerifieren ? (
                            <button type="button" className="knop knop-secundair klein" onClick={() => verifieerWaarde(pf)} disabled={bezig} title={`Bevestig deze waarde; het label wordt '${beheerder ? VERIFICATIE_LABEL.beheerder : VERIFICATIE_LABEL.gebruiker}'.`}>
                              Verifiëren
                            </button>
                          ) : null}
                          <button type="button" className="knop knop-tekst klein" onClick={() => setOpenRij(open ? null : k)} disabled={!f} title="Een andere waarde vastleggen, met reden; geldt boven het AI-label">
                            Corrigeren
                          </button>
                          {magAfwijzen ? <WaardeAfwijzen waarde={{ partnerId, factorId: pf.factorId, optieId: pf.optieId }} /> : null}
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
      {afgewezen.length ? (
        <div className="factorGroep">
          <h3>Afgewezen waarden ({afgewezen.length})</h3>
          <p className="muted klein-tekst">Tellen niet mee in matching, vullingsgraad en chat, en worden niet opnieuw automatisch ingevuld.</p>
          <div className="tabelWrap">
            <table className="tabel">
              <thead>
                <tr>
                  <th>Factor</th>
                  <th>Afgewezen waarde</th>
                  <th>Bron</th>
                  <th>Afgewezen door</th>
                  <th>Reden</th>
                  {magBewerken ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {afgewezen.map((pf) => {
                  const f = factorMap.get(pf.factorId);
                  return (
                    <tr key={sleutel(pf)}>
                      <td>
                        {f?.naam ?? pf.factorId}
                        {pf.optieId ? <span className="muted">: {f?.opties?.find((o) => o.id === pf.optieId)?.label ?? pf.optieId}</span> : null}
                      </td>
                      <td>
                        <s>{waardeMetLabel(f, pf)}</s> <Badge kleur="grijs">afgewezen</Badge>
                      </td>
                      <td>
                        <BronLabel bron={pf.bron} /> <span className="klein-tekst">{bewijsLink(pf)}</span>
                      </td>
                      <td className="klein-tekst">
                        {pf.afwijzing ? `${pf.afwijzing.door} (${pf.afwijzing.rol}), ${datum(pf.afwijzing.op)}` : "–"}
                      </td>
                      <td className="klein-tekst">{pf.afwijzing?.reden ?? "–"}</td>
                      {magBewerken ? (
                        <td>
                          <button type="button" className="knop knop-tekst klein" disabled={bezig} onClick={() => ruimOp(pf)} title="Verwijder deze afgewezen waarde uit het dossier">
                            Opruimen
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
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
  const [reden, setReden] = useState("");
  const wasAfgeleid = !!huidig.afgeleid || !!huidig.overschrijving;
  // US-06: een voorstel, automatisch ingevulde of indicatieve waarde corrigeren vraagt om een reden.
  const redenVerplicht = Boolean(bestaandHandmatig) && (bestaandHandmatig!.automatisch || bestaandHandmatig!.status !== "gevalideerd" || isIndicatief(bestaandHandmatig!.bron));

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
        overschrijving: wasAfgeleid ? true : undefined,
        reden: reden.trim() || undefined
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
                {BRON_LABEL[b]}
                {b === "goudstandaard" ? " (alleen beheerder)" : b === "web" ? " – indicatief" : ""}
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
        Reden van de correctie{redenVerplicht ? " (verplicht)" : ""}
        <input value={reden} onChange={(e) => setReden(e.target.value)} required={redenVerplicht} placeholder={redenVerplicht ? "Bijv. geen zorgwoningen in de portefeuille; label van AI klopt niet" : "Optioneel"} />
      </label>
      <label>
        Toelichting
        <textarea value={toelichting} onChange={(e) => setToelichting(e.target.value)} />
      </label>
      <div className="formulierActies">
        <button type="submit" className="knop klein" disabled={bezig || (redenVerplicht && !reden.trim())}>
          {bezig ? "Opslaan…" : "Correctie opslaan"}
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
                {BRON_LABEL[b]}
                {b === "goudstandaard" ? " (alleen beheerder)" : b === "web" ? " – indicatief" : ""}
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
