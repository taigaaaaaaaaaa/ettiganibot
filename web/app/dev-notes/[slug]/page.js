import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import MarkdownContent from "@/components/markdown-content";
import { devNotesEnabled } from "@/lib/auth";
import { getDevNote } from "@/lib/dev-notes";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  return { title: getDevNote(slug)?.title || "開発者ノート" };
}

export default async function DevNotePage({ params }) {
  if (!devNotesEnabled()) notFound();
  const { slug } = await params;
  const note = getDevNote(slug);
  if (!note) notFound();
  return (
    <article className="article-layout note-article">
      <p className="eyebrow">
        <Link href="/dev-notes">開発者ノート</Link> · {note.category}
      </p>
      <header className="article-header">
        <h1>{note.title}</h1>
        <p className="note-byline">
          {note.author} · <time>{note.date}</time>
        </p>
        {note.summary ? <p className="article-summary">{note.summary}</p> : null}
      </header>
      {note.imageUrl ? (
        <Image
          alt=""
          className="article-cover"
          height={520}
          src={note.imageUrl}
          unoptimized
          width={1040}
        />
      ) : null}
      <div className="article-body">
        <MarkdownContent source={note.body} />
      </div>
      <Link className="text-link" href="/dev-notes">
        ← 開発者ノート一覧に戻る
      </Link>
    </article>
  );
}
