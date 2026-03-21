"""
Integration tests for the full action recording flow:
  instance → session → task → actions → DAG
"""
import pytest
from datetime import datetime, timezone

NOW = datetime.now(timezone.utc).isoformat()


async def _seed(client):
    """Create instance + session + task for action tests."""
    await client.post("/instances", json={
        "instance_id": "act_test_inst",
        "name": "action-test-server",
        "host": "10.0.0.1",
        "port": 3000,
        "environment": "development",
    })
    await client.post("/sessions", json={
        "session_id": "act_test_sess",
        "instance_id": "act_test_inst",
        "trigger": "cli",
        "started_at": NOW,
    })
    resp = await client.post("/tasks", json={
        "task_id": "act_test_task",
        "session_id": "act_test_sess",
        "instance_id": "act_test_inst",
        "title": "Build Observer Crate",
        "type": "code",
        "started_at": NOW,
    })
    return resp


@pytest.mark.asyncio
async def test_full_flow(client, clean_db):
    seed = await _seed(client)
    assert seed.status_code == 201
    data = seed.json()
    assert "template_id" in data
    assert data["template_id"] == "build-observer-crate"

    # Record action 1
    r1 = await client.post("/actions", json={
        "action_id": "act_001",
        "task_id": "act_test_task",
        "instance_id": "act_test_inst",
        "type": "file_read",
        "tool_name": "read_file",
        "file_path": "/project/Cargo.toml",
        "permission_level": "read",
        "status": "success",
        "started_at": NOW,
        "ended_at": NOW,
        "duration_ms": 12,
        "sequence": 1,
        "step_name": "read project manifest",
        "reasoning": "Need to understand crate structure",
        "total_tokens": 225,
        "cost_usd": 0.0047,
    })
    assert r1.status_code == 201
    assert r1.json()["risk_score"] < 0.5  # read = low risk
    assert r1.json()["risk_flagged"] is False

    # Record action 2
    r2 = await client.post("/actions", json={
        "action_id": "act_002",
        "task_id": "act_test_task",
        "instance_id": "act_test_inst",
        "type": "shell",
        "tool_name": "bash",
        "command": "cargo build --release",
        "permission_level": "write",
        "status": "success",
        "started_at": NOW,
        "ended_at": NOW,
        "duration_ms": 4300,
        "sequence": 2,
        "step_name": "build crate",
        "total_tokens": 620,
        "cost_usd": 0.013,
    })
    assert r2.status_code == 201

    # Verify actions are retrievable in order
    actions = await client.get("/tasks/act_test_task/actions")
    assert actions.status_code == 200
    body = actions.json()
    assert len(body) == 2
    assert body[0]["action_id"] == "act_001"
    assert body[1]["action_id"] == "act_002"
    assert body[0]["sequence"] == 1


@pytest.mark.asyncio
async def test_dangerous_action_auto_flagged(client, clean_db):
    await _seed(client)
    resp = await client.post("/actions", json={
        "action_id": "act_danger",
        "task_id": "act_test_task",
        "instance_id": "act_test_inst",
        "type": "shell",
        "tool_name": "sudo",
        "command": "sudo rm -rf /tmp/test",
        "permission_level": "dangerous",
        "status": "success",
        "started_at": NOW,
        "ended_at": NOW,
        "duration_ms": 100,
        "sequence": 1,
        "step_name": "dangerous cleanup",
        "total_tokens": 50,
        "cost_usd": 0.001,
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["risk_score"] >= 0.7
    assert data["risk_flagged"] is True


@pytest.mark.asyncio
async def test_flag_action_manually(client, clean_db):
    await _seed(client)
    await client.post("/actions", json={
        "action_id": "act_to_flag",
        "task_id": "act_test_task",
        "instance_id": "act_test_inst",
        "type": "file_write",
        "tool_name": "write_file",
        "permission_level": "write",
        "status": "success",
        "started_at": NOW,
        "ended_at": NOW,
        "duration_ms": 50,
        "sequence": 1,
        "step_name": "write config",
        "total_tokens": 100,
        "cost_usd": 0.002,
    })
    resp = await client.patch("/actions/act_to_flag/mark", json={
        "is_flagged": True,
        "reason": "Suspicious write to config",
    })
    assert resp.status_code == 200
    assert resp.json()["is_flagged"] is True


@pytest.mark.asyncio
async def test_dag_built_after_actions(client, clean_db):
    await _seed(client)
    for i, (tool, step, perm) in enumerate([
        ("read_file", "read manifest", "read"),
        ("bash", "compile", "write"),
        ("bash", "run tests", "write"),
    ], start=1):
        await client.post("/actions", json={
            "action_id": f"dag_act_{i}",
            "task_id": "act_test_task",
            "instance_id": "act_test_inst",
            "type": "shell" if tool == "bash" else "file_read",
            "tool_name": tool,
            "permission_level": perm,
            "status": "success",
            "started_at": NOW,
            "ended_at": NOW,
            "duration_ms": 100,
            "sequence": i,
            "step_name": step,
            "total_tokens": 200,
            "cost_usd": 0.004,
        })

    dag = await client.get("/templates/build-observer-crate/dag")
    assert dag.status_code == 200
    body = dag.json()
    assert len(body["nodes"]) > 0
    assert len(body["edges"]) > 0
