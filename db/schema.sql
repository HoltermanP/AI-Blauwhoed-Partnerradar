-- Genormaliseerd schema Slimme Partnerdatabase (backlog hoofdstuk 2).
-- Vereist: PostgreSQL 15+, extensies postgis en vector (pgvector). Neon ondersteunt beide.
-- De applicatie draait nu op een JSONB-snapshot (tabel partnerdb_state); dit schema is de doelvorm
-- voor de productiefase. Kolomnamen volgen het TypeScript-domeinmodel in src/lib/domain/types.ts.

create extension if not exists postgis;
create extension if not exists vector;

create type partner_status as enum ('bekend', 'prospect', 'afgewezen', 'preferred', 'geblokkeerd');
create type rol as enum ('architect', 'aannemer', 'installateur', 'adviseur', 'leverancier', 'ontwikkelpartner');
create type factor_type as enum ('hard', 'gewogen', 'semantisch');
create type bron as enum ('opgave', 'projecthistorie', 'evaluatie', 'web', 'certificaat');

create table partner (
  id                         text primary key,
  naam                       text not null,
  kvk                        char(8) not null unique,               -- US-01: uniek
  rechtsvorm                 text not null,
  vestigingsplaats           text not null,
  adres                      text,
  locatie                    geography(point, 4326) not null,       -- PostGIS
  werkgebied                 geography(polygon, 4326),             -- US-01: polygoon of straal
  werkgebied_km              numeric,
  status                     partner_status not null default 'bekend',
  status_reden               text,
  geblokkeerd_tot            date,                                  -- US-07
  rollen                     rol[] not null default '{}',            -- US-02
  website                    text,
  omschrijving               text not null default '',
  referenties                text[] not null default '{}',
  omzet                      numeric,
  medewerkers                int,
  max_gelijktijdige_projecten int,                                   -- US-05
  typische_omvang_min        int,
  typische_omvang_max        int,
  tags                       text[] not null default '{}',
  aangemaakt_op              timestamptz not null default now(),
  bijgewerkt_op              timestamptz not null default now()
);
create index partner_locatie_idx on partner using gist (locatie);
create index partner_werkgebied_idx on partner using gist (werkgebied);

create table factor (                                                -- US-04: configuratie, geen migratie
  id            text primary key,
  code          text not null,
  naam          text not null,
  omschrijving  text not null default '',
  categorie     text not null,
  type          factor_type not null,
  schaal        jsonb not null,                                      -- {soort, eenheid, lagerIsBeter, min, max, meervoudig}
  rollen        rol[] not null default '{}',
  actief        boolean not null default true,
  gearchiveerd_op timestamptz,
  samengevoegd_in text references factor(id),
  afgeleid      boolean not null default false,
  versie        int not null default 1
);

create table factor_option (
  id        text not null,
  factor_id text not null references factor(id),
  label     text not null,
  omschrijving text,
  actief    boolean not null default true,
  primary key (factor_id, id)
);

create table partner_factor (                                        -- US-03
  partner_id       text not null references partner(id) on delete cascade,
  factor_id        text not null references factor(id),
  optie_id         text not null default '',
  waarde           jsonb not null,
  bron             bron not null,
  betrouwbaarheid  numeric(3,2) not null check (betrouwbaarheid between 0 and 1),
  bewijs           jsonb,                                            -- {soort, ref, label}
  peildatum        date not null,
  afgeleid         boolean not null default false,                   -- US-19
  overschrijving   boolean not null default false,
  toelichting      text,
  primary key (partner_id, factor_id, optie_id)
);

create table partner_certificate (                                   -- US-06
  id              text primary key,
  partner_id      text not null references partner(id) on delete cascade,
  type            text not null,
  nummer          text not null,
  niveau          int,
  geldig_tot      date not null,
  geverifieerd_op date,
  bron_url        text
);
create index partner_certificate_geldig_idx on partner_certificate (geldig_tot);

create table partner_beschikbaarheid (
  partner_id  text not null references partner(id) on delete cascade,
  van         date not null,
  tot         date not null,
  beschikbaar boolean not null,
  toelichting text,
  primary key (partner_id, van, tot)
);

