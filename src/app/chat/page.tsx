// B5: de chat is opgegaan in de zoekpagina (klassiek zoeken en chat naast elkaar); oude links blijven werken.
import { redirect } from "next/navigation";

export default function ChatPagina() {
  redirect("/zoeken");
}
