// De goudstandaard heet nu Blauwdruk-Data; oude links (ook met ?rol=…) blijven werken.
import { redirect } from "next/navigation";

export default async function OudAdres({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { rol } = await searchParams;
  redirect(rol ? `/beheer/blauwdruk-data?rol=${encodeURIComponent(rol)}` : "/beheer/blauwdruk-data");
}
