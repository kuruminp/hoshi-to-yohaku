# 星と余白 — 公開手順

## 1. GitHub Actions

ワークフロー `.github/workflows/publish.yml` は `main` への push、毎日06:17（日本時間）、手動実行で動きます。テストを実行し、`dist/` を生成して、Actions の実行結果に7日間保存します。

## 2. 商用ホスティング

GitHubはソース管理と自動ビルドに使います。本番サイトはCloudflare Pagesなど、商用サイトに適した静的ホスティングへ配置してください。Cloudflare PagesではDirect Uploadのプロジェクトを作成します。

Cloudflareへの自動デプロイを有効にするには、GitHubリポジトリの **Settings → Secrets and variables → Actions** に以下を設定します。

Actions variables:

- `SITE_URL`: 本番サイトのHTTPS URL
- `CLOUDFLARE_PAGES_DEPLOY_ENABLED`: `true`
- `CLOUDFLARE_PAGES_PROJECT`: Cloudflare Pagesのプロジェクト名

Actions secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

APIトークンはPagesのデプロイに必要な権限に絞って発行します。シークレットが未設定の間も、テストとビルド、Actions成果物の作成は実行されますが、本番デプロイは行いません。

## 3. ビルド出力

```text
Build command: python scripts/build.py
Output directory: dist
```

サイトは静的ファイルだけで動作し、データベースやサーバー処理を必要としません。サイトマップ、robots.txt、RSS、12星座別ページ、14日分のアーカイブもビルド時に生成します。

## 4. 公開前に確認すること

- `SITE_URL` を本番のHTTPS URLに設定する
- `config.json` の運営者名とお問い合わせ先を入力する
- AdSenseやアフィリエイトを使う前に審査・承認を受け、必要なプライバシー表示を更新する
- パスワードやAPIキーはリポジトリに保存せず、GitHub Actions secretsに保管する
