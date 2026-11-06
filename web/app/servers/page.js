import Image from "next/image";
import Link from "next/link";
import { getGuilds } from "@/lib/data";
import { resolveGuilds } from "@/lib/rankings";
import { getDiscordGuild } from "@/lib/discord";

export const dynamic = "force-dynamic";
export const metadata = { title: "サーバーコミュニティ" };

export default async function ServersPage() {
  const guilds = await resolveGuilds(getGuilds());
  const servers = await Promise.all(Object.entries(guilds).map(async ([id, guild]) => {
    const detail = await getDiscordGuild(id);
    const icon = detail?.icon
      ? `https://cdn.discordapp.com/icons/${id}/${detail.icon}.png?size=128`
      : null;
    return { id, ...guild, icon };
  }));
  return (
    <>
      <p className="eyebrow">SERVERS</p>
      <h1 className="page-heading">サーバーコミュニティ</h1>
      <p className="page-lead">えっちがにBot導入サーバーごとのコミュニティです。</p>
      <div className="server-grid">
        {servers.length ? servers.map((server) => (
          <Link className="server-card panel-card" href={`/servers/${server.id}`} key={server.id}>
            {server.icon ? <Image alt="" height={56} src={server.icon} unoptimized width={56} /> : <span className="server-placeholder">♧</span>}
            <span><strong>{server.name}</strong><small>サーバーコミュニティを開く →</small></span>
          </Link>
        )) : <p className="empty-state">Bot導入サーバー情報がありません。</p>}
      </div>
    </>
  );
}
