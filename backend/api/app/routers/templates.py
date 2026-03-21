from fastapi import APIRouter, HTTPException
from app.database import get_driver
from app.models.analytics import (
    TaskTemplateOut,
    DAGResponse,
    StepNodeOut,
    StepEdgeOut,
)

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("", response_model=list[TaskTemplateOut])
async def list_templates():
    """List all task templates ordered by run count."""
    driver = get_driver()
    async with driver.session() as session:
        result = await session.run(
            """
            MATCH (tmpl:TaskTemplate)
            RETURN tmpl
            ORDER BY tmpl.run_count DESC
            """
        )
        rows = await result.data()

    return [_template_out(r["tmpl"]) for r in rows]


@router.get("/{template_id}", response_model=TaskTemplateOut)
async def get_template(template_id: str):
    driver = get_driver()
    async with driver.session() as session:
        result = await session.run(
            "MATCH (tmpl:TaskTemplate {template_id: $template_id}) RETURN tmpl",
            template_id=template_id,
        )
        row = await result.single()
        if not row:
            raise HTTPException(status_code=404, detail="Template not found")
    return _template_out(row["tmpl"])


@router.get("/{template_id}/dag", response_model=DAGResponse)
async def get_dag(template_id: str):
    """
    Return the full merged DAG for a task template.
    Nodes = StepNodes, Edges = STEP_SEQUENCE relationships with run metrics.
    """
    driver = get_driver()
    async with driver.session() as session:
        # Template
        tmpl_result = await session.run(
            "MATCH (tmpl:TaskTemplate {template_id: $template_id}) RETURN tmpl",
            template_id=template_id,
        )
        tmpl_row = await tmpl_result.single()
        if not tmpl_row:
            raise HTTPException(status_code=404, detail="Template not found")

        # Nodes + Edges
        dag_result = await session.run(
            """
            MATCH (s1:StepNode {template_id: $template_id})-[seq:STEP_SEQUENCE]->(s2:StepNode {template_id: $template_id})
            RETURN COLLECT(DISTINCT s1) + COLLECT(DISTINCT s2) AS nodes,
                   COLLECT({
                       from_step_id:   s1.step_id,
                       to_step_id:     s2.step_id,
                       run_count:      seq.run_count,
                       avg_tokens:     seq.avg_tokens,
                       avg_latency_ms: seq.avg_latency_ms,
                       success_rate:   seq.success_rate,
                       run_ids:        seq.run_ids
                   }) AS edges
            """,
            template_id=template_id,
        )
        dag_row = await dag_result.single()

    nodes_raw = dag_row["nodes"] if dag_row else []
    edges_raw = dag_row["edges"] if dag_row else []

    # Deduplicate nodes (COLLECT DISTINCT still returns duplicates via + concat)
    seen = set()
    nodes = []
    for n in nodes_raw:
        if n["step_id"] not in seen:
            seen.add(n["step_id"])
            nodes.append(
                StepNodeOut(
                    step_id=n["step_id"],
                    fingerprint=n["fingerprint"],
                    tool_name=n["tool_name"],
                    step_name=n["step_name"],
                    type=n["type"],
                    run_count=n.get("run_count", 0),
                    success_rate=n.get("success_rate", 0.0),
                    avg_tokens=n.get("avg_tokens", 0.0),
                    avg_latency_ms=n.get("avg_latency_ms", 0.0),
                    avg_cost_usd=n.get("avg_cost_usd", 0.0),
                    is_entry=n.get("is_entry", False),
                    is_exit=n.get("is_exit", False),
                )
            )

    edges = [
        StepEdgeOut(
            from_step_id=e["from_step_id"],
            to_step_id=e["to_step_id"],
            run_count=e.get("run_count", 0),
            avg_tokens=e.get("avg_tokens", 0.0),
            avg_latency_ms=e.get("avg_latency_ms", 0.0),
            success_rate=e.get("success_rate", 0.0),
            run_ids=e.get("run_ids", []),
        )
        for e in edges_raw
    ]

    return DAGResponse(
        template=_template_out(tmpl_row["tmpl"]),
        nodes=nodes,
        edges=edges,
    )


def _template_out(t: dict) -> TaskTemplateOut:
    return TaskTemplateOut(
        template_id=t["template_id"],
        title=t["title"],
        fingerprint=t["fingerprint"],
        type=t["type"],
        technologies=t.get("technologies", []),
        created_at=str(t["created_at"]),
        run_count=t.get("run_count", 0),
        success_rate=t.get("success_rate", 0.0),
        avg_tokens=t.get("avg_tokens", 0.0),
        avg_duration_ms=t.get("avg_duration_ms", 0.0),
        best_run_id=t.get("best_run_id"),
        tags=t.get("tags", []),
    )
