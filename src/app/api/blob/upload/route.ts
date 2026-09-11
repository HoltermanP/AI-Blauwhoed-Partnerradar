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
  const g = await huidigeGebruiker();
  if (!heeftRecht(g.rol, "bewerken")) return NextResponse.json({ error: "Recht 'bewerken' vereist voor uploads." }, { status: 403 });
  const body = (await request.json()) as HandleUploadBody;
  try {
    const antwoord = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => ({
        allowedContentTypes: TOEGESTANE_TYPES,
        maximumSizeInBytes: 25 * 1024 * 1024,
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ door: g.naam, pathname, clientPayload })
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
