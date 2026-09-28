// US-54: één vrijgavewachtrij voor alle concepten (AI-registratie, discovery en AI-aandraag). Alleen de beheerder geeft vrij;
// vrijgave en afwijzing komen in de auditlog.
import Link from "next/link";
import ConceptControle, { HERKOMST_LABEL } from "@/components/vrijgave/ConceptControle";
import { Badge, Kaart, Leeg, Melding, PaginaKop } from "@/components/ui";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { datumTijd } from "@/lib/format";
import { getDb } from "@/lib/store";

type Soort = keyof typeof HERKOMST_LABEL;

export default async function VrijgavePagina({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [db, gebruiker] = await Promise.all([getDb(), huidigeGebruiker()]);
  const magVrijgeven = heeftRecht(gebruiker.rol, "partners_vrijgeven");
  const alle = db.partners.filter((p) => p.status === "concept").sort((a, b) => (b.registratie?.op ?? b.aangemaaktOp).localeCompare(a.registratie?.op ?? a.aangemaaktOp));
  const soort = (Object.keys(HERKOMST_LABEL) as Soort[]).find((s) => s === sp.soort);
  const concepten = soort ? alle.filter((p) => (p.registratie?.herkomstSoort ?? "ai-registratie") === soort) : alle;
  const besluiten = db.audit.filter((a) => a.entiteit === "partner" && /^(concept|registratie) (vrijgegeven|afgewezen)/.test(a.actie)).slice(0, 12);
  return (
    <>
      <PaginaKop eyebrow="De mens beslist" titel="Vrijgave AI-voorstellen" intro="Door AI voorgestelde partners zijn concepten. Ze tellen pas mee in zoeken, filteren, matchen, verbanden, chat en export nadat een beheerder ze heeft vrijgegeven." />
      {!magVrijgeven ? <Melding soort="info">U kunt de wachtrij inzien; vrijgeven of afwijzen is voorbehouden aan de beheerder.</Melding> : null}
      <nav className="tabs" aria-label="Herkomst">
        <Link href="/vrijgave" className={!soort ? "active" : ""} scroll={false}>
          Alle<span>{alle.length}</span>
        </Link>
        {(Object.keys(HERKOMST_LABEL) as Soort[]).map((s) => (
          <Link key={s} href={`/vrijgave?soort=${s}`} className={soort === s ? "active" : ""} scroll={false}>
            {HERKOMST_LABEL[s]}
            <span>{alle.filter((p) => (p.registratie?.herkomstSoort ?? "ai-registratie") === s).length}</span>
          </Link>
        ))}
      </nav>
      {concepten.length ? concepten.map((p) => <ConceptControle key={p.id} p={p} magVrijgeven={magVrijgeven} compact />) : <Leeg titel="Geen concepten in de wachtrij" tekst="Nieuwe AI-voorstellen verschijnen hier (AI-registratie op Nieuwe partner, geaccepteerde discovery-kandidaten en AI-aandraag vanuit een zoekprofiel)." />}
      <Kaart titel="Recente besluiten" acties={<Link href="/beheer/audit">Volledige audit</Link>}>
        {besluiten.length ? (
          <ul className="lijst auditLijst">
            {besluiten.map((a) => (
              <li key={a.id}>
                <small className="muted">
                  {datumTijd(a.op)} · {a.door} <Badge>{a.gebruikersrol}</Badge>
                </small>
                <div>
                  <Link href={`/partners/${a.entiteitId}`}>{db.partners.find((p) => p.id === a.entiteitId)?.naam ?? a.entiteitId}</Link> — {a.actie}
                  {a.details ? <span className="muted"> · {a.details}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Nog geen besluiten.</p>
        )}
      </Kaart>
    </>
  );
}
