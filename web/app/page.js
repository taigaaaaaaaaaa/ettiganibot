import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Globe2, Trophy } from "lucide-react";
import { getDefaultAvatar } from "@/lib/discord";
import { getRankings } from "@/lib/rankings";
import { getAnnouncementLink, getAnnouncements } from "@/lib/announcements";
import RankingDataLoader from "@/components/ranking-data-loader";

const story = `①エッチ😍ガニ🦀‼️‼️‼️
エッチ😍ガニ🦀は😃、エッチ😍‼️‼️

②毛👨‍🦰蟹🦀

③どこ🌃にも🤔居場所🏠が無い✖️蟹🦀
みんな👪、誰と🙋‍♀️、どうやって🤷‍♀️、寄り添うんだろう👩‍❤️‍💋‍👨
あたし🙍‍♀️には🤦‍♀️わかんないや🙅‍♀️

④スケベ🤩ガニ🦀`;

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }) {
  const params = await searchParams;
  const mode = params.mode === "casino" ? "casino" : "count";
  const [ranking, announcements] = await Promise.all([
    getRankings({ mode, period: "total", limit: 5, includeAffiliations: false }),
    Promise.resolve(getAnnouncements()),
  ]);

  return (
    <>
      <RankingDataLoader preloadRankings />
      <section aria-labelledby="welcome-title" className="home-welcome">
        <p className="eyebrow">このサイトについて</p>
        <h1 className="welcome-title" id="welcome-title">
          えっちがにbotの公式サイトへようこそ！
        </h1>
        <p className="page-lead">
          たいがが作ったえっちがにbotの公式サイトです！！
          このサイトでは、えっちがにbotが記録したランキングや統計、ユーザーごとの活動状況を確認できます！
          このサイト、マジで死ぬほど頑張って作りました。マジで隅々まで見てほしい。
        </p>
        <div className="home-actions">
          <Link className="action-link primary" href="/ranking">
            <Trophy aria-hidden="true" size={17} />
            ランキングを見る
          </Link>
          <Link className="action-link" href="/statistics">
            <Globe2 aria-hidden="true" size={17} />
            統計を見る
          </Link>
          <Link className="action-link" href="/commands">
            <ArrowRight aria-hidden="true" size={17} />
            コマンド一覧
          </Link>
        </div>
      </section>

      <section aria-labelledby="announcements-title" className="announcement-section">
        <div className="section-row">
          <div>
            <p className="eyebrow">更新情報</p>
            <h2 className="section-title" id="announcements-title">
              お知らせ
            </h2>
          </div>
        </div>
        {announcements.length ? (
          <ul className="announcement-list">
            {announcements.map((announcement, index) => {
              const link = getAnnouncementLink(announcement.url);
              return (
                <li className="announcement-item" key={`${announcement.date || "notice"}-${index}`}>
                  <div className="announcement-meta">
                    {announcement.date ? <time>{announcement.date}</time> : null}
                    {announcement.category ? (
                      <span className="announcement-category">{announcement.category}</span>
                    ) : null}
                  </div>
                  <h3>{announcement.title}</h3>
                  <p>{announcement.body}</p>
                  {link ? (
                    <a href={link} rel="noreferrer" target="_blank">
                      詳細を見る <ArrowRight aria-hidden="true" size={14} />
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="announcement-empty">現在お知らせはありません。</p>
        )}
      </section>

      <section aria-label="えっちがに動画">
        <div className="video-frame">
          <iframe
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            src="https://www.youtube-nocookie.com/embed/qSu-c-fiTG0?si=1TZO2W6L1vBe1Hgx"
            title="エッチな蟹 4選"
          />
        </div>
      </section>

      <section className="home-copy">
        <h2>エッチ😍な蟹🦀、４選‼️‼️</h2>
        <p>{story}</p>
      </section>

      <section className="home-ranking">
        <div className="section-row">
          <div>
            <p className="eyebrow">
              {mode === "casino" ? "ettigani$ランキング" : "えっちがにランキング"}
            </p>
            <h2 className="section-title">
              {mode === "casino" ? "所持残高トップランカー" : "累計トップランカー"}
            </h2>
            <nav aria-label="ホームランキング種別" className="period-tabs">
              <Link
                aria-current={mode === "count" ? "page" : undefined}
                className={`period-tab ${mode === "count" ? "is-active" : ""}`}
                href="/?mode=count"
              >
                えっちがに数
              </Link>
              <Link
                aria-current={mode === "casino" ? "page" : undefined}
                className={`period-tab ${mode === "casino" ? "is-active" : ""}`}
                href="/?mode=casino"
              >
                ettigani$
              </Link>
            </nav>
          </div>
          <Link className="text-link" href={`/global-ranking?mode=${mode}&period=total`}>
            すべて見る <ArrowRight aria-hidden="true" size={15} />
          </Link>
        </div>
        <div className="table-wrap">
          <table className="ranking-table">
            <thead>
              <tr>
                <th scope="col">順位</th>
                <th scope="col">ユーザー</th>
                <th className="hide-mobile" scope="col">
                  レベル
                </th>
                <th scope="col">{mode === "casino" ? "ettigani$" : "累計"}</th>
              </tr>
            </thead>
            <tbody>
              {ranking.rows.length ? (
                ranking.rows.map((row) => (
                  <tr key={row.userId}>
                    <td
                      className={`rank-number ${row.rank <= 3 ? `top-${["one", "two", "three"][row.rank - 1]}` : ""}`}
                    >
                      {String(row.rank).padStart(2, "0")}
                    </td>
                    <td>
                      <Link className="user-cell" href={`/users/${row.userId}`}>
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
                          <span className="user-handle">{row.username}</span>
                        </span>
                      </Link>
                    </td>
                    {mode === "count" ? (
                      <td className="level-value hide-mobile">Lv.{row.level}</td>
                    ) : null}
                    <td className="score-value">{row.score.toLocaleString("ja-JP")}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="empty-state" colSpan={mode === "count" ? 4 : 3}>
                    まだランキングデータがありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="home-actions">
          <Link className="action-link primary" href="/ranking">
            <Trophy aria-hidden="true" size={17} />
            ランキングを見る
          </Link>
          <Link className="action-link" href="/global-ranking">
            <Globe2 aria-hidden="true" size={17} />
            グローバルランキング
          </Link>
        </div>
      </section>

      <section aria-labelledby="thanks-title" className="home-copy">
        <h2 id="thanks-title">ありがとう。</h2>
        <p>
          このbotを作るきっかけをくれたみんなへ。本当にありがとうございました。みんながいなかったら今の僕はいませんでした。
          本当にありがとう。そして、これからもよろしくお願いします。
          また話す機会があればみんなと話したいです。バカみたいなこといっぱい話したり、みんなでゲームしたりしたいです。
          とにかく、本当にありがとうございました。
        </p>
      </section>
    </>
  );
}
/* しらたまさん、チョコさん、アジシオさん、creamさん、しゅうさん。ありがとう。*/