create table partner_embedding (                                     -- pgvector op samengesteld profiel
  partner_id text primary key references partner(id) on delete cascade,
  embedding  vector(256) not null,
  bron_tekst text not null,
  berekend_op timestamptz not null default now()
);
create index partner_embedding_idx on partner_embedding using ivfflat (embedding vector_cosine_ops);

create table contactpersoon (                                        -- US-47: apart, met grondslag en bewaartermijn
  id                    text primary key,
  partner_id            text not null references partner(id) on delete cascade,
  naam                  text not null,
  functie               text not null,
  email                 text,
  telefoon              text,
  grondslag             text not null check (grondslag in ('overeenkomst', 'gerechtvaardigd belang', 'toestemming')),
  vastgelegd_op         date not null default current_date,
  bewaartermijn_maanden int not null default 60
);

create table kwalificatie (                                          -- US-34
  partner_id  text not null references partner(id) on delete cascade,
  item        text not null,
  afgevinkt   boolean not null default false,
  door        text,
  op          date,
  toelichting text,
  primary key (partner_id, item)
);

create table financieel (                                            -- US-32
  partner_id        text primary key references partner(id) on delete cascade,
  boekjaar          int not null,
  omzet             numeric not null,
  omzet_vorig_jaar  numeric,
  eigen_vermogen    numeric,
  solvabiliteit     numeric,
  laatste_deponering date,
  betalingsgedrag   text,
  risicoklasse      text,
  toelichting       text
);

create table project (                                               -- US-08
  id                    text primary key,
  naam                  text not null,
  type                  text not null,
  plaats                text not null,
  locatie               geography(point, 4326) not null,
  woningen              int not null,
  prijssegment          text[] not null default '{}',
  bouwstijl             text not null,
  ambitie_duurzaamheid  int not null check (ambitie_duurzaamheid between 1 and 5),
  planning_start        date not null,
  planning_eind         date not null,
  fase                  text not null,
  omschrijving          text not null default '',
  gewichtsprofiel_id    text,
  herkomst              jsonb,                                       -- US-11: per veld citaat + betrouwbaarheid
  aangemaakt_op         timestamptz not null default now(),
  bijgewerkt_op         timestamptz not null default now()
);

create table project_requirement (                                   -- US-09
  project_id          text not null references project(id) on delete cascade,
  rol                 rol not null,
  semantisch_gewicht  int not null default 15,
  vrije_omschrijving  text,
  primary key (project_id, rol)
);

create table requirement_factor (                                    -- US-10
  project_id  text not null,
  rol         rol not null,
  factor_id   text not null references factor(id),
  optie_id    text not null default '',
  gevraagd    jsonb not null,
  gewicht     int not null default 0,
  minimumeis  boolean not null default false,
  primary key (project_id, rol, factor_id, optie_id),
  foreign key (project_id, rol) references project_requirement(project_id, rol) on delete cascade
);

create table engagement (                                            -- US-18
  id                    text primary key,
  partner_id            text not null references partner(id),
  project_id            text not null references project(id),
  rol                   rol not null,
  periode_van           date not null,
  periode_tot           date,
  contractwaarde        numeric not null,
  raming_bij_start      numeric,
  eindafrekening        numeric,
  geplande_oplevering   date,
  werkelijke_oplevering date,
  bouwsysteem           text,
  crediteurnummer       text,
  bron                  text not null default 'handmatig'
);
create index engagement_partner_idx on engagement (partner_id);
create index engagement_project_idx on engagement (project_id);

create table evaluation (                                            -- US-21
  id            text primary key,
  engagement_id text not null references engagement(id) on delete cascade,
  partner_id    text not null references partner(id),
  project_id    text not null references project(id),
  datum         date not null,
  door          text not null,
  kwaliteit     int not null check (kwaliteit between 1 and 5),
  planning      int not null check (planning between 1 and 5),
  budget        int not null check (budget between 1 and 5),
  samenwerking  int not null check (samenwerking between 1 and 5),
  duurzaamheid  int not null check (duurzaamheid between 1 and 5),
  toelichting   text not null default ''
);

