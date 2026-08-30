"use client";
// US-01, US-02, US-05: partner aanmaken/bewerken. KVK-dubbel wordt door de action geweigerd; de melding linkt naar de bestaande partner.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { slaPartnerOp, type PartnerInvoer } from "@/lib/actions";
import { ROLLEN, type Rol } from "@/lib/domain/types";
import { ROL_LABEL, hoofdletter } from "@/lib/format";
import { Melding } from "@/components/ui";

type Props = { id: string | null; begin?: Partial<PartnerInvoer>; plaatsen: string[] };

export default function PartnerFormulier({ id, begin, plaatsen }: Props) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const [naam, setNaam] = useState(begin?.naam ?? "");
  const [kvk, setKvk] = useState(begin?.kvk ?? "");
  const [rechtsvorm, setRechtsvorm] = useState(begin?.rechtsvorm ?? "B.V.");
  const [plaats, setPlaats] = useState(begin?.vestigingsplaats?.toLowerCase() ?? plaatsen[0] ?? "");
  const [adres, setAdres] = useState(begin?.adres ?? "");
  const [werkgebiedKm, setWerkgebiedKm] = useState(begin?.werkgebiedKm ?? 75);
  const [rollen, setRollen] = useState<Rol[]>(begin?.rollen ?? []);
  const [website, setWebsite] = useState(begin?.website ?? "");
  const [omschrijving, setOmschrijving] = useState(begin?.omschrijving ?? "");
  const [referenties, setReferenties] = useState((begin?.referenties ?? []).join("\n"));
  const [tags, setTags] = useState((begin?.tags ?? []).join(", "));
  const [omzet, setOmzet] = useState(begin?.omzet?.toString() ?? "");
  const [medewerkers, setMedewerkers] = useState(begin?.medewerkers?.toString() ?? "");
  const [maxProj, setMaxProj] = useState(begin?.maxGelijktijdigeProjecten?.toString() ?? "");
  const [omvMin, setOmvMin] = useState(begin?.typischeProjectomvang?.min.toString() ?? "");
  const [omvMax, setOmvMax] = useState(begin?.typischeProjectomvang?.max.toString() ?? "");

  const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

  function verzend(e: React.FormEvent) {
    e.preventDefault();
    setFout(null);
    if (!rollen.length) {
      setFout("Kies minimaal één rol.");
      return;
    }
    const invoer: PartnerInvoer = {
      naam: naam.trim(),
      kvk: kvk.trim(),
      rechtsvorm: rechtsvorm.trim(),
      vestigingsplaats: hoofdletter(plaats),
      adres: adres.trim() || undefined,
      werkgebiedKm: Number(werkgebiedKm),
      rollen,
      website: website.trim() || undefined,
      omschrijving: omschrijving.trim(),
      referenties: referenties.split("\n").map((r) => r.trim()).filter(Boolean),
      omzet: num(omzet),
      medewerkers: num(medewerkers),
      maxGelijktijdigeProjecten: num(maxProj),
      typischeProjectomvang: omvMin.trim() && omvMax.trim() ? { min: Number(omvMin), max: Number(omvMax) } : undefined,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean)
    };
    start(async () => {
      const r = await slaPartnerOp(id, invoer);
      if (!r.ok) {
        setFout(r.fout);
        return;
      }
      router.push(`/partners/${r.data ?? id}`);
      router.refresh();
    });
  }

  // KVK-dubbelfout bevat het id van de bestaande partner tussen haakjes.
  const dubbelId = fout?.startsWith("KVK") ? /\(([^)]+)\)\.?$/.exec(fout)?.[1] : undefined;

  return (
    <form className="formulier" onSubmit={verzend}>
      {fout ? (
        <Melding soort="fout">
          {fout} {dubbelId ? <Link href={`/partners/${dubbelId}`}>Open bestaande partner</Link> : null}
        </Melding>
      ) : null}
      <div className="rij">
        <label>
          Bedrijfsnaam
          <input required value={naam} onChange={(e) => setNaam(e.target.value)} />
        </label>
        <label>
          KVK-nummer (8 cijfers)
          <input required value={kvk} onChange={(e) => setKvk(e.target.value)} pattern="[0-9 ]{8,10}" />
        </label>
        <label>
          Rechtsvorm
          <input required value={rechtsvorm} onChange={(e) => setRechtsvorm(e.target.value)} />
        </label>
      </div>
      <div className="rij">
        <label>
          Vestigingsplaats
          <select value={plaats} onChange={(e) => setPlaats(e.target.value)}>
            {plaatsen.map((p) => (
              <option key={p} value={p}>
                {hoofdletter(p)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Adres
          <input value={adres} onChange={(e) => setAdres(e.target.value)} />
        </label>
        <label>
          Werkgebied (straal in km)
          <input type="number" min={1} max={500} required value={werkgebiedKm} onChange={(e) => setWerkgebiedKm(Number(e.target.value))} />
        </label>
        <label>
          Website
          <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
        </label>
      </div>
      <div className="veld">
        Rollen
        <div className="vinkjes">
          {ROLLEN.map((r) => (
            <label key={r}>
              <input type="checkbox" checked={rollen.includes(r)} onChange={(e) => setRollen(e.target.checked ? [...rollen, r] : rollen.filter((x) => x !== r))} />
              {ROL_LABEL[r]}
            </label>
          ))}
        </div>
      </div>
      <label>
        Omschrijving
        <textarea required value={omschrijving} onChange={(e) => setOmschrijving(e.target.value)} />
      </label>
      <label>
        Referentieprojecten (één per regel; voeden de semantische vergelijking)
        <textarea value={referenties} onChange={(e) => setReferenties(e.target.value)} />
      </label>
      <label>
        Tags (kommagescheiden)
        <input value={tags} onChange={(e) => setTags(e.target.value)} />
      </label>
      <h3>Capaciteitsindicatoren</h3>
      <div className="rij">
        <label>
          Jaaromzet (€)
          <input type="number" min={0} value={omzet} onChange={(e) => setOmzet(e.target.value)} />
        </label>
        <label>
          Medewerkers
          <input type="number" min={0} value={medewerkers} onChange={(e) => setMedewerkers(e.target.value)} />
        </label>
        <label>
          Max. gelijktijdige projecten
          <input type="number" min={0} value={maxProj} onChange={(e) => setMaxProj(e.target.value)} />
        </label>
        <label>
          Typische omvang min (woningen)
          <input type="number" min={0} value={omvMin} onChange={(e) => setOmvMin(e.target.value)} />
        </label>
        <label>
          Typische omvang max (woningen)
          <input type="number" min={0} value={omvMax} onChange={(e) => setOmvMax(e.target.value)} />
        </label>
      </div>
      <div className="formulierActies">
        <button type="submit" className="knop" disabled={bezig}>
          {bezig ? "Opslaan…" : id ? "Wijzigingen opslaan" : "Partner aanmaken"}
        </button>
        <Link href={id ? `/partners/${id}` : "/partners"} className="knop knop-secundair">
          Annuleren
        </Link>
      </div>
    </form>
  );
}
