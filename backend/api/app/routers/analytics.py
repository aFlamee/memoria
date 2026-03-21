from fastapi import APIRouter, Query

from app.convex_client import ConvexRequestError
from app.models.analytics import (
    CostAnalyticsResponse,
    CostByInstance,
    CostByTaskType,
    CostByTool,
    HourlySpend,
)
from app.router_utils import raise_as_http
from app.services import convex_reads

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/costs", response_model=CostAnalyticsResponse)
async def cost_analytics(days: int = Query(default=7, ge=1, le=90)):
    """
    Cost breakdown across all instances for the last N days.
    Includes breakdowns by instance, task type, tool, and hourly trend.
    """
    try:
        payload = await convex_reads.get_cost_analytics(days)
    except ConvexRequestError as error:
        raise_as_http(error)

    return CostAnalyticsResponse(
        period_days=payload["period_days"],
        total_cost_usd=payload["total_cost_usd"],
        total_tokens=payload["total_tokens"],
        total_tasks=payload["total_tasks"],
        by_instance=[CostByInstance(**row) for row in payload["by_instance"]],
        by_task_type=[CostByTaskType(**row) for row in payload["by_task_type"]],
        by_tool=[CostByTool(**row) for row in payload["by_tool"]],
        hourly_trend=[HourlySpend(**row) for row in payload["hourly_trend"]],
    )
