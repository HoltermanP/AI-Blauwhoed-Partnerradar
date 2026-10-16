// Factoren in gewone taal: wat een factor is, waarvoor de app factoren gebruikt (profiel, projecteisen, matching, filteren,
// verrijking), een rekenvoorbeeld en per factor wat hij betekent met een concreet voorbeeld. De technische rekenregels
// (harde drempels, gewichtsprofielen, betrouwbaarheid per bron) staan uitklapbaar onderaan. Beheren via /beheer/factoren.
import Link from "next/link";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { CATEGORIEEN } from "@/lib/domain/factors";
import { DEKKING_WAARSCHUWING } from "@/lib/domain/matching";
import type { Factor, Gewichtsprofiel, Rol } from "@/lib/domain/types";
import { BRON_BETROUWBAARHEID, ROLLEN } from "@/lib/domain/types";
import { bronRang, RANG_LABEL } from "@/lib/domain/herkomst";
import { ROL_LABEL, waardeTekst } from "@/lib/format";
import { CATEGORIE_UITLEG, FACTOR_UITLEG, NIVEAU_UITLEG } from "@/lib/domain/factoruitleg";
import { VASTSTELLING_UITLEG, VERIFICATIE_KLEUR, VERIFICATIE_LABEL, VERIFICATIE_WEGING } from "@/lib/domain/verificatie";
import type { Verificatie } from "@/lib/domain/types";
import { getDb } from "@/lib/store";
import { Badge, BronLabel, Definities, Kaart, Knop, PaginaKop } from "@/components/ui";

/** Hoe de waarde wordt vastgelegd, in gewone taal. */
function schaalTekst(f: Factor) {
  const s = f.schaal;
  switch (s.soort) {
    case "niveau":
      return f.opties?.length ? "Een niveau van 0 tot 5 per keuze hiernaast" : "Een niveau van 0 tot 5";
    case "getal":
      return `Een getal in ${s.eenheid} (${s.lagerIsBeter ? "lager is beter" : "hoger is beter"})`;
    case "percentage":
      return `Een percentage (${s.lagerIsBeter ? "lager is beter" : "hoger is beter"})`;
    case "bereik":
      return `Van … tot … ${s.eenheid}`;
    case "keuze":
      return s.meervoudig ? "Een of meer keuzes uit de lijst" : "Eén keuze uit de lijst";
    case "boolean":
      return "Ja of nee";
    case "tekst":
      return "Vrije tekst en referenties";
  }
}

/** Waarvoor de factor in de matching gebruikt wordt, in gewone taal. */
const TYPE_TEKST = {
  hard: { label: "Harde eis", uitleg: "Wie hier niet aan voldoet, valt af (met de reden erbij)." },
  gewogen: { label: "Telt mee in de score", uitleg: "Hoe beter de partner hierop scoort, hoe hoger de matchscore." },
  semantisch: { label: "Tekstvergelijking", uitleg: "De tekst wordt vergeleken met de projectomschrijving." }
} as const;

const TYPE_KLEUR = { hard: "rood", gewogen: "blauw", semantisch: "mint" } as const;

function drempelsUitProfielen(f: Factor, profielen: Gewichtsprofiel[]) {
  const regels: string[] = [];
  profielen.forEach((p) =>
    (Object.keys(p.perRol) as Rol[]).forEach((rol) => {
      p.perRol[rol]?.filter((e) => e.factorId === f.id).forEach((e) => {
        const optie = e.optieId ? f.opties?.find((o) => o.id === e.optieId)?.label : undefined;
        const richting = f.schaal.soort !== "niveau" && "lagerIsBeter" in f.schaal && f.schaal.lagerIsBeter ? "≤" : "≥";
        regels.push(`${p.naam} · ${ROL_LABEL[rol]}: ${optie ? `${optie} ` : ""}${richting} ${waardeTekst(e.gevraagd)} (${e.gewicht}%${e.minimumeis ? ", minimumeis" : ""})`);
      });
    })
  );
  return regels;
}