-- US-22: samenwerkingshistorie als afgeleide view (collaboration_edge)
create view collaboration_edge as
select a.partner_id as partner_a, b.partner_id as partner_b,
       count(distinct a.project_id) as aantal_projecten,
       avg(ev.samenwerking) as gemiddelde_score
from engagement a
join engagement b on a.project_id = b.project_id and a.partner_id < b.partner_id
left join evaluation ev on ev.project_id = a.project_id and ev.partner_id in (a.partner_id, b.partner_id)
group by a.partner_id, b.partner_id;

create table discovery_candidate (                                   -- US-24 t/m US-27
  id                    text primary key,
  naam                  text not null,
  kvk                   char(8),
  vestigingsplaats      text,
  adres                 text,
  locatie               geography(point, 4326),
  website               text,
  rollen                rol[] not null default '{}',
  bron                  text not null,
  bron_url              text not null,
  opgehaald_op          timestamptz not null,
  ruwe_data             jsonb not null default '{}',
  project_id            text references project(id),
  status                text not null default 'nieuw',
  reden                 text,
  mogelijke_dubbel_van  text references partner(id),
  samenvatting          jsonb,
  voorlopige_score      int,
  gepromoveerd_tot      text references partner(id),
  beoordeeld_op         timestamptz,
  beoordeeld_door       text
);

create table match_run (                                             -- US-16
  id            text primary key,
  project_id    text not null references project(id) on delete cascade,
  naam          text not null,
  gestart_op    timestamptz not null default now(),
  door          text not null,
  input         jsonb not null,
  resultaat     jsonb not null,
  vorige_run_id text references match_run(id)
);

create table match_feedback (                                        -- US-42
  id                  text primary key,
  match_run_id        text not null references match_run(id) on delete cascade,
  project_id          text not null,
  rol                 rol not null,
  partner_id          text not null references partner(id),
  beslissing          text not null check (beslissing in ('gekozen', 'afgewezen', 'shortlist')),
  reden               text not null default '',
  door                text not null,
  op                  timestamptz not null default now(),
  positie_in_ranking  int not null
);

create table team_voorstel (                                         -- US-35 t/m US-38
  id            text primary key,
  project_id    text not null references project(id) on delete cascade,
  match_run_id  text not null references match_run(id) on delete cascade,
  variant       text not null,
  leden         jsonb not null,
  team_score    int not null,
  onderdelen    jsonb not null,
  onderbouwing  text[] not null default '{}',
  gemaakt_op    timestamptz not null default now()
);

create table gewichtsprofiel (                                       -- US-10 / US-44 met versiebeheer
  id                 text primary key,
  naam               text not null,
  omschrijving       text not null default '',
  per_rol            jsonb not null,
  semantisch_gewicht int not null default 15,
  versie             int not null default 1,
  standaard          boolean not null default false
);

create table gewichtsprofiel_versie (
  profiel_id  text not null references gewichtsprofiel(id) on delete cascade,
  versie      int not null,
  op          timestamptz not null default now(),
  door        text not null,
  toelichting text not null default '',
  snapshot    jsonb not null,
  primary key (profiel_id, versie)
);

create table verrijkingsvoorstel (                                   -- US-29 t/m US-31
  id              text primary key,
  partner_id      text not null references partner(id) on delete cascade,
  factor_id       text references factor(id),
  veld            text not null,
  huidig          jsonb,
  voorgesteld     jsonb not null,
  bron            bron not null default 'web',
  bron_url        text,
  betrouwbaarheid numeric(3,2) not null,
  soort           text not null check (soort in ('aantoonbaar', 'geclaimd')),  -- US-30
  citaat          text not null,
  status          text not null default 'open',
  gevonden_op     timestamptz not null default now()
);

create table audit_log (                                             -- US-46
  id             bigserial primary key,
  op             timestamptz not null default now(),
  door           text not null,
  gebruikersrol  text not null,
  entiteit       text not null,
  entiteit_id    text not null,
  actie          text not null,
  details        text
);
create index audit_log_entiteit_idx on audit_log (entiteit, entiteit_id);

-- Snapshot-tabel die de huidige applicatie gebruikt (JSONB van het volledige domein).
create table if not exists partnerdb_state (
  id         int primary key default 1,
  state      jsonb not null,
  updated_at timestamptz not null default now()
);
