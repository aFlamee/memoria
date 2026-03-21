"""
Test configuration.

Tests run against a REAL Neo4j instance — set env vars before running:

    NEO4J_URI=bolt://localhost:7687
    NEO4J_USER=neo4j
    NEO4J_PASSWORD=your_password

Each test module cleans up after itself using the helper below.
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.database import init_driver, close_driver, ensure_schema, get_driver


@pytest_asyncio.fixture(scope="session")
async def setup_db():
    """Boot the driver + schema once per test session. Opt-in — not auto-used."""
    await init_driver()
    await ensure_schema()
    yield
    await close_driver()


@pytest_asyncio.fixture
async def client(setup_db):
    """HTTPX async client wired directly to the FastAPI app (no network). Requires DB."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def clean_db(setup_db):
    """
    Yield, then delete ALL nodes/rels created during the test.
    Use this fixture in tests that mutate the DB.
    """
    yield
    driver = get_driver()
    async with driver.session() as session:
        # Delete everything except the root User node
        await session.run(
            """
            MATCH (n)
            WHERE NOT (n:User AND n.user_id = 'meet')
            DETACH DELETE n
            """
        )
