export type CriterionHeader = {
  index: number;
  group: string;
  hint: string;
  label: string;
};

export type PartnerRecord = {
  id: string;
  sourceRow?: number;
  category: string;
  organization: string;
  concept: string;
  type: string;
  website: string;
  owner: string;
  filledCriteria: number;
  values: Record<string, string | number | boolean>;
};

export type PartnerDataset = {
  sourceFile: string;
  generatedFrom: string;
  headers: CriterionHeader[];
  partners: PartnerRecord[];
  otherSheets?: Array<{ sheet: string; rows: Array<Array<string | number | boolean>> }>;
};

export type SourceStatus = "actueel" | "checken" | "ontbreekt";

export type EnrichmentSuggestion = {
  field: string;
  current: string;
  suggestion: string;
  source: string;
  confidence: number;
};
