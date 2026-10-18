// De startpagina is het partneroverzicht; het dashboard staat op /dashboard (achteraan in het menu).
import { redirect } from "next/navigation";

export default function Start() {
  redirect("/partners");
}
