import { v } from 'convex/values';

import type { Doc } from './_generated/dataModel';
import { query, type QueryCtx } from './_generated/server';

type InstanceDoc = Doc<'instances'>;
type SessionDoc = Doc<'sessions'>;
type TaskDoc = Doc<'tasks'>;
type ActionDoc = Doc<'actions'>;
type InstanceWeeklyUsageDoc = Doc<'instanceWeeklyUsage'>;
type SessionCostBreakdownDoc = Doc<'sessionCostBreakdowns'>;
type AnalyticsHourlyDoc = Doc<'analyticsHourly'>;

function formatRelativeTime(isoString: string | null) {
	if (!isoString) return 'unknown';
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

function formatTriggerLabel(trigger: string) {
	return normalizeWhitespace(trigger).toUpperCase();
}

function sessionShortId(sessionId: string) {
	return sessionId.length <= 8 ? sessionId.toUpperCase() : sessionId.slice(0, 8).toUpperCase();
}

function roundCost(value: number) {
	return Number(value.toFixed(6));
}

function actionTone(action: ActionDoc) {
	if (action.sequence === 1) return 'entry' as const;
	if (action.isRecovery) return 'exit' as const;
	if (action.status !== 'success' || action.riskScore >= 0.2) return 'risk' as const;
	if (action.type === 'file_write' || action.type === 'shell') return 'write' as const;
	return 'core' as const;
}

function instanceLastSeen(instance: InstanceDoc) {
	return instance.lastSeenAt ?? instance.registeredAt;
}

function emptyWeeklyUsage(instance: InstanceDoc) {
	return {
		instanceId: instance.instanceId,
		instanceName: instance.name,
		sessions: 0,
		tasks: 0,
		actions: 0,
		totalTokens: 0,
		totalCostUsd: 0
	};
}

function currentHourBucket() {
	const now = new Date();
	now.setUTCMinutes(0, 0, 0);
	return now.toISOString();
}

function buildRecentHourBuckets(hours: number) {
	const start = new Date(currentHourBucket());
	start.setUTCHours(start.getUTCHours() - Math.max(0, hours - 1));

	return Array.from({ length: hours }, (_, index) => {
		const bucket = new Date(start);
		bucket.setUTCHours(start.getUTCHours() + index);
		return bucket.toISOString();
	});
}

async function findInstanceBySlugOrInstanceId(ctx: QueryCtx, slug: string) {
	const bySlug = await ctx.db
		.query('instances')
		.withIndex('by_slug', (query) => query.eq('slug', slug))
		.unique();
	if (bySlug) {
		return bySlug as InstanceDoc;
	}

	return (await ctx.db
		.query('instances')
		.withIndex('by_instanceId', (query) => query.eq('instanceId', slug))
		.unique()) as InstanceDoc | null;
}

async function findWeeklyUsage(ctx: QueryCtx, instanceId: string) {
	return (await ctx.db
		.query('instanceWeeklyUsage')
		.withIndex('by_instanceId', (query) => query.eq('instanceId', instanceId))
		.unique()) as InstanceWeeklyUsageDoc | null;
}

async function findSessionBySessionId(ctx: QueryCtx, sessionId: string) {
	return (await ctx.db
		.query('sessions')
		.withIndex('by_sessionId', (query) => query.eq('sessionId', sessionId))
		.unique()) as SessionDoc | null;
}

async function findSessionCostBreakdown(ctx: QueryCtx, sessionId: string) {
	return (await ctx.db
		.query('sessionCostBreakdowns')
		.withIndex('by_sessionId', (query) => query.eq('sessionId', sessionId))
		.unique()) as SessionCostBreakdownDoc | null;
}

async function listAnalyticsHourlySince(ctx: QueryCtx, thresholdHour: string) {
	const hours: AnalyticsHourlyDoc[] = [];
	for await (const row of ctx.db
		.query('analyticsHourly')
		.withIndex('by_hourBucket', (query) => query.gte('hourBucket', thresholdHour))
		.order('asc')) {
		hours.push(row as AnalyticsHourlyDoc);
	}

	return hours;
}

async function listInstances(ctx: QueryCtx) {
	const instances: InstanceDoc[] = [];
	for await (const row of ctx.db.query('instances')) {
		instances.push(row as InstanceDoc);
	}

	instances.sort((left, right) => {
		if (left.isPinned !== right.isPinned) {
			return left.isPinned ? -1 : 1;
		}

		return instanceLastSeen(right).localeCompare(instanceLastSeen(left));
	});

	return instances;
}

async function listSessionsForInstance(ctx: QueryCtx, instanceId: string) {
	const sessions: SessionDoc[] = [];
	for await (const row of ctx.db
		.query('sessions')
		.withIndex('by_instanceId_and_startedAt', (query) => query.eq('instanceId', instanceId))
		.order('desc')) {
		sessions.push(row as SessionDoc);
	}

	return sessions;
}

async function listTasksForSession(ctx: QueryCtx, sessionId: string) {
	const tasks: TaskDoc[] = [];
	for await (const row of ctx.db
		.query('tasks')
		.withIndex('by_sessionId_and_startedAt', (query) => query.eq('sessionId', sessionId))
		.order('asc')) {
		tasks.push(row as TaskDoc);
	}

	return tasks;
}

async function listActionsForTask(ctx: QueryCtx, taskId: string) {
	const actions: ActionDoc[] = [];
	for await (const row of ctx.db
		.query('actions')
		.withIndex('by_taskId_and_sequence', (query) => query.eq('taskId', taskId))
		.order('asc')) {
		actions.push(row as ActionDoc);
	}

	return actions;
}

function buildInstanceSparkline(
	instanceId: string,
	analyticsHours: AnalyticsHourlyDoc[],
	hourBuckets: string[]
) {
	const costByHour = new Map<string, number>();

	for (const hour of analyticsHours) {
		const entry = hour.byInstance.find((item) => item.instanceId === instanceId);
		if (!entry) {
			continue;
		}

		costByHour.set(hour.hourBucket, roundCost(entry.costUsd));
	}

	return hourBuckets.map((hour) => ({
		hour,
		costUsd: costByHour.get(hour) ?? 0
	}));
}

function mapInstanceSummary(
	instance: InstanceDoc,
	usage: InstanceWeeklyUsageDoc | null,
	sparkline: ReturnType<typeof buildInstanceSparkline>
) {
	const weeklyUsage = usage ?? emptyWeeklyUsage(instance);
	return {
		instanceId: instance.instanceId,
		slug: instance.slug,
		name: instance.name,
		status: instance.status,
		environment: instance.environment,
		modelDefault: instance.modelDefault ?? 'unknown',
		host: instance.host,
		lastSeenAt: instanceLastSeen(instance),
		lastSeenLabel: formatRelativeTime(instanceLastSeen(instance)),
		runningTasks: instance.metrics.runningTasks,
		completedToday: instance.metrics.completedToday,
		sessionCount7d: weeklyUsage.sessions,
		taskCount7d: weeklyUsage.tasks,
		actionCount7d: weeklyUsage.actions,
		totalTokens7d: weeklyUsage.totalTokens,
		totalTokens7dLabel: compactTokens(weeklyUsage.totalTokens),
		totalCostUsd7d: weeklyUsage.totalCostUsd,
		totalCostUsd7dLabel: currency(weeklyUsage.totalCostUsd),
		sparkline,
		tags: instance.tags
	};
}

function mapInstanceProfile(instance: InstanceDoc, usage: InstanceWeeklyUsageDoc | null) {
	const weeklyUsage = usage ?? emptyWeeklyUsage(instance);
	return {
		instanceId: instance.instanceId,
		slug: instance.slug,
		name: instance.name,
		status: instance.status,
		environment: instance.environment,
		modelDefault: instance.modelDefault ?? 'unknown',
		host: instance.host,
		os: instance.os ?? 'unknown',
		arch: instance.arch ?? 'unknown',
		zeroclawVersion: instance.zeroclawVersion ?? 'unknown',
		lastSeenAt: instanceLastSeen(instance),
		lastSeenLabel: formatRelativeTime(instanceLastSeen(instance)),
		totalTokens7dLabel: compactTokens(weeklyUsage.totalTokens),
		totalCostUsd7dLabel: currency(weeklyUsage.totalCostUsd),
		metrics: {
			...instance.metrics,
			sessionCount7d: weeklyUsage.sessions,
			taskCount7d: weeklyUsage.tasks,
			actionCount7d: weeklyUsage.actions,
			totalTokens7d: weeklyUsage.totalTokens,
			totalCostUsd7d: weeklyUsage.totalCostUsd
		},
		tags: instance.tags
	};
}

function taskTitlesForSession(tasks: TaskDoc[], breakdown: SessionCostBreakdownDoc | null) {
	const titlesFromBreakdown =
		breakdown?.byTask.map((task) => task.title).filter((title) => title.length > 0) ?? [];
	if (titlesFromBreakdown.length > 0) {
		return titlesFromBreakdown.slice(0, 3);
	}

	return tasks.slice(0, 3).map((task) => task.title);
}

function buildSessionDisplayName(taskTitles: string[], notes: string | null, id: string) {
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

	return `Session ${sessionShortId(id)}`;
}

function buildSessionSubtitle(session: SessionDoc) {
	const parts = [
		formatTriggerLabel(session.trigger),
		formatRelativeTime(session.startedAt),
		normalizeWhitespace(session.gitBranch ?? '')
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

function mapSessionSummary(
	session: SessionDoc,
	sessionTasks: TaskDoc[],
	breakdown: SessionCostBreakdownDoc | null
) {
	const taskTitles = taskTitlesForSession(sessionTasks, breakdown);
	const displayName = buildSessionDisplayName(taskTitles, session.notes, session.sessionId);

	return {
		sessionId: session.sessionId,
		sessionShortId: sessionShortId(session.sessionId),
		displayName,
		displaySubtitle: buildSessionSubtitle(session),
		trigger: session.trigger,
		status: session.status,
		startedAt: session.startedAt,
		durationMs: session.durationMs ?? 0,
		totalTokens: session.totalTokens,
		totalTokensLabel: compactTokens(session.totalTokens),
		totalCostUsd: session.totalCostUsd,
		totalCostUsdLabel: currency(session.totalCostUsd),
		taskCount: session.taskCount,
		actionCount: session.actionCount,
		gitBranch: session.gitBranch ?? '',
		notes: session.notes,
		taskTitles,
		taskPreview: buildTaskPreview(taskTitles, displayName)
	};
}

function mapTaskGraph(task: TaskDoc, actions: ActionDoc[]) {
	const nodes = actions.map((action) => ({
		id: action.actionId,
		actionId: action.actionId,
		label: action.stepName || action.actionId,
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
		const sourceLabel = action.stepName || action.actionId;
		const targetLabel = nextAction.stepName || nextAction.actionId;

		return {
			id: `${action.actionId}__${nextAction.actionId}`,
			source: action.actionId,
			target: nextAction.actionId,
			label: `${sourceLabel} -> ${targetLabel}`,
			sourceLabel,
			targetLabel,
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
		durationMs: task.durationMs ?? 0,
		totalTokens: task.totalTokens,
		totalTokensLabel: compactTokens(task.totalTokens),
		totalCostUsd: task.totalCostUsd,
		totalCostUsdLabel: currency(task.totalCostUsd),
		actionCount: task.actionCount,
		nodes,
		edges
	};
}

export const dashboard = query({
	args: {},
	handler: async (ctx) => {
		const instances = await listInstances(ctx);
		const hourBuckets = buildRecentHourBuckets(7 * 24);
		const thresholdHour = hourBuckets[0] ?? currentHourBucket();
		const [withUsage, analyticsHours] = await Promise.all([
			Promise.all(
				instances.map(async (instance) => ({
					instance,
					usage: await findWeeklyUsage(ctx, instance.instanceId)
				}))
			),
			listAnalyticsHourlySince(ctx, thresholdHour)
		]);

		return {
			generatedAt: new Date().toISOString(),
			instances: withUsage.map(({ instance, usage }) =>
				mapInstanceSummary(
					instance,
					usage,
					buildInstanceSparkline(instance.instanceId, analyticsHours, hourBuckets)
				)
			)
		};
	}
});

export const instanceOverview = query({
	args: { slug: v.string() },
	handler: async (ctx, args) => {
		const instance = await findInstanceBySlugOrInstanceId(ctx, args.slug);
		if (!instance) {
			return null;
		}

		const [usage, sessions] = await Promise.all([
			findWeeklyUsage(ctx, instance.instanceId),
			listSessionsForInstance(ctx, instance.instanceId)
		]);

		const recentSessions = await Promise.all(
			sessions.slice(0, 8).map(async (session) => {
				const [sessionTasks, breakdown] = await Promise.all([
					listTasksForSession(ctx, session.sessionId),
					findSessionCostBreakdown(ctx, session.sessionId)
				]);

				return mapSessionSummary(session, sessionTasks, breakdown);
			})
		);

		return {
			instance: mapInstanceProfile(instance, usage),
			sessions: recentSessions
		};
	}
});

export const sessionDetail = query({
	args: { slug: v.string(), sessionId: v.string() },
	handler: async (ctx, args) => {
		const [instance, session] = await Promise.all([
			findInstanceBySlugOrInstanceId(ctx, args.slug),
			findSessionBySessionId(ctx, args.sessionId)
		]);

		if (!instance || !session || session.instanceId !== instance.instanceId) {
			return null;
		}

		const [usage, breakdown, tasks] = await Promise.all([
			findWeeklyUsage(ctx, instance.instanceId),
			findSessionCostBreakdown(ctx, session.sessionId),
			listTasksForSession(ctx, session.sessionId)
		]);

		const taskGraphs = await Promise.all(
			tasks.map(async (task) => {
				const actions = await listActionsForTask(ctx, task.taskId);
				return mapTaskGraph(task, actions);
			})
		);

		return {
			instance: mapInstanceProfile(instance, usage),
			session: {
				...mapSessionSummary(session, tasks, breakdown),
				tasks: taskGraphs
			}
		};
	}
});
