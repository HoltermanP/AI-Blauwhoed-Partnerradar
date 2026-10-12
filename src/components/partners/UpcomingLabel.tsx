"use client";
// US-11: label 'upcoming' voor opkomende partijen (bijv. na een prijs of nominatie), los van de status.
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { zetUpcomingLabel } from "@/lib/actions";

export default function UpcomingLabel({ partnerId, aan }: { partnerId: string; aan: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  return (
    <button
      type="button"
      className="knop knop-tekst klein"
      disabled={bezig}
      onClick={() =>
        start(async () => {
          await zetUpcomingLabel(partnerId, !aan);
          router.refresh();
        })
      }
    >
      {aan ? "Label upcoming verwijderen" : "Label upcoming geven"}
    </button>
  );
}
