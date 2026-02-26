# FlowNote API

Azure Functions backend for the FlowNote application, built with the Python v2 programming model.

## Tech Stack

| Component | Choice |
|---|---|
| Runtime | Azure Functions Python v2 (Python 3.11) |
| Storage | Azure Blob Storage via `DefaultAzureCredential` (Managed Identity) |
| Real-time | Azure SignalR Service (REST API) |
| Auth | JWT Bearer token — `oid` claim extracted from payload |
| AI | Azure AI Projects SDK (`azure-ai-projects`); stubs when unavailable |

## Directory layout

```
api/
├── function_app.py            # All function definitions
├── requirements.txt
├── host.json
├── local.settings.json.example
└── README.md
```

## Storage schema

| Container | Blob path | Content |
|---|---|---|
| `flownotes` | `{oid}/{uuid}.md` | Note body (Markdown) |
| `flownotes-meta` | `{oid}/{uuid}.json` | Metadata (title, tags, updatedAt, oid) |

## API endpoints

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/list` | Bearer | List note metadata for the user |
| POST | `/api/save` | Bearer | Create or update a note |
| GET | `/api/load/{id}` | Bearer | Load full note content |
| DELETE | `/api/delete/{id}` | Bearer | Delete a note |
| GET/POST | `/api/negotiate` | Bearer | SignalR client negotiation |
| POST | `/api/notify` | None¹ | Internal: push SignalR notification |
| POST | `/api/agent/chat` | Bearer | AI agent chat for a note |

> ¹ `/api/notify` has no JWT check and should be protected at the infrastructure layer
> (e.g. VNet restriction or Azure Functions host key).

### GET /api/list
```json
[{ "id": "string", "title": "string", "updatedAt": "ISO8601", "tags": [] }]
```

### POST /api/save
Request:
```json
{ "id": "optional-uuid", "title": "My Note", "markdown": "# Hello", "tags": ["tag1"] }
```
Response:
```json
{ "id": "uuid", "updatedAt": "ISO8601" }
```

### GET /api/load/{id}
```json
{ "id": "uuid", "markdown": "# Hello", "title": "My Note", "tags": [], "updatedAt": "ISO8601" }
```

### DELETE /api/delete/{id}
Returns `204 No Content`.

### GET /api/negotiate
```json
{ "url": "https://...", "accessToken": "..." }
```

### POST /api/agent/chat
Request:
```json
{
  "noteId": "uuid",
  "message": "Add a step after node 3",
  "context": { "markdown": "# Flow\n...", "selection": null, "metadata": {} }
}
```
Response:
```json
{
  "suggestionId": "uuid",
  "summary": "Added step after node 3",
  "markdown": "# Flow\n... (updated)",
  "impacts": { "nodesDelta": 1, "edgesDelta": 1 }
}
```

## Configuration

Copy `local.settings.json.example` to `local.settings.json` and fill in the values.

| Variable | Description |
|---|---|
| `AZURE_STORAGE_ACCOUNT_URL` | Blob service endpoint, e.g. `https://myaccount.blob.core.windows.net` |
| `AZURE_SIGNALR_CONNECTION_STRING` | Full SignalR connection string |
| `AZURE_AI_ENDPOINT` | Azure AI / OpenAI endpoint URL |
| `AZURE_AI_AGENT_ID` | Agent ID from Azure AI Studio |

## Local development

```bash
# Install dependencies
pip install -r requirements.txt

# Start Azurite (local storage emulator)
npx azurite --silent &

# Start Functions host
func start
```

## Deployment

### CI/CD via GitHub Actions

The repository uses OIDC (federated credentials) so GitHub Actions can deploy to your Azure subscription without storing long-lived secrets.

#### 1. Create an Azure AD App Registration and federated credential

```bash
# Create app registration
az ad app create --display-name "FlowNote GitHub Actions"

# Note the appId (CLIENT_ID) from the output, then create a service principal
az ad sp create --id <appId>

# Assign Contributor role on the resource group
az role assignment create \
  --assignee <appId> \
  --role Contributor \
  --scope /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/<RESOURCE_GROUP>

# Add a federated credential for the main branch
az ad app federated-credential create \
  --id <appId> \
  --parameters '{
    "name": "flownote-main",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:<GITHUB_ORG>/<REPO_NAME>:ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"]
  }'
```

#### 2. Add GitHub repository secrets

In your repository go to **Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|---|---|
| `AZURE_CLIENT_ID` | App registration client ID (`appId`) |
| `AZURE_TENANT_ID` | Azure AD tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID |
| `AZURE_FUNCTIONAPP_NAME` | Name of your Azure Function App |

#### 3. Assign roles to the Function App's managed identity

```bash
# Enable system-assigned managed identity on the Function App
az functionapp identity assign \
  --resource-group <rg> --name <app>

# Assign Storage Blob Data Contributor to the managed identity
az role assignment create \
  --assignee <principalId> \
  --role "Storage Blob Data Contributor" \
  --scope /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/<rg>/providers/Microsoft.Storage/storageAccounts/<storage>
```

The workflow in `.github/workflows/azure-functions-deploy.yml` runs automatically on every push to `main` that touches the `api/` directory, and can also be triggered manually via **Actions → Deploy Azure Functions → Run workflow**.

### Manual deployment

```bash
az functionapp deployment source config-zip \
  --resource-group <rg> --name <app> --src api.zip
```

## Security notes

- JWT signatures are **not validated** in the current implementation (see comment in `function_app.py`).
  For production, validate the token against your Azure AD tenant's JWKS endpoint.
- `/api/notify` has no auth check; restrict access at the infrastructure level.
- Blob paths are scoped to `{oid}/` so users can only access their own notes.
