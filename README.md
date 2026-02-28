# FlowNote

<p align="center">
  <img src="public/favicon.svg" alt="FlowNote Logo" width="72" height="72" />
</p>

<p align="center">
  <strong>マークダウン × キャンバス × AI エージェントで、フローチャートを直感的に共同編集できる Web アプリケーション</strong>
</p>

<p align="center">
  <a href="https://github.com/geekfujiwara/FlowNote/actions/workflows/deploy.yml">
    <img src="https://github.com/geekfujiwara/FlowNote/actions/workflows/deploy.yml/badge.svg" alt="Deploy Application" />
  </a>
  <img src="https://img.shields.io/badge/tests-153%20passing-brightgreen" alt="Tests" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Azure-Static%20Web%20Apps-0078d4?logo=microsoftazure&logoColor=white" alt="Azure" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License" />
</p>

<p align="center">
  <a href="https://x.com/geekfujiwara">🐦 X (Twitter)</a> ·
  <a href="https://github.com/geekfujiwara">👤 GitHub</a> ·
  <a href="#ローカル開発">🚀 Getting Started</a> ·
  <a href="#azure-デプロイ">☁️ Deploy to Azure</a>
</p>

---

## 概要

FlowNote は、**マークダウン記法でフローチャートを記述**し、リアルタイムでキャンバスに可視化できる Next-gen ノートアプリです。  
AI エージェント（Azure OpenAI / OpenAI）と連携して、プロンプト一つでノードやエッジを自動生成・編集できます。

```
# サンプルフロー

```flow
[[start]] 開始
[process] 処理
{branch} 条件分岐
((end)) 終了

[start] -> [process]
[process] -> {branch}
{branch} -> ((end)) : Yes
```
```

---

## 主な機能

| 機能 | 説明 |
|---|---|
| 📝 **マークダウンエディタ** | CodeMirror ベースのリッチエディタ。独自 `flow` コードブロック記法でノード・エッジを定義 |
| 🎨 **フローキャンバス** | @xyflow/react によるインタラクティブなキャンバス。Dagre 自動レイアウト対応 |
| 🤖 **AI エージェント** | チャットパネルでフローの追加・変更・提案を自然言語で指示。差分プレビューから適用/破棄が可能 |
| 🗂️ **10種類のテンプレート** | フィッシュボーン・SWOT・マインドマップ・ロードマップなど、カテゴリ別デザインテンプレートを内蔵 |
| 🔄 **バージョン履歴** | フロー変更の履歴を自動記録。任意の時点に1クリックで復元可能 |
| 📊 **アナリティクス** | ノート数・エッジ数・AI 使用回数などの利用状況ダッシュボード |
| 🌐 **リアルタイム同期** | Azure SignalR Service による複数ユーザー間のリアルタイム共同編集 |
| 🔍 **Application Insights** | Azure Application Insights によるテレメトリ収集・パフォーマンス監視 |
| 🔐 **認証** | デモモード用シンプルパスワードログイン。本番環境は Microsoft Entra ID (Azure AD) |

---

## テンプレートギャラリー

10 種類のデザインテンプレートを内蔵。各テンプレートには AI 専用のシステムプロンプトと推奨プロンプト候補が付属します。

| カテゴリ | テンプレート | 説明 |
|---|---|---|
| 🔍 分析 | 🐟 フィッシュボーンチャート | 問題原因を 6M で構造化 |
| 🔍 分析 | 💼 SWOT 分析 | 強み・弱み・機会・脅威の 4 象限 |
| 🔍 分析 | ⚠️ リスク分析マトリクス | 発生確率 × 影響度でリスクを評価 |
| 📋 企画 | 🗺️ プロダクトロードマップ | リリース計画のフェーズ管理 |
| 📋 企画 | 👥 カスタマージャーニーマップ | 顧客体験のタッチポイント整理 |
| 📋 企画 | 📋 ユーザーストーリーマップ | Epic → Story → Task の階層構造 |
| ⚙️ プロセス | 📊 フローチャート | 汎用プロセス・業務フロー |
| ⚙️ プロセス | 🔄 ステートマシン図 | 状態遷移とイベント駆動の可視化 |
| 🏢 組織 | 🧠 マインドマップ | アイデア発散・トピック整理 |
| 🏢 組織 | 🏢 組織図 | 階層的な組織構造の表現 |

---

## スクリーンショット

> ローカルで `npm run dev` を起動したあと、ブラウザで確認できます。

