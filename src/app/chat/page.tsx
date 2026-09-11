// B5: AI-chat over het partnerbestand — naast klassiek filteren (/partners) en semantisch zoeken (/zoeken).
import Link from "next/link";
import ChatPaneel from "@/components/chat/ChatPaneel";
import { Kaart, PaginaKop } from "@/components/ui";
import { getDb } from "@/lib/store";

export const maxDuration = 60;

export default async function ChatPagina() {
  const db = await getDb();
  return (
    <>
      <PaginaKop
        eyebrow="Zoeken · ingang 3 van 3"
        titel="Chat met het partnerbestand"
        intro={
          <>
            Stel vragen in gewone taal; het antwoord gebruikt uitsluitend wat in de database staat en verwijst naar de onderliggende partners. Liever klassiek? <Link href="/partners">Filteren</Link> of <Link href="/zoeken">semantisch zoeken</Link>. Elke vraag wordt als AI-bewerking geregistreerd (eis 2).
          </>
        }
      />
      <Kaart>
        <ChatPaneel aiActief={db.instellingen.aiProvider === "anthropic"} />
      </Kaart>
    </>
  );
}
