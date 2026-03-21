import pytest


@pytest.mark.asyncio
async def test_register_instance(client, clean_db):
    resp = await client.post("/instances", json={
        "instance_id": "test_inst_001",
        "name": "test-server",
        "host": "127.0.0.1",
        "port": 3000,
        "environment": "development",
        "tags": ["test"],
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["instance_id"] == "test_inst_001"
    assert data["status"] == "registered"


@pytest.mark.asyncio
async def test_register_instance_is_idempotent(client, clean_db):
    payload = {
        "instance_id": "test_inst_002",
        "name": "idempotent-server",
        "host": "127.0.0.2",
        "port": 3001,
        "environment": "staging",
    }
    r1 = await client.post("/instances", json=payload)
    r2 = await client.post("/instances", json=payload)
    assert r1.status_code == 201
    assert r2.status_code == 201


@pytest.mark.asyncio
async def test_heartbeat(client, clean_db):
    await client.post("/instances", json={
        "instance_id": "test_inst_hb",
        "name": "hb-server",
        "host": "127.0.0.3",
        "port": 3002,
        "environment": "development",
    })
    resp = await client.patch("/instances/test_inst_hb/heartbeat")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_heartbeat_unknown_instance(client):
    resp = await client.patch("/instances/does_not_exist/heartbeat")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_instances(client, clean_db):
    await client.post("/instances", json={
        "instance_id": "test_list_inst",
        "name": "list-server",
        "host": "127.0.0.4",
        "port": 3003,
        "environment": "production",
    })
    resp = await client.get("/instances")
    assert resp.status_code == 200
    ids = [i["instance_id"] for i in resp.json()]
    assert "test_list_inst" in ids


@pytest.mark.asyncio
async def test_get_instance(client, clean_db):
    await client.post("/instances", json={
        "instance_id": "test_get_inst",
        "name": "get-server",
        "host": "127.0.0.5",
        "port": 3004,
        "environment": "development",
    })
    resp = await client.get("/instances/test_get_inst")
    assert resp.status_code == 200
    assert resp.json()["instance_id"] == "test_get_inst"


@pytest.mark.asyncio
async def test_get_instance_not_found(client):
    resp = await client.get("/instances/nonexistent")
    assert resp.status_code == 404
