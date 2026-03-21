import { httpRouter } from 'convex/server';

import { internal } from './_generated/api';
import { httpAction } from './_generated/server';

const http = httpRouter();

function unauthorized() {
	return Response.json({ detail: 'Unauthorized' }, { status: 401 });
}

function ensureSecret(req: Request) {
	const expected = process.env.MEMORIA_CONVEX_INGEST_SECRET;
	if (!expected) {
		throw new Error('MEMORIA_CONVEX_INGEST_SECRET is not configured');
	}

	return req.headers.get('x-memoria-ingest-secret') === expected;
}

async function jsonBody(req: Request) {
	return (await req.json()) as Record<string, unknown>;
}

http.route({
	path: '/internal/observegraph/instances',
	method: 'GET',
	handler: httpAction(async (ctx, req) => {
		if (!ensureSecret(req)) return unauthorized();
		const payload = await ctx.runQuery(internal.observegraphStore.listInstances, {});
		return Response.json(payload);
	})
});

http.route({
	path: '/internal/observegraph/instances/get',
	method: 'POST',
	handler: httpAction(async (ctx, req) => {
		if (!ensureSecret(req)) return unauthorized();
		const body = await jsonBody(req);
		const payload = await ctx.runQuery(internal.observegraphStore.getInstance, {
			instanceId: String(body.instanceId)
		});
		if (!payload) {
			return Response.json({ detail: 'Instance not found' }, { status: 404 });
		}
		return Response.json(payload);
	})
});

http.route({
	path: '/internal/observegraph/instances/weekly-usage/get',
	method: 'POST',
	handler: httpAction(async (ctx, req) => {
		if (!ensureSecret(req)) return unauthorized();
		const body = await jsonBody(req);
		const payload = await ctx.runQuery(internal.observegraphStore.getWeeklyUsage, {
			instanceId: String(body.instanceId)
		});
		if (!payload) {
			return Response.json({ detail: 'Instance not found' }, { status: 404 });
		}
		return Response.json(payload);
	})
});

http.route({
	path: '/internal/observegraph/instances/register',
	method: 'POST',
	handler: httpAction(async (ctx, req) => {
		if (!ensureSecret(req)) return unauthorized();
		const body = await jsonBody(req);
		const payload = await ctx.runMutation(internal.observegraphStore.upsertInstance, {
			instanceId: String(body.instanceId),
			slug: String(body.slug),
			name: String(body.name),
			host: String(body.host),
			port: Number(body.port),
			environment: body.environment as 'development' | 'production' | 'staging',
			os: (body.os as string | null) ?? null,
			arch: (body.arch as string | null) ?? null,
			zeroclawVersion: (body.zeroclawVersion as string | null) ?? null,
			modelDefault: (body.modelDefault as string | null) ?? null,
			registeredAt: String(body.registeredAt),
			lastSeenAt: (body.lastSeenAt as string | null) ?? null,
			status: body.status as 'online' | 'offline' | 'idle',
			isPinned: Boolean(body.isPinned),
			tags: Array.isArray(body.tags) ? body.tags.map(String) : []
		});
		return Response.json(payload, { status: 201 });
	})
});

http.route({
	path: '/internal/observegraph/instances/heartbeat',
	method: 'POST',
	handler: httpAction(async (ctx, req) => {
		if (!ensureSecret(req)) return unauthorized();
		const body = await jsonBody(req);
		const payload = await ctx.runMutation(internal.observegraphStore.heartbeatInstance, {
			instanceId: String(body.instanceId),
			lastSeenAt: String(body.lastSeenAt)
		});
		if (!payload) {
			return Response.json({ detail: 'Instance not found' }, { status: 404 });
		}
		return Response.json(payload);
	})
});

