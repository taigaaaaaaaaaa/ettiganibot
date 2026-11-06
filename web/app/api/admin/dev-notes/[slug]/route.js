import { NextResponse } from "next/server";
import { devNotesEnabled, getSession, isAdmin } from "@/lib/auth";
import { rejectCrossOriginRequest } from "@/lib/csrf";
import { updateDevNotes } from "@/lib/dev-notes";
import { validateDevNoteInput } from "@/lib/dev-notes-validation";

export const runtime = "nodejs";

async function authorize() {
  if (!devNotesEnabled()) {
    return {
      response: NextResponse.json({ error: "開発者ノート管理は無効です。" }, { status: 404 }),
    };
  }
  const session = await getSession();
  if (!session)
    return { response: NextResponse.json({ error: "ログインが必要です。" }, { status: 401 }) };
  if (!isAdmin(session)) {
    return { response: NextResponse.json({ error: "管理者権限が必要です。" }, { status: 403 }) };
  }
  return { session };
}

export async function PATCH(request, { params }) {
  const rejected = rejectCrossOriginRequest(request);
  if (rejected) return rejected;
  const { session, response } = await authorize();
  if (response) return response;
  let input;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON形式のリクエストが必要です。" }, { status: 400 });
  }
  const validated = validateDevNoteInput(input);
  if (validated.error) return NextResponse.json({ error: validated.error }, { status: 400 });
  const { slug } = await params;
  try {
    const result = await updateDevNotes((notes) => {
      const note = notes.find((item) => item.slug === slug);
      if (!note) return null;
      Object.assign(note, validated.note, {
        updatedAt: new Date().toISOString(),
        author: note.author || session.globalName || session.username,
      });
      return note;
    });
    if (!result) return NextResponse.json({ error: "記事が見つかりません。" }, { status: 404 });
    return NextResponse.json({ note: result });
  } catch (error) {
    console.error("Developer note update failed:", error);
    return NextResponse.json({ error: "記事を保存できませんでした。" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const rejected = rejectCrossOriginRequest(request);
  if (rejected) return rejected;
  const { response } = await authorize();
  if (response) return response;
  const { slug } = await params;
  try {
    const result = await updateDevNotes((notes) => {
      const index = notes.findIndex((item) => item.slug === slug);
      if (index < 0) return false;
      notes.splice(index, 1);
      return true;
    });
    if (!result) return NextResponse.json({ error: "記事が見つかりません。" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Developer note deletion failed:", error);
    return NextResponse.json({ error: "記事を削除できませんでした。" }, { status: 500 });
  }
}
