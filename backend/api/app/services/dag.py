"""
DAG merge service.

When a task completes (or an action is recorded), we merge the run into the
TaskTemplate + StepNode graph so the DAG stays up-to-date incrementally.

Each call to merge_action_into_dag handles ONE action at a time as actions
stream in via POST /actions. STEP_SEQUENCE edges are created between
consecutive step nodes when the *next* action in the same task arrives.

For simplicity at MVP we also expose merge_task_run which takes the full
ordered action list and builds the whole DAG in one shot (useful for bulk
imports or task-completion hooks).
"""

from neo4j import AsyncSession as Neo4jSession
from slugify import slugify


def _step_id(template_id: str, tool_name: str, step_name: str) -> str:
    return f"{template_id}:{slugify(tool_name)}:{slugify(step_name)}"


def _fingerprint(tool_name: str, step_name: str) -> str:
    return f"{slugify(tool_name)}:{slugify(step_name)}"


async def upsert_template(
    session: Neo4jSession,
    template_id: str,
    title: str,
    task_type: str,
    technologies: list[str],
    tags: list[str],
    task_id: str,
    run_id: str,
    run_number: int,
) -> None:
    """Create or increment a TaskTemplate node and link the Task to it."""
    await session.run(
        """
        MERGE (tmpl:TaskTemplate {template_id: $template_id})
        ON CREATE SET
            tmpl.title         = $title,
            tmpl.fingerprint   = $template_id,
            tmpl.type          = $type,
            tmpl.technologies  = $technologies,
            tmpl.tags          = $tags,
            tmpl.created_at    = datetime(),
            tmpl.run_count     = 1,
            tmpl.success_rate  = 1.0,
            tmpl.avg_tokens    = 0,
            tmpl.avg_duration_ms = 0
        ON MATCH SET
            tmpl.run_count = tmpl.run_count + 1

        WITH tmpl
        MATCH (t:Task {task_id: $task_id})
        MERGE (t)-[:RUN_OF {run_number: $run_number, run_id: $run_id, started_at: datetime()}]->(tmpl)
        """,
        template_id=template_id,
        title=title,
        type=task_type,
        technologies=technologies,
        tags=tags,
        task_id=task_id,
        run_id=run_id,
        run_number=run_number,
    )


