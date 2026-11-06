import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getCommunityUploadDirectory } from "@/lib/community";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPES = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function GET(request, { params }) {
  const { fileId } = await params;
  const match = /^([0-9a-f-]{36})\.(jpg|png|webp)$/i.exec(fileId);
  if (!match) return new NextResponse(null, { status: 404 });

  try {
    const image = await readFile(path.join(getCommunityUploadDirectory(), fileId));
    return new NextResponse(image, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(image.length),
        "Content-Type": CONTENT_TYPES[match[2].toLowerCase()],
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error.code === "ENOENT") return new NextResponse(null, { status: 404 });
    console.error("Community image read failed:", error);
    return NextResponse.json({ error: "画像を読み込めませんでした。" }, { status: 500 });
  }
}
