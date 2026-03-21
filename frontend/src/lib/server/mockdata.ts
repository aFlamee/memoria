import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { DashboardData, InstanceDetail } from '$lib/types/observegraph';

type Metrics = {
	sessionCount7d: number;
	taskCount7d: number;
	actionCount7d: number;
	completedToday: number;
	runningTasks: number;
	totalTokens7d: number;
	totalCostUsd7d: number;
};

type InstanceRecord = {
	instanceId: string;
	slug: string;
	name: string;
	status: 'online' | 'offline' | 'idle';
	environment: string;
	modelDefault: string;
	host: string;
	os: string;
	arch: string;
	zeroclawVersion: string;
	lastSeenAt: string;
	isPinned: boolean;
	tags: string[];
	metrics: Metrics;
};

type SessionRecord = {
	sessionId: string;
	instanceId: string;
	trigger: string;
	status: string;
	startedAt: string;
	durationMs: number;
	totalTokens: number;
	totalCostUsd: number;
	taskCount: number;
	actionCount: number;
	gitBranch: string;
};

type TaskRecord = {
	taskId: string;
	sessionId: string;
	instanceId: string;
	templateId: string;
	title: string;
	status: string;
	totalTokens: number;
	totalCostUsd: number;
	durationMs: number;
};

type ActionRecord = {
	actionId: string;
	taskId: string;
	runId: string;
	stepId: string;
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

type TemplateRecord = {
	templateId: string;
	title: string;
	fingerprint: string;
	runCount: number;
	successRate: number;
	avgTokens: number;
	avgDurationMs: number;
	type: string;
	tags: string[];
};

type StepNodeRecord = {
	stepId: string;
	templateId: string;
	stepName: string;
	toolName: string;
	runCount: number;
	successRate: number;
	avgTokens: number;
	avgLatencyMs: number;
	isEntry: boolean;
	isExit: boolean;
};

type StepEdgeRecord = {
	edgeId: string;
	templateId: string;
	fromStepId: string;
	toStepId: string;
	runCount: number;
	successRate: number;
	avgTokens: number;
	avgLatencyMs: number;
};

type MockDataset = {
	instances: InstanceRecord[];
	sessions: SessionRecord[];
	tasks: TaskRecord[];
	actions: ActionRecord[];
	taskTemplates: TemplateRecord[];
	stepNodes: StepNodeRecord[];
	stepEdges: StepEdgeRecord[];
};

const mockdataDir = path.resolve(process.cwd(), 'mockdata');

function formatRelativeTime(isoString: string) {
	const deltaMs = Date.now() - new Date(isoString).getTime();
	const minutes = Math.max(1, Math.floor(deltaMs / 60000));
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	return `${Math.floor(hours / 24)}d ago`;
}

function currency(value: number) {
	return `$${value.toFixed(2)}`;
}

function compactTokens(value: number) {
	if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
	if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
	return `${value}`;
}

async function readJsonFile<T>(filename: string): Promise<T> {
	const source = await readFile(path.join(mockdataDir, filename), 'utf8');
	return JSON.parse(source) as T;
}

async function loadMockDataset(): Promise<MockDataset> {
	const [instances, sessions, tasks, actions, taskTemplates, stepNodes, stepEdges] = await Promise.all([
		readJsonFile<InstanceRecord[]>('instances.json'),
		readJsonFile<SessionRecord[]>('sessions.json'),
		readJsonFile<TaskRecord[]>('tasks.json'),
		readJsonFile<ActionRecord[]>('actions.json'),
		readJsonFile<TemplateRecord[]>('taskTemplates.json'),
		readJsonFile<StepNodeRecord[]>('stepNodes.json'),
		readJsonFile<StepEdgeRecord[]>('stepEdges.json')
	]);

	return { instances, sessions, tasks, actions, taskTemplates, stepNodes, stepEdges };
}

export async function getMockDashboardData(): Promise<DashboardData> {
	const dataset = await loadMockDataset();
	const ordered = [...dataset.instances].sort((left, right) => {
		if (left.isPinned !== right.isPinned) return left.isPinned ? -1 : 1;
		return new Date(right.lastSeenAt).getTime() - new Date(left.lastSeenAt).getTime();
	});

	return {
		generatedAt: new Date().toISOString(),
		instances: ordered.map((instance) => ({
			slug: instance.slug,
			name: instance.name,
			status: instance.status,
			environment: instance.environment,
			modelDefault: instance.modelDefault,
			host: instance.host,
			lastSeenAt: instance.lastSeenAt,
			lastSeenLabel: formatRelativeTime(instance.lastSeenAt),
			runningTasks: instance.metrics.runningTasks,
			completedToday: instance.metrics.completedToday,
			sessionCount7d: instance.metrics.sessionCount7d,
			taskCount7d: instance.metrics.taskCount7d,
			actionCount7d: instance.metrics.actionCount7d,
			totalTokens7d: instance.metrics.totalTokens7d,
			totalTokens7dLabel: compactTokens(instance.metrics.totalTokens7d),
			totalCostUsd7d: instance.metrics.totalCostUsd7d,
			totalCostUsd7dLabel: currency(instance.metrics.totalCostUsd7d),
			tags: instance.tags
		}))
	};
}

export async function getMockInstanceDetail(slug: string): Promise<InstanceDetail | null> {
	const dataset = await loadMockDataset();
	const instance = dataset.instances.find((entry) => entry.slug === slug);
	if (!instance) {
		return null;
	}

	const sessions = dataset.sessions
		.filter((entry) => entry.instanceId === instance.instanceId)
		.sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime())
		.slice(0, 8);

	const tasks = dataset.tasks
		.filter((entry) => entry.instanceId === instance.instanceId)
		.sort((left, right) => {
			const rightTime = new Date(right.durationMs ? right.durationMs : 0).getTime();
			const leftTime = new Date(left.durationMs ? left.durationMs : 0).getTime();
			return rightTime - leftTime;
		});

	const recentTasks = [...dataset.tasks]
		.filter((entry) => entry.instanceId === instance.instanceId)
		.sort((left, right) => {
			const leftStarted = dataset.sessions.find((session) => session.sessionId === left.sessionId)?.startedAt ?? '';
			const rightStarted = dataset.sessions.find((session) => session.sessionId === right.sessionId)?.startedAt ?? '';
			return new Date(rightStarted).getTime() - new Date(leftStarted).getTime();
		})
		.slice(0, 24);

	const templateCounts = new Map<string, number>();
	for (const task of recentTasks) {
		templateCounts.set(task.templateId, (templateCounts.get(task.templateId) ?? 0) + 1);
	}

	const templates = [...templateCounts.entries()]
		.sort((left, right) => right[1] - left[1])
		.map(([templateId]) => dataset.taskTemplates.find((entry) => entry.templateId === templateId))
		.filter((entry): entry is TemplateRecord => Boolean(entry))
		.slice(0, 4);

	const primaryTemplate = templates[0] ?? null;
	const latestTask = recentTasks[0] ?? null;
	const auditActions = latestTask
		? dataset.actions
				.filter((entry) => entry.taskId === latestTask.taskId)
				.sort((left, right) => left.sequence - right.sequence)
				.slice(0, 20)
		: [];

	const graphNodes = primaryTemplate
		? dataset.stepNodes
				.filter((entry) => entry.templateId === primaryTemplate.templateId)
				.sort((left, right) => right.runCount - left.runCount)
				.slice(0, 40)
		: [];
	const graphEdges = primaryTemplate
		? dataset.stepEdges
				.filter((entry) => entry.templateId === primaryTemplate.templateId)
				.sort((left, right) => right.runCount - left.runCount)
				.slice(0, 40)
		: [];

	return {
		instance: {
			slug: instance.slug,
			name: instance.name,
			status: instance.status,
			environment: instance.environment,
			modelDefault: instance.modelDefault,
			host: instance.host,
			os: instance.os,
			arch: instance.arch,
			zeroclawVersion: instance.zeroclawVersion,
			lastSeenAt: instance.lastSeenAt,
			lastSeenLabel: formatRelativeTime(instance.lastSeenAt),
			totalTokens7dLabel: compactTokens(instance.metrics.totalTokens7d),
			totalCostUsd7dLabel: currency(instance.metrics.totalCostUsd7d),
			metrics: instance.metrics,
			tags: instance.tags
		},
		sessions: sessions.map((session) => ({
			sessionId: session.sessionId,
			trigger: session.trigger,
			status: session.status,
			startedAt: session.startedAt,
			durationMs: session.durationMs,
			totalTokens: session.totalTokens,
			totalTokensLabel: compactTokens(session.totalTokens),
			totalCostUsd: session.totalCostUsd,
			totalCostUsdLabel: currency(session.totalCostUsd),
			taskCount: session.taskCount,
			actionCount: session.actionCount,
			gitBranch: session.gitBranch
		})),
		templates: templates.map((template) => ({
			templateId: template.templateId,
			title: template.title,
			runCount: template.runCount,
			successRate: template.successRate,
			avgTokens: template.avgTokens,
			avgTokensLabel: compactTokens(template.avgTokens),
			avgDurationMs: template.avgDurationMs,
			type: template.type,
			tags: template.tags
		})),
		primaryGraph: primaryTemplate
			? {
					templateId: primaryTemplate.templateId,
					title: primaryTemplate.title,
					fingerprint: primaryTemplate.fingerprint,
					runCount: primaryTemplate.runCount,
					successRate: primaryTemplate.successRate,
					nodes: graphNodes.map((node) => ({
						id: node.stepId,
						label: node.stepName,
						toolName: node.toolName,
						runCount: node.runCount,
						successRate: node.successRate,
						avgTokens: node.avgTokens,
						avgLatencyMs: node.avgLatencyMs,
						tone: node.isEntry ? 'entry' : node.isExit ? 'exit' : node.successRate < 0.7 ? 'risk' : 'core'
					})),
					edges: graphEdges.map((edge) => ({
						id: edge.edgeId,
						source: edge.fromStepId,
						target: edge.toStepId,
						runCount: edge.runCount,
						successRate: edge.successRate,
						avgTokens: edge.avgTokens,
						avgLatencyMs: edge.avgLatencyMs
					}))
				}
			: null,
		auditTrail: latestTask
			? {
					taskId: latestTask.taskId,
					title: latestTask.title,
					status: latestTask.status,
					totalTokens: latestTask.totalTokens,
					totalTokensLabel: compactTokens(latestTask.totalTokens),
					totalCostUsd: latestTask.totalCostUsd,
					totalCostUsdLabel: currency(latestTask.totalCostUsd),
					durationMs: latestTask.durationMs,
					actions: auditActions.map((action) => ({
						actionId: action.actionId,
						sequence: action.sequence,
						stepName: action.stepName,
						type: action.type,
						toolName: action.toolName,
						status: action.status,
						durationMs: action.durationMs,
						reasoning: action.reasoning,
						permissionLevel: action.permissionLevel,
						riskScore: action.riskScore,
						isFlagged: action.isFlagged,
						command: action.command,
						filePath: action.filePath,
						stdout: action.stdout,
						stderr: action.stderr,
						totalTokens: action.totalTokens,
						costUsd: action.costUsd,
						isRecovery: action.isRecovery
					}))
				}
			: null
	};
}
