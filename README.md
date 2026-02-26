# FlowNote
マークダウンで記述したフローチャートをリアルタイムに可視化する Web アプリ

## GitHub Actions による Azure 自動デプロイのセットアップ

このリポジトリには以下の 2 つのデプロイワークフローが含まれています。

| ワークフロー | 対象 | 認証方式 |
|---|---|---|
| `azure-static-web-apps.yml` | フロントエンド (Azure Static Web Apps) | API トークン |
| `azure-functions-deploy.yml` | API (Azure Functions) | OIDC (Workload Identity Federation) |

### フロントエンド (Azure Static Web Apps)

Azure ポータルで Static Web Apps リソースを作成すると、デプロイトークンが発行されます。  
そのトークンを GitHub リポジトリの **Settings → Secrets and variables → Actions** に  
`AZURE_STATIC_WEB_APPS_API_TOKEN` という名前で登録してください。

### API (Azure Functions) — OIDC 認証のセットアップ

パスワードレス認証（Workload Identity Federation）を使用します。  
長期有効なシークレットを GitHub に保存する必要はありません。

#### 1. Azure AD アプリ登録の作成

```bash
az ad app create --display-name "FlowNote GitHub Actions"
```

出力の `appId` をメモしてください（以降 `<APP_ID>` と表記）。

#### 2. サービスプリンシパルの作成

```bash
az ad sp create --id <APP_ID>
```

#### 3. フェデレーション資格情報の追加

```bash
az ad app federated-credential create \
  --id <APP_ID> \
  --parameters '{
    "name": "flownote-main",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:<GitHubユーザー名>/FlowNote:ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"]
  }'
```

> `subject` の `<GitHubユーザー名>` はリポジトリオーナーのユーザー名または組織名に置き換えてください。

#### 4. Azure ロールの割り当て

Function App が属するリソースグループに対して `Contributor` ロールを付与します。

```bash
az role assignment create \
  --assignee <APP_ID> \
  --role Contributor \
  --scope /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/<RESOURCE_GROUP>
```

#### 5. GitHub Secrets の登録

**Settings → Secrets and variables → Actions** に以下の 4 つを登録してください。

| シークレット名 | 値 |
|---|---|
| `AZURE_CLIENT_ID` | アプリ登録の `appId` |
| `AZURE_TENANT_ID` | Azure AD のテナント ID |
| `AZURE_SUBSCRIPTION_ID` | Azure サブスクリプション ID |
| `AZURE_FUNCTIONAPP_NAME` | デプロイ先 Function App の名前 |

登録後、`main` ブランチへのプッシュまたは `api/` 配下の変更時に自動デプロイが実行されます。  
**Actions** タブの `Azure Functions Deploy` ワークフローから手動実行（`workflow_dispatch`）も可能です。
