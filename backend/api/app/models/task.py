from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field


TaskStatus = Literal["in_progress", "completed", "failed"]
TaskType = Literal["code", "research", "file_ops", "shell", "browser", "data"]
TaskPriority = Literal["low", "medium", "high"]


class CreateTaskRequest(BaseModel):
    task_id: str = Field(..., examples=["task_obs_001"])
    session_id: str
    instance_id: str
    title: str = Field(..., examples=["Create observer crate in zeroclaw"])
    description: str | None = None
    type: TaskType = "code"
    technologies: list[str] = Field(default_factory=list)
    status: TaskStatus = "in_progress"
    priority: TaskPriority = "medium"
    started_at: datetime | None = None
    completed_at: datetime | None = None
    duration_ms: int | None = None
    total_tokens: int = 0
    thinking_tokens: int = 0
    output_tokens: int = 0
    total_cost_usd: float = 0.0
    action_count: int = 0
    tags: list[str] = Field(default_factory=list)
    error: str | None = None


class UpdateTaskRequest(BaseModel):
    status: TaskStatus | None = None
    completed_at: datetime | None = None
    duration_ms: int | None = None
    total_tokens: int | None = None
    thinking_tokens: int | None = None
    output_tokens: int | None = None
    total_cost_usd: float | None = None
    action_count: int | None = None
    is_bookmarked: bool | None = None
    rating: int | None = Field(None, ge=1, le=5)
    error: str | None = None


class CreateTaskResponse(BaseModel):
    task_id: str
    template_id: str
    status: str = "recorded"


class TaskOut(BaseModel):
    task_id: str
    session_id: str
    instance_id: str
    title: str
    description: str | None
    type: TaskType
    technologies: list[str]
    status: TaskStatus
    priority: TaskPriority
    started_at: datetime
    completed_at: datetime | None
    duration_ms: int | None
    total_tokens: int
    thinking_tokens: int
    output_tokens: int
    total_cost_usd: float
    action_count: int
    is_bookmarked: bool
    rating: int | None
    tags: list[str]
    error: str | None
