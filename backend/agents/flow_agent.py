"""
FlowNote AI – Agent Framework Python backend.

Uses Microsoft Agent Framework (agent-framework package) to interpret user
requests and produce structured Suggestion objects for the FlowNote frontend.

Required env vars (set ONE of the two providers):

  Azure OpenAI (recommended):
    AZURE_OPENAI_ENDPOINT         e.g. https://my-resource.openai.azure.com
    AZURE_OPENAI_DEPLOYMENT_NAME  default: gpt-4o-mini
    AZURE_OPENAI_API_KEY          optional; omit to use DefaultAzureCredential
    AZURE_OPENAI_API_VERSION      default: 2025-01-01-preview

  OpenAI:
    OPENAI_API_KEY
    OPENAI_MODEL                  default: gpt-4o-mini
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Annotated, Any

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
# System prompt
# ─────────────────────────────────────────────────────────────

BASE_SYSTEM_PROMPT = """You are FlowNote AI, a diagram and flowchart design assistant embedded in the FlowNote application.
Users write notes in Markdown that contain ```flow code blocks describing various diagrams.
Your job is to understand the user's intent and return an updated version of the Markdown.

## Flow Block Syntax (CRITICAL – follow exactly)

### Node Types
| Syntax              | Shape          | Use for                          |
|---------------------|----------------|----------------------------------|
| `[[id]] Label`      | Rounded rect   | Start / source / input / cause   |
| `((id)) Label`      | Circle         | End / goal / output / result     |
| `{id} Label`        | Diamond        | Decision / branch / evaluation   |
| `[id] Label`        | Rectangle      | Default / process / item         |

### Edge Syntax
```
[source] -> [target]           (no label)
[source] -> [target] : Label   (with label)
```

### Node ID Rules
- Lowercase alphanumeric and hyphens ONLY (e.g. `my-node`, `step1`)
- NO spaces, NO special chars except `-`

### CRITICAL Edge Rules
- Edge lines ALWAYS use plain `[id]` brackets for BOTH source and target
- NEVER write `[[id]] -> [other]` or `[src] -> ((id))` in edge lines
- Even if a node is defined as `[[start]]` or `((end))`, edges must use `[start] -> [end]`

## Template Pattern Reference

### Fishbone / Cause-Effect
- Cause nodes: `[[cause_x]] Category` (input nodes)
- Effect node: `((effect)) Problem` (output)
- Edges: `[cause_x] -> [effect]`

### Mind Map
- Center: `[[center]] Main Topic` (input)
- Branches: `[cat_x] Category` (default)
- Sub-items: `[item_x] Item` (default)
- Edges radiate outward: `[center] -> [cat_x]`, `[cat_x] -> [item_x]`

### Process Flowchart
- Start: `[[start]] Begin` (input), End: `((end)) Done` (output)
- Decisions: `{check_x} Question?` (selector/diamond)
- Steps: `[step_x] Task` (default)
- Conditional edges: `[check_x] -> [step_x] : Yes`

### SWOT Analysis
- Quadrant axes: `[[strength]] 強み (S)`, `[[weakness]] 弱み (W)`, `[[opportunity]] 機会 (O)`, `[[threat]] 脅威 (T)`
- Items: `[s1] Detail` (default)
- Strategy output: `((strategy)) SO戦略` (output for top strategy)

### Customer Journey Map
- Start phase: `[[phase_aware]] 認知フェーズ` (input)
- Mid phases: `[phase_x] フェーズ名` (default)
- Final goal: `((phase_advocate)) 推奨フェーズ` (output)
- Touchpoints: `[touch_x] タッチポイント` (default)

### User Story Map
- Epics: `[[epic_x]] Epic Name` (input)
- Stories/Tasks: `[story_x] Story`, `[task_x] Task` (default)
- Milestones: `((milestone_x)) Release v1` (output)

### Org Chart
- Top: `[[ceo]] CEO` (input)
- Departments/Roles: `[dept_x] Team` (default)
- Special units: `((unit_x)) New Division` (output)
- Edges represent reporting lines: `[manager] -> [report]`

### Roadmap / Timeline
- Phase starts: `[[q1]] Q1: Planning` (input)
- Tasks/Deliverables: `[task_x] Task` (default)
- Goal/KPI: `((goal)) Year-End OKR` (output)

### State Machine
- Initial state: `[[state_initial]] Initial` (input)
- States: `[state_x] State Name` (default)
- Guard/condition: `{guard_x} Condition` (selector)
- Final state: `((state_done)) Completed` (output)
- Transitions: `[state_a] -> [state_b] : event()`

### Risk Analysis
- Start: `[[risk_identify]] Risk ID` (input)
- Risk / action items: `[risk_x] Risk`, `[action_x] Mitigation` (default)
- Evaluation branch: `{eval_x} Evaluate` (selector)
- Register: `((risk_register)) Risk Register` (output)

## Tools at your disposal
Call these tools to manipulate the flow:
- add_node: add a new node
- remove_node: remove a node and its connected edges
- add_edge: connect two nodes with an optional label
- remove_edge: remove a connection
- replace_flow: completely replace all nodes and edges

## Markdown Preservation Rules
- ALWAYS keep the full Markdown (title, prose sections, the ```flow block)
- ONLY modify the content inside the ```flow ... ``` block when using tools
- When using replace_flow or returning full markdown in JSON, include the ENTIRE document

