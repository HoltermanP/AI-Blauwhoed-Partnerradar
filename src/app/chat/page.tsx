// B5: de chat staat op de startpagina (dashboard); oude links blijven werken.
import { redirect } from "next/navigation";

export default function ChatPagina() {
  redirect("/dashboard");
}
