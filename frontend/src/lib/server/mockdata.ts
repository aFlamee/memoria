import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type {
	AgentOverview,
	AgentSessionDetail,
	DashboardData,
	GraphNodePayload
} from '$lib/types/observegraph';

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
	notes: string | null;
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
	instanceId: string;
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
	startedAt: string;
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

function normalizeWhitespace(value: string) {
	return value.replace(/\s+/g, ' ').trim();
}

function truncateText(value: string, maxLength: number) {
	const normalized = normalizeWhitespace(value);
	if (normalized.length <= maxLength) {
		return normalized;
	}

	return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function sessionShortId(sessionId: string) {
	return sessionId.length <= 8 ? sessionId.toUpperCase() : sessionId.slice(0, 8).toUpperCase();
}

function formatTriggerLabel(trigger: string) {
	return normalizeWhitespace(trigger).toUpperCase();
}

function hourBucket(isoString: string) {
	const date = new Date(isoString);
	date.setUTCMinutes(0, 0, 0);
	return date.toISOString();
}

function buildRecentHourBuckets(hours: number) {
	const now = new Date();
	now.setUTCMinutes(0, 0, 0);
	now.setUTCHours(now.getUTCHours() - Math.max(0, hours - 1));

	return Array.from({ length: hours }, (_, index) => {
		const bucket = new Date(now);
		bucket.setUTCHours(now.getUTCHours() + index);
		return bucket.toISOString();
	});
}

function buildInstanceSparkline(instanceId: string, actions: ActionRecord[]) {
	const hourBuckets = buildRecentHourBuckets(7 * 24);
	const totals = new Map<string, number>();

	for (const action of actions) {
		if (action.instanceId !== instanceId) {
			continue;
		}

		const bucket = hourBucket(action.startedAt);
		totals.set(bucket, Number(((totals.get(bucket) ?? 0) + action.costUsd).toFixed(6)));
	}

	return hourBuckets.map((hour) => ({
		hour,
		costUsd: totals.get(hour) ?? 0
	}));
}

async function readJsonFile<T>(filename: string): Promise<T> {
	const source = await readFile(path.join(mockdataDir, filename), 'utf8');
	return JSON.parse(source) as T;
}

async function loadMockDataset(): Promise<MockDataset> {
	const [instances, sessions, tasks, actions, taskTemplates, stepNodes, stepEdges] =
		await Promise.all([
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

function mapInstanceProfile(instance: InstanceRecord) {
	return {
		instanceId: instance.instanceId,
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
	};
}

function buildSessionDisplayName(taskTitles: string[], notes: string | null, sessionId: string) {
	const primaryTask = taskTitles
		.map((title) => normalizeWhitespace(title))
		.find((title) => title.length > 0);
	if (primaryTask) {
		return truncateText(primaryTask, 72);
	}

	const note = normalizeWhitespace(notes ?? '');
	if (note.length > 0) {
		return truncateText(note, 72);
	}

	return `Session ${sessionShortId(sessionId)}`;
}

function buildSessionSubtitle(session: SessionRecord) {
	const parts = [
		formatTriggerLabel(session.trigger),
		formatRelativeTime(session.startedAt),
		normalizeWhitespace(session.gitBranch)
	].filter((value) => value.length > 0);

	return parts.length > 0 ? parts.join(' · ') : null;
}

function buildTaskPreview(taskTitles: string[], displayName: string) {
	const displayKey = normalizeWhitespace(displayName).toLowerCase();
	const seen = new Set<string>();
	const preview: string[] = [];

	for (const title of taskTitles) {
		const normalized = normalizeWhitespace(title);
		if (!normalized) {
			continue;
		}

		const key = normalized.toLowerCase();
		if (key === displayKey || seen.has(key)) {
			continue;
		}

		seen.add(key);
		preview.push(truncateText(normalized, 56));

		if (preview.length === 2) {
			break;
		}
	}

	return preview;
}

function mapSessionSummary(session: SessionRecord, sessionTasks: TaskRecord[]) {
	const taskTitles = sessionTasks.slice(0, 3).map((task) => task.title);
	const displayName = buildSessionDisplayName(taskTitles, session.notes, session.sessionId);

	return {
		sessionId: session.sessionId,
		sessionShortId: sessionShortId(session.sessionId),
		displayName,
		displaySubtitle: buildSessionSubtitle(session),
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
		gitBranch: session.gitBranch,
		notes: session.notes,
		taskTitles,
		taskPreview: buildTaskPreview(taskTitles, displayName)
	};
}

function mapActionTone(action: ActionRecord): GraphNodePayload['tone'] {
	if (action.sequence === 1) return 'entry';
	if (action.isRecovery) return 'exit';
	if (action.status !== 'success' || action.riskScore >= 0.2) return 'risk';
	if (action.type === 'file_write' || action.type === 'shell') return 'write';
	return 'core';
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
			instanceId: instance.instanceId,
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
			sparkline: buildInstanceSparkline(instance.instanceId, dataset.actions),
			tags: instance.tags
		}))
	};
}

