"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownUp,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Filter,
  Globe2,
  Layers3,
  MapPinned,
  RefreshCw,
  Search,
  Sparkles,
  Upload
} from "lucide-react";
import { importPartnerWorkbook } from "@/lib/importExcel";
import type { CriterionHeader, EnrichmentSuggestion, PartnerDataset, PartnerRecord } from "@/lib/types";

type Props = {
  initialDataset: PartnerDataset;
};

type ProjectProfile = {
  name: string;
  category: string;
  buildingType: string;
  homes: number;
  layers: number;
  construction: string;
  sustainability: string;
  budgetFocus: boolean;
};

type MatchResult = {
  score: number;
  strengths: string[];
  risks: string[];
  unknowns: string[];
};

const focusGroups = [
  "Algemeen",
  "Duurzaamheid - MPG & Paris Proof - A1 set",
  "Duurzaamheid - Materiaalgebruik",
  "Productie",
  "Financieel",
  "Bronnen"
];

const unknownCriteriaTab = "Onbekend";

const defaultProject: ProjectProfile = {
  name: "Nieuw woonproject",
  category: "Duurzame houtbouwers",
  buildingType: "Grondgebonden",
  homes: 24,
  layers: 3,
  construction: "Concept",
  sustainability: "MPG / Paris Proof",
  budgetFocus: true
};

function asText(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function hasKnownValue(value: unknown) {
  const clean = asText(value).trim();
  return clean !== "" && clean !== "-";
}

function asNumber(value: unknown) {
  if (typeof value === "number") return value;
  const parsed = Number.parseFloat(asText(value).replace(",", ".").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function countBy<T extends string>(items: T[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] ?? 0) + 1;
    return acc;
  }, {});
}

function sourceStatus(partner: PartnerRecord) {
  const sourceCount = ["Bron 1 - Website", "Bron 2", "Bron 3"].filter((label) => asText(partner.values[label])).length;
  if (sourceCount >= 2) return "actueel";
  if (sourceCount === 1) return "checken";
  return "ontbreekt";
}

function groupedHeaders(headers: CriterionHeader[]) {
  return headers.reduce<Record<string, CriterionHeader[]>>((acc, header) => {
    if (!acc[header.group]) acc[header.group] = [];
    acc[header.group].push(header);
    return acc;
  }, {});
}

function scorePartner(partner: PartnerRecord, project: ProjectProfile): MatchResult {
  let points = 0;
  let possible = 0;
  const strengths: string[] = [];
  const risks: string[] = [];
  const unknowns: string[] = [];

  const buildingTypes = asText(partner.values["Mogelijke (woning)types"]);
  possible += 24;
  if (buildingTypes.toLowerCase().includes(project.buildingType.toLowerCase())) {
    points += 24;
    strengths.push(`Past bij woningtype: ${project.buildingType}.`);
  } else if (buildingTypes) {
    risks.push(`Woningtype wijkt af: ${buildingTypes}.`);
  } else {
    unknowns.push("Woningtype ontbreekt.");
  }

  const conceptType = asText(partner.values["Concept / Maatwerk"]);
  possible += 14;
  if (conceptType.toLowerCase().includes(project.construction.toLowerCase())) {
    points += 14;
    strengths.push(`Leveringsvorm sluit aan: ${conceptType}.`);
  } else if (conceptType) {
    risks.push(`Leveringsvorm is ${conceptType}.`);
  } else {
    unknowns.push("Concept/maatwerk ontbreekt.");
  }

  const minimumSize = asNumber(partner.values["Minimale projectgrootte"]);
  possible += 16;
  if (minimumSize === null) {
    unknowns.push("Minimale projectgrootte ontbreekt.");
  } else if (project.homes >= minimumSize) {
    points += 16;
    strengths.push(`Projectgrootte past: minimaal ${minimumSize}, project ${project.homes}.`);
  } else {
    risks.push(`Project is mogelijk te klein: minimaal ${minimumSize}.`);
  }

  const maxLayers = asNumber(partner.values["Maximaal aantal lagen"]);
  possible += 12;
  if (maxLayers === null) {
    unknowns.push("Maximaal aantal lagen ontbreekt.");
  } else if (project.layers <= maxLayers) {
    points += 12;
    strengths.push(`Aantal lagen past binnen maximum ${maxLayers}.`);
  } else {
    risks.push(`Maximaal ${maxLayers} lagen bekend.`);
  }

  const mpg = asNumber(partner.values["MPG - Totaal A1 tm D"]);
  possible += 14;
  if (project.sustainability && mpg !== null && mpg <= 0.65) {
    points += 14;
    strengths.push(`Sterke MPG-indicatie: ${mpg.toFixed(2)}.`);
  } else if (project.sustainability && mpg !== null) {
    points += 6;
    risks.push(`MPG vraagt vergelijking: ${mpg.toFixed(2)}.`);
  } else {
    unknowns.push("MPG/Paris Proof data ontbreekt of is niet vergelijkbaar.");
  }

  const price = asText(partner.values["Prijs per woning - vanaf prijs"] || partner.values["Prijs per m2 GO - vanaf prijs"]);
  possible += 10;
  if (!project.budgetFocus) {
    points += 8;
  } else if (price) {
    points += 10;
    strengths.push("Prijsindicatie beschikbaar voor eerste haalbaarheid.");
  } else {
    unknowns.push("Prijsindicatie ontbreekt.");
  }

  possible += 10;
  const status = sourceStatus(partner);
  if (status === "actueel") {
    points += 10;
    strengths.push("Meerdere bronnen aanwezig.");
  } else if (status === "checken") {
    points += 5;
    unknowns.push("Bronnen moeten nog worden bevestigd.");
  } else {
    unknowns.push("Bronnen ontbreken.");
  }

  return {
    score: Math.round((points / possible) * 100),
    strengths: strengths.slice(0, 4),
    risks: risks.slice(0, 3),
    unknowns: unknowns.slice(0, 4)
  };
}

