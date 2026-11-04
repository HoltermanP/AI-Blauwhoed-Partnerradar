// CSV-export van de huidige weergave in de databaseverkenner (tabel, zoekopdracht, kolommen, sortering). Alleen beheerders.
import { NextResponse } from "next/server";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { bouwIndex, bouwTabellen, naarCsv, sorteer, standaardKolommen, zoekFilter } from "@/lib/domain/databaseverkenner";
import { getDb } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const g = await huidigeGebruiker();
  if (!heeftRecht(g.rol, "beheer")) return NextResponse.json({ fout: "Alleen voor beheerders." }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const tabellen = bouwTabellen(await getDb());
  const tabel = tabellen.find((t) => t.naam === params.get("t"));
  if (!tabel) return NextResponse.json({ fout: "Onbekende tabel." }, { status: 404 });
  const q = params.get("q")?.trim();
  const index = bouwIndex(tabellen);
  const filter = q ? zoekFilter(q) : null;
  const gekozen = (params.get("k") ?? "").split(",").filter((k) => tabel.kolommen.includes(k));
  const kolommen = gekozen.length ? gekozen : standaardKolommen(tabel);
  const rijen = sorteer(filter ? tabel.rijen.filter((r) => filter(r, index)) : tabel.rijen, params.get("s") || undefined, params.get("r") === "1");
  // BOM zodat Excel de UTF-8-tekens (ë, €) goed leest.
  return new NextResponse(`﻿${naarCsv(tabel, rijen, kolommen)}`, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="database-${tabel.naam}-${new Date().toISOString().slice(0, 10)}.csv"` }
  });
}
