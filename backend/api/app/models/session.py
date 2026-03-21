from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field


SessionStatus = Literal["running", "completed", "failed", "killed"]
SessionTrigger = Literal["cli", "api", "scheduled", "webhook"]


class CreateSessionRequest(BaseModel):
    session_id: str = Field(..., examples=["sess_20260321_001"])
    instance_id: str = Field(..., examples=["inst_heilbronn_dev"])
    trigger: SessionTrigger = "cli"
    working_dir: str | None = None
    git_repo: str | None = None
    git_branch: str | None = None
    git_commit: str | None = None
    model_override: str | None = None
    started_at: datetime | None = None
    notes: str | None = None


class UpdateSessionRequest(BaseModel):
    status: SessionStatus | None = None
    ended_at: datetime | None = None
    duration_ms: int | None = None
    total_tokens: int | None = None
    total_cost_usd: float | None = None
    task_count: int | None = None
    action_count: int | None = None
    exit_code: int | None = None
    notes: str | None = None


class CreateSessionResponse(BaseModel):
    session_id: str
    status: str = "recorded"


class SessionOut(BaseModel):
    session_id: str
    instance_id: str
    trigger: SessionTrigger
    working_dir: str | None
    git_repo: str | None
    git_branch: str | None
    git_commit: str | None
    model_override: str | None
    started_at: datetime
    ended_at: datetime | None
    duration_ms: int | None
    status: SessionStatus
    total_tokens: int
    total_cost_usd: float
    task_count: int
    action_count: int
    exit_code: int | None
    notes: str | None


class CostByTask(BaseModel):
    task_id: str
    title: str
    cost_usd: float
    tokens: int


class CostByTool(BaseModel):
    tool_name: str
    action_count: int
    cost_usd: float


class SessionCostBreakdown(BaseModel):
    session_id: str
    total_cost_usd: float
    by_task: list[CostByTask]
    by_tool: list[CostByTool]