export default function PartnerApp({ initialDataset }: Props) {
  const [dataset, setDataset] = useState(initialDataset);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("Alle criteria");
  const [selectedId, setSelectedId] = useState(initialDataset.partners[0]?.id ?? "");
  const [sort, setSort] = useState<"match" | "name" | "filled">("match");
  const [project, setProject] = useState<ProjectProfile>(defaultProject);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [suggestions, setSuggestions] = useState<EnrichmentSuggestion[]>([]);
  const [isEnriching, setIsEnriching] = useState(false);

  const groups = useMemo(() => Object.keys(groupedHeaders(dataset.headers)), [dataset.headers]);
  const selected = dataset.partners.find((partner) => partner.id === selectedId) ?? dataset.partners[0];
  const matches = useMemo(() => {
    return new Map(dataset.partners.map((partner) => [partner.id, scorePartner(partner, project)]));
  }, [dataset.partners, project]);
  const visiblePartners = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    const filtered = dataset.partners.filter((partner) => {
      const haystack = [partner.organization, partner.concept, partner.type, partner.website].join(" ").toLowerCase();
      return !normalized || haystack.includes(normalized);
    });

    return filtered.sort((a, b) => {
      if (sort === "match") return (matches.get(b.id)?.score ?? 0) - (matches.get(a.id)?.score ?? 0);
      if (sort === "filled") return b.filledCriteria - a.filledCriteria;
      return a.organization.localeCompare(b.organization, "nl");
    });
  }, [dataset.partners, matches, query, sort]);

  const groupMap = useMemo(() => groupedHeaders(dataset.headers), [dataset.headers]);
  const conceptCounts = countBy(dataset.partners.map((partner) => partner.type || "Nog te bepalen"));
  const knownHeaders = selected
    ? dataset.headers.filter((header) => hasKnownValue(selected.values[header.label]))
    : [];
  const unknownHeaders = selected
    ? dataset.headers.filter((header) => !hasKnownValue(selected.values[header.label]))
    : [];
  const currentHeaders =
    group === unknownCriteriaTab
      ? unknownHeaders
      : group === "Alle criteria"
        ? focusGroups
            .flatMap((name) => groupMap[name] ?? [])
            .filter((header) => hasKnownValue(selected?.values[header.label]))
        : (groupMap[group] ?? []).filter((header) => hasKnownValue(selected?.values[header.label]));
  const averageFilled = Math.round(
    dataset.partners.reduce((sum, partner) => sum + partner.filledCriteria, 0) / Math.max(dataset.partners.length, 1)
  );
  const sourceCounts = countBy(dataset.partners.map(sourceStatus));
  const selectedMatch = selected ? matches.get(selected.id) ?? scorePartner(selected, project) : null;
  const topMatches = visiblePartners.filter((partner) => (matches.get(partner.id)?.score ?? 0) >= 65).length;

  async function onImport(file: File | undefined) {
    if (!file) return;
    setIsImporting(true);
    setImportMessage("");

    try {
      const imported = await importPartnerWorkbook(file);
      setDataset(imported);
      setSelectedId(imported.partners[0]?.id ?? "");
      setSuggestions([]);
      setImportMessage(`${imported.partners.length} regels en ${imported.headers.length} criteria geimporteerd.`);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "Importeren is mislukt.");
    } finally {
      setIsImporting(false);
    }
  }

  async function saveDataset() {
    const response = await fetch("/api/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dataset)
    });
    const result = await response.json();
    setImportMessage(
      result.neon?.stored
        ? "Dataset opgeslagen in Neon."
        : "Dataset gevalideerd. Voeg DATABASE_URL toe om in Neon op te slaan."
    );
  }

  async function enrichSelected() {
    if (!selected) return;
    setIsEnriching(true);
    const response = await fetch("/api/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(selected)
    });
    const result = await response.json();
    setSuggestions(result.suggestions ?? []);
    setIsEnriching(false);
  }

  return (
    <main>
      <header className="topbar">
        <div className="brandMark">
          <img src="/brand/logo.png" alt="Blauwhoed" width={188} height={20} />
          <span>Partner Radar</span>
        </div>
        <nav aria-label="Hoofdnavigatie">
          <a>Werkwijze</a>
          <a>Projecten</a>
          <a>Kennis</a>
          <a>Samen</a>
        </nav>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">Partner Radar</p>
          <h1>Waardevolle partneroverzichten, continu actueel.</h1>
          <p className="intro">
            Vertaal projectinformatie naar selectiecriteria en bouw per project een uitlegbare shortlist van passende
            partners, leveranciers en adviseurs.
          </p>
        </div>
        <div className="heroActions">
          <label className="uploadButton">
            <Upload size={18} />
            <input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => onImport(event.target.files?.[0])} />
            {isImporting ? "Importeren..." : "Excel importeren"}
          </label>
          <button onClick={saveDataset}>
            <Database size={18} />
            Neon sync
          </button>
        </div>
      </section>

      <section className="metrics" aria-label="Samenvatting">
        <article>
          <Building2 />
          <span>{dataset.partners.length}</span>
          <p>Organisatie/concept regels</p>
        </article>
        <article>
          <Layers3 />
          <span>{dataset.headers.length}</span>
          <p>Selectiecriteria</p>
        </article>
        <article>
          <CheckCircle2 />
          <span>{averageFilled}</span>
          <p>Gemiddeld gevulde velden</p>
        </article>
        <article>
          <Globe2 />
          <span>{topMatches}</span>
          <p>Partners met sterke projectfit</p>
        </article>
      </section>

      {importMessage ? <p className="statusLine">{importMessage}</p> : null}

      <section className="projectPanel" aria-label="Projectprofiel">
        <div>
          <p className="eyebrow">Projectvraag</p>
          <h2>{project.name}</h2>
          <p>
            Eerste vertaling van projectdocumenten naar harde en zachte selectiecriteria. Later kan AI hier
            programma, planning, duurzaamheidsambitie en randvoorwaarden uit documenten voorinvullen.
          </p>
        </div>
        <div className="projectFields">
          <label>
            Categorie
            <select value={project.category} onChange={(event) => setProject({ ...project, category: event.target.value })}>
              <option>Duurzame houtbouwers</option>
              <option>Aannemers</option>
              <option>Architecten</option>
              <option>Adviseurs</option>
              <option>Installateurs</option>
            </select>
          </label>
          <label>
            Woningtype
            <select
              value={project.buildingType}
              onChange={(event) => setProject({ ...project, buildingType: event.target.value })}
            >
              <option>Grondgebonden</option>
              <option>Appartementen</option>
              <option>Optoppen</option>
              <option>Kantoren</option>
              <option>Utiliteit</option>
            </select>
          </label>
          <label>
            Aantal woningen
            <input
              min={1}
              type="number"
              value={project.homes}
              onChange={(event) => setProject({ ...project, homes: Number(event.target.value) })}
            />
          </label>
          <label>
            Lagen
            <input
              min={1}
              type="number"
              value={project.layers}
              onChange={(event) => setProject({ ...project, layers: Number(event.target.value) })}
            />
          </label>
          <label>
            Leveringsvorm
            <select
              value={project.construction}
              onChange={(event) => setProject({ ...project, construction: event.target.value })}
            >
              <option>Concept</option>
              <option>Maatwerk</option>
            </select>
          </label>
          <label className="toggleField">
            <input
              checked={project.budgetFocus}
              type="checkbox"
              onChange={(event) => setProject({ ...project, budgetFocus: event.target.checked })}
            />
            Prijsindicatie meewegen
          </label>
        </div>
      </section>

      <section className="workspace">
        <aside className="listPane">
          <div className="toolbar">
            <div className="searchBox">
              <Search size={17} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Zoek organisatie, concept of bron"
              />
            </div>
            <button className="iconButton" onClick={() => setSort(sort === "filled" ? "name" : "filled")}>
              <ArrowDownUp size={18} />
            </button>
          </div>
          <div className="sortTabs" aria-label="Sortering">
            <button className={sort === "match" ? "active" : ""} onClick={() => setSort("match")}>
              Match
            </button>
            <button className={sort === "filled" ? "active" : ""} onClick={() => setSort("filled")}>
              Data
            </button>
            <button className={sort === "name" ? "active" : ""} onClick={() => setSort("name")}>
              A-Z
            </button>
          </div>

          <div className="chips" aria-label="Concept verdeling">
            {Object.entries(conceptCounts)
              .slice(0, 5)
              .map(([name, count]) => (
                <span key={name}>
                  {name} <b>{count}</b>
                </span>
              ))}
          </div>

          <div className="partnerList">
            {visiblePartners.map((partner) => (
              <button
                key={partner.id}
                className={partner.id === selected?.id ? "partnerRow active" : "partnerRow"}
                onClick={() => {
                  setSelectedId(partner.id);
                  setSuggestions([]);
                }}
              >
                <span>
                  <strong>{partner.organization}</strong>
                  <small>{partner.concept || partner.type || "Nog te verrijken"}</small>
                </span>
                <span className="rowMeta">
                  <b>{matches.get(partner.id)?.score ?? 0}%</b>
                  <em data-status={sourceStatus(partner)}>{sourceStatus(partner)}</em>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="detailPane">
          {selected ? (
            <>
              <div className="detailHeader">
                <div>
                  <p className="eyebrow">{selected.category}</p>
                  <h2>{selected.organization}</h2>
                  <p>{selected.concept || "Geen conceptnaam ingevuld"}</p>
                </div>
                <div className="matchBadge">
                  <span>{selectedMatch?.score ?? 0}%</span>
                  <small>projectfit</small>
                </div>
                <button onClick={enrichSelected}>
                  {isEnriching ? <RefreshCw className="spin" size={18} /> : <Sparkles size={18} />}
                  AI verrijken
                </button>
              </div>

              <div className="sourceStrip">
                <span>
                  <FileSpreadsheet size={16} />
                  Rij {selected.sourceRow ?? "-"}
                </span>
                <span>
                  <Filter size={16} />
                  {selected.filledCriteria} velden gevuld
                </span>
                <span>
                  <MapPinned size={16} />
                  {project.buildingType}, {project.homes} woningen, {project.layers} lagen
                </span>
                {selected.website ? (
                  <a href={selected.website.startsWith("http") ? selected.website : undefined} target="_blank">
                    <Globe2 size={16} />
                    Website
                  </a>
                ) : (
                  <span>
                    <Globe2 size={16} />
                    Website onbekend
                  </span>
                )}
              </div>

              {selectedMatch ? (
                <section className="matchPanel" aria-label="Matchuitleg">
                  <article>
                    <h3>Sterk</h3>
                    {(selectedMatch.strengths.length ? selectedMatch.strengths : ["Nog geen sterke matchsignalen."]).map(
                      (item) => (
                        <p key={item}>{item}</p>
                      )
                    )}
                  </article>
                  <article>
                    <h3>Aandacht</h3>
                    {(selectedMatch.risks.length ? selectedMatch.risks : ["Geen harde afwijkingen gevonden."]).map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                  </article>
                  <article>
                    <h3>Uitzoeken</h3>
                    {(selectedMatch.unknowns.length ? selectedMatch.unknowns : ["Belangrijkste velden zijn gevuld."]).map(
                      (item) => (
                        <p key={item}>{item}</p>
                      )
                    )}
                  </article>
                </section>
              ) : null}

              <div className="criteriaControls">
                <button className={group === "Alle criteria" ? "active" : ""} onClick={() => setGroup("Alle criteria")}>
                  Focus <span>{knownHeaders.length}</span>
                </button>
                {groups.map((name) => (
                  <button key={name} className={group === name ? "active" : ""} onClick={() => setGroup(name)}>
                    {name}{" "}
                    <span>
                      {(groupMap[name] ?? []).filter((header) => hasKnownValue(selected.values[header.label])).length}
                    </span>
                  </button>
                ))}
                <button
                  className={group === unknownCriteriaTab ? "active warningTab" : "warningTab"}
                  onClick={() => setGroup(unknownCriteriaTab)}
                >
                  Onbekend <span>{unknownHeaders.length}</span>
                </button>
              </div>

              {currentHeaders.length ? (
                <div className={group === unknownCriteriaTab ? "criteriaGrid unknownGrid" : "criteriaGrid"}>
                  {currentHeaders.map((header) => {
                    const value = asText(selected.values[header.label]);
                    return (
                      <article key={`${header.group}-${header.label}`}>
                        <small>{header.group}</small>
                        <h3>{header.label}</h3>
                        <p>{group === unknownCriteriaTab ? "Nog onbekend" : value}</p>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="emptyCriteria">
                  <h3>{group === unknownCriteriaTab ? "Geen ontbrekende parameters" : "Geen gevulde parameters"}</h3>
                  <p>
                    {group === unknownCriteriaTab
                      ? "Voor deze partner zijn alle criteria in dit overzicht ingevuld."
                      : "De ontbrekende parameters staan nu apart onder het tabblad Onbekend."}
                  </p>
                </div>
              )}

              <section className="aiPanel">
                <div>
                  <p className="eyebrow">Bronnenstrategie</p>
                  <h2>Internet en AI-verrijking</h2>
                </div>
                <div className="sourceRoadmap">
                  <span>Conceptenboulevard: periodiek monitoren</span>
                  <span>Woningconceptenbrochure: editie-import</span>
                  <span>Organisatiewebsites: velden aanvullen</span>
                  <span>Nieuwe organisaties: discovery-lijst</span>
                </div>
                {suggestions.length ? (
                  <div className="suggestions">
                    {suggestions.map((suggestion) => (
                      <article key={suggestion.field}>
                        <strong>{suggestion.field}</strong>
                        <p>{suggestion.suggestion}</p>
                        <small>
                          {suggestion.source} - betrouwbaarheid {Math.round(suggestion.confidence * 100)}%
                        </small>
                      </article>
                    ))}
                  </div>
                ) : null}
              </section>
            </>
          ) : (
            <p>Geen partners gevonden.</p>
          )}
        </section>
      </section>

      <section className="footerBand" aria-label="Over Blauwhoed">
        <div>
          <p className="eyebrow">Samen ontwikkelen</p>
          <h2>Wij ontwikkelen buurten waar mensen graag wonen.</h2>
          <p>
            Partner Radar helpt onze projectteams om per opgave snel de juiste bouwers, architecten en adviseurs te
            vinden en actueel te houden.
          </p>
        </div>
        <a href="https://www.blauwhoed.nl" target="_blank" rel="noreferrer">
          Meer over Blauwhoed
          <ArrowUpRight size={18} />
        </a>
      </section>

      <footer className="siteFooter">
        <img src="/brand/logo.png" alt="Blauwhoed" width={188} height={20} />
        <span>Interne tool voor partnerselectie</span>
      </footer>
    </main>
  );
}
