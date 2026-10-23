export const metadata = { title: "プライバシーポリシー" };

export default function PrivacyPage() {
  return (
    <article className="prose">
      <p className="eyebrow">データの取り扱い</p>
      <h1 className="page-heading">プライバシーポリシー</h1>
      <p>本ポリシーは、えっちがにbotおよびランキングポータルが扱う情報について説明します。</p>
      <h2>Botが保存する情報</h2>
      <ul>
        <li>集計対象ユーザーのDiscord IDと、今日・週間・月間・累計のカウント。</li>
        <li>レベル、ettigani$残高、設定などのBot機能に必要な情報。</li>
        <li>
          メッセージ内容、ユーザー・Guild・チャンネル情報を含むキーワード検知ログや削除メッセージ。削除メッセージはGuildごとに直近5件を保存します。
        </li>
        <li>コマンド、ゲーム、ボイス読み上げに関する実行ログ。</li>
      </ul>
      <h2>Webサイトの表示</h2>
      <p>
        ランキングポータルは集計値を公開表示し、Botトークンが設定されている場合はDiscord
        APIからユーザー名、表示名、アバター、現在のGuild所属情報を取得します。取得に失敗した場合はDiscord
        IDとデフォルトアバターを表示します。WebサイトはDiscordログインや投稿フォームを提供しません。
      </p>
      <h2>外部サービスと保存</h2>
      <p>
        BotのJSONとログは運営環境内に保存されます。Discord
        APIおよびホーム画面のYouTube動画を利用する際は、各サービスへ通信が発生します。WebサーバーはBotの集計JSONを読み取り専用で参照し、トークンをブラウザーへ送信しません。
      </p>
      <h2>問い合わせ・削除依頼</h2>
      <p>
        保存データの確認や削除については、えっちがにbotの運営者（たいが discord id:1453020603819753603）へDiscord経由でお問い合わせください。Botログは自動削除される設定ではないため、運営者が適切に管理します。
      </p>
    </article>
  );
}
