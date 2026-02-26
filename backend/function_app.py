"""
FlowNote Azure Functions backend  - Python v2 programming model

Endpoints:
  GET    /api/list           - List all note metadata
  GET    /api/load/{id}      - Load a single note
  POST   /api/save           - Create or update a note
  DELETE /api/delete/{id}    - Delete a note
  POST   /api/agent/chat     - AI agent chat endpoint
"""

import json
import logging
import os
from datetime import datetime, timezone

import azure.functions as func
from azure.storage.blob import BlobServiceClient, ContentSettings
from azure.core.exceptions import ResourceNotFoundError

from agents.flow_agent import run_flow_agent

logger = logging.getLogger(__name__)
app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

# ---------------------------------------------------------------
# Blob Storage helpers
# ---------------------------------------------------------------

_STORAGE_CONN    = os.environ.get("STORAGE_CONNECTION_STRING", "")
_NOTES_CONTAINER = os.environ.get("NOTES_CONTAINER", "notes")

_blob_client = None


def _get_blob_client():
    global _blob_client
    if _blob_client is None:
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
        return _error(f"Agent error: {exc}", 500)
