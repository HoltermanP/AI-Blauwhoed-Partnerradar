"use client";
// US-18: engagement (betrokken partner, rol, contractwaarde, periode) vastleggen bij een project.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { slaEngagementOp } from "@/lib/actions";
import type { FactorOption, Rol } from "@/lib/domain/types";
import { ROLLEN } from "@/lib/domain/types";
import { ROL_LABEL } from "@/lib/format";
import { Melding } from "@/components/ui";

export default function EngagementFormulier({ projectId, partners, bouwsystemen }: { projectId: string; partners: Array<{ id: string; naam: string; rollen: Rol[] }>; bouwsystemen: FactorOption[] }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ partnerId: "", rol: "aannemer" as Rol, van: "", tot: "", contractwaarde: "", ramingBijStart: "", eindafrekening: "", geplandeOplevering: "", werkelijkeOplevering: "", bouwsysteem: "" });
  const zet = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

  function opslaan(e: React.FormEvent) {
    e.preventDefault();
    setFout(null);
    if (!f.partnerId) return setFout("Kies een partner.");
    if (!f.van) return setFout("Startdatum is verplicht.");
    start(async () => {
      const r = await slaEngagementOp({ partnerId: f.partnerId, projectId, rol: f.rol, van: f.van, tot: f.tot || undefined, contractwaarde: num(f.contractwaarde) ?? 0, ramingBijStart: num(f.ramingBijStart), eindafrekening: num(f.eindafrekening), geplandeOplevering: f.geplandeOplevering || undefined, werkelijkeOplevering: f.werkelijkeOplevering || undefined, bouwsysteem: f.bouwsysteem || undefined });
      if (!r.ok) return setFout(r.fout);
      setOpen(false);
      setF({ partnerId: "", rol: "aannemer", van: "", tot: "", contractwaarde: "", ramingBijStart: "", eindafrekening: "", geplandeOplevering: "", werkelijkeOplevering: "", bouwsysteem: "" });
      router.refresh();
    });
  }

  if (!open)
    return (
      <button type="button" className="knop knop-secundair klein" onClick={() => setOpen(true)}>
        Engagement toevoegen
      </button>
    );

  return (
    <form className="formulier" onSubmit={opslaan} style={{ marginTop: 12 }}>
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      <div className="rij">
        <label>
          Partner
          <select value={f.partnerId} onChange={(e) => zet("partnerId", e.target.value)} required>
            <option value="">– kies –</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.naam} ({p.rollen.map((r) => ROL_LABEL[r]).join(", ")})
              </option>
            ))}
          </select>
        </label>
        <label>
          Rol
          <select value={f.rol} onChange={(e) => zet("rol", e.target.value)}>
            {ROLLEN.map((r) => (
              <option key={r} value={r}>
                {ROL_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Bouwsysteem
          <select value={f.bouwsysteem} onChange={(e) => zet("bouwsysteem", e.target.value)}>
            <option value="">– n.v.t. –</option>
            {bouwsystemen.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="rij">
        <label>
          Van
          <input type="date" value={f.van} onChange={(e) => zet("van", e.target.value)} required />
        </label>
        <label>
          Tot
          <input type="date" value={f.tot} onChange={(e) => zet("tot", e.target.value)} />
        </label>
        <label>
          Geplande oplevering
          <input type="date" value={f.geplandeOplevering} onChange={(e) => zet("geplandeOplevering", e.target.value)} />
        </label>
        <label>
          Werkelijke oplevering
          <input type="date" value={f.werkelijkeOplevering} onChange={(e) => zet("werkelijkeOplevering", e.target.value)} />
        </label>
      </div>
      <div className="rij">
        <label>
          Contractwaarde (€)
          <input type="number" min={0} value={f.contractwaarde} onChange={(e) => zet("contractwaarde", e.target.value)} required />
        </label>
        <label>
          Raming bij start (€)
          <input type="number" min={0} value={f.ramingBijStart} onChange={(e) => zet("ramingBijStart", e.target.value)} />
        </label>
        <label>
          Eindafrekening (€)
          <input type="number" min={0} value={f.eindafrekening} onChange={(e) => zet("eindafrekening", e.target.value)} />
        </label>
      </div>
      <div className="formulierActies">
        <button type="submit" className="knop" disabled={bezig}>
          {bezig ? "Opslaan…" : "Engagement opslaan"}
        </button>
        <button type="button" className="knop knop-tekst" onClick={() => setOpen(false)}>
          Annuleren
        </button>
      </div>
    </form>
  );
}
