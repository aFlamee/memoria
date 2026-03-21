import { createHash } from 'node:crypto';

const TOTAL_TASK_RUNS = 50;
const INSTANCE_COUNT = 7;
const SESSION_TASK_COUNTS = [3, 3, 2, 4, 3, 2, 4, 3, 2, 4, 3, 2, 3, 3, 2, 3, 2, 2];

function mulberry32(seed) {
	let value = seed >>> 0;
	return () => {
		value += 0x6d2b79f5;
		let next = Math.imul(value ^ (value >>> 15), 1 | value);
		next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
		return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
	};
}

function slugify(input) {
	return input
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
}

function pick(rng, values) {
	return values[Math.floor(rng() * values.length)];
}

function between(rng, min, max) {
	return Math.round(min + (max - min) * rng());
}

function sum(values) {
	return values.reduce((total, value) => total + value, 0);
}

function average(values) {
	return values.length === 0 ? 0 : sum(values) / values.length;
}

function hashSnapshot(value) {
	return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

const instanceBlueprints = [
	{
		slug: 'atlas',
		name: 'Atlas',
		host: '10.10.1.10',
		environment: 'development',
		os: 'ubuntu-24.04',
		arch: 'x86_64',
		zeroclawVersion: '0.4.2',
		modelDefault: 'claude-3-7-sonnet',
		isPinned: true,
		tags: ['main', 'orchestrator', 'dev']
	},
	{
		slug: 'sable',
		name: 'Sable',
		host: '10.10.1.11',
		environment: 'production',
		os: 'ubuntu-24.04',
		arch: 'x86_64',
		zeroclawVersion: '0.4.2',
		modelDefault: 'claude-3-7-sonnet',
		isPinned: true,
		tags: ['archive', 'prod']
	},
	{
		slug: 'rune',
		name: 'Rune',
		host: '10.10.1.12',
		environment: 'staging',
		os: 'ubuntu-24.04',
		arch: 'arm64',
		zeroclawVersion: '0.4.2',
		modelDefault: 'claude-3-5-haiku',
		isPinned: false,
		tags: ['integration', 'staging']
	},
	{
		slug: 'meridian',
		name: 'Meridian',
		host: '10.10.1.13',
		environment: 'production',
		os: 'debian-12',
		arch: 'x86_64',
		zeroclawVersion: '0.4.1',
		modelDefault: 'claude-3-7-sonnet',
		isPinned: false,
		tags: ['analytics', 'prod']
	},
	{
		slug: 'quill',
		name: 'Quill',
		host: '10.10.1.14',
		environment: 'development',
		os: 'macos-15',
		arch: 'arm64',
		zeroclawVersion: '0.4.2',
		modelDefault: 'gpt-5-mini',
		isPinned: false,
		tags: ['local', 'ux']
	},
	{
		slug: 'ember',
		name: 'Ember',
		host: '10.10.1.15',
		environment: 'staging',
		os: 'ubuntu-24.04',
		arch: 'x86_64',
		zeroclawVersion: '0.4.1',
		modelDefault: 'claude-3-5-haiku',
		isPinned: false,
		tags: ['watcher', 'alerts']
	},
	{
		slug: 'vector',
		name: 'Vector',
		host: '10.10.1.16',
		environment: 'production',
		os: 'ubuntu-24.04',
		arch: 'x86_64',
		zeroclawVersion: '0.4.2',
		modelDefault: 'gpt-5-mini',
		isPinned: false,
		tags: ['cost', 'reporting']
	}
];

const templateBlueprints = [
	{
		slug: 'create_observer_crate',
		title: 'Create observer crate in zeroclaw',
		description: 'Add crates/observer with fire-and-forget HTTP emitter.',
		type: 'code',
		priority: 'high',
		technologies: ['rust', 'tokio', 'neo4j'],
		tags: ['observer', 'instrumentation'],
		baseSteps: [
			step('read project manifest', 'read_file', 'file_read', { filePath: '/workspace/Cargo.toml' }),
			step('plan implementation', 'llm_plan', 'llm_call'),
			step('write observer library', 'write_file', 'file_write', { filePath: '/workspace/crates/observer/src/lib.rs' }),
			step('build observer crate', 'bash', 'shell', { command: 'cargo build -p observer' })
		],
		branchSteps: [
			step('fix type mismatch', 'write_file', 'file_write', {
				filePath: '/workspace/crates/observer/src/lib.rs',
				isRecovery: true
			}),
			step('build final crate', 'bash', 'shell', { command: 'cargo build -p observer', isRecovery: true })
		]
	},
	{
		slug: 'capture_action_events',
		title: 'Capture action events across tool paths',
		description: 'Instrument bash, file writes and LLM calls with ActionEvent payloads.',
		type: 'code',
		priority: 'high',
		technologies: ['rust', 'serde', 'http'],
		tags: ['telemetry', 'events'],
		baseSteps: [
			step('inspect tool executor', 'read_file', 'file_read', { filePath: '/workspace/crates/agent/src/tool_executor.rs' }),
			step('design payload envelope', 'llm_plan', 'llm_call'),
			step('wire event emitters', 'write_file', 'file_write', { filePath: '/workspace/crates/observer/src/emitter.rs' }),
			step('run cargo test observer', 'bash', 'shell', { command: 'cargo test -p observer' })
		],
		branchSteps: [
			step('patch retry semantics', 'write_file', 'file_write', {
				filePath: '/workspace/crates/observer/src/emitter.rs',
				isRecovery: true
			}),
			step('rerun cargo test observer', 'bash', 'shell', { command: 'cargo test -p observer', isRecovery: true })
		]
	},
	{
		slug: 'ship_fastapi_instance_endpoints',
		title: 'Ship FastAPI instance registration endpoints',
		description: 'Implement POST /instances and PATCH /instances/{id}/heartbeat.',
		type: 'code',
		priority: 'high',
		technologies: ['python', 'fastapi', 'pydantic'],
		tags: ['backend', 'instances'],
		baseSteps: [
			step('read api router', 'read_file', 'file_read', { filePath: '/workspace/backend/app/api/router.py' }),
			step('draft pydantic contracts', 'llm_plan', 'llm_call'),
			step('write instance endpoints', 'write_file', 'file_write', { filePath: '/workspace/backend/app/api/instances.py' }),
			step('run pytest instances', 'bash', 'shell', { command: 'pytest backend/tests/test_instances.py' })
		],
		branchSteps: [
			step('adjust heartbeat validation', 'write_file', 'file_write', {
				filePath: '/workspace/backend/app/api/instances.py',
				isRecovery: true
			}),
			step('rerun pytest instances', 'bash', 'shell', { command: 'pytest backend/tests/test_instances.py', isRecovery: true })
		]
	},
	{
		slug: 'merge_task_runs_into_dag',
		title: 'Merge task runs into the DAG',
		description: 'Deduplicate steps into StepNodes and update STEP_SEQUENCE edges.',
		type: 'code',
		priority: 'high',
		technologies: ['python', 'neo4j', 'cypher'],
		tags: ['dag', 'graph'],
		baseSteps: [
			step('inspect cypher merge patterns', 'read_file', 'file_read', { filePath: '/workspace/backend/app/graph/merge.py' }),
			step('reason about merge logic', 'llm_plan', 'llm_call'),
			step('implement step merge query', 'write_file', 'file_write', { filePath: '/workspace/backend/app/graph/merge.py' }),
			step('run dag merge tests', 'bash', 'shell', { command: 'pytest backend/tests/test_dag_merge.py' })
		],
		branchSteps: [
			step('repair edge aggregation', 'write_file', 'file_write', {
				filePath: '/workspace/backend/app/graph/merge.py',
				isRecovery: true
			}),
			step('rerun dag merge tests', 'bash', 'shell', { command: 'pytest backend/tests/test_dag_merge.py', isRecovery: true })
		]
	},
	{
		slug: 'visualize_template_dag',
		title: 'Visualize a task template DAG',
		description: 'Render weighted step paths and drilldowns for a template.',
		type: 'ui',
		priority: 'medium',
		technologies: ['svelte', 'cytoscape', 'typescript'],
		tags: ['frontend', 'dag'],
		baseSteps: [
			step('read graph panel component', 'read_file', 'file_read', { filePath: '/workspace/frontend/src/lib/components/GraphPanel.svelte' }),
			step('plan dag interaction model', 'llm_plan', 'llm_call'),
			step('wire cytoscape canvas', 'write_file', 'file_write', { filePath: '/workspace/frontend/src/lib/components/TaskGraph.svelte' }),
			step('run svelte check graph', 'bash', 'shell', { command: 'pnpm check' })
		],
		branchSteps: [
			step('tune graph layout spacing', 'write_file', 'file_write', {
				filePath: '/workspace/frontend/src/lib/components/TaskGraph.svelte',
				isRecovery: true
			}),
			step('rerun svelte check graph', 'bash', 'shell', { command: 'pnpm check', isRecovery: true })
		]
	},
	{
		slug: 'audit_risk_scoring',
		title: 'Audit dangerous commands and risk scoring',
		description: 'Score actions by permission level and flag dangerous shell commands.',
		type: 'analysis',
		priority: 'medium',
		technologies: ['python', 'rules', 'analytics'],
		tags: ['risk', 'audit'],
		baseSteps: [
			step('inspect risk rules', 'read_file', 'file_read', { filePath: '/workspace/backend/app/risk/rules.py' }),
			step('evaluate suspicious patterns', 'llm_plan', 'llm_call'),
			step('update scoring thresholds', 'write_file', 'file_write', { filePath: '/workspace/backend/app/risk/rules.py' }),
			step('run audit validation', 'bash', 'shell', { command: 'pytest backend/tests/test_risk_scoring.py' })
		],
		branchSteps: [
			step('flag sudo restart path', 'write_file', 'file_write', {
				filePath: '/workspace/backend/app/risk/rules.py',
				isRecovery: true
			}),
			step('rerun audit validation', 'bash', 'shell', { command: 'pytest backend/tests/test_risk_scoring.py', isRecovery: true })
		]
	},
	{
		slug: 'analyze_cost_breakdown',
		title: 'Analyze cost breakdown by tool and task',
		description: 'Aggregate token burn and spend across sessions.',
		type: 'data',
		priority: 'medium',
		technologies: ['python', 'sql', 'analytics'],
		tags: ['cost', 'tokens'],
		baseSteps: [
			step('collect session usage', 'read_file', 'file_read', { filePath: '/workspace/backend/app/analytics/costs.py' }),
			step('plan aggregation query', 'llm_plan', 'llm_call'),
			step('implement cost views', 'write_file', 'file_write', { filePath: '/workspace/backend/app/analytics/costs.py' }),
			step('run usage snapshot', 'bash', 'shell', { command: 'python -m backend.analytics.snapshot' })
		],
		branchSteps: [
			step('tighten token grouping', 'write_file', 'file_write', {
				filePath: '/workspace/backend/app/analytics/costs.py',
				isRecovery: true
			}),
			step('rerun usage snapshot', 'bash', 'shell', { command: 'python -m backend.analytics.snapshot', isRecovery: true })
		]
	},
	{
		slug: 'stream_weekly_instance_usage',
		title: 'Stream weekly instance usage to the dashboard',
		description: 'Compute 7-day summaries for each tracked agent instance.',
		type: 'backend',
		priority: 'medium',
		technologies: ['python', 'neo4j', 'react'],
		tags: ['instances', 'usage'],
		baseSteps: [
			step('inspect usage query', 'read_file', 'file_read', { filePath: '/workspace/backend/app/analytics/weekly_usage.py' }),
			step('shape instance summary payload', 'llm_plan', 'llm_call'),
			step('write weekly usage endpoint', 'write_file', 'file_write', { filePath: '/workspace/backend/app/api/usage.py' }),
			step('run weekly usage smoke test', 'bash', 'shell', { command: 'pytest backend/tests/test_usage.py' })
		],
		branchSteps: [
			step('backfill missing idle states', 'write_file', 'file_write', {
				filePath: '/workspace/backend/app/api/usage.py',
				isRecovery: true
			}),
			step('rerun weekly usage smoke test', 'bash', 'shell', { command: 'pytest backend/tests/test_usage.py', isRecovery: true })
		]
	}
];

function step(stepName, toolName, type, overrides = {}) {
	return {
		stepName,
		toolName,
		type,
		command: overrides.command ?? null,
		filePath: overrides.filePath ?? null,
		isRecovery: overrides.isRecovery ?? false
	};
}

export function generateObserveGraphMockData(seed = 20260321) {
	const rng = mulberry32(seed);
	const now = new Date('2026-03-21T16:00:00.000Z');

	const instances = instanceBlueprints.slice(0, INSTANCE_COUNT).map((blueprint, index) => {
		const registeredAt = new Date(now.getTime() - (7 * 24 - index * 9) * 60 * 60 * 1000);
		const lastSeenAt = new Date(now.getTime() - between(rng, 30, index === 5 ? 9200 : 600) * 1000);
		const secondsAgo = Math.floor((now.getTime() - lastSeenAt.getTime()) / 1000);
		const status = secondsAgo > 5400 ? 'offline' : secondsAgo > 1200 ? 'idle' : 'online';
		return {
			instanceId: `inst_${blueprint.slug}`,
			slug: blueprint.slug,
			name: blueprint.name,
			host: blueprint.host,
			port: 3000 + index,
			environment: blueprint.environment,
			os: blueprint.os,
			arch: blueprint.arch,
			zeroclawVersion: blueprint.zeroclawVersion,
			modelDefault: blueprint.modelDefault,
			registeredAt: registeredAt.toISOString(),
			lastSeenAt: lastSeenAt.toISOString(),
			status,
			isPinned: blueprint.isPinned,
			tags: blueprint.tags
		};
	});

	const tasks = [];
	const actions = [];
	const sessions = [];
	let taskIndex = 0;

	SESSION_TASK_COUNTS.forEach((taskCount, sessionIndex) => {
		const instance = instances[sessionIndex % instances.length];
		const sessionStart = new Date(now.getTime() - (sessionIndex * 8 + between(rng, 1, 4)) * 60 * 60 * 1000);
		const sessionId = `sess_20260321_${String(sessionIndex + 1).padStart(3, '0')}`;
		const sessionTasks = [];
		let cursor = sessionStart.getTime();

		for (let localTaskIndex = 0; localTaskIndex < taskCount; localTaskIndex += 1) {
			const blueprint = templateBlueprints[taskIndex % templateBlueprints.length];
			const task = buildTaskRun({
				rng,
				now,
				taskOrdinal: taskIndex + 1,
				instance,
				sessionId,
				blueprint,
				startMs: cursor
			});
			taskIndex += 1;
			cursor = new Date(task.completedAt ?? task.startedAt).getTime() + between(rng, 25, 90) * 1000;
			tasks.push(task);
			actions.push(...task.actions);
			sessionTasks.push(task);
		}

		const endedAt = new Date(cursor);
		sessions.push({
			sessionId,
			instanceId: instance.instanceId,
			trigger: pick(rng, ['cli', 'scheduled', 'api', 'webhook']),
			workingDir: '/workspace/observegraph',
			gitRepo: 'github.com/memoria/observegraph',
			gitBranch: pick(rng, ['feat/observegraph-ui', 'feat/dag-merge', 'feat/risk-audit']),
			gitCommit: hashSnapshot({ sessionId }).slice(0, 7),
			modelOverride: rng() > 0.72 ? pick(rng, ['gpt-5-mini', 'claude-3-5-haiku']) : null,
			startedAt: sessionStart.toISOString(),
			endedAt: endedAt.toISOString(),
			durationMs: endedAt.getTime() - sessionStart.getTime(),
			status: sessionTasks.some((task) => task.status === 'failed') ? 'failed' : 'completed',
			totalTokens: sum(sessionTasks.map((task) => task.totalTokens)),
			totalCostUsd: round(sum(sessionTasks.map((task) => task.totalCostUsd)), 4),
			taskCount: sessionTasks.length,
			actionCount: sum(sessionTasks.map((task) => task.actionCount)),
			exitCode: sessionTasks.some((task) => task.status === 'failed') ? 1 : 0,
			notes: sessionTasks[0]?.title ?? 'ObserveGraph session seed'
		});
	});

	if (tasks.length !== TOTAL_TASK_RUNS) {
		throw new Error(`Expected ${TOTAL_TASK_RUNS} task runs, received ${tasks.length}`);
	}

	const taskTemplates = deriveTemplates(tasks);
	const { stepNodes, stepEdges } = deriveGraphArtifacts(tasks);
	const sessionMetrics = deriveInstanceMetrics({ instances, sessions, tasks, actions, now });
	const instancesWithMetrics = instances.map((instance) => ({
		...instance,
		metrics: sessionMetrics.get(instance.instanceId)
	}));

	return {
		meta: {
			seed,
			generatedAt: now.toISOString(),
			totalTaskRuns: tasks.length,
			totalInstances: instances.length
		},
		instances: instancesWithMetrics,
		sessions,
		tasks: tasks.map(({ actions: _actions, ...task }) => task),
		actions,
		taskTemplates,
		stepNodes,
		stepEdges
	};
}

function buildTaskRun({ rng, taskOrdinal, instance, sessionId, blueprint, startMs }) {
	const runId = `run_${String(taskOrdinal).padStart(3, '0')}`;
	const taskId = `task_${String(taskOrdinal).padStart(3, '0')}`;
	const startedAt = new Date(startMs);
	const shouldRecover = rng() > 0.63;
	const shouldFail = !shouldRecover && rng() > 0.84;
	const stepSequence = shouldRecover
		? [...blueprint.baseSteps.slice(0, -1), ...blueprint.branchSteps]
		: [...blueprint.baseSteps];

	let cursor = startedAt.getTime();
	const runActions = stepSequence.map((definition, index) => {
		const durationMs = between(rng, 20, definition.type === 'llm_call' ? 18000 : 4200);
		const started = new Date(cursor);
		const ended = new Date(cursor + durationMs);
		cursor = ended.getTime() + between(rng, 10, 45) * 1000;
		const permissionLevel = inferPermission(definition.type);
		const totalTokens =
			definition.type === 'llm_call'
				? between(rng, 800, 2300)
				: definition.type === 'shell'
					? between(rng, 180, 780)
					: between(rng, 60, 360);
		const thinkingTokens = definition.type === 'llm_call' ? Math.round(totalTokens * 0.34) : Math.round(totalTokens * 0.14);
		const outputTokens = totalTokens - thinkingTokens;
		const isLast = index === stepSequence.length - 1;
		const status = shouldFail && isLast ? 'failed' : 'success';
		const exitCode = definition.type === 'shell' ? (status === 'failed' ? 1 : 0) : null;
		const riskScore = definition.type === 'shell' && definition.command?.includes('sudo')
			? 0.88
			: round(baseRisk(permissionLevel) + rng() * 0.12, 2);
		return {
			actionId: `${taskId}_act_${String(index + 1).padStart(2, '0')}`,
			taskId,
			instanceId: instance.instanceId,
			runId,
			stepId: `step_${blueprint.slug}_${slugify(definition.stepName)}`,
			sequence: index + 1,
			stepName: definition.stepName,
			type: definition.type,
			toolName: definition.toolName,
			command: definition.command,
			filePath: definition.filePath,
			stdout: fakeStdout(definition),
			stderr: status === 'failed' ? fakeError(definition) : null,
			exitCode,
			permissionLevel,
			riskScore,
			isFlagged: riskScore >= 0.8,
			status,
			startedAt: started.toISOString(),
			endedAt: ended.toISOString(),
			durationMs,
			reasoning: fakeReasoning(definition, blueprint),
			thinkingTokens,
			outputTokens,
			totalTokens,
			modelUsed: definition.type === 'llm_call' ? pick(rng, ['claude-3-7-sonnet', 'gpt-5-mini']) : instance.modelDefault,
			latencyMs: durationMs,
			costUsd: round(totalTokens * 0.000021, 4),
			retryCount: definition.isRecovery ? 1 : 0,
			isRecovery: definition.isRecovery
		};
	});

	const status = runActions.some((action) => action.status === 'failed') ? 'failed' : 'completed';
	const completedAt = runActions.at(-1)?.endedAt ?? startedAt.toISOString();
	const totalTokens = sum(runActions.map((action) => action.totalTokens));
	const thinkingTokens = sum(runActions.map((action) => action.thinkingTokens));
	const outputTokens = sum(runActions.map((action) => action.outputTokens));
	const totalCostUsd = round(sum(runActions.map((action) => action.costUsd)), 4);
	return {
		taskId,
		sessionId,
		instanceId: instance.instanceId,
		templateId: `tmpl_${blueprint.slug}`,
		runId,
		title: blueprint.title,
		description: blueprint.description,
		type: blueprint.type,
		technologies: blueprint.technologies,
		status,
		priority: blueprint.priority,
		startedAt: startedAt.toISOString(),
		completedAt,
		durationMs: new Date(completedAt).getTime() - startedAt.getTime(),
		totalTokens,
		thinkingTokens,
		outputTokens,
		totalCostUsd,
		actionCount: runActions.length,
		isBookmarked: rng() > 0.83,
		rating: status === 'completed' ? between(rng, 3, 5) : null,
		tags: blueprint.tags,
		error: status === 'failed' ? 'Final verification step failed after one attempt.' : null,
		actions: runActions
	};
}

function deriveTemplates(tasks) {
	const grouped = new Map();
	for (const task of tasks) {
		if (!grouped.has(task.templateId)) {
			grouped.set(task.templateId, []);
		}
		grouped.get(task.templateId).push(task);
	}

	return [...grouped.entries()].map(([templateId, runs]) => {
		const sample = runs[0];
		const successful = runs.filter((run) => run.status === 'completed');
		const bestRun = [...successful].sort((left, right) => left.totalCostUsd - right.totalCostUsd)[0] ?? sample;
		return {
			templateId,
			title: sample.title,
			fingerprint: slugify(sample.title),
			type: sample.type,
			technologies: sample.technologies,
			createdAt: runs.map((run) => run.startedAt).sort()[0],
			runCount: runs.length,
			successRate: round(successful.length / runs.length, 2),
			avgTokens: round(average(runs.map((run) => run.totalTokens))),
			avgDurationMs: round(average(runs.map((run) => run.durationMs))),
			bestRunId: bestRun.runId,
			tags: sample.tags
		};
	});
}

function deriveGraphArtifacts(tasks) {
	const nodeMap = new Map();
	const edgeMap = new Map();

	for (const task of tasks) {
		const groupedActions = actionsForTask(task.taskId, task.actions ?? []);
		for (const action of groupedActions) {
			const key = `${task.templateId}:${action.stepId}`;
			if (!nodeMap.has(key)) {
				nodeMap.set(key, {
					stepId: action.stepId,
					templateId: task.templateId,
					fingerprint: `${action.toolName}:${slugify(action.stepName)}`,
					toolName: action.toolName,
					stepName: action.stepName,
					type: action.type,
					runCount: 0,
					successCount: 0,
					tokenSamples: [],
					latencySamples: [],
					costSamples: [],
					isEntry: action.sequence === 1,
					isExit: false
				});
			}
			const node = nodeMap.get(key);
			node.runCount += 1;
			node.successCount += action.status === 'success' ? 1 : 0;
			node.tokenSamples.push(action.totalTokens);
			node.latencySamples.push(action.latencyMs);
			node.costSamples.push(action.costUsd);
			node.isEntry = node.isEntry || action.sequence === 1;
			node.isExit = node.isExit || action.sequence === groupedActions.length;
		}

		for (let index = 0; index < groupedActions.length - 1; index += 1) {
			const current = groupedActions[index];
			const next = groupedActions[index + 1];
			const key = `${task.templateId}:${current.stepId}:${next.stepId}`;
			if (!edgeMap.has(key)) {
				edgeMap.set(key, {
					edgeId: `edge_${task.templateId}_${current.stepId}_${next.stepId}`,
					templateId: task.templateId,
					fromStepId: current.stepId,
					toStepId: next.stepId,
					runCount: 0,
					runIds: [],
					tokenSamples: [],
					latencySamples: [],
					successCount: 0
				});
			}
			const edge = edgeMap.get(key);
			edge.runCount += 1;
			edge.runIds.push(task.runId);
			edge.tokenSamples.push(next.totalTokens);
			edge.latencySamples.push(next.latencyMs);
			edge.successCount += next.status === 'success' ? 1 : 0;
		}
	}

	const stepNodes = [...nodeMap.values()].map((node) => ({
		stepId: node.stepId,
		templateId: node.templateId,
		fingerprint: node.fingerprint,
		toolName: node.toolName,
		stepName: node.stepName,
		type: node.type,
		runCount: node.runCount,
		successRate: round(node.successCount / node.runCount, 2),
		avgTokens: round(average(node.tokenSamples)),
		avgLatencyMs: round(average(node.latencySamples)),
		avgCostUsd: round(average(node.costSamples), 4),
		isEntry: node.isEntry,
		isExit: node.isExit
	}));

	const stepEdges = [...edgeMap.values()].map((edge) => ({
		edgeId: edge.edgeId,
		templateId: edge.templateId,
		fromStepId: edge.fromStepId,
		toStepId: edge.toStepId,
		runCount: edge.runCount,
		runIds: edge.runIds,
		avgTokens: round(average(edge.tokenSamples)),
		avgLatencyMs: round(average(edge.latencySamples)),
		successRate: round(edge.successCount / edge.runCount, 2)
	}));

	return { stepNodes, stepEdges };
}

function deriveInstanceMetrics({ instances, sessions, tasks, actions, now }) {
	const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
	const todayStart = new Date(now);
	todayStart.setUTCHours(0, 0, 0, 0);
	const metrics = new Map();

	for (const instance of instances) {
		const instanceSessions = sessions.filter((session) => session.instanceId === instance.instanceId);
		const instanceTasks = tasks.filter((task) => task.instanceId === instance.instanceId);
		const instanceActions = actions.filter((action) => action.instanceId === instance.instanceId);
		metrics.set(instance.instanceId, {
			sessionCount7d: instanceSessions.filter((session) => new Date(session.startedAt).getTime() >= sevenDaysAgo).length,
			taskCount7d: instanceTasks.filter((task) => new Date(task.startedAt).getTime() >= sevenDaysAgo).length,
			actionCount7d: instanceActions.filter((action) => new Date(action.startedAt).getTime() >= sevenDaysAgo).length,
			completedToday: instanceTasks.filter(
				(task) => task.status === 'completed' && new Date(task.startedAt).getTime() >= todayStart.getTime()
			).length,
			runningTasks: instance.status === 'online' ? between(mulberry32(hashSnapshot(instance.instanceId).length), 0, 4) : 0,
			totalTokens7d: sum(instanceTasks.map((task) => task.totalTokens)),
			totalCostUsd7d: round(sum(instanceTasks.map((task) => task.totalCostUsd)), 4)
		});
	}

	return metrics;
}

function inferPermission(type) {
	if (type === 'file_write') {
		return 'write';
	}
	if (type === 'shell') {
		return 'dangerous';
	}
	return 'read';
}

function baseRisk(permissionLevel) {
	if (permissionLevel === 'dangerous') return 0.24;
	if (permissionLevel === 'write') return 0.18;
	return 0.04;
}

function fakeStdout(stepDefinition) {
	if (stepDefinition.type === 'shell') {
		return stepDefinition.command?.startsWith('pytest')
			? 'collected 4 items\n4 passed in 0.82s'
			: 'Compiling observer v0.1.0\nFinished dev profile target(s) in 2.4s';
	}
	if (stepDefinition.type === 'llm_call') {
		return "I'll keep the emitter isolated and project graph edges after each run.";
	}
	return stepDefinition.filePath ? `opened ${stepDefinition.filePath}` : 'context loaded';
}

function fakeError(stepDefinition) {
	if (stepDefinition.type === 'shell') {
		return 'assertion failed: expected 200 response and received 500';
	}
	return `validation error while executing ${stepDefinition.stepName}`;
}

function fakeReasoning(stepDefinition, blueprint) {
	if (stepDefinition.type === 'llm_call') {
		return `Need to lock the ${blueprint.title.toLowerCase()} strategy before mutating code paths.`;
	}
	if (stepDefinition.type === 'file_write') {
		return `Applying the implementation slice for ${blueprint.tags.join(', ')}.`;
	}
	if (stepDefinition.type === 'shell') {
		return `Verify that the ${blueprint.type} path still passes after the latest write.`;
	}
	return `Inspect current state before changing ${blueprint.title.toLowerCase()}.`;
}

function actionsForTask(taskId, actionPool) {
	if (actionPool.length > 0) {
		return actionPool;
	}
	return [];
}

function round(value, digits = 0) {
	const factor = 10 ** digits;
	return Math.round(value * factor) / factor;
}

export function summarizeMockData(data) {
	return {
		instances: data.instances.length,
		sessions: data.sessions.length,
		tasks: data.tasks.length,
		actions: data.actions.length,
		taskTemplates: data.taskTemplates.length,
		stepNodes: data.stepNodes.length,
		stepEdges: data.stepEdges.length,
		hash: hashSnapshot(data)
	};
}

