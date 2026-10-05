// OTAP: welke omgeving draait er (ontwikkeling, test, acceptatie, productie)? Expliciet via OMGEVING, anders afgeleid
// uit Vercel: productie-deployment = productie, branch "acceptatie" = acceptatie, overige previews = test.
export type Omgeving = "ontwikkeling" | "test" | "acceptatie" | "productie";

export const OMGEVING_LABEL: Record<Omgeving, string> = { ontwikkeling: "Ontwikkeling", test: "Test", acceptatie: "Acceptatie", productie: "Productie" };

type Env = Record<string, string | undefined>;

export function bepaalOmgeving(env: Env = process.env): Omgeving {
  const expliciet = env.OMGEVING?.trim().toLowerCase();
  if (expliciet === "ontwikkeling" || expliciet === "test" || expliciet === "acceptatie" || expliciet === "productie") return expliciet;
  if (env.VERCEL_ENV === "production") return "productie";
  if (env.VERCEL_ENV === "preview") return env.VERCEL_GIT_COMMIT_REF === "acceptatie" ? "acceptatie" : "test";
  return env.NODE_ENV === "production" ? "productie" : "ontwikkeling";
}

/** Herkenbaar deel van de database-URL (Neon-endpoint), zodat zichtbaar is op welke database een omgeving draait. */
export function databaseAanduiding(url: string | undefined): string {
  if (!url) return "in-memory";
  try {
    const host = new URL(url).hostname;
    return host.split(".")[0].replace(/-pooler$/, "");
  } catch {
    return "onbekend";
  }
}
