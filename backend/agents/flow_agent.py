"""
FlowNote AI – OpenAI-powered Python backend.

Uses the openai Chat Completions API to interpret user requests and produce
structured Suggestion objects for the FlowNote frontend.

Required env vars (set ONE of the two providers):

  Azure OpenAI (recommended):
    AZURE_OPENAI_ENDPOINT         e.g. https://my-resource.openai.azure.com
    AZURE_OPENAI_DEPLOYMENT_NAME  default: gpt-4o-mini
    AZURE_OPENAI_API_KEY          optional; omit to use DefaultAzureCredential
    AZURE_OPENAI_API_VERSION      default: 2025-04-01-preview

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
from typing import Any

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
# OpenAI client factory
# ─────────────────────────────────────────────────────────────

def _get_client() -> tuple[Any, str]:
    """Build and return an async OpenAI client and model/deployment name."""
    azure_endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT", "").strip().rstrip("/")
    openai_key = os.environ.get("OPENAI_API_KEY", "").strip()

    if azure_endpoint:
        from openai import AsyncAzureOpenAI  # type: ignore

        deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o-mini").strip()
        api_key = os.environ.get("AZURE_OPENAI_API_KEY", "").strip()
        api_version = os.environ.get("AZURE_OPENAI_API_VERSION", "2025-04-01-preview").strip()

        logger.info(
            "Azure OpenAI config: endpoint=%s deployment=%s api_version=%s auth=%s",
            azure_endpoint, deployment, api_version,
            "api_key" if api_key else "managed_identity",
        )

        if api_key:
            client = AsyncAzureOpenAI(
                azure_endpoint=azure_endpoint,
                api_key=api_key,
                api_version=api_version,
            )
        else:
            # Passwordless: Managed Identity / az login
            from azure.identity import DefaultAzureCredential, get_bearer_token_provider  # type: ignore

            token_provider = get_bearer_token_provider(
                DefaultAzureCredential(),
                "https://cognitiveservices.azure.com/.default",
            )
            client = AsyncAzureOpenAI(
                azure_endpoint=azure_endpoint,
                azure_ad_token_provider=token_provider,
                api_version=api_version,
            )
        return client, deployment

    elif openai_key:
        from openai import AsyncOpenAI  # type: ignore

        model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
        client = AsyncOpenAI(api_key=openai_key)
        return client, model

    else:
        raise RuntimeError(
            "LLM provider not configured. "
            "Set AZURE_OPENAI_ENDPOINT (and optionally AZURE_OPENAI_API_KEY) "
            "or OPENAI_API_KEY in local.settings.json."
        )


# ─────────────────────────────────────────────────────────────
# OpenAI function-calling tool schemas
# ─────────────────────────────────────────────────────────────

_TOOLS_SCHEMA: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "add_node",
            "description": "Add a new node to the flow diagram.",
            "parameters": {
                "type": "object",
                "properties": {
                    "node_id": {"type": "string", "description": "Unique identifier (lowercase, no spaces)."},
                    "label":   {"type": "string", "description": "Display label shown inside the node."},
                    "node_type": {
                        "type": "string",
                        "enum": ["default", "input", "output", "selector"],
                        "description": "One of 'default', 'input', 'output', 'selector'.",
                    },
                },
                "required": ["node_id", "label"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "remove_node",
            "description": "Remove a node and all edges connected to it.",
            "parameters": {
                "type": "object",
                "properties": {
                    "node_id": {"type": "string", "description": "ID of the node to remove."},
                },
                "required": ["node_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_edge",
            "description": "Add a directed edge between two nodes.",
            "parameters": {
                "type": "object",
                "properties": {
                    "source": {"type": "string", "description": "Source node ID."},
                    "target": {"type": "string", "description": "Target node ID."},
                    "label":  {"type": "string", "description": "Optional label on the edge."},
                },
                "required": ["source", "target"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "remove_edge",
            "description": "Remove an edge between two nodes.",
            "parameters": {
                "type": "object",
                "properties": {
                    "source": {"type": "string", "description": "Source node ID."},
                    "target": {"type": "string", "description": "Target node ID."},
                },
                "required": ["source", "target"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "replace_flow",
            "description": "Completely replace the flow with a new set of nodes and edges.",
            "parameters": {
                "type": "object",
                "properties": {
                    "nodes_json": {"type": "string", "description": "JSON array of node objects with id, label, type."},
                    "edges_json": {"type": "string", "description": "JSON array of edge objects with source, target, and optional label."},
                },
                "required": ["nodes_json", "edges_json"],
            },
        },
    },
]


def _call_tool(plugin: "FlowEditorPlugin", name: str, args: dict, trace_log: list) -> str:
    """Dispatch a tool call to the FlowEditorPlugin and record it in trace_log."""
    t0 = time.perf_counter()
    if name == "add_node":
        result = plugin.add_node(args.get("node_id", ""), args.get("label", ""), args.get("node_type", "default"))
    elif name == "remove_node":
        result = plugin.remove_node(args.get("node_id", ""))
    elif name == "add_edge":
        result = plugin.add_edge(args.get("source", ""), args.get("target", ""), args.get("label", ""))
    elif name == "remove_edge":
        result = plugin.remove_edge(args.get("source", ""), args.get("target", ""))
    elif name == "replace_flow":
        result = plugin.replace_flow(args.get("nodes_json", "[]"), args.get("edges_json", "[]"))
    else:
        result = f"Unknown tool: {name}"
    trace_log.append({
        "seq": len(trace_log) + 1,
        "type": "tool_call",
        "tool": name,
        "args": args,
        "result": result,
        "durationMs": int((time.perf_counter() - t0) * 1000),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    return result


# ─────────────────────────────────────────────────────────────
# Tools (stateful plugin – holds flow state during a single run)
# ─────────────────────────────────────────────────────────────

class FlowEditorPlugin:
    """
    Tools that let the agent manipulate the flow.
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
    Run the OpenAI-powered agent and return a Suggestion dict compatible
    with the FlowNote frontend's Suggestion TypeScript type.
    """
    run_start = time.perf_counter()

    # Parse current flow state so tools can operate on it
    orig_nodes, orig_edges = _parse_flow(markdown)
    plugin = FlowEditorPlugin(
        nodes=[dict(n) for n in orig_nodes],
        edges=[dict(e) for e in orig_edges],
    )

    trace_log: list[dict] = []

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

    user_prompt = (
        f"<current_flow_markdown>\n{markdown}\n</current_flow_markdown>\n\n"
        f"<user_request>\n{message}\n</user_request>\n\n"
        "Apply the requested changes using the flow_editor tools, "
        "then return the result as JSON."
    )

    logger.info("Running FlowNote agent | message=%r | nodes=%d edges=%d | template=%s",
                message, len(orig_nodes), len(orig_edges), template_id or "none")

    client, model = _get_client()

    messages: list = [
        {"role": "system", "content": combined_instructions},
        {"role": "user", "content": user_prompt},
    ]

    raw = ""
    MAX_ITERATIONS = 10

    for _ in range(MAX_ITERATIONS):
        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            tools=_TOOLS_SCHEMA,
            tool_choice="auto",
        )

        choice = response.choices[0]
        msg = choice.message

        if not msg.tool_calls:
            raw = msg.content or ""
            break

        # Append assistant turn (with tool calls) to conversation
        messages.append({
            "role": "assistant",
            "content": msg.content,
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in msg.tool_calls
            ],
        })

        # Execute each tool and append results
        for tc in msg.tool_calls:
            args = json.loads(tc.function.arguments)
            result = _call_tool(plugin, tc.function.name, args, trace_log)
            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": result,
            })

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
