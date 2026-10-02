// Zoeken: klassiek zoeken (US-15, semantisch zonder AI) en de AI-chat (B5) naast elkaar op één pagina, met de keuze
// alleen database of database + internet; US-39 snelle filters die doorlinken naar /partners.
import Link from "next/link";
import { Suspense } from "react";
import ZoekWerkblad from "@/components/zoeken/ZoekWerkblad";
import { Badge, HerkomstRegel, Kaart, Leeg, Melding, PaginaKop, ScoreBalk, StatusBadge } from "@/components/ui";
import { basisveldHerkomst } from "@/lib/domain/herkomst";
import { zichtbaar } from "@/lib/domain/zichtbaarheid";
import { tokens } from "@/lib/domain/embedding";
import { semantischZoeken } from "@/lib/domain/matching";
import { ROLLEN, type CertificaatType, type Partner, type PartnerStatus } from "@/lib/domain/types";
import { ROL_LABEL, STATUS_LABEL } from "@/lib/format";
import { zoekUrls } from "@/lib/domain/webzoek";
import { getDb } from "@/lib/store";

export const maxDuration = 60;
const STATUSSEN: PartnerStatus[] = ["bekend", "preferred", "prospect", "afgewezen", "geblokkeerd", "gearchiveerd"];
const CERTIFICATEN: CertificaatType[] = ["ISO 9001", "ISO 14001", "VCA", "CO2-prestatieladder", "FSC", "PEFC", "BREEAM-expertise", "Woonkeur", "KOMO"];

/** US-51: bij elk resultaat de herkomst van het profiel (bron, datum, betrouwbaarheid, status) en de verhouding gevalideerd/voorgesteld. */
function HerkomstSamenvatting({ p }: { p: Partner }) {
  const h = basisveldHerkomst(p, "omschrijving");
  const waarden = p.factoren.filter((f) => !f.afgeleid);
  const gevalideerd = waarden.filter((f) => f.status === "gevalideerd").length;
  return (
    <p className="klein-tekst">
      <span className="muted">Profieltekst: </span>
      {h ? <HerkomstRegel bron={h.bron} detail={h.bronDetail} datum={h.vastgesteldOp} betrouwbaarheid={h.betrouwbaarheid} status={h.status} /> : <span className="muted">herkomst onbekend</span>}
      {waarden.length ? <span className="muted"> · {gevalideerd} van {waarden.length} kenmerken gevalideerd</span> : null}
    </p>
  );
}

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

/** Zoekresultaten van internet (zonder AI): alleen links met hun domein als bron, indicatief en apart van het partnerbestand. */
async function WebResultaten({ q }: { q: string }) {
  let urls: string[] = [];
  try {
    urls = await zoekUrls(q, 8);
  } catch {
    urls = [];
  }
  return (
    <div className="zoekWeb">
      <h3>Van internet <span className="muted klein-tekst">— indicatief, niet gevalideerd</span></h3>
      {urls.length ? (
        <ol className="klein-tekst">
          {urls.map((u) => (
            <li key={u}>
              <a href={u} target="_blank" rel="noreferrer">
                {u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
              </a>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted klein-tekst">Geen internetresultaten gevonden (de zoekmachine gaf niets terug of blokkeerde het verzoek).</p>
      )}
      <p className="muted klein-tekst">Bron: openbare zoekresultaten (DuckDuckGo/Bing). Partijen die alleen op internet staan, zijn geen partners van Blauwhoed.</p>
    </div>
  );
}

export default async function ZoekenPagina({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { q = "", web } = await searchParams;
  const db = await getDb();
  const internetMogelijk = db.instellingen.externeBronnenToegestaan;
  const metInternet = web === "1" && internetMogelijk;
  const resultaten = q.trim() ? semantischZoeken(db, q) : [];

  const lokaal = q.trim() ? (
    <>
      <h3>Uit het partnerbestand</h3>
      {resultaten.length ? (
        <>
          <Melding soort="info">{resultaten.length} partner(s) met semantische gelijkenis. Dit is geen matchadvies: harde eisen (status, regio, certificaten, capaciteit) zijn hier niet getoetst.</Melding>
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
                <HerkomstSamenvatting p={r.partner} />
              </div>
              <ScoreBalk score={r.score} label="Semantische score" />
            </div>
          ))}
        </>
      ) : (
        <Leeg titel="Geen partners met gelijkenis" tekst="Probeer andere woorden of een van de voorbeelden." />
      )}
      {metInternet ? (
        <Suspense fallback={<p className="muted klein-tekst">Internet doorzoeken…</p>}>
          <WebResultaten q={q} />
        </Suspense>
      ) : null}
    </>
  ) : null;

  return (
    <>
      <PaginaKop
        eyebrow="Zoeken"
        titel="Zoeken in het partnerbestand"
        intro={
          <>
            Links klassiek zoeken op een vrije omschrijving, rechts een AI-chat die de database doorzoekt. Kies of daarbij ook internet wordt gebruikt; elk resultaat vermeldt zijn bron. Gecombineerd filteren kan op de <Link href="/partners">partnerspagina</Link>.
          </>
        }
      />

      <ZoekWerkblad q={q} web={metInternet} internetMogelijk={internetMogelijk} aiActief={Boolean(process.env.ANTHROPIC_API_KEY)} resultaten={lokaal} />

      <Kaart titel="Snelle filters">
        <p className="muted">Gecombineerde filters op rol, regio, kenmerk, certificaat en status staan op de partnerspagina.</p>
        <div className="snelleFilters">
          <div>
            <h4>Rol</h4>
            {ROLLEN.map((r) => (
              <Link key={r} href={`/partners?rol=${r}`} className="chip">
                {ROL_LABEL[r]} <b>{db.partners.filter((p) => zichtbaar(p) && p.rollen.includes(r)).length}</b>
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
                {c} <b>{db.partners.filter((p) => zichtbaar(p) && p.certificaten.some((x) => x.type === c)).length}</b>
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
