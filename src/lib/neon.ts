import { neon } from "@neondatabase/serverless";
import type { PartnerDataset } from "./types";

export async function getPartnersFromNeon(): Promise<PartnerDataset | null> {
  if (!process.env.DATABASE_URL) return null;

  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`
    select dataset
    from partner_datasets
    order by updated_at desc
    limit 1
  `;

  const first = rows[0] as { dataset?: PartnerDataset } | undefined;
  return first?.dataset ?? null;
}

export async function saveDatasetToNeon(dataset: PartnerDataset) {
  if (!process.env.DATABASE_URL) return { stored: false, reason: "DATABASE_URL ontbreekt" };

  const sql = neon(process.env.DATABASE_URL);
  await sql`
    create table if not exists partner_datasets (
      id serial primary key,
      dataset jsonb not null,
      updated_at timestamptz not null default now()
    )
  `;
  await sql`insert into partner_datasets (dataset) values (${JSON.stringify(dataset)}::jsonb)`;

  return { stored: true };
}
