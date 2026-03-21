from pydantic import BaseModel


class CostByInstance(BaseModel):
    instance_id: str
    instance_name: str
    cost_usd: float
    percentage: float


class CostByTaskType(BaseModel):
    type: str
    cost_usd: float
    percentage: float


class CostByTool(BaseModel):
    tool_name: str
    action_count: int
    cost_usd: float
    percentage: float


class HourlySpend(BaseModel):
    hour: str  # ISO 8601 hour bucket e.g. "2026-03-21T14:00:00"
    cost_usd: float
    action_count: int


class CostAnalyticsResponse(BaseModel):
    period_days: int
    total_cost_usd: float
    total_tokens: int
    total_tasks: int
    by_instance: list[CostByInstance]
    by_task_type: list[CostByTaskType]
    by_tool: list[CostByTool]
    hourly_trend: list[HourlySpend]


class StepNodeOut(BaseModel):
    step_id: str
    fingerprint: str
    tool_name: str
    step_name: str
    type: str
    run_count: int
    success_rate: float
    avg_tokens: float
    avg_latency_ms: float
    avg_cost_usd: float
    is_entry: bool
    is_exit: bool


class StepEdgeOut(BaseModel):
    from_step_id: str
    to_step_id: str
    run_count: int
    avg_tokens: float
    avg_latency_ms: float
    success_rate: float
    run_ids: list[str]


class TaskTemplateOut(BaseModel):
    template_id: str
    title: str
    fingerprint: str
    type: str
    technologies: list[str]
    created_at: str
    run_count: int
    success_rate: float
    avg_tokens: float
    avg_duration_ms: float
    best_run_id: str | None
    tags: list[str]


class DAGResponse(BaseModel):
    template: TaskTemplateOut
    nodes: list[StepNodeOut]
    edges: list[StepEdgeOut]
