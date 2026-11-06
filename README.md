# えっちがにbot

このbotはくだらん機能しかついてないdiscord botです。
これはプログラミング初めたての時からコツコツ作り上げたものです。
本当に個人的なことになりますが、書かせてください。
このbotを作ることになったときにいた人たちに感謝を。本当にありがとうございました。
あなた達がいなければ今の私はいませんでした。
### 本当に、本当にありがとうございました。

本当にこのbotには私の思い出が詰まってます。よかったら使ってください。

## 目次

- [機能](#機能)
- [必要な環境](#必要な環境)
- [Discord Botの準備](#discord-botの準備)
- [インストールと設定](#インストールと設定)
- [起動と確認](#起動と確認)
- [スラッシュコマンド](#スラッシュコマンド)
- [データとプライバシー](#データとプライバシー)
- [ランキングWebポータル](#ランキングwebポータル)
- [Discordログインの設定](#discordログインの設定)
- [デプロイ手順](DEPLOYMENT.md)

## 機能

- 「えっち」を含むメッセージと 🦀 リアクションをカウントし、レベルを管理
- キーワードに応じた返信と日付別ログの保存
- 日間・週間・月間のランキングとettigani$ランキングの自動投稿
- 削除メッセージの保存と直近5件の表示
- `/daily` やゲームで使うettigani$、色ロールショップ
- Fish Audioを使ったボイスチャンネルの読み上げ
- 起動中のコンソールからチャンネル送信・全サーバーへの告知
- `CLI_KEY` で保護されたローカルAPI経由のBAN・KICK
- CLI APIからBotが参加しているサーバー名とIDを表示

## 必要な環境

- Node.js 20以上
- npm
- DiscordアカウントとDeveloper Portalで作成したBot

Node.jsは[公式サイト](https://nodejs.org/)からインストールしてください。バージョンは次のコマンドで確認できます。

```cmd
node --version
npm --version
```

## Discord Botの準備

1. Discord Developer PortalでApplicationを作成し、Botを追加します。
2. Botのトークンを発行し、`Message Content Intent` を有効にします。
3. OAuth2の招待URLで `bot` と `applications.commands` のScopeを選びます。
4. 必要な権限を付けてBotをサーバーへ招待します。

基本の権限は `View Channels`、`Send Messages`、`Embed Links`、`Read Message History` です。機能に応じて追加してください。

| 権限 | 用途 |
| --- | --- |
| `Connect`、`Speak` | ボイスチャンネルでの読み上げ |
| `Manage Roles` | ショップロールの作成・付与、およびレベル報酬ロールの付与 |
| `Ban Members`、`Kick Members` | CLIからBAN・KICKを実行 |

Botのロールは、付与する対象ロールより上に配置してください。必要以上に広い権限を付けず、使う機能に必要な権限だけを付与してください。

## インストールと設定

リポジトリのルートから実行します。

```cmd
cd ettiganibot
npm install
copy .env.example .env
```

`.env` を開いて、利用する機能に必要な値を設定します。

| 変数 | 必須条件 | 説明 |
| --- | --- | --- |
| `TOKEN` | 必須 | Discord Botのトークン |
| `CLI_KEY` | CLI APIを使う場合 | CLI API認証用の長くランダムな文字列 |
| `FISH_AUDIO_API_KEY` | 読み上げを使う場合 | Fish Audio APIキー |
| `FISH_AUDIO_REFERENCE_ID` | 読み上げを使う場合 | Fish Audioの音声Reference ID |
| `FISH_AUDIO_MODEL` | 任意 | 音声モデル。省略時は `s2.1-pro-free` |
| `TARGET_BOT_ID` | 不要 | `.env.example` にありますが、現バージョンでは使用していません |

BotトークンやAPIキーをGitHub、チャット、スクリーンショットなどに公開しないでください。トークンが漏れた場合はDeveloper Portalで再生成してください。

## 起動と確認

```cmd
npm start
```

開発時はファイル変更で再起動する `npm run dev` も使えます。`npm run check` は `main.js` の構文のみを確認します。

Botが起動すると、既存サーバーへのスラッシュコマンド登録と、ポート `3000` のCLI APIサーバー起動を行います。新しいサーバーに参加すると、コマンド登録後に初期設定の案内を送信します。ランキング投稿先はサーバー管理者が `/setting` で設定してください。

日本時間で毎日23:59:59に日間ランキングを投稿し、当日に投稿された公開コミュニティ記事も同梱します。ettigani$ランキングは毎日0時、週間ランキングは毎週月曜0時、月間ランキングは毎月1日0時に投稿します。

## スラッシュコマンド

### 集計・レベル

| コマンド | 内容 |
| --- | --- |
| `/today`、`/weekly`、`/monthly`、`/total` | サーバー内メンバーの集計を表示 |
| `/my_today`、`/my_weekly`、`/my_monthly`、`/my_total` | 自分の集計を表示 |
| `/level`、`/level_rank`、`/next_level` | レベル、レベルランキング、次のレベルまでの回数を表示 |
| `/gamertag user:<ユーザー>` | 登録済みのMinecraftゲーマータグを表示 |
| `/deletedmessage` | サーバーで削除された直近5件を表示 |
| `/setting channel:<チャンネル>` | ランキング投稿先を設定（サーバー管理者向け） |
| `/ping`、`/help` | 応答速度、Botのヘルプを表示 |

### ettigani$

| コマンド | 内容 |
| --- | --- |
| `/balance` | 残高を表示 |
| `/daily` | 1日1回、1,000 ettigani$を受け取る |
| `/shop list`、`/shop buy` | 色ロール一覧、色ロールの購入 |
| `/slot bet:<金額>`、`/highlow bet:<金額> guess:<予想>` | スロット、HIGH/LOWゲーム |
| `/blackjack bet:<金額>` | ブラックジャック |
| `/ura_slot bet:<金額>` | 高額ベットの裏スロット |
| `/ura_dice bet:<金額>` | 高額ベットのダイスゲーム |

残高とデイリー受取状況は全サーバー共通です。ゲームにはベット額などの条件があります。実行時に表示される説明を確認してください。

### ボイス読み上げ

| コマンド | 内容 |
| --- | --- |
| `/ettigani_join` | 自分が参加中のボイスチャンネルで読み上げを開始 |
| `/ettigani_leave` | 読み上げを終了して退出 |

読み上げにはFish AudioのAPIキーとReference IDが必要です。参加者の入退室と、読み上げ対象ボイスチャンネルと同じカテゴリにあるテキストチャンネルのメッセージを読み上げます。

## コンソール・CLI

Bot起動中のコンソールでは、チャンネルIDとメッセージを入力すると指定チャンネルへ送信できます。全サーバーへの告知は次の形式です。

```text
broadcast お知らせです
broadcast 1行目\n2行目
```

告知は各サーバーで `Send Messages` と `Embed Links` が使えるテキストチャンネルを選びます。送信先のないサーバーはスキップされます。

CLI APIはBotと同時に `http://localhost:3000/api` で起動します。別のコンソールから `ettiganibot` ディレクトリで実行してください。

```cmd
node cli.js servers
node cli.js ban <userId> <guildId>
node cli.js kick <userId> <guildId>
```

`.env` の `CLI_KEY` が必要です。APIサーバーをインターネットへ直接公開せず、ファイアウォールなどでアクセス元を制限してください。

`servers` はBotが参加しているサーバー名とIDを表示します。

## データとプライバシー

データは `ettiganibot/data/` にJSONと日付別ログとして保存されます。主なファイルは `counts.json`、`weekly.json`、`monthly.json`、`total.json`、`levels.json`、`casino.json`、`setting.json`、`gamertag.json`、`roleShop.json` です。削除メッセージは `guilds/<guildId>/DeletedMessage.json` にサーバーごとに保存されます。

`logs/YYYY-MM-DD.log` にはキーワード検知、メッセージ内容、コマンド実行、ゲーム、ボイスイベントなどが記録されます。ログや保存データを共有・公開する前に、個人情報やメッセージ内容が含まれていないか確認してください。バックアップや移行の際はBotを停止してから `data/` をコピーしてください。

## 主な構成

```text
.
├─ README.md
├─ web/
│  └─ index.html
└─ ettiganibot/
   ├─ main.js             # Bot起動、定期処理、コンソール送信
   ├─ api.js / cli.js     # CLI APIとCLIクライアント
   ├─ commands/           # スラッシュコマンド
   ├─ src/                # イベント、ランキング、データ、音声処理
   └─ data/               # 実行時データとログ
```

## ランキングWebポータル

Next.js版のサイト仕様・ランキングデータの扱い・Docker Composeでの公開手順は[web/README.md](web/README.md)を参照してください。WebサイトはBotのJSONを読み取り専用で利用します。

Ubuntuでの起動・更新手順をすぐ確認する場合は[DEPLOYMENT.md](DEPLOYMENT.md)を参照してください。

## Discordログインの設定

Discordログインを有効にするには、Discord Developer PortalでOAuth2情報を取得し、Webサイトの環境変数に設定します。Botのトークン（`TOKEN` / `DISCORD_BOT_TOKEN`）とは別の設定です。OAuthのClient Secretと`SESSION_SECRET`はパスワードと同じように扱い、チャット、スクリーンショット、GitHubには載せないでください。

### 1. Discord Developer PortalでOAuth2を設定する

1. [Discord Developer Portal](https://discord.com/developers/applications)にログインします。
2. 既存Botと同じDiscordアプリケーションを使う場合は、そのApplicationを開きます。まだApplicationがない場合は「New Application」で作成します。
3. 「General Information」にある**Application ID**を控えます。これが`DISCORD_CLIENT_ID`です。
4. 「OAuth2」設定を開き、**Client Secret**を確認または再生成して控えます。これが`DISCORD_CLIENT_SECRET`です。Secretは外部に共有しないでください。
5. OAuth2のRedirectsに、利用する環境のURLを追加して保存します。URLは末尾のパスまで完全一致させます。

ローカル開発用:

```text
http://localhost:3000/api/auth/discord/callback
```

本番用（このサイトの公開URL）:

```text
https://ettiganibot-dashboard.com/api/auth/discord/callback
```

OAuth2では`identify`スコープを使います。サイト側で認証URLに指定するため、ほかのスコープを追加する必要はありません。既存のBotアプリケーションを使っても、BotトークンをWebへ設定したり、DiscordへのBot招待をやり直したりする必要はありません。

### 2. ローカルで試す（Windows）

リポジトリの`web`フォルダーに`.env.local`を作ります。PowerShellの場合:

```powershell
Set-Location "C:\bots\えっちがにbot二台目\web"
notepad .env.local
```

メモ帳で`web/.env.local`が開くので、次の内容を入力して保存してください。ファイルがまだない場合は新規作成を確認します。Client IDとClient SecretはDeveloper Portalで控えた実際の値に置き換えます。

```dotenv
DISCORD_CLIENT_ID=ここにApplication_ID
DISCORD_CLIENT_SECRET=ここにClient_Secret
DISCORD_REDIRECT_URI=http://localhost:3000/api/auth/discord/callback
SESSION_SECRET=ここにランダムな64文字以上の値
```

`SESSION_SECRET`はPowerShellで次のコマンドを実行して生成できます。表示された値を`.env.local`の`SESSION_SECRET`へ貼り付けます。

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

ファイルを保存したら、開発サーバーを起動しているターミナルで`Ctrl+C`を押して停止し、次のように再起動します。

```powershell
Set-Location "C:\bots\えっちがにbot二台目\web"
npm run dev
```

ブラウザーで`http://localhost:3000/community`を開き、「Discordでログイン」を押してください。Discordの認証画面が表示され、許可後に`/me`へ戻れば成功です。`.env.local`はGit管理対象外です。絶対にコミットしないでください。

### 3. 本番サイトで有効にする

本番ではWebの`.env.local`ではなく、サーバーのCompose設定ファイル`/bots/ettiganibot/.env.site`に設定します。サーバーへSSH接続し、次を実行します。

```bash
cd /bots/ettiganibot
nano .env.site
```

次の4項目を追加または更新します。`DISCORD_CLIENT_ID`と`DISCORD_CLIENT_SECRET`にはDeveloper Portalの値を設定し、`SESSION_SECRET`は上の手順と同様に生成したランダム値に置き換えます。

```dotenv
DISCORD_CLIENT_ID=Developer_PortalのApplication_ID
DISCORD_CLIENT_SECRET=Developer_PortalのClient_Secret
DISCORD_REDIRECT_URI=https://ettiganibot-dashboard.com/api/auth/discord/callback
SESSION_SECRET=ランダムに生成した64文字以上の値
ADMIN_IDS=管理者のDiscord_User_ID（複数はカンマ区切り）
DEV_NOTES_ENABLED=true
COMMUNITY_ENABLED=true
SITE_MAINTENANCE=false
```

保存したら、秘密設定の権限を確認し、Webコンテナを再作成します。

```bash
chmod 600 /bots/ettiganibot/.env.site
cd /bots/ettiganibot
docker compose --env-file .env.site config --quiet
docker compose --env-file .env.site up -d --build web
docker compose --env-file .env.site ps
docker compose --env-file .env.site logs --tail=80 web
```

`config --quiet`が成功し、Webコンテナが起動していることを確認してから、本番サイトのコミュニティページでログインを試してください。環境変数を変更しただけでは既に起動中のコンテナに反映されないため、必ず`up -d`でWebコンテナを再作成してください。

### 4. うまくいかないとき

| 表示・症状 | 確認すること |
| --- | --- |
| 「Discordログインは現在設定されていません」 | `DISCORD_CLIENT_ID`、`DISCORD_CLIENT_SECRET`が空でないこと、`SESSION_SECRET`が32文字以上であること、設定後にWebを再起動したこと |
| Discord側で`redirect_uri`のエラー | Developer PortalのRedirect URIと`DISCORD_REDIRECT_URI`が、`http`/`https`、ホスト名、パスを含めて完全一致していること。末尾に余分な`/`を付けない |
| 認証後にログイン失敗ページへ戻る | Client ID/Secretが同じApplicationの組み合わせか、Secretを再生成した場合に`.env.local`または`.env.site`も更新したか |
| ローカルでは失敗し、本番では成功（またはその逆） | ローカルは`http://localhost:3000/...`、本番は`https://ettiganibot-dashboard.com/...`のRedirect URIと環境変数を使い分けているか |

Client Secretを紛失・公開した場合はDeveloper Portalで再生成し、環境変数を新しい値に更新してからWebを再起動してください。

## 作者・Special Thanks

作者: たいが

このBotを作るきっかけになった皆さんへ。本当にありがとうございました。あなた達がいなければ今の私はいませんでした。

stさん、chさん、aさん、cさん、sさん。本当にありがとうございました。
