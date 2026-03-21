from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field


ActionType = Literal["file_read", "file_write", "shell", "llm_call", "http", "tool_use"]
PermissionLevel = Literal["read", "write", "admin", "dangerous"]
ActionStatus = Literal["success", "failed", "skipped"]


class RecordActionRequest(BaseModel):
    action_id: str = Field(..., examples=["act_001"])
    task_id: str
    instance_id: str
    # Action node fields
    type: ActionType
    tool_name: str = Field(..., examples=["bash"])
    command: str | None = None
    file_path: str | None = None
    file_size_bytes: int | None = None
    stdout: str | None = None
    stderr: str | None = None
    exit_code: int | None = None
    permission_level: PermissionLevel = "read"
    status: ActionStatus = "success"
    started_at: datetime
    ended_at: datetime
    duration_ms: int = 0
    # PERFORMED edge fields (execution context)
    sequence: int = Field(..., description="Step order within the task", examples=[1])
    step_name: str = Field(..., description="Human-readable name for this step", examples=["read project manifest"])
    reasoning: str | None = Field(None, description="AI reasoning for choosing this step")
    thinking_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    model_used: str | None = None
    latency_ms: int | None = None
    cost_usd: float = 0.0
    retry_count: int = 0
    is_recovery: bool = False


class FlagActionRequest(BaseModel):
    is_flagged: bool
    reason: str | None = None


class RecordActionResponse(BaseModel):
    action_id: str
    risk_score: float
    risk_flagged: bool  # True when risk_score >= 0.7


class FlagActionResponse(BaseModel):
    action_id: str
    is_flagged: bool
    flagged_at: datetime | None


class ActionOut(BaseModel):
    action_id: str
    task_id: str
    instance_id: str
    type: ActionType
    tool_name: str
    command: str | None
    file_path: str | None
    file_size_bytes: int | None
    stdout: str | None
    stderr: str | None
    exit_code: int | None
    permission_level: PermissionLevel
    risk_score: float
    is_flagged: bool
    flag_reason: str | None
    status: ActionStatus
    started_at: datetime
    ended_at: datetime
    duration_ms: int
    # From PERFORMED edge
    sequence: int | None
    step_name: str | None
    reasoning: str | None
    thinking_tokens: int
    output_tokens: int
    total_tokens: int
    model_used: str | None
    cost_usd: float
    retry_count: int
    is_recovery: bool
