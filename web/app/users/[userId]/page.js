import Image from "next/image";
import { notFound } from "next/navigation";
import { Filter } from "lucide-react";
import { getDefaultAvatar } from "@/lib/discord";
import { getGuilds } from "@/lib/data";
import { getUserProfile, resolveGuilds } from "@/lib/rankings";

export const dynamic = "force-dynamic";

export default async function UserPage({ params, searchParams }) {
  const { userId } = await params;
  const query = await searchParams;
  if (!/^\d{17,20}$/.test(userId)) notFound();

  const profile = await getUserProfile(userId, query.guildId || null);
  const guilds = await resolveGuilds(getGuilds());
  const values = [
    ["今日", profile.today],
    ["今週", profile.weekly],
    ["今月", profile.monthly],
    ["累計", profile.total],
  ];
  const casinoValues = [
    ["今日", profile.casino.today],
    ["今週", profile.casino.weekly],
    ["今月", profile.casino.monthly],
    ["累計", profile.casino.total],
  ];

  return (
    <>
      <p className="eyebrow">ランキングユーザー</p>
      <section className="profile-head">
        <Image
          alt=""
          className="profile-avatar"
          height={88}
          src={profile.avatarUrl || getDefaultAvatar(userId)}
          unoptimized
          width={88}
        />
        <div className="profile-name">
          <h1>{profile.displayName}</h1>
          <p>
            {profile.username === userId
              ? `Discord ID: ${userId}`
              : `@${profile.username} · ${userId}`}
          </p>
        </div>
        <div className="profile-level">Lv.{profile.level}</div>
      </section>

      <section aria-label="えっちがに数" className="profile-stats">
        {values.map(([label, value]) => (
          <article className="profile-stat" key={label}>
            <span>{label}</span>
            <strong>{value.toLocaleString("ja-JP")}</strong>
          </article>
        ))}
      </section>

      <h2 className="section-title profile-section-title">ettigani$</h2>
      <section aria-label="ettigani$" className="profile-stats">
        {casinoValues.map(([label, value]) => (
          <article className="profile-stat" key={label}>
            <span>{label}</span>
            <strong>{value.toLocaleString("ja-JP")}</strong>
          </article>
        ))}
      </section>

      <section aria-label="順位" className="profile-ranks">
        <article className="profile-rank">
          <span>グローバル順位</span>
          <strong>{profile.globalRank ? `#${profile.globalRank}` : "圏外"}</strong>
        </article>
        {query.guildId ? (
          <article className="profile-rank">
            <span>{guilds[query.guildId]?.name || "サーバー"} 順位</span>
            <strong>{profile.guildRank ? `#${profile.guildRank}` : "順位なし"}</strong>
          </article>
        ) : null}
      </section>
      {Object.keys(guilds).length ? (
        <form action={`/users/${userId}`} className="guild-picker" style={{ marginTop: 18 }}>
          <select aria-label="サーバー順位" defaultValue={query.guildId || ""} name="guildId">
            <option value="">サーバー順位を選択</option>
            {Object.entries(guilds).map(([guildId, guild]) => (
              <option key={guildId} value={guildId}>
                {guild.name}
              </option>
            ))}
          </select>
          <button aria-label="順位を表示" className="select-button" type="submit">
            <Filter aria-hidden="true" size={17} />
          </button>
        </form>
      ) : null}
      <p className="rank-note">
        レベルは保存済みlevels.jsonではなく、累計から floor(sqrt(total)) で再計算しています。
      </p>
    </>
  );
}
