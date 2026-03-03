"""
FlowNote Azure Functions backend  - Python v2 programming model

Endpoints:
  GET    /api/list           - List all note metadata
  GET    /api/load/{id}      - Load a single note
  POST   /api/save           - Create or update a note
  DELETE /api/delete/{id}    - Delete a note
  POST   /api/agent/chat     - AI agent chat endpoint
  POST   /api/auth/entra     - Entra ID idToken 検証，ユーザー情報返却
  GET    /api/auth/me        - Authorization Bearer トークンを検証しユーザー情報返却
"""

import json
import logging
import os
from datetime import datetime, timezone

import azure.functions as func
from azure.storage.blob import BlobServiceClient, ContentSettings
from azure.core.exceptions import ResourceNotFoundError
from azure.identity import DefaultAzureCredential

from agents.flow_agent import run_flow_agent

logger = logging.getLogger(__name__)
app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

# ---------------------------------------------------------------
# Blob Storage helpers
# ---------------------------------------------------------------

_STORAGE_ACCOUNT_URL = os.environ.get("STORAGE_ACCOUNT_URL", "")  # managed identity
_STORAGE_CONN        = os.environ.get("STORAGE_CONNECTION_STRING", "")  # local fallback
_NOTES_CONTAINER     = os.environ.get("NOTES_CONTAINER", "notes")

_blob_client = None


def _get_blob_client():
    global _blob_client
    if _blob_client is None:
        if _STORAGE_ACCOUNT_URL:
            # Use managed identity (production)
            _blob_client = BlobServiceClient(
                account_url=_STORAGE_ACCOUNT_URL,
                credential=DefaultAzureCredential(),
            )
        else:
            # Fallback to connection string (local development)
            _blob_client = BlobServiceClient.from_connection_string(_STORAGE_CONN)
    return _blob_client


def _container():
    client = _get_blob_client()
    container = client.get_container_client(_NOTES_CONTAINER)
    try:
        container.get_container_properties()
    except ResourceNotFoundError:
        container.create_container()
    return container


def _blob_name(note_id: str) -> str:
    safe_id = note_id.replace("/", "_").replace("\\", "_")
    return f"{safe_id}.json"


def _read_note(note_id: str):
    try:
        blob = _container().download_blob(_blob_name(note_id))
        return json.loads(blob.readall())
    except ResourceNotFoundError:
        return None


def _write_note(data: dict) -> None:
    content = json.dumps(data, ensure_ascii=False).encode("utf-8")
    _container().upload_blob(
        name=_blob_name(data["id"]),
        data=content,
        overwrite=True,
        content_settings=ContentSettings(content_type="application/json"),
    )


def _delete_blob(note_id: str) -> None:
    try:
        _container().delete_blob(_blob_name(note_id))
    except ResourceNotFoundError:
        pass


def _list_blobs() -> list:
    result = []
    for blob in _container().list_blobs():
        if not blob.name.endswith(".json"):
            continue
        try:
            data = _read_note(blob.name[:-5])
            if data:
                result.append({
                    "id":        data.get("id", ""),
                    "title":     data.get("title", ""),
                    "updatedAt": data.get("updatedAt", ""),
                    "tags":      data.get("tags", []),
                })
        except Exception as e:
            logger.warning("Could not parse blob %s: %s", blob.name, e)
    result.sort(key=lambda n: n.get("updatedAt", ""), reverse=True)
    return result


# ---------------------------------------------------------------
# CORS helper
# ---------------------------------------------------------------

_CORS_HEADERS = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age":       "86400",
}


def _json_response(body, status_code: int = 200) -> func.HttpResponse:
    return func.HttpResponse(
        body=json.dumps(body, ensure_ascii=False),
        status_code=status_code,
        mimetype="application/json",
        headers=_CORS_HEADERS,
    )


def _preflight() -> func.HttpResponse:
    return func.HttpResponse(status_code=204, headers=_CORS_HEADERS)


def _error(message: str, status: int = 400) -> func.HttpResponse:
    return _json_response({"error": message}, status)


# ---------------------------------------------------------------
# GET /api/list
# ---------------------------------------------------------------

