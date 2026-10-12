// US-54: één vrijgavewachtrij voor alle concepten (AI-registratie, discovery en AI-aandraag). Alleen de beheerder geeft vrij;
// vrijgave en afwijzing komen in de auditlog.
import Link from "next/link";
import ConceptControle, { HERKOMST_LABEL } from "@/components/vrijgave/ConceptControle";
import { Badge, Kaart, Leeg, Melding, PaginaKop } from "@/components/ui";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { datumTijd } from "@/lib/format";
import { getDb } from "@/lib/store";
import { wachtOpBeheerder } from "@/lib/domain/datakwaliteit";
import { zichtbaar } from "@/lib/domain/zichtbaarheid";
import ValidatieWerklijst from "@/components/vrijgave/ValidatieWerklijst";
import EvaluatieAcceptatie from "@/components/projecten/EvaluatieAcceptatie";

type Soort = keyof typeof HERKOMST_LABEL;

export default async function VrijgavePagina({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [db, gebruiker] = await Promise.all([getDb(), huidigeGebruiker()]);
  const magVrijgeven = heeftRecht(gebruiker.rol, "partners_vrijgeven");
  const alle = db.partners.filter((p) => p.status === "concept").sort((a, b) => (b.registratie?.op ?? b.aangemaaktOp).localeCompare(a.registratie?.op ?? a.aangemaaktOp));
  const soort = (Object.keys(HERKOMST_LABEL) as Soort[]).find((s) => s === sp.soort);
  const concepten = soort ? alle.filter((p) => (p.registratie?.herkomstSoort ?? "ai-registratie") === soort) : alle;
  const besluiten = db.audit.filter((a) => a.entiteit === "partner" && /^(concept|registratie) (vrijgegeven|afgewezen|samengevoegd)/.test(a.actie)).slice(0, 12);
  const lijst = sp.lijst === "validatie" || sp.lijst === "evaluaties" ? sp.lijst : "concepten";
  const zichtbarePartners = db.partners.filter(zichtbaar);
  const validatie = wachtOpBeheerder(db, zichtbarePartners);
  const ingediend = db.evaluaties.filter((e) => e.status === "ingediend");
  const partnerKeuze = zichtbarePartners.map((p) => ({ id: p.id, naam: p.naam })).sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
  return (
    <>
      <PaginaKop eyebrow="De mens beslist" titel="Vrijgave en validatie" intro="Werklijsten voor de beheerder: concepten (nieuwe of gevonden partners) vrijgeven, afwijzen of samenvoegen; waarden van kritische velden definitief valideren; ingediende evaluaties accepteren. Concepten tellen pas mee in zoeken, matching, verbanden, chat en export na vrijgave." />
      {!magVrijgeven ? <Melding soort="info">U kunt de werklijsten inzien; vrijgeven, valideren en accepteren is voorbehouden aan de beheerder.</Melding> : null}
      <nav className="tabs" aria-label="Werklijst">
        <Link href="/vrijgave" className={lijst === "concepten" ? "active" : ""} scroll={false}>
          Concepten<span>{alle.length}</span>
        </Link>
        <Link href="/vrijgave?lijst=validatie" className={lijst === "validatie" ? "active" : ""} scroll={false}>
          Beheerdersvalidatie<span>{validatie.length}</span>
        </Link>
        <Link href="/vrijgave?lijst=evaluaties" className={lijst === "evaluaties" ? "active" : ""} scroll={false}>
          Evaluaties<span>{ingediend.length}</span>
        </Link>
      </nav>
      {lijst === "validatie" ? (
        <Kaart titel={`Wachten op beheerdersvalidatie (${validatie.length})`} acties={<Link href="/beheer/goudstandaard">Welke velden? (goudstandaard)</Link>}>
          <p className="muted klein-tekst">Waarden die een gebruiker heeft geverifieerd, van velden waarvoor per partnertype een tweede controle door een beheerder is ingesteld. Na validatie krijgt de waarde het label beheerdersgeverifieerd en telt ze volledig mee in de matching.</p>
          {validatie.length ? <ValidatieWerklijst items={validatie} magValideren={magVrijgeven} /> : <Leeg titel="Niets te valideren" tekst="Stel bij de goudstandaard per partnertype in welke velden een beheerdersverificatie nodig hebben." />}
        </Kaart>
      ) : null}
      {lijst === "evaluaties" ? (
        <Kaart titel={`Ingediende evaluaties (${ingediend.length})`} acties={<Link href="/evaluaties">Evaluatieoverzicht</Link>}>
          <p className="muted klein-tekst">Alleen geaccepteerde evaluaties tellen mee in de afgeleide factoren, de matching en de onderbouwing.</p>
          {ingediend.length ? <EvaluatieAcceptatie evaluaties={ingediend.map((e) => ({ ...e, partnerNaam: db.partners.find((p) => p.id === e.partnerId)?.naam ?? e.partnerId, projectNaam: db.projecten.find((p) => p.id === e.projectId)?.naam ?? e.projectId }))} magAccepteren={magVrijgeven} /> : <Leeg titel="Geen ingediende evaluaties" />}
        </Kaart>
      ) : null}
      {lijst === "concepten" ? (
      <>
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
      {concepten.length ? concepten.map((p) => <ConceptControle key={p.id} p={p} magVrijgeven={magVrijgeven} compact partners={partnerKeuze} />) : <Leeg titel="Geen concepten in de wachtrij" tekst="Nieuwe AI-voorstellen verschijnen hier (AI-registratie op Nieuwe partner, geaccepteerde discovery-kandidaten en AI-aandraag vanuit een zoekprofiel)." />}
      </>
      ) : null}
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
