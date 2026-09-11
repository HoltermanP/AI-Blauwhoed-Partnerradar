// PDF-dossier van één partner: profiel, factorwaarden met herkomst/status, certificaten, historie, documenten.
import { NextResponse } from "next/server";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { partnerDossierPdf } from "@/lib/domain/pdf";
import { getDb } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await huidigeGebruiker();
  if (!heeftRecht(g.rol, "lezen")) return NextResponse.json({ fout: "Geen leesrecht." }, { status: 403 });
  const { id } = await params;
  const db = await getDb();
  const p = db.partners.find((x) => x.id === id);
  if (!p) return NextResponse.json({ fout: "Partner niet gevonden." }, { status: 404 });
  const naam = p.naam.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return new NextResponse(new Uint8Array(partnerDossierPdf(p, db)), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="dossier-${naam}.pdf"` } });
}
