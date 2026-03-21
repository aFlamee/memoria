from fastapi import APIRouter, Query
from app.database import get_driver
from app.models.analytics import (
    CostAnalyticsResponse,
    CostByInstance,
    CostByTaskType,
    CostByTool,
    HourlySpend,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/costs", response_model=CostAnalyticsResponse)
async def cost_analytics(days: int = Query(default=7, ge=1, le=90)):
    """
    Cost breakdown across all instances for the last N days.
    Includes breakdowns by instance, task type, tool, and hourly trend.
    """
    driver = get_driver()
    period = f"P{days}D"

    async with driver.session() as session:
        # Total cost + tokens + tasks
        totals_result = await session.run(
            f"""
            MATCH (t:Task)-[r:PERFORMED]->(a:Action)
            WHERE r.timestamp > datetime() - duration('{period}')
            RETURN
                count(DISTINCT t) AS total_tasks,
                coalesce(sum(r.total_tokens), 0) AS total_tokens,
                coalesce(sum(r.cost_usd), 0)     AS total_cost_usd
            """
        )
        totals = await totals_result.single()
        total_cost = totals["total_cost_usd"] or 0.0
        total_tokens = totals["total_tokens"] or 0
        total_tasks = totals["total_tasks"] or 0

        # By instance
        inst_result = await session.run(
            f"""
            MATCH (i:Instance)-[:HAS_SESSION]->()-[:HAS_TASK]->(t:Task)-[r:PERFORMED]->()
            WHERE r.timestamp > datetime() - duration('{period}')
            RETURN i.instance_id AS instance_id, i.name AS instance_name,
                   coalesce(sum(r.cost_usd), 0) AS cost_usd
            ORDER BY cost_usd DESC
            """
        )
        inst_rows = await inst_result.data()

        # By task type
        type_result = await session.run(
            f"""
            MATCH (t:Task)-[r:PERFORMED]->()
            WHERE r.timestamp > datetime() - duration('{period}')
            RETURN t.type AS type, coalesce(sum(r.cost_usd), 0) AS cost_usd
            ORDER BY cost_usd DESC
            """
        )
        type_rows = await type_result.data()

        # By tool
        tool_result = await session.run(
            f"""
            MATCH (t:Task)-[r:PERFORMED]->(a:Action)
            WHERE r.timestamp > datetime() - duration('{period}')
            RETURN a.tool_name AS tool_name,
                   count(a) AS action_count,
                   coalesce(sum(r.cost_usd), 0) AS cost_usd
            ORDER BY cost_usd DESC
            """
        )
        tool_rows = await tool_result.data()

        # Hourly trend
        hourly_result = await session.run(
            f"""
            MATCH (t:Task)-[r:PERFORMED]->(a:Action)
            WHERE r.timestamp > datetime() - duration('{period}')
            RETURN
                toString(datetime({{
                    year:   r.timestamp.year,
                    month:  r.timestamp.month,
                    day:    r.timestamp.day,
                    hour:   r.timestamp.hour
                }})) AS hour,
                coalesce(sum(r.cost_usd), 0) AS cost_usd,
                count(a)                      AS action_count
            ORDER BY hour ASC
            """
        )
        hourly_rows = await hourly_result.data()

    def pct(val: float) -> float:
        return round((val / total_cost * 100) if total_cost > 0 else 0.0, 2)

    return CostAnalyticsResponse(
        period_days=days,
        total_cost_usd=round(total_cost, 6),
        total_tokens=total_tokens,
        total_tasks=total_tasks,
        by_instance=[
            CostByInstance(
                instance_id=r["instance_id"],
                instance_name=r["instance_name"],
                cost_usd=round(r["cost_usd"], 6),
                percentage=pct(r["cost_usd"]),
            )
            for r in inst_rows
        ],
        by_task_type=[
            CostByTaskType(
                type=r["type"],
                cost_usd=round(r["cost_usd"], 6),
                percentage=pct(r["cost_usd"]),
            )
            for r in type_rows
        ],
        by_tool=[
            CostByTool(
                tool_name=r["tool_name"],
                action_count=r["action_count"],
                cost_usd=round(r["cost_usd"], 6),
                percentage=pct(r["cost_usd"]),
            )
            for r in tool_rows
        ],
        hourly_trend=[
            HourlySpend(
                hour=r["hour"],
                cost_usd=round(r["cost_usd"], 6),
                action_count=r["action_count"],
            )
            for r in hourly_rows
        ],
    )
