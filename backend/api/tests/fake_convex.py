from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

from slugify import slugify

from app.convex_client import ConvexRequestError


def _round(value: float, digits: int = 6) -> float:
    return round(value, digits)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _step_id(template_id: str, tool_name: str, step_name: str) -> str:
    return f"{template_id}:{slugify(tool_name)}:{slugify(step_name)}"


@dataclass
class FakeConvexStore:
    instances: dict[str, dict[str, Any]] = field(default_factory=dict)
    sessions: dict[str, dict[str, Any]] = field(default_factory=dict)
    tasks: dict[str, dict[str, Any]] = field(default_factory=dict)
    actions: dict[str, dict[str, Any]] = field(default_factory=dict)

    def reset(self) -> None:
        self.instances.clear()
        self.sessions.clear()
        self.tasks.clear()
        self.actions.clear()

    async def request_json(
        self,
        method: str,
        path: str,
        *,
        json: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
    ) -> Any:
        json = json or {}
        params = params or {}

        if path == "/internal/observegraph/instances/register":
            return self._register_instance(json)
        if path == "/internal/observegraph/instances/heartbeat":
            return self._heartbeat_instance(json)
        if path == "/internal/observegraph/instances":
            return self._list_instances()
        if path == "/internal/observegraph/instances/get":
            return self._get_instance(json["instanceId"])
        if path == "/internal/observegraph/instances/weekly-usage/get":
            return self._weekly_usage(json["instanceId"])
        if path == "/internal/observegraph/sessions/create":
            return self._create_session(json)
        if path == "/internal/observegraph/sessions/update":
            return self._update_session(json)
        if path == "/internal/observegraph/sessions/get":
            return self._get_session(json["sessionId"])
        if path == "/internal/observegraph/sessions/cost-breakdown/get":
            return self._session_cost_breakdown(json["sessionId"])
        if path == "/internal/observegraph/tasks/create":
            return self._create_task(json)
        if path == "/internal/observegraph/tasks/update":
            return self._update_task(json)
        if path == "/internal/observegraph/tasks/get":
            return self._get_task(json["taskId"])
        if path == "/internal/observegraph/tasks/actions/get":
            return self._task_actions(json["taskId"])
        if path == "/internal/observegraph/actions/create":
            return self._create_action(json)
        if path == "/internal/observegraph/actions/flag":
            return self._flag_action(json)
        if path == "/internal/observegraph/templates":
            return self._list_templates()
        if path == "/internal/observegraph/templates/get":
            return self._get_template(json["templateId"])
        if path == "/internal/observegraph/templates/dag/get":
            return self._get_template_dag(json["templateId"])
        if path == "/internal/observegraph/analytics/costs":
            return self._analytics_costs(int(params.get("days", 7)))
        raise AssertionError(f"Unhandled fake Convex request: {method} {path}")

    def _register_instance(self, payload: dict[str, Any]) -> dict[str, Any]:
        instance = self.instances.get(payload["instanceId"], {})
        instance.update(
            {
                "instance_id": payload["instanceId"],
                "name": payload["name"],
                "host": payload["host"],
                "port": payload["port"],
                "environment": payload["environment"],
                "os": payload.get("os"),
                "arch": payload.get("arch"),
                "zeroclaw_version": payload.get("zeroclawVersion"),
                "model_default": payload.get("modelDefault"),
                "registered_at": instance.get("registered_at", payload["registeredAt"]),
                "last_seen_at": payload["lastSeenAt"],
                "status": payload["status"],
                "is_pinned": payload["isPinned"],
                "tags": payload["tags"],
            }
        )
        self.instances[payload["instanceId"]] = instance
        return instance

    def _heartbeat_instance(self, payload: dict[str, Any]) -> dict[str, Any]:
        instance = self.instances.get(payload["instanceId"])
        if not instance:
            raise ConvexRequestError(404, "Instance not found")
        instance["last_seen_at"] = payload["lastSeenAt"]
        instance["status"] = "online"
        return {"status": "ok", "last_seen_at": payload["lastSeenAt"]}

    def _instance_session_count(self, instance_id: str) -> int:
        return sum(1 for session in self.sessions.values() if session["instance_id"] == instance_id)

    def _list_instances(self) -> list[dict[str, Any]]:
        rows = []
        for instance in self.instances.values():
            row = dict(instance)
            row["session_count"] = self._instance_session_count(instance["instance_id"])
            rows.append(row)
        return rows

    def _get_instance(self, instance_id: str) -> dict[str, Any]:
        instance = self.instances.get(instance_id)
        if not instance:
            raise ConvexRequestError(404, "Instance not found")
        row = dict(instance)
        row["session_count"] = self._instance_session_count(instance_id)
        return row

    def _weekly_usage(self, instance_id: str) -> dict[str, Any]:
        instance = self.instances.get(instance_id)
        if not instance:
            raise ConvexRequestError(404, "Instance not found")
        threshold = datetime.now(timezone.utc) - timedelta(days=7)
        sessions = [
            session
            for session in self.sessions.values()
            if session["instance_id"] == instance_id
            and datetime.fromisoformat(session["started_at"]) >= threshold
        ]
        tasks = [
            task
            for task in self.tasks.values()
            if task["instance_id"] == instance_id
            and datetime.fromisoformat(task["started_at"]) >= threshold
        ]
        actions = [
            action
            for action in self.actions.values()
            if action["instance_id"] == instance_id
            and datetime.fromisoformat(action["started_at"]) >= threshold
        ]
        return {
            "instance_id": instance_id,
            "instance_name": instance["name"],
            "sessions": len(sessions),
            "tasks": len(tasks),
            "actions": len(actions),
            "total_tokens": sum(action["total_tokens"] for action in actions),
            "total_cost_usd": _round(sum(action["cost_usd"] for action in actions)),
        }

    def _create_session(self, payload: dict[str, Any]) -> dict[str, Any]:
        if payload["instanceId"] not in self.instances:
            raise ConvexRequestError(404, "Instance not found")
        session = {
            "session_id": payload["sessionId"],
            "instance_id": payload["instanceId"],
            "trigger": payload["trigger"],
            "working_dir": payload.get("workingDir"),
            "git_repo": payload.get("gitRepo"),
            "git_branch": payload.get("gitBranch"),
            "git_commit": payload.get("gitCommit"),
            "model_override": payload.get("modelOverride"),
            "started_at": payload["startedAt"],
            "ended_at": payload.get("endedAt"),
            "duration_ms": payload.get("durationMs"),
            "status": payload["status"],
            "total_tokens": payload["totalTokens"],
            "total_cost_usd": payload["totalCostUsd"],
            "task_count": payload["taskCount"],
            "action_count": payload["actionCount"],
            "exit_code": payload.get("exitCode"),
            "notes": payload.get("notes"),
        }
        self.sessions[payload["sessionId"]] = session
        return session

    def _update_session(self, payload: dict[str, Any]) -> dict[str, Any]:
        session = self.sessions.get(payload["sessionId"])
        if not session:
            raise ConvexRequestError(404, "Session not found")
        for key, value in payload.items():
            if key == "sessionId" or value is None:
                continue
            session[self._snake_case(key)] = value
        return session

    def _get_session(self, session_id: str) -> dict[str, Any]:
        session = self.sessions.get(session_id)
        if not session:
            raise ConvexRequestError(404, "Session not found")
        return dict(session)

    def _create_task(self, payload: dict[str, Any]) -> dict[str, Any]:
        if payload["sessionId"] not in self.sessions:
            raise ConvexRequestError(404, "Session not found")
        task = {
            "task_id": payload["taskId"],
            "session_id": payload["sessionId"],
            "instance_id": payload["instanceId"],
            "title": payload["title"],
            "description": payload.get("description"),
            "type": payload["type"],
            "technologies": payload.get("technologies", []),
            "status": payload["status"],
            "priority": payload["priority"],
            "started_at": payload["startedAt"],
            "completed_at": payload.get("completedAt"),
            "duration_ms": payload.get("durationMs"),
            "total_tokens": payload["totalTokens"],
            "thinking_tokens": payload["thinkingTokens"],
            "output_tokens": payload["outputTokens"],
            "total_cost_usd": payload["totalCostUsd"],
            "action_count": payload["actionCount"],
            "is_bookmarked": payload["isBookmarked"],
            "rating": payload.get("rating"),
            "tags": payload.get("tags", []),
            "error": payload.get("error"),
            "template_id": slugify(payload["title"]),
        }
        self.tasks[payload["taskId"]] = task
        self._recompute_session(task["session_id"])
        return task

    def _update_task(self, payload: dict[str, Any]) -> dict[str, Any]:
        task = self.tasks.get(payload["taskId"])
        if not task:
            raise ConvexRequestError(404, "Task not found")
        for key, value in payload.items():
            if key == "taskId" or value is None:
                continue
            task[self._snake_case(key)] = value
        return task

    def _get_task(self, task_id: str) -> dict[str, Any]:
        task = self.tasks.get(task_id)
        if not task:
            raise ConvexRequestError(404, "Task not found")
        row = dict(task)
        row.pop("template_id", None)
        return row

    def _create_action(self, payload: dict[str, Any]) -> dict[str, Any]:
        task = self.tasks.get(payload["taskId"])
        if not task:
            raise ConvexRequestError(404, "Task not found")
        action = {
            "action_id": payload["actionId"],
            "task_id": payload["taskId"],
            "instance_id": payload["instanceId"],
            "sequence": payload["sequence"],
            "step_name": payload["stepName"],
            "type": payload["type"],
            "tool_name": payload["toolName"],
            "command": payload.get("command"),
            "file_path": payload.get("filePath"),
            "file_size_bytes": payload.get("fileSizeBytes"),
            "stdout": payload.get("stdout"),
            "stderr": payload.get("stderr"),
            "exit_code": payload.get("exitCode"),
            "permission_level": payload["permissionLevel"],
            "risk_score": payload["riskScore"],
            "is_flagged": payload["isFlagged"],
            "flag_reason": payload.get("flagReason"),
            "status": payload["status"],
            "started_at": payload["startedAt"],
            "ended_at": payload["endedAt"],
            "duration_ms": payload["durationMs"],
            "reasoning": payload.get("reasoning"),
            "thinking_tokens": payload["thinkingTokens"],
            "output_tokens": payload["outputTokens"],
            "total_tokens": payload["totalTokens"],
            "model_used": payload.get("modelUsed"),
            "cost_usd": payload["costUsd"],
            "retry_count": payload["retryCount"],
            "is_recovery": payload["isRecovery"],
            "step_id": _step_id(task["template_id"], payload["toolName"], payload["stepName"]),
        }
        self.actions[payload["actionId"]] = action
        self._recompute_task(task["task_id"])
        self._recompute_session(task["session_id"])
        return action

    def _flag_action(self, payload: dict[str, Any]) -> dict[str, Any]:
        action = self.actions.get(payload["actionId"])
        if not action:
            raise ConvexRequestError(404, "Action not found")
        action["is_flagged"] = payload["isFlagged"]
        action["flag_reason"] = payload.get("reason")
        return {
            "action_id": action["action_id"],
            "is_flagged": action["is_flagged"],
            "flagged_at": _now_iso() if action["is_flagged"] else None,
        }

    def _task_actions(self, task_id: str) -> list[dict[str, Any]]:
        if task_id not in self.tasks:
            raise ConvexRequestError(404, "Task not found")
        return sorted(
            [dict(action) for action in self.actions.values() if action["task_id"] == task_id],
            key=lambda action: action["sequence"],
        )

    def _session_cost_breakdown(self, session_id: str) -> dict[str, Any]:
        session = self.sessions.get(session_id)
        if not session:
            raise ConvexRequestError(404, "Session not found")
        tasks = [task for task in self.tasks.values() if task["session_id"] == session_id]
        by_task = []
        by_tool: dict[str, dict[str, Any]] = {}
        for task in tasks:
            task_actions = [action for action in self.actions.values() if action["task_id"] == task["task_id"]]
            if not task_actions:
                continue
            by_task.append(
                {
                    "task_id": task["task_id"],
                    "title": task["title"],
                    "cost_usd": _round(sum(action["cost_usd"] for action in task_actions)),
                    "tokens": sum(action["total_tokens"] for action in task_actions),
                }
            )
            for action in task_actions:
                current = by_tool.setdefault(
                    action["tool_name"],
                    {"tool_name": action["tool_name"], "action_count": 0, "cost_usd": 0.0},
                )
                current["action_count"] += 1
                current["cost_usd"] = _round(current["cost_usd"] + action["cost_usd"])
        by_task.sort(key=lambda row: row["cost_usd"], reverse=True)
        by_tool_rows = sorted(by_tool.values(), key=lambda row: row["cost_usd"], reverse=True)
        return {
            "session_id": session_id,
            "total_cost_usd": _round(sum(row["cost_usd"] for row in by_task)),
            "by_task": by_task,
            "by_tool": by_tool_rows,
        }

    def _list_templates(self) -> list[dict[str, Any]]:
        templates = self._templates()
        return sorted(templates, key=lambda row: row["run_count"], reverse=True)

    def _get_template(self, template_id: str) -> dict[str, Any]:
        for template in self._templates():
            if template["template_id"] == template_id:
                return template
        raise ConvexRequestError(404, "Template not found")

    def _get_template_dag(self, template_id: str) -> dict[str, Any]:
        template = self._get_template(template_id)
        nodes: dict[str, dict[str, Any]] = {}
        edges: dict[tuple[str, str], dict[str, Any]] = {}
        template_tasks = [task for task in self.tasks.values() if task["template_id"] == template_id]
        for task in template_tasks:
            actions = sorted(
                [action for action in self.actions.values() if action["task_id"] == task["task_id"]],
                key=lambda row: row["sequence"],
            )
            for action in actions:
                node = nodes.setdefault(
                    action["step_id"],
                    {
                        "step_id": action["step_id"],
                        "fingerprint": action["step_id"].split(":", 1)[1],
                        "tool_name": action["tool_name"],
                        "step_name": action["step_name"],
                        "type": action["type"],
                        "run_count": 0,
                        "success_count": 0,
                        "avg_tokens": 0.0,
                        "avg_latency_ms": 0.0,
                        "avg_cost_usd": 0.0,
                        "is_entry": False,
                        "is_exit": False,
                    },
                )
                node["run_count"] += 1
                node["success_count"] += 1 if action["status"] == "success" else 0
                node["avg_tokens"] += action["total_tokens"]
                node["avg_latency_ms"] += action["duration_ms"]
                node["avg_cost_usd"] += action["cost_usd"]
            for left, right in zip(actions, actions[1:]):
                key = (left["step_id"], right["step_id"])
                edge = edges.setdefault(
                    key,
                    {
                        "from_step_id": left["step_id"],
                        "to_step_id": right["step_id"],
                        "run_count": 0,
                        "avg_tokens": 0.0,
                        "avg_latency_ms": 0.0,
                        "success_count": 0,
                        "run_ids": [],
                    },
                )
                edge["run_count"] += 1
                edge["avg_tokens"] += left["total_tokens"]
                edge["avg_latency_ms"] += left["duration_ms"]
                edge["success_count"] += 1 if left["status"] == "success" and right["status"] == "success" else 0
                if task["task_id"] not in edge["run_ids"]:
                    edge["run_ids"].append(task["task_id"])
        incoming = {edge["to_step_id"] for edge in edges.values()}
        outgoing = {edge["from_step_id"] for edge in edges.values()}
        node_rows = []
        for node in nodes.values():
            run_count = node["run_count"] or 1
            node_rows.append(
                {
                    "step_id": node["step_id"],
                    "fingerprint": node["fingerprint"],
                    "tool_name": node["tool_name"],
                    "step_name": node["step_name"],
                    "type": node["type"],
                    "run_count": node["run_count"],
                    "success_rate": node["success_count"] / run_count,
                    "avg_tokens": node["avg_tokens"] / run_count,
                    "avg_latency_ms": node["avg_latency_ms"] / run_count,
                    "avg_cost_usd": node["avg_cost_usd"] / run_count,
                    "is_entry": node["step_id"] not in incoming,
                    "is_exit": node["step_id"] not in outgoing,
                }
            )
        edge_rows = []
        for edge in edges.values():
            run_count = edge["run_count"] or 1
            edge_rows.append(
                {
                    "from_step_id": edge["from_step_id"],
                    "to_step_id": edge["to_step_id"],
                    "run_count": edge["run_count"],
                    "avg_tokens": edge["avg_tokens"] / run_count,
                    "avg_latency_ms": edge["avg_latency_ms"] / run_count,
                    "success_rate": edge["success_count"] / run_count,
                    "run_ids": edge["run_ids"],
                }
            )
        return {"template": template, "nodes": node_rows, "edges": edge_rows}

    def _analytics_costs(self, days: int) -> dict[str, Any]:
        threshold = datetime.now(timezone.utc) - timedelta(days=days)
        actions = [
            action
            for action in self.actions.values()
            if datetime.fromisoformat(action["started_at"]) >= threshold
        ]
        total_cost = _round(sum(action["cost_usd"] for action in actions))
        total_tokens = sum(action["total_tokens"] for action in actions)
        touched_task_ids = {action["task_id"] for action in actions}
        by_instance: dict[str, dict[str, Any]] = {}
        by_type: dict[str, dict[str, Any]] = {}
        by_tool: dict[str, dict[str, Any]] = {}
        hourly: dict[str, dict[str, Any]] = {}
        for action in actions:
            instance = self.instances[action["instance_id"]]
            task = self.tasks[action["task_id"]]
            inst_row = by_instance.setdefault(
                instance["instance_id"],
                {
                    "instance_id": instance["instance_id"],
                    "instance_name": instance["name"],
                    "cost_usd": 0.0,
                },
            )
            inst_row["cost_usd"] = _round(inst_row["cost_usd"] + action["cost_usd"])
            type_row = by_type.setdefault(task["type"], {"type": task["type"], "cost_usd": 0.0})
            type_row["cost_usd"] = _round(type_row["cost_usd"] + action["cost_usd"])
            tool_row = by_tool.setdefault(
                action["tool_name"],
                {"tool_name": action["tool_name"], "action_count": 0, "cost_usd": 0.0},
            )
            tool_row["action_count"] += 1
            tool_row["cost_usd"] = _round(tool_row["cost_usd"] + action["cost_usd"])
            hour_bucket = action["started_at"][:13] + ":00:00+00:00"
            hour_row = hourly.setdefault(
                hour_bucket, {"hour": hour_bucket, "cost_usd": 0.0, "action_count": 0}
            )
            hour_row["cost_usd"] = _round(hour_row["cost_usd"] + action["cost_usd"])
            hour_row["action_count"] += 1
        return {
            "period_days": days,
            "total_cost_usd": total_cost,
            "total_tokens": total_tokens,
            "total_tasks": len(touched_task_ids),
            "by_instance": [
                {**row, "percentage": (row["cost_usd"] / total_cost * 100) if total_cost else 0.0}
                for row in sorted(by_instance.values(), key=lambda item: item["cost_usd"], reverse=True)
            ],
            "by_task_type": [
                {**row, "percentage": (row["cost_usd"] / total_cost * 100) if total_cost else 0.0}
                for row in sorted(by_type.values(), key=lambda item: item["cost_usd"], reverse=True)
            ],
            "by_tool": [
                {**row, "percentage": (row["cost_usd"] / total_cost * 100) if total_cost else 0.0}
                for row in sorted(by_tool.values(), key=lambda item: item["cost_usd"], reverse=True)
            ],
            "hourly_trend": sorted(hourly.values(), key=lambda row: row["hour"]),
        }

    def _recompute_task(self, task_id: str) -> None:
        task = self.tasks[task_id]
        task_actions = [action for action in self.actions.values() if action["task_id"] == task_id]
        task["action_count"] = len(task_actions)
        task["total_tokens"] = sum(action["total_tokens"] for action in task_actions)
        task["total_cost_usd"] = _round(sum(action["cost_usd"] for action in task_actions))

    def _recompute_session(self, session_id: str) -> None:
        session = self.sessions[session_id]
        tasks = [task for task in self.tasks.values() if task["session_id"] == session_id]
        session["task_count"] = len(tasks)
        session["action_count"] = sum(task["action_count"] for task in tasks)
        session["total_tokens"] = sum(task["total_tokens"] for task in tasks)
        session["total_cost_usd"] = _round(sum(task["total_cost_usd"] for task in tasks))

    def _templates(self) -> list[dict[str, Any]]:
        templates: list[dict[str, Any]] = []
        grouped: dict[str, list[dict[str, Any]]] = {}
        for task in self.tasks.values():
            grouped.setdefault(task["template_id"], []).append(task)
        for template_id, tasks in grouped.items():
            run_count = len(tasks)
            completed = sum(1 for task in tasks if task["status"] == "completed")
            templates.append(
                {
                    "template_id": template_id,
                    "title": tasks[0]["title"],
                    "fingerprint": template_id,
                    "type": tasks[0]["type"],
                    "technologies": sorted(
                        {technology for task in tasks for technology in task["technologies"]}
                    ),
                    "created_at": tasks[0]["started_at"],
                    "run_count": run_count,
                    "success_rate": completed / run_count if run_count else 0.0,
                    "avg_tokens": sum(task["total_tokens"] for task in tasks) / run_count if run_count else 0.0,
                    "avg_duration_ms": sum(task["duration_ms"] or 0 for task in tasks) / run_count
                    if run_count
                    else 0.0,
                    "best_run_id": None,
                    "tags": sorted({tag for task in tasks for tag in task["tags"]}),
                }
            )
        return templates

    def _snake_case(self, camel_name: str) -> str:
        result = []
        for character in camel_name:
            if character.isupper():
                result.append("_")
                result.append(character.lower())
            else:
                result.append(character)
        return "".join(result)
