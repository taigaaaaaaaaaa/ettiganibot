import { NextResponse } from "next/server";
import { devNotesEnabled, getSession, isAdmin } from "@/lib/auth";
import { rejectCrossOriginRequest } from "@/lib/csrf";
import { createDevNoteSlug, getDevNotes, updateDevNotes } from "@/lib/dev-notes";
import { validateDevNoteInput } from "@/lib/dev-notes-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorize(session) {
  if (!devNotesEnabled()) {
    return NextResponse.json({ error: "開発者ノート管理は無効です。" }, { status: 404 });
  }
  if (!session) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  if (!isAdmin(session))
    return NextResponse.json({ error: "管理者権限が必要です。" }, { status: 403 });
  return null;
}

export async function GET() {
  const session = await getSession();
  const denied = authorize(session);
  if (denied) return denied;
  return NextResponse.json({ notes: getDevNotes({ includeUnpublished: true }) });
}

export async function POST(request) {
  const rejected = rejectCrossOriginRequest(request);
  if (rejected) return rejected;
  const session = await getSession();
  const denied = authorize(session);
  if (denied) return denied;

  let input;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON形式のリクエストが必要です。" }, { status: 400 });
  }
  const validated = validateDevNoteInput(input);
  if (validated.error) return NextResponse.json({ error: validated.error }, { status: 400 });

  try {
    const now = new Date().toISOString();
    const note = {
      ...validated.note,
      slug: createDevNoteSlug(validated.note.title),
      author: session.globalName || session.username,
      createdAt: now,
      updatedAt: now,
    };
    const result = await updateDevNotes((notes) => {
      if (notes.some((item) => item.slug === note.slug)) {
        note.slug = `${note.slug}-${Date.now().toString(36)}`;
      }
      notes.unshift(note);
      return note;
    });
    return NextResponse.json({ note: result }, { status: 201 });
  } catch (error) {
    console.error("Developer note creation failed:", error);
    return NextResponse.json({ error: "記事を保存できませんでした。" }, { status: 500 });
  }
}
