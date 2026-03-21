import assert from 'node:assert/strict';

import { generateObserveGraphMockData, summarizeMockData } from './lib/observegraph-generator.mjs';

const first = generateObserveGraphMockData();
const second = generateObserveGraphMockData();
const actionCounts = first.tasks.map((task) => task.actionCount);
const sharedRootActions = first.actions.filter(
	(action) => action.sequence === 1 && action.stepName === 'load root task context'
);
const maxTasksPerSession = Math.max(...first.sessions.map((session) => session.taskCount));
const averageActionsPerTask =
	actionCounts.reduce((total, count) => total + count, 0) / actionCounts.length;

assert.deepEqual(first, second, 'mock data generation must be deterministic for the same seed');
assert.equal(first.instances.length, 7, 'must generate seven instances');
assert.equal(first.tasks.length, 50, 'must generate fifty task runs');
assert.equal(first.sessions.length, 12, 'must pack runs into twelve denser sessions');
assert.equal(
	new Set(first.tasks.map((task) => task.instanceId)).size,
	7,
	'tasks must be distributed across instances'
);
assert.ok(first.stepNodes.length > 0, 'must derive step nodes');
assert.ok(first.stepEdges.length > 0, 'must derive step edges');
assert.equal(
	sharedRootActions.length,
	first.tasks.length,
	'every task must start from the shared root action'
);
assert.equal(
	Math.min(...actionCounts),
	2,
	'compact runs should keep the minimum action count at two'
);
assert.equal(
	Math.max(...actionCounts),
	3,
	'compact runs should cap the maximum action count at three'
);
assert.ok(averageActionsPerTask <= 2.25, 'average action count should stay compact');
assert.ok(maxTasksPerSession >= 6, 'at least one session should aggregate many compact tasks');

for (const task of first.tasks) {
	const taskActions = first.actions.filter((action) => action.taskId === task.taskId);
	assert.equal(taskActions.length, task.actionCount, `task ${task.taskId} action count must match`);
}

console.log(JSON.stringify(summarizeMockData(first), null, 2));
