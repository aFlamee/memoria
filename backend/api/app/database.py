from contextlib import asynccontextmanager
from neo4j import AsyncGraphDatabase, AsyncDriver
from app.config import settings

_driver: AsyncDriver | None = None


def get_driver() -> AsyncDriver:
    if _driver is None:
        raise RuntimeError("Database driver not initialised. Call init_driver() first.")
    return _driver


async def init_driver() -> None:
    global _driver
    _driver = AsyncGraphDatabase.driver(
        settings.neo4j_uri,
        auth=(settings.neo4j_user, settings.neo4j_password),
    )
    await _driver.verify_connectivity()


async def close_driver() -> None:
    global _driver
    if _driver:
        await _driver.close()
        _driver = None


async def ensure_schema() -> None:
    """Create constraints, indexes and root User node on first boot."""
    driver = get_driver()
    async with driver.session() as session:
        statements = [
            # Uniqueness constraints
            "CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.user_id IS UNIQUE",
            "CREATE CONSTRAINT instance_id IF NOT EXISTS FOR (i:Instance) REQUIRE i.instance_id IS UNIQUE",
            "CREATE CONSTRAINT session_id IF NOT EXISTS FOR (s:Session) REQUIRE s.session_id IS UNIQUE",
            "CREATE CONSTRAINT task_id IF NOT EXISTS FOR (t:Task) REQUIRE t.task_id IS UNIQUE",
            "CREATE CONSTRAINT action_id IF NOT EXISTS FOR (a:Action) REQUIRE a.action_id IS UNIQUE",
            "CREATE CONSTRAINT template_id IF NOT EXISTS FOR (tmpl:TaskTemplate) REQUIRE tmpl.template_id IS UNIQUE",
            "CREATE CONSTRAINT step_fingerprint IF NOT EXISTS FOR (sn:StepNode) REQUIRE (sn.fingerprint, sn.template_id) IS UNIQUE",
            # Indexes for high-frequency filters
            "CREATE INDEX action_permission IF NOT EXISTS FOR (a:Action) ON (a.permission_level)",
            "CREATE INDEX action_is_flagged IF NOT EXISTS FOR (a:Action) ON (a.is_flagged)",
            "CREATE INDEX action_status IF NOT EXISTS FOR (a:Action) ON (a.status)",
            "CREATE INDEX task_status IF NOT EXISTS FOR (t:Task) ON (t.status)",
            "CREATE INDEX task_type IF NOT EXISTS FOR (t:Task) ON (t.type)",
            "CREATE INDEX session_status IF NOT EXISTS FOR (s:Session) ON (s.status)",
            "CREATE INDEX instance_status IF NOT EXISTS FOR (i:Instance) ON (i.status)",
        ]
        for stmt in statements:
            await session.run(stmt)

        # Root User node (single-user system)
        await session.run(
            """
            MERGE (u:User {user_id: $user_id})
            ON CREATE SET
                u.name       = $name,
                u.created_at = datetime()
            """,
            user_id=settings.memoria_user_id,
            name=settings.memoria_user_name,
        )
