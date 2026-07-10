import { NextResponse } from "next/server";
import type { EnrichmentSuggestion, PartnerRecord } from "@/lib/types";

export async function POST(request: Request) {
  const partner = (await request.json()) as PartnerRecord;
  const site = partner.website || `https://www.google.com/search?q=${encodeURIComponent(partner.organization)}`;
  const suggestions: EnrichmentSuggestion[] = [
    {
      field: "Website",
      current: partner.website,
      suggestion: site,
      source: "Organisatienaam en bestaande bronvelden",
      confidence: partner.website ? 0.9 : 0.45
    },
    {
      field: "Actualisatie",
      current: "",
      suggestion: "Plan periodieke check op Conceptenboulevard, woningconceptenbrochure en organisatiewebsite.",
      source: "Bronnenstrategie Blauwhoed partneroverzicht",
      confidence: 0.75
    }
  ];

  return NextResponse.json({ partnerId: partner.id, suggestions });
}
