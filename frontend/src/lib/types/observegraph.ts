export type InstanceStatus = 'online' | 'offline' | 'idle';

export type InstanceSummary = {
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
	toolName: string;
	runCount: number;
	successRate: number;
	avgTokens: number;
	avgLatencyMs: number;
	tone: 'entry' | 'exit' | 'risk' | 'core';
};

export type GraphEdgePayload = {
	id: string;
	source: string;
	target: string;
	runCount: number;
	successRate: number;
	avgTokens: number;
	avgLatencyMs: number;
};

export type TaskGraphPayload = {
	templateId: string;
	title: string;
	fingerprint: string;
	runCount: number;
	successRate: number;
	nodes: GraphNodePayload[];
	edges: GraphEdgePayload[];
};

export type AuditActionRow = {
	actionId: string;
	sequence: number;
	stepName: string;
	type: string;
	toolName: string;
	status: string;
	durationMs: number;
	reasoning: string;
	permissionLevel: string;
	riskScore: number;
	isFlagged: boolean;
	command: string | null;
	filePath: string | null;
	stdout: string;
	stderr: string | null;
	totalTokens: number;
	costUsd: number;
	isRecovery: boolean;
};

export type AuditTrail = {
	taskId: string;
	title: string;
	status: string;
	totalTokens: number;
	totalTokensLabel: string;
	totalCostUsd: number;
	totalCostUsdLabel: string;
	durationMs: number;
	actions: AuditActionRow[];
};

export type InstanceDetail = {
	instance: {
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
	sessions: SessionSummary[];
	templates: TemplateSummary[];
	primaryGraph: TaskGraphPayload | null;
	auditTrail: AuditTrail | null;
};

