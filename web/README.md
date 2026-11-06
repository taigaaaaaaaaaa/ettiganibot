# えっちがにランキングポータル（AI作成）

## 1. 現在のプロジェクト解析結果

- BotはES ModulesのJavaScript、discord.js v14、Express、node-cronで構成されています。Webは元々`web/index.html`のみで、Next.js設定やサイト用画像はありません。
- プロトタイプの背景`#2C2F33`、アクセント`#7289DA`、カニの上下アニメーション、70msごとの2%進行バー、400msごとのドット、完了後のフェード演出を共通レイアウトに移しました。元のHTMLは残しています。
- 既存のExpress APIはCLIから使うBAN/KICK専用で、`CLI_KEY`による保護があります。Web APIには流用していません。
- 集計JSONの読み込み対象を`counts.json`、`weekly.json`、`monthly.json`、`total.json`、`levels.json`、`setting.json`、`guilds.json`、`guild-rankings.json`、`casino.json`に限定しています。公開するのはcasinoランキングに必要なユーザーIDと期間別純増減・残高のみで、削除メッセージやログは対象外です。
- 既存の全体カウントはユーザーID単位で保存され、過去分のGuildは特定できません。変更後はメッセージを集計したGuildごとに今日・週間・月間・累計を`guild-rankings.json`へ記録します。過去分のGuild別スコアは推定・移行しません。
- Botはメッセージ中の「えっち」「エッチ」と🦀リアクションを集計します。リアクションではリアクターではなく対象メッセージの投稿者を加算します。

## 2. Bot機能一覧

コマンドは`ettiganibot/commands/`の`export const data`をAcornで解析して生成します。READMEの記述ではなく実装定義が情報源です。現在の登録数は26です。

- 集計・レベル: `/today`、`/weekly`、`/monthly`、`/total`、`/my_today`、`/my_weekly`、`/my_monthly`、`/my_total`、`/level`、`/level_rank`、`/next_level`
- 通貨・ゲーム: `/balance`、`/daily`、`/shop`、`/slot`、`/highlow`、`/blackjack`、`/ura_slot`、`/ura_dice`
- サーバー・その他: `/gamertag`、`/deletedmessage`、`/setting`、`/ping`、`/help`
- ボイス: `/ettigani_join`、`/ettigani_leave`

`/dice`は登録されていません。`commands/dice.js`が定義する正式名は`/ura_dice`です。

## 3. ランキング仕様

- 今日・週間・月間・累計は既存ファイルのユーザーID別データを正として表示します。週・月はBotが毎日加算し、既存のcron処理で期間リセットします。
- 既存期間データのGuild別回数は復元・推定しません。変更後に記録されたGuild別スコアをランキングに使います。導入前のGuild別スコアは含まれません。
- グローバルランキングは従来どおり全体カウントを使い、サーバーランキングはそのサーバーで記録されたカウントを使います。
- レベルは`levels.json`を使わず、累計値から`Math.floor(Math.sqrt(total))`で再計算します。
- 前回順位差分は履歴データがないため表示しません。
- Guildメンバー一覧はDiscord REST APIから取得し、プロセス内で90秒キャッシュします。プロフィール情報も失敗時はID表示とDiscord既定アバターにフォールバックします。

## 4. サイト要件

ホーム、ランキング、コミュニティを主導線とします。共通ナビ、モバイルメニュー、レスポンシブYouTube動画、ランキング期間選択、Guild絞り込み、ユーザー詳細、コミュニティ投稿・開発者ノート、ユーザー／サーバーページ、統計、検索可能なコマンド一覧、利用規約、プライバシーポリシーを実装しています。

全コードはJavaScriptです。TypeScript、`.ts`、`.tsx`、型定義は導入していません。

## 5. 画面設計

