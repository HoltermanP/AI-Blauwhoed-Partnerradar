// Zoeken: klassiek zoeken (US-15, semantisch zonder AI) en de AI-chat (B5) naast elkaar op één pagina, met de keuze
// alleen database of database + internet; US-39 snelle filters die doorlinken naar /partners.
import Link from "next/link";
import { Suspense } from "react";
import ZoekWerkblad from "@/components/zoeken/ZoekWerkblad";
import { GeenMatchadvies } from "@/components/chat/ChatPaneel";
import { Badge, HerkomstRegel, Kaart, Leeg, Melding, PaginaKop, ScoreBalk, StatusBadge } from "@/components/ui";
import { basisveldHerkomst } from "@/lib/domain/herkomst";
import { zichtbaar } from "@/lib/domain/zichtbaarheid";
import { tokens } from "@/lib/domain/embedding";
import { semantischZoeken } from "@/lib/domain/matching";
import { ROLLEN, type CertificaatType, type Partner, type PartnerStatus } from "@/lib/domain/types";
import { ROL_LABEL, STATUS_LABEL } from "@/lib/format";
import { zoekUrls } from "@/lib/domain/webzoek";
import { getDb } from "@/lib/store";
import { aiAan } from "@/lib/aiplatform";

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
      <h3>
        <span className="badge badge-geel">Internet</span> Van internet <span className="muted klein-tekst">— indicatief, niet gevalideerd</span>
      </h3>
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
  const { q = "", web, vraag } = await searchParams;
  const db = await getDb();
  const internetMogelijk = db.instellingen.externeBronnenToegestaan;
  const metInternet = web === "1" && internetMogelijk;
  const resultaten = q.trim() ? semantischZoeken(db, q, 60) : [];
  const structureelAantal = resultaten.filter((r) => r.structureel).length;

  const lokaal = q.trim() ? (
    <>
      <h3>
        <span className="badge badge-blauw">Database</span> Uit het partnerbestand
      </h3>
      {resultaten.length ? (
        <>
          <Melding soort="info">
            {structureelAantal > 0
              ? `${structureelAantal} partner(s) met dit kenmerk (bovenaan), plus ${resultaten.length - structureelAantal} tekstmatch(es).`
              : `${resultaten.length} relevante partner(s) uit de database, op tekstgelijkenis.`}
          </Melding>
          <GeenMatchadvies />
          {resultaten.map((r, i) => (
            <div key={r.partner.id} className="kandidaatRij">
              <span className="rang">{i + 1}</span>
              <div>
                <h3>
                  <Link href={`/partners/${r.partner.id}`}>{r.partner.naam}</Link> <StatusBadge status={r.partner.status} />
                  {r.structureel ? <Badge kleur="blauw" titel="Heeft het gevraagde kenmerk aantoonbaar (uit vastgelegde gegevens of projecthistorie)">kenmerk-match</Badge> : null}
                </h3>
                <p className="muted">
                  {r.partner.rollen.map((rol) => ROL_LABEL[rol]).join(", ")} · {r.partner.vestigingsplaats}
                </p>
                <div>
                  {r.treffers.map((t) => (
                    <Badge key={t} kleur="mint" titel="treffer op kenmerk of tekst">
                      {t}
                    </Badge>
                  ))}
                  {!r.treffers.length ? <span className="muted">gelijkenis zonder letterlijke woordtreffers</span> : null}
                </div>
                {besteZin(r.partner, r.treffers) ? <blockquote className="zoekCitaat">{besteZin(r.partner, r.treffers)}</blockquote> : null}
                <HerkomstSamenvatting p={r.partner} />
              </div>
              <ScoreBalk score={r.score} label="Relevantie" />
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
        titel="Chat en zoeken"
        intro={
          <>
            Stel uw vraag aan de AI-chat; die doorzoekt de database en desgewenst internet en noemt altijd de bronnen. Klassiek zoeken staat ernaast als filter. Gecombineerd filteren kan op de <Link href="/partners">partnerspagina</Link>.
          </>
        }
      />

      <ZoekWerkblad q={q} web={metInternet} internetMogelijk={internetMogelijk} aiActief={aiAan()} resultaten={lokaal} beginVraag={vraag} />

      <Kaart titel="Snelle filters" acties={<Link href="/partners">Alle filters</Link>}>
        <div className="snelleFilters">
          <div>
            <h4>Rol</h4>
            {ROLLEN.map((r) => ({ r, n: db.partners.filter((p) => zichtbaar(p) && p.rollen.includes(r)).length }))
              .filter(({ n }) => n > 0)
              .map(({ r, n }) => (
                <Link key={r} href={`/partners?rol=${r}`} className="chip">
                  {ROL_LABEL[r]} <b>{n}</b>
                </Link>
              ))}
          </div>
          <div>
            <h4>Status</h4>
            {STATUSSEN.map((s) => ({ s, n: db.partners.filter((p) => p.status === s).length }))
              .filter(({ n }) => n > 0)
              .map(({ s, n }) => (
                <Link key={s} href={`/partners?status=${s}`} className="chip">
                  {STATUS_LABEL[s]} <b>{n}</b>
                </Link>
              ))}
          </div>
          <div>
            <h4>Certificaat</h4>
            {CERTIFICATEN.map((c) => ({ c, n: db.partners.filter((p) => zichtbaar(p) && p.certificaten.some((x) => x.type === c)).length }))
              .filter(({ n }) => n > 0)
              .map(({ c, n }) => (
                <Link key={c} href={`/partners?cert=${encodeURIComponent(c)}`} className="chip">
                  {c} <b>{n}</b>
                </Link>
              ))}
          </div>
        </div>
        <p className="muted klein-tekst" style={{ marginTop: 8 }}>
          Zoeken op afstand van een plaats: via de <Link href="/kaart">kaart</Link> of het regiofilter (plaats + straal) op de <Link href="/partners">partnerspagina</Link>.
        </p>
      </Kaart>
    </>
  );
}
