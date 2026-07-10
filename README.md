# Blauwhoed Partner Radar

Next.js prototype voor het vullen, importeren en actueel houden van partneroverzichten per categorie.

## Wat zit erin

- Seed-data uit `Overzicht Houtbouwers v0.3.xlsx`: 116 partnerregels en 100 criteria.
- Flexibele Excel-import voor andere formats met herkenning van header- en groepsrijen.
- Dashboard, zoek/filter/sortering, criteria-detail en bronstatus.
- Projectprofiel met uitlegbare matchscore per partner.
- API-routes voor Neon-opslag en AI/webverrijking stubs.
- Bronstrategie voor Conceptenboulevard, woningconceptenbrochure en organisatiewebsites.

## Starten

Vereist Node.js 20.9 of nieuwer.

```bash
npm install
npm run dev
```

Zet `DATABASE_URL` in `.env.local` om de dataset in Neon op te slaan. Zonder Neon draait de app met lokale seed/importdata.

## Eerste databasevorm

```sql
create table if not exists partner_datasets (
  id serial primary key,
  dataset jsonb not null,
  updated_at timestamptz not null default now()
);
```

Deze brede JSONB-start is bewust flexibel voor wisselende categorieen en Excel-formaten. Zodra de criteria stabieler worden, kunnen organisaties, concepten, criteria, bronnen en snapshots apart genormaliseerd worden.

## Selectielogica

De huidige MVP scoort partners op projectfit aan de hand van woningtype, concept/maatwerk, minimale projectgrootte, aantal lagen, duurzaamheidsdata, prijsindicatie en bronkwaliteit. De score is bedoeld als uitlegbare shortlist-indicatie, niet als definitieve gunning. Bij nieuwe categorieen kunnen andere criteria worden toegevoegd zonder het importmodel vast te pinnen op het houtbouwformat.