http.route({
	path: '/internal/observegraph/sessions/get',
	method: 'POST',
	handler: httpAction(async (ctx, req) => {
		if (!ensureSecret(req)) return unauthorized();
		const body = await jsonBody(req);
		const payload = await ctx.runQuery(internal.observegraphStore.getSession, {
			sessionId: String(body.sessionId)
		});
		if (!payload) {
			return Response.json({ detail: 'Session not found' }, { status: 404 });
		}
		return Response.json(payload);
	})
});

http.route({
	path: '/internal/observegraph/sessions/cost-breakdown/get',
	method: 'POST',
	handler: httpAction(async (ctx, req) => {
		if (!ensureSecret(req)) return unauthorized();
		const body = await jsonBody(req);
		const payload = await ctx.runQuery(internal.observegraphStore.getSessionCostBreakdown, {
			sessionId: String(body.sessionId)
		});
		if (!payload) {
			return Response.json({ detail: 'Session not found' }, { status: 404 });
		}
		return Response.json(payload);
	})
});

http.route({
	path: '/internal/observegraph/sessions/create',
	method: 'POST',
	handler: httpAction(async (ctx, req) => {
		if (!ensureSecret(req)) return unauthorized();
		const body = await jsonBody(req);
		const payload = await ctx.runMutation(internal.observegraphStore.upsertSession, {
			sessionId: String(body.sessionId),
			instanceId: String(body.instanceId),
			trigger: String(body.trigger),
			workingDir: (body.workingDir as string | null) ?? null,
			gitRepo: (body.gitRepo as string | null) ?? null,
			gitBranch: (body.gitBranch as string | null) ?? null,
			gitCommit: (body.gitCommit as string | null) ?? null,
			modelOverride: (body.modelOverride as string | null) ?? null,
			startedAt: String(body.startedAt),
			endedAt: (body.endedAt as string | null) ?? null,
			durationMs: (body.durationMs as number | null) ?? null,
			status: body.status as 'running' | 'completed' | 'failed' | 'killed',
			totalTokens: Number(body.totalTokens),
			totalCostUsd: Number(body.totalCostUsd),
			taskCount: Number(body.taskCount),
			actionCount: Number(body.actionCount),
			exitCode: (body.exitCode as number | null) ?? null,
			notes: (body.notes as string | null) ?? null
		});
		if (!payload) {
			return Response.json({ detail: 'Instance not found' }, { status: 404 });
		}
		return Response.json(payload, { status: 201 });
	})
});

http.route({
	path: '/internal/observegraph/sessions/update',
	method: 'POST',
	handler: httpAction(async (ctx, req) => {
		if (!ensureSecret(req)) return unauthorized();
		const body = await jsonBody(req);
		const payload = await ctx.runMutation(internal.observegraphStore.patchSession, {
			sessionId: String(body.sessionId),
			status: (body.status as 'running' | 'completed' | 'failed' | 'killed' | null) ?? null,
			endedAt: (body.endedAt as string | null) ?? null,
			durationMs: (body.durationMs as number | null) ?? null,
			totalTokens: (body.totalTokens as number | null) ?? null,
			totalCostUsd: (body.totalCostUsd as number | null) ?? null,
			taskCount: (body.taskCount as number | null) ?? null,
			actionCount: (body.actionCount as number | null) ?? null,
			exitCode: (body.exitCode as number | null) ?? null,
			notes: (body.notes as string | null) ?? null
		});
		if (!payload) {
			return Response.json({ detail: 'Session not found' }, { status: 404 });
		}
		return Response.json(payload);
	})
});

http.route({
	path: '/internal/observegraph/tasks/get',
	method: 'POST',
	handler: httpAction(async (ctx, req) => {
		if (!ensureSecret(req)) return unauthorized();
		const body = await jsonBody(req);
		const payload = await ctx.runQuery(internal.observegraphStore.getTask, {
			taskId: String(body.taskId)
		});
		if (!payload) {
			return Response.json({ detail: 'Task not found' }, { status: 404 });
		}
		return Response.json(payload);
	})
});