export async function getMockInstanceOverview(slug: string): Promise<AgentOverview | null> {
	const dataset = await loadMockDataset();
	const instance = dataset.instances.find((entry) => entry.slug === slug);
	if (!instance) {
		return null;
	}

	const sessions = dataset.sessions
		.filter((entry) => entry.instanceId === instance.instanceId)
		.sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime())
		.slice(0, 8);

	return {
		instance: mapInstanceProfile(instance),
		sessions: sessions.map((session) =>
			mapSessionSummary(
				session,
				dataset.tasks.filter((task) => task.sessionId === session.sessionId)
			)
		)
	};
}

export async function getMockSessionDetail(
	slug: string,
	sessionId: string
): Promise<AgentSessionDetail | null> {
	const dataset = await loadMockDataset();
	const instance = dataset.instances.find((entry) => entry.slug === slug);
	if (!instance) {
		return null;
	}

	const session = dataset.sessions.find(
		(entry) => entry.sessionId === sessionId && entry.instanceId === instance.instanceId
	);
	if (!session) {
		return null;
	}

	const sessionTasks = dataset.tasks
		.filter((entry) => entry.sessionId === session.sessionId)
		.sort((left, right) => left.durationMs - right.durationMs);

	const tasks = sessionTasks.map((task) => {
		const actions = dataset.actions
			.filter((entry) => entry.taskId === task.taskId)
			.sort((left, right) => left.sequence - right.sequence)
			.slice(0, 48);

		const nodes = actions.map((action) => ({
			id: action.actionId,
			actionId: action.actionId,
			label: action.stepName,
			toolName: action.toolName,
			type: action.type,
			status: action.status,
			durationMs: action.durationMs,
			totalTokens: action.totalTokens,
			riskScore: action.riskScore,
			permissionLevel: action.permissionLevel,
			tone: mapActionTone(action)
		}));

		const edges = actions.slice(0, -1).map((action, index) => {
			const nextAction = actions[index + 1];
			return {
				id: `${action.actionId}__${nextAction.actionId}`,
				source: action.actionId,
				target: nextAction.actionId,
				label: `${action.stepName} -> ${nextAction.stepName}`,
				sourceLabel: action.stepName,
				targetLabel: nextAction.stepName,
				traversalCount: 1,
				successRate: action.status === 'success' && nextAction.status === 'success' ? 1 : 0,
				totalTokens: action.totalTokens + nextAction.totalTokens,
				avgLatencyMs: Math.round((action.durationMs + nextAction.durationMs) / 2)
			};
		});

		return {
			taskId: task.taskId,
			title: task.title,
			status: task.status,
			durationMs: task.durationMs,
			totalTokens: task.totalTokens,
			totalTokensLabel: compactTokens(task.totalTokens),
			totalCostUsd: task.totalCostUsd,
			totalCostUsdLabel: currency(task.totalCostUsd),
			actionCount: actions.length,
			nodes,
			edges
		};
	});

	return {
		instance: mapInstanceProfile(instance),
		session: {
			...mapSessionSummary(session, sessionTasks),
			tasks
		}
	};
}
