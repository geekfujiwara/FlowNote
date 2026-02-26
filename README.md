# FlowNote
マークダウンで記述したフローチャートをリアルタイムに可視化する Web アプリ

## デプロイ手順

### 1. Azure Static Web Apps の API トークンを取得する

1. [Azure Portal](https://portal.azure.com) にサインインします。
2. 対象の **Static Web App** リソースを開きます。
3. 左側のメニューから **[管理トークン]** (Manage deployment token) を選択します。
4. 表示されたトークンをコピーします。

### 2. GitHub リポジトリにシークレットを登録する

1. GitHub リポジトリの **Settings** タブを開きます。
2. **Secrets and variables** → **Actions** に移動します。
3. **New repository secret** をクリックします。
4. 以下の値を入力します。
   - **Name**: `AZURE_STATIC_WEB_APPS_API_TOKEN`
   - **Secret**: 手順 1 でコピーしたトークン
5. **Add secret** をクリックして保存します。

シークレットを登録すると、`.github/workflows/azure-static-web-apps.yml` が `main` ブランチへのプッシュ時に自動的にデプロイを実行します。