| マークダウンエディタ + キャンバス | テンプレートギャラリー |
|---|---|
| マークダウンで記述するとリアルタイムでキャンバスに反映 | カテゴリフィルタで10種のテンプレートを選択 |

| AI チャットパネル | アナリティクスダッシュボード |
|---|---|
| 自然言語でフローを指示。差分を確認してから適用 | ノート・AI 使用状況の統計情報を可視化 |

---

## 技術スタック

### フロントエンド

| ライブラリ | バージョン | 用途 |
|---|---|---|
| React | 19 | UI フレームワーク |
| TypeScript | 5.x | 型安全な開発 |
| Vite | 6 | ビルド・開発サーバー |
| @xyflow/react | 12 | フローキャンバス |
| @uiw/react-codemirror | 4 | マークダウンエディタ |
| Zustand | 5 | グローバル状態管理 |
| Tailwind CSS | 4 | スタイリング |
| @dagrejs/dagre | 1 | 自動グラフレイアウト |
| @azure/msal-react | 2 | Microsoft Entra ID 認証 |
| @microsoft/signalr | 8 | リアルタイム通信 |
| lucide-react | 0.468 | アイコンセット |

### バックエンド

| ライブラリ | バージョン | 用途 |
|---|---|---|
| Azure Functions | v2 (Python) | サーバーレス API |
| agent-framework | latest | Microsoft AI Agent Framework |
| Azure OpenAI / OpenAI | — | AI エージェント推論エンジン |

### テスト

| ツール | 用途 |
|---|---|
| Vitest 3.x | テストランナー |
| @testing-library/react | React コンポーネントテスト |
| @testing-library/user-event | ユーザー操作シミュレーション |

### Azure インフラ

```
Azure Static Web Apps       ← フロントエンドホスティング
Azure Functions (Linux)     ← Python バックエンド API
Azure Blob Storage          ← ノートデータ永続化
Azure SignalR Service       ← リアルタイム同期
Azure Application Insights  ← テレメトリ・監視
Azure Log Analytics         ← ログ集約
```

---

## ディレクトリ構成

```
FlowNote/
├── src/
│   ├── auth/                   # 認証（MSAL + パスワードログイン）
│   │   ├── AuthGuard.tsx       # 認証ガード・ログイン画面
│   │   └── msalConfig.ts       # MSAL 設定
│   ├── components/
│   │   ├── analytics/          # アナリティクスパネル
│   │   ├── canvas/             # フローキャンバス・カスタムノード・バージョン履歴
│   │   ├── chat/               # AI チャットパネル・提案カード
│   │   ├── editor/             # マークダウンエディタ・ツールバー
│   │   ├── layout/             # アプリ全体レイアウト
│   │   ├── shared/             # 共有コンポーネント（メタデータパネル等）
│   │   ├── sidebar/            # ノート一覧サイドバー
│   │   └── templates/          # テンプレートギャラリー
│   ├── hooks/
│   │   └── useSignalR.ts       # SignalR リアルタイム接続フック
│   ├── lib/
│   │   ├── appInsights.ts      # Application Insights 初期化
│   │   ├── dagLayout.ts        # Dagre 自動レイアウト
│   │   ├── flowParser.ts       # flow ブロック構文パーサー
│   │   ├── mockApi.ts          # ローカル開発用モック API（localStorage）
│   │   └── templates.ts        # 10 種類のデザインテンプレート定義
│   ├── store/
│   │   └── useStore.ts         # Zustand ストア（全アプリ状態）
│   ├── test/                   # Vitest テストスイート (153 tests)
│   └── types/                  # 共通型定義 (index.ts)
├── backend/
│   ├── function_app.py         # Azure Functions エントリポイント
│   ├── agents/
│   │   └── flow_agent.py       # AI エージェント実装
│   └── requirements.txt
├── infra/
│   └── main.bicep              # Azure インフラ定義（Bicep IaC）
├── .github/
│   └── workflows/
│       ├── deploy.yml          # アプリデプロイ CI/CD（push to main）
│       └── infra-deploy.yml    # インフラプロビジョニング（手動）
├── .env.example                # 環境変数サンプル
└── staticwebapp.config.json    # SWA ルーティング設定
```

---

## ローカル開発

### 前提条件

- **Node.js** 20 以上
- **npm** 10 以上
- Python 3.11 以上（バックエンドを起動する場合のみ）

### セットアップ

