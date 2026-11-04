// De startpagina is het dashboard: chatten en zoeken in partners en projecten, met daaronder de kerncijfers.
import { redirect } from "next/navigation";

export default function Start() {
  redirect("/dashboard");
}