export default async function FactorenPagina() {
  const [db, gebruiker] = await Promise.all([getDb(), huidigeGebruiker()]);
  const actief = db.factoren.filter((f) => f.actief);
  const gebruikt = (f: Factor) => db.partners.filter((p) => p.factoren.some((x) => x.factorId === f.id)).length;

  return (
    <>
      <PaginaKop
        eyebrow="Factoren"
        titel="Waarop we partners beoordelen"
        intro="Een factor is één kenmerk van een partner waar Blauwhoed op let bij het kiezen van een bouwpartner, zoals ‘ervaring met houtbouw’, ‘op tijd opleveren’ of ‘CO₂-prestatieladder’. Hieronder lees je waarvoor de app factoren gebruikt en wat elke factor betekent."
        acties={heeftRecht(gebruiker.rol, "beheer") ? <Knop href="/beheer/factoren" variant="secundair">Factoren beheren</Knop> : null}
      />

      <div className="raster raster-2">
        <Kaart titel="Waarvoor gebruikt de app factoren?">
          <ol className="uitlegStappen">
            <li>
              <b>Het profiel van een partner vastleggen.</b> Per partner staat bij elke factor wat we weten, bijvoorbeeld &lsquo;houtbouw: niveau 4&rsquo; of &lsquo;MPG 0,48&rsquo;. Je vindt dit op een partner onder het tabblad <i>Factoren</i>.
            </li>
            <li>
              <b>Eisen van een project vastleggen.</b> Een project zegt per rol wat het vraagt (&lsquo;minimaal niveau 3 houtbouw&rsquo;) en hoe belangrijk dat is (een gewicht in procenten). Dat doe je bij <Link href="/projecten">Projecten</Link>.
            </li>
            <li>
              <b>Partners aan een project koppelen (matching).</b> De app legt de eisen naast de profielen, berekent een score van 0 tot 100 en schrijft erbij waarom een partner past.
            </li>
            <li>
              <b>Zoeken en filteren.</b> Op de <Link href="/partners">partnerspagina</Link> filter je op factoren, bijvoorbeeld alle aannemers met ervaring in houtbouw.
            </li>
            <li>
              <b>Het profiel aanvullen.</b> De <Link href="/verrijking">verrijking</Link> zoekt factorwaarden op websites, bij de KVK en in registers en vult ze in als &lsquo;niet geverifieerd&rsquo;, tot een collega ze bevestigt.
            </li>
          </ol>
        </Kaart>

        <Kaart titel="Voorbeeld: hoe een matchscore ontstaat">
          <p className="klein-tekst">
            Een project met 60 grondgebonden houten woningen zoekt een <b>aannemer</b>. Het project stelt drie eisen die meetellen in de score (samen 100%) en één harde eis.
          </p>
          <div className="tabelWrap">
            <table className="tabel klein-tekst">
              <thead>
                <tr>
                  <th>Factor</th>
                  <th>Project vraagt</th>
                  <th>Partner heeft</th>
                  <th>Uitkomst</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Houtbouw / CLT</td>
                  <td>minimaal niveau 3 · 50%</td>
                  <td>niveau 4, geverifieerd</td>
                  <td>voldoet volledig</td>
                </tr>
                <tr>
                  <td>Planningsbetrouwbaarheid</td>
                  <td>minimaal 80% op tijd · 30%</td>
                  <td>75%, uit projecthistorie</td>
                  <td>bijna</td>
                </tr>
                <tr>
                  <td>Aandeel biobased</td>
                  <td>minimaal 40% · 20%</td>
                  <td>50%, niet geverifieerd</td>
                  <td>voldoet, telt minder zwaar</td>
                </tr>
                <tr>
                  <td>Projectomvang</td>
                  <td>60 woningen (harde eis)</td>
                  <td>20–150 woningen</td>
                  <td>past, dus niet afgevallen</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="klein-tekst">
            Uitkomst: een hoge score, met de toelichting dat de partner sterk is in houtbouw, bijna altijd op tijd oplevert en dat het biobased-percentage nog geverifieerd moet worden. Had de partner alleen projecten van 200 woningen of meer gedaan, dan was hij afgevallen op projectomvang.
          </p>
        </Kaart>
      </div>

      <div className="raster raster-3">
        <Kaart titel="Drie soorten factoren">
          <Definities items={(Object.keys(TYPE_TEKST) as Array<keyof typeof TYPE_TEKST>).map((t) => [TYPE_TEKST[t].label, TYPE_TEKST[t].uitleg])} />
          <p className="muted klein-tekst">Ontbreekt een waarde, dan telt die factor niet als nul. Hij telt dan gewoon niet mee, en de kandidaat krijgt een melding dat de score op weinig gegevens rust.</p>
        </Kaart>
        <Kaart titel="Wat betekent een niveau van 0 tot 5?">
          <Definities items={NIVEAU_UITLEG.map(([n, t]) => [String(n), t])} />
        </Kaart>
        <Kaart titel="Hoe zeker is een waarde?">
          <p className="klein-tekst">Bij elke waarde staat waar die vandaan komt en of een collega haar heeft gecontroleerd. Een gecontroleerde waarde telt zwaarder mee in de matching.</p>
          <Definities items={(["beheerder", "gebruiker", "berekend", "niet", "ingeschat", "verouderd"] as Verificatie[]).map((v) => [VERIFICATIE_LABEL[v].charAt(0).toUpperCase() + VERIFICATIE_LABEL[v].slice(1), <Badge key={v} kleur={VERIFICATIE_KLEUR[v]}>telt voor {Math.round(VERIFICATIE_WEGING[v] * 100)}% mee</Badge>])} />
          <p className="muted klein-tekst">{VASTSTELLING_UITLEG.feitelijk} {VASTSTELLING_UITLEG.ingeschat}</p>
        </Kaart>
      </div>

      <h2 className="subkop">Alle factoren ({actief.length})</h2>
      {CATEGORIEEN.map((cat) => {
        const lijst = actief.filter((f) => f.categorie === cat);
        if (!lijst.length) return null;
        return (
          <Kaart key={cat} titel={cat}>
            {CATEGORIE_UITLEG[cat] ? <p className="muted">{CATEGORIE_UITLEG[cat]}</p> : null}
            <div className="tabelWrap">
              <table className="tabel factorUitlegTabel">
                <thead>
                  <tr>
                    <th>Factor</th>
                    <th>Wat betekent het?</th>
                    <th>Hoe vastgelegd</th>
                    <th>Gebruik in de matching</th>
                    <th className="num">Ingevuld bij</th>
                  </tr>
                </thead>
                <tbody>
                  {lijst.map((f) => {
                    const uitleg = FACTOR_UITLEG[f.id];
                    const drempels = drempelsUitProfielen(f, db.gewichtsprofielen);
                    return (
                      <tr key={f.id}>
                        <td>
                          <b>{f.naam}</b> <small className="muted">{f.code}</small>
                          <div className="klein-tekst muted">{f.rollen.length ? `Voor: ${f.rollen.map((r) => ROL_LABEL[r].toLowerCase()).join(", ")}` : "Voor alle rollen"}</div>
                        </td>
                        <td>
                          <div>{uitleg?.betekenis ?? f.omschrijving}</div>
                          {uitleg ? <div className="klein-tekst"><span className="muted">Voorbeeld: </span>{uitleg.voorbeeld}</div> : null}
                          {uitleg?.waarom ? <div className="klein-tekst muted">{uitleg.waarom}</div> : null}
                        </td>
                        <td className="klein-tekst">
                          {schaalTekst(f)}
                          {f.opties?.length ? <div>{f.opties.filter((o) => o.actief).map((o) => <span key={o.id} className="chip">{o.label}</span>)}</div> : null}
                          {f.afgeleid ? <div><Badge kleur="mint">berekend uit projecthistorie</Badge></div> : null}
                        </td>
                        <td className="klein-tekst">
                          <Badge kleur={TYPE_KLEUR[f.type]}>{TYPE_TEKST[f.type].label}</Badge>
                          {drempels.length ? (
                            <details className="uitklap">
                              <summary>Standaardeisen ({drempels.length})</summary>
                              <ul className="lijst">
                                {drempels.map((d) => (
                                  <li key={d}>{d}</li>
                                ))}
                              </ul>
                            </details>
                          ) : null}
                        </td>
                        <td className="num">
                          <Link href={`/partners?k=${f.id}::`} title="Bekijk de partners met een waarde voor deze factor">{gebruikt(f)} partners</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Kaart>
        );
      })}

      <details className="uitklap rekenregels">
        <summary>Alle rekenregels en grenswaarden (voor beheerders)</summary>
      <div className="raster raster-2">
        <Kaart titel="Grenswaarden die de app hanteert">
          <Definities
            items={[
              ["Werkgebied", "Projectlocatie buiten de straal (km) van de partner → uitsluiting"],
              ["Projectomvang", "Buiten de bandbreedte: historie 0,5× kleinste – 2× grootste gerealiseerde omvang, opgave 0,5×–1,5× typische omvang (samengevoegd) → uitsluiting"],
              ["Gelijktijdige projecten", "Lopende projecten ≥ maximum gelijktijdig → uitsluiting"],
              ["Beschikbaarheid", "Periode 'niet beschikbaar' overlapt de projectplanning → uitsluiting"],
              ["Financieel risico", "Risicoklasse 'hoog' → uitsluiting; 'midden' → waarschuwing"],
              ["Status", "Geblokkeerd (tot einddatum) of afgewezen → uitsluiting; prospect → apart, nooit in het advies"],
              ["Certificaten", "Verlopen certificaat telt niet mee in de score; binnen 90 dagen verlopen → waarschuwing"],
              ["Dekkingsgraad", `Onder ${DEKKING_WAARSCHUWING}% van het gewicht op bekende data → waarschuwing bij de kandidaat; ontbrekende factoren tellen niet als 0 maar worden herverdeeld`],
              ["Afhankelijkheid", "Blauwhoed ≥ 30% van de jaaromzet → waarschuwing, ≥ 50% → kritiek"],
              ["Onmisbaarheid", "Eén partner > 60% van de contractwaarde van een project → signaal"],
              ["Planningsbetrouwbaarheid", "Opgeleverd binnen 30 dagen na de geplande datum telt als 'op tijd'"],
              ["Recentheid", "Projecten ≤ 2 jaar wegen 100%, aflopend naar 40% bij 5 jaar, daarna 25%"],
              ["Semantiek", "Semantische gelijkenis weegt maximaal 40% van de eindscore, standaard 15–20%"],
              ["Weging", "Vuistregel: niet meer dan zes factoren boven 10%; gewichten per rol tellen op tot 100%"]
            ]}
          />
        </Kaart>
        <Kaart titel="Betrouwbaarheid per bron (bewijs boven zelfbeeld)">
          <div className="tabelWrap"><table className="tabel">
            <thead>
              <tr>
                <th>Bron</th>
                <th>Rang (art. 11.2)</th>
                <th className="num">Standaard betrouwbaarheid</th>
                <th>Effect op de score</th>
              </tr>
            </thead>
            <tbody>
              {(Object.entries(BRON_BETROUWBAARHEID) as Array<[string, number]>)
                .sort((a, b) => bronRang(a[0]) - bronRang(b[0]) || b[1] - a[1])
                .map(([bron, b]) => (
                  <tr key={bron}>
                    <td>
                      <BronLabel bron={bron} />
                    </td>
                    <td className="klein-tekst">{bronRang(bron)} · {RANG_LABEL[bronRang(bron)]}</td>
                    <td className="num">{Math.round(b * 100)}%</td>
                    <td className="muted klein-tekst">Fit wordt gedempt richting neutraal (50%) met factor {(0.5 + 0.5 * b).toFixed(2)}</td>
                  </tr>
                ))}
            </tbody>
          </table></div>
          <p className="muted klein-tekst" style={{ marginTop: 12 }}>
            Afgeleide waarden uit projecthistorie en evaluaties winnen van een opgave, tenzij een beheerder de waarde expliciet overschrijft. Risicoklasse volgt uit kerncijfers: omzetdaling &gt; 20%, solvabiliteit &lt; 20/30%, deponering ouder dan 400 dagen, betalingsgedrag en negatief eigen vermogen tellen punten; ≥ 4 punten = hoog, ≥ 2 = midden.
          </p>
        </Kaart>
      </div>

      </details>

      <p className="muted klein-tekst">
        Rollen: {ROLLEN.map((r) => ROL_LABEL[r]).join(", ")}. Gewichtsprofielen en hun versies: <Link href="/beheer/gewichten">Beheer → Gewichten</Link>.
      </p>
    </>
  );
}
