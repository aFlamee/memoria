import assert from 'node:assert/strict';

import { generateObserveGraphMockData, summarizeMockData } from './lib/observegraph-generator.mjs';

const first = generateObserveGraphMockData();
const second = generateObserveGraphMockData();
const actionCounts = first.tasks.map((task) => task.actionCount);
const sharedRootActions = first.actions.filter(
	(action) => action.sequence === 1 && action.stepName === 'load root task context'
);
const maxTasksPerSession = Math.max(...first.sessions.map((session) => session.taskCount));

assert.deepEqual(first, second, 'mock data generation must be deterministic for the same seed');
assert.equal(first.instances.length, 3, 'must generate three instances');
assert.ok(first.tasks.length >= 24, 'must generate at least twenty-four task runs');
assert.equal(first.sessions.length, 6, 'must have six sessions (2 per instance)');
assert.equal(
	new Set(first.tasks.map((task) => task.instanceId)).size,
	3,
	'tasks must be distributed across three instances'
);
assert.ok(first.stepNodes.length > 0, 'must derive step nodes');
assert.ok(first.stepEdges.length > 0, 'must derive step edges');
assert.equal(
	sharedRootActions.length,
	first.tasks.length,
	'every task must start from the shared root action'
);
assert.ok(
	Math.min(...actionCounts) >= 4,
	'minimum action count must be at least 4 (entry + path steps)'
);
assert.ok(Math.max(...actionCounts) <= 7, 'maximum action count must be at most 7');
assert.ok(maxTasksPerSession >= 4, 'at least four tasks per session');

for (const task of first.tasks) {
	const taskActions = first.actions.filter((action) => action.taskId === task.taskId);
	assert.equal(taskActions.length, task.actionCount, `task ${task.taskId} action count must match`);
}

// Verify developer-friendly naming
const instanceSlugs = new Set(first.instances.map((i) => i.slug));
assert.ok(instanceSlugs.has('local-dev'), 'must include local-dev instance');
assert.ok(instanceSlugs.has('staging-runner'), 'must include staging-runner instance');
assert.ok(instanceSlugs.has('ci-github-actions'), 'must include ci-github-actions instance');

console.log(JSON.stringify(summarizeMockData(first), null, 2));
