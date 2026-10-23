export const metadata = { title: "利用規約" };

export default function TermsPage() {
  return (
    <article className="prose">
      <p className="eyebrow">えっちがにbot ランキングポータル</p>
      <h1 className="page-heading">利用規約</h1>
      <p>本サイトを利用する場合、以下の内容に同意したものとします。</p>
      <h2>提供情報</h2>
      <p>
        ランキングと統計はBotが保存するJSONデータおよびDiscordから取得できた情報をもとに表示します。更新タイミングや取得状況により、Discord上の最新状態と異なる場合があります。
      </p>
      <h2>利用上の注意</h2>
      <p>
        本サイトの情報を利用したことによる損害について、運営者（たいが discord id:1453020603819753603）は故意または重大な過失がある場合を除き責任を負いません。予告なく表示内容やサービスを変更・停止する場合があります。
      </p>
      <h2>知的財産・外部サービス</h2>
      <p>
        DiscordおよびYouTubeは各権利者が提供するサービスです。本サイトはDiscord,
        Inc.の公式サービスではありません。外部サービスの利用には各サービスの規約が適用されます。
      </p>
      <h2>規約の変更</h2>
      <p>本規約は必要に応じて更新されます。掲載後の規約が本サイトの利用に適用されます。</p>
    </article>
  );
}