- ホーム: 歓迎見出し、お知らせ、YouTube動画の順に表示し、指定された「エッチ😍な蟹🦀、４選‼️‼️」も改行込みで掲載。その下に累計トップとランキング導線を配置。
- ランキング: えっちがに数とettigani$（今日・週間・月間・累計）の切り替え。ettigani$の日・週・月は獲得額から消費額を引いた純増減、累計は現在残高。任意Guildの現在メンバーによる絞り込み、50件ごとのページ送り。
- グローバルランキング: 順位、Discordアイコン、表示名、所属Guild、レベル、スコア。
- ユーザー詳細: Discord ID、表示名、レベル、Bot統計、投稿一覧、人気投稿、獲得いいね数。
- コミュニティ: Discordログイン、カテゴリー／タグ付き投稿、サムネイル、全体／サーバー限定公開、いいね、コメント、保存、ランキング。
- 開発者ノート: 公開記事は`app/data/dev-notes.json`へ保存し、管理者は`/admin/devnotes`でMarkdown記事の作成・編集・公開設定を管理。
- マイページ／サーバー: Bot統計、投稿履歴、アカウント設定、Bot導入サーバーごとのコミュニティページ。
- 統計: 累計総数、ユーザー数、Bot登録Guild数、累計から再計算したレベル分布。
- コマンド一覧: Botソースから生成した説明とオプションの検索。

## 6. ディレクトリ構成

```text
.
├─ .env.example
├─ docker-compose.yml
├─ deploy/
│  ├─ nginx.conf
│  └─ cloudflared/config.yml.example
├─ ettiganibot/
│  ├─ main.js
│  ├─ src/guildRegistry.js
│  └─ commands/
└─ web/
   ├─ app/                  # App RouterのページとAPI
   ├─ components/           # 共通ナビ、ローダー、ランキング、検索
   ├─ lib/                  # JSON、Discord API、ランキング処理
   ├─ scripts/              # Botコマンド定義のカタログ生成
   ├─ Dockerfile
   └─ package.json
```

## 7. 実装計画・拡張点

実装済み: Next.js App Router、JavaScript、Tailwind CSS v4、pnpm、ESLint、Prettier、Discordプロフィール取得、読み取り専用JSON API、Guild一覧記録、Docker/Compose、Nginx、Cloudflare Tunnel。

Discord OAuth2認証、認証付き投稿API、サーバーメンバーシップ確認を実装しています。公開ランキングAPIは引き続き公開情報のみを返します。コミュニティのJSON保存方式は単一Webプロセス向けであり、複数プロセスに拡張するときは共有データベースへ移行してください。

## 8. ソースコード

- `/api/rankings`: `period`, `guildId`, `limit`, `offset`を受け取りランキングを返します。
- `/api/users/[userId]`: ユーザー統計と順位を返します。任意の`guildId`に対応します。
- `/api/statistics`: 集計統計を返します。
- `/api/guilds`: Botが記録したGuild一覧を返します。
- コマンド一覧の生成: `pnpm run generate:commands`。

ホームのお知らせは`app/data/announcements.json`で管理します。次の形式で項目を追加すると表示されます。`title`と`body`は必須で、`url`はHTTPSのリンクだけ表示します。

```json
[
  {
    "date": "2026-10-03",
    "category": "更新",
    "title": "ランキングを公開しました",
    "body": "今日・週間・月間・累計のランキングを確認できます。",
    "url": "https://ettiganibot-dashboard.com/ranking"
  }
]
```

Docker運用ではこのJSONを`ANNOUNCEMENTS_HOST_PATH`で指定したホスト側ファイルから読み取ります。追加・編集はファイルを保存するだけで反映され、再ビルドは不要です。

Guild登録一覧はBot起動時とGuild参加・退出時に`ettiganibot/data/guilds.json`へ保存します。Discord Developer PortalでPrivileged Gateway Intentsの`Server Members Intent`を有効にし、Botを再起動してください。Webの`DISCORD_BOT_TOKEN`には同じBotのトークンをサーバー環境変数として設定します。ブラウザーへは渡しません。

## 9. コミュニティプラットフォーム

Discord OAuth2（`identify`スコープ）でログインし、HttpOnly署名付きCookieを7日間のセッションとして使います。Discord Developer Portalに次のRedirect URIを登録し、Compose環境変数でOAuth情報を設定してください。

