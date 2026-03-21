import { defineSchema, defineTable } from 'convex/server';

import {
	actionValidator,
	analyticsHourlyValidator,
	instanceValidator,
	instanceWeeklyUsageValidator,
	sessionCostBreakdownValidator,
	sessionValidator,
	stepEdgeValidator,
	stepNodeValidator,
	taskTemplateValidator,
	taskValidator
} from './observegraphValidators';

export default defineSchema({
	instances: defineTable(instanceValidator)
		.index('by_slug', ['slug'])
		.index('by_instanceId', ['instanceId'])
		.index('by_status', ['status']),
	sessions: defineTable(sessionValidator)
		.index('by_sessionId', ['sessionId'])
		.index('by_instanceId_and_startedAt', ['instanceId', 'startedAt'])
		.index('by_startedAt', ['startedAt']),
	tasks: defineTable(taskValidator)
		.index('by_taskId', ['taskId'])
		.index('by_instanceId_and_startedAt', ['instanceId', 'startedAt'])
		.index('by_sessionId_and_startedAt', ['sessionId', 'startedAt'])
		.index('by_templateId_and_startedAt', ['templateId', 'startedAt'])
		.index('by_lastActionAt', ['lastActionAt']),
	actions: defineTable(actionValidator)
		.index('by_actionId', ['actionId'])
		.index('by_taskId_and_sequence', ['taskId', 'sequence'])
		.index('by_instanceId_and_startedAt', ['instanceId', 'startedAt'])
		.index('by_startedAt', ['startedAt']),
	taskTemplates: defineTable(taskTemplateValidator)
		.index('by_templateId', ['templateId'])
		.index('by_runCount', ['runCount']),
	stepNodes: defineTable(stepNodeValidator)
		.index('by_templateId_and_stepId', ['templateId', 'stepId'])
		.index('by_templateId_and_runCount', ['templateId', 'runCount']),
	stepEdges: defineTable(stepEdgeValidator)
		.index('by_templateId_and_edgeId', ['templateId', 'edgeId'])
		.index('by_templateId_and_runCount', ['templateId', 'runCount']),
	instanceWeeklyUsage: defineTable(instanceWeeklyUsageValidator).index('by_instanceId', ['instanceId']),
	sessionCostBreakdowns: defineTable(sessionCostBreakdownValidator).index('by_sessionId', ['sessionId']),
	analyticsHourly: defineTable(analyticsHourlyValidator).index('by_hourBucket', ['hourBucket'])
});
