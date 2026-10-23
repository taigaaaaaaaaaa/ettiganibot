import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Filter } from "lucide-react";
import { getDefaultAvatar } from "@/lib/discord";

const periods = [
  { id: "today", label: "今日" },
  { id: "weekly", label: "週間" },
  { id: "monthly", label: "月間" },
  { id: "total", label: "累計" },
];

export default function RankingTable({
  data,
  guilds = [],
  selectedGuildId = "",
  selectedMode = "count",
  selectedPeriod = "total",
  showGuilds = false,
}) {
  const basePath = selectedGuildId || !showGuilds ? "/ranking" : "/global-ranking";
  const query = selectedGuildId ? `&guildId=${encodeURIComponent(selectedGuildId)}` : "";
  const modeQuery = `mode=${selectedMode}&period=${selectedPeriod}`;
  const columnCount = 3 + Number(showGuilds) + Number(selectedMode !== "casino");

  return (
    <>
      <div className="toolbar">
        <nav aria-label="ランキング種別" className="period-tabs">
          <Link
            aria-current={selectedMode === "count" ? "page" : undefined}
            className={`period-tab ${selectedMode === "count" ? "is-active" : ""}`}
            href={`${basePath}?mode=count&period=${selectedPeriod}${query}`}
          >
            えっちがに数
          </Link>
          <Link
            aria-current={selectedMode === "casino" ? "page" : undefined}
            className={`period-tab ${selectedMode === "casino" ? "is-active" : ""}`}
            href={`${basePath}?mode=casino&period=${selectedPeriod}${query}`}
          >
            ettigani$
          </Link>
        </nav>
        {selectedGuildId || guilds.length ? (
          <form action="/ranking" className="guild-picker">
            <select aria-label="サーバー" defaultValue={selectedGuildId} name="guildId">
              <option value="">全体ランキング</option>
              {guilds.map((guild) => (
                <option key={guild.id} value={guild.id}>
                  {guild.name}
                </option>
              ))}
            </select>
            <input name="mode" type="hidden" value={selectedMode} />
            <input name="period" type="hidden" value={selectedPeriod} />
            <button
              aria-label="サーバーを選択"
              className="select-button"
              title="サーバーを選択"
              type="submit"
            >
              <Filter aria-hidden="true" size={17} />
            </button>
          </form>
        ) : null}
      </div>
      <nav aria-label="ランキング期間" className="period-tabs">
        {periods.map((period) => (
          <Link
            aria-current={selectedPeriod === period.id ? "page" : undefined}
            className={`period-tab ${selectedPeriod === period.id ? "is-active" : ""}`}
            href={`${basePath}?mode=${selectedMode}&period=${period.id}${query}`}
            key={period.id}
          >
            {period.label}
          </Link>
        ))}
      </nav>

      {selectedGuildId ? (
        <p className="rank-note">
          {selectedMode === "count"
            ? "サーバー内で記録されたスコアを表示しています。導入前の期間データは保存されていないため含まれません。"
            : "ettigani$は全サーバー共通の残高・増減を、選択したサーバーのメンバーに絞って表示しています。"}
        </p>
      ) : null}
      {!data.configured && selectedGuildId && selectedMode === "casino" ? (
        <p className="status-note">
          ettigani$のサーバー別表示にはDISCORD_BOT_TOKENと、Developer Portalで有効化したGuild
          Members Intentが必要です。えっちがに数のサーバー別ランキングは引き続き利用できます。
        </p>
      ) : null}
      {data.available === false ? (
        <p className="status-note">
          Discordからメンバー一覧を取得できませんでした。Botの権限とGuild Members
          Intentを確認してください。
        </p>
      ) : null}

      <div className="table-wrap">
        <table className="ranking-table">
          <thead>
            <tr>
              <th scope="col">順位</th>
              <th scope="col">ユーザー</th>
              {showGuilds ? (
                <th className="hide-mobile" scope="col">
                  所属サーバー
                </th>
              ) : null}
              {selectedMode === "count" ? (
                <th className="hide-mobile" scope="col">
                  レベル
                </th>
              ) : null}
              <th scope="col">
                {selectedMode === "casino"
                  ? selectedPeriod === "total"
                    ? "ettigani$"
                    : "ettigani$増減"
                  : "スコア"}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length ? (
              data.rows.map((row) => (
                <tr key={row.userId}>
                  <td
                    className={`rank-number ${row.rank <= 3 ? `top-${["one", "two", "three"][row.rank - 1]}` : ""}`}
                  >
                    {String(row.rank).padStart(2, "0")}
                  </td>
                  <td>
                    <Link
                      className="user-cell"
                      href={`/users/${row.userId}${selectedGuildId ? `?guildId=${encodeURIComponent(selectedGuildId)}` : ""}`}
                    >
                      <Image
                        alt=""
                        className="avatar"
                        height={38}
                        src={row.avatarUrl || getDefaultAvatar(row.userId)}
                        unoptimized
                        width={38}
                      />
                      <span className="user-names">
                        <span className="user-display">{row.displayName}</span>
                        <span className="user-handle">
                          {row.username === row.displayName ? row.userId : `@${row.username}`}
                        </span>
                      </span>
                    </Link>
                  </td>
                  {showGuilds ? (
                    <td className="hide-mobile">
                      {row.guilds.length ? (
                        <span className="guild-list">
                          {row.guilds.slice(0, 3).map((guild) => (
                            <span className="guild-tag" key={guild.id}>
                              {guild.name}
                            </span>
                          ))}
                          {row.guilds.length > 3 ? (
                            <span className="guild-tag">+{row.guilds.length - 3}</span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="user-handle">取得できません</span>
                      )}
                    </td>
                  ) : null}
                  {selectedMode === "count" ? (
                    <td className="level-value hide-mobile">Lv.{row.level}</td>
                  ) : null}
                  <td className="score-value">{row.score.toLocaleString("ja-JP")}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="empty-state" colSpan={columnCount}>
                  この期間のランキングデータはありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="rank-note">{data.total.toLocaleString("ja-JP")}人を対象に表示中</p>
      {data.total > data.limit ? (
        <nav aria-label="ランキングページ" className="home-actions">
          {data.offset > 0 ? (
            <Link
              className="action-link"
              href={`${basePath}?${modeQuery}${query}&offset=${Math.max(0, data.offset - data.limit)}`}
            >
              <ArrowLeft aria-hidden="true" size={16} />
              前へ
            </Link>
          ) : null}
          <span className="rank-note">
            {Math.floor(data.offset / data.limit) + 1} / {Math.ceil(data.total / data.limit)}ページ
          </span>
          {data.offset + data.limit < data.total ? (
            <Link
              className="action-link"
              href={`${basePath}?${modeQuery}${query}&offset=${data.offset + data.limit}`}
            >
              次へ
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
