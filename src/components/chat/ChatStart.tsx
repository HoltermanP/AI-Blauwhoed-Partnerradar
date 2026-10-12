"use client";
// US-28: de AI-chat als primaire zoekingang, ook vanaf het dashboard. De vraag opent /zoeken en wordt daar direct gesteld.
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ChatStart() {
  const router = useRouter();
  const [vraag, setVraag] = useState("");
  return (
    <form
      className="chatStart"
      onSubmit={(e) => {
        e.preventDefault();
        if (vraag.trim()) router.push(`/zoeken?vraag=${encodeURIComponent(vraag.trim())}`);
      }}
    >
      <label htmlFor="chatstart">Vraag het de partnerdatabase</label>
      <div className="formulierActies" style={{ alignItems: "stretch" }}>
        <input id="chatstart" value={vraag} onChange={(e) => setVraag(e.target.value)} placeholder="Bijv. welke houtbouwers in Noord-Holland kunnen binnen 20 weken leveren?" style={{ flex: 1, minWidth: 220 }} />
        <button type="submit" className="knop" disabled={!vraag.trim()}>
          Vraag stellen
        </button>
      </div>
    </form>
  );
}
