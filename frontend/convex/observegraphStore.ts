import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { v } from 'convex/values';

import {
	actionStatusValidator,
	actionTypeValidator,
	environmentValidator,
	instanceStatusValidator,
	permissionLevelValidator,
	sessionStatusValidator,
	taskPriorityValidator,
	taskStatusValidator,
	taskTypeValidator
} from './observegraphValidators';

type DbCtx = MutationCtx | QueryCtx;

type InstanceDoc = Doc<'instances'>;
type SessionDoc = Doc<'sessions'>;
type TaskDoc = Doc<'tasks'>;
type ActionDoc = Doc<'actions'>;
type TaskTemplateDoc = Doc<'taskTemplates'>;
type StepNodeDoc = Doc<'stepNodes'>;
type StepEdgeDoc = Doc<'stepEdges'>;
type InstanceWeeklyUsageDoc = Doc<'instanceWeeklyUsage'>;
type SessionCostBreakdownDoc = Doc<'sessionCostBreakdowns'>;
type AnalyticsHourlyDoc = Doc<'analyticsHourly'>;
type InstanceMetrics = InstanceDoc['metrics'];

function emptyMetrics(): InstanceMetrics {
	return {
		sessionCount7d: 0,
		taskCount7d: 0,
		actionCount7d: 0,
		completedToday: 0,
		runningTasks: 0,
		totalTokens7d: 0,
		totalCostUsd7d: 0
	};
}

function round(value: number, digits = 6) {
	return Number(value.toFixed(digits));
}

function percent(part: number, total: number) {
	return round(total > 0 ? (part / total) * 100 : 0, 2);
}

function slugifyValue(value: string) {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.replace(/-{2,}/g, '-');
}

function templateIdForTitle(title: string) {
	return slugifyValue(title);
}

function stepFingerprint(toolName: string, stepName: string) {
	return `${slugifyValue(toolName)}:${slugifyValue(stepName)}`;
}

function stepIdFor(templateId: string, toolName: string, stepName: string) {
	return `${templateId}:${stepFingerprint(toolName, stepName)}`;
}

function edgeIdFor(templateId: string, fromStepId: string, toStepId: string) {
	return `${templateId}:${fromStepId}:${toStepId}`;
}

function uniqueStrings(values: string[]) {
	return Array.from(new Set(values.filter((value) => value.length > 0))).sort();
}

