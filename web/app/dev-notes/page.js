import Link from "next/link";
import { notFound } from "next/navigation";
import { devNotesEnabled } from "@/lib/auth";
import { getDevNotes } from "@/lib/dev-notes";

export const dynamic = "force-dynamic";
export const metadata = { title: "開発者ノート" };

export default async function DevNotesPage({ searchParams }) {
  if (!devNotesEnabled()) notFound();
  const params = await searchParams;
  const allNotes = getDevNotes();
  const categories = [...new Set(allNotes.map((note) => note.category))];
  const notes = params.category
    ? allNotes.filter((note) => note.category === params.category)
    : allNotes;
  return (
    <>
      <p className="eyebrow">DEVELOPER NOTES</p>
      <h1 className="page-heading">開発者ノート</h1>
      <p className="page-lead">アップデート、開発記録、サーバー運用のことをお届けします。</p>
      <div className="notes-layout">
        <section>
          <div className="section-row">
            <h2 className="section-title">新着記事</h2>
            <span className="muted-copy">{notes.length} 件</span>
          </div>
          <div className="note-list">
            {notes.map((note) => (
              <article className="note-card" key={note.slug}>
                <div className="post-meta">
                  <span className="category-chip">{note.category}</span>
                  <time>{note.date}</time>
                </div>
                <h2>
                  <Link href={`/dev-notes/${note.slug}`}>{note.title}</Link>
                </h2>
                <p>{note.summary}</p>
                <Link className="text-link" href={`/dev-notes/${note.slug}`}>
                  続きを読む →
                </Link>
              </article>
            ))}
          </div>
        </section>
        <aside className="panel-card notes-sidebar">
          <h2>カテゴリー</h2>
          <ul className="category-list">
            {categories.map((category) => (
              <li key={category}>
                <Link href={`/dev-notes?category=${encodeURIComponent(category)}`}>{category}</Link>
              </li>
            ))}
          </ul>
          {params.category ? (
            <Link className="text-link" href="/dev-notes">
              すべての記事 →
            </Link>
          ) : null}
          <h2>人気記事</h2>
          {notes.slice(0, 3).map((note) => (
            <Link className="popular-note" href={`/dev-notes/${note.slug}`} key={note.slug}>
              {note.title}
            </Link>
          ))}
        </aside>
      </div>
    </>
  );
}
