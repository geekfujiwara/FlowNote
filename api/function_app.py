"""
FlowNote Azure Functions Backend (Python v2 programming model)

Authentication: Bearer JWT token; the `oid` claim is extracted by base64-decoding
the payload segment of the JWT.  Signature validation is intentionally skipped here
so that no public-key / JWKS fetch is required at cold-start.  In production you
should validate the token against your Azure AD tenant's JWKS endpoint.
"""

import base64
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any

import azure.functions as func
from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient

logger = logging.getLogger(__name__)

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

# ---------------------------------------------------------------------------
# Configuration helpers
# ---------------------------------------------------------------------------

STORAGE_ACCOUNT_URL = os.environ.get("AZURE_STORAGE_ACCOUNT_URL", "")
SIGNALR_CONNECTION_STRING = os.environ.get("AZURE_SIGNALR_CONNECTION_STRING", "")
AZURE_AI_ENDPOINT = os.environ.get("AZURE_AI_ENDPOINT", "")
AZURE_AI_AGENT_ID = os.environ.get("AZURE_AI_AGENT_ID", "")

CONTAINER_BODY = "flownotes"
CONTAINER_META = "flownotes-meta"


def _get_blob_client() -> BlobServiceClient:
    credential = DefaultAzureCredential()
    return BlobServiceClient(account_url=STORAGE_ACCOUNT_URL, credential=credential)


# ---------------------------------------------------------------------------
# JWT / Auth helpers
# ---------------------------------------------------------------------------

def _decode_jwt_payload(token: str) -> dict:
    """
    Decode the JWT payload without verifying the signature.
    WARNING: This is intentionally skipped for the initial implementation.
    In production, validate the token against your Azure AD JWKS endpoint.
    """
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return {}
        payload_b64 = parts[1]
        # Add padding
        payload_b64 += "=" * (-len(payload_b64) % 4)
        payload_bytes = base64.urlsafe_b64decode(payload_b64)
        return json.loads(payload_bytes)
    except (ValueError, json.JSONDecodeError, Exception) as exc:  # noqa: BLE001
        logger.warning("Failed to decode JWT payload: %s", exc)
        return {}


