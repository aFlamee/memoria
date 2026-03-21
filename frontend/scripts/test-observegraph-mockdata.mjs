import assert from 'node:assert/strict';

import { generateObserveGraphMockData, summarizeMockData } from './lib/observegraph-generator.mjs';

const first = generateObserveGraphMockData();
const second = generateObserveGraphMockData();

assert.deepEqual(first, second, 'mock data generation must be deterministic for the same seed');
assert.equal(first.instances.length, 7, 'must generate seven instances');
assert.equal(first.tasks.length, 50, 'must generate fifty task runs');
assert.equal(new Set(first.tasks.map((task) => task.instanceId)).size, 7, 'tasks must be distributed across instances');
assert.ok(first.stepNodes.length > 0, 'must derive step nodes');
assert.ok(first.stepEdges.length > 0, 'must derive step edges');

for (const task of first.tasks) {
	const taskActions = first.actions.filter((action) => action.taskId === task.taskId);
	assert.equal(taskActions.length, task.actionCount, `task ${task.taskId} action count must match`);
}

console.log(JSON.stringify(summarizeMockData(first), null, 2));
