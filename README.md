# えっちがにbot 

このbotはくだらん機能しかついてないdiscord botです。
これはプログラミング初めたての時からコツコツ作り上げたものです。
本当に個人的なことになりますが、書かせてください。
このbotを作ることになったときにいた人たちに感謝を。本当にありがとうございました。
あなた達がいなければ今の私はいませんでした。
### 本当に、本当にありがとうございました。

本当にこのbotには私の思い出が詰まってます。よかったら使ってください。

## 主な機能

## よくわからない機能
- 特定のメッセージを送信したら特定のメッセージが返されます。
- 🦀のリアクションをメッセージにつけると"えっちがに！"と返されます。

### XP・レベルシステム

- メッセージを送信すると「えっちがに」として自動カウント
- 累計「えっちがに」数に基づいてレベルが上昇
- `/level` で現在のレベルを確認
- `/next_level` で次のレベルまでの必要カウント数を表示
- `/level_rank` でレベルランキング表示

### ランキング機能

- `/today` / `/my_today` - 今日のカウント
- `/weekly` / `/my_weekly` - 今週のカウント
- `/monthly` / `/my_monthly` - 今月のカウント
- `/total` / `/my_total` - 累計カウント
- 毎日・毎週月曜日・月初の 0:00 に上位ランカーを自動投稿

### その他機能

- `/gamertag` - Minecraft ゲーマータグ管理
- `/DeletedMessage` - サーバー内で削除されたメッセージを表示
- `/setting` - ランキング投稿先チャンネルの設定（管理者限定）
- `/help` - コマンド一覧と機能説明

## フォルダ構造

```text
.
├─ README.md
├─ .gitignore
├─ ettiganibot/
│  ├─ .env.example
│  ├─ .env
│  ├─ main.js
│  ├─ api.js
│  ├─ cli.js
│  ├─ package.json
│  ├─ commands/
│  ├─ src/
│  ├─ data/
│  │  ├─ guilds/
│  │  │  └─ <guildId>/
│  │  │     └─ DeletedMessage.json
│  │  ├─ counts.json
│  │  ├─ levels.json
│  │  ├─ total.json
│  │  ├─ weekly.json
│  │  ├─ monthly.json
│  │  └─ setting.json
│  └─ logs/

```

## セットアップ手順

1. `ettiganibot` に移動する
2. `.env.example` をコピーして `.env` を作成する
3. 必要な環境変数を設定する
4. 依存関係を入れる
5. 起動する

```bash
cd ettiganibot
npm install
npm start
```

## 必須環境変数

`.env` には次を設定します。

```env
TOKEN=your_discord_bot_token
CLI_KEY=your_cli_key
TARGET_BOT_ID=your_target_bot_id
```

## 重要な設計ポイント

- この bot は guild コマンド中心です
- グローバルコマンド登録は基本的に使いません
- 追加・更新したコマンドは bot 再起動後に guild へ再登録されます
- 重要な JSON はプロジェクト直下ではなく `ettiganibot/data/` に保存されます
- `DeletedMessage.json` は guild ごとに分離して保存されます

## よく使うコマンド

```bash
cd ettiganibot
npm start
npm run dev
npm run check
```

## Git 管理対象から外すべきファイル

以下は実行時に生成されるので、通常は `.gitignore` に入れて管理しない方が安全です。これしてくださいね、絶対。

- `.env`
- `ettiganibot/data/*.json`
- `ettiganibot/logs/`
- `ettiganibot/node_modules/`
- `ettiganibot/.env`

## 作者
たいが

## Special Thanks
### stさん,chさん,aさん,cさん,sさん
### 本当にありがとうございます。
