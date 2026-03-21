from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from slugify import slugify
from app.database import get_driver
from app.models.task import (
    CreateTaskRequest,
    UpdateTaskRequest,
    CreateTaskResponse,
    TaskOut,
)
from app.models.action import ActionOut
from app.services import dag as dag_service

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _template_id(title: str) -> str:
    return slugify(title)


@router.post("", response_model=CreateTaskResponse, status_code=201)
async def create_task(body: CreateTaskRequest):
    """
    Record a new task (or a running task).
    Automatically creates/increments the matching TaskTemplate and links via RUN_OF.
    """
    driver = get_driver()
    started_at = body.started_at or datetime.now(timezone.utc)
    template_id = _template_id(body.title)

    async with driver.session() as session:
        # Count existing runs for this template to get run_number
        count_result = await session.run(
            """
            MATCH (:TaskTemplate {template_id: $tmpl_id})<-[:RUN_OF]-()
            RETURN count(*) AS cnt
            """,
            tmpl_id=template_id,
        )
        count_row = await count_result.single()
        run_number = (count_row["cnt"] if count_row else 0) + 1

        # Create Task node
        result = await session.run(
            """
            MATCH (s:Session {session_id: $session_id})
            CREATE (t:Task {
                task_id:         $task_id,
                session_id:      $session_id,
                instance_id:     $instance_id,
                title:           $title,
                description:     $description,
                type:            $type,
                technologies:    $technologies,
                status:          $status,
                priority:        $priority,
                started_at:      datetime($started_at),
                completed_at:    $completed_at,
                duration_ms:     $duration_ms,
                total_tokens:    $total_tokens,
                thinking_tokens: $thinking_tokens,
                output_tokens:   $output_tokens,
                total_cost_usd:  $total_cost_usd,
                action_count:    $action_count,
                is_bookmarked:   false,
                rating:          null,
                tags:            $tags,
                error:           $error
            })
            CREATE (s)-[:HAS_TASK {index: $run_number, created_at: datetime()}]->(t)
            RETURN t.task_id AS task_id
            """,
            task_id=body.task_id,
            session_id=body.session_id,
            instance_id=body.instance_id,
            title=body.title,
            description=body.description,
            type=body.type,
            technologies=body.technologies,
            status=body.status,
            priority=body.priority,
            started_at=started_at.isoformat(),
            completed_at=body.completed_at.isoformat() if body.completed_at else None,
            duration_ms=body.duration_ms,
            total_tokens=body.total_tokens,
            thinking_tokens=body.thinking_tokens,
            output_tokens=body.output_tokens,
            total_cost_usd=body.total_cost_usd,
            action_count=body.action_count,
            tags=body.tags,
            error=body.error,
            run_number=run_number,
        )
        record = await result.single()
        if not record:
            raise HTTPException(status_code=404, detail="Session not found")

        # Upsert template + RUN_OF edge
        await dag_service.upsert_template(
            session,
            template_id=template_id,
            title=body.title,
            task_type=body.type,
            technologies=body.technologies,
            tags=body.tags,
            task_id=body.task_id,
            run_id=body.task_id,
            run_number=run_number,
        )

    return CreateTaskResponse(task_id=body.task_id, template_id=template_id)


@router.patch("/{task_id}", response_model=CreateTaskResponse)
async def update_task(task_id: str, body: UpdateTaskRequest):
    """Update a task — used to mark completion, add bookmark/rating."""
    driver = get_driver()
    set_clauses = []
    params: dict = {"task_id": task_id}

    field_map = {
        "status": "t.status",
        "duration_ms": "t.duration_ms",
        "total_tokens": "t.total_tokens",
        "thinking_tokens": "t.thinking_tokens",
        "output_tokens": "t.output_tokens",
        "total_cost_usd": "t.total_cost_usd",
        "action_count": "t.action_count",
        "is_bookmarked": "t.is_bookmarked",
        "rating": "t.rating",
        "error": "t.error",
    }

    for field, cypher_field in field_map.items():
        val = getattr(body, field)
        if val is not None:
            set_clauses.append(f"{cypher_field} = ${field}")
            params[field] = val

    if body.completed_at is not None:
        set_clauses.append("t.completed_at = datetime($completed_at)")
        params["completed_at"] = body.completed_at.isoformat()

    if not set_clauses:
        raise HTTPException(status_code=422, detail="No fields to update")

    query = f"""
        MATCH (t:Task {{task_id: $task_id}})
        SET {', '.join(set_clauses)}
        RETURN t.task_id AS task_id
    """

    async with driver.session() as session:
        result = await session.run(query, **params)
        record = await result.single()
        if not record:
            raise HTTPException(status_code=404, detail="Task not found")

    return CreateTaskResponse(task_id=task_id, template_id=_template_id(task_id))


