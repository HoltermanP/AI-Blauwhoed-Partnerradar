// US-15 semantisch zoeken; US-39 snelle filters die doorlinken naar /partners.
import Link from "next/link";
import { Badge, Kaart, Leeg, Melding, PaginaKop, ScoreBalk, StatusBadge } from "@/components/ui";
import { tokens } from "@/lib/domain/embedding";
import { semantischZoeken } from "@/lib/domain/matching";
import { ROLLEN, type CertificaatType, type Partner, type PartnerStatus } from "@/lib/domain/types";
import { ROL_LABEL, STATUS_LABEL } from "@/lib/format";
import { getDb } from "@/lib/store";

const VOORBEELDEN = ["circulaire houtbouw met demontabele gevel", "hoogstedelijke woontoren", "transformatie monument", "zorgwonen met sterke planningsdiscipline"];
const STATUSSEN: PartnerStatus[] = ["bekend", "preferred", "prospect", "afgewezen", "geblokkeerd", "gearchiveerd"];
const CERTIFICATEN: CertificaatType[] = ["ISO 9001", "ISO 14001", "VCA", "CO2-prestatieladder", "FSC", "PEFC", "BREEAM-expertise", "Woonkeur", "KOMO"];

/** De zin uit omschrijving/referenties met de meeste semantische treffers. */
function besteZin(p: Partner, treffers: string[]) {
  const zinnen = [p.omschrijving, ...p.referenties].flatMap((t) => t.split(/(?<=[.!?])\s+/)).filter(Boolean);
  const set = new Set(treffers);
  let beste = "";
  let max = 0;
  zinnen.forEach((z) => {
    const n = tokens(z).filter((t) => set.has(t)).length;
    if (n > max) {
      max = n;
      beste = z;
    }
  });
  return beste;
}

export default async function ZoekenPagina({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { q = "" } = await searchParams;
  const db = await getDb();
  const resultaten = q.trim() ? semantischZoeken(db, q) : [];

  return (
    <>
      <PaginaKop eyebrow="Zoeken" titel="Semantisch zoeken" intro="Zoek partners op een vrije omschrijving. Semantische treffers staan los van harde criteria; gebruik de matching in een project voor het echte advies." />

      <Kaart titel="Vrije omschrijving (US-15)">
        <form className="formulier" method="get">
          <label>
            Waar zoek je naar?
            <input name="q" defaultValue={q} placeholder="bijv. circulaire houtbouw met demontabele gevel" />
          </label>
          <div className="formulierActies">
            <button className="knop" type="submit">
              Zoeken
            </button>
            <span className="muted">Voorbeelden:</span>
            {VOORBEELDEN.map((v) => (
              <Link key={v} href={`/zoeken?q=${encodeURIComponent(v)}`} className="chip">
                {v}
              </Link>
            ))}
          </div>
        </form>
        {q.trim() ? (
          resultaten.length ? (
            <>
              <Melding soort="info">
                {resultaten.length} partner(s) met semantische gelijkenis. Dit is geen matchadvies: harde eisen (status, regio, certificaten, capaciteit) zijn hier niet getoetst.
              </Melding>
              {resultaten.map((r, i) => (
                <div key={r.partner.id} className="kandidaatRij">
                  <span className="rang">{i + 1}</span>
                  <div>
                    <h3>
                      <Link href={`/partners/${r.partner.id}`}>{r.partner.naam}</Link> <StatusBadge status={r.partner.status} />
                    </h3>
                    <p className="muted">
                      {r.partner.rollen.map((rol) => ROL_LABEL[rol]).join(", ")} · {r.partner.vestigingsplaats}
                    </p>
                    <div>
                      {r.treffers.map((t) => (
                        <Badge key={t} kleur="mint" titel="semantische treffer">
                          {t}
                        </Badge>
                      ))}
                      {!r.treffers.length ? <span className="muted">gelijkenis zonder letterlijke woordtreffers</span> : null}
                    </div>
                    {besteZin(r.partner, r.treffers) ? <blockquote className="zoekCitaat">{besteZin(r.partner, r.treffers)}</blockquote> : null}
                  </div>
                  <ScoreBalk score={r.score} label="Semantische score" />
                </div>
              ))}
            </>
          ) : (
            <Leeg titel="Geen partners met gelijkenis" tekst="Probeer andere woorden of een van de voorbeelden." />
          )
        ) : null}
      </Kaart>

      <Kaart titel="Snelle filters (US-39)">
        <p className="muted">Gecombineerde filters op rol, regio, kenmerk, certificaat en status staan op de partnerspagina.</p>
        <div className="snelleFilters">
          <div>
            <h4>Rol</h4>
            {ROLLEN.map((r) => (
              <Link key={r} href={`/partners?rol=${r}`} className="chip">
                {ROL_LABEL[r]} <b>{db.partners.filter((p) => p.rollen.includes(r)).length}</b>
              </Link>
            ))}
          </div>
          <div>
            <h4>Status</h4>
            {STATUSSEN.map((s) => (
              <Link key={s} href={`/partners?status=${s}`} className="chip">
                {STATUS_LABEL[s]} <b>{db.partners.filter((p) => p.status === s).length}</b>
              </Link>
            ))}
          </div>
          <div>
            <h4>Certificaat</h4>
            {CERTIFICATEN.map((c) => (
              <Link key={c} href={`/partners?certificaat=${encodeURIComponent(c)}`} className="chip">
                {c} <b>{db.partners.filter((p) => p.certificaten.some((x) => x.type === c)).length}</b>
              </Link>
            ))}
          </div>
          <div>
            <h4>Regio</h4>
            {Array.from(new Set(db.projecten.map((p) => p.locatie.plaats))).map((plaats) => (
              <Link key={plaats} href={`/partners?plaats=${encodeURIComponent(plaats)}&straal=50`} className="chip">
                binnen 50 km van {plaats}
              </Link>
            ))}
          </div>
        </div>
      </Kaart>
    </>
  );
}