http.route({
	path: '/internal/observegraph/tasks/actions/get',
	method: 'POST',
	handler: httpAction(async (ctx, req) => {
		if (!ensureSecret(req)) return unauthorized();
		const body = await jsonBody(req);
		const payload = await ctx.runQuery(internal.observegraphStore.getTaskActions, {
			taskId: String(body.taskId)
		});
		if (!payload) {
			return Response.json({ detail: 'Task not found' }, { status: 404 });
		}
		return Response.json(payload);
	})
});

http.route({
	path: '/internal/observegraph/tasks/create',
	method: 'POST',
	handler: httpAction(async (ctx, req) => {
		if (!ensureSecret(req)) return unauthorized();
		const body = await jsonBody(req);
		const payload = await ctx.runMutation(internal.observegraphStore.upsertTask, {
			taskId: String(body.taskId),
			sessionId: String(body.sessionId),
			instanceId: String(body.instanceId),
			title: String(body.title),
			description: (body.description as string | null) ?? null,
			type: body.type as
				| 'code'
				| 'research'
				| 'file_ops'
				| 'shell'
				| 'browser'
				| 'data'
				| 'ui'
				| 'analysis'
				| 'backend',
			technologies: Array.isArray(body.technologies) ? body.technologies.map(String) : [],
			status: body.status as 'in_progress' | 'completed' | 'failed',
			priority: body.priority as 'low' | 'medium' | 'high',
			startedAt: String(body.startedAt),
			completedAt: (body.completedAt as string | null) ?? null,
			durationMs: (body.durationMs as number | null) ?? null,
			totalTokens: Number(body.totalTokens),
			thinkingTokens: Number(body.thinkingTokens),
			outputTokens: Number(body.outputTokens),
			totalCostUsd: Number(body.totalCostUsd),
			actionCount: Number(body.actionCount),
			isBookmarked: Boolean(body.isBookmarked),
			rating: (body.rating as number | null) ?? null,
			tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
			error: (body.error as string | null) ?? null
		});
		if (!payload) {
			return Response.json({ detail: 'Session not found' }, { status: 404 });
		}
		return Response.json(payload, { status: 201 });
	})
});

http.route({
	path: '/internal/observegraph/tasks/update',
	method: 'POST',
	handler: httpAction(async (ctx, req) => {
		if (!ensureSecret(req)) return unauthorized();
		const body = await jsonBody(req);
		const payload = await ctx.runMutation(internal.observegraphStore.patchTask, {
			taskId: String(body.taskId),
			status: (body.status as 'in_progress' | 'completed' | 'failed' | null) ?? null,
			completedAt: (body.completedAt as string | null) ?? null,
			durationMs: (body.durationMs as number | null) ?? null,
			totalTokens: (body.totalTokens as number | null) ?? null,
			thinkingTokens: (body.thinkingTokens as number | null) ?? null,
			outputTokens: (body.outputTokens as number | null) ?? null,
			totalCostUsd: (body.totalCostUsd as number | null) ?? null,
			actionCount: (body.actionCount as number | null) ?? null,
			isBookmarked: (body.isBookmarked as boolean | null) ?? null,
			rating: (body.rating as number | null) ?? null,
			error: (body.error as string | null) ?? null
		});
		if (!payload) {
			return Response.json({ detail: 'Task not found' }, { status: 404 });
		}
		return Response.json(payload);
	})
});

