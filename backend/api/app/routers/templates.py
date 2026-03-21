from fastapi import APIRouter

from app.convex_client import ConvexRequestError
from app.models.analytics import DAGResponse, StepEdgeOut, StepNodeOut, TaskTemplateOut
from app.router_utils import raise_as_http
from app.services import convex_reads

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("", response_model=list[TaskTemplateOut])
async def list_templates():
    """List all task templates ordered by run count."""
    try:
        payload = await convex_reads.list_templates()
    except ConvexRequestError as error:
        raise_as_http(error)
    return [TaskTemplateOut(**row) for row in payload]


@router.get("/{template_id}", response_model=TaskTemplateOut)
async def get_template(template_id: str):
    try:
        payload = await convex_reads.get_template(template_id)
    except ConvexRequestError as error:
        raise_as_http(error)
    return TaskTemplateOut(**payload)


@router.get("/{template_id}/dag", response_model=DAGResponse)
async def get_dag(template_id: str):
    """
    Return the full merged DAG for a task template.
    Nodes = StepNodes, Edges = STEP_SEQUENCE relationships with run metrics.
    """
    try:
        payload = await convex_reads.get_template_dag(template_id)
    except ConvexRequestError as error:
        raise_as_http(error)

    return DAGResponse(
        template=TaskTemplateOut(**payload["template"]),
        nodes=[StepNodeOut(**row) for row in payload["nodes"]],
        edges=[StepEdgeOut(**row) for row in payload["edges"]],
    )
