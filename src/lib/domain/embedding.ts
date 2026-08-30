// Lokale, deterministische tekst-embedding (hashed bag-of-words + bigrams, 256 dimensies).
// Er verlaten geen brongegevens de omgeving (US-48). Het genormaliseerde schema slaat deze vector op in pgvector;
// bij een externe embedding-provider hoeft alleen deze module te wijzigen.

const DIM = 256;

const STOPWOORDEN = new Set(
  "de het een en van in op met voor aan bij door is zijn wordt worden als dat die dit er ook naar uit om te tot of over onze ons wij we je jij u hun hen zij ze niet geen meer al nog wel dan zoals per ca circa m2 m² the and of to a".split(" ")
);

// Synoniemen zodat verschillende benamingen op dezelfde dimensies landen (US-15).
const SYNONIEMEN: Record<string, string> = {
  clt: "houtbouw",
  hsb: "houtbouw",
  houtskeletbouw: "houtbouw",
  "kruislaaghout": "houtbouw",
  hout: "houtbouw",
  houten: "houtbouw",
  biobased: "biobased",
  bio: "biobased",
  circulair: "circulair",
  circulaire: "circulair",
  circulariteit: "circulair",
  losmaakbaar: "demontabel",
  remontabel: "demontabel",
  demontabele: "demontabel",
  demonteerbaar: "demontabel",
  prefab: "prefab",
  geprefabriceerd: "prefab",
  industrieel: "prefab",
  fabrieksmatig: "prefab",
  modulair: "prefab",
  modulaire: "prefab",
  appartement: "appartementen",
  appartementencomplex: "appartementen",
  gestapeld: "appartementen",
  gestapelde: "appartementen",
  eengezinswoningen: "grondgebonden",
  eengezinswoning: "grondgebonden",
  rijwoningen: "grondgebonden",
  hoogbouw: "hoogbouw",
  woontoren: "hoogbouw",
  toren: "hoogbouw",
  herbestemming: "transformatie",
  transformaties: "transformatie",
  renovatie: "transformatie",
  monument: "welstand",
  monumentaal: "welstand",
  beschermd: "welstand",
  gevel: "gevel",
  gevels: "gevel",
  natuurinclusief: "natuurinclusief",
  klimaatadaptief: "natuurinclusief",
  groen: "natuurinclusief",
  energieneutraal: "energie",
  nul: "energie",
  beng: "energie",
  mpg: "mpg",
  "paris": "mpg",
  proof: "mpg",
  bouwteam: "bouwteam",
  ketensamenwerking: "bouwteam",
  zorg: "zorgwonen",
  zorgwoningen: "zorgwonen",
  senioren: "zorgwonen",
  sociaal: "sociaal",
  sociale: "sociaal",
  middenhuur: "middenhuur",
  betaalbaar: "middenhuur",
  betaalbare: "middenhuur"
};

export function tokens(tekst: string): string[] {
  return tekst
    .toLowerCase()
    .replace(/[^a-z0-9àâäéèêëïîôöùûüç\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((t) => t.length > 2 && !STOPWOORDEN.has(t))
    .map((t) => SYNONIEMEN[t] ?? t);
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function embed(tekst: string): number[] {
  const v = new Array<number>(DIM).fill(0);
  const toks = tokens(tekst);
  const add = (t: string, w: number) => {
    const h = hash(t);
    const idx = h % DIM;
    const sign = (h >>> 8) & 1 ? 1 : -1;
    v[idx] += sign * w;
  };
  toks.forEach((t, i) => {
    add(t, 1);
    if (i < toks.length - 1) add(`${t}_${toks[i + 1]}`, 0.5);
  });
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

export function cosine(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** Semantische gelijkenis 0–1 tussen twee teksten, plus de overlappende begrippen als uitleg. */
export function semantischeGelijkenis(vraag: string, profiel: string): { score: number; treffers: string[] } {
  if (!vraag.trim() || !profiel.trim()) return { score: 0, treffers: [] };
  const sim = cosine(embed(vraag), embed(profiel));
  const vraagTokens = new Set(tokens(vraag));
  const treffers = Array.from(new Set(tokens(profiel).filter((t) => vraagTokens.has(t)))).slice(0, 8);
  // Cosine op hashed bag-of-words ligt in de praktijk tussen -0.1 en 0.6; herschaal naar 0–1.
  const score = Math.max(0, Math.min(1, sim * 1.8));
  return { score: Math.round(score * 100) / 100, treffers };
}
