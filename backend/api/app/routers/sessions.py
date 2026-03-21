from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from app.convex_client import ConvexRequestError
from app.models.session import (
    CostByTask,
    CostByTool,
    CreateSessionRequest,
    CreateSessionResponse,
    SessionCostBreakdown,
    SessionOut,
    UpdateSessionRequest,
)
from app.router_utils import raise_as_http
from app.services import convex_ingest, convex_reads

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=CreateSessionResponse, status_code=201)
async def create_session(body: CreateSessionRequest):
    """Record the start of a new zeroclaw session."""
    started_at = body.started_at or datetime.now(timezone.utc)
    try:
        await convex_ingest.create_session(body, started_at=started_at.isoformat())
    except ConvexRequestError as error:
        raise_as_http(error)
    return CreateSessionResponse(session_id=body.session_id)


@router.patch("/{session_id}", response_model=CreateSessionResponse)
async def update_session(session_id: str, body: UpdateSessionRequest):
    """Update a session — typically called when the session ends."""
    if not any(
        (
            body.status is not None,
            body.ended_at is not None,
            body.duration_ms is not None,
            body.total_tokens is not None,
            body.total_cost_usd is not None,
            body.task_count is not None,
            body.action_count is not None,
            body.exit_code is not None,
            body.notes is not None,
        )
    ):
        raise HTTPException(status_code=422, detail="No fields to update")

    try:
        await convex_ingest.update_session(session_id, body)
    except ConvexRequestError as error:
        raise_as_http(error)
    return CreateSessionResponse(session_id=session_id)


@router.get("/{session_id}", response_model=SessionOut)
async def get_session(session_id: str):
    try:
        payload = await convex_reads.get_session(session_id)
    except ConvexRequestError as error:
        raise_as_http(error)
    return SessionOut(**payload)


@router.get("/{session_id}/cost-breakdown", response_model=SessionCostBreakdown)
async def session_cost_breakdown(session_id: str):
    """Cost breakdown by task and by tool for a session."""
    try:
        payload = await convex_reads.get_session_cost_breakdown(session_id)
    except ConvexRequestError as error:
        raise_as_http(error)

    return SessionCostBreakdown(
        session_id=payload["session_id"],
        total_cost_usd=payload["total_cost_usd"],
        by_task=[CostByTask(**row) for row in payload["by_task"]],
        by_tool=[CostByTool(**row) for row in payload["by_tool"]],
    )
