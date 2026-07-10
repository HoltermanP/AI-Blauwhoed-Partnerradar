import { NextResponse } from "next/server";
import seed from "@/data/houtbouwers-seed.json";
import { getPartnersFromNeon, saveDatasetToNeon } from "@/lib/neon";
import type { PartnerDataset } from "@/lib/types";

export async function GET() {
  const neonDataset = await getPartnersFromNeon().catch(() => null);
  return NextResponse.json(neonDataset ?? (seed as PartnerDataset));
}

export async function POST(request: Request) {
  const dataset = (await request.json()) as PartnerDataset;
  const result = await saveDatasetToNeon(dataset);

  return NextResponse.json({
    ok: true,
    neon: result,
    records: dataset.partners.length,
    criteria: dataset.headers.length
  });
}