def _get_oid(request: func.HttpRequest) -> str | None:
    """Extract the oid claim from the Bearer token in the Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header[len("Bearer "):]
    payload = _decode_jwt_payload(token)
    return payload.get("oid") or payload.get("sub") or None


def _unauthorized(message: str = "Unauthorized") -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps({"error": message}),
        status_code=401,
        mimetype="application/json",
    )


def _bad_request(message: str) -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps({"error": message}),
        status_code=400,
        mimetype="application/json",
    )


def _not_found(message: str = "Not found") -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps({"error": message}),
        status_code=404,
        mimetype="application/json",
    )


def _json_response(data: Any, status_code: int = 200) -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps(data),
        status_code=status_code,
        mimetype="application/json",
    )


# ---------------------------------------------------------------------------
# SignalR helpers (REST API approach)
# ---------------------------------------------------------------------------

import hashlib
import hmac
import time
import urllib.parse

import requests


def _parse_signalr_connection_string(conn_str: str) -> tuple[str, str]:
    """Return (endpoint, access_key) from a SignalR connection string."""
    parts = dict(part.split("=", 1) for part in conn_str.split(";") if "=" in part)
    endpoint = parts.get("Endpoint", "").rstrip("/")
    access_key = parts.get("AccessKey", "")
    return endpoint, access_key


def _generate_signalr_token(endpoint: str, access_key: str, hub: str, user_id: str = "") -> str:
    url = f"{endpoint}/client/?hub={hub}"
    exp = int(time.time()) + 3600
    header = base64.urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()).rstrip(b"=")
    payload_data: dict[str, Any] = {"nbf": int(time.time()), "exp": exp, "aud": url}
    if user_id:
        payload_data["nameid"] = user_id
    payload = base64.urlsafe_b64encode(json.dumps(payload_data).encode()).rstrip(b"=")
    signing_input = header + b"." + payload
    signature = base64.urlsafe_b64encode(
        hmac.new(access_key.encode(), signing_input, hashlib.sha256).digest()
    ).rstrip(b"=")
    return (signing_input + b"." + signature).decode()


def _signalr_send_to_group(group: str, target: str, message_args: list) -> None:
    """Send a SignalR message to a group via the REST API."""
    if not SIGNALR_CONNECTION_STRING:
        logger.warning("AZURE_SIGNALR_CONNECTION_STRING not configured; skipping SignalR notification")
        return
    try:
        endpoint, access_key = _parse_signalr_connection_string(SIGNALR_CONNECTION_STRING)
        hub = "flownote"
        token = _generate_signalr_token(endpoint, access_key, hub)
        url = f"{endpoint}/api/v1/hubs/{hub}/groups/{urllib.parse.quote(group)}"
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        body = {"target": target, "arguments": message_args}
        resp = requests.post(url, json=body, headers=headers, timeout=5)
        if resp.status_code not in (200, 202):
            logger.warning("SignalR send failed: %s %s", resp.status_code, resp.text)
    except Exception as exc:  # noqa: BLE001
        logger.warning("SignalR notification error: %s", exc)


def _signalr_negotiate(user_id: str) -> dict:
    """Return SignalR negotiate payload for a client."""
    if not SIGNALR_CONNECTION_STRING:
        return {"url": "", "accessToken": ""}
    endpoint, access_key = _parse_signalr_connection_string(SIGNALR_CONNECTION_STRING)
    hub = "flownote"
    token = _generate_signalr_token(endpoint, access_key, hub, user_id)
    url = f"{endpoint}/client/?hub={hub}"
    return {"url": url, "accessToken": token}


# ---------------------------------------------------------------------------
# Blob helpers
# ---------------------------------------------------------------------------

def _blob_exists(client: BlobServiceClient, container: str, blob_name: str) -> bool:
    try:
        client.get_blob_client(container=container, blob=blob_name).get_blob_properties()
        return True
    except Exception:  # noqa: BLE001
        return False


def _upload_blob(client: BlobServiceClient, container: str, blob_name: str, data: str) -> None:
    blob = client.get_blob_client(container=container, blob=blob_name)
    blob.upload_blob(data.encode("utf-8"), overwrite=True)


def _download_blob(client: BlobServiceClient, container: str, blob_name: str) -> str:
    blob = client.get_blob_client(container=container, blob=blob_name)
    stream = blob.download_blob()
    return stream.readall().decode("utf-8")


def _delete_blob(client: BlobServiceClient, container: str, blob_name: str) -> None:
    blob = client.get_blob_client(container=container, blob=blob_name)
    blob.delete_blob()


def _list_blobs_in_prefix(client: BlobServiceClient, container: str, prefix: str):
    container_client = client.get_container_client(container)
    return list(container_client.list_blobs(name_starts_with=prefix))


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.route(route="list", methods=["GET"])
def list_notes(req: func.HttpRequest) -> func.HttpResponse:
    """Return all note metadata for the authenticated user."""
    oid = _get_oid(req)
    if not oid:
        return _unauthorized()

    try:
        storage = _get_blob_client()
        blobs = _list_blobs_in_prefix(storage, CONTAINER_META, f"{oid}/")
        notes = []
        for blob in blobs:
            try:
                raw = _download_blob(storage, CONTAINER_META, blob.name)
                meta = json.loads(raw)
                note_id = blob.name.split("/")[-1].replace(".json", "")
                notes.append(
                    {
                        "id": note_id,
                        "title": meta.get("title", ""),
                        "updatedAt": meta.get("updatedAt", ""),
                        "tags": meta.get("tags", []),
                    }
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("Skipping malformed metadata blob %s: %s", blob.name, exc)

        notes.sort(key=lambda n: n["updatedAt"], reverse=True)
        return _json_response(notes)

    except Exception as exc:
        logger.exception("list_notes error: %s", exc)
        return func.HttpResponse(json.dumps({"error": "Internal server error"}), status_code=500, mimetype="application/json")


@app.route(route="save", methods=["POST"])
def save_note(req: func.HttpRequest) -> func.HttpResponse:
    """Create or update a note."""
    oid = _get_oid(req)
    if not oid:
        return _unauthorized()

    try:
        body = req.get_json()
    except ValueError:
        return _bad_request("Invalid JSON body")

    title = body.get("title", "").strip()
    markdown = body.get("markdown", "")
    tags = body.get("tags") or []
    note_id = body.get("id") or str(uuid.uuid4())

    if not title:
        return _bad_request("title is required")

    updated_at = datetime.now(timezone.utc).isoformat()
    meta = {"title": title, "tags": tags, "updatedAt": updated_at, "oid": oid}

    try:
        storage = _get_blob_client()
        _upload_blob(storage, CONTAINER_BODY, f"{oid}/{note_id}.md", markdown)
        _upload_blob(storage, CONTAINER_META, f"{oid}/{note_id}.json", json.dumps(meta))
    except Exception as exc:
        logger.exception("save_note storage error: %s", exc)
        return func.HttpResponse(json.dumps({"error": "Storage error"}), status_code=500, mimetype="application/json")

    # Notify via SignalR (best-effort)
    _signalr_send_to_group(oid, "noteUpdated", [{"noteId": note_id, "oid": oid}])

    return _json_response({"id": note_id, "updatedAt": updated_at})


@app.route(route="load/{id}", methods=["GET"])
def load_note(req: func.HttpRequest) -> func.HttpResponse:
    """Load the full content of a note."""
    oid = _get_oid(req)
    if not oid:
        return _unauthorized()

    note_id = req.route_params.get("id", "").strip()
    if not note_id:
        return _bad_request("Note id is required")

    try:
        storage = _get_blob_client()
        if not _blob_exists(storage, CONTAINER_META, f"{oid}/{note_id}.json"):
            return _not_found()

        raw_meta = _download_blob(storage, CONTAINER_META, f"{oid}/{note_id}.json")
        meta = json.loads(raw_meta)

        # Guard: ensure the stored oid matches the requesting user
        if meta.get("oid") and meta["oid"] != oid:
            return _unauthorized("Access denied")

        markdown = _download_blob(storage, CONTAINER_BODY, f"{oid}/{note_id}.md")

        return _json_response(
            {
                "id": note_id,
                "markdown": markdown,
                "title": meta.get("title", ""),
                "tags": meta.get("tags", []),
                "updatedAt": meta.get("updatedAt", ""),
            }
        )
    except Exception as exc:
        logger.exception("load_note error: %s", exc)
        return func.HttpResponse(json.dumps({"error": "Internal server error"}), status_code=500, mimetype="application/json")


@app.route(route="delete/{id}", methods=["DELETE"])
def delete_note(req: func.HttpRequest) -> func.HttpResponse:
    """Delete a note (both body and metadata blobs)."""
    oid = _get_oid(req)
    if not oid:
        return _unauthorized()

    note_id = req.route_params.get("id", "").strip()
    if not note_id:
        return _bad_request("Note id is required")

    try:
        storage = _get_blob_client()

        # Verify ownership before deleting
        meta_blob = f"{oid}/{note_id}.json"
        if not _blob_exists(storage, CONTAINER_META, meta_blob):
            return _not_found()

        raw_meta = _download_blob(storage, CONTAINER_META, meta_blob)
        meta = json.loads(raw_meta)
        if meta.get("oid") and meta["oid"] != oid:
            return _unauthorized("Access denied")

        _delete_blob(storage, CONTAINER_META, meta_blob)
        body_blob = f"{oid}/{note_id}.md"
        if _blob_exists(storage, CONTAINER_BODY, body_blob):
            _delete_blob(storage, CONTAINER_BODY, body_blob)

    except Exception as exc:
        logger.exception("delete_note error: %s", exc)
        return func.HttpResponse(json.dumps({"error": "Internal server error"}), status_code=500, mimetype="application/json")

    return func.HttpResponse(status_code=204)


@app.route(route="negotiate", methods=["GET", "POST"])
def negotiate(req: func.HttpRequest) -> func.HttpResponse:
    """Return SignalR connection info for the authenticated client."""
    oid = _get_oid(req)
    if not oid:
        return _unauthorized()

    try:
        connection_info = _signalr_negotiate(oid)
        return _json_response(connection_info)
    except Exception as exc:
        logger.exception("negotiate error: %s", exc)
        return func.HttpResponse(json.dumps({"error": "Internal server error"}), status_code=500, mimetype="application/json")


@app.route(route="notify", methods=["POST"])
def notify(req: func.HttpRequest) -> func.HttpResponse:
    """
    Internal endpoint: send a SignalR noteUpdated notification.
    No auth check — this should only be reachable from trusted internal callers
    (e.g. same VNet / function key enforced at the infrastructure layer).
    """
    try:
        body = req.get_json()
    except ValueError:
        return _bad_request("Invalid JSON body")

    note_id = body.get("noteId", "")
    oid = body.get("oid", "")
    if not note_id or not oid:
        return _bad_request("noteId and oid are required")

    _signalr_send_to_group(oid, "noteUpdated", [{"noteId": note_id, "oid": oid}])
    return _json_response({"status": "sent"})


# ---------------------------------------------------------------------------
# Agent chat
# ---------------------------------------------------------------------------

def _call_agent(note_id: str, message: str, context: dict) -> dict:
    """
    Attempt to use azure-ai-projects; fall back to a stub if the SDK is
    not available or not configured.
    """
    if AZURE_AI_ENDPOINT and AZURE_AI_AGENT_ID:
        try:
            from azure.ai.projects import AIProjectClient  # type: ignore
            from azure.identity import DefaultAzureCredential as _Cred

            client = AIProjectClient(endpoint=AZURE_AI_ENDPOINT, credential=_Cred())
            agent = client.agents.get_agent(AZURE_AI_AGENT_ID)
            thread = client.agents.create_thread()
            client.agents.create_message(
                thread_id=thread.id,
                role="user",
                content=json.dumps(
                    {
                        "noteId": note_id,
                        "userMessage": message,
                        "currentMarkdown": context.get("markdown", ""),
                        "selection": context.get("selection"),
                        "metadata": context.get("metadata"),
                    }
                ),
            )
            run = client.agents.create_and_process_run(thread_id=thread.id, agent_id=agent.id)
            messages = client.agents.list_messages(thread_id=thread.id)
            assistant_msgs = [m for m in messages.data if m.role == "assistant"]
            reply_text = assistant_msgs[0].content[0].text.value if assistant_msgs else ""
            try:
                reply = json.loads(reply_text)
            except ValueError:
                reply = {
                    "summary": reply_text,
                    "markdown": context.get("markdown", ""),
                    "impacts": {"nodesDelta": 0, "edgesDelta": 0},
                }
            reply.setdefault("suggestionId", str(uuid.uuid4()))
            return reply
        except ImportError:
            logger.info("azure-ai-projects not installed; using stub agent response")
        except Exception as exc:  # noqa: BLE001
            logger.warning("Agent call failed, using stub: %s", exc)

    # --- Stub response ---
    suggestion_id = str(uuid.uuid4())
    stub_markdown = context.get("markdown", "")
    return {
        "suggestionId": suggestion_id,
        "summary": f"[Stub] Processed: {message[:80]}",
        "markdown": stub_markdown,
        "impacts": {"nodesDelta": 0, "edgesDelta": 0},
    }


@app.route(route="agent/chat", methods=["POST"])
def agent_chat(req: func.HttpRequest) -> func.HttpResponse:
    """Process an AI agent chat request for a note."""
    oid = _get_oid(req)
    if not oid:
        return _unauthorized()

    try:
        body = req.get_json()
    except ValueError:
        return _bad_request("Invalid JSON body")

    note_id = body.get("noteId", "")
    message = body.get("message", "").strip()
    context = body.get("context")
    if context is None:
        context = {}

    if not message:
        return _bad_request("message is required")

    try:
        result = _call_agent(note_id, message, context)
        return _json_response(result)
    except Exception as exc:
        logger.exception("agent_chat error: %s", exc)
        return func.HttpResponse(json.dumps({"error": "Internal server error"}), status_code=500, mimetype="application/json")
