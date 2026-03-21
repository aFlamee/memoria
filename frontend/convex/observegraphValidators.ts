import { v } from 'convex/values';

const nullableString = v.union(v.string(), v.null());
const nullableNumber = v.union(v.number(), v.null());

export const instanceStatusValidator = v.union(
	v.literal('online'),
	v.literal('offline'),
	v.literal('idle')
);

export const environmentValidator = v.union(
	v.literal('development'),
	v.literal('production'),
	v.literal('staging')
);

export const sessionStatusValidator = v.union(
	v.literal('running'),
	v.literal('completed'),
	v.literal('failed'),
	v.literal('killed')
);

export const taskStatusValidator = v.union(
	v.literal('in_progress'),
	v.literal('completed'),
	v.literal('failed')
);

export const taskPriorityValidator = v.union(
	v.literal('low'),
	v.literal('medium'),
	v.literal('high')
);

export const taskTypeValidator = v.union(
	v.literal('code'),
	v.literal('research'),
	v.literal('file_ops'),
	v.literal('shell'),
	v.literal('browser'),
	v.literal('data'),
	v.literal('ui'),
	v.literal('analysis'),
	v.literal('backend')
);

export const actionTypeValidator = v.union(
	v.literal('file_read'),
	v.literal('file_write'),
	v.literal('shell'),
	v.literal('llm_call'),
	v.literal('http'),
	v.literal('tool_use')
);

export const permissionLevelValidator = v.union(
	v.literal('read'),
	v.literal('write'),
	v.literal('admin'),
	v.literal('dangerous')
);

export const actionStatusValidator = v.union(
	v.literal('success'),
	v.literal('failed'),
	v.literal('skipped')
);

export const metricsValidator = v.object({
	sessionCount7d: v.number(),
	taskCount7d: v.number(),
	actionCount7d: v.number(),
	completedToday: v.number(),
	runningTasks: v.number(),
	totalTokens7d: v.number(),
	totalCostUsd7d: v.number()
});

export const instanceValidator = v.object({
	instanceId: v.string(),
	slug: v.string(),
	name: v.string(),
	host: v.string(),
	port: v.number(),
	environment: environmentValidator,
	os: nullableString,
	arch: nullableString,
	zeroclawVersion: nullableString,
	modelDefault: nullableString,
	registeredAt: v.string(),
	lastSeenAt: nullableString,
	status: instanceStatusValidator,
	isPinned: v.boolean(),
	tags: v.array(v.string()),
	sessionCount: v.number(),
	metrics: metricsValidator
});

export const sessionValidator = v.object({
	sessionId: v.string(),
	instanceId: v.string(),
	trigger: v.string(),
	workingDir: nullableString,
	gitRepo: nullableString,
	gitBranch: nullableString,
	gitCommit: nullableString,
	modelOverride: nullableString,
	startedAt: v.string(),
	endedAt: nullableString,
	durationMs: nullableNumber,
	status: sessionStatusValidator,
	totalTokens: v.number(),
	totalCostUsd: v.number(),
	taskCount: v.number(),
	actionCount: v.number(),
	exitCode: nullableNumber,
	notes: nullableString
});

export const taskValidator = v.object({
	taskId: v.string(),
	sessionId: v.string(),
	instanceId: v.string(),
	templateId: v.string(),
	runId: v.string(),
	title: v.string(),
	description: nullableString,
	type: taskTypeValidator,
	technologies: v.array(v.string()),
	status: taskStatusValidator,
	priority: taskPriorityValidator,
	startedAt: v.string(),
	completedAt: nullableString,
	durationMs: nullableNumber,
	totalTokens: v.number(),
	thinkingTokens: v.number(),
	outputTokens: v.number(),
	totalCostUsd: v.number(),
	actionCount: v.number(),
	isBookmarked: v.boolean(),
	rating: nullableNumber,
	tags: v.array(v.string()),
	error: nullableString,
	lastActionAt: v.string()
});

