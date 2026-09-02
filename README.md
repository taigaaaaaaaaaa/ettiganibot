# えっちがにbot

このbotはくだらん機能しかついてないdiscord botです。
これはプログラミング初めたての時からコツコツ作り上げたものです。
本当に個人的なことになりますが、書かせてください。
このbotを作ることになったときにいた人たちに感謝を。本当にありがとうございました。
あなた達がいなければ今の私はいませんでした。
### 本当に、本当にありがとうございました。

本当にこのbotには私の思い出が詰まってます。よかったら使ってください。

## 機能

- メッセージ内の「えっち」と「🦀」をカウントし、XPとレベルを管理
- 🦀リアクションへの自動返信
- キーワードへの自動返信
- 日間・週間・月間ランキングの自動投稿
- 削除メッセージの保存と表示
- Embed形式の全サーバー一括メッセージ送信
- 指定のチャンネルへのメッセージ送信
- 指定のボイスチャンネルへの参加
- キーワード検知とリアクションのテキストログ保存

## 必要な環境

- Node.js 20以上
- npm
- DiscordとBotトークン

Node.jsは公式サイトからインストールしてください。

```text
https://nodejs.org/
```

バージョン確認:

```cmd
node --version
npm --version
```

## Discord側の設定

1. Discord Developer PortalでApplicationを作成する
2. Botを追加してトークンを発行する
3. `Bot` の `Message Content Intent` を有効にする
4. OAuth2の招待URLを作成する
5. Scopesに `bot` と `applications.commands` を指定する
6. Bot権限に、少なくとも次を指定する

- View Channels
- Send Messages
- Embed Links
- Read Message History
- Add Reactions
- Manage Messages（削除メッセージ検知に必要）

`めんどくさかったら管理権限を付与する設定にしてください。私はそうしました。`

## インストール

リポジトリのルートから実行します。

```cmd
cd ettiganibot
npm install discord.js@^14.25.1 dotenv@^17.3.1 express@^5.2.1 node-cron@^4.2.1 @discordjs/voice@^0.18.0
```

主なパッケージ:

| パッケージ | 用途 |
| --- | --- |
| `discord.js` | Discord Bot API |
| `@discordjs/voice` | ボイスチャンネル接続 |
| `dotenv` | `.env` の読み込み |
| `express` | CLI用APIサーバー |
| `node-cron` | 定期ランキング処理 |

## 環境変数

`.env.example` をコピーして `.env` を作成します。

```cmd
copy .env.example .env
```

`.env` を編集します。

```env
TOKEN=Discord_Bot_Token
CLI_KEY=任意の長いランダムな文字列
TARGET_BOT_ID=対象BotのID
```

`TOKEN` は絶対に公開しないでください。漏えいした場合はDeveloper Portalでトークンを再生成します。

## 起動

```cmd
cd ettiganibot
node main.js
```

起動後に `Bot 起動完了` と表示されればログイン成功です。別の方法:

```cmd
npm start
npm run dev
npm run check
```

`npm run dev` はファイル変更時に自動再起動します。`npm run check` は構文チェックです。

## スラッシュコマンド

| コマンド | 内容 |
| --- | --- |
| `/today` | 今日のランキング |
| `/weekly` | 今週のランキング |
| `/monthly` | 今月のランキング |
| `/total` | 累計ランキング |
| `/my_today` | 自分の今日のカウント |
| `/my_weekly` | 自分の週間カウント |
| `/my_monthly` | 自分の月間カウント |
| `/my_total` | 自分の累計カウント |
| `/level` | 自分のレベル |
| `/next_level` | 次のレベルまでの必要数 |
| `/level_rank` | レベルランキング |
| `/gamertag` | Minecraftゲーマータグ設定 |
| `/DeletedMessage` | 削除メッセージ表示 |
| `/setting` | ランキング投稿先を設定（管理者限定） |
| `/help` | コマンド一覧 |

## CMDからメッセージを送信

Bot起動中のCMDへ入力します。

特定チャンネルへ送信:

```text
チャンネルID メッセージ
```

Embed形式で全サーバーへ送信:

```text
broadcast お知らせです
```

改行は `\n` を使います。

```text
broadcast 1行目\n2行目\n3行目
```

全サーバーでBotが `SendMessages` と `EmbedLinks` を持つチャンネルが自動選択されます。送信先がないサーバーはスキップされます。

## データとログ

- `data/counts.json`: 日ごとのカウント
- `data/total.json`: 累計カウント
- `data/levels.json`: レベル情報
- `data/weekly.json`: 週間集計
- `data/monthly.json`: 月間集計
- `data/setting.json`: サーバーごとのランキング投稿先
- `data/guilds/<guildId>/DeletedMessage.json`: サーバーごとの削除メッセージ
- `data/logs/YYYY-MM-DD.log`: キーワード・リアクションログ

JSONやログはBotの実行中に自動作成・更新されます。バックアップする場合はBotを停止してからコピーしてください。

## トラブルシューティング

### `TokenInvalid` が表示される

- `ettiganibot/.env` が存在するか確認する
- `TOKEN` の名前が正しいか確認する
- トークン前後に余計な空白や引用符を入れない
- トークンを再生成した場合は `.env` を更新する

### コマンドが表示されない

- Botを再起動する
- `applications.commands` scope付きで招待する
- Botが対象サーバーに参加しているか確認する

### メッセージに反応しない

- `Message Content Intent` を有効にする
- Botに対象チャンネルの閲覧・送信権限があるか確認する
- 一部のキーワードは特定サーバー限定です

## フォルダ構成

```text
.
├─ README.md
├─ .gitignore
└─ ettiganibot/
	├─ .env.example
	├─ main.js
	├─ api.js
	├─ cli.js
	├─ commands/
	├─ src/
	└─ data/
		├─ guilds/
		├─ logs/
		└─ *.json (json形式で保存したい場合はコード書き換えてくださいね。)
```

## セキュリティ

`.env`、Botトークン、`CLI_KEY` はGitHubへ公開しないでください。運用中のBotトークンをチャットやスクリーンショットに表示した場合は、すぐに再生成してください。

## 作者

たいが

## Special Thanks

### stさん、chさん、aさん、cさん、sさん
### 本当にありがとうございました
