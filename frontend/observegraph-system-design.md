# ObserveGraph: Personal AI Agent Observability & Auditing Framework

**System Design Document**  
**Author:** Meet Kachhadiya  
**Location:** Heilbronn, Baden-Württemberg, Germany  
**Date:** March 21, 2026  
**Version:** 1.0

---

## Executive Summary

**ObserveGraph** is a personal observability and auditing framework for autonomous AI agents (specifically OpenClaw/Zeroclaw instances). It captures every step an AI agent takes, stores it in a graph database (Neo4j), and provides multi-instance tracking, DAG-based task pattern analysis, and rich visual dashboards for understanding agent behavior across multiple servers.

### Key Features

- **Multi-instance management** — Track 5+ zeroclaw servers simultaneously with per-instance metrics and heartbeats
- **Complete audit trail** — Every tool call, shell command, file operation, and LLM reasoning captured with tokens, costs, duration, and risk scoring
- **DAG-based task templates** — Group identical task runs across multiple sessions and visualize different execution paths the agent chose
- **Cost & token tracking** — Understand where your API spend goes: which tasks, which steps, which tools
- **Risk scoring & flagging** — Automatically flag dangerous actions (sudo, rm, sys calls) and allow manual review
- **Performance metrics** — Compare run success rates, latency, token efficiency across different strategies
- **Personal-scale (single user)** — No complex auth, no multi-tenancy, no SDK needed—just fork zeroclaw and instrument at source

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Data Schema](#data-schema)
3. [Multi-Instance Management](#multi-instance-management)
4. [DAG-Based Task Analysis](#dag-based-task-analysis)
5. [Backend Implementation](#backend-implementation)
6. [Frontend Visualization](#frontend-visualization)
7. [Setup & Deployment](#setup--deployment)

---

## System Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────┐
│                    5x Zeroclaw Instances                         │
│  (dev machine, VPS 1, VPS 2, test machine, staging environment) │
└──────────────┬──────────────────────────────────────────────────┘
               │ HTTP fire-and-forget (async, non-blocking)
               ▼
┌─────────────────────────────────────────────────────────────────┐
│               FastAPI Backend (Python)                           │
│  • Receives ActionEvent, SessionEvent, InstanceEvent             │
│  • Validates with Pydantic                                       │
│  • Writes to Neo4j (MERGE/CREATE patterns)                       │
│  • Computes risk scores, fingerprints, deduplication            │
│  • Handles DAG merging for task templates                        │
└──────────────┬──────────────────────────────────────────────────┘
               │ Cypher queries (low latency, graph traversal)
               ▼
┌─────────────────────────────────────────────────────────────────┐
│               Neo4j Graph Database                               │
│  • 7 node types: User, Instance, Session, Task, Action,          │
│    TaskTemplate, StepNode                                        │
│  • 5 edge types: OWNS, HAS_SESSION, HAS_TASK, PERFORMED,        │
│    STEP_SEQUENCE, INSTANCE_OF, RUN_OF                           │
│  • Full audit immutability + DAG deduplication                  │
└──────────────┬──────────────────────────────────────────────────┘
               │ Cytoscape.js, React queries
               ▼
┌─────────────────────────────────────────────────────────────────┐
│               React Dashboard (TypeScript)                       │
│  • Instance status board (5 servers, uptime, last activity)     │
│  • Task execution DAG viewer (paths, weights, metrics)          │
│  • Audit trail (all actions, filterable by risk/type)           │
│  • Mark/flag/rate interface (interactive annotations)           │
│  • Cost analytics, token burn rate per task/tool                │
└─────────────────────────────────────────────────────────────────┘
```

### Instrumentation Strategy

**No SDK required.** Instead, fork zeroclaw directly and add instrumentation at the source:

1. Create a new `crates/observer/` crate in Rust
2. Add fire-and-forget HTTP emit calls in every tool execution path (`bash`, `file_write`, `llm_call`, etc.)
3. Each emit happens in a spawned tokio task — zero blocking impact on agent performance
4. On startup, zeroclaw calls `POST /instances` to register itself
5. Every 30 seconds, zeroclaw sends a heartbeat: `PATCH /instances/{id}/heartbeat`

This approach:

- ✅ **Modular** — touches zero business logic, just reads context and ships events
- ✅ **Non-blocking** — fire-and-forget async, <1ms latency impact on agent
- ✅ **Resilient** — if backend is down, zeroclaw continues running normally
- ✅ **Complete** — sees every step before any retry/recovery logic runs

---

## Data Schema

### 7 Node Types

#### 1. **User** — Root anchor (you)

```cypher
(:User {
  user_id:      "meet",
  name:         "Meet Kachhadiya",
  location:     "Heilbronn, DE",
  created_at:   datetime("2026-03-21T14:00:00Z"),
  timezone:     "Europe/Berlin"
})
```

**Purpose:** Single point of ownership for all data. Enables future multi-user extension without schema changes.

---

#### 2. **Instance** — One zeroclaw server

```cypher
(:Instance {
  instance_id:        "inst_heilbronn_dev",
  name:               "heilbronn-dev",
  host:               "192.168.1.10",
  port:               3000,
  environment:        "development",    // development | production | staging
  os:                 "ubuntu-24.04",
  arch:               "x86_64",
  zeroclaw_version:   "0.4.2",
  model_default:      "claude-3-7-sonnet",
  registered_at:      datetime("2026-03-21T08:00:00Z"),
  last_seen_at:       datetime("2026-03-21T14:32:00Z"),
  status:             "online",         // online | offline | idle
  is_pinned:          true,
  tags:               ["main", "rust", "work"]
})
```

**Lifecycle:**

- `POST /instances` on zeroclaw boot → creates/updates Instance node
- `PATCH /instances/{id}/heartbeat` every 30s → updates `last_seen_at`
- Dashboard marks offline if `last_seen_at > 90s ago`

**Query Example:**

```cypher
MATCH (u:User)-[:OWNS]->(i:Instance)
RETURN i.name, i.status, i.last_seen_at, i.zeroclaw_version
ORDER BY i.is_pinned DESC, i.last_seen_at DESC
```

---

#### 3. **Session** — One zeroclaw invocation

```cypher
(:Session {
  session_id:     "sess_20260321_001",
  instance_id:    "inst_heilbronn_dev",     // denormalized for fast lookup
  trigger:        "cli",                    // cli | api | scheduled | webhook
  working_dir:    "/home/meet/projects/observegraph",
  git_repo:       "github.com/meet/observegraph",
  git_branch:     "feat/neo4j-schema",
  git_commit:     "a3f9c12",
  model_override: null,                     // null = use instance default
  started_at:     datetime("2026-03-21T13:00:00Z"),
  ended_at:       datetime("2026-03-21T13:47:22Z"),
  duration_ms:    2842000,
  status:         "completed",              // running | completed | failed | killed
  total_tokens:   18420,
  total_cost_usd: 0.3847,
  task_count:     3,
  action_count:   41,
  exit_code:      0,
  notes:          "Built Neo4j schema layer"
})
```

**Properties:**

- **Denormalized `instance_id`** — Fast filtering without join (e.g., "show me all sessions from prod-1")
- **Git context** — Reproducibility: which code version was this agent running against?
- **Cost tracking** — Sum of all PERFORMED edge `cost_usd` for this session
- **Exit code** — Did zeroclaw itself exit cleanly? (separate from task success/failure)

---

#### 4. **Task** — One goal the agent is pursuing (repeatable)

```cypher
(:Task {
  task_id:          "task_obs_001",
  session_id:       "sess_20260321_001",    // denormalized
  instance_id:      "inst_heilbronn_dev",   // denormalized
  title:            "Create observer crate in zeroclaw",
  description:      "Add crates/observer/ with fire-and-forget HTTP emitter",
  type:             "code",                 // code | research | file_ops | shell | browser | data
  technologies:     ["rust", "tokio", "reqwest", "neo4j"],
  status:           "completed",            // in_progress | completed | failed
  priority:         "high",                 // low | medium | high
  started_at:       datetime("2026-03-21T13:00:00Z"),
  completed_at:     datetime("2026-03-21T13:28:10Z"),
  duration_ms:      1690000,
  total_tokens:     7840,
  thinking_tokens:  1420,
  output_tokens:    6420,
  total_cost_usd:   0.1643,
  action_count:     18,
  is_bookmarked:    true,
  rating:           5,                      // 1-5 stars, set by you post-run
  tags:             ["observer", "instrumentation"],
  error:            null
})
```

**Key insight:** Tasks are the **repeatable semantic units**. If the agent runs "Create observer crate" in session 2, it's a different Task node (new session, potentially different actions), but it's the **same task concept**. The DAG layer (TaskTemplate + StepNode) deduplicates this.

---

#### 5. **Action** — One discrete step (file read, shell cmd, LLM call, etc.)

```cypher
(:Action {
  action_id:        "act_001",
  task_id:          "task_obs_001",         // denormalized
  instance_id:      "inst_heilbronn_dev",   // denormalized
  type:             "file_read",            // file_read | file_write | shell | llm_call | http | tool_use
  tool_name:        "read_file",
  command:          null,
  file_path:        "/home/meet/projects/observegraph/Cargo.toml",
  file_size_bytes:  4821,
  stdout:           "[package]\nname = \"zeroclaw\"\n...",
  stderr:           null,
  exit_code:        0,
  permission_level: "read",                 // read | write | admin | dangerous
  risk_score:       0.05,                   // 0.0–1.0, computed from permission + pattern
  is_flagged:       false,                  // you can flag suspicious actions in UI
  status:           "success",              // success | failed | skipped
  started_at:       datetime("2026-03-21T13:00:05Z"),
  ended_at:         datetime("2026-03-21T13:00:05Z"),
  duration_ms:      12
})
```

**Risk Scoring Logic:**

```
risk_score = 0.0
if permission_level == "dangerous":
    risk_score += 0.7
if tool_name in ["rm", "sudo", "dd", "mkfs"]:
    risk_score += 0.2
if exit_code != 0:
    risk_score += 0.1
Clamp to [0.0, 1.0]
```

---

#### 6. **TaskTemplate** — DAG concept of a repeatable task

```cypher
(:TaskTemplate {
  template_id:   "tmpl_create_observer_crate",
  title:         "Create observer crate in zeroclaw",
  fingerprint:   "create_observer_crate",     // slugified title
  type:          "code",
  technologies:  ["rust", "tokio", "neo4j"],
  created_at:    datetime("2026-03-21T13:00:00Z"),
  run_count:     4,                           // updated on each new run
  success_rate:  0.75,
  avg_tokens:    7420,                        // rolling mean
  avg_duration_ms: 1690000,
  best_run_id:   "task_obs_001_run2",         // lowest cost + success
  tags:          ["observer", "instrumentation"]
})
```

**Purpose:** Aggregates metrics across all runs of "the same task" to detect patterns, performance trends, and optimal execution paths.

---

#### 7. **StepNode** — DAG node for a deduplicated step

```cypher
(:StepNode {
  step_id:         "step_read_project_manifest",
  fingerprint:     "read_file:read_project_manifest",  // tool:step_name (slugified)
  tool_name:       "read_file",
  step_name:       "read project manifest",
  type:            "file_read",
  run_count:       4,                       // how many runs passed through this step
  success_rate:    1.0,
  avg_tokens:      225,
  avg_latency_ms:  12,
  avg_cost_usd:    0.0047,
  is_entry:        true,                   // first step in the DAG?
  is_exit:         false
})
```

**Lifecycle:**

- Created on first run when zeroclaw takes a step (tool_name + step_name fingerprint)
- Updated on each subsequent run that takes the same step
- Metrics (`run_count`, `avg_tokens`, etc.) are rolling aggregates
- StepNodes form the DAG structure via STEP_SEQUENCE edges

---

### 5 Relationship Types

#### 1. **OWNS** — User → Instance

```cypher
(u:User)-[:OWNS {since: datetime()}]->(i:Instance)
```

Establishes ownership for access control and filtering.

---

#### 2. **HAS_SESSION** — Instance → Session

```cypher
(i:Instance)-[:HAS_SESSION {
  pid: 18432,                          // OS process ID
  started_at: datetime()
}]->(s:Session)
```

Links a session to the instance that ran it. Enable queries like: "Show all sessions from prod-1 in the last 24 hours."

---

#### 3. **HAS_TASK** — Session → Task

```cypher
(s:Session)-[:HAS_TASK {
  index: 1,                            // task order within session
  created_at: datetime()
}]->(t:Task)
```

Orders tasks within a session.

---

#### 4. **PERFORMED** — Task → Action (THE RICHEST EDGE)

This edge holds the **context** of why and how an action was executed:

```cypher
(t:Task)-[:PERFORMED {
  sequence:        3,                  // step order within task
  step_name:       "install dependencies",
  reasoning:       "Need to resolve missing packages before compiling",
  thinking_tokens: 240,
  output_tokens:   85,
  total_tokens:    325,
  model_used:      "claude-3-7-sonnet",
  tool_used:       "bash",
  timestamp:       datetime("2026-03-21T13:00:22Z"),
  latency_ms:      312,
  cost_usd:        0.0068,
  retry_count:     0,
  is_recovery:     false
}]->(a:Action)
```

**Key properties:**

- **Sequence** — Reconstruct execution order within a task
- **Reasoning** — AI's explanation for why it chose this step
- **Tokens breakdown** — See thinking vs output token spend per step
- **Retry/recovery flags** — Detect which steps were error recovery vs normal flow

---

#### 5. **NEXT** — Action → Action (execution chain within a task)

```cypher
(a1:Action)-[:NEXT {
  elapsed_ms:      450,
  transition_type: "sequential",        // sequential | retry | fallback | branch
  condition:       "exit_code == 0"
}]->(a2:Action)
```

Enables path reconstruction: "What was the exact order of actions in task X?"

---

#### 6. **RUN_OF** — Task → TaskTemplate (NEW for DAG)

```cypher
(t:Task {task_id: "task_obs_001"})-[:RUN_OF {
  run_number: 1,                        // sequential run count for this template
  run_id:     "run_001",
  started_at: datetime()
}]->(tmpl:TaskTemplate)
```

Links a concrete task run to its abstract template concept.

---

#### 7. **STEP_SEQUENCE** — StepNode → StepNode (THE DAG EDGES)

```cypher
(s1:StepNode)-[:STEP_SEQUENCE {
  template_id:    "tmpl_create_observer_crate",
  run_count:      4,                   // 4 runs took this edge
  run_ids:        ["run_001", "run_002", "run_003", "run_004"],
  avg_tokens:     2065,
  avg_latency_ms: 23012,
  success_rate:   1.0
}]->(s2:StepNode)
```

The **actual DAG structure**. Multiple runs' execution paths are merged into a single DAG with weighted edges.

---

#### 8. **INSTANCE_OF** — Action → StepNode

```cypher
(a:Action)-[:INSTANCE_OF {
  run_id:  "run_001",
  task_id: "task_obs_001"
}]->(sn:StepNode)
```

Links a concrete action to its abstract DAG node. Enables drill-down from DAG visualization to actual execution details.

---

## Multi-Instance Management

### Problem

You're spinning up 5 zeroclaw servers (dev machine, 2 VPS, test machine, staging). You need to:

- Know which instance is online/offline
- See metrics per instance (tokens, tasks, costs)
- Cross-instance cost analysis
- Instance-specific audit trails

### Solution

**Instance node** is the root organizational unit. Every Session, Task, Action is denormalized with `instance_id` for O(1) filtering.

### Registration Flow

```
Zeroclaw boots on VPS
    ↓
Calls `POST /instances` with hostname, port, zeroclaw_version, etc.
    ↓
FastAPI creates/updates (:Instance) node
    ↓
Zeroclaw receives instance_id in response
    ↓
Stores instance_id in context (Config struct)
    ↓
Every ActionEvent includes instance_id
    ↓
Every Session/Task node gets denormalized instance_id
```

### Heartbeat & Status

```
Every 30 seconds:
  Zeroclaw calls `PATCH /instances/{instance_id}/heartbeat`
    ↓
  FastAPI updates last_seen_at = now()
    ↓
  Dashboard sees instance.last_seen_at
    ↓
  If last_seen_at > 90s ago → mark offline
```

### Query Examples

```cypher
// List all instances with status
MATCH (u:User)-[:OWNS]->(i:Instance)
RETURN i.name, i.status, i.last_seen_at, i.environment
ORDER BY i.last_seen_at DESC

// Total costs per instance this week
MATCH (u:User)-[:OWNS]->(i:Instance)
      -[:HAS_SESSION]->(s:Session)
      -[:HAS_TASK]->(t:Task)
      -[r:PERFORMED]->(a:Action)
WHERE r.timestamp > datetime() - duration('P7D')
RETURN i.name, sum(r.cost_usd) AS weekly_spend
ORDER BY weekly_spend DESC

// Which instance has the most dangerous actions?
MATCH (i:Instance)-[:HAS_SESSION]->()-[:HAS_TASK]->()
      -[:PERFORMED]->(a:Action {permission_level: "dangerous"})
RETURN i.name, count(a) AS dangerous_count
ORDER BY dangerous_count DESC
```

---

## DAG-Based Task Analysis

### The Core Idea

**Problem:** If the agent runs "Create observer crate" 4 times, it might take a different path each time:

```
Run 1:  [read_manifest] → [plan] → [write_lib] → [build]
Run 2:  [read_manifest] → [check_deps] → [plan] → [write_lib] → [build]
Run 3:  [read_manifest] → [plan] → [write_lib] → [build]  (same as run 1)
Run 4:  [read_manifest] → [plan] → [write_lib] → [fix_types] → [build]  (new path)
```

You want to:

1. **Group these runs** under one concept ("Create observer crate")
2. **Visualize the merged DAG** showing all possible paths
3. **Compare metrics** across paths (tokens, duration, success rate)
4. **Drill down** from any node in the DAG to see which runs took it

### Solution: TaskTemplate + StepNode + STEP_SEQUENCE

**TaskTemplate** is the semantic grouping (matched by `fingerprint` = slugified title).

**StepNode** is a deduplicated action concept (matched by `fingerprint` = tool_name + step_name).

**STEP_SEQUENCE edges** are weighted by `run_count` — thick edges = commonly taken paths.

### Merged DAG Visualization

```
                                ┌──────────────────────┐
                                │   read_manifest      │
                                │ [4 runs, 100% succ]  │
                                └──────────┬───────────┘
                                           │
                        ┌──────────────────┼──────────────────┐
                        │ [4 runs]         │ [1 run]          │
                        ▼                  ▼                  │
                    [plan]             [check_deps]         │
                 [4 runs, 100%]        [1 run, 100%]        │
                        │ [3 runs]         │ [1 run]          │
                        │◄────────────────┘ [merge back]     │
                        ▼                                      │
                    [write_lib]                               │
                 [4 runs, 100%]                               │
                   avg=310 tokens                             │
                        │                                      │
                  ┌─────┴─────┐                               │
        [3 runs]  │   [1 run]  │                               │
                  ▼            ▼                               │
              [build]     [fix_types]                         │
           [3 runs]       [1 run, 100%]                       │
                              │                               │
                              └──────────────┬────────────────┘
                                             │ [1 run]
                                             ▼
                                         [build]
                                       [final node]
```

**Edge thickness** = `run_count` on the edge. Thin lines = rare paths, thick lines = common paths.

**Node color** = success rate. Red = failures, green = 100% success.

**Node size** = `avg_tokens`. Larger = more expensive.

### Interaction Model

**Hover on edge:**

```
read_manifest → plan
━━━━━━━━━━━━━━━━━━━━━━━━
Runs: 4 / 4 (100%)
Avg Tokens: 2065
Avg Latency: 23.0s
Cost per crossing: $0.0043
Runs: [run_001, run_002, run_003, run_004]
```

**Click on node:**

```
Step: write_lib
━━━━━━━━━━━━━━━━━━━━━━━━
Tool: file_write
Status: 4/4 successful (100%)
Avg Tokens: 310
Avg Latency: 890ms
Avg Cost: $0.0065
Entry Points: [plan (3x), check_deps (1x)]
Exit Points: [build (4x), fix_types (1x)]
┌─────────────────────────┐
│ Show all runs of this   │
│ step side-by-side       │
└─────────────────────────┘
```

**Click on specific run path:**

```
Comparing Run 2 vs Run 4
━━━━━━━━━━━━━━━━━━━━━━━━

Step                  Run 2               Run 4           Delta
read_manifest         225 tokens          225 tokens      —
check_deps (new)      310 tokens          —               +310
plan                  1840 tokens         1840 tokens     —
write_lib             310 tokens          310 tokens      —
—                     —                   fix_types       +580
                                          (recovery)
build                 620 tokens          620 tokens      —
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total                 3,705 tokens        3,985 tokens    +7.6%
Status                ✓ success           ✓ success       —
Duration              47.2s               58.8s           +24%
Cost                  $0.0776             $0.0833         +7.3%
```

---

## Backend Implementation

### Tech Stack

```
FastAPI (Python)      ← REST + WebSocket API
Neo4j 5.x             ← Graph database (property graph)
Redis                 ← Event queue for burst tolerance (optional)
Pydantic v2           ← Request/response validation
Docker Compose        ← Local deployment
```

### Core Endpoints

#### Instance Management

```
POST /instances
├─ Request: InstancePayload {
│   instance_id, name, host, port, environment, os, arch, zeroclaw_version
│ }
├─ Response: { instance_id, status: "registered" }
└─ Effect: MERGE (:Instance), CREATE [:OWNS], return instance_id for zeroclaw

PATCH /instances/{instance_id}/heartbeat
├─ Request: (empty body, just timestamp)
├─ Response: { status: "ok", last_seen_at: datetime }
└─ Effect: SET last_seen_at = now(), status = "online"

GET /instances
├─ Response: Array of instances with current metrics
└─ Query:
   MATCH (u:User)-[:OWNS]->(i:Instance)
   OPTIONAL MATCH (i)-[:HAS_SESSION]->(s:Session)
   RETURN i, count(s) AS session_count, max(i.last_seen_at)
```

#### Session & Task Management

```
POST /sessions
├─ Request: SessionPayload {
│   instance_id, session_id, trigger, working_dir, git_repo, git_branch,
│   model_override, started_at, status, notes
│ }
├─ Effect: CREATE (:Session), CREATE [:HAS_SESSION]
└─ Response: { session_id, status: "recorded" }

POST /tasks
├─ Request: TaskPayload {
│   session_id, task_id, title, description, type, technologies, status,
│   started_at, completed_at, tokens, cost
│ }
├─ Effect: CREATE (:Task), CREATE [:HAS_TASK], CREATE [:RUN_OF]
└─ Response: { task_id, template_id }  // returns which template was matched

PATCH /tasks/{task_id}
├─ Request: { is_bookmarked: bool, rating: 1-5 }
├─ Effect: SET t.is_bookmarked = ..., t.rating = ...
└─ Response: { task_id, status: "updated" }
```

#### Action & Event Recording

```
POST /actions
├─ Request: ActionEvent {
│   action_id, task_id, instance_id, type, tool_name, command,
│   stdout, stderr, exit_code, permission_level, risk_score,
│   started_at, ended_at, duration_ms
│ }
├─ Effect:
│   1. CREATE (:Action)
│   2. CREATE [:PERFORMED] edge with reasoning/tokens/cost
│   3. CREATE [:INSTANCE_OF] to StepNode (dedup logic)
│   4. Update or CREATE [:STEP_SEQUENCE] edge between StepNodes
│   5. Update TaskTemplate metrics
└─ Response: { action_id, risk_flagged: bool }

PATCH /actions/{action_id}/mark
├─ Request: { is_flagged: bool, reason: str }
├─ Effect: SET a.is_flagged = true, a.flag_reason = reason
└─ Response: { action_id, flagged_by: "user", timestamp }
```

#### Querying & Analytics

```
GET /templates/{template_id}/dag
├─ Response: {
│   template: TaskTemplate,
│   nodes: [StepNode],
│   edges: [STEP_SEQUENCE with metrics]
│ }
└─ Query:
   MATCH (tmpl:TaskTemplate {template_id: $id})
   MATCH (s1:StepNode)-[seq:STEP_SEQUENCE {template_id: $id}]->(s2:StepNode)
   RETURN tmpl, COLLECT(DISTINCT s1) AS nodes, COLLECT(seq) AS edges

GET /tasks/{task_id}/actions
├─ Response: Ordered list of all actions + PERFORMED edge metadata
└─ Query:
   MATCH (t:Task {task_id: $id})-[r:PERFORMED]->(a:Action)
   RETURN a, r ORDER BY r.sequence

GET /sessions/{session_id}/cost-breakdown
├─ Response: {
│   total_cost: 0.3847,
│   by_task: [{ title, cost }, ...],
│   by_tool: [{ tool, count, cost }, ...]
│ }

GET /instances/{instance_id}/usage/weekly
├─ Response: {
│   instance_name,
│   sessions: 42,
│   tasks: 156,
│   actions: 3421,
│   total_tokens: 1_234_567,
│   total_cost: 25.84
│ }
```

### DAG Merge Logic

When a new action is recorded, the backend automatically:

```python
async def merge_run_into_dag(task_run: TaskRun, actions: list[Action]):
    """Merge a new task run into the DAG."""

    # 1. Find or create TaskTemplate
    template_id = slugify(task_run.title)
    await neo4j.run("""
        MERGE (tmpl:TaskTemplate {template_id: $tmpl_id})
        ON CREATE SET tmpl.title = $title, tmpl.fingerprint = $fp
        ON MATCH  SET tmpl.run_count = tmpl.run_count + 1
    """, tmpl_id=template_id, title=task_run.title, fp=template_id)

    # 2. For each consecutive pair of actions, create/update StepNodes and STEP_SEQUENCE edge
    for i in range(len(actions) - 1):
        a1, a2 = actions[i], actions[i+1]
        fp1 = f"{a1.tool_name}:{slugify(a1.step_name)}"
        fp2 = f"{a2.tool_name}:{slugify(a2.step_name)}"

        await neo4j.run("""
            MERGE (s1:StepNode {fingerprint: $fp1, template_id: $tmpl_id})
            ON CREATE SET s1 += {
                step_id: $step1_id, tool_name: $tool1, step_name: $name1,
                run_count: 1, success_rate: 1.0
            }
            ON MATCH SET s1.run_count = s1.run_count + 1

            MERGE (s2:StepNode {fingerprint: $fp2, template_id: $tmpl_id})
            ON CREATE SET s2 += {
                step_id: $step2_id, tool_name: $tool2, step_name: $name2,
                run_count: 1, success_rate: 1.0
            }
            ON MATCH SET s2.run_count = s2.run_count + 1

            MERGE (s1)-[seq:STEP_SEQUENCE]->(s2)
            ON CREATE SET seq.run_count = 1, seq.run_ids = [$run_id]
            ON MATCH SET
                seq.run_count = seq.run_count + 1,
                seq.run_ids = seq.run_ids + [$run_id]
        """, fp1=fp1, fp2=fp2, tmpl_id=template_id,
             step1_id=slugify(a1.step_name), tool1=a1.tool_name, name1=a1.step_name,
             step2_id=slugify(a2.step_name), tool2=a2.tool_name, name2=a2.step_name,
             run_id=task_run.run_id)
```

**Key patterns:**

- `MERGE` ensures no duplicates (idempotent)
- `ON CREATE SET` initializes new nodes
- `ON MATCH SET` increments counters, appends run_ids
- `run_ids` array enables drill-down queries

---

## Frontend Visualization

### React Components

#### 1. Instance Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  Instances (5 active)                                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  heilbronn-dev (development)                    ● Online   │
│  Status: 5 tasks running, 41 completed today               │
│  Last seen: 2m ago | Model: claude-3-7-sonnet             │
│  ┌─ View timeline  ─ Cost today: $0.84  ─ 152k tokens ─┐ │
│                                                              │
│  hetzner-vps-01 (production)                   ● Online   │
│  Status: idle, 423 completed in 7 days                    │
│  Last seen: 8m ago | Model: claude-3-7-sonnet             │
│  ┌─ View timeline  ─ Cost 7d: $18.42  ─ 2.1M tokens ─┐  │
│                                                              │
│  local-test (staging)                         ● Idle      │
│  Status: 0 sessions today                                 │
│  Last seen: 2h ago | Model: claude-3-5-haiku             │
│  ┌─ View timeline  ─ Cost: $0.00  ─ 0 tokens     ─┐      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 2. Task DAG Visualization (Cytoscape.js)

Interactive, animated DAG showing all paths through a task template.

```
┌──────────────────────────────────────────────────────────────┐
│  Task Template: "Create observer crate in zeroclaw"          │
│  Fingerprint: create_observer_crate | 4 runs, 75% success   │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│     ◯ read_manifest                                          │
│    ╱│╲ (4 runs, 100% succ)                                  │
│   ╱ │ ╲                                                      │
│  ◯  │  ◯  [hover to compare metrics]                        │
│ plan│check_deps                                             │
│  ╲ │ ╱  (1 run only)                                        │
│   ╲│╱                                                        │
│     ◯ write_lib                                             │
│    ╱│╲ (4 runs, 100%, avg 310 tokens)                      │
│   ╱ │ ╲                                                     │
│ ◯   │  ◯                                                    │
│build│fix_types (recovery)                                  │
│     │ (1 run, error recovery)                              │
│     ╲ │ ╱                                                  │
│       ◯ build_final                                        │
│                                                              │
│ Legend:  ◯ = StepNode  ─ = Common path  ·  = Rare path    │
│         Size = tokens, Color = success_rate                 │
│                                                              │
│ [Compare runs]  [Export DAG]  [Full audit trail]           │
└──────────────────────────────────────────────────────────────┘
```

**Interactivity:**

- Hover node → show metrics tooltip
- Click node → side panel with all runs that hit this step
- Hover edge → tooltip with edge metrics
- Click edge → filter DAG to show only that run's path

#### 3. Audit Trail

```
┌──────────────────────────────────────────────────────────────┐
│  Task: Create observer crate (task_obs_001) | Run 1         │
│  Session: sess_20260321_001 | Instance: heilbronn-dev       │
│  Status: ✓ Completed in 1m 41s | Tokens: 7,840 | Cost: $0.16│
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ 1. read_project_manifest  (file_read)                   12ms │
│    read_file: /home/meet/projects/observegraph/Cargo.toml   │
│    Reasoning: Need to understand crate structure             │
│    Status: ✓ Success | Tokens: 225 | Cost: $0.0047          │
│    ├─ Permissions: read ├─ Risk: 0.05 (safe)               │
│                                                               │
│ 2. plan_implementation  (llm_call)                     23.0s │
│    Model: claude-3-7-sonnet | Thinking: 180 tokens         │
│    Output: "I'll create a fire-and-forget..."               │
│    Status: ✓ Success | Tokens: 1,840 | Cost: $0.0386       │
│    ├─ Thinking tokens: 620  ├─ Output tokens: 1,220        │
│    ├─ Permissions: read ├─ Risk: 0.0 (safe)               │
│                                                               │
│ 3. write_observer_lib  (file_write)                    890ms │
│    write_file: /home/meet/projects/observegraph/crates/...  │
│    Size: 2,340 bytes                                        │
│    Status: ✓ Success | Tokens: 310 | Cost: $0.0065         │
│    ├─ Permissions: write ├─ Risk: 0.2 (moderate)          │
│    ├─ [Mark]  ├─ [Flag]  ├─ [Drill to action details]      │
│                                                               │
│ 4. cargo_build  (shell)                                4.3s  │
│    Command: cargo build --package observer                  │
│    Status: ✓ Success | Exit code: 0                        │
│    Output: "Compiling observer v0.1.0\nFinished dev..."   │
│    Tokens: 620 | Cost: $0.0129 | Risk: 0.25 (write)       │
│    ├─ [Show full stdout]  ├─ [Drill to action]            │
│                                                               │
│ ⚠ 5. sudo_restart_neo4j  (shell)  [FLAGGED]           30.0s │
│    Command: sudo systemctl restart neo4j                    │
│    Status: ✗ Failed | Exit code: 1                        │
│    Error: "Failed to restart neo4j.service: Connection..."  │
│    Tokens: 708 | Cost: $0.0148 | Risk: 0.85 (dangerous) ⚠ │
│    ├─ This is a recovery attempt (was_recovery: true)      │
│    ├─ [Review reasoning]  ├─ [Unflag]  ├─ [Archive]       │
│                                                               │
│ ─────────────────────────────────────────────────────────    │
│ Summary: ✓ Task completed successfully                       │
│ Total duration: 1m 41s | Total tokens: 7,840 | Cost: $0.164 │
│ Dangerous actions: 1 flagged | Recovery attempts: 1         │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Features:**

- Mark/flag actions inline
- Drill to full action details
- Highlight dangerous actions
- Show reasoning from AI
- Filter by action type, status, risk level

#### 4. Cost Analytics

```
┌──────────────────────────────────────────────────────────────┐
│  Cost Breakdown (Last 7 Days)                                │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Total: $25.84  |  Tokens: 1,234,567  |  Tasks: 156        │
│                                                               │
│  By Instance:                                                │
│  ├─ hetzner-vps-01    $18.42  (71%)    [Timeline]           │
│  ├─ heilbronn-dev     $5.60   (22%)                        │
│  └─ local-test        $1.82   (7%)                         │
│                                                               │
│  By Task Type:                                               │
│  ├─ code              $14.30  (55%)    ◐ Chart              │
│  ├─ shell             $8.20   (32%)                        │
│  ├─ research          $2.84   (11%)                        │
│  └─ file_ops          $0.50   (2%)                         │
│                                                               │
│  By Tool:                                                    │
│  ├─ llm_call          $19.42  (75%)                        │
│  ├─ bash              $4.12   (16%)                        │
│  ├─ file_write        $1.20   (5%)                         │
│  ├─ http              $0.74   (3%)                         │
│  └─ file_read         $0.36   (1%)                         │
│                                                               │
│  Hourly trend (showing spikes):  ◐ Chart                    │
│  Peak: 2026-03-21 14:00–15:00 = $3.20 (12% of daily)      │
│                                                               │
│  [Export CSV]  [Set budget alert]  [Drill to tasks]         │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Setup & Deployment

### Local Development (Docker Compose)

```yaml
version: '3.8'

services:
  neo4j:
    image: neo4j:5.18-community
    environment:
      NEO4J_AUTH: neo4j/observegraph
      NEO4J_PLUGINS: '["apoc"]'
    ports:
      - '7474:7474' # HTTP
      - '7687:7687' # Bolt
    volumes:
      - neo4j_data:/data
      - ./init.cypher:/var/lib/neo4j/import/init.cypher

  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      NEO4J_URI: bolt://neo4j:7687
      NEO4J_USER: neo4j
      NEO4J_PASSWORD: observegraph
      ENVIRONMENT: development
    ports:
      - '8000:8000'
    depends_on:
      - neo4j
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload

  dashboard:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    environment:
      REACT_APP_API_URL: http://localhost:8000
    ports:
      - '3000:3000'
    depends_on:
      - api

volumes:
  neo4j_data:
```

### Neo4j Init Script

```cypher
// constraints.cypher
CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.user_id IS UNIQUE;
CREATE CONSTRAINT instance_id IF NOT EXISTS FOR (i:Instance) REQUIRE i.instance_id IS UNIQUE;
CREATE CONSTRAINT session_id IF NOT EXISTS FOR (s:Session) REQUIRE s.session_id IS UNIQUE;
CREATE CONSTRAINT task_id IF NOT EXISTS FOR (t:Task) REQUIRE t.task_id IS UNIQUE;
CREATE CONSTRAINT action_id IF NOT EXISTS FOR (a:Action) REQUIRE a.action_id IS UNIQUE;
CREATE CONSTRAINT template_id IF NOT EXISTS FOR (tmpl:TaskTemplate) REQUIRE tmpl.template_id IS UNIQUE;
CREATE CONSTRAINT step_id IF NOT EXISTS FOR (sn:StepNode) REQUIRE sn.step_id IS UNIQUE;

// indexes.cypher
CREATE INDEX action_permission IF NOT EXISTS FOR (a:Action) ON (a.permission_level);
CREATE INDEX action_is_flagged IF NOT EXISTS FOR (a:Action) ON (a.is_flagged);
CREATE INDEX action_status IF NOT EXISTS FOR (a:Action) ON (a.status);
CREATE INDEX task_status IF NOT EXISTS FOR (t:Task) ON (t.status);
CREATE INDEX task_type IF NOT EXISTS FOR (t:Task) ON (t.type);
CREATE INDEX session_status IF NOT EXISTS FOR (s:Session) ON (s.status);
CREATE INDEX instance_status IF NOT EXISTS FOR (i:Instance) ON (i.status);

// Initialize User node
MERGE (u:User {user_id: "meet"})
SET u.name = "Meet Kachhadiya",
    u.location = "Heilbronn, DE",
    u.created_at = datetime(),
    u.timezone = "Europe/Berlin";
```

### Zeroclaw Fork Setup

```bash
# 1. Fork zeroclaw-labs/zeroclaw
git clone https://github.com/zeroclaw-labs/zeroclaw.git
cd zeroclaw

# 2. Add observer crate
cargo new --lib crates/observer
cd crates/observer

# 3. Populate Cargo.toml
cat > Cargo.toml << 'EOF'
[package]
name = "observer"
version = "0.1.0"
edition = "2021"

[dependencies]
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.11", features = ["json"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
uuid = { version = "1", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
EOF

# 4. Add observer calls to tool handlers
# In crates/tools/src/bash.rs, after command execution:
#
# let event = observer::emit_action(ActionEvent {
#     session_id: ctx.session_id.clone(),
#     task_id: ctx.task_id.clone(),
#     tool_name: "bash".into(),
#     command: Some(cmd.clone()),
#     stdout: Some(output.stdout.clone()),
#     exit_code: Some(output.status.code()),
#     ...
# });

# 5. Build
cargo build --release

# 6. Run local backend
docker-compose up -d

# 7. Start zeroclaw with observer enabled
./target/release/zeroclaw --observer-enabled --api-url http://localhost:8000
```

---

## Key Implementation Principles

### 1. **Non-blocking Emission**

Every event is sent in a spawned tokio task. If the backend is down, zeroclaw continues normally. No impact on agent latency.

### 2. **Denormalization for Query Speed**

`instance_id`, `session_id`, `task_id` are denormalized into Action nodes. This trades ~10% more storage for O(1) filtering on high-volume queries.

### 3. **DAG Deduplication**

Task runs are merged into DAGs using `fingerprint` matching (slugified title + tool_name + step_name). A single Neo4j query returns all paths + metrics.

### 4. **Immutable Audit Trail**

Task and Action nodes are never updated after creation, only extended (new edges created). This preserves audit integrity — the exact sequence of what happened is forever recorded.

### 5. **Metrics Aggregation**

TaskTemplate and StepNode metrics are rolling averages:

```
new_avg = (old_avg * old_count + new_value) / (old_count + 1)
```

This allows historical trend analysis without recomputing.

---

## Future Extensions

1. **Multi-instance rollback** — Compare two instances' approaches to the same task and identify the better one
2. **Automated path optimization** — Use ML to suggest which path the agent should take next
3. **Cost allocation** — Attribute costs to specific projects or goals
4. **Compliance audits** — Generate immutable reports of all dangerous actions with timestamps and reasoning
5. **Scheduled analytics** — Weekly digests: "You saved $X by taking optimized path Y"

---

## Summary

**ObserveGraph** is a complete personal observability system for AI agents. It:

- ✅ Captures every step with full context (tokens, cost, reasoning, risk)
- ✅ Tracks 5+ instances simultaneously with independent audit trails
- ✅ Groups identical tasks across runs into DAGs with path comparison
- ✅ Enables drill-down from abstract DAG nodes to concrete action executions
- ✅ Provides cost analytics, risk detection, and manual review workflows
- ✅ Is self-hostable, Docker-based, and zero-complexity for a single user

**Stack:** Neo4j (database) + FastAPI (backend) + React (frontend) + Rust instrumentation (in zeroclaw)

**Time to MVP:** ~2-3 weeks of development once zeroclaw is forked.
