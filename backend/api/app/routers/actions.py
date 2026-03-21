from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from slugify import slugify
from app.database import get_driver
from app.models.action import (
    RecordActionRequest,
    FlagActionRequest,
    RecordActionResponse,
    FlagActionResponse,
)
from app.services.risk import compute_risk_score
from app.services import dag as dag_service

router = APIRouter(prefix="/actions", tags=["actions"])

_HIGH_RISK_THRESHOLD = 0.7


@router.post("", response_model=RecordActionResponse, status_code=201)
async def record_action(body: RecordActionRequest):
    """
    Record a single action from a zeroclaw agent.

    Side effects (all within one DB transaction):
    1. Creates the Action node
    2. Creates the PERFORMED edge (with reasoning/tokens/cost context)
    3. Creates the NEXT edge from the previous action in this task
    4. Upserts StepNodes + STEP_SEQUENCE in the TaskTemplate DAG
    5. Links the Action to its StepNode via INSTANCE_OF
    """
    driver = get_driver()
    risk_score = compute_risk_score(body.permission_level, body.tool_name, body.exit_code)

    async with driver.session() as session:
        # Verify task exists and get template_id
        task_result = await session.run(
            "MATCH (t:Task {task_id: $task_id}) RETURN t.title AS title",
            task_id=body.task_id,
        )
        task_row = await task_result.single()
        if not task_row:
            raise HTTPException(status_code=404, detail="Task not found")

        template_id = slugify(task_row["title"])

        # 1 & 2. Create Action node + PERFORMED edge
        await session.run(
            """
            MATCH (t:Task {task_id: $task_id})
            CREATE (a:Action {
                action_id:        $action_id,
                task_id:          $task_id,
                instance_id:      $instance_id,
                type:             $type,
                tool_name:        $tool_name,
                command:          $command,
                file_path:        $file_path,
                file_size_bytes:  $file_size_bytes,
                stdout:           $stdout,
                stderr:           $stderr,
                exit_code:        $exit_code,
                permission_level: $permission_level,
                risk_score:       $risk_score,
                is_flagged:       $is_flagged,
                status:           $status,
                started_at:       datetime($started_at),
                ended_at:         datetime($ended_at),
                duration_ms:      $duration_ms
            })
            CREATE (t)-[:PERFORMED {
                sequence:        $sequence,
                step_name:       $step_name,
                reasoning:       $reasoning,
                thinking_tokens: $thinking_tokens,
                output_tokens:   $output_tokens,
                total_tokens:    $total_tokens,
                model_used:      $model_used,
                tool_used:       $tool_name,
                timestamp:       datetime($started_at),
                latency_ms:      $latency_ms,
                cost_usd:        $cost_usd,
                retry_count:     $retry_count,
                is_recovery:     $is_recovery
            }]->(a)
            """,
            action_id=body.action_id,
            task_id=body.task_id,
            instance_id=body.instance_id,
            type=body.type,
            tool_name=body.tool_name,
            command=body.command,
            file_path=body.file_path,
            file_size_bytes=body.file_size_bytes,
            stdout=body.stdout,
            stderr=body.stderr,
            exit_code=body.exit_code,
            permission_level=body.permission_level,
            risk_score=risk_score,
            is_flagged=risk_score >= _HIGH_RISK_THRESHOLD,
            status=body.status,
            started_at=body.started_at.isoformat(),
            ended_at=body.ended_at.isoformat(),
            duration_ms=body.duration_ms,
            sequence=body.sequence,
            step_name=body.step_name,
            reasoning=body.reasoning,
            thinking_tokens=body.thinking_tokens,
            output_tokens=body.output_tokens,
            total_tokens=body.total_tokens,
            model_used=body.model_used,
            latency_ms=body.latency_ms,
            cost_usd=body.cost_usd,
            retry_count=body.retry_count,
            is_recovery=body.is_recovery,
        )

        # 3. NEXT edge: link previous action (sequence - 1) to this one
        if body.sequence > 1:
            await session.run(
                """
                MATCH (t:Task {task_id: $task_id})-[r:PERFORMED]->(prev:Action)
                WHERE r.sequence = $prev_seq
                MATCH (curr:Action {action_id: $action_id})
                MERGE (prev)-[:NEXT {
                    elapsed_ms:      $elapsed_ms,
                    transition_type: 'sequential'
                }]->(curr)
                """,
                task_id=body.task_id,
                prev_seq=body.sequence - 1,
                action_id=body.action_id,
                elapsed_ms=body.duration_ms,
            )

        # 4 & 5. DAG: upsert StepNode and link to action
        # We only build STEP_SEQUENCE edges when we have a previous step to connect to
        if body.sequence > 1:
            prev_result = await session.run(
                """
                MATCH (t:Task {task_id: $task_id})-[r:PERFORMED]->(prev:Action)
                WHERE r.sequence = $prev_seq
                RETURN prev.tool_name AS tool_name, r.step_name AS step_name,
                       prev.type AS type, r.total_tokens AS total_tokens,
                       prev.duration_ms AS duration_ms, r.cost_usd AS cost_usd,
                       prev.status AS status
                """,
                task_id=body.task_id,
                prev_seq=body.sequence - 1,
            )
            prev_row = await prev_result.single()
            if prev_row:
                await dag_service.upsert_step_sequence(
                    session,
                    template_id=template_id,
                    action1={
                        "tool_name": prev_row["tool_name"],
                        "step_name": prev_row["step_name"],
                        "type": prev_row["type"],
                        "total_tokens": prev_row["total_tokens"] or 0,
                        "duration_ms": prev_row["duration_ms"] or 0,
                        "cost_usd": prev_row["cost_usd"] or 0,
                        "status": prev_row["status"],
                    },
                    action2={
                        "tool_name": body.tool_name,
                        "step_name": body.step_name,
                        "type": body.type,
                        "total_tokens": body.total_tokens,
                        "duration_ms": body.duration_ms,
                        "cost_usd": body.cost_usd,
                        "status": body.status,
                    },
                    run_id=body.task_id,
                )

        await dag_service.link_action_to_step(
            session,
            action_id=body.action_id,
            template_id=template_id,
            tool_name=body.tool_name,
            step_name=body.step_name,
            task_id=body.task_id,
            run_id=body.task_id,
        )

    return RecordActionResponse(
        action_id=body.action_id,
        risk_score=risk_score,
        risk_flagged=risk_score >= _HIGH_RISK_THRESHOLD,
    )


@router.patch("/{action_id}/mark", response_model=FlagActionResponse)
async def flag_action(action_id: str, body: FlagActionRequest):
    """Manually flag or unflag a suspicious action."""
    driver = get_driver()
    now = datetime.now(timezone.utc)
    async with driver.session() as session:
        result = await session.run(
            """
            MATCH (a:Action {action_id: $action_id})
            SET a.is_flagged   = $is_flagged,
                a.flag_reason  = $reason,
                a.flagged_at   = CASE WHEN $is_flagged THEN datetime($now) ELSE null END
            RETURN a.action_id AS action_id, a.is_flagged AS is_flagged, a.flagged_at AS flagged_at
            """,
            action_id=action_id,
            is_flagged=body.is_flagged,
            reason=body.reason,
            now=now.isoformat(),
        )
        row = await result.single()
        if not row:
            raise HTTPException(status_code=404, detail="Action not found")

    return FlagActionResponse(
        action_id=row["action_id"],
        is_flagged=row["is_flagged"],
        flagged_at=row["flagged_at"],
    )