## Output Format
After applying changes, respond with ONLY this valid JSON (no markdown fences, no extra text):
{
  "markdown": "<complete Markdown document including title, prose, and updated ```flow block>",
  "summary": "<Japanese: 1-2 sentence description of what changed>",
  "nodesDelta": <integer>,
  "edgesDelta": <integer>,
  "changedNodeIds": ["<id>", ...],
  "changedEdgeIds": ["<e-source-target>", ...]
}

If the request is unclear or no change is needed, return the original markdown with nodesDelta=0.
"""

# Keep a module-level alias so tests / other modules can reference SYSTEM_PROMPT
SYSTEM_PROMPT = BASE_SYSTEM_PROMPT


# ─────────────────────────────────────────────────────────────
# Agent factory
# ─────────────────────────────────────────────────────────────

def _create_agent(tools: list | None = None, instructions: str | None = None) -> Any:  # type: Agent
    """Build and return an Agent Framework Agent from environment variables."""
    # ── OTEL shim: patch SpanAttributes before agent_framework is imported ──
    # opentelemetry-semantic-conventions-ai>=0.4.x may no longer expose
    # LLM_REQUEST_MODEL etc. on SpanAttributes. Ensure they exist so
    # agent-framework-azure-ai (opentelemetry-instrumentation-openai) doesn't crash.
    import sys as _s, types as _t, logging as _lg
    _llm_map = {
        'LLM_REQUEST_MODEL': 'llm.request.model',
        'LLM_RESPONSE_MODEL': 'llm.response.model',
        'LLM_VENDOR': 'llm.vendor',
        'LLM_REQUEST_TYPE': 'llm.request.type',
        'LLM_REQUEST_MAX_TOKENS': 'llm.request.max_tokens',
        'LLM_TEMPERATURE': 'llm.temperature',
        'LLM_TOP_P': 'llm.top_p',
        'LLM_USAGE_PROMPT_TOKENS': 'llm.usage.prompt_tokens',
        'LLM_USAGE_COMPLETION_TOKENS': 'llm.usage.completion_tokens',
        'LLM_USAGE_TOTAL_TOKENS': 'llm.usage.total_tokens',
        'LLM_STREAM': 'llm.is_streaming',
    }
    def _apply_llm_attrs(cls):
        for k, v in _llm_map.items():
            if not hasattr(cls, k):
                try:
                    setattr(cls, k, v)
                except Exception:
                    pass
    for _mod_path in ('opentelemetry.semconv.ai', 'opentelemetry.semconv.trace'):
        try:
            import importlib as _il
            _m = _il.import_module(_mod_path)
            _sa = getattr(_m, 'SpanAttributes', None)
            if _sa:
                _apply_llm_attrs(_sa)
        except Exception:
            pass
    # If opentelemetry.semconv.ai doesn't exist at all, inject a synthetic module
    if 'opentelemetry.semconv.ai' not in _s.modules:
        try:
            _fake = _t.ModuleType('opentelemetry.semconv.ai')
            class _SA: pass
            for _k, _v in _llm_map.items():
                setattr(_SA, _k, _v)
            _fake.SpanAttributes = _SA
            _s.modules['opentelemetry.semconv.ai'] = _fake
            if 'opentelemetry.semconv' in _s.modules:
                setattr(_s.modules['opentelemetry.semconv'], 'ai', _fake)
        except Exception:
            pass
    # ── end OTEL shim ───────────────────────────────────────────────────────
    azure_endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT", "").strip()
    openai_key = os.environ.get("OPENAI_API_KEY", "").strip()

    if azure_endpoint:
        from agent_framework.azure import AzureOpenAIResponsesClient  # type: ignore

        deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o-mini")
        api_key = os.environ.get("AZURE_OPENAI_API_KEY", "").strip()

        if api_key:
            client = AzureOpenAIResponsesClient(
                endpoint=azure_endpoint,
                deployment_name=deployment,
                api_key=api_key,
                api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2025-01-01-preview"),
            )
        else:
            # Passwordless: Managed Identity / az login
            # Use get_bearer_token_provider so the Azure OpenAI SDK
            # can call the Cognitive Services token endpoint automatically.
            from azure.identity import DefaultAzureCredential, get_bearer_token_provider  # type: ignore

            _credential = DefaultAzureCredential()
            _token_provider = get_bearer_token_provider(
                _credential,
                "https://cognitiveservices.azure.com/.default",
            )
            client = AzureOpenAIResponsesClient(
                endpoint=azure_endpoint,
                deployment_name=deployment,
                azure_ad_token_provider=_token_provider,
                api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2025-01-01-preview"),
            )

    elif openai_key:
        from agent_framework.openai import OpenAIResponsesClient  # type: ignore

        client = OpenAIResponsesClient(
            api_key=openai_key,
            model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
        )

    else:
        raise RuntimeError(
            "LLM provider not configured. "
            "Set AZURE_OPENAI_ENDPOINT (and optionally AZURE_OPENAI_API_KEY) "
            "or OPENAI_API_KEY in local.settings.json."
        )

    return client.as_agent(
        name="FlowNoteAgent",
        instructions=instructions or BASE_SYSTEM_PROMPT,
        tools=tools or [],
    )


# ─────────────────────────────────────────────────────────────
# Tools (stateful plugin – holds flow state during a single run)
# ─────────────────────────────────────────────────────────────

class FlowEditorPlugin:
    """
    Agent Framework tools that let the agent manipulate the flow.
    The plugin holds mutable `nodes` and `edges` lists.
    """

    def __init__(self, nodes: list[dict], edges: list[dict]) -> None:
        self.nodes: list[dict] = nodes
        self.edges: list[dict] = edges
        self._edge_counter: int = len(edges)

    # ── helpers ──────────────────────────────────────────────

    def _node_index(self, node_id: str) -> int | None:
        for i, n in enumerate(self.nodes):
            if n["id"] == node_id:
                return i
        return None

    def _edge_key(self, source: str, target: str) -> str:
        return f"e-{source}-{target}"

    # ── tool methods ─────────────────────────────────────────

    def add_node(
        self,
        node_id: str,
        label: str,
        node_type: str = "default",
    ) -> str:
        """Add a new node to the flow diagram.

        Args:
            node_id: Unique identifier (lowercase, no spaces).
            label: Display label shown inside the node.
            node_type: One of 'default', 'input', 'output', 'selector'.
        """
        if self._node_index(node_id) is not None:
            return f"Node '{node_id}' already exists."
        self.nodes.append({"id": node_id, "label": label, "type": node_type})
        return f"Added {node_type} node '{node_id}' ({label})."

    def remove_node(self, node_id: str) -> str:
        """Remove a node and all edges connected to it.

        Args:
            node_id: ID of the node to remove.
        """
        idx = self._node_index(node_id)
        if idx is None:
            return f"Node '{node_id}' not found."
        self.nodes.pop(idx)
        before = len(self.edges)
        self.edges = [
            e for e in self.edges
            if e["source"] != node_id and e["target"] != node_id
        ]
        removed_edges = before - len(self.edges)
        return f"Removed node '{node_id}' and {removed_edges} connected edge(s)."

    def add_edge(self, source: str, target: str, label: str = "") -> str:
        """Add a directed edge between two nodes.

        Args:
            source: Source node ID.
            target: Target node ID.
            label: Optional label on the edge.
        """
        # Auto-create missing nodes as implicit defaults
        for nid in (source, target):
            if self._node_index(nid) is None:
                self.nodes.append({"id": nid, "label": nid, "type": "default"})
        self._edge_counter += 1
        edge: dict = {
            "id": self._edge_key(source, target),
            "source": source,
            "target": target,
        }
        if label:
            edge["label"] = label
        self.edges.append(edge)
        return f"Added edge {source} → {target}" + (f" : {label}" if label else "") + "."

    def remove_edge(self, source: str, target: str) -> str:
        """Remove an edge between two nodes.

        Args:
            source: Source node ID.
            target: Target node ID.
        """
        before = len(self.edges)
        self.edges = [
            e for e in self.edges
            if not (e["source"] == source and e["target"] == target)
        ]
        if len(self.edges) == before:
            return f"Edge {source} → {target} not found."
        return f"Removed edge {source} → {target}."

    def replace_flow(self, nodes_json: str, edges_json: str) -> str:
        """Completely replace the flow with a new set of nodes and edges.

        Args:
            nodes_json: JSON array of node objects with id, label, type.
            edges_json: JSON array of edge objects with source, target, and optional label.
        """
        self.nodes = json.loads(nodes_json)
        self.edges = json.loads(edges_json)
        return f"Replaced flow: {len(self.nodes)} nodes, {len(self.edges)} edges."


# ─────────────────────────────────────────────────────────────
# Flow serialisation helpers
# ─────────────────────────────────────────────────────────────

def _serialize_node(n: dict) -> str:
    nid, label, ntype = n["id"], n.get("label", n["id"]), n.get("type", "default")
    match ntype:
        case "input":    return f"[[{nid}]] {label}"
        case "output":   return f"(({nid})) {label}"
        case "selector": return f"{{{nid}}} {label}"
        case _:          return f"[{nid}] {label}"


def _serialize_edge(e: dict) -> str:
    base = f"[{e['source']}] -> [{e['target']}]"
    return f"{base} : {e['label']}" if e.get("label") else base


def _build_flow_block(nodes: list[dict], edges: list[dict]) -> str:
    node_lines = [_serialize_node(n) for n in nodes]
    edge_lines = [_serialize_edge(e) for e in edges]
    return "```flow\n" + "\n".join(node_lines) + ("\n\n" if edge_lines else "") + "\n".join(edge_lines) + "\n```"


# ─────────────────────────────────────────────────────────────
# Parse existing ```flow block from Markdown
# ─────────────────────────────────────────────────────────────

_FLOW_RE = re.compile(r"```flow\r?\n([\s\S]*?)```")
_NODE_PATTERNS = [
    (re.compile(r"^\[\[(.+?)\]\]\s+(.+)$"),  "input"),
    (re.compile(r"^\(\((.+?)\)\)\s+(.+)$"),  "output"),
    (re.compile(r"^\{(.+?)\}\s+(.+)$"),       "selector"),
    (re.compile(r"^\[(.+?)\]\s+(.+)$"),       "default"),
]
_EDGE_RE = re.compile(r"^\[(.+?)\]\s*->\s*\[(.+?)\](?:\s*:\s*(.+))?$")


def _parse_flow(markdown: str) -> tuple[list[dict], list[dict]]:
    nodes: list[dict] = []
    edges: list[dict] = []
    seen_nodes: set[str] = set()
    edge_n = 0

    for block_match in _FLOW_RE.finditer(markdown):
        for line in block_match.group(1).splitlines():
            line = line.strip()
            if not line:
                continue
            em = _EDGE_RE.match(line)
            if em:
                src, tgt, lbl = em.group(1), em.group(2), em.group(3)
                for nid in (src, tgt):
                    if nid not in seen_nodes:
                        nodes.append({"id": nid, "label": nid, "type": "default"})
                        seen_nodes.add(nid)
                edge: dict = {"id": f"e{edge_n}-{src}-{tgt}", "source": src, "target": tgt}
                if lbl:
                    edge["label"] = lbl.strip()
                edges.append(edge)
                edge_n += 1
                continue
            for pattern, ntype in _NODE_PATTERNS:
                nm = pattern.match(line)
                if nm:
                    nid, lbl = nm.group(1), nm.group(2)
                    if nid not in seen_nodes:
                        nodes.append({"id": nid, "label": lbl, "type": ntype})
                        seen_nodes.add(nid)
                    break

    return nodes, edges


# ─────────────────────────────────────────────────────────────
# Main entry point
# ─────────────────────────────────────────────────────────────

async def run_flow_agent(
    message: str,
    markdown: str,
    context: dict | None = None,
) -> dict:
    """
    Run the Agent Framework agent and return a Suggestion dict compatible
    with the FlowNote frontend's Suggestion TypeScript type.
    """
    run_start = time.perf_counter()

    # Parse current flow state so tools can operate on it
    orig_nodes, orig_edges = _parse_flow(markdown)
    plugin = FlowEditorPlugin(
        nodes=[dict(n) for n in orig_nodes],
        edges=[dict(e) for e in orig_edges],
    )

    # ── Trace collector ───────────────────────────────────────
    trace_log: list[dict] = []

    def _trace(tool_name: str, args: dict, result: str, duration_ms: int) -> None:
        trace_log.append({
            "seq": len(trace_log) + 1,
            "type": "tool_call",
            "tool": tool_name,
            "args": args,
            "result": result,
            "durationMs": duration_ms,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    # ── Expose FlowEditorPlugin methods as closure tools ──────
    # Agent Framework passes tools as a list of callables with Annotated params.
    # We wrap the plugin's instance methods so the agent can call them.

    def add_node(
        node_id: Annotated[str, "Unique identifier (lowercase, no spaces)."],
        label: Annotated[str, "Display label shown inside the node."],
        node_type: Annotated[
            str, "One of 'default', 'input', 'output', 'selector'."
        ] = "default",
    ) -> str:
        """Add a new node to the flow diagram."""
        t0 = time.perf_counter()
        result = plugin.add_node(node_id, label, node_type)
        _trace("add_node", {"node_id": node_id, "label": label, "node_type": node_type}, result, int((time.perf_counter() - t0) * 1000))
        return result

    def remove_node(
        node_id: Annotated[str, "ID of the node to remove."],
    ) -> str:
        """Remove a node and all edges connected to it."""
        t0 = time.perf_counter()
        result = plugin.remove_node(node_id)
        _trace("remove_node", {"node_id": node_id}, result, int((time.perf_counter() - t0) * 1000))
        return result

    def add_edge(
        source: Annotated[str, "Source node ID."],
        target: Annotated[str, "Target node ID."],
        label: Annotated[str, "Optional label on the edge."] = "",
    ) -> str:
        """Add a directed edge between two nodes."""
        t0 = time.perf_counter()
        result = plugin.add_edge(source, target, label)
        _trace("add_edge", {"source": source, "target": target, "label": label}, result, int((time.perf_counter() - t0) * 1000))
        return result

    def remove_edge(
        source: Annotated[str, "Source node ID."],
        target: Annotated[str, "Target node ID."],
    ) -> str:
        """Remove an edge between two nodes."""
        t0 = time.perf_counter()
        result = plugin.remove_edge(source, target)
        _trace("remove_edge", {"source": source, "target": target}, result, int((time.perf_counter() - t0) * 1000))
        return result

    def replace_flow(
        nodes_json: Annotated[
            str, "JSON array of node objects with id, label, type."
        ],
        edges_json: Annotated[
            str,
            "JSON array of edge objects with source, target, and optional label.",
        ],
    ) -> str:
        """Completely replace the flow with a new set of nodes and edges."""
        t0 = time.perf_counter()
        result = plugin.replace_flow(nodes_json, edges_json)
        try:
            n_nodes = len(json.loads(nodes_json))
            n_edges = len(json.loads(edges_json))
        except Exception:
            n_nodes = n_edges = "?"
        _trace("replace_flow", {"nodes_count": n_nodes, "edges_count": n_edges}, result, int((time.perf_counter() - t0) * 1000))
        return result

    # ── Build agent instructions ──────────────────────────────
    # If the frontend supplies a template-specific systemPrompt, inject it
    # AFTER the base syntax rules so it adds role & domain context.
    template_id = (context or {}).get("templateId")
    template_system_prompt = (context or {}).get("systemPrompt", "").strip()
    if template_system_prompt:
        combined_instructions = (
            BASE_SYSTEM_PROMPT
            + "\n\n"
            + "## Template-Specific Role\n"
            + f"(Template: {template_id or 'custom'})\n"
            + template_system_prompt
        )
    else:
        combined_instructions = BASE_SYSTEM_PROMPT

    agent = _create_agent(
        tools=[add_node, remove_node, add_edge, remove_edge, replace_flow],
        instructions=combined_instructions,
    )

    user_prompt = (
        f"<current_flow_markdown>\n{markdown}\n</current_flow_markdown>\n\n"
        f"<user_request>\n{message}\n</user_request>\n\n"
        "Apply the requested changes using the flow_editor tools, "
        "then return the result as JSON."
    )

    logger.info("Running FlowNote agent | message=%r | nodes=%d edges=%d | template=%s",
                message, len(orig_nodes), len(orig_edges), template_id or "none")

    result = await agent.run(user_prompt)
    raw: str = result.text if hasattr(result, "text") and result.text else str(result)

    logger.debug("Agent raw response: %s", raw[:500])

    # ── Extract JSON from response ────────────────────────────
    # Strip markdown code fences that some models add around JSON
    cleaned = re.sub(r"```(?:json)?\s*", "", raw)
    cleaned = re.sub(r"```\s*$", "", cleaned, flags=re.MULTILINE)
    json_match = re.search(r"\{[\s\S]*\}", cleaned)

    if json_match:
        data = json.loads(json_match.group())
        updated_markdown = data.get("markdown", markdown)
        summary = data.get("summary", "フローを更新しました。")
        nodes_delta = int(data.get("nodesDelta", 0))
        edges_delta = int(data.get("edgesDelta", 0))
        changed_node_ids = data.get("changedNodeIds", [])
        changed_edge_ids = data.get("changedEdgeIds", [])

    else:
        # Fallback: the agent manipulated the flow via tools, rebuild markdown
        logger.warning("Could not parse JSON from agent response; rebuilding from tool state.")
        flow_block = _build_flow_block(plugin.nodes, plugin.edges)

        # Replace the ```flow block in the original markdown
        updated_markdown = _FLOW_RE.sub(flow_block, markdown)
        if updated_markdown == markdown and plugin.nodes != orig_nodes:
            updated_markdown = markdown.rstrip() + "\n\n" + flow_block + "\n"

        nodes_delta = len(plugin.nodes) - len(orig_nodes)
        edges_delta = len(plugin.edges) - len(orig_edges)

        orig_ids = {n["id"] for n in orig_nodes}
        changed_node_ids = [n["id"] for n in plugin.nodes if n["id"] not in orig_ids]
        changed_edge_ids = []
        summary = "フローを更新しました。"

    return {
        "suggestionId": str(uuid.uuid4()),
        "markdown": updated_markdown,
        "summary": summary,
        "impacts": {
            "nodesDelta": nodes_delta,
            "edgesDelta": edges_delta,
            "changedNodeIds": changed_node_ids,
            "changedEdgeIds": changed_edge_ids,
        },
        "agentTrace": trace_log,
        "executionMs": int((time.perf_counter() - run_start) * 1000),
    }
