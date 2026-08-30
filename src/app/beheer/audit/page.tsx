// US-46: auditlog met filters en paginering.
import Link from "next/link";
import { getDb } from "@/lib/store";
import { datumTijd } from "@/lib/format";
import { Badge, Kaart, Leeg, PaginaKop } from "@/components/ui";

const PER_PAGINA = 50;
const PARTNER_ENTITEITEN = ["partner", "partner_factor", "certificaat", "contactpersoon", "kwalificatie", "financieel", "beschikbaarheid", "status"];
const PROJECT_ENTITEITEN = ["project", "project_eisen", "matchrun", "match_run", "team", "teamvoorstel", "evaluatie", "engagement", "feedback", "match_feedback"];

function entiteitLink(entiteit: string, id: string, partnerIds: Set<string>, projectIds: Set<string>) {
  const e = entiteit.toLowerCase();
  if (partnerIds.has(id) || (PARTNER_ENTITEITEN.includes(e) && partnerIds.has(id))) return `/partners/${id}`;
  if (projectIds.has(id) || (PROJECT_ENTITEITEN.includes(e) && projectIds.has(id))) return `/projecten/${id}`;
  if (e === "factor" || e === "factor_option") return "/beheer/factoren";
  if (e === "gewichtsprofiel") return `/beheer/gewichten?profiel=${id}`;
  if (e === "instellingen") return "/beheer";
  return null;
}

export default async function AuditPagina({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const db = await getDb();
  const entiteit = sp.entiteit ?? "";
  const door = sp.door ?? "";
  const q = (sp.q ?? "").trim().toLowerCase();
  const pagina = Math.max(1, Number(sp.p ?? "1") || 1);

  const partnerIds = new Set(db.partners.map((p) => p.id));
  const projectIds = new Set(db.projecten.map((p) => p.id));
  const entiteiten = Array.from(new Set(db.audit.map((a) => a.entiteit))).sort();
  const gebruikers = Array.from(new Set(db.audit.map((a) => a.door))).sort();

  const gefilterd = db.audit.filter(
    (a) => (!entiteit || a.entiteit === entiteit) && (!door || a.door === door) && (!q || `${a.entiteit} ${a.entiteitId} ${a.actie} ${a.details ?? ""} ${a.door}`.toLowerCase().includes(q))
  );
  const paginas = Math.max(1, Math.ceil(gefilterd.length / PER_PAGINA));
  const huidige = Math.min(pagina, paginas);
  const rijen = gefilterd.slice((huidige - 1) * PER_PAGINA, huidige * PER_PAGINA);
  const url = (p: number) => {
    const s = new URLSearchParams();
    if (entiteit) s.set("entiteit", entiteit);
    if (door) s.set("door", door);
    if (q) s.set("q", sp.q ?? "");
    if (p > 1) s.set("p", String(p));
    const t = s.toString();
    return t ? `/beheer/audit?${t}` : "/beheer/audit";
  };
  const naamVan = (id: string) => db.partners.find((p) => p.id === id)?.naam ?? db.projecten.find((p) => p.id === id)?.naam ?? null;

  return (
    <>
      <PaginaKop eyebrow="Beheer" titel="Auditlog" intro="Elke wijziging aan partnergegevens, projecten en scoringsregels, met wie, wanneer en wat. Meest recente eerst." />
      <form className="formulier" method="get" action="/beheer/audit" style={{ marginBottom: 16 }}>
        <div className="rij">
          <label>
            Entiteit
            <select name="entiteit" defaultValue={entiteit}>
              <option value="">Alle</option>
              {entiteiten.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </label>
          <label>
            Door
            <select name="door" defaultValue={door}>
              <option value="">Iedereen</option>
              {gebruikers.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </label>
          <label>
            Zoektekst
            <input name="q" defaultValue={sp.q ?? ""} placeholder="id, actie, details…" />
          </label>
          <div className="formulierActies" style={{ alignSelf: "end" }}>
            <button type="submit" className="knop klein">Filteren</button>
            <Link href="/beheer/audit" className="knop knop-tekst klein">Wissen</Link>
          </div>
        </div>
      </form>

      <Kaart titel={`${gefilterd.length} regels`} acties={<span className="muted klein-tekst">Pagina {huidige} van {paginas}</span>}>
        {rijen.length === 0 ? (
          <Leeg titel="Geen auditregels" tekst="Pas de filters aan." />
        ) : (
          <div className="tabelWrap">
            <table className="tabel auditTabel">
              <thead>
                <tr>
                  <th>Tijd</th>
                  <th>Door</th>
                  <th>Entiteit</th>
                  <th>Id</th>
                  <th>Actie</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {rijen.map((a) => {
                  const href = entiteitLink(a.entiteit, a.entiteitId, partnerIds, projectIds);
                  const naam = naamVan(a.entiteitId);
                  return (
                    <tr key={a.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{datumTijd(a.op)}</td>
                      <td>{a.door} <Badge>{a.gebruikersrol}</Badge></td>
                      <td><Link href={url(1).includes("?") ? `${url(1)}&entiteit=${a.entiteit}` : `/beheer/audit?entiteit=${a.entiteit}`}>{a.entiteit}</Link></td>
                      <td className="klein-tekst">{href ? <Link href={href}>{naam ?? a.entiteitId}</Link> : a.entiteitId}{naam ? <div className="muted">{a.entiteitId}</div> : null}</td>
                      <td>{a.actie}</td>
                      <td className="klein-tekst muted">{a.details ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {paginas > 1 ? (
          <nav className="paginering" aria-label="Paginering">
            {huidige > 1 ? <Link href={url(huidige - 1)} className="knop knop-secundair klein">Vorige</Link> : null}
            <span className="muted klein-tekst">{(huidige - 1) * PER_PAGINA + 1}–{Math.min(huidige * PER_PAGINA, gefilterd.length)} van {gefilterd.length}</span>
            {huidige < paginas ? <Link href={url(huidige + 1)} className="knop knop-secundair klein">Volgende</Link> : null}
          </nav>
        ) : null}
      </Kaart>
    </>
  );
}