@app.route(route="list", methods=["GET", "OPTIONS"])
async def list_notes(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return _preflight()
    try:
        notes = _list_blobs()
        return _json_response(notes)
    except Exception as e:
        logger.exception("list_notes error")
        return _error(str(e), 500)


# ---------------------------------------------------------------
# GET /api/load/{id}
# ---------------------------------------------------------------

@app.route(route="load/{id}", methods=["GET", "OPTIONS"])
async def load_note(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return _preflight()
    note_id = req.route_params.get("id", "")
    if not note_id:
        return _error("Missing note id")
    try:
        data = _read_note(note_id)
        if data is None:
            return _error(f"Note not found: {note_id}", 404)
        return _json_response(data)
    except Exception as e:
        logger.exception("load_note error")
        return _error(str(e), 500)


# ---------------------------------------------------------------
# POST /api/save
# ---------------------------------------------------------------

@app.route(route="save", methods=["POST", "OPTIONS"])
async def save_note(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return _preflight()
    try:
        body = req.get_json()
    except ValueError:
        return _error("Invalid JSON body")

    note_id  = body.get("id", "").strip()
    title    = body.get("title", "").strip()
    markdown = body.get("markdown", "")
    tags     = body.get("tags", [])

    if not note_id:
        return _error("Missing required field: id")
    if not title:
        title = "Untitled"

    try:
        now  = datetime.now(timezone.utc).isoformat()
        data = {
            "id":        note_id,
            "title":     title,
            "markdown":  markdown,
            "tags":      tags if isinstance(tags, list) else [],
            "updatedAt": now,
        }
        _write_note(data)
        return _json_response(data)
    except Exception as e:
        logger.exception("save_note error")
        return _error(str(e), 500)


# ---------------------------------------------------------------
# DELETE /api/delete/{id}
# ---------------------------------------------------------------

@app.route(route="delete/{id}", methods=["DELETE", "OPTIONS"])
async def delete_note(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return _preflight()
    note_id = req.route_params.get("id", "")
    if not note_id:
        return _error("Missing note id")
    try:
        _delete_blob(note_id)
        return _json_response({"deleted": note_id})
    except Exception as e:
        logger.exception("delete_note error")
        return _error(str(e), 500)


# ---------------------------------------------------------------
# POST /api/agent/chat
# ---------------------------------------------------------------

@app.route(route="agent/chat", methods=["GET", "POST", "OPTIONS"])
async def agent_chat(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return _preflight()

    try:
        payload = req.get_json()
    except ValueError:
        return _error("Invalid JSON body")

    message  = (payload.get("message") or "").strip()
    context  = payload.get("context") or {}
    markdown = (context.get("markdown") or "").strip()

    if not message:
        return _error("'message' is required")

    try:
        result = await run_flow_agent(message=message, markdown=markdown, context=context)
        return _json_response(result)
    except RuntimeError as exc:
        logger.error("Agent config error: %s", exc)
        return _error(str(exc), 500)
    except Exception as exc:
        logger.exception("Unexpected error in agent_chat")
        err_str = str(exc)
        # Provide actionable guidance for common Azure OpenAI 404 errors
        is_404 = False
        try:
            from openai import NotFoundError
            is_404 = isinstance(exc, NotFoundError)
        except ImportError:
            pass
        if not is_404:
            is_404 = "404" in err_str and "not found" in err_str.lower()

        if is_404:
            endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT", "(not set)")
            deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "(not set)")
            api_ver = os.environ.get("AZURE_OPENAI_API_VERSION", "(not set)")
            logger.error(
                "Azure OpenAI 404: endpoint=%s deployment=%s api_version=%s – "
                "verify that the deployment name matches an existing model deployment "
                "in the Azure OpenAI resource and that GitHub Secrets match Bicep outputs.",
                endpoint, deployment, api_ver,
            )
            return _json_response({
                "error": f"Agent error: {exc}",
                "diagnostics": {
                    "endpoint": endpoint,
                    "deployment": deployment,
                    "apiVersion": api_ver,
                    "hint": (
                        "Azure OpenAI returned 404 (Resource not found). "
                        "Please verify: (1) AZURE_OPENAI_DEPLOYMENT_NAME matches "
                        "an existing deployment in Azure Portal > Azure OpenAI > Model deployments, "
                        "(2) AZURE_OPENAI_ENDPOINT is correct, "
                        "(3) AZURE_OPENAI_API_VERSION is supported."
                    ),
                },
            }, 500)
        return _error(f"Agent error: {exc}", 500)


# ---------------------------------------------------------------
# POST /api/ocr
# ---------------------------------------------------------------

@app.route(route="ocr", methods=["POST", "OPTIONS"])
async def ocr_image(req: func.HttpRequest) -> func.HttpResponse:
    """Extract text from a base64-encoded image using the vision model."""
    if req.method == "OPTIONS":
        return _preflight()

    try:
        payload = req.get_json()
    except ValueError:
        return _error("Invalid JSON body")

    image = (payload.get("image") or "").strip()
    mime_type = payload.get("mimeType") or "image/png"

    if not image:
        return _error("'image' is required")

    try:
        from agents.flow_agent import run_ocr
        text = await run_ocr(image, mime_type)
        return _json_response({"text": text})
    except ValueError as exc:
        # 未対応 MIME タイプ等の入力エラー → 400
        return _error(str(exc), 400)
    except RuntimeError as exc:
        logger.error("OCR config error: %s", exc)
        return _error(str(exc), 500)
    except Exception as exc:
        logger.exception("OCR error")
        return _error(f"OCR error: {exc}", 500)


# ---------------------------------------------------------------
# POST /api/parse-document  – PDF / DOCX / PPTX / XLSX → Markdown
# ---------------------------------------------------------------

@app.route(route="parse-document", methods=["POST", "OPTIONS"])
async def parse_document_api(req: func.HttpRequest) -> func.HttpResponse:
    """Parse PDF/DOCX/PPTX/XLSX and return extracted text as Markdown."""
    if req.method == "OPTIONS":
        return _preflight()

    try:
        payload = req.get_json()
    except ValueError:
        return _error("Invalid JSON body")

    content   = (payload.get("content") or "").strip()
    file_name = (payload.get("fileName") or "").strip()
    mime_type =  payload.get("mimeType") or ""

    if not content:
        return _error("'content' (base64) is required")
    if not file_name:
        return _error("'fileName' is required")

    try:
        from agents.flow_agent import parse_document
        text = await parse_document(content, file_name, mime_type)
        return _json_response({"text": text})
    except ValueError as exc:
        return _error(str(exc), 400)
    except RuntimeError as exc:
        logger.error("parse-document error: %s", exc)
        return _error(str(exc), 500)
    except Exception as exc:
        logger.exception("parse-document unexpected error")
        return _error(f"Parse error: {exc}", 500)


# ---------------------------------------------------------------
# 認証ヘルパー: Microsoft JWKS を使って Entra ID idToken を検証
# ---------------------------------------------------------------

def _verify_entra_token(id_token: str, entra_client_id: str) -> dict:
    """
    Entra ID（Azure AD）が発行した idToken を検証し、ペイロードを返す。
    PyJWT[cryptography] が必要。
    """
    import base64 as _b64
    import jwt as _jwt  # PyJWT
    from jwt import PyJWKClient

    parts = id_token.split(".")
    if len(parts) < 2:
        raise ValueError("Invalid token format")

    # tid を unverified payload から取得（署名検証前）
    padding = "=" * (4 - len(parts[1]) % 4)
    raw = _b64.b64decode(parts[1] + padding)
    raw_payload = json.loads(raw)
    tid = raw_payload.get("tid", "common")

    # Microsoft JWKS で署名検証
    jwks_url = f"https://login.microsoftonline.com/{tid}/discovery/v2.0/keys"
    jwks_client = PyJWKClient(jwks_url, cache_keys=True)
    signing_key = jwks_client.get_signing_key_from_jwt(id_token)

    payload = _jwt.decode(
        id_token,
        signing_key.key,
        algorithms=["RS256"],
        audience=entra_client_id,
        issuer=f"https://login.microsoftonline.com/{tid}/v2.0",
    )
    return payload


def _user_from_payload(payload: dict) -> dict:
    """JWT ペイロードからユーザー情報を抽出。"""
    name = payload.get("name") or payload.get("preferred_username") or ""
    email = (payload.get("preferred_username") or payload.get("email") or "").lower()
    oid = payload.get("oid") or payload.get("sub") or ""
    return {"id": oid, "name": name, "email": email}


# ---------------------------------------------------------------
# POST /api/auth/entra  – Entra ID idToken 検証
# ---------------------------------------------------------------

@app.route(route="auth/entra", methods=["POST", "OPTIONS"])
async def auth_entra(req: func.HttpRequest) -> func.HttpResponse:
    """
    フロントエンドから受け取った MSAL idToken を検証し、
    ユーザー基本情報（id/name/email）を返す。
    """
    if req.method == "OPTIONS":
        return _preflight()

    entra_client_id = os.environ.get("ENTRA_CLIENT_ID", "").strip()
    if not entra_client_id:
        return _error("ENTRA_CLIENT_ID is not configured on the server.", 500)

    try:
        body = req.get_json()
    except ValueError:
        return _error("Invalid JSON body")

    id_token = (body.get("idToken") or "").strip()
    if not id_token:
        return _error("idToken is required", 400)

    try:
        payload = _verify_entra_token(id_token, entra_client_id)
        user = _user_from_payload(payload)
        logger.info("auth_entra: verified user %s (%s)", user.get("id"), user.get("email"))
        return _json_response({"ok": True, "user": user})
    except Exception as e:
        logger.exception("auth_entra verification error")
        return _error(f"Token verification failed: {e}", 401)


# ---------------------------------------------------------------
# GET /api/auth/me  – Bearer トークンから認証済みユーザー情報返却
# ---------------------------------------------------------------

@app.route(route="auth/me", methods=["GET", "OPTIONS"])
async def auth_me(req: func.HttpRequest) -> func.HttpResponse:
    """
    Authorization: Bearer <idToken> ヘッダーを検証し、ユーザー情報を返す。
    """
    if req.method == "OPTIONS":
        return _preflight()

    entra_client_id = os.environ.get("ENTRA_CLIENT_ID", "").strip()
    if not entra_client_id:
        return _error("ENTRA_CLIENT_ID is not configured on the server.", 500)

    auth_header = req.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return _error("Authorization header with Bearer token is required", 401)

    id_token = auth_header[len("Bearer "):].strip()
    try:
        payload = _verify_entra_token(id_token, entra_client_id)
        user = _user_from_payload(payload)
        return _json_response({"ok": True, "user": user})
    except Exception as e:
        logger.exception("auth_me verification error")
        return _error(f"Token verification failed: {e}", 401)


# ---------------------------------------------------------------
# GET /api/mgmt/analytics/users  – App Insights ユーザー活動集計 (管理者専用)
# NOTE: /api/admin/* は Azure Functions ランタイムが予約しているため mgmt を使用
# ---------------------------------------------------------------

@app.route(route="mgmt/analytics/users", methods=["GET", "OPTIONS"])
async def admin_analytics_users(req: func.HttpRequest) -> func.HttpResponse:
    """
    Azure Monitor Logs Query SDK で Application Insights にクエリし、
    ユーザーごとのイベント集計を返す。
    ENTRA_CLIENT_ID が設定されている場合、Bearer トークンを検証して管理者のみ許可する。
    """
    if req.method == "OPTIONS":
        return _preflight()

    # 管理者認証 (ENTRA_CLIENT_ID が設定済みの場合のみ)
    entra_client_id = os.environ.get("ENTRA_CLIENT_ID", "").strip()
    if entra_client_id:
        auth_header = req.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return _error("Authorization header required", 401)
        id_token = auth_header[len("Bearer "):].strip()
        try:
            payload = _verify_entra_token(id_token, entra_client_id)
            user = _user_from_payload(payload)
            if user.get("email") != "hfujiwara@microsoft.com":
                return _error("Admin access required", 403)
        except Exception as e:
            logger.exception("admin_analytics_users auth error")
            return _error(f"Token verification failed: {e}", 401)

    workspace_id = os.environ.get("APPINSIGHTS_WORKSPACE_ID", "").strip()
    if not workspace_id:
        return _error("APPINSIGHTS_WORKSPACE_ID is not configured", 500)

    try:
        from azure.monitor.query import LogsQueryClient, LogsQueryStatus
        from datetime import timedelta

        credential = DefaultAzureCredential()
        client = LogsQueryClient(credential)

        # ユーザーごとの活動集計 (90日)
        kql_users = """
union customEvents, pageViews
| where timestamp > ago(90d)
| where isnotempty(user_AuthenticatedId)
| summarize
    totalEvents   = count(),
    lastActivity  = max(timestamp),
    firstActivity = min(timestamp),
    activeDays    = dcount(bin(timestamp, 1d)),
    noteCreated   = countif(name == 'note_created'),
    noteSaved     = countif(name == 'note_saved'),
    agentMessages = countif(name == 'agent_message_sent'),
    templateApplied   = countif(name == 'template_applied'),
    suggestionApplied = countif(name == 'suggestion_applied')
  by user_AuthenticatedId
| order by totalEvents desc
| take 100
        """

        # ユーザーごとの30日間日別イベント数 (スパークライン用)
        kql_daily = """
union customEvents, pageViews
| where timestamp > ago(30d)
| where isnotempty(user_AuthenticatedId)
| summarize count() by user_AuthenticatedId, day = format_datetime(bin(timestamp, 1d), 'yyyy-MM-dd')
| order by user_AuthenticatedId, day
        """

        users_resp = client.query_workspace(
            workspace_id=workspace_id,
            query=kql_users,
            timespan=timedelta(days=90),
        )
        daily_resp = client.query_workspace(
            workspace_id=workspace_id,
            query=kql_daily,
            timespan=timedelta(days=30),
        )

        if users_resp.status != LogsQueryStatus.SUCCESS:
            return _error("Users log query failed", 500)

        # 日別データを email → [{day, count}] の辞書に変換
        daily_map: dict = {}
        if daily_resp.status == LogsQueryStatus.SUCCESS and daily_resp.tables:
            daily_table = daily_resp.tables[0]
            daily_cols = [c.name for c in daily_table.columns]
            for row in daily_resp.tables[0].rows:
                rd = dict(zip(daily_cols, row))
                email = rd.get("user_AuthenticatedId", "")
                daily_map.setdefault(email, []).append(
                    {"day": rd.get("day", ""), "count": int(rd.get("count_", 0))}
                )

        users_table = users_resp.tables[0]
        cols = [c.name for c in users_table.columns]
        users: list = []
        for row in users_resp.tables[0].rows:
            rd = dict(zip(cols, row))
            email = rd.get("user_AuthenticatedId", "")
            last_ts = rd.get("lastActivity")
            first_ts = rd.get("firstActivity")
            users.append({
                "email":            email,
                "totalEvents":      int(rd.get("totalEvents", 0)),
                "lastActivity":     last_ts.isoformat() if last_ts else None,
                "firstActivity":    first_ts.isoformat() if first_ts else None,
                "activeDays":       int(rd.get("activeDays", 0)),
                "noteCreated":      int(rd.get("noteCreated", 0)),
                "noteSaved":        int(rd.get("noteSaved", 0)),
                "agentMessages":    int(rd.get("agentMessages", 0)),
                "templateApplied":  int(rd.get("templateApplied", 0)),
                "suggestionApplied": int(rd.get("suggestionApplied", 0)),
                "dailyActivity":    daily_map.get(email, []),
            })

        return _json_response({"users": users, "source": "application_insights"})

    except Exception as e:
        logger.exception("admin_analytics_users query error")
        return _error(f"Query failed: {e}", 500)


# ---------------------------------------------------------------
# GET /api/agent/health
# ---------------------------------------------------------------

@app.route(route="agent/health", methods=["GET", "OPTIONS"])
async def agent_health(req: func.HttpRequest) -> func.HttpResponse:
    """Return Azure OpenAI configuration status without making an API call."""
    if req.method == "OPTIONS":
        return _preflight()

    endpoint   = os.environ.get("AZURE_OPENAI_ENDPOINT", "").strip().rstrip("/")
    deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "").strip()
    api_ver    = os.environ.get("AZURE_OPENAI_API_VERSION", "").strip()
    openai_key = os.environ.get("OPENAI_API_KEY", "").strip()

    issues: list[str] = []

    if endpoint:
        provider = "azure"
        if not endpoint.startswith("https://"):
            issues.append("AZURE_OPENAI_ENDPOINT does not start with 'https://'")
        if endpoint.rstrip("/").endswith("/openai"):
            issues.append("AZURE_OPENAI_ENDPOINT should not end with '/openai'")
        if not deployment:
            issues.append("AZURE_OPENAI_DEPLOYMENT_NAME is not set")
        if " " in deployment or "/" in deployment:
            issues.append("AZURE_OPENAI_DEPLOYMENT_NAME contains invalid characters (spaces or slashes)")
    elif openai_key:
        provider = "openai"
    else:
        provider = "none"
        issues.append("No LLM provider configured (set AZURE_OPENAI_ENDPOINT or OPENAI_API_KEY)")

    status = "ok" if not issues else "misconfigured"

    return _json_response({
        "status": status,
        "provider": provider,
        "config": {
            "endpoint": endpoint or "(not set)",
            "deployment": deployment or "(not set)",
            "apiVersion": api_ver or "(using default)",
        },
        "issues": issues,
    })
