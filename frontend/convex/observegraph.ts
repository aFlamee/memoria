import { v } from 'convex/values';
import { internalQuery, query, type QueryCtx } from './_generated/server';

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

function actionTone(action: {
	sequence: number;
	status: string;
	type: string;
	riskScore: number;
	isRecovery: boolean;
}) {
	if (action.sequence === 1) return 'entry' as const;
	if (action.isRecovery) return 'exit' as const;
	if (action.status !== 'success' || action.riskScore >= 0.2) return 'risk' as const;
	if (action.type === 'file_write' || action.type === 'shell') return 'write' as const;
	return 'core' as const;
}

function mapInstance(instance: {
	slug: string;
	name: string;
	status: 'online' | 'offline' | 'idle';
	environment: 'development' | 'production' | 'staging';
	modelDefault: string;
	host: string;
	os: string;
	arch: string;
	zeroclawVersion: string;
	lastSeenAt: string;
	tags: string[];
	metrics: {
		sessionCount7d: number;
		taskCount7d: number;
		actionCount7d: number;
		completedToday: number;
		runningTasks: number;
		totalTokens7d: number;
		totalCostUsd7d: number;
	};
}) {
	return {
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

async function getTaskTitlePreview(ctx: QueryCtx, sessionId: string) {
	const tasks = await ctx.db
		.query('tasks')
		.withIndex('by_sessionId_and_startedAt', (q) => q.eq('sessionId', sessionId))
		.order('asc')
		.take(3);

	return tasks.map((task) => task.title);
}

async function mapSessionSummary(
	ctx: QueryCtx,
	session: {
		sessionId: string;
		trigger: string;
		status: 'running' | 'completed' | 'failed' | 'killed';
		startedAt: string;
		durationMs: number;
		totalTokens: number;
		totalCostUsd: number;
		taskCount: number;
		actionCount: number;
		gitBranch: string;
		notes: string;
	}
) {
	return {
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
		gitBranch: session.gitBranch,
		notes: session.notes ?? null,
		taskTitles: await getTaskTitlePreview(ctx, session.sessionId)
	};
}

async function getSessionTasks(ctx: QueryCtx, sessionId: string) {
	const sessionTasks = await ctx.db
		.query('tasks')
		.withIndex('by_sessionId_and_startedAt', (q) => q.eq('sessionId', sessionId))
		.order('asc')
		.take(12);

	const tasks = [];
	for (const task of sessionTasks) {
		const actions = await ctx.db
			.query('actions')
			.withIndex('by_taskId_and_sequence', (q) => q.eq('taskId', task.taskId))
			.order('asc')
			.take(48);

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
			tone: actionTone(action)
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

		tasks.push({
			taskId: task.taskId,
			title: task.title,
			status: task.status,
			durationMs: task.durationMs,
			totalTokens: task.totalTokens,
			totalTokensLabel: compactTokens(task.totalTokens),
			totalCostUsd: task.totalCostUsd,
			totalCostUsdLabel: currency(task.totalCostUsd),
			actionCount: task.actionCount,
			nodes,
			edges
		});
	}

	return tasks;
}

export const dashboard = query({
	args: {},
	handler: async (ctx) => {
		const instances = await ctx.db.query('instances').order('asc').take(16);
		const ordered = [...instances].sort((left, right) => {
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
});

export const instanceOverview = query({
	args: { slug: v.string() },
	handler: async (ctx, args) => {
		const instance = await ctx.db
			.query('instances')
			.withIndex('by_slug', (q) => q.eq('slug', args.slug))
			.unique();
		if (!instance) {
			return null;
		}

		const sessions = await ctx.db
			.query('sessions')
			.withIndex('by_instanceId_and_startedAt', (q) => q.eq('instanceId', instance.instanceId))
			.order('desc')
			.take(8);

		return {
			instance: mapInstance(instance),
			sessions: await Promise.all(sessions.map((session) => mapSessionSummary(ctx, session)))
		};
	}
});

export const sessionDetail = query({
	args: { slug: v.string(), sessionId: v.string() },
	handler: async (ctx, args) => {
		const instance = await ctx.db
			.query('instances')
			.withIndex('by_slug', (q) => q.eq('slug', args.slug))
			.unique();
		if (!instance) {
			return null;
		}

		const session = await ctx.db
			.query('sessions')
			.withIndex('by_sessionId', (q) => q.eq('sessionId', args.sessionId))
			.unique();
		if (!session || session.instanceId !== instance.instanceId) {
			return null;
		}

		const tasks = await getSessionTasks(ctx, session.sessionId);

		return {
			instance: mapInstance(instance),
			session: {
				...(await mapSessionSummary(ctx, session)),
				tasks
			}
		};
	}
});

export const neo4jProjection = internalQuery({
	args: {},
	handler: async (ctx) => {
		const instances = await ctx.db.query('instances').take(16);
		const sessions = await ctx.db.query('sessions').take(64);
		const tasks = await ctx.db.query('tasks').take(128);
		const actions = await ctx.db.query('actions').take(512);
		const taskTemplates = await ctx.db.query('taskTemplates').take(32);
		const stepNodes = await ctx.db.query('stepNodes').take(128);
		const stepEdges = await ctx.db.query('stepEdges').take(128);
		return { instances, sessions, tasks, actions, taskTemplates, stepNodes, stepEdges };
	}
});
