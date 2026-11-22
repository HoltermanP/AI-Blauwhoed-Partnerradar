// VE-04: opgegaan in de tab op de projectpagina; oude links blijven werken.
import { redirect } from "next/navigation";

export default async function Doorverwijzing({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const q = new URLSearchParams({ tab: "evaluaties" });
  if (sp.engagement) q.set("engagement", sp.engagement);
  redirect(`/projecten/${id}?${q.toString()}`);
}
