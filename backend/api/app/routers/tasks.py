from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from slugify import slugify

from app.convex_client import ConvexRequestError
from app.models.action import ActionOut
from app.models.task import CreateTaskRequest, CreateTaskResponse, TaskOut, UpdateTaskRequest
from app.router_utils import raise_as_http
from app.services import convex_ingest, convex_reads

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _template_id(title: str) -> str:
    return slugify(title)


@router.post("", response_model=CreateTaskResponse, status_code=201)
async def create_task(body: CreateTaskRequest):
    """
    Record a new task (or a running task).
    Automatically creates/increments the matching TaskTemplate and links via RUN_OF.
    """
    started_at = body.started_at or datetime.now(timezone.utc)
    template_id = _template_id(body.title)
    try:
        await convex_ingest.create_task(body, started_at=started_at.isoformat())
    except ConvexRequestError as error:
        raise_as_http(error)
    return CreateTaskResponse(task_id=body.task_id, template_id=template_id)


@router.patch("/{task_id}", response_model=CreateTaskResponse)
async def update_task(task_id: str, body: UpdateTaskRequest):
    """Update a task — used to mark completion, add bookmark/rating."""
    if not any(
        (
            body.status is not None,
            body.completed_at is not None,
            body.duration_ms is not None,
            body.total_tokens is not None,
            body.thinking_tokens is not None,
            body.output_tokens is not None,
            body.total_cost_usd is not None,
            body.action_count is not None,
            body.is_bookmarked is not None,
            body.rating is not None,
            body.error is not None,
        )
    ):
        raise HTTPException(status_code=422, detail="No fields to update")

    try:
        task = await convex_reads.get_task(task_id)
        await convex_ingest.update_task(task_id, body)
    except ConvexRequestError as error:
        raise_as_http(error)
    return CreateTaskResponse(task_id=task_id, template_id=_template_id(task["title"]))


@router.get("/{task_id}", response_model=TaskOut)
async def get_task(task_id: str):
    try:
        payload = await convex_reads.get_task(task_id)
    except ConvexRequestError as error:
        raise_as_http(error)
    return TaskOut(**payload)


@router.get("/{task_id}/actions", response_model=list[ActionOut])
async def get_task_actions(task_id: str):
    """Return all actions for a task ordered by their execution sequence."""
    try:
        payload = await convex_reads.get_task_actions(task_id)
    except ConvexRequestError as error:
        raise_as_http(error)
    return [ActionOut(**row) for row in payload]