function isoDaysAgo(days: number) {
	return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function startOfTodayIsoUtc() {
	const now = new Date();
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

function hourBucketFor(isoString: string) {
	const date = new Date(isoString);
	date.setUTCMinutes(0, 0, 0);
	return date.toISOString();
}

function nextHourBucket(hourBucket: string) {
	const date = new Date(hourBucket);
	date.setUTCHours(date.getUTCHours() + 1);
	return date.toISOString();
}

function toResponseInstance(instance: Omit<InstanceDoc, '_id'>) {
	return {
		instance_id: instance.instanceId,
		name: instance.name,
		host: instance.host,
		port: instance.port,
		environment: instance.environment,
		os: instance.os,
		arch: instance.arch,
		zeroclaw_version: instance.zeroclawVersion,
		model_default: instance.modelDefault,
		registered_at: instance.registeredAt,
		last_seen_at: instance.lastSeenAt,
		status: instance.status,
		is_pinned: instance.isPinned,
		tags: instance.tags,
		session_count: instance.sessionCount
	};
}

function toResponseSession(session: Omit<SessionDoc, '_id'>) {
	return {
		session_id: session.sessionId,
		instance_id: session.instanceId,
		trigger: session.trigger,
		working_dir: session.workingDir,
		git_repo: session.gitRepo,
		git_branch: session.gitBranch,
		git_commit: session.gitCommit,
		model_override: session.modelOverride,
		started_at: session.startedAt,
		ended_at: session.endedAt,
		duration_ms: session.durationMs,
		status: session.status,
		total_tokens: session.totalTokens,
		total_cost_usd: session.totalCostUsd,
		task_count: session.taskCount,
		action_count: session.actionCount,
		exit_code: session.exitCode,
		notes: session.notes
	};
}

function toResponseTask(task: Omit<TaskDoc, '_id'>) {
	return {
		task_id: task.taskId,
		session_id: task.sessionId,
		instance_id: task.instanceId,
		title: task.title,
		description: task.description,
		type: task.type,
		technologies: task.technologies,
		status: task.status,
		priority: task.priority,
		started_at: task.startedAt,
		completed_at: task.completedAt,
		duration_ms: task.durationMs,
		total_tokens: task.totalTokens,
		thinking_tokens: task.thinkingTokens,
		output_tokens: task.outputTokens,
		total_cost_usd: task.totalCostUsd,
		action_count: task.actionCount,
		is_bookmarked: task.isBookmarked,
		rating: task.rating,
		tags: task.tags,
		error: task.error
	};
}

function toResponseAction(action: Omit<ActionDoc, '_id'>) {
	return {
		action_id: action.actionId,
		task_id: action.taskId,
		instance_id: action.instanceId,
		type: action.type,
		tool_name: action.toolName,
		command: action.command,
		file_path: action.filePath,
		file_size_bytes: action.fileSizeBytes,
		stdout: action.stdout,
		stderr: action.stderr,
		exit_code: action.exitCode,
		permission_level: action.permissionLevel,
		risk_score: action.riskScore,
		is_flagged: action.isFlagged,
		flag_reason: action.flagReason,
		status: action.status,
		started_at: action.startedAt,
		ended_at: action.endedAt,
		duration_ms: action.durationMs,
		sequence: action.sequence,
		step_name: action.stepName,
		reasoning: action.reasoning,
		thinking_tokens: action.thinkingTokens,
		output_tokens: action.outputTokens,
		total_tokens: action.totalTokens,
		model_used: action.modelUsed,
		cost_usd: action.costUsd,
		retry_count: action.retryCount,
		is_recovery: action.isRecovery
	};
}

function toResponseTemplate(template: Omit<TaskTemplateDoc, '_id'>) {
	return {
		template_id: template.templateId,
		title: template.title,
		fingerprint: template.fingerprint,
		type: template.type,
		technologies: template.technologies,
		created_at: template.createdAt,
		run_count: template.runCount,
		success_rate: template.successRate,
		avg_tokens: template.avgTokens,
		avg_duration_ms: template.avgDurationMs,
		best_run_id: template.bestRunId,
		tags: template.tags
	};
}

function toResponseStepNode(node: Omit<StepNodeDoc, '_id'>) {
	return {
		step_id: node.stepId,
		fingerprint: node.fingerprint,
		tool_name: node.toolName,
		step_name: node.stepName,
		type: node.type,
		run_count: node.runCount,
		success_rate: node.successRate,
		avg_tokens: node.avgTokens,
		avg_latency_ms: node.avgLatencyMs,
		avg_cost_usd: node.avgCostUsd,
		is_entry: node.isEntry,
		is_exit: node.isExit
	};
}

function toResponseStepEdge(edge: Omit<StepEdgeDoc, '_id'>) {
	return {
		from_step_id: edge.fromStepId,
		to_step_id: edge.toStepId,
		run_count: edge.runCount,
		avg_tokens: edge.avgTokens,
		avg_latency_ms: edge.avgLatencyMs,
		success_rate: edge.successRate,
		run_ids: edge.runIds
	};
}

async function findInstanceByInstanceId(ctx: DbCtx, instanceId: string) {
	return (await ctx.db
		.query('instances')
		.withIndex('by_instanceId', (query) => query.eq('instanceId', instanceId))
		.unique()) as InstanceDoc | null;
}

async function findSessionBySessionId(ctx: DbCtx, sessionId: string) {
	return (await ctx.db
		.query('sessions')
		.withIndex('by_sessionId', (query) => query.eq('sessionId', sessionId))
		.unique()) as SessionDoc | null;
}

async function findTaskByTaskId(ctx: DbCtx, taskId: string) {
	return (await ctx.db
		.query('tasks')
		.withIndex('by_taskId', (query) => query.eq('taskId', taskId))
		.unique()) as TaskDoc | null;
}

async function findActionByActionId(ctx: DbCtx, actionId: string) {
	return (await ctx.db
		.query('actions')
		.withIndex('by_actionId', (query) => query.eq('actionId', actionId))
		.unique()) as ActionDoc | null;
}

async function findTaskTemplateByTemplateId(ctx: DbCtx, templateId: string) {
	return (await ctx.db
		.query('taskTemplates')
		.withIndex('by_templateId', (query) => query.eq('templateId', templateId))
		.unique()) as TaskTemplateDoc | null;
}

async function findInstanceWeeklyUsage(ctx: DbCtx, instanceId: string) {
	return (await ctx.db
		.query('instanceWeeklyUsage')
		.withIndex('by_instanceId', (query) => query.eq('instanceId', instanceId))
		.unique()) as InstanceWeeklyUsageDoc | null;
}

async function findSessionCostBreakdown(ctx: DbCtx, sessionId: string) {
	return (await ctx.db
		.query('sessionCostBreakdowns')
		.withIndex('by_sessionId', (query) => query.eq('sessionId', sessionId))
		.unique()) as SessionCostBreakdownDoc | null;
}

async function findAnalyticsHour(ctx: DbCtx, hourBucket: string) {
	return (await ctx.db
		.query('analyticsHourly')
		.withIndex('by_hourBucket', (query) => query.eq('hourBucket', hourBucket))
		.unique()) as AnalyticsHourlyDoc | null;
}

async function listSessionsForInstance(ctx: DbCtx, instanceId: string) {
	const sessions: SessionDoc[] = [];
	for await (const row of ctx.db
		.query('sessions')
		.withIndex('by_instanceId_and_startedAt', (query) => query.eq('instanceId', instanceId))
		.order('desc')) {
		sessions.push(row as SessionDoc);
	}
	return sessions;
}

async function listTasksForInstance(ctx: DbCtx, instanceId: string) {
	const tasks: TaskDoc[] = [];
	for await (const row of ctx.db
		.query('tasks')
		.withIndex('by_instanceId_and_startedAt', (query) => query.eq('instanceId', instanceId))
		.order('desc')) {
		tasks.push(row as TaskDoc);
	}
	return tasks;
}

async function listTasksForSession(ctx: DbCtx, sessionId: string) {
	const tasks: TaskDoc[] = [];
	for await (const row of ctx.db
		.query('tasks')
		.withIndex('by_sessionId_and_startedAt', (query) => query.eq('sessionId', sessionId))
		.order('asc')) {
		tasks.push(row as TaskDoc);
	}
	return tasks;
}

async function listTasksForTemplate(ctx: DbCtx, templateId: string) {
	const tasks: TaskDoc[] = [];
	for await (const row of ctx.db
		.query('tasks')
		.withIndex('by_templateId_and_startedAt', (query) => query.eq('templateId', templateId))
		.order('asc')) {
		tasks.push(row as TaskDoc);
	}
	return tasks;
}

async function listActionsForTask(ctx: DbCtx, taskId: string) {
	const actions: ActionDoc[] = [];
	for await (const row of ctx.db
		.query('actions')
		.withIndex('by_taskId_and_sequence', (query) => query.eq('taskId', taskId))
		.order('asc')) {
		actions.push(row as ActionDoc);
	}
	return actions;
}

async function deleteStepProjection(ctx: MutationCtx, templateId: string) {
	for await (const row of ctx.db
		.query('stepNodes')
		.withIndex('by_templateId_and_stepId', (query) => query.eq('templateId', templateId))) {
		await ctx.db.delete(row._id);
	}

	for await (const row of ctx.db
		.query('stepEdges')
		.withIndex('by_templateId_and_edgeId', (query) => query.eq('templateId', templateId))) {
		await ctx.db.delete(row._id);
	}
}

async function recomputeTaskSummary(ctx: MutationCtx, taskId: string) {
	const task = await findTaskByTaskId(ctx, taskId);
	if (!task) {
		return null;
	}

	const actions = await listActionsForTask(ctx, taskId);
	const totalTokens = actions.reduce((sum, action) => sum + action.totalTokens, 0);
	const totalCostUsd = round(actions.reduce((sum, action) => sum + action.costUsd, 0));
	const actionCount = actions.length;
	const lastActionAt =
		actions.length > 0
			? actions.reduce((latest, action) => (action.startedAt > latest ? action.startedAt : latest), '')
			: '';

	await ctx.db.patch(task._id, {
		totalTokens,
		totalCostUsd,
		actionCount,
		lastActionAt
	});

	return { ...task, totalTokens, totalCostUsd, actionCount, lastActionAt };
}

async function recomputeSessionSummary(ctx: MutationCtx, sessionId: string) {
	const session = await findSessionBySessionId(ctx, sessionId);
	if (!session) {
		return null;
	}

	const tasks = await listTasksForSession(ctx, sessionId);
	const taskCount = tasks.length;
	const actionCount = tasks.reduce((sum, task) => sum + task.actionCount, 0);
	const totalTokens = tasks.reduce((sum, task) => sum + task.totalTokens, 0);
	const totalCostUsd = round(tasks.reduce((sum, task) => sum + task.totalCostUsd, 0));

	await ctx.db.patch(session._id, {
		taskCount,
		actionCount,
		totalTokens,
		totalCostUsd
	});

	return { ...session, taskCount, actionCount, totalTokens, totalCostUsd };
}

async function recomputeInstanceMetrics(ctx: MutationCtx, instanceId: string) {
	const instance = await findInstanceByInstanceId(ctx, instanceId);
	if (!instance) {
		return null;
	}

	const threshold = isoDaysAgo(7);
	const todayStart = startOfTodayIsoUtc();
	const sessions = await listSessionsForInstance(ctx, instanceId);
	const tasks = await listTasksForInstance(ctx, instanceId);
	const actions: ActionDoc[] = [];

	for await (const row of ctx.db
		.query('actions')
		.withIndex('by_instanceId_and_startedAt', (query) => query.eq('instanceId', instanceId))
		.order('desc')) {
		actions.push(row as ActionDoc);
	}

	const metrics = {
		sessionCount7d: sessions.filter((session) => session.startedAt >= threshold).length,
		taskCount7d: tasks.filter((task) => task.startedAt >= threshold).length,
		actionCount7d: actions.filter((action) => action.startedAt >= threshold).length,
		completedToday: tasks.filter(
			(task) => task.status === 'completed' && task.completedAt !== null && task.completedAt >= todayStart
		).length,
		runningTasks: tasks.filter((task) => task.status === 'in_progress').length,
		totalTokens7d: actions
			.filter((action) => action.startedAt >= threshold)
			.reduce((sum, action) => sum + action.totalTokens, 0),
		totalCostUsd7d: round(
			actions
				.filter((action) => action.startedAt >= threshold)
				.reduce((sum, action) => sum + action.costUsd, 0)
		)
	};

	await ctx.db.patch(instance._id, {
		sessionCount: sessions.length,
		metrics
	});

	return metrics;
}

async function recomputeInstanceWeeklyUsage(ctx: MutationCtx, instanceId: string) {
	const instance = await findInstanceByInstanceId(ctx, instanceId);
	if (!instance) {
		return null;
	}

	const threshold = isoDaysAgo(7);
	const sessions = (await listSessionsForInstance(ctx, instanceId)).filter(
		(session) => session.startedAt >= threshold
	);
	const tasks = (await listTasksForInstance(ctx, instanceId)).filter((task) => task.startedAt >= threshold);
	const actions: ActionDoc[] = [];

	for await (const row of ctx.db
		.query('actions')
		.withIndex('by_instanceId_and_startedAt', (query) => query.eq('instanceId', instanceId))
		.order('desc')) {
		const action = row as ActionDoc;
		if (action.startedAt >= threshold) {
			actions.push(action);
		}
	}

	const payload = {
		instanceId,
		instanceName: instance.name,
		sessions: sessions.length,
		tasks: tasks.length,
		actions: actions.length,
		totalTokens: actions.reduce((sum, action) => sum + action.totalTokens, 0),
		totalCostUsd: round(actions.reduce((sum, action) => sum + action.costUsd, 0)),
		updatedAt: new Date().toISOString()
	};

	const existing = await findInstanceWeeklyUsage(ctx, instanceId);
	if (existing) {
		await ctx.db.patch(existing._id, payload);
	} else {
		await ctx.db.insert('instanceWeeklyUsage', payload);
	}

	return payload;
}

async function recomputeSessionCostBreakdown(ctx: MutationCtx, sessionId: string) {
	const session = await findSessionBySessionId(ctx, sessionId);
	if (!session) {
		return null;
	}

	const tasks = await listTasksForSession(ctx, sessionId);
	const byTask = [];
	const byToolMap = new Map<string, { toolName: string; actionCount: number; costUsd: number }>();

	for (const task of tasks) {
		const actions = await listActionsForTask(ctx, task.taskId);
		if (actions.length === 0) {
			continue;
		}

		const taskCost = round(actions.reduce((sum, action) => sum + action.costUsd, 0));
		const taskTokens = actions.reduce((sum, action) => sum + action.totalTokens, 0);

		byTask.push({
			taskId: task.taskId,
			title: task.title,
			costUsd: taskCost,
			tokens: taskTokens
		});

		for (const action of actions) {
			const current = byToolMap.get(action.toolName) ?? {
				toolName: action.toolName,
				actionCount: 0,
				costUsd: 0
			};
			current.actionCount += 1;
			current.costUsd = round(current.costUsd + action.costUsd);
			byToolMap.set(action.toolName, current);
		}
	}

	byTask.sort((left, right) => right.costUsd - left.costUsd);
	const byTool = Array.from(byToolMap.values()).sort((left, right) => right.costUsd - left.costUsd);
	const payload = {
		sessionId,
		totalCostUsd: round(byTask.reduce((sum, task) => sum + task.costUsd, 0)),
		byTask,
		byTool,
		updatedAt: new Date().toISOString()
	};

	const existing = await findSessionCostBreakdown(ctx, sessionId);
	if (existing) {
		await ctx.db.patch(existing._id, payload);
	} else {
		await ctx.db.insert('sessionCostBreakdowns', payload);
	}

	return payload;
}

async function recomputeTemplateProjection(ctx: MutationCtx, templateId: string) {
	const tasks = await listTasksForTemplate(ctx, templateId);
	if (tasks.length === 0) {
		const existing = await findTaskTemplateByTemplateId(ctx, templateId);
		if (existing) {
			await ctx.db.delete(existing._id);
		}
		await deleteStepProjection(ctx, templateId);
		return null;
	}

	const firstTask = tasks[0];
	const createdAt = (await findTaskTemplateByTemplateId(ctx, templateId))?.createdAt ?? firstTask.startedAt;
	const technologies = uniqueStrings(tasks.flatMap((task) => task.technologies));
	const tags = uniqueStrings(tasks.flatMap((task) => task.tags));
	const completedRuns = tasks.filter((task) => task.status === 'completed');
	const bestRun = [...completedRuns].sort((left, right) => right.totalTokens - left.totalTokens)[0] ?? null;
	const templatePayload = {
		templateId,
		title: firstTask.title,
		fingerprint: templateId,
		type: firstTask.type,
		technologies,
		createdAt,
		runCount: tasks.length,
		successRate: round(completedRuns.length / tasks.length),
		avgTokens: round(tasks.reduce((sum, task) => sum + task.totalTokens, 0) / tasks.length),
		avgDurationMs: round(
			tasks.reduce((sum, task) => sum + (task.durationMs ?? 0), 0) / tasks.length
		),
		bestRunId: bestRun?.taskId ?? null,
		tags
	};

	const existingTemplate = await findTaskTemplateByTemplateId(ctx, templateId);
	if (existingTemplate) {
		await ctx.db.patch(existingTemplate._id, templatePayload);
	} else {
		await ctx.db.insert('taskTemplates', templatePayload);
	}

	const nodeAgg = new Map<
		string,
		{
			stepId: string;
			templateId: string;
			fingerprint: string;
			toolName: string;
			stepName: string;
			type: ActionDoc['type'];
			runCount: number;
			successCount: number;
			totalTokens: number;
			totalLatencyMs: number;
			totalCostUsd: number;
		}
	>();

	const edgeAgg = new Map<
		string,
		{
			edgeId: string;
			templateId: string;
			fromStepId: string;
			toStepId: string;
			runCount: number;
			runIds: string[];
			successCount: number;
			totalTokens: number;
			totalLatencyMs: number;
		}
	>();

	for (const task of tasks) {
		const actions = await listActionsForTask(ctx, task.taskId);
		for (const action of actions) {
			const stepId = action.stepId;
			const fingerprint = stepFingerprint(action.toolName, action.stepName);
			const current = nodeAgg.get(stepId) ?? {
				stepId,
				templateId,
				fingerprint,
				toolName: action.toolName,
				stepName: action.stepName,
				type: action.type,
				runCount: 0,
				successCount: 0,
				totalTokens: 0,
				totalLatencyMs: 0,
				totalCostUsd: 0
			};
			current.runCount += 1;
			current.successCount += action.status === 'success' ? 1 : 0;
			current.totalTokens += action.totalTokens;
			current.totalLatencyMs += action.durationMs;
			current.totalCostUsd += action.costUsd;
			nodeAgg.set(stepId, current);
		}

		for (let index = 0; index < actions.length - 1; index += 1) {
			const currentAction = actions[index];
			const nextAction = actions[index + 1];
			const edgeId = edgeIdFor(templateId, currentAction.stepId, nextAction.stepId);
			const edge = edgeAgg.get(edgeId) ?? {
				edgeId,
				templateId,
				fromStepId: currentAction.stepId,
				toStepId: nextAction.stepId,
				runCount: 0,
				runIds: [],
				successCount: 0,
				totalTokens: 0,
				totalLatencyMs: 0
			};
			edge.runCount += 1;
			edge.runIds = uniqueStrings([...edge.runIds, task.runId]);
			edge.successCount +=
				currentAction.status === 'success' && nextAction.status === 'success' ? 1 : 0;
			edge.totalTokens += currentAction.totalTokens;
			edge.totalLatencyMs += currentAction.durationMs;
			edgeAgg.set(edgeId, edge);
		}
	}

	await deleteStepProjection(ctx, templateId);

	const incoming = new Set(Array.from(edgeAgg.values()).map((edge) => edge.toStepId));
	const outgoing = new Set(Array.from(edgeAgg.values()).map((edge) => edge.fromStepId));

	for (const node of nodeAgg.values()) {
		await ctx.db.insert('stepNodes', {
			stepId: node.stepId,
			templateId: node.templateId,
			fingerprint: node.fingerprint,
			toolName: node.toolName,
			stepName: node.stepName,
			type: node.type,
			runCount: node.runCount,
			successRate: round(node.successCount / node.runCount),
			avgTokens: round(node.totalTokens / node.runCount),
			avgLatencyMs: round(node.totalLatencyMs / node.runCount),
			avgCostUsd: round(node.totalCostUsd / node.runCount),
			isEntry: !incoming.has(node.stepId),
			isExit: !outgoing.has(node.stepId)
		});
	}

	for (const edge of edgeAgg.values()) {
		await ctx.db.insert('stepEdges', {
			edgeId: edge.edgeId,
			templateId: edge.templateId,
			fromStepId: edge.fromStepId,
			toStepId: edge.toStepId,
			runCount: edge.runCount,
			runIds: edge.runIds,
			avgTokens: round(edge.totalTokens / edge.runCount),
			avgLatencyMs: round(edge.totalLatencyMs / edge.runCount),
			successRate: round(edge.successCount / edge.runCount)
		});
	}

	return templatePayload;
}

async function recomputeAnalyticsHour(ctx: MutationCtx, hourBucket: string) {
	const hourEnd = nextHourBucket(hourBucket);
	const actions: ActionDoc[] = [];

	for await (const row of ctx.db
		.query('actions')
		.withIndex('by_startedAt', (query) => query.gte('startedAt', hourBucket).lt('startedAt', hourEnd))
		.order('asc')) {
		actions.push(row as ActionDoc);
	}

	const existing = await findAnalyticsHour(ctx, hourBucket);
	if (actions.length === 0) {
		if (existing) {
			await ctx.db.delete(existing._id);
		}
		return null;
	}

	const instanceMap = new Map<string, { instanceId: string; instanceName: string; costUsd: number }>();
	const taskTypeMap = new Map<string, { type: string; costUsd: number }>();
	const toolMap = new Map<string, { toolName: string; actionCount: number; costUsd: number }>();
	const taskCache = new Map<string, TaskDoc | null>();
	const instanceCache = new Map<string, InstanceDoc | null>();

	for (const action of actions) {
		if (!taskCache.has(action.taskId)) {
			taskCache.set(action.taskId, await findTaskByTaskId(ctx, action.taskId));
		}
		if (!instanceCache.has(action.instanceId)) {
			instanceCache.set(action.instanceId, await findInstanceByInstanceId(ctx, action.instanceId));
		}

		const task = taskCache.get(action.taskId);
		const instance = instanceCache.get(action.instanceId);

		const byInstance = instanceMap.get(action.instanceId) ?? {
			instanceId: action.instanceId,
			instanceName: instance?.name ?? action.instanceId,
			costUsd: 0
		};
		byInstance.costUsd = round(byInstance.costUsd + action.costUsd);
		instanceMap.set(action.instanceId, byInstance);

		const taskType = task?.type ?? 'unknown';
		const byTaskType = taskTypeMap.get(taskType) ?? { type: taskType, costUsd: 0 };
		byTaskType.costUsd = round(byTaskType.costUsd + action.costUsd);
		taskTypeMap.set(taskType, byTaskType);

		const byTool = toolMap.get(action.toolName) ?? {
			toolName: action.toolName,
			actionCount: 0,
			costUsd: 0
		};
		byTool.actionCount += 1;
		byTool.costUsd = round(byTool.costUsd + action.costUsd);
		toolMap.set(action.toolName, byTool);
	}

	const payload = {
		hourBucket,
		totalCostUsd: round(actions.reduce((sum, action) => sum + action.costUsd, 0)),
		totalTokens: actions.reduce((sum, action) => sum + action.totalTokens, 0),
		actionCount: actions.length,
		byInstance: Array.from(instanceMap.values()).sort((left, right) => right.costUsd - left.costUsd),
		byTaskType: Array.from(taskTypeMap.values()).sort((left, right) => right.costUsd - left.costUsd),
		byTool: Array.from(toolMap.values()).sort((left, right) => right.costUsd - left.costUsd),
		updatedAt: new Date().toISOString()
	};

	if (existing) {
		await ctx.db.patch(existing._id, payload);
	} else {
		await ctx.db.insert('analyticsHourly', payload);
	}

	return payload;
}

export const upsertInstance = internalMutation({
	args: {
		instanceId: v.string(),
		slug: v.string(),
		name: v.string(),
		host: v.string(),
		port: v.number(),
		environment: environmentValidator,
		os: v.union(v.string(), v.null()),
		arch: v.union(v.string(), v.null()),
		zeroclawVersion: v.union(v.string(), v.null()),
		modelDefault: v.union(v.string(), v.null()),
		registeredAt: v.string(),
		lastSeenAt: v.union(v.string(), v.null()),
		status: instanceStatusValidator,
		isPinned: v.boolean(),
		tags: v.array(v.string())
	},
	handler: async (ctx, args) => {
		const existing = await findInstanceByInstanceId(ctx, args.instanceId);
		const payload = {
			instanceId: args.instanceId,
			slug: args.slug || args.instanceId,
			name: args.name,
			host: args.host,
			port: args.port,
			environment: args.environment,
			os: args.os,
			arch: args.arch,
			zeroclawVersion: args.zeroclawVersion,
			modelDefault: args.modelDefault,
			registeredAt: existing?.registeredAt ?? args.registeredAt,
			lastSeenAt: args.lastSeenAt,
			status: args.status,
			isPinned: args.isPinned,
			tags: args.tags,
			sessionCount: existing?.sessionCount ?? 0,
			metrics: existing?.metrics ?? emptyMetrics()
		};

		if (existing) {
			await ctx.db.patch(existing._id, payload);
		} else {
			await ctx.db.insert('instances', payload);
		}

		await recomputeInstanceMetrics(ctx, args.instanceId);
		await recomputeInstanceWeeklyUsage(ctx, args.instanceId);

		const instance = await findInstanceByInstanceId(ctx, args.instanceId);
		return instance ? toResponseInstance(instance) : null;
	}
});

export const heartbeatInstance = internalMutation({
	args: {
		instanceId: v.string(),
		lastSeenAt: v.string()
	},
	handler: async (ctx, args) => {
		const instance = await findInstanceByInstanceId(ctx, args.instanceId);
		if (!instance) {
			return null;
		}

		await ctx.db.patch(instance._id, {
			lastSeenAt: args.lastSeenAt,
			status: 'online'
		});
		await recomputeInstanceMetrics(ctx, args.instanceId);
		await recomputeInstanceWeeklyUsage(ctx, args.instanceId);
		return { status: 'ok', last_seen_at: args.lastSeenAt };
	}
});

export const upsertSession = internalMutation({
	args: {
		sessionId: v.string(),
		instanceId: v.string(),
		trigger: v.string(),
		workingDir: v.union(v.string(), v.null()),
		gitRepo: v.union(v.string(), v.null()),
		gitBranch: v.union(v.string(), v.null()),
		gitCommit: v.union(v.string(), v.null()),
		modelOverride: v.union(v.string(), v.null()),
		startedAt: v.string(),
		endedAt: v.union(v.string(), v.null()),
		durationMs: v.union(v.number(), v.null()),
		status: sessionStatusValidator,
		totalTokens: v.number(),
		totalCostUsd: v.number(),
		taskCount: v.number(),
		actionCount: v.number(),
		exitCode: v.union(v.number(), v.null()),
		notes: v.union(v.string(), v.null())
	},
	handler: async (ctx, args) => {
		const instance = await findInstanceByInstanceId(ctx, args.instanceId);
		if (!instance) {
			return null;
		}

		const existing = await findSessionBySessionId(ctx, args.sessionId);
		const payload = {
			...args,
			startedAt: existing?.startedAt ?? args.startedAt
		};

		if (existing) {
			await ctx.db.patch(existing._id, payload);
		} else {
			await ctx.db.insert('sessions', payload);
		}

		await recomputeInstanceMetrics(ctx, args.instanceId);
		await recomputeInstanceWeeklyUsage(ctx, args.instanceId);
		await recomputeSessionCostBreakdown(ctx, args.sessionId);
		const session = await findSessionBySessionId(ctx, args.sessionId);
		return session ? toResponseSession(session) : null;
	}
});

export const patchSession = internalMutation({
	args: {
		sessionId: v.string(),
		status: v.union(sessionStatusValidator, v.null()),
		endedAt: v.union(v.string(), v.null()),
		durationMs: v.union(v.number(), v.null()),
		totalTokens: v.union(v.number(), v.null()),
		totalCostUsd: v.union(v.number(), v.null()),
		taskCount: v.union(v.number(), v.null()),
		actionCount: v.union(v.number(), v.null()),
		exitCode: v.union(v.number(), v.null()),
		notes: v.union(v.string(), v.null())
	},
	handler: async (ctx, args) => {
		const session = await findSessionBySessionId(ctx, args.sessionId);
		if (!session) {
			return null;
		}

		const payload = {
			status: args.status ?? session.status,
			endedAt: args.endedAt ?? session.endedAt,
			durationMs: args.durationMs ?? session.durationMs,
			totalTokens: args.totalTokens ?? session.totalTokens,
			totalCostUsd: args.totalCostUsd ?? session.totalCostUsd,
			taskCount: args.taskCount ?? session.taskCount,
			actionCount: args.actionCount ?? session.actionCount,
			exitCode: args.exitCode ?? session.exitCode,
			notes: args.notes ?? session.notes
		};

		await ctx.db.patch(session._id, payload);
		await recomputeSessionSummary(ctx, args.sessionId);
		await recomputeInstanceMetrics(ctx, session.instanceId);
		await recomputeInstanceWeeklyUsage(ctx, session.instanceId);
		await recomputeSessionCostBreakdown(ctx, args.sessionId);
		const updated = await findSessionBySessionId(ctx, args.sessionId);
		return updated ? toResponseSession(updated) : null;
	}
});

export const upsertTask = internalMutation({
	args: {
		taskId: v.string(),
		sessionId: v.string(),
		instanceId: v.string(),
		title: v.string(),
		description: v.union(v.string(), v.null()),
		type: taskTypeValidator,
		technologies: v.array(v.string()),
		status: taskStatusValidator,
		priority: taskPriorityValidator,
		startedAt: v.string(),
		completedAt: v.union(v.string(), v.null()),
		durationMs: v.union(v.number(), v.null()),
		totalTokens: v.number(),
		thinkingTokens: v.number(),
		outputTokens: v.number(),
		totalCostUsd: v.number(),
		actionCount: v.number(),
		isBookmarked: v.boolean(),
		rating: v.union(v.number(), v.null()),
		tags: v.array(v.string()),
		error: v.union(v.string(), v.null())
	},
	handler: async (ctx, args) => {
		const session = await findSessionBySessionId(ctx, args.sessionId);
		if (!session) {
			return null;
		}

		const existing = await findTaskByTaskId(ctx, args.taskId);
		const templateId = templateIdForTitle(args.title);
		const payload = {
			...args,
			templateId,
			runId: args.taskId,
			lastActionAt: existing?.lastActionAt ?? ''
		};

		if (existing) {
			await ctx.db.patch(existing._id, payload);
		} else {
			await ctx.db.insert('tasks', payload);
		}

		await recomputeSessionSummary(ctx, args.sessionId);
		await recomputeInstanceMetrics(ctx, args.instanceId);
		await recomputeInstanceWeeklyUsage(ctx, args.instanceId);
		await recomputeSessionCostBreakdown(ctx, args.sessionId);
		await recomputeTemplateProjection(ctx, templateId);
		const task = await findTaskByTaskId(ctx, args.taskId);
		return task ? toResponseTask(task) : null;
	}
});

export const patchTask = internalMutation({
	args: {
		taskId: v.string(),
		status: v.union(taskStatusValidator, v.null()),
		completedAt: v.union(v.string(), v.null()),
		durationMs: v.union(v.number(), v.null()),
		totalTokens: v.union(v.number(), v.null()),
		thinkingTokens: v.union(v.number(), v.null()),
		outputTokens: v.union(v.number(), v.null()),
		totalCostUsd: v.union(v.number(), v.null()),
		actionCount: v.union(v.number(), v.null()),
		isBookmarked: v.union(v.boolean(), v.null()),
		rating: v.union(v.number(), v.null()),
		error: v.union(v.string(), v.null())
	},
	handler: async (ctx, args) => {
		const task = await findTaskByTaskId(ctx, args.taskId);
		if (!task) {
			return null;
		}

		await ctx.db.patch(task._id, {
			status: args.status ?? task.status,
			completedAt: args.completedAt ?? task.completedAt,
			durationMs: args.durationMs ?? task.durationMs,
			totalTokens: args.totalTokens ?? task.totalTokens,
			thinkingTokens: args.thinkingTokens ?? task.thinkingTokens,
			outputTokens: args.outputTokens ?? task.outputTokens,
			totalCostUsd: args.totalCostUsd ?? task.totalCostUsd,
			actionCount: args.actionCount ?? task.actionCount,
			isBookmarked: args.isBookmarked ?? task.isBookmarked,
			rating: args.rating ?? task.rating,
			error: args.error ?? task.error
		});

		await recomputeTaskSummary(ctx, args.taskId);
		await recomputeSessionSummary(ctx, task.sessionId);
		await recomputeInstanceMetrics(ctx, task.instanceId);
		await recomputeInstanceWeeklyUsage(ctx, task.instanceId);
		await recomputeSessionCostBreakdown(ctx, task.sessionId);
		await recomputeTemplateProjection(ctx, task.templateId);
		const updated = await findTaskByTaskId(ctx, args.taskId);
		return updated ? toResponseTask(updated) : null;
	}
});

export const upsertAction = internalMutation({
	args: {
		actionId: v.string(),
		taskId: v.string(),
		instanceId: v.string(),
		sequence: v.number(),
		stepName: v.string(),
		type: actionTypeValidator,
		toolName: v.string(),
		command: v.union(v.string(), v.null()),
		filePath: v.union(v.string(), v.null()),
		fileSizeBytes: v.union(v.number(), v.null()),
		stdout: v.union(v.string(), v.null()),
		stderr: v.union(v.string(), v.null()),
		exitCode: v.union(v.number(), v.null()),
		permissionLevel: permissionLevelValidator,
		riskScore: v.number(),
		isFlagged: v.boolean(),
		flagReason: v.union(v.string(), v.null()),
		status: actionStatusValidator,
		startedAt: v.string(),
		endedAt: v.string(),
		durationMs: v.number(),
		reasoning: v.union(v.string(), v.null()),
		thinkingTokens: v.number(),
		outputTokens: v.number(),
		totalTokens: v.number(),
		modelUsed: v.union(v.string(), v.null()),
		latencyMs: v.union(v.number(), v.null()),
		costUsd: v.number(),
		retryCount: v.number(),
		isRecovery: v.boolean()
	},
	handler: async (ctx, args) => {
		const task = await findTaskByTaskId(ctx, args.taskId);
		if (!task) {
			return null;
		}
		const stepId = stepIdFor(task.templateId, args.toolName, args.stepName);

		const existing = await findActionByActionId(ctx, args.actionId);
		const previousHour = existing ? hourBucketFor(existing.startedAt) : null;
		const payload = {
			...args,
			runId: task.runId,
			stepId
		};

		if (existing) {
			await ctx.db.patch(existing._id, payload);
		} else {
			await ctx.db.insert('actions', payload);
		}

		await recomputeTaskSummary(ctx, args.taskId);
		await recomputeSessionSummary(ctx, task.sessionId);
		await recomputeInstanceMetrics(ctx, args.instanceId);
		await recomputeInstanceWeeklyUsage(ctx, args.instanceId);
		await recomputeSessionCostBreakdown(ctx, task.sessionId);
		await recomputeTemplateProjection(ctx, task.templateId);
		if (previousHour && previousHour !== hourBucketFor(args.startedAt)) {
			await recomputeAnalyticsHour(ctx, previousHour);
		}
		await recomputeAnalyticsHour(ctx, hourBucketFor(args.startedAt));

		const action = await findActionByActionId(ctx, args.actionId);
		return action ? toResponseAction(action) : null;
	}
});

export const flagAction = internalMutation({
	args: {
		actionId: v.string(),
		isFlagged: v.boolean(),
		reason: v.union(v.string(), v.null())
	},
	handler: async (ctx, args) => {
		const action = await findActionByActionId(ctx, args.actionId);
		if (!action) {
			return null;
		}

		await ctx.db.patch(action._id, {
			isFlagged: args.isFlagged,
			flagReason: args.reason
		});

		const updated = await findActionByActionId(ctx, args.actionId);
		return updated
			? {
					action_id: updated.actionId,
					is_flagged: updated.isFlagged,
					flagged_at: args.isFlagged ? new Date().toISOString() : null
				}
			: null;
	}
});

export const listInstances = internalQuery({
	args: {},
	handler: async (ctx) => {
		const instances: Array<ReturnType<typeof toResponseInstance>> = [];
		for await (const row of ctx.db.query('instances')) {
			instances.push(toResponseInstance(row as InstanceDoc));
		}

		instances.sort((left, right) => {
			if (left.is_pinned !== right.is_pinned) {
				return left.is_pinned ? -1 : 1;
			}

			const leftSeen = left.last_seen_at ?? '';
			const rightSeen = right.last_seen_at ?? '';
			return rightSeen.localeCompare(leftSeen);
		});

		return instances;
	}
});

export const getInstance = internalQuery({
	args: { instanceId: v.string() },
	handler: async (ctx, args) => {
		const instance = await findInstanceByInstanceId(ctx, args.instanceId);
		return instance ? toResponseInstance(instance) : null;
	}
});

export const getWeeklyUsage = internalQuery({
	args: { instanceId: v.string() },
	handler: async (ctx, args) => {
		const usage = await findInstanceWeeklyUsage(ctx, args.instanceId);
		if (!usage) {
			const instance = await findInstanceByInstanceId(ctx, args.instanceId);
			if (!instance) {
				return null;
			}

			return {
				instance_id: instance.instanceId,
				instance_name: instance.name,
				sessions: 0,
				tasks: 0,
				actions: 0,
				total_tokens: 0,
				total_cost_usd: 0
			};
		}

		return {
			instance_id: usage.instanceId,
			instance_name: usage.instanceName,
			sessions: usage.sessions,
			tasks: usage.tasks,
			actions: usage.actions,
			total_tokens: usage.totalTokens,
			total_cost_usd: usage.totalCostUsd
		};
	}
});

export const getSession = internalQuery({
	args: { sessionId: v.string() },
	handler: async (ctx, args) => {
		const session = await findSessionBySessionId(ctx, args.sessionId);
		return session ? toResponseSession(session) : null;
	}
});

export const getSessionCostBreakdown = internalQuery({
	args: { sessionId: v.string() },
	handler: async (ctx, args) => {
		const session = await findSessionBySessionId(ctx, args.sessionId);
		if (!session) {
			return null;
		}

		const breakdown = await findSessionCostBreakdown(ctx, args.sessionId);
		if (!breakdown) {
			return {
				session_id: args.sessionId,
				total_cost_usd: 0,
				by_task: [],
				by_tool: []
			};
		}

		return {
			session_id: breakdown.sessionId,
			total_cost_usd: breakdown.totalCostUsd,
			by_task: breakdown.byTask.map((task) => ({
				task_id: task.taskId,
				title: task.title,
				cost_usd: task.costUsd,
				tokens: task.tokens
			})),
			by_tool: breakdown.byTool.map((tool) => ({
				tool_name: tool.toolName,
				action_count: tool.actionCount,
				cost_usd: tool.costUsd
			}))
		};
	}
});

export const getTask = internalQuery({
	args: { taskId: v.string() },
	handler: async (ctx, args) => {
		const task = await findTaskByTaskId(ctx, args.taskId);
		return task ? toResponseTask(task) : null;
	}
});

export const getTaskActions = internalQuery({
	args: { taskId: v.string() },
	handler: async (ctx, args) => {
		const task = await findTaskByTaskId(ctx, args.taskId);
		if (!task) {
			return null;
		}

		const actions = await listActionsForTask(ctx, args.taskId);
		return actions.map((action) => toResponseAction(action));
	}
});

export const listTemplates = internalQuery({
	args: {},
	handler: async (ctx) => {
		const templates: Array<ReturnType<typeof toResponseTemplate>> = [];
		for await (const row of ctx.db.query('taskTemplates').withIndex('by_runCount').order('desc')) {
			templates.push(toResponseTemplate(row as TaskTemplateDoc));
		}
		return templates;
	}
});

export const getTemplate = internalQuery({
	args: { templateId: v.string() },
	handler: async (ctx, args) => {
		const template = await findTaskTemplateByTemplateId(ctx, args.templateId);
		return template ? toResponseTemplate(template) : null;
	}
});

export const getTemplateDag = internalQuery({
	args: { templateId: v.string() },
	handler: async (ctx, args) => {
		const template = await findTaskTemplateByTemplateId(ctx, args.templateId);
		if (!template) {
			return null;
		}

		const nodes: Array<ReturnType<typeof toResponseStepNode>> = [];
		for await (const row of ctx.db
			.query('stepNodes')
			.withIndex('by_templateId_and_stepId', (query) => query.eq('templateId', args.templateId))) {
			nodes.push(toResponseStepNode(row as StepNodeDoc));
		}

		const edges: Array<ReturnType<typeof toResponseStepEdge>> = [];
		for await (const row of ctx.db
			.query('stepEdges')
			.withIndex('by_templateId_and_edgeId', (query) => query.eq('templateId', args.templateId))) {
			edges.push(toResponseStepEdge(row as StepEdgeDoc));
		}

		return {
			template: toResponseTemplate(template),
			nodes,
			edges
		};
	}
});

export const getCostAnalytics = internalQuery({
	args: { days: v.number() },
	handler: async (ctx, args) => {
		const threshold = isoDaysAgo(args.days);
		const thresholdHour = hourBucketFor(threshold);
		const byInstance = new Map<string, { instance_id: string; instance_name: string; cost_usd: number }>();
		const byTaskType = new Map<string, { type: string; cost_usd: number }>();
		const byTool = new Map<string, { tool_name: string; action_count: number; cost_usd: number }>();
		const hourlyTrend: Array<{ hour: string; cost_usd: number; action_count: number }> = [];
		let totalCostUsd = 0;
		let totalTokens = 0;

		for await (const row of ctx.db
			.query('analyticsHourly')
			.withIndex('by_hourBucket', (query) => query.gte('hourBucket', thresholdHour))
			.order('asc')) {
			const hour = row as AnalyticsHourlyDoc;
			totalCostUsd += hour.totalCostUsd;
			totalTokens += hour.totalTokens;
			hourlyTrend.push({
				hour: hour.hourBucket,
				cost_usd: hour.totalCostUsd,
				action_count: hour.actionCount
			});

			for (const entry of hour.byInstance) {
				const current = byInstance.get(entry.instanceId) ?? {
					instance_id: entry.instanceId,
					instance_name: entry.instanceName,
					cost_usd: 0
				};
				current.cost_usd = round(current.cost_usd + entry.costUsd);
				byInstance.set(entry.instanceId, current);
			}

			for (const entry of hour.byTaskType) {
				const current = byTaskType.get(entry.type) ?? {
					type: entry.type,
					cost_usd: 0
				};
				current.cost_usd = round(current.cost_usd + entry.costUsd);
				byTaskType.set(entry.type, current);
			}

			for (const entry of hour.byTool) {
				const current = byTool.get(entry.toolName) ?? {
					tool_name: entry.toolName,
					action_count: 0,
					cost_usd: 0
				};
				current.action_count += entry.actionCount;
				current.cost_usd = round(current.cost_usd + entry.costUsd);
				byTool.set(entry.toolName, current);
			}
		}

		let totalTasks = 0;
		for await (const row of ctx.db
			.query('tasks')
			.withIndex('by_lastActionAt', (query) => query.gte('lastActionAt', threshold))
			.order('asc')) {
			const task = row as TaskDoc;
			if (task.lastActionAt >= threshold) {
				totalTasks += 1;
			}
		}

		const roundedTotalCost = round(totalCostUsd);
		const byInstanceRows = Array.from(byInstance.values())
			.sort((left, right) => right.cost_usd - left.cost_usd)
			.map((entry) => ({
				...entry,
				percentage: percent(entry.cost_usd, roundedTotalCost)
			}));

		const byTaskTypeRows = Array.from(byTaskType.values())
			.sort((left, right) => right.cost_usd - left.cost_usd)
			.map((entry) => ({
				...entry,
				percentage: percent(entry.cost_usd, roundedTotalCost)
			}));

		const byToolRows = Array.from(byTool.values())
			.sort((left, right) => right.cost_usd - left.cost_usd)
			.map((entry) => ({
				...entry,
				percentage: percent(entry.cost_usd, roundedTotalCost)
			}));

		return {
			period_days: args.days,
			total_cost_usd: roundedTotalCost,
			total_tokens: totalTokens,
			total_tasks: totalTasks,
			by_instance: byInstanceRows,
			by_task_type: byTaskTypeRows,
			by_tool: byToolRows,
			hourly_trend: hourlyTrend
		};
	}
});
