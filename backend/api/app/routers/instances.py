from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from app.database import get_driver
from app.config import settings
from app.models.instance import (
    RegisterInstanceRequest,
    RegisterInstanceResponse,
    HeartbeatResponse,
    InstanceOut,
    WeeklyUsage,
)

router = APIRouter(prefix="/instances", tags=["instances"])


@router.post("", response_model=RegisterInstanceResponse, status_code=201)
async def register_instance(body: RegisterInstanceRequest):
    """Register or update a zeroclaw instance. Called on agent boot."""
    driver = get_driver()
    async with driver.session() as session:
        await session.run(
            """
            MATCH (u:User {user_id: $user_id})
            MERGE (i:Instance {instance_id: $instance_id})
            ON CREATE SET
                i.name              = $name,
                i.host              = $host,
                i.port              = $port,
                i.environment       = $environment,
                i.os                = $os,
                i.arch              = $arch,
                i.zeroclaw_version  = $zeroclaw_version,
                i.model_default     = $model_default,
                i.tags              = $tags,
                i.is_pinned         = $is_pinned,
                i.registered_at     = datetime(),
                i.last_seen_at      = datetime(),
                i.status            = 'online'
            ON MATCH SET
                i.name              = $name,
                i.host              = $host,
                i.port              = $port,
                i.environment       = $environment,
                i.zeroclaw_version  = $zeroclaw_version,
                i.model_default     = $model_default,
                i.tags              = $tags,
                i.last_seen_at      = datetime(),
                i.status            = 'online'
            MERGE (u)-[:OWNS {since: datetime()}]->(i)
            """,
            user_id=settings.memoria_user_id,
            instance_id=body.instance_id,
            name=body.name,
            host=body.host,
            port=body.port,
            environment=body.environment,
            os=body.os,
            arch=body.arch,
            zeroclaw_version=body.zeroclaw_version,
            model_default=body.model_default,
            tags=body.tags,
            is_pinned=body.is_pinned,
        )
    return RegisterInstanceResponse(instance_id=body.instance_id)


@router.patch("/{instance_id}/heartbeat", response_model=HeartbeatResponse)
async def heartbeat(instance_id: str):
    """Keep-alive signal sent every 30 seconds by a running zeroclaw instance."""
    driver = get_driver()
    async with driver.session() as session:
        result = await session.run(
            """
            MATCH (i:Instance {instance_id: $instance_id})
            SET i.last_seen_at = datetime(), i.status = 'online'
            RETURN i.last_seen_at AS last_seen_at
            """,
            instance_id=instance_id,
        )
        record = await result.single()
        if not record:
            raise HTTPException(status_code=404, detail="Instance not found")
    return HeartbeatResponse(last_seen_at=datetime.now(timezone.utc))


@router.get("", response_model=list[InstanceOut])
async def list_instances():
    """List all registered instances with current metrics."""
    driver = get_driver()
    async with driver.session() as session:
        result = await session.run(
            """
            MATCH (u:User {user_id: $user_id})-[:OWNS]->(i:Instance)
            OPTIONAL MATCH (i)-[:HAS_SESSION]->(s:Session)
            RETURN i, count(s) AS session_count
            ORDER BY i.is_pinned DESC, i.last_seen_at DESC
            """,
            user_id=settings.memoria_user_id,
        )
        rows = await result.data()

    instances = []
    for row in rows:
        i = row["i"]
        instances.append(
            InstanceOut(
                instance_id=i["instance_id"],
                name=i["name"],
                host=i["host"],
                port=i["port"],
                environment=i["environment"],
                os=i.get("os"),
                arch=i.get("arch"),
                zeroclaw_version=i.get("zeroclaw_version"),
                model_default=i.get("model_default"),
                registered_at=i["registered_at"],
                last_seen_at=i.get("last_seen_at"),
                status=i["status"],
                is_pinned=i.get("is_pinned", False),
                tags=i.get("tags", []),
                session_count=row["session_count"],
            )
        )
    return instances


@router.get("/{instance_id}", response_model=InstanceOut)
async def get_instance(instance_id: str):
    """Get a single instance by ID."""
    driver = get_driver()
    async with driver.session() as session:
        result = await session.run(
            """
            MATCH (i:Instance {instance_id: $instance_id})
            OPTIONAL MATCH (i)-[:HAS_SESSION]->(s:Session)
            RETURN i, count(s) AS session_count
            """,
            instance_id=instance_id,
        )
        row = await result.single()
        if not row:
            raise HTTPException(status_code=404, detail="Instance not found")
        i = row["i"]
    return InstanceOut(
        instance_id=i["instance_id"],
        name=i["name"],
        host=i["host"],
        port=i["port"],
        environment=i["environment"],
        os=i.get("os"),
        arch=i.get("arch"),
        zeroclaw_version=i.get("zeroclaw_version"),
        model_default=i.get("model_default"),
        registered_at=i["registered_at"],
        last_seen_at=i.get("last_seen_at"),
        status=i["status"],
        is_pinned=i.get("is_pinned", False),
        tags=i.get("tags", []),
        session_count=row["session_count"],
    )


@router.get("/{instance_id}/usage/weekly", response_model=WeeklyUsage)
async def weekly_usage(instance_id: str):
    """Aggregate token & cost usage over the last 7 days."""
    driver = get_driver()
    async with driver.session() as session:
        result = await session.run(
            """
            MATCH (i:Instance {instance_id: $instance_id})
            OPTIONAL MATCH (i)-[:HAS_SESSION]->(s:Session)
            WHERE s.started_at > datetime() - duration('P7D')
            OPTIONAL MATCH (s)-[:HAS_TASK]->(t:Task)
            OPTIONAL MATCH (t)-[r:PERFORMED]->(a:Action)
            WHERE r.timestamp > datetime() - duration('P7D')
            RETURN
                i.instance_id                AS instance_id,
                i.name                       AS instance_name,
                count(DISTINCT s)            AS sessions,
                count(DISTINCT t)            AS tasks,
                count(DISTINCT a)            AS actions,
                coalesce(sum(r.total_tokens), 0) AS total_tokens,
                coalesce(sum(r.cost_usd), 0)     AS total_cost_usd
            """,
            instance_id=instance_id,
        )
        row = await result.single()
        if not row or row["instance_id"] is None:
            raise HTTPException(status_code=404, detail="Instance not found")

    return WeeklyUsage(
        instance_id=row["instance_id"],
        instance_name=row["instance_name"],
        sessions=row["sessions"],
        tasks=row["tasks"],
        actions=row["actions"],
        total_tokens=row["total_tokens"],
        total_cost_usd=row["total_cost_usd"],
    )