Developer Portalでの操作手順、Windowsローカル環境と本番サーバーそれぞれの具体的な設定・再起動方法は、ルートの[README「Discordログインの設定」](../README.md#discordログインの設定)を参照してください。

```text
https://<公開ホスト名>/api/auth/discord/callback
```

必須の環境変数は`DISCORD_CLIENT_ID`、`DISCORD_CLIENT_SECRET`、`DISCORD_REDIRECT_URI`、32文字以上のランダムな`SESSION_SECRET`です。コミュニティ投稿は`COMMUNITY_DATA_DIR/community.json`へ、投稿画像は同ディレクトリの`uploads/`へ保存し、Botの統計ファイルとは分離しています。画像はJPEG・PNG・WebP形式で5MBまでアップロードできます。Dockerでは`COMMUNITY_DATA_DIR`の既定値は`/app/community-data`で、Composeの永続ボリュームと一致します。Composeの`community-data-init`サービスがホスト側ディレクトリを起動時にUID/GID 1001所有へ設定してからWebを起動します。複数Webプロセスへ水平スケールする場合は、JSONファイル保存を共有データベースへ置き換える必要があります。

OAuth state Cookieは`Path=/`、`SameSite=Lax`、本番では`Secure`で発行し、Domainは指定しないhost-only Cookieです。HTTPS上のDiscord callback（トップレベルGET）へ送信される設定です。Nginxは公開HostとCloudflareから受け取った`X-Forwarded-Proto`をNext.jsへ渡します。`DISCORD_REDIRECT_URI`は公開ドメインのcallback URLに設定してください。OAuth成功後は同じ公開オリジンのトップページへ戻ります。

ローカルでログインを試すには、Discord Developer PortalでOAuth2 Redirect URIに`http://localhost:3000/api/auth/discord/callback`を登録し、`web/.env.local`を作成します。以下の値を実際のDiscord Application情報に置き換えてから、開発サーバーを再起動してください。

```dotenv
DISCORD_CLIENT_ID=DiscordアプリケーションのClient ID
DISCORD_CLIENT_SECRET=DiscordアプリケーションのClient Secret
DISCORD_REDIRECT_URI=http://localhost:3000/api/auth/discord/callback
SESSION_SECRET=32文字以上のランダムな秘密値
```

`SESSION_SECRET`は`node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`で生成できます。`.env.local`やClient Secretは公開・コミットしないでください。本番ではサイトの`.env.local`ではなくCompose用`.env.site`へ設定し、Webコンテナを再起動します。設定がない場合、ログインボタンから設定不足の説明が表示されます。Client ID/Secret自体はアプリ管理者がDiscord Developer Portalで用意する必要があり、このリポジトリには含まれません。

コミュニティトップは`/community`です。Discordログイン後、カテゴリー・タグ・サムネイル・全体公開またはBot導入サーバー限定を設定した投稿を作成でき、投稿ごとにコメント・いいね・保存を利用できます。投稿者本人または`ADMIN_IDS`で指定した管理者は、投稿カードのメニューから投稿を編集・削除できます。サーバー限定投稿はBotトークンでDiscordメンバーシップを確認し、未ログインまたは対象サーバー外のユーザーには表示しません。開発者ノートは一般ユーザーには公開記事のみ表示され、管理者は`/admin/devnotes`から作成・編集・削除、公開日時や公開状態を管理します。`ADMIN_IDS`はDiscord User IDをカンマ区切りで指定し、`DEV_NOTES_HOST_PATH`で管理JSONの永続保存先を設定します。

コミュニティ操作はユーザーごとに、いいね（解除を含む）を1分20回、コメントを1分5回、返信を1分5回に制限します。超過時はHTTP 429と`Retry-After`を返します。いいね通知は投稿ごとに最初のいいねから5分間、コメント通知は同一投稿ごと、返信通知は同一コメントごとに3分間集約します。同じ送信者から同じ受信者への通知は種類・投稿にかかわらず30秒間隔を空けます。メンション・管理者通知は即時通知キューで集約通知より優先されます。通知はコミュニティJSON内の永続キューへ記録し、Discord DMは最大1秒に1件ずつ送信します。Discord 429は`Retry-After`に従って最大2回再試行し、待機時間が30秒を超える場合は再試行せず失敗ログへ記録します。通知の失敗は投稿・コメント操作を取り消しません。コミュニティJSONの更新キューと通知ディスパッチは単一Webプロセスを前提としており、Webを複数プロセスへ水平スケールする場合は共有DB／キューと分散ロックへ移行してください。

## 10. Docker関連

`web/Dockerfile`はサイトディレクトリ単独をbuild contextとして、Next.js standaloneをNode 22 Alpineで実行します。ComposeはWebとNginxを起動します。`WEB_BUILD_CONTEXT`、`BOT_DATA_HOST_PATH`、`ANNOUNCEMENTS_HOST_PATH`、`COMMUNITY_DATA_HOST_PATH`、`DEV_NOTES_HOST_PATH`は環境変数で指定できます。Botのdataディレクトリとお知らせJSONはWebへ読み取り専用でマウントし、コミュニティデータと開発者ノートのJSONを含むディレクトリは書き込み可能な永続領域としてマウントします。Bot自体は既存の`/bots/ettiganibot/`で起動し続けます。

本番の配置では、Botソース全体をDocker build contextに含めません。コマンド一覧は同梱済み`app/data/commands.json`を使います。Botのcommandsを変更したときは、ソースリポジトリの`web/`で`corepack pnpm generate:commands`を実行してからサイトファイルを同期してください。

## 11. Nginx設定

`deploy/nginx.conf`は公開Hostを`Host`と`X-Forwarded-Host`で、Cloudflareからの`X-Forwarded-Proto`を`web:3000`へ渡します。ホスト側公開ポートは`127.0.0.1:8080`に限定し、外部公開経路はCloudflare Tunnelにします。

## 12. Cloudflare Tunnel設定

このサーバーのTunnelは`/etc/cloudflared/config.yml`を使うローカル管理方式です。Compose内に別の`cloudflared` Connectorを起動せず、既存のホスト側Tunnel ingressを`http://127.0.0.1:8080`へ向けます。同じTunnelにtoken方式のConnectorを重ねると、ローカル設定を読み込まないConnectorへ割り当てられたリクエストが503になります。DashboardからTunnel migrationを行う必要はありません。

## 13. デプロイ手順

1. Ubuntu ServerにDocker Engine、Docker Compose plugin、Git、`rsync`を用意します。
2. Botコードを`/bots/ettiganibot/`へ反映し、Developer PortalでServer Members Intentを有効にしてBotを再起動します。`/bots/ettiganibot/data/guilds.json`が生成されたことを確認します。
3. サイトの`web/`の中身を既存サイトの場所へ同期します。`index.html`は配布物にも含まれており、プロトタイプの内容を保持します。

   ```bash
   rsync -a --exclude node_modules/ --exclude .next/ /path/to/repository/web/ /var/www/ettiganibot-dashboard.com/public_html/
   ```

4. ComposeとNginx設定をBotディレクトリへ配置します。

   ```bash
   cp /path/to/repository/docker-compose.yml /bots/ettiganibot/
   cp /path/to/repository/.env.example /bots/ettiganibot/.env.example
   mkdir -p /bots/ettiganibot/deploy
   cp /path/to/repository/deploy/nginx.conf /bots/ettiganibot/deploy/
   cd /bots/ettiganibot
   cp .env.example .env.site
   ```

5. `/bots/ettiganibot/.env.site`に以下を設定します。既存Botの`.env`は上書きせず、Bot tokenは秘密情報として扱い、Gitに登録しないでください。

   ```dotenv
   WEB_BUILD_CONTEXT=/var/www/ettiganibot-dashboard.com/public_html
   BOT_DATA_HOST_PATH=/bots/ettiganibot/data
   ANNOUNCEMENTS_HOST_PATH=/var/www/ettiganibot-dashboard.com/public_html/app/data/announcements.json
   DISCORD_BOT_TOKEN=実際のBotトークン
   ```

6. `/etc/cloudflared/config.yml`のexisting hostname ingressを`http://127.0.0.1:8080`に向けます。既存TunnelをDashboardへ移行する必要はありません。
7. `/bots/ettiganibot/`から`docker compose --env-file .env.site up -d --build`を実行し、`docker compose --env-file .env.site ps`でWebがhealthyか確認します。古いCompose版で作った重複cloudflared containerが残っていれば一度だけ`docker rm -f ettiganibot-cloudflared-1`で削除します。
8. ホスト上の既存cloudflaredを`systemctl restart cloudflared`で再起動し、`journalctl -u cloudflared -n 50 --no-pager`でIngressエラーがないことを確認します。Cloudflareのホスト名でページ、ランキング、ユーザー詳細を確認します。Bot停止中も最後のJSONは表示できますが、Guild登録情報とDiscordプロフィールは更新されません。

ローカル開発は`cd web`、`corepack pnpm install`、`corepack pnpm dev`の順です。ビルド時にコマンドカタログが`ettiganibot/commands/`から再生成されます。
