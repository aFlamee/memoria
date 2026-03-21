from __future__ import annotations

from app.convex_client import request_json
from app.models.action import FlagActionRequest, RecordActionRequest
from app.models.instance import RegisterInstanceRequest
from app.models.session import CreateSessionRequest, UpdateSessionRequest
from app.models.task import CreateTaskRequest, UpdateTaskRequest


async def register_instance(body: RegisterInstanceRequest, *, registered_at: str, last_seen_at: str):
    return await request_json(
        "POST",
        "/internal/observegraph/instances/register",
        json={
            "instanceId": body.instance_id,
            "slug": body.instance_id,
            "name": body.name,
            "host": body.host,
            "port": body.port,
            "environment": body.environment,
            "os": body.os,
            "arch": body.arch,
            "zeroclawVersion": body.zeroclaw_version,
            "modelDefault": body.model_default,
            "registeredAt": registered_at,
            "lastSeenAt": last_seen_at,
            "status": "online",
            "isPinned": body.is_pinned,
            "tags": body.tags,
        },
    )


async def heartbeat_instance(instance_id: str, *, last_seen_at: str):
    return await request_json(
        "POST",
        "/internal/observegraph/instances/heartbeat",
        json={"instanceId": instance_id, "lastSeenAt": last_seen_at},
    )


async def create_session(body: CreateSessionRequest, *, started_at: str):
    return await request_json(
        "POST",
        "/internal/observegraph/sessions/create",
        json={
            "sessionId": body.session_id,
            "instanceId": body.instance_id,
            "trigger": body.trigger,
            "workingDir": body.working_dir,
            "gitRepo": body.git_repo,
            "gitBranch": body.git_branch,
            "gitCommit": body.git_commit,
            "modelOverride": body.model_override,
            "startedAt": started_at,
            "endedAt": None,
            "durationMs": None,
            "status": "running",
            "totalTokens": 0,
            "totalCostUsd": 0.0,
            "taskCount": 0,
            "actionCount": 0,
            "exitCode": None,
            "notes": body.notes,
        },
    )


async def update_session(session_id: str, body: UpdateSessionRequest):
    return await request_json(
        "POST",
        "/internal/observegraph/sessions/update",
        json={
            "sessionId": session_id,
            "status": body.status,
            "endedAt": body.ended_at.isoformat() if body.ended_at else None,
            "durationMs": body.duration_ms,
            "totalTokens": body.total_tokens,
            "totalCostUsd": body.total_cost_usd,
            "taskCount": body.task_count,
            "actionCount": body.action_count,
            "exitCode": body.exit_code,
            "notes": body.notes,
        },
    )


async def create_task(body: CreateTaskRequest, *, started_at: str):
    return await request_json(
        "POST",
        "/internal/observegraph/tasks/create",
        json={
            "taskId": body.task_id,
            "sessionId": body.session_id,
            "instanceId": body.instance_id,
            "title": body.title,
            "description": body.description,
            "type": body.type,
            "technologies": body.technologies,
            "status": body.status,
            "priority": body.priority,
            "startedAt": started_at,
            "completedAt": body.completed_at.isoformat() if body.completed_at else None,
            "durationMs": body.duration_ms,
            "totalTokens": body.total_tokens,
            "thinkingTokens": body.thinking_tokens,
            "outputTokens": body.output_tokens,
            "totalCostUsd": body.total_cost_usd,
            "actionCount": body.action_count,
            "isBookmarked": False,
            "rating": None,
            "tags": body.tags,
            "error": body.error,
        },
    )


async def update_task(task_id: str, body: UpdateTaskRequest):
    return await request_json(
        "POST",
        "/internal/observegraph/tasks/update",
        json={
            "taskId": task_id,
            "status": body.status,
            "completedAt": body.completed_at.isoformat() if body.completed_at else None,
            "durationMs": body.duration_ms,
            "totalTokens": body.total_tokens,
            "thinkingTokens": body.thinking_tokens,
            "outputTokens": body.output_tokens,
            "totalCostUsd": body.total_cost_usd,
            "actionCount": body.action_count,
            "isBookmarked": body.is_bookmarked,
            "rating": body.rating,
            "error": body.error,
        },
    )


async def record_action(body: RecordActionRequest, *, risk_score: float, risk_flagged: bool):
    return await request_json(
        "POST",
        "/internal/observegraph/actions/create",
        json={
            "actionId": body.action_id,
            "taskId": body.task_id,
            "instanceId": body.instance_id,
            "sequence": body.sequence,
            "stepName": body.step_name,
            "type": body.type,
            "toolName": body.tool_name,
            "command": body.command,
            "filePath": body.file_path,
            "fileSizeBytes": body.file_size_bytes,
            "stdout": body.stdout,
            "stderr": body.stderr,
            "exitCode": body.exit_code,
            "permissionLevel": body.permission_level,
            "riskScore": risk_score,
            "isFlagged": risk_flagged,
            "flagReason": None,
            "status": body.status,
            "startedAt": body.started_at.isoformat(),
            "endedAt": body.ended_at.isoformat(),
            "durationMs": body.duration_ms,
            "reasoning": body.reasoning,
            "thinkingTokens": body.thinking_tokens,
            "outputTokens": body.output_tokens,
            "totalTokens": body.total_tokens,
            "modelUsed": body.model_used,
            "latencyMs": body.latency_ms,
            "costUsd": body.cost_usd,
            "retryCount": body.retry_count,
            "isRecovery": body.is_recovery,
        },
    )


async def flag_action(action_id: str, body: FlagActionRequest):
    return await request_json(
        "POST",
        "/internal/observegraph/actions/flag",
        json={
            "actionId": action_id,
            "isFlagged": body.is_flagged,
            "reason": body.reason,
        },
    )
