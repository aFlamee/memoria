import { v } from 'convex/values';
import { internalQuery, query } from './_generated/server';

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

export const instanceDetail = query({
	args: { slug: v.string() },
	handler: async (ctx, args) => {
		const instance = await ctx.db.query('instances').withIndex('by_slug', (q) => q.eq('slug', args.slug)).unique();
		if (!instance) {
			return null;
		}

		const sessions = await ctx.db
			.query('sessions')
			.withIndex('by_instanceId_and_startedAt', (q) => q.eq('instanceId', instance.instanceId))
			.order('desc')
			.take(8);

		const tasks = await ctx.db
			.query('tasks')
			.withIndex('by_instanceId_and_startedAt', (q) => q.eq('instanceId', instance.instanceId))
			.order('desc')
			.take(24);

		const templateCounts = new Map<string, number>();
		for (const task of tasks) {
			templateCounts.set(task.templateId, (templateCounts.get(task.templateId) ?? 0) + 1);
		}

		const sortedTemplateIds = [...templateCounts.entries()]
			.sort((left, right) => right[1] - left[1])
			.map(([templateId]) => templateId)
			.slice(0, 4);

		const templates = [];
		for (const templateId of sortedTemplateIds) {
			const template = await ctx.db
				.query('taskTemplates')
				.withIndex('by_templateId', (q) => q.eq('templateId', templateId))
				.unique();
			if (template) {
				templates.push(template);
			}
		}

		const primaryTemplate = templates[0] ?? null;
		const latestTask = tasks[0] ?? null;
		const auditActions = latestTask
			? await ctx.db
					.query('actions')
					.withIndex('by_taskId_and_sequence', (q) => q.eq('taskId', latestTask.taskId))
					.order('asc')
					.take(20)
			: [];

		const graphNodes = primaryTemplate
			? await ctx.db
					.query('stepNodes')
					.withIndex('by_templateId_and_runCount', (q) => q.eq('templateId', primaryTemplate.templateId))
					.order('desc')
					.take(40)
			: [];
		const graphEdges = primaryTemplate
			? await ctx.db
					.query('stepEdges')
					.withIndex('by_templateId_and_runCount', (q) => q.eq('templateId', primaryTemplate.templateId))
					.order('desc')
					.take(40)
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

