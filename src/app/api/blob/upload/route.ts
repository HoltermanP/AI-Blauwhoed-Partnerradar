// Bestandsuploads voor partnerdocumenten via Vercel Blob (client-upload: het bestand gaat direct naar Blob,
// deze route geeft alleen een kortlevend upload-token uit na een rechtencontrole). Vereist BLOB_READ_WRITE_TOKEN.
import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";

export const dynamic = "force-dynamic";

const TOEGESTANE_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv"
];

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "Vercel Blob is niet geconfigureerd (BLOB_READ_WRITE_TOKEN ontbreekt)." }, { status: 501 });
  const body = (await request.json()) as HandleUploadBody;
  // Alleen het uitgeven van een upload-token vraagt een ingelogde gebruiker met recht bewerken; de webhook van Vercel
  // ('upload voltooid') is ondertekend en wordt door handleUpload zelf gecontroleerd (US-64: route staat buiten de proxy).
  let door = "systeem";
  if (body.type === "blob.generate-client-token") {
    const g = await huidigeGebruiker();
    if (!heeftRecht(g.rol, "bewerken")) return NextResponse.json({ error: "Recht 'bewerken' vereist voor uploads." }, { status: 403 });
    door = g.naam;
  }
  try {
    const antwoord = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => ({
        allowedContentTypes: TOEGESTANE_TYPES,
        maximumSizeInBytes: 25 * 1024 * 1024,
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ door, pathname, clientPayload })
      }),
      // Registratie van het document gebeurt door de client via de server action (werkt ook lokaal,
      // waar deze webhook Vercel niet kan bereiken).
      onUploadCompleted: async () => {}
    });
    return NextResponse.json(antwoord);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload mislukt." }, { status: 400 });
  }
}
