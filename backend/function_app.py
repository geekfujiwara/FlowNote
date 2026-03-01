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
from azure.identity import DefaultAzureCredential

# ---------------------------------------------------------------
# OpenTelemetry backward-compat shim
# agent-framework-azure-ai uses opentelemetry-instrumentation-openai
# which accesses SpanAttributes.LLM_REQUEST_MODEL etc. at runtime.
# Depending on the installed version of opentelemetry-semantic-conventions-ai,
# these may be missing. Patch all known module paths proactively.
# ---------------------------------------------------------------
import sys as _sys
import types as _types
import logging as _shim_log

_LLM_ATTRS_MAP = {
    'LLM_REQUEST_MODEL':            'llm.request.model',
    'LLM_RESPONSE_MODEL':           'llm.response.model',
    'LLM_VENDOR':                   'llm.vendor',
    'LLM_REQUEST_TYPE':             'llm.request.type',
    'LLM_REQUEST_MAX_TOKENS':       'llm.request.max_tokens',
    'LLM_TEMPERATURE':              'llm.temperature',
    'LLM_TOP_P':                    'llm.top_p',
    'LLM_USAGE_PROMPT_TOKENS':      'llm.usage.prompt_tokens',
    'LLM_USAGE_COMPLETION_TOKENS':  'llm.usage.completion_tokens',
    'LLM_USAGE_TOTAL_TOKENS':       'llm.usage.total_tokens',
    'LLM_STREAM':                   'llm.is_streaming',
}

def _patch_span_attributes(sa_class):
    for _k, _v in _LLM_ATTRS_MAP.items():
        if not hasattr(sa_class, _k):
            try:
                setattr(sa_class, _k, _v)
            except Exception as _e:
                _shim_log.warning("OTEL SHIM: setattr %s failed: %s", _k, _e)

# 1. Patch opentelemetry.semconv.ai (opentelemetry-semantic-conventions-ai)
try:
    import opentelemetry.semconv.ai as _otel_ai_mod
    _SA_ai = getattr(_otel_ai_mod, 'SpanAttributes', None)
    if _SA_ai is not None:
        _patch_span_attributes(_SA_ai)
        _shim_log.warning("OTEL SHIM: patched opentelemetry.semconv.ai.SpanAttributes")
    else:
        # Create SpanAttributes in the module if missing
        class _SpanAttributesAI:
            pass
        for _k, _v in _LLM_ATTRS_MAP.items():
            setattr(_SpanAttributesAI, _k, _v)
        _otel_ai_mod.SpanAttributes = _SpanAttributesAI
        _shim_log.warning("OTEL SHIM: created SpanAttributes in opentelemetry.semconv.ai")
except ImportError:
    # Module doesn't exist at all – create a synthetic one
    try:
        _ai_mod = _types.ModuleType('opentelemetry.semconv.ai')
        class _SpanAttributesAI:
            pass
        for _k, _v in _LLM_ATTRS_MAP.items():
            setattr(_SpanAttributesAI, _k, _v)
        _ai_mod.SpanAttributes = _SpanAttributesAI
        _sys.modules['opentelemetry.semconv.ai'] = _ai_mod
        # Attach to parent package if it exists
        if 'opentelemetry.semconv' in _sys.modules:
            setattr(_sys.modules['opentelemetry.semconv'], 'ai', _ai_mod)
        _shim_log.warning("OTEL SHIM: injected synthetic opentelemetry.semconv.ai module")
    except Exception as _e2:
        _shim_log.warning("OTEL SHIM: failed to inject synthetic ai module: %s", _e2)
except Exception as _e:
    _shim_log.warning("OTEL SHIM: opentelemetry.semconv.ai patch failed: %s", _e)

# 2. Also patch opentelemetry.semconv.trace (legacy path)
try:
    import opentelemetry.semconv.trace as _otel_trace_mod
    _SA_trace = getattr(_otel_trace_mod, 'SpanAttributes', None)
    if _SA_trace is not None:
        _patch_span_attributes(_SA_trace)
except Exception:
    pass

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
        return _error(f"Agent error: {exc}", 500)


# ---------------------------------------------------------------
# GET /api/debug/otel  (診断用 – 本番でも一時的に有効化)
# ---------------------------------------------------------------

@app.route(route="debug/otel", methods=["GET"])
async def debug_otel(req: func.HttpRequest) -> func.HttpResponse:
    import importlib, sys as _s
    info: dict = {"sys_modules_otel": [], "span_attrs": {}}
    # installed packages
    try:
        import importlib.metadata as _meta
        pkgs = ["opentelemetry-semantic-conventions",
                "opentelemetry-semantic-conventions-ai",
                "opentelemetry-instrumentation-openai",
                "agent-framework-core",
                "agent-framework-azure-ai"]
        info["packages"] = {p: _meta.version(p) for p in pkgs if _meta.version.__doc__ or True
                            if _safe_version(_meta, p)}
    except Exception as e:
        info["packages_error"] = str(e)

    info["sys_modules_otel"] = [k for k in _s.modules if "otel" in k or "semconv" in k]

    # Check SpanAttributes in semconv.ai
    for mod_path in ["opentelemetry.semconv.ai", "opentelemetry.semconv.trace"]:
        try:
            m = importlib.import_module(mod_path)
            sa = getattr(m, "SpanAttributes", None)
            if sa:
                info["span_attrs"][mod_path] = {
                    "LLM_REQUEST_MODEL": getattr(sa, "LLM_REQUEST_MODEL", "MISSING"),
                }
            else:
                info["span_attrs"][mod_path] = "SpanAttributes not in module"
        except ImportError:
            info["span_attrs"][mod_path] = "ImportError"
        except Exception as e:
            info["span_attrs"][mod_path] = str(e)

    return _json_response(info)


def _safe_version(meta, pkg):
    try:
        return meta.version(pkg)
    except Exception:
        return None
