import { v } from 'convex/values';

import { internal } from './_generated/api';
import { query, type QueryCtx } from './_generated/server';

type StoreInstance = {
	instance_id: string;
	name: string;
	host: string;
	port: number;
	environment: 'development' | 'production' | 'staging';
	os: string | null;
	arch: string | null;
	zeroclaw_version: string | null;
	model_default: string | null;
	registered_at: string;
	last_seen_at: string | null;
	status: 'online' | 'offline' | 'idle';
	is_pinned: boolean;
	tags: string[];
	session_count: number;
};

type StoreWeeklyUsage = {
	instance_id: string;
	instance_name: string;
	sessions: number;
	tasks: number;
	actions: number;
	total_tokens: number;
	total_cost_usd: number;
};

type StoreSession = {
	session_id: string;
	instance_id: string;
	trigger: string;
	working_dir: string | null;
	git_repo: string | null;
	git_branch: string | null;
	git_commit: string | null;
	model_override: string | null;
	started_at: string;
	ended_at: string | null;
	duration_ms: number | null;
	status: 'running' | 'completed' | 'failed' | 'killed';
	total_tokens: number;
	total_cost_usd: number;
	task_count: number;
	action_count: number;
	exit_code: number | null;
	notes: string | null;
};

type StoreTask = {
	task_id: string;
	session_id: string;
	instance_id: string;
	title: string;
	description: string | null;
	type: string;
	technologies: string[];
	status: 'in_progress' | 'completed' | 'failed';
	priority: 'low' | 'medium' | 'high';
	started_at: string;
	completed_at: string | null;
	duration_ms: number | null;
	total_tokens: number;
	thinking_tokens: number;
	output_tokens: number;
	total_cost_usd: number;
	action_count: number;
	is_bookmarked: boolean;
	rating: number | null;
	tags: string[];
	error: string | null;
};

type StoreAction = {
	action_id: string;
	task_id: string;
	instance_id: string;
	type: string;
	tool_name: string;
	command: string | null;
	file_path: string | null;
	file_size_bytes: number | null;
	stdout: string | null;
	stderr: string | null;
	exit_code: number | null;
	permission_level: string;
	risk_score: number;
	is_flagged: boolean;
	flag_reason: string | null;
	status: string;
	started_at: string;
	ended_at: string;
	duration_ms: number;
	sequence: number | null;
	step_name: string | null;
	reasoning: string | null;
	thinking_tokens: number;
	output_tokens: number;
	total_tokens: number;
	model_used: string | null;
	cost_usd: number;
	retry_count: number;
	is_recovery: boolean;
};

type StoreSessionCostBreakdown = {
	session_id: string;
	total_cost_usd: number;
	by_task: Array<{ task_id: string; title: string; cost_usd: number; tokens: number }>;
	by_tool: Array<{ tool_name: string; action_count: number; cost_usd: number }>;
};

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

function actionTone(action: {
	sequence: number;
	status: string;
	type: string;
	risk_score: number;
	is_recovery: boolean;
}) {
	if (action.sequence === 1) return 'entry' as const;
	if (action.is_recovery) return 'exit' as const;
	if (action.status !== 'success' || action.risk_score >= 0.2) return 'risk' as const;
	if (action.type === 'file_write' || action.type === 'shell') return 'write' as const;
	return 'core' as const;
}

async function getSessionTaskTitles(ctx: QueryCtx, sessionId: string): Promise<string[]> {
	const breakdown: StoreSessionCostBreakdown | null = await ctx.runQuery(
		internal.observegraphStore.getSessionCostBreakdown,
		{ sessionId }
	);
	if (!breakdown) {
		return [];
	}
	return breakdown.by_task.slice(0, 3).map((task: { title: string }) => task.title);
}

export const dashboard = query({
	args: {},
	handler: async (ctx): Promise<{
		generatedAt: string;
		instances: Array<Record<string, unknown>>;
	}> => {
		const instances: StoreInstance[] = await ctx.runQuery(internal.observegraphStore.listInstances, {});
		const withUsage: Array<{ instance: StoreInstance; usage: StoreWeeklyUsage | null }> = await Promise.all(
			instances.map(async (instance: StoreInstance) => {
				const usage: StoreWeeklyUsage | null = await ctx.runQuery(internal.observegraphStore.getWeeklyUsage, {
					instanceId: instance.instance_id
				});
				return { instance, usage };
			})
		);

		return {
			generatedAt: new Date().toISOString(),
			instances: withUsage.map(({ instance, usage }: { instance: StoreInstance; usage: StoreWeeklyUsage | null }) => ({
				slug: instance.instance_id,
				name: instance.name,
				status: instance.status,
				environment: instance.environment,
				modelDefault: instance.model_default ?? 'unknown',
				host: instance.host,
				lastSeenAt: instance.last_seen_at ?? instance.registered_at,
				lastSeenLabel: formatRelativeTime(instance.last_seen_at ?? instance.registered_at),
				runningTasks: 0,
				completedToday: 0,
				sessionCount7d: usage?.sessions ?? 0,
				taskCount7d: usage?.tasks ?? 0,
				actionCount7d: usage?.actions ?? 0,
				totalTokens7d: usage?.total_tokens ?? 0,
				totalTokens7dLabel: compactTokens(usage?.total_tokens ?? 0),
				totalCostUsd7d: usage?.total_cost_usd ?? 0,
				totalCostUsd7dLabel: currency(usage?.total_cost_usd ?? 0),
				tags: instance.tags
			}))
		};
	}
});