```bash
# 1. リポジトリをクローン
git clone https://github.com/geekfujiwara/FlowNote.git
cd FlowNote

# 2. フロントエンド依存インストール
npm install

# 3. 環境変数ファイルを作成（デフォルト設定でそのまま動作します）
cp .env.example .env.local
```

### 開発サーバー起動

```bash
npm run dev
```

ブラウザで `http://localhost:5173` を開きます。  
デフォルトでモック API が有効なのでバックエンドなしで全機能を試せます。

**デモ用ログインパスワード:** `geekfujiwara@123`

### バックエンドのローカル起動（オプション）

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt

# backend/local.settings.json を作成
func start
```

`backend/local.settings.json` の最小構成例：

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "python",
    "AZURE_OPENAI_ENDPOINT": "https://YOUR-RESOURCE.openai.azure.com",
    "AZURE_OPENAI_DEPLOYMENT_NAME": "gpt-4o-mini",
    "AZURE_OPENAI_API_KEY": "YOUR-API-KEY"
  }
}
```

---

## 環境変数

`.env.example` を `.env.local` にコピーして編集してください。

| 変数名 | デフォルト | 説明 |
|---|---|---|
| `VITE_USE_MOCK_API` | `true` | `false` にすると実際の Azure Functions を使用 |
| `VITE_USE_MOCK_AGENT` | `true` | `false` にすると実際の AI エージェントを使用 |
| `VITE_API_BASE_URL` | `http://localhost:7071` | Azure Functions の URL |
| `VITE_AGENT_API_BASE_URL` | `http://localhost:7071` | AI エージェントの URL |
| `VITE_MSAL_CLIENT_ID` | — | Microsoft Entra ID アプリ登録のクライアント ID |
| `VITE_MSAL_TENANT_ID` | — | Microsoft Entra ID のテナント ID |
| `VITE_MSAL_REDIRECT_URI` | origin | MSAL リダイレクト URI |
| `VITE_APPINSIGHTS_CONNECTION_STRING` | — | Application Insights 接続文字列（省略可） |

---

## テスト

```bash
# 全テスト実行（CI モード）
npm test

# ウォッチモード（開発中）
npm run test:watch

# カバレッジ計測
npm run test:coverage
```

**153 件のテスト**が 6 ファイルで実行されます：

| テストファイル | テスト数 | 内容 |
|---|---|---|
| `flowParser.test.ts` | 17 | flow ブロックパーサーの単体テスト |
| `dagLayout.test.ts` | 12 | Dagre レイアウトの単体テスト |
| `mockApi.test.ts` | 17 | モック API の統合テスト |
| `store.test.ts` | 36 | Zustand ストアのアクションテスト |
| `templates.test.ts` | 36 | 10 種類のテンプレートデータ検証 |
| `components.test.tsx` | 35 | React コンポーネントの UI テスト |

---

## flow ブロック記法リファレンス

FlowNote 独自の Markdown 拡張記法です。コードブロックの言語に `flow` を指定します。

### ノード定義

```markdown
```flow
[id] ノードラベル          # 通常ノード（四角形）
[[id]] ノードラベル        # 入力ノード（角丸）
((id)) ノードラベル        # 出力ノード（円形）
{id} ノードラベル          # 分岐ノード（ひし形）
```
```

### エッジ定義

```markdown
```flow
[source] -> [target]               # ラベルなしエッジ
[source] -> [target] : ラベル      # ラベル付きエッジ
```
```

### 完全な例

```markdown
```flow
[[req]] 要件定義
[design] 設計
[impl] 実装
{review} レビューOK?
((done)) 完了
[fix] 修正

[[req]] -> [design]
[design] -> [impl]
[impl] -> {review}
{review} -> ((done)) : Yes
{review} -> [fix] : No
[fix] -> [impl]
```
```

---

## Azure デプロイ

### Step 1: サービスプリンシパル作成

```bash
# リソースグループを事前に作成
az group create --name rg-flownote --location japaneast

# サービスプリンシパルを作成して JSON を取得
az ad sp create-for-rbac \
  --name "flownote-github-actions" \
  --role contributor \
  --scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/rg-flownote \
  --json-auth
```

出力された JSON を GitHub Secrets の **`AZURE_CREDENTIALS`** に登録します。

### Step 2: インフラをプロビジョニング

GitHub リポジトリの **Actions** タブ → **Deploy Infrastructure** → **Run workflow** を実行します。

| Input | 値 |
|---|---|
| environment | `prod` |
| location | `japaneast`（または任意のリージョン） |

ワークフロー完了後、出力された値を GitHub Secrets に登録します：

