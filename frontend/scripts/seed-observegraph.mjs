import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ConvexHttpClient } from 'convex/browser';

import { api } from '../convex/_generated/api.js';
import { generateObserveGraphMockData, summarizeMockData } from './lib/observegraph-generator.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(__dirname, '..');
const projectRoot = path.resolve(frontendDir, '..');

/** Strip/coerce fields to match deployed Convex schema (some deployments use older/stricter validators). */
function stripPayloadForConvex(payload) {
	// Actions: omit fileSizeBytes, flagReason; coerce null stdout/stderr/reasoning/modelUsed to ''
	const allowedActionKeys = new Set([
		'actionId', 'taskId', 'instanceId', 'runId', 'stepId', 'sequence', 'stepName', 'type',
		'toolName', 'command', 'filePath', 'stdout', 'stderr', 'exitCode', 'permissionLevel',
		'riskScore', 'isFlagged', 'status', 'startedAt', 'endedAt', 'durationMs', 'reasoning',
		'thinkingTokens', 'outputTokens', 'totalTokens', 'modelUsed', 'latencyMs', 'costUsd',
		'retryCount', 'isRecovery'
	]);
	const stringFields = new Set(['stdout', 'stderr', 'reasoning', 'modelUsed']);
	const actions = payload.actions.map((a) => {
		const out = {};
		for (const k of Object.keys(a)) {
			if (!allowedActionKeys.has(k)) continue;
			let v = a[k];
			if (stringFields.has(k) && v == null) v = '';
			out[k] = v;
		}
		return out;
	});
	// Instances: omit sessionCount if deployed schema doesn't expect it
	const instanceKeys = new Set([
		'instanceId', 'slug', 'name', 'host', 'port', 'environment', 'os', 'arch',
		'zeroclawVersion', 'modelDefault', 'registeredAt', 'lastSeenAt', 'status',
		'isPinned', 'tags', 'metrics'
	]);
	const instances = payload.instances.map((i) => {
		const out = {};
		for (const k of Object.keys(i)) {
			if (instanceKeys.has(k)) out[k] = i[k];
		}
		return out;
	});
	// Tasks: omit lastActionAt if deployed schema doesn't expect it
	const taskKeys = new Set([
		'taskId', 'sessionId', 'instanceId', 'templateId', 'runId', 'title', 'description',
		'type', 'technologies', 'status', 'priority', 'startedAt', 'completedAt', 'durationMs',
		'totalTokens', 'thinkingTokens', 'outputTokens', 'totalCostUsd', 'actionCount',
		'isBookmarked', 'rating', 'tags', 'error'
	]);
	const tasks = payload.tasks.map((t) => {
		const out = {};
		for (const k of Object.keys(t)) {
			if (taskKeys.has(k)) out[k] = t[k];
		}
		return out;
	});
	return { ...payload, instances, tasks, actions };
}

/** Lightweight local validation to catch common payload issues before Convex. */
function validatePayload(payload) {
	const errors = [];
	const required = ['meta', 'instances', 'sessions', 'tasks', 'actions', 'taskTemplates', 'stepNodes', 'stepEdges'];
	for (const key of required) {
		if (!(key in payload)) errors.push(`Missing top-level: ${key}`);
	}
	if (payload.instances?.length) {
		const inst = payload.instances[0];
		if (inst && (typeof inst.sessionCount !== 'number' || !inst.metrics)) {
			errors.push('Instance must have sessionCount (number) and metrics');
		}
	}
	if (payload.tasks?.length) {
		const task = payload.tasks[0];
		if (task && typeof task.lastActionAt !== 'string') {
			errors.push('Task must have lastActionAt (string)');
		}
	}
	if (payload.actions?.length) {
		const act = payload.actions[0];
		const actionRequired = ['actionId', 'taskId', 'runId', 'stepId', 'sequence', 'stepName', 'type', 'toolName', 'status', 'startedAt', 'endedAt', 'durationMs', 'totalTokens', 'costUsd', 'permissionLevel', 'riskScore', 'isFlagged', 'retryCount', 'isRecovery'];
		for (const k of actionRequired) {
			if (act && !(k in act)) errors.push(`Action missing field: ${k}`);
		}
	}
	return errors;
}

async function loadEnvFile(dir, filename) {
	try {
		const source = await readFile(path.join(dir, filename), 'utf8');
		for (const line of source.split('\n')) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;
			const divider = trimmed.indexOf('=');
			if (divider === -1) continue;
			const key = trimmed.slice(0, divider).trim();
			const raw = trimmed.slice(divider + 1).trim();
			const value = raw
				.replace(/^['"]|['"]$/g, '')
				.split(' #')[0]
				.trim();
			if (!(key in process.env)) {
				process.env[key] = value;
			}
		}
	} catch {
		// optional
	}
}

async function main() {
	// Load env from project root first (has PUBLIC_CONVEX_URL from docker setup), then frontend overrides
	await loadEnvFile(projectRoot, '.env.local');
	await loadEnvFile(projectRoot, '.env');
	await loadEnvFile(frontendDir, '.env.local');
	await loadEnvFile(frontendDir, '.env');

	const validateOnly = process.argv.includes('--validate-only');
	const payload = generateObserveGraphMockData();

	const validationErrors = validatePayload(payload);
	if (validationErrors.length > 0) {
		console.error('Payload validation failed:');
		validationErrors.forEach((e) => console.error('  -', e));
		process.exitCode = 1;
		return;
	}
	if (validateOnly) {
		console.log('Payload validation passed.');
		console.log(JSON.stringify(summarizeMockData(payload), null, 2));
		return;
	}

	const convexUrl = process.env.PUBLIC_CONVEX_URL;
	if (!convexUrl) {
		console.error(
			'PUBLIC_CONVEX_URL is required. Set it in .env (project root) or frontend/.env.\n' +
				'  Run from frontend: cd frontend && pnpm run seed:observegraph'
		);
		throw new Error('PUBLIC_CONVEX_URL is required to seed ObserveGraph mock data.');
	}

	console.error('Seeding Convex at', convexUrl.replace(/https?:\/\//, '').split('.')[0] + '.convex.cloud...');
	const payloadToSend = stripPayloadForConvex(payload);
	const client = new ConvexHttpClient(convexUrl);
	const result = await client.action(api.observegraphSeed.importMockData, payloadToSend);

	console.log(
		JSON.stringify(
			{
				summary: summarizeMockData(payload),
				result
			},
			null,
			2
		)
	);
}

main().catch((error) => {
	console.error('Seed failed:', error?.message || error?.toString?.() || String(error));
	console.error('Error type:', error?.constructor?.name);
	console.error('Full error:', error);
	if (error?.data) console.error('Error data:', error.data);
	if (error?.cause) console.error('Cause:', error.cause);
	if (error?.status) console.error('Status:', error.status);
	process.exitCode = 1;
});