async def upsert_step_sequence(
    session: Neo4jSession,
    template_id: str,
    action1: dict,
    action2: dict,
    run_id: str,
) -> None:
    """
    Merge two consecutive StepNodes and the STEP_SEQUENCE edge between them.

    action1/action2 dicts must have: tool_name, step_name, type, tokens, latency_ms, cost_usd, status
    """
    fp1 = _fingerprint(action1["tool_name"], action1["step_name"])
    fp2 = _fingerprint(action2["tool_name"], action2["step_name"])
    sid1 = _step_id(template_id, action1["tool_name"], action1["step_name"])
    sid2 = _step_id(template_id, action2["tool_name"], action2["step_name"])

    a1_success = 1 if action1.get("status") == "success" else 0
    a2_success = 1 if action2.get("status") == "success" else 0

    await session.run(
        """
        // Upsert StepNode 1
        MERGE (s1:StepNode {fingerprint: $fp1, template_id: $tmpl_id})
        ON CREATE SET
            s1.step_id       = $sid1,
            s1.tool_name     = $tool1,
            s1.step_name     = $name1,
            s1.type          = $type1,
            s1.run_count     = 1,
            s1.success_rate  = $succ1,
            s1.avg_tokens    = $tok1,
            s1.avg_latency_ms = $lat1,
            s1.avg_cost_usd  = $cost1,
            s1.is_entry      = false,
            s1.is_exit       = false
        ON MATCH SET
            s1.avg_tokens    = (s1.avg_tokens * s1.run_count + $tok1)  / (s1.run_count + 1),
            s1.avg_latency_ms = (s1.avg_latency_ms * s1.run_count + $lat1) / (s1.run_count + 1),
            s1.avg_cost_usd  = (s1.avg_cost_usd * s1.run_count + $cost1) / (s1.run_count + 1),
            s1.success_rate  = (s1.success_rate * s1.run_count + $succ1) / (s1.run_count + 1),
            s1.run_count     = s1.run_count + 1

        // Upsert StepNode 2
        MERGE (s2:StepNode {fingerprint: $fp2, template_id: $tmpl_id})
        ON CREATE SET
            s2.step_id       = $sid2,
            s2.tool_name     = $tool2,
            s2.step_name     = $name2,
            s2.type          = $type2,
            s2.run_count     = 1,
            s2.success_rate  = $succ2,
            s2.avg_tokens    = $tok2,
            s2.avg_latency_ms = $lat2,
            s2.avg_cost_usd  = $cost2,
            s2.is_entry      = false,
            s2.is_exit       = false
        ON MATCH SET
            s2.avg_tokens    = (s2.avg_tokens * s2.run_count + $tok2)  / (s2.run_count + 1),
            s2.avg_latency_ms = (s2.avg_latency_ms * s2.run_count + $lat2) / (s2.run_count + 1),
            s2.avg_cost_usd  = (s2.avg_cost_usd * s2.run_count + $cost2) / (s2.run_count + 1),
            s2.success_rate  = (s2.success_rate * s2.run_count + $succ2) / (s2.run_count + 1),
            s2.run_count     = s2.run_count + 1

        // Upsert STEP_SEQUENCE edge
        WITH s1, s2
        MERGE (s1)-[seq:STEP_SEQUENCE {template_id: $tmpl_id}]->(s2)
        ON CREATE SET
            seq.run_count     = 1,
            seq.run_ids       = [$run_id],
            seq.avg_tokens    = $tok1,
            seq.avg_latency_ms = $lat1,
            seq.success_rate  = $succ1
        ON MATCH SET
            seq.run_count     = seq.run_count + 1,
            seq.run_ids       = seq.run_ids + [$run_id],
            seq.avg_tokens    = (seq.avg_tokens * (seq.run_count - 1) + $tok1) / seq.run_count,
            seq.avg_latency_ms = (seq.avg_latency_ms * (seq.run_count - 1) + $lat1) / seq.run_count,
            seq.success_rate  = (seq.success_rate * (seq.run_count - 1) + $succ1) / seq.run_count
        """,
        fp1=fp1, fp2=fp2,
        sid1=sid1, sid2=sid2,
        tmpl_id=template_id,
        tool1=action1["tool_name"], name1=action1["step_name"], type1=action1["type"],
        tool2=action2["tool_name"], name2=action2["step_name"], type2=action2["type"],
        tok1=float(action1.get("total_tokens", 0)),
        tok2=float(action2.get("total_tokens", 0)),
        lat1=float(action1.get("duration_ms", 0)),
        lat2=float(action2.get("duration_ms", 0)),
        cost1=float(action1.get("cost_usd", 0)),
        cost2=float(action2.get("cost_usd", 0)),
        succ1=float(a1_success),
        succ2=float(a2_success),
        run_id=run_id,
    )


async def link_action_to_step(
    session: Neo4jSession,
    action_id: str,
    template_id: str,
    tool_name: str,
    step_name: str,
    task_id: str,
    run_id: str,
) -> None:
    fp = _fingerprint(tool_name, step_name)
    await session.run(
        """
        MATCH (a:Action {action_id: $action_id})
        MATCH (sn:StepNode {fingerprint: $fp, template_id: $tmpl_id})
        MERGE (a)-[:INSTANCE_OF {run_id: $run_id, task_id: $task_id}]->(sn)
        """,
        action_id=action_id,
        fp=fp,
        tmpl_id=template_id,
        run_id=run_id,
        task_id=task_id,
    )


async def mark_entry_exit_nodes(session: Neo4jSession, template_id: str) -> None:
    """Mark is_entry / is_exit on StepNodes for this template."""
    await session.run(
        """
        MATCH (s:StepNode {template_id: $tmpl_id})
        SET s.is_entry = NOT exists((:StepNode)-[:STEP_SEQUENCE {template_id: $tmpl_id}]->(s)),
            s.is_exit  = NOT exists((s)-[:STEP_SEQUENCE {template_id: $tmpl_id}]->(:StepNode))
        """,
        tmpl_id=template_id,
    )
