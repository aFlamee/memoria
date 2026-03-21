export type InstanceStatus = 'online' | 'offline' | 'idle';

export type InstanceSummary = {
	instanceId: string;
	slug: string;
	name: string;
	status: InstanceStatus;
	environment: string;
	modelDefault: string;
	host: string;
	lastSeenAt: string;
	lastSeenLabel: string;
	runningTasks: number;
	completedToday: number;
	sessionCount7d: number;
	taskCount7d: number;
	actionCount7d: number;
	totalTokens7d: number;
	totalTokens7dLabel: string;
	totalCostUsd7d: number;
	totalCostUsd7dLabel: string;
	tags: string[];
};

export type DashboardData = {
	generatedAt: string;
	instances: InstanceSummary[];
};

export type SessionSummary = {
	sessionId: string;
	trigger: string;
	status: string;
	startedAt: string;
	durationMs: number;
	totalTokens: number;
	totalTokensLabel: string;
	totalCostUsd: number;
	totalCostUsdLabel: string;
	taskCount: number;
	actionCount: number;
	gitBranch: string;
	notes: string | null;
	taskTitles: string[];
};

export type TemplateSummary = {
	templateId: string;
	title: string;
	runCount: number;
	successRate: number;
	avgTokens: number;
	avgTokensLabel: string;
	avgDurationMs: number;
	type: string;
	tags: string[];
};

export type GraphNodePayload = {
	id: string;
	label: string;
	actionId: string;
	toolName: string;
	type: string;
	status: string;
	durationMs: number;
	totalTokens: number;
	riskScore: number;
	permissionLevel: string;
	tone: 'entry' | 'exit' | 'risk' | 'write' | 'core';
};

export type GraphEdgePayload = {
	id: string;
	source: string;
	target: string;
	label: string;
	sourceLabel: string;
	targetLabel: string;
	traversalCount: number;
	successRate: number;
	totalTokens: number;
	avgLatencyMs: number;
};

export type TaskGraphPayload = {
	taskId: string;
	title: string;
	status: string;
	durationMs: number;
	totalTokens: number;
	totalTokensLabel: string;
	totalCostUsd: number;
	totalCostUsdLabel: string;
	actionCount: number;
	nodes: GraphNodePayload[];
	edges: GraphEdgePayload[];
};

export type SessionDetail = SessionSummary & {
	tasks: TaskGraphPayload[];
};

export type InstanceProfile = {
	instanceId: string;
	slug: string;
	name: string;
	status: InstanceStatus;
	environment: string;
	modelDefault: string;
	host: string;
	os: string;
	arch: string;
	zeroclawVersion: string;
	lastSeenAt: string;
	lastSeenLabel: string;
	totalTokens7dLabel: string;
	totalCostUsd7dLabel: string;
	metrics: {
		sessionCount7d: number;
		taskCount7d: number;
		actionCount7d: number;
		completedToday: number;
		runningTasks: number;
		totalTokens7d: number;
		totalCostUsd7d: number;
	};
	tags: string[];
};

export type AgentOverview = {
	instance: InstanceProfile;
	sessions: SessionSummary[];
};

export type AgentSessionDetail = {
	instance: InstanceProfile;
	session: SessionDetail;
};