export const instanceOverview = query({
	args: { slug: v.string() },
	handler: async (ctx, args): Promise<Record<string, unknown> | null> => {
		const instance: StoreInstance | null = await ctx.runQuery(internal.observegraphStore.getInstance, {
			instanceId: args.slug
		});
		if (!instance) {
			return null;
		}

		return {
			instance: {
				slug: instance.instance_id,
				name: instance.name,
				status: instance.status,
				environment: instance.environment,
				modelDefault: instance.model_default ?? 'unknown',
				host: instance.host,
				os: instance.os ?? 'unknown',
				arch: instance.arch ?? 'unknown',
				zeroclawVersion: instance.zeroclaw_version ?? 'unknown',
				lastSeenAt: instance.last_seen_at ?? instance.registered_at,
				lastSeenLabel: formatRelativeTime(instance.last_seen_at ?? instance.registered_at),
				totalTokens7dLabel: '0',
				totalCostUsd7dLabel: '$0.00',
				metrics: {
					sessionCount7d: 0,
					taskCount7d: 0,
					actionCount7d: 0,
					completedToday: 0,
					runningTasks: 0,
					totalTokens7d: 0,
					totalCostUsd7d: 0
				},
				tags: instance.tags
			},
			sessions: []
		};
	}
});

export const sessionDetail = query({
	args: { slug: v.string(), sessionId: v.string() },
	handler: async (ctx, args): Promise<Record<string, unknown> | null> => {
		const instance: StoreInstance | null = await ctx.runQuery(internal.observegraphStore.getInstance, {
			instanceId: args.slug
		});
		const session: StoreSession | null = await ctx.runQuery(internal.observegraphStore.getSession, {
			sessionId: args.sessionId
		});
		if (!instance || !session || session.instance_id !== args.slug) {
			return null;
		}

		const breakdown: StoreSessionCostBreakdown | null = await ctx.runQuery(
			internal.observegraphStore.getSessionCostBreakdown,
			{
			sessionId: args.sessionId
			}
		);
		const tasks: Array<Record<string, unknown> | null> = await Promise.all(
			(breakdown?.by_task ?? []).map(async (taskSummary: { task_id: string }) => {
				const task: StoreTask | null = await ctx.runQuery(internal.observegraphStore.getTask, {
					taskId: taskSummary.task_id
				});
				const actions: StoreAction[] | null = await ctx.runQuery(internal.observegraphStore.getTaskActions, {
					taskId: taskSummary.task_id
				});
				if (!task || !actions) {
					return null;
				}

				const nodes = actions.map((action: StoreAction) => ({
					id: action.action_id,
					actionId: action.action_id,
					label: action.step_name ?? action.action_id,
					toolName: action.tool_name,
					type: action.type,
					status: action.status,
					durationMs: action.duration_ms,
					totalTokens: action.total_tokens,
					riskScore: action.risk_score,
					permissionLevel: action.permission_level,
					tone: actionTone({
						sequence: action.sequence ?? 0,
						status: action.status,
						type: action.type,
						risk_score: action.risk_score,
						is_recovery: action.is_recovery
					})
				}));

				const edges = actions.slice(0, -1).map((action: StoreAction, index: number) => {
					const nextAction = actions[index + 1];
					return {
						id: `${action.action_id}__${nextAction.action_id}`,
						source: action.action_id,
						target: nextAction.action_id,
						label: `${action.step_name ?? action.action_id} -> ${nextAction.step_name ?? nextAction.action_id}`,
						sourceLabel: action.step_name ?? action.action_id,
						targetLabel: nextAction.step_name ?? nextAction.action_id,
						traversalCount: 1,
						successRate: action.status === 'success' && nextAction.status === 'success' ? 1 : 0,
						totalTokens: action.total_tokens + nextAction.total_tokens,
						avgLatencyMs: Math.round((action.duration_ms + nextAction.duration_ms) / 2)
					};
				});

				return {
					taskId: task.task_id,
					title: task.title,
					status: task.status,
					durationMs: task.duration_ms ?? 0,
					totalTokens: task.total_tokens,
					totalTokensLabel: compactTokens(task.total_tokens),
					totalCostUsd: task.total_cost_usd,
					totalCostUsdLabel: currency(task.total_cost_usd),
					actionCount: task.action_count,
					nodes,
					edges
				};
			})
		);

		return {
			instance: {
				slug: instance.instance_id,
				name: instance.name,
				status: instance.status,
				environment: instance.environment,
				modelDefault: instance.model_default ?? 'unknown',
				host: instance.host,
				os: instance.os ?? 'unknown',
				arch: instance.arch ?? 'unknown',
				zeroclawVersion: instance.zeroclaw_version ?? 'unknown',
				lastSeenAt: instance.last_seen_at ?? instance.registered_at,
				lastSeenLabel: formatRelativeTime(instance.last_seen_at ?? instance.registered_at),
				totalTokens7dLabel: '0',
				totalCostUsd7dLabel: '$0.00',
				metrics: {
					sessionCount7d: 0,
					taskCount7d: 0,
					actionCount7d: 0,
					completedToday: 0,
					runningTasks: 0,
					totalTokens7d: 0,
					totalCostUsd7d: 0
				},
				tags: instance.tags
			},
			session: {
				sessionId: session.session_id,
				trigger: session.trigger,
				status: session.status,
				startedAt: session.started_at,
				durationMs: session.duration_ms ?? 0,
				totalTokens: session.total_tokens,
				totalTokensLabel: compactTokens(session.total_tokens),
				totalCostUsd: session.total_cost_usd,
				totalCostUsdLabel: currency(session.total_cost_usd),
				taskCount: session.task_count,
				actionCount: session.action_count,
				gitBranch: session.git_branch ?? '',
				notes: session.notes,
				taskTitles: await getSessionTaskTitles(ctx, args.sessionId),
				tasks: tasks.filter((task: Record<string, unknown> | null): task is Record<string, unknown> => task !== null)
			}
		};
	}
});
