from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from app.database import get_driver
from app.models.session import (
    CreateSessionRequest,
    UpdateSessionRequest,
    CreateSessionResponse,
    SessionOut,
    SessionCostBreakdown,
    CostByTask,
    CostByTool,
)

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=CreateSessionResponse, status_code=201)
async def create_session(body: CreateSessionRequest):
    """Record the start of a new zeroclaw session."""
    driver = get_driver()
    started_at = body.started_at or datetime.now(timezone.utc)
    async with driver.session() as session:
        result = await session.run(
            """
            MATCH (i:Instance {instance_id: $instance_id})
            CREATE (s:Session {
                session_id:     $session_id,
                instance_id:    $instance_id,
                trigger:        $trigger,
                working_dir:    $working_dir,
                git_repo:       $git_repo,
                git_branch:     $git_branch,
                git_commit:     $git_commit,
                model_override: $model_override,
                started_at:     datetime($started_at),
                status:         'running',
                total_tokens:   0,
                total_cost_usd: 0.0,
                task_count:     0,
                action_count:   0,
                notes:          $notes
            })
            CREATE (i)-[:HAS_SESSION {started_at: datetime($started_at)}]->(s)
            RETURN s.session_id AS session_id
            """,
            session_id=body.session_id,
            instance_id=body.instance_id,
            trigger=body.trigger,
            working_dir=body.working_dir,
            git_repo=body.git_repo,
            git_branch=body.git_branch,
            git_commit=body.git_commit,
            model_override=body.model_override,
            started_at=started_at.isoformat(),
            notes=body.notes,
        )
        record = await result.single()
        if not record:
            raise HTTPException(status_code=404, detail="Instance not found")
    return CreateSessionResponse(session_id=body.session_id)


@router.patch("/{session_id}", response_model=CreateSessionResponse)
async def update_session(session_id: str, body: UpdateSessionRequest):
    """Update a session — typically called when the session ends."""
    driver = get_driver()
    set_clauses = []
    params: dict = {"session_id": session_id}

    field_map = {
        "status": "s.status",
        "duration_ms": "s.duration_ms",
        "total_tokens": "s.total_tokens",
        "total_cost_usd": "s.total_cost_usd",
        "task_count": "s.task_count",
        "action_count": "s.action_count",
        "exit_code": "s.exit_code",
        "notes": "s.notes",
    }

    for field, cypher_field in field_map.items():
        val = getattr(body, field)
        if val is not None:
            set_clauses.append(f"{cypher_field} = ${field}")
            params[field] = val

    if body.ended_at is not None:
        set_clauses.append("s.ended_at = datetime($ended_at)")
        params["ended_at"] = body.ended_at.isoformat()

    if not set_clauses:
        raise HTTPException(status_code=422, detail="No fields to update")

    query = f"""
        MATCH (s:Session {{session_id: $session_id}})
        SET {', '.join(set_clauses)}
        RETURN s.session_id AS session_id
    """

    async with driver.session() as session:
        result = await session.run(query, **params)
        record = await result.single()
        if not record:
            raise HTTPException(status_code=404, detail="Session not found")

    return CreateSessionResponse(session_id=session_id)


@router.get("/{session_id}", response_model=SessionOut)
async def get_session(session_id: str):
    driver = get_driver()
    async with driver.session() as session:
        result = await session.run(
            "MATCH (s:Session {session_id: $session_id}) RETURN s",
            session_id=session_id,
        )
        row = await result.single()
        if not row:
            raise HTTPException(status_code=404, detail="Session not found")
        s = row["s"]

    return SessionOut(
        session_id=s["session_id"],
        instance_id=s["instance_id"],
        trigger=s["trigger"],
        working_dir=s.get("working_dir"),
        git_repo=s.get("git_repo"),
        git_branch=s.get("git_branch"),
        git_commit=s.get("git_commit"),
        model_override=s.get("model_override"),
        started_at=s["started_at"],
        ended_at=s.get("ended_at"),
        duration_ms=s.get("duration_ms"),
        status=s["status"],
        total_tokens=s.get("total_tokens", 0),
        total_cost_usd=s.get("total_cost_usd", 0.0),
        task_count=s.get("task_count", 0),
        action_count=s.get("action_count", 0),
        exit_code=s.get("exit_code"),
        notes=s.get("notes"),
    )


@router.get("/{session_id}/cost-breakdown", response_model=SessionCostBreakdown)
async def session_cost_breakdown(session_id: str):
    """Cost breakdown by task and by tool for a session."""
    driver = get_driver()
    async with driver.session() as session:
        # Verify session exists
        chk = await session.run(
            "MATCH (s:Session {session_id: $sid}) RETURN s.session_id",
            sid=session_id,
        )
        if not await chk.single():
            raise HTTPException(status_code=404, detail="Session not found")

        # By task
        by_task_result = await session.run(
            """
            MATCH (s:Session {session_id: $sid})-[:HAS_TASK]->(t:Task)-[r:PERFORMED]->(a:Action)
            RETURN t.task_id AS task_id, t.title AS title,
                   sum(r.cost_usd) AS cost_usd, sum(r.total_tokens) AS tokens
            ORDER BY cost_usd DESC
            """,
            sid=session_id,
        )
        by_task_rows = await by_task_result.data()

        # By tool
        by_tool_result = await session.run(
            """
            MATCH (s:Session {session_id: $sid})-[:HAS_TASK]->(t:Task)-[r:PERFORMED]->(a:Action)
            RETURN a.tool_name AS tool_name,
                   count(a)        AS action_count,
                   sum(r.cost_usd) AS cost_usd
            ORDER BY cost_usd DESC
            """,
            sid=session_id,
        )
        by_tool_rows = await by_tool_result.data()

    total = sum(r["cost_usd"] or 0 for r in by_task_rows)

    return SessionCostBreakdown(
        session_id=session_id,
        total_cost_usd=round(total, 6),
        by_task=[
            CostByTask(
                task_id=r["task_id"],
                title=r["title"],
                cost_usd=round(r["cost_usd"] or 0, 6),
                tokens=r["tokens"] or 0,
            )
            for r in by_task_rows
        ],
        by_tool=[
            CostByTool(
                tool_name=r["tool_name"],
                action_count=r["action_count"],
                cost_usd=round(r["cost_usd"] or 0, 6),
            )
            for r in by_tool_rows
        ],
    )