| Secret 名 | 説明 |
|---|---|
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | SWA デプロイトークン（ワークフロー出力） |
| `VITE_API_BASE_URL` | Functions URL（ワークフロー出力） |
| `VITE_APPINSIGHTS_CONNECTION_STRING` | Application Insights 接続文字列（Azure Portal から取得） |

### Step 3: アプリをデプロイ

`main` ブランチへの push で **Deploy Application** ワークフローが自動実行されます。

```bash
git push origin main
```

> **Note:** GitHub Secrets が未設定の場合、デプロイステップはスキップされ、CI ビルド・テストのみ実行されます。

### 構築される Azure リソース

| リソース | SKU | 用途 |
|---|---|---|
| Static Web Apps | Free | フロントエンドホスティング・CDN |
| App Service Plan | B1 (Linux) | Functions 実行プラン |
| Azure Functions | Python 3.11 | バックエンド API |
| Storage Account | Standard LRS | ノートデータ・Functions 依存 |
| SignalR Service | Free (1 unit) | リアルタイム同期 |
| Application Insights | — | テレメトリ・監視 |
| Log Analytics Workspace | PerGB2018 | ログ集約（30日保持） |

---

## CI/CD ワークフロー

```
push to main
    │
    ├─ check-secrets ─────── シークレット存在確認
    │                         ├─ AZURE_STATIC_WEB_APPS_API_TOKEN の有無を確認
    │                         └─ AZURE_CREDENTIALS の有無を確認
    │
    ├─ build-frontend ───── npm ci → npm test (153 tests) → npm run build（常時実行）
    │
    ├─ deploy-frontend ──── Azure Static Web Apps デプロイ
    │                         └─ SWA トークンが設定されている場合のみ実行
    │
    └─ deploy-backend ───── Azure Functions デプロイ
                              └─ Azure 認証情報が設定されている場合のみ実行
```

手動トリガーのワークフロー：

| ワークフロー | トリガー | 目的 |
|---|---|---|
| `deploy.yml` | push to main / 手動 | アプリデプロイ + CI |
| `infra-deploy.yml` | 手動のみ | Azure インフラプロビジョニング |

---

## AI エージェント設定

バックエンドの AI エージェントは Azure OpenAI または OpenAI のどちらかで動作します。

### Azure OpenAI（推奨）

```bash
AZURE_OPENAI_ENDPOINT=https://YOUR-RESOURCE.openai.azure.com
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o-mini           # デプロイ名
AZURE_OPENAI_API_KEY=YOUR-API-KEY                  # 省略時は DefaultAzureCredential
AZURE_OPENAI_API_VERSION=2025-01-01-preview
```

### OpenAI

```bash
OPENAI_API_KEY=YOUR-API-KEY
OPENAI_MODEL=gpt-4o-mini
```

---

## トラブルシューティング

### ログイン画面が表示されない / すぐにアプリが開く

`.env.local` の `VITE_USE_MOCK_API=true` を確認してください。`true` の場合はパスワード認証画面が表示されます。

### flow ブロックがキャンバスに表示されない

- コードブロックの言語が `` ```flow `` になっているか確認してください
- ノード ID に日本語は使用できません（英数字 + アンダースコア）

### GitHub Actions でデプロイが失敗する

1. GitHub Secrets にすべての必要な値が登録されているか確認
2. `infra-deploy.yml` が先に実行されているか確認（インフラが存在しないと SWA へのデプロイは失敗します）
3. Azure サービスプリンシパルの有効期限・権限を確認

### バックエンドの AI エージェントが動かない

- `VITE_USE_MOCK_AGENT=false` と設定されているか確認
- Azure OpenAI のデプロイ名・エンドポイントが正しいか確認
- API キーまたは DefaultAzureCredential の設定を確認

---

## コントリビューション

1. このリポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'feat: add amazing feature'`)
4. ブランチをプッシュ (`git push origin feature/amazing-feature`)
5. Pull Request を作成

コミットメッセージは [Conventional Commits](https://www.conventionalcommits.org/) 形式を推奨します。

---

## ライセンス

MIT © [geekfujiwara](https://github.com/geekfujiwara)

---

## 作者

**geekfujiwara**

- 🐦 X (Twitter): [@geekfujiwara](https://x.com/geekfujiwara)
- 💻 GitHub: [@geekfujiwara](https://github.com/geekfujiwara)

---

<p align="center">
  <sub>Built with ❤️ using React 19 + Azure</sub>
</p>
