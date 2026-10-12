"use client";
// US-25: een project buiten de eigen portefeuille vastleggen uit een openbare bron. De app herkent partners die op de
// pagina worden genoemd; de gebruiker controleert en kiest de rollen. Levert samenwerkingssignalen op met bron.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { leesExternProject, slaExternProjectOp } from "@/lib/acties/externprojecten";
import { ROLLEN, type Rol } from "@/lib/domain/types";
import { ROL_LABEL } from "@/lib/format";
import { Melding } from "@/components/ui";

type P = { id: string; naam: string; rollen: Rol[] };

export default function ExternProjectFormulier({ partners }: { partners: P[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [naam, setNaam] = useState("");
  const [plaats, setPlaats] = useState("");
  const [jaar, setJaar] = useState(String(new Date().getFullYear() - 1));
  const [betrokken, setBetrokken] = useState<Array<{ partnerId: string; rol: Rol }>>([]);
  const [kies, setKies] = useState("");
  const [melding, setMelding] = useState<{ soort: "succes" | "fout" | "info"; tekst: string } | null>(null);
  const [bezig, start] = useTransition();
  const naamVan = (id: string) => partners.find((p) => p.id === id)?.naam ?? id;
  const voeg = (id: string) => {
    const p = partners.find((x) => x.id === id);
    if (!p || betrokken.some((b) => b.partnerId === id)) return;
    setBetrokken((b) => [...b, { partnerId: id, rol: p.rollen[0] ?? "adviseur" }]);
  };

  if (!open)
    return (
      <button type="button" className="knop knop-secundair klein" onClick={() => setOpen(true)}>
        Extern project toevoegen
      </button>
    );
  return (
    <div className="formulier">
      {melding ? <Melding soort={melding.soort}>{melding.tekst}</Melding> : null}
      <div className="formulierActies" style={{ alignItems: "stretch" }}>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… (projectpagina, persbericht of LinkedIn-bericht)" aria-label="Bron-URL" style={{ flex: 1, minWidth: 220 }} />
        <button
          type="button"
          className="knop knop-secundair klein"
          disabled={bezig || !url.trim()}
          onClick={() =>
            start(async () => {
              setMelding(null);
              const r = await leesExternProject(url.trim());
              if (!r.ok) return setMelding({ soort: "fout", tekst: r.fout });
              const d = r.data!;
              if (d.titel && !naam) setNaam(d.titel);
              d.genoemd.forEach((g) => voeg(g.id));
              setMelding({ soort: d.melding ? "info" : "succes", tekst: d.melding ?? `${d.genoemd.length} partner(s) herkend op de pagina; controleer ze en de rollen.` });
            })
          }
        >
          Bron lezen
        </button>
      </div>
      <div className="rij">
        <label>
          Projectnaam
          <input value={naam} onChange={(e) => setNaam(e.target.value)} />
        </label>
        <label>
          Plaats
          <input value={plaats} onChange={(e) => setPlaats(e.target.value)} />
        </label>
        <label>
          Jaar
          <input type="number" value={jaar} onChange={(e) => setJaar(e.target.value)} />
        </label>
      </div>
      <div className="veld">
        Betrokken partijen
        {betrokken.map((b, i) => (
          <div key={b.partnerId} className="formulierActies">
            <span style={{ minWidth: 180 }}>{naamVan(b.partnerId)}</span>
            <select value={b.rol} onChange={(e) => setBetrokken((x) => x.map((y, j) => (j === i ? { ...y, rol: e.target.value as Rol } : y)))} aria-label="Rol">
              {ROLLEN.map((r) => (
                <option key={r} value={r}>
                  {ROL_LABEL[r]}
                </option>
              ))}
            </select>
            <button type="button" className="knop knop-tekst klein" onClick={() => setBetrokken((x) => x.filter((_, j) => j !== i))}>
              Verwijderen
            </button>
          </div>
        ))}
        <div className="formulierActies">
          <select value={kies} onChange={(e) => setKies(e.target.value)} aria-label="Partner toevoegen">
            <option value="">Partner toevoegen…</option>
            {partners
              .filter((p) => !betrokken.some((b) => b.partnerId === p.id))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.naam}
                </option>
              ))}
          </select>
          <button type="button" className="knop knop-secundair klein" disabled={!kies} onClick={() => (voeg(kies), setKies(""))}>
            Toevoegen
          </button>
        </div>
      </div>
      <div className="formulierActies">
        <button
          type="button"
          className="knop klein"
          disabled={bezig || betrokken.length < 2 || !naam.trim() || !plaats.trim() || !url.trim()}
          onClick={() =>
            start(async () => {
              setMelding(null);
              const r = await slaExternProjectOp({ naam, plaats, jaar: Number(jaar), bronUrl: url.trim(), betrokkenen: betrokken });
              if (!r.ok) return setMelding({ soort: "fout", tekst: r.fout });
              setMelding({ soort: "succes", tekst: "Extern project vastgelegd; de samenwerkingen staan nu als signaal (met bron) in de verbanden." });
              setUrl("");
              setNaam("");
              setPlaats("");
              setBetrokken([]);
              router.refresh();
            })
          }
        >
          Extern project vastleggen
        </button>
        <button type="button" className="knop knop-tekst klein" onClick={() => setOpen(false)}>
          Sluiten
        </button>
        <span className="muted klein-tekst">Telt alleen als samenwerkingssignaal, niet als bewijs van eigen prestaties. Geen persoonsgegevens.</span>
      </div>
    </div>
  );
}
