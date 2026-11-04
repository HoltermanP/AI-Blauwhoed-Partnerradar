// Chatten en zoeken staan op de startpagina (dashboard); oude links naar /zoeken blijven werken, inclusief zoekterm en vraag.
import { redirect } from "next/navigation";

export default async function ZoekenPagina({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { q, web, vraag } = await searchParams;
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (web) p.set("web", web);
  if (vraag) p.set("vraag", vraag);
  const s = p.toString();
  redirect(s ? `/dashboard?${s}` : "/dashboard");
}
