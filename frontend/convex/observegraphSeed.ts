import { action, internalMutation, mutation, type MutationCtx } from './_generated/server';
import { internal } from './_generated/api';
import {
	actionArrayValidator,
	instanceArrayValidator,
	seedPayloadValidator,
	sessionArrayValidator,
	stepEdgeArrayValidator,
	stepNodeArrayValidator,
	taskArrayValidator,
	taskTemplateArrayValidator
} from './observegraphValidators';

const TABLES = [
	'analyticsHourly',
	'actions',
	'instanceWeeklyUsage',
	'sessionCostBreakdowns',
	'stepEdges',
	'stepNodes',
	'tasks',
	'sessions',
	'taskTemplates',
	'instances'
] as const;

async function clearTable(ctx: MutationCtx, tableName: (typeof TABLES)[number]) {
	for await (const row of ctx.db.query(tableName)) {
		await ctx.db.delete(row._id);
	}
}

export const resetAll = internalMutation({
	args: {},
	handler: async (ctx) => {
		for (const tableName of TABLES) {
			await clearTable(ctx, tableName);
		}
		return null;
	}
});

export const insertInstances = internalMutation({
	args: { items: instanceArrayValidator },
	handler: async (ctx, args) => {
		for (const item of args.items) {
			await ctx.db.insert('instances', item);
		}
		return args.items.length;
	}
});

export const insertSessions = internalMutation({
	args: { items: sessionArrayValidator },
	handler: async (ctx, args) => {
		for (const item of args.items) {
			await ctx.db.insert('sessions', item);
		}
		return args.items.length;
	}
});

export const insertTasks = internalMutation({
	args: { items: taskArrayValidator },
	handler: async (ctx, args) => {
		for (const item of args.items) {
			await ctx.db.insert('tasks', item);
		}
		return args.items.length;
	}
});

export const insertActions = internalMutation({
	args: { items: actionArrayValidator },
	handler: async (ctx, args) => {
		for (const item of args.items) {
			await ctx.db.insert('actions', item);
		}
		return args.items.length;
	}
});

export const insertTaskTemplates = internalMutation({
	args: { items: taskTemplateArrayValidator },
	handler: async (ctx, args) => {
		for (const item of args.items) {
			await ctx.db.insert('taskTemplates', item);
		}
		return args.items.length;
	}
});

export const insertStepNodes = internalMutation({
	args: { items: stepNodeArrayValidator },
	handler: async (ctx, args) => {
		for (const item of args.items) {
			await ctx.db.insert('stepNodes', item);
		}
		return args.items.length;
	}
});

export const insertStepEdges = internalMutation({
	args: { items: stepEdgeArrayValidator },
	handler: async (ctx, args) => {
		for (const item of args.items) {
			await ctx.db.insert('stepEdges', item);
		}
		return args.items.length;
	}
});

export const importMockData = action({
	args: seedPayloadValidator,
	handler: async (
		ctx,
		args
	): Promise<{
		status: 'imported';
		seed: number;
		counts: {
			instances: number;
			sessions: number;
			tasks: number;
			actions: number;
			taskTemplates: number;
			stepNodes: number;
			stepEdges: number;
		};
	}> => {
		await ctx.runMutation(internal.observegraphSeed.resetAll, {});
		await ctx.runMutation(internal.observegraphSeed.insertInstances, { items: args.instances });
		await ctx.runMutation(internal.observegraphSeed.insertSessions, { items: args.sessions });
		await ctx.runMutation(internal.observegraphSeed.insertTasks, { items: args.tasks });
		await ctx.runMutation(internal.observegraphSeed.insertActions, { items: args.actions });
		await ctx.runMutation(internal.observegraphSeed.insertTaskTemplates, {
			items: args.taskTemplates
		});
		await ctx.runMutation(internal.observegraphSeed.insertStepNodes, { items: args.stepNodes });
		await ctx.runMutation(internal.observegraphSeed.insertStepEdges, { items: args.stepEdges });
		return {
			status: 'imported',
			seed: args.meta.seed,
			counts: {
				instances: args.instances.length,
				sessions: args.sessions.length,
				tasks: args.tasks.length,
				actions: args.actions.length,
				taskTemplates: args.taskTemplates.length,
				stepNodes: args.stepNodes.length,
				stepEdges: args.stepEdges.length
			}
		};
	}
});

export const clearObserveGraph = mutation({
	args: {},
	handler: async (ctx) => {
		await ctx.scheduler.runAfter(0, internal.observegraphSeed.resetAll, {});
		return { status: 'scheduled' };
	}
});
