from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field


InstanceStatus = Literal["online", "offline", "idle"]
Environment = Literal["development", "production", "staging"]


class RegisterInstanceRequest(BaseModel):
    instance_id: str = Field(..., examples=["inst_heilbronn_dev"])
    name: str = Field(..., examples=["heilbronn-dev"])
    host: str = Field(..., examples=["192.168.1.10"])
    port: int = Field(..., examples=[3000])
    environment: Environment = "development"
    os: str | None = Field(None, examples=["ubuntu-24.04"])
    arch: str | None = Field(None, examples=["x86_64"])
    zeroclaw_version: str | None = Field(None, examples=["0.4.2"])
    model_default: str | None = Field(None, examples=["claude-3-7-sonnet"])
    tags: list[str] = Field(default_factory=list)
    is_pinned: bool = False


class RegisterInstanceResponse(BaseModel):
    instance_id: str
    status: str = "registered"


class HeartbeatResponse(BaseModel):
    status: str = "ok"
    last_seen_at: datetime


class InstanceOut(BaseModel):
    instance_id: str
    name: str
    host: str
    port: int
    environment: Environment
    os: str | None
    arch: str | None
    zeroclaw_version: str | None
    model_default: str | None
    registered_at: datetime
    last_seen_at: datetime | None
    status: InstanceStatus
    is_pinned: bool
    tags: list[str]
    session_count: int = 0


class WeeklyUsage(BaseModel):
    instance_id: str
    instance_name: str
    sessions: int
    tasks: int
    actions: int
    total_tokens: int
    total_cost_usd: float