export const actionValidator = v.object({
	actionId: v.string(),
	taskId: v.string(),
	instanceId: v.string(),
	runId: v.string(),
	stepId: v.string(),
	sequence: v.number(),
	stepName: v.string(),
	type: actionTypeValidator,
	toolName: v.string(),
	command: nullableString,
	filePath: nullableString,
	fileSizeBytes: nullableNumber,
	stdout: nullableString,
	stderr: nullableString,
	exitCode: nullableNumber,
	permissionLevel: permissionLevelValidator,
	riskScore: v.number(),
	isFlagged: v.boolean(),
	flagReason: nullableString,
	status: actionStatusValidator,
	startedAt: v.string(),
	endedAt: v.string(),
	durationMs: v.number(),
	reasoning: nullableString,
	thinkingTokens: v.number(),
	outputTokens: v.number(),
	totalTokens: v.number(),
	modelUsed: nullableString,
	latencyMs: nullableNumber,
	costUsd: v.number(),
	retryCount: v.number(),
	isRecovery: v.boolean()
});

export const taskTemplateValidator = v.object({
	templateId: v.string(),
	title: v.string(),
	fingerprint: v.string(),
	type: taskTypeValidator,
	technologies: v.array(v.string()),
	createdAt: v.string(),
	runCount: v.number(),
	successRate: v.number(),
	avgTokens: v.number(),
	avgDurationMs: v.number(),
	bestRunId: nullableString,
	tags: v.array(v.string())
});

export const stepNodeValidator = v.object({
	stepId: v.string(),
	templateId: v.string(),
	fingerprint: v.string(),
	toolName: v.string(),
	stepName: v.string(),
	type: actionTypeValidator,
	runCount: v.number(),
	successRate: v.number(),
	avgTokens: v.number(),
	avgLatencyMs: v.number(),
	avgCostUsd: v.number(),
	isEntry: v.boolean(),
	isExit: v.boolean()
});

export const stepEdgeValidator = v.object({
	edgeId: v.string(),
	templateId: v.string(),
	fromStepId: v.string(),
	toStepId: v.string(),
	runCount: v.number(),
	runIds: v.array(v.string()),
	avgTokens: v.number(),
	avgLatencyMs: v.number(),
	successRate: v.number()
});

export const costByTaskValidator = v.object({
	taskId: v.string(),
	title: v.string(),
	costUsd: v.number(),
	tokens: v.number()
});

export const costByToolValidator = v.object({
	toolName: v.string(),
	actionCount: v.number(),
	costUsd: v.number()
});

export const sessionCostBreakdownValidator = v.object({
	sessionId: v.string(),
	totalCostUsd: v.number(),
	byTask: v.array(costByTaskValidator),
	byTool: v.array(costByToolValidator),
	updatedAt: v.string()
});

export const instanceWeeklyUsageValidator = v.object({
	instanceId: v.string(),
	instanceName: v.string(),
	sessions: v.number(),
	tasks: v.number(),
	actions: v.number(),
	totalTokens: v.number(),
	totalCostUsd: v.number(),
	updatedAt: v.string()
});

export const analyticsByInstanceEntryValidator = v.object({
	instanceId: v.string(),
	instanceName: v.string(),
	costUsd: v.number()
});

export const analyticsByTaskTypeEntryValidator = v.object({
	type: v.string(),
	costUsd: v.number()
});

export const analyticsByToolEntryValidator = v.object({
	toolName: v.string(),
	actionCount: v.number(),
	costUsd: v.number()
});

export const analyticsHourlyValidator = v.object({
	hourBucket: v.string(),
	totalCostUsd: v.number(),
	totalTokens: v.number(),
	actionCount: v.number(),
	byInstance: v.array(analyticsByInstanceEntryValidator),
	byTaskType: v.array(analyticsByTaskTypeEntryValidator),
	byTool: v.array(analyticsByToolEntryValidator),
	updatedAt: v.string()
});

export const seedPayloadValidator = v.object({
	meta: v.object({
		seed: v.number(),
		generatedAt: v.string(),
		totalTaskRuns: v.number(),
		totalInstances: v.number()
	}),
	instances: v.array(instanceValidator),
	sessions: v.array(sessionValidator),
	tasks: v.array(taskValidator),
	actions: v.array(actionValidator),
	taskTemplates: v.array(taskTemplateValidator),
	stepNodes: v.array(stepNodeValidator),
	stepEdges: v.array(stepEdgeValidator)
});

export const instanceArrayValidator = v.array(instanceValidator);
export const sessionArrayValidator = v.array(sessionValidator);
export const taskArrayValidator = v.array(taskValidator);
export const actionArrayValidator = v.array(actionValidator);
export const taskTemplateArrayValidator = v.array(taskTemplateValidator);
export const stepNodeArrayValidator = v.array(stepNodeValidator);
export const stepEdgeArrayValidator = v.array(stepEdgeValidator);
