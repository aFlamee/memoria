import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services import convex_ingest, convex_reads
from tests.fake_convex import FakeConvexStore


@pytest_asyncio.fixture
async def fake_convex(monkeypatch):
    store = FakeConvexStore()

    async def request_json(method, path, *, json=None, params=None):
        return await store.request_json(method, path, json=json, params=params)

    monkeypatch.setattr(convex_ingest, "request_json", request_json)
    monkeypatch.setattr(convex_reads, "request_json", request_json)
    return store


@pytest_asyncio.fixture
async def client(fake_convex):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def clean_db(fake_convex):
    yield
    fake_convex.reset()
