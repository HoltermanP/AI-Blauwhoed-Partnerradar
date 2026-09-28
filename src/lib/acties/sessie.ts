"use server";
// US-64: in- en uitloggen via Auth.js (Microsoft Entra ID).
import { signIn, signOut } from "@/authjs";

export async function inloggenMicrosoft() {
  await signIn("microsoft-entra-id", { redirectTo: "/" });
}

export async function uitloggen() {
  await signOut({ redirectTo: "/inloggen" });
}
