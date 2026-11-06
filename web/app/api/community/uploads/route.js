import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { rejectCrossOriginRequest } from "@/lib/csrf";
import { getCommunityUploadDirectory } from "@/lib/community";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = new Map([
  [
    "image/jpeg",
    {
      extension: "jpg",
      signature: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
    },
  ],
  [
    "image/png",
    {
      extension: "png",
      signature: (bytes) =>
        bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    },
  ],
  [
    "image/webp",
    {
      extension: "webp",
      signature: (bytes) =>
        bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP",
    },
  ],
]);

export async function POST(request) {
  const rejected = rejectCrossOriginRequest(request);
  if (rejected) return rejected;
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "画像ファイルを選択してください。" }, { status: 400 });
  }
  const image = formData.get("image");
  if (!image || typeof image.arrayBuffer !== "function") {
    return NextResponse.json({ error: "画像ファイルを選択してください。" }, { status: 400 });
  }
  if (image.size < 1 || image.size > MAX_IMAGE_SIZE) {
    return NextResponse.json({ error: "画像は5MB以下にしてください。" }, { status: 400 });
  }

  const imageType = IMAGE_TYPES.get(image.type);
  if (!imageType) {
    return NextResponse.json(
      { error: "JPEG・PNG・WebP形式の画像を選択してください。" },
      { status: 400 },
    );
  }
  const bytes = Buffer.from(await image.arrayBuffer());
  if (!imageType.signature(bytes)) {
    return NextResponse.json({ error: "画像ファイルの形式を確認してください。" }, { status: 400 });
  }

  const filename = `${randomUUID()}.${imageType.extension}`;
  const directory = getCommunityUploadDirectory();
  try {
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, filename), bytes, { flag: "wx" });
    return NextResponse.json({ url: `/api/community/uploads/${filename}` }, { status: 201 });
  } catch (error) {
    console.error("Community image upload failed:", error);
    return NextResponse.json({ error: "画像を保存できませんでした。" }, { status: 500 });
  }
}
