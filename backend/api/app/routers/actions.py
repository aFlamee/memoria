from fastapi import APIRouter

from app.convex_client import ConvexRequestError
from app.models.action import (
    FlagActionRequest,
    FlagActionResponse,
    RecordActionRequest,
    RecordActionResponse,
)
from app.router_utils import raise_as_http
from app.services import convex_ingest
from app.services.risk import compute_risk_score

router = APIRouter(prefix="/actions", tags=["actions"])

_HIGH_RISK_THRESHOLD = 0.7


@router.post("", response_model=RecordActionResponse, status_code=201)
async def record_action(body: RecordActionRequest):
    """Record a single action from a zeroclaw agent."""
    risk_score = compute_risk_score(body.permission_level, body.tool_name, body.exit_code)
    risk_flagged = risk_score >= _HIGH_RISK_THRESHOLD

    try:
        await convex_ingest.record_action(body, risk_score=risk_score, risk_flagged=risk_flagged)
    except ConvexRequestError as error:
        raise_as_http(error)

    return RecordActionResponse(
        action_id=body.action_id,
        risk_score=risk_score,
        risk_flagged=risk_flagged,
    )


@router.patch("/{action_id}/mark", response_model=FlagActionResponse)
async def flag_action(action_id: str, body: FlagActionRequest):
    """Manually flag or unflag a suspicious action."""
    try:
        payload = await convex_ingest.flag_action(action_id, body)
    except ConvexRequestError as error:
        raise_as_http(error)

    return FlagActionResponse(
        action_id=payload["action_id"],
        is_flagged=payload["is_flagged"],
        flagged_at=payload["flagged_at"],
    )
