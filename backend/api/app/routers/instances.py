from datetime import datetime, timezone

from fastapi import APIRouter

from app.convex_client import ConvexRequestError
from app.models.instance import (
    HeartbeatResponse,
    InstanceOut,
    RegisterInstanceRequest,
    RegisterInstanceResponse,
    WeeklyUsage,
)
from app.router_utils import raise_as_http
from app.services import convex_ingest, convex_reads

router = APIRouter(prefix="/instances", tags=["instances"])


@router.post("", response_model=RegisterInstanceResponse, status_code=201)
async def register_instance(body: RegisterInstanceRequest):
    """Register or update a zeroclaw instance. Called on agent boot."""
    now = datetime.now(timezone.utc).isoformat()
    try:
        await convex_ingest.register_instance(body, registered_at=now, last_seen_at=now)
    except ConvexRequestError as error:
        raise_as_http(error)
    return RegisterInstanceResponse(instance_id=body.instance_id)


@router.patch("/{instance_id}/heartbeat", response_model=HeartbeatResponse)
async def heartbeat(instance_id: str):
    """Keep-alive signal sent every 30 seconds by a running zeroclaw instance."""
    now = datetime.now(timezone.utc).isoformat()
    try:
        payload = await convex_ingest.heartbeat_instance(instance_id, last_seen_at=now)
    except ConvexRequestError as error:
        raise_as_http(error)

    return HeartbeatResponse(last_seen_at=payload["last_seen_at"])


@router.get("", response_model=list[InstanceOut])
async def list_instances():
    """List all registered instances with current metrics."""
    try:
        rows = await convex_reads.list_instances()
    except ConvexRequestError as error:
        raise_as_http(error)
    return [InstanceOut(**row) for row in rows]


@router.get("/{instance_id}", response_model=InstanceOut)
async def get_instance(instance_id: str):
    """Get a single instance by ID."""
    try:
        payload = await convex_reads.get_instance(instance_id)
    except ConvexRequestError as error:
        raise_as_http(error)
    return InstanceOut(**payload)


@router.get("/{instance_id}/usage/weekly", response_model=WeeklyUsage)
async def weekly_usage(instance_id: str):
    """Aggregate token & cost usage over the last 7 days."""
    try:
        payload = await convex_reads.get_weekly_usage(instance_id)
    except ConvexRequestError as error:
        raise_as_http(error)
    return WeeklyUsage(**payload)
