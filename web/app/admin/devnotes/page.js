import { notFound } from "next/navigation";
import DevNotesAdmin from "@/components/dev-notes-admin";
import { devNotesEnabled, getSession, isAdmin } from "@/lib/auth";
import { getDevNotes } from "@/lib/dev-notes";

export const dynamic = "force-dynamic";
export const metadata = { title: "開発者ノート管理" };

export default async function DevNotesAdminPage() {
  const user = await getSession();
  if (!devNotesEnabled() || !isAdmin(user)) notFound();
  return <DevNotesAdmin initialNotes={getDevNotes({ includeUnpublished: true })} />;
}
