import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ready-for-source-connector",
    sources: [
      {
        name: "Conceptenboulevard",
        url: "https://conceptenboulevard.nl/concepten/",
        cadence: "wekelijks",
        method: "crawler of API zodra beschikbaar"
      },
      {
        name: "Woningconceptenbrochure",
        cadence: "per editie",
        method: "Excel/PDF-import"
      },
      {
        name: "Organisatiewebsites",
        cadence: "maandelijks",
        method: "AI-extractie op bekende organisatienamen"
      }
    ]
  });
}
