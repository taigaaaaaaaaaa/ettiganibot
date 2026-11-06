import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getGuilds } from "@/lib/data";
import { resolveGuilds } from "@/lib/rankings";
import PostComposer from "@/components/post-composer";

export const dynamic = "force-dynamic";
export const metadata = { title: "投稿を作成" };

export default async function NewCommunityPostPage() {
  const user = await getSession();
  if (!user) redirect("/api/auth/discord");
  const guilds = await resolveGuilds(getGuilds());
  return (
    <>
      <p className="eyebrow"><Link href="/community">コミュニティ</Link> · 新規投稿</p>
      <h1 className="page-heading">投稿を作成</h1>
      <p className="page-lead">読みやすく、みんなに伝わる投稿を作りましょう。</p>
      <PostComposer
        guilds={Object.entries(guilds).map(([id, guild]) => ({ id, name: guild.name }))}
      />
    </>
  );
}
