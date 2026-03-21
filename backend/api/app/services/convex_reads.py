from __future__ import annotations

from app.convex_client import request_json


async def list_instances():
    return await request_json("GET", "/internal/observegraph/instances")


async def get_instance(instance_id: str):
    return await request_json(
        "POST",
        "/internal/observegraph/instances/get",
        json={"instanceId": instance_id},
    )


async def get_weekly_usage(instance_id: str):
    return await request_json(
        "POST",
        "/internal/observegraph/instances/weekly-usage/get",
        json={"instanceId": instance_id},
    )


async def get_session(session_id: str):
    return await request_json(
        "POST",
        "/internal/observegraph/sessions/get",
        json={"sessionId": session_id},
    )


async def get_session_cost_breakdown(session_id: str):
    return await request_json(
        "POST",
        "/internal/observegraph/sessions/cost-breakdown/get",
        json={"sessionId": session_id},
    )


async def get_task(task_id: str):
    return await request_json(
        "POST",
        "/internal/observegraph/tasks/get",
        json={"taskId": task_id},
    )


async def get_task_actions(task_id: str):
    return await request_json(
        "POST",
        "/internal/observegraph/tasks/actions/get",
        json={"taskId": task_id},
    )


async def list_templates():
    return await request_json("GET", "/internal/observegraph/templates")


async def get_template(template_id: str):
    return await request_json(
        "POST",
        "/internal/observegraph/templates/get",
        json={"templateId": template_id},
    )


async def get_template_dag(template_id: str):
    return await request_json(
        "POST",
        "/internal/observegraph/templates/dag/get",
        json={"templateId": template_id},
    )


async def get_cost_analytics(days: int):
    return await request_json(
        "GET",
        "/internal/observegraph/analytics/costs",
        params={"days": days},
    )