@router.get("/{task_id}", response_model=TaskOut)
async def get_task(task_id: str):
    driver = get_driver()
    async with driver.session() as session:
        result = await session.run(
            "MATCH (t:Task {task_id: $task_id}) RETURN t",
            task_id=task_id,
        )
        row = await result.single()
        if not row:
            raise HTTPException(status_code=404, detail="Task not found")
        t = row["t"]

    return TaskOut(
        task_id=t["task_id"],
        session_id=t["session_id"],
        instance_id=t["instance_id"],
        title=t["title"],
        description=t.get("description"),
        type=t["type"],
        technologies=t.get("technologies", []),
        status=t["status"],
        priority=t["priority"],
        started_at=t["started_at"],
        completed_at=t.get("completed_at"),
        duration_ms=t.get("duration_ms"),
        total_tokens=t.get("total_tokens", 0),
        thinking_tokens=t.get("thinking_tokens", 0),
        output_tokens=t.get("output_tokens", 0),
        total_cost_usd=t.get("total_cost_usd", 0.0),
        action_count=t.get("action_count", 0),
        is_bookmarked=t.get("is_bookmarked", False),
        rating=t.get("rating"),
        tags=t.get("tags", []),
        error=t.get("error"),
    )


@router.get("/{task_id}/actions", response_model=list[ActionOut])
async def get_task_actions(task_id: str):
    """Return all actions for a task ordered by their execution sequence."""
    driver = get_driver()
    async with driver.session() as session:
        # Verify task exists
        chk = await session.run(
            "MATCH (t:Task {task_id: $task_id}) RETURN t.task_id",
            task_id=task_id,
        )
        if not await chk.single():
            raise HTTPException(status_code=404, detail="Task not found")

        result = await session.run(
            """
            MATCH (t:Task {task_id: $task_id})-[r:PERFORMED]->(a:Action)
            RETURN a, r
            ORDER BY r.sequence ASC
            """,
            task_id=task_id,
        )
        rows = await result.data()

    return [
        ActionOut(
            action_id=row["a"]["action_id"],
            task_id=row["a"]["task_id"],
            instance_id=row["a"]["instance_id"],
            type=row["a"]["type"],
            tool_name=row["a"]["tool_name"],
            command=row["a"].get("command"),
            file_path=row["a"].get("file_path"),
            file_size_bytes=row["a"].get("file_size_bytes"),
            stdout=row["a"].get("stdout"),
            stderr=row["a"].get("stderr"),
            exit_code=row["a"].get("exit_code"),
            permission_level=row["a"]["permission_level"],
            risk_score=row["a"].get("risk_score", 0.0),
            is_flagged=row["a"].get("is_flagged", False),
            flag_reason=row["a"].get("flag_reason"),
            status=row["a"]["status"],
            started_at=row["a"]["started_at"],
            ended_at=row["a"]["ended_at"],
            duration_ms=row["a"].get("duration_ms", 0),
            sequence=row["r"].get("sequence"),
            step_name=row["r"].get("step_name"),
            reasoning=row["r"].get("reasoning"),
            thinking_tokens=row["r"].get("thinking_tokens", 0),
            output_tokens=row["r"].get("output_tokens", 0),
            total_tokens=row["r"].get("total_tokens", 0),
            model_used=row["r"].get("model_used"),
            cost_usd=row["r"].get("cost_usd", 0.0),
            retry_count=row["r"].get("retry_count", 0),
            is_recovery=row["r"].get("is_recovery", False),
        )
        for row in rows
    ]
