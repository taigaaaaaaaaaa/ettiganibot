# Ubuntuサーバー運用メモ（AI作成）

配置:

- BotとCompose: `/bots/ettiganibot/`
- サイト: `/var/www/ettiganibot-dashboard.com/public_html/`
- Botデータ: `/bots/ettiganibot/data/`
- コミュニティデータ: `/bots/ettiganibot/community-data/`
- Compose用秘密設定: `/bots/ettiganibot/.env.site`（権限600）
- Cloudflare Tunnel設定: `/etc/cloudflared/config.yml`（ホスト側のローカル管理Tunnel）

`.env.site`、Bot用`.env`、`data/`はアップロードで上書きしない。Botの`.env`にはDiscord tokenなどの秘密情報がある。

## 関連ドキュメント

- Botの機能、初回セットアップ、コマンド: [README.md](README.md)
- Webサイトの仕様、API、データ連携: [web/README.md](web/README.md)

## 初回準備

Composeの環境設定は初回のみ作成し、再デプロイ時は既存ファイルを保持します。

```bash
cd /bots/ettiganibot
if [ ! -f .env.site ]; then
  cp .env.example .env.site
fi
chmod 600 .env.site
```

`.env.site`の値は[`.env.example`](.env.example)を参照してください。既存の`.env.site`がある場合、サンプルで上書きせず必要な値だけ確認・更新します。

Discord Developer PortalでOAuth2 Redirect URIに`https://ettiganibot-dashboard.com/api/auth/discord/callback`を登録し、Client ID、Client Secret、32文字以上のランダムな`SESSION_SECRET`を設定します。`.env.site`の`ADMIN_IDS`に管理者のDiscord User IDをカンマ区切りで設定します。Composeは`community-data-init`サービスでコミュニティ保存先と開発者ノートJSONを初期化し、UID/GID 1001へ所有権を設定してからWebを起動します。

```bash
mkdir -p /bots/ettiganibot/community-data
docker compose --env-file .env.site up -d --build
docker compose --env-file .env.site exec web sh -c 'id && ls -ld /app/community-data && test -w /app/community-data'
```

`ls -ld`で所有者が`1001:1001`であること、`test -w`が成功することを確認します。`COMMUNITY_DATA_HOST_PATH`を変更した場合も、同じCompose起動処理でその保存先を初期化します。

管理画面は`https://ettiganibot-dashboard.com/admin/devnotes`です。記事は`DEV_NOTES_HOST_PATH`で指定したディレクトリ内の`dev-notes.json`へ保存されます。既存の`.env.site`でこの値をファイルのパスに設定している場合は、JSONファイルを含むディレクトリのパスへ変更してください。`DEV_NOTES_ENABLED=false`で開発者ノート機能を停止できます。

## 起動・状態確認

```bash
cd /bots/ettiganibot
docker compose --env-file .env.site config --quiet
docker compose --env-file .env.site up -d
docker compose --env-file .env.site ps
docker compose --env-file .env.site logs --tail=50 web nginx
systemctl status cloudflared --no-pager
```

正常時はDocker側の`web`が`Up (healthy)`、`nginx`が`Up`。Cloudflare Tunnelはホスト側の`cloudflared`サービスが`active (running)`。ローカルの疎通確認:

```bash
curl -I http://127.0.0.1:8080
curl -sS http://127.0.0.1:8080/api/statistics
```

Cloudflare Tunnelはホスト側のローカル設定で管理する。`/etc/cloudflared/config.yml`のhostname routeは`http://127.0.0.1:8080`にする。Compose内で別の`cloudflared`を起動しない。同じTunnelへIngress未設定のConnectorを追加すると503になる。

## サイトファイルを更新

1. `web/`の中身をWinSCPで`public_html/`へコピーする。`node_modules/`と`.next/`はコピーしない。
2. `docker-compose.yml`や`deploy/nginx.conf`を更新した場合は、それぞれ`/bots/ettiganibot/`、`/bots/ettiganibot/deploy/`へコピーする。
3. お知らせだけを更新するときは`public_html/app/data/announcements.json`を書き換える。マウント済みファイルなので再ビルドは不要。
4. コード、依存関係、Dockerfileを更新したら再ビルドする。

```bash
cd /bots/ettiganibot
docker compose --env-file .env.site config --quiet
docker compose --env-file .env.site up -d --build
docker compose --env-file .env.site ps
```

Composeから`cloudflared`サービスを削除した版へ更新するときは、古い重複コンテナを一度だけ削除する:

```bash
docker rm -f ettiganibot-cloudflared-1
```

反映しない、または`unhealthy`の場合:

```bash
docker compose --env-file .env.site logs --tail=100 web nginx
systemctl status cloudflared --no-pager
journalctl -u cloudflared -n 50 --no-pager
```

## Botコードを更新

BotをPM2で管理している場合、`/bots/ettiganibot/`に新しいコードをコピーしてから実行する。

VC読み上げはFish AudioのMP3を再生するため、サーバーにFFmpegが必要。初回のみインストールし、Botと同じユーザーから実行できることを確認する:

```bash
sudo apt update
sudo apt install -y ffmpeg
command -v ffmpeg
ffmpeg -version
```

```bash
cd /bots/ettiganibot
pm2 status
pm2 restart "えっちがにbot二台目" --update-env
pm2 save
pm2 logs "えっちがにbot二台目" --lines 50 --nostream
```

初回だけPM2へ登録する場合:

```bash
cd /bots/ettiganibot
pm2 start ecosystem.config.cjs
pm2 save
```

`guilds.json`によるGuild一覧同期を使うには、Botの`main.js`と`src/guildRegistry.js`も更新し、Discord Developer PortalでServer Members Intentを有効にする。BotのランキングJSONが更新された場合、Webは次のリクエストで読み直すためWebの再ビルドは不要。

## Cloudflare Tunnel

既存のTunnelはローカル管理のため、Cloudflare DashboardでIngressを編集・移行しない。`/etc/cloudflared/config.yml`を次のようにし、同じTunnelのホスト側サービスだけを使う:

```yaml
tunnel: ettiganibot
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: ettiganibot-dashboard.com
    service: http://127.0.0.1:8080
  - service: http_status:404
```

`credentials-file`は実際のTunnel認証ファイルのパスに置き換えてください。認証ファイル自体は共有・公開しないでください。

設定後に確認・反映する:

```bash
cloudflared tunnel ingress validate
systemctl restart cloudflared
systemctl status cloudflared --no-pager
```

## 絶対に上書きしないもの

- `/bots/ettiganibot/.env`
- `/bots/ettiganibot/.env.site`（秘密設定を確認せず置き換えない）
- `/bots/ettiganibot/data/`