http.route({
	path: '/internal/observegraph/actions/create',
	method: 'POST',
	handler: httpAction(async (ctx, req) => {
		if (!ensureSecret(req)) return unauthorized();
		const body = await jsonBody(req);
		const payload = await ctx.runMutation(internal.observegraphStore.upsertAction, {
			actionId: String(body.actionId),
			taskId: String(body.taskId),
			instanceId: String(body.instanceId),
			sequence: Number(body.sequence),
			stepName: String(body.stepName),
			type: body.type as 'file_read' | 'file_write' | 'shell' | 'llm_call' | 'http' | 'tool_use',
			toolName: String(body.toolName),
			command: (body.command as string | null) ?? null,
			filePath: (body.filePath as string | null) ?? null,
			fileSizeBytes: (body.fileSizeBytes as number | null) ?? null,
			stdout: (body.stdout as string | null) ?? null,
			stderr: (body.stderr as string | null) ?? null,
			exitCode: (body.exitCode as number | null) ?? null,
			permissionLevel: body.permissionLevel as 'read' | 'write' | 'admin' | 'dangerous',
			riskScore: Number(body.riskScore),
			isFlagged: Boolean(body.isFlagged),
			flagReason: (body.flagReason as string | null) ?? null,
			status: body.status as 'success' | 'failed' | 'skipped',
			startedAt: String(body.startedAt),
			endedAt: String(body.endedAt),
			durationMs: Number(body.durationMs),
			reasoning: (body.reasoning as string | null) ?? null,
			thinkingTokens: Number(body.thinkingTokens),
			outputTokens: Number(body.outputTokens),
			totalTokens: Number(body.totalTokens),
			modelUsed: (body.modelUsed as string | null) ?? null,
			latencyMs: (body.latencyMs as number | null) ?? null,
			costUsd: Number(body.costUsd),
			retryCount: Number(body.retryCount),
			isRecovery: Boolean(body.isRecovery)
		});
		if (!payload) {
			return Response.json({ detail: 'Task not found' }, { status: 404 });
		}
		return Response.json(payload, { status: 201 });
	})
});

http.route({
	path: '/internal/observegraph/actions/flag',
	method: 'POST',
	handler: httpAction(async (ctx, req) => {
		if (!ensureSecret(req)) return unauthorized();
		const body = await jsonBody(req);
		const payload = await ctx.runMutation(internal.observegraphStore.flagAction, {
			actionId: String(body.actionId),
			isFlagged: Boolean(body.isFlagged),
			reason: (body.reason as string | null) ?? null
		});
		if (!payload) {
			return Response.json({ detail: 'Action not found' }, { status: 404 });
		}
		return Response.json(payload);
	})
});

http.route({
	path: '/internal/observegraph/templates',
	method: 'GET',
	handler: httpAction(async (ctx, req) => {
		if (!ensureSecret(req)) return unauthorized();
		const payload = await ctx.runQuery(internal.observegraphStore.listTemplates, {});
		return Response.json(payload);
	})
});

http.route({
	path: '/internal/observegraph/templates/get',
	method: 'POST',
	handler: httpAction(async (ctx, req) => {
		if (!ensureSecret(req)) return unauthorized();
		const body = await jsonBody(req);
		const payload = await ctx.runQuery(internal.observegraphStore.getTemplate, {
			templateId: String(body.templateId)
		});
		if (!payload) {
			return Response.json({ detail: 'Template not found' }, { status: 404 });
		}
		return Response.json(payload);
	})
});

http.route({
	path: '/internal/observegraph/templates/dag/get',
	method: 'POST',
	handler: httpAction(async (ctx, req) => {
		if (!ensureSecret(req)) return unauthorized();
		const body = await jsonBody(req);
		const payload = await ctx.runQuery(internal.observegraphStore.getTemplateDag, {
			templateId: String(body.templateId)
		});
		if (!payload) {
			return Response.json({ detail: 'Template not found' }, { status: 404 });
		}
		return Response.json(payload);
	})
});

http.route({
	path: '/internal/observegraph/analytics/costs',
	method: 'GET',
	handler: httpAction(async (ctx, req) => {
		if (!ensureSecret(req)) return unauthorized();
		const url = new URL(req.url);
		const days = Number(url.searchParams.get('days') ?? '7');
		const payload = await ctx.runQuery(internal.observegraphStore.getCostAnalytics, { days });
		return Response.json(payload);
	})
});

export default http;
