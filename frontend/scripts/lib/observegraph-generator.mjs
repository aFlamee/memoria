import { createHash } from 'node:crypto';

const INSTANCE_COUNT = 3;
const SESSIONS_PER_INSTANCE = 2;
const MIN_TASKS_PER_SESSION = 4;
const TOTAL_SESSIONS = INSTANCE_COUNT * SESSIONS_PER_INSTANCE;
const MIN_TOTAL_TASKS = TOTAL_SESSIONS * MIN_TASKS_PER_SESSION;
const SHARED_ENTRY_STEP_NAME = 'load root task context';
const SHARED_ENTRY_FILE_PATH = '/workspace/observegraph/AGENTS.md';

// Path type weights: failure ~10%, successA ~25%, successB ~25%, recovery ~12%, branch ~28%
const PATH_WEIGHTS = { failure: 0.10, successA: 0.25, successB: 0.25, recovery: 0.12, branch: 0.28 };

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

function pickPath(rng) {
	const roll = rng();
	if (roll < PATH_WEIGHTS.failure) return 'failure';
	if (roll < PATH_WEIGHTS.failure + PATH_WEIGHTS.successA) return 'successA';
	if (roll < PATH_WEIGHTS.failure + PATH_WEIGHTS.successA + PATH_WEIGHTS.successB) return 'successB';
	if (roll < PATH_WEIGHTS.failure + PATH_WEIGHTS.successA + PATH_WEIGHTS.successB + PATH_WEIGHTS.recovery) return 'recovery';
	return 'branch';
}

const instanceBlueprints = [
	{
		slug: 'local-dev',
		name: 'Local Dev',
		host: '127.0.0.1',
		environment: 'development',
		os: 'macos-15',
		arch: 'arm64',
		zeroclawVersion: '0.4.2',
		modelDefault: 'claude-sonnet-4-6',
		isPinned: true,
		tags: ['laptop', 'dev', 'local']
	},
	{
		slug: 'hetzner-vps',
		name: 'Hetzner VPS',
		host: '65.21.14.88',
		environment: 'production',
		os: 'ubuntu-24.04',
		arch: 'x86_64',
		zeroclawVersion: '0.4.1',
		modelDefault: 'claude-sonnet-4-6',
		isPinned: true,
		tags: ['prod', 'vps', 'hetzner']
	},
	{
		slug: 'ci-runner',
		name: 'CI Runner',
		host: 'github-actions.runner',
		environment: 'staging',
		os: 'ubuntu-24.04',
		arch: 'x86_64',
		zeroclawVersion: '0.4.2',
		modelDefault: 'claude-haiku-4-5',
		isPinned: false,
		tags: ['ci', 'github', 'automation']
	}
];

// High-level task templates — what the agent is trying to accomplish
const taskTemplates = [
	{
		slug: 'implement_user_auth',
		title: 'Implement user auth flow',
		description: 'Add JWT-based auth with login and signup endpoints.',
		type: 'code',
		priority: 'high',
		technologies: ['typescript', 'fastify', 'prisma'],
		tags: ['auth', 'backend']
	},
	{
		slug: 'setup_db_migrations',
		title: 'Setup database migrations',
		description: 'Create and apply Prisma migrations for new schema changes.',
		type: 'code',
		priority: 'high',
		technologies: ['prisma', 'postgresql'],
		tags: ['database', 'migration']
	},
	{
		slug: 'deploy_docker_service',
		title: 'Deploy Docker service',
		description: 'Pull, stop, re-run, and health-check the production container.',
		type: 'shell',
		priority: 'high',
		technologies: ['docker', 'nginx', 'systemd'],
		tags: ['deploy', 'infra']
	},
	{
		slug: 'run_test_suite',
		title: 'Run full test suite',
		description: 'Install deps, execute all tests, generate coverage report.',
		type: 'code',
		priority: 'medium',
		technologies: ['vitest', 'playwright', 'typescript'],
		tags: ['testing', 'ci']
	},
	{
		slug: 'analyze_bundle_size',
		title: 'Analyze bundle size',
		description: 'Build production bundle, profile size, log optimization notes.',
		type: 'code',
		priority: 'medium',
		technologies: ['vite', 'rollup', 'typescript'],
		tags: ['performance', 'frontend']
	},
	{
		slug: 'fix_type_errors',
		title: 'Fix TypeScript errors',
		description: 'Run tsc, locate type errors, apply fixes, verify clean build.',
		type: 'code',
		priority: 'high',
		technologies: ['typescript'],
		tags: ['bugfix', 'types']
	}
];

/**
 * Per-template path definitions.
 * Each template has 4 path variants with different numbers of intermediate steps
 * so each task's action graph has a distinct shape.
 *
 * Step fields:
 *   type        – file_read | file_write | shell | tool_use
 *   toolName    – read_file | write_file | bash | grep
 *   stepName    – human-readable label (used as graph node label)
 *   filePath    – for file ops (optional)
 *   command     – for shell ops (optional)
 *   fails       – true → action status = 'failed'
 *   isRecovery  – true → action is part of the recovery branch
 */
const TEMPLATE_PATHS = {
	implement_user_auth: {
		// 3 intermediates → 5 nodes total (entry + 3 + last-fail)
		failure: [
			{ type: 'file_read',  toolName: 'read_file',   stepName: 'read config',      filePath: '/workspace/src/config.ts' },
			{ type: 'file_write', toolName: 'write_file',  stepName: 'write auth module', filePath: '/workspace/src/auth/index.ts' },
			{ type: 'shell',      toolName: 'bash',        stepName: 'run tests',         command: 'pnpm test', fails: true }
		],
		// 5 intermediates → 7 nodes total
		successA: [
			{ type: 'shell',      toolName: 'bash',        stepName: 'bootstrap env',          command: 'pnpm install' },
			{ type: 'file_read',  toolName: 'read_file',   stepName: 'read prisma schema',     filePath: '/workspace/prisma/schema.prisma' },
			{ type: 'file_write', toolName: 'write_file',  stepName: 'write JWT handler',      filePath: '/workspace/src/auth/jwt.ts' },
			{ type: 'file_write', toolName: 'write_file',  stepName: 'write auth middleware',  filePath: '/workspace/src/middleware/auth.ts' },
			{ type: 'shell',      toolName: 'bash',        stepName: 'run unit tests',         command: 'pnpm test:unit' },
			{ type: 'shell',      toolName: 'bash',        stepName: 'run integration tests',  command: 'pnpm test:integration' }
		],
		// 4 intermediates → 6 nodes total
		successB: [
			{ type: 'tool_use',   toolName: 'grep',        stepName: 'search auth patterns' },
			{ type: 'file_read',  toolName: 'read_file',   stepName: 'read existing auth',    filePath: '/workspace/src/auth/index.ts' },
			{ type: 'file_write', toolName: 'write_file',  stepName: 'write changes',          filePath: '/workspace/src/auth/index.ts' },
			{ type: 'file_read',  toolName: 'read_file',   stepName: 'verify diff',            filePath: '/workspace/src/auth/index.ts' },
			{ type: 'shell',      toolName: 'bash',        stepName: 'run tests',              command: 'pnpm test' }
		],
		// recovery: 6 normal + 1 fail + 2 recovery → 10 nodes total (entry + 9)
		recovery: [
			{ type: 'shell',      toolName: 'bash',        stepName: 'bootstrap env',          command: 'pnpm install' },
			{ type: 'file_read',  toolName: 'read_file',   stepName: 'read prisma schema',     filePath: '/workspace/prisma/schema.prisma' },
			{ type: 'file_write', toolName: 'write_file',  stepName: 'write JWT handler',      filePath: '/workspace/src/auth/jwt.ts' },
			{ type: 'shell',      toolName: 'bash',        stepName: 'run unit tests',         command: 'pnpm test:unit', fails: true },
			{ type: 'file_write', toolName: 'write_file',  stepName: 'fix test setup',         filePath: '/workspace/src/auth/__tests__/setup.ts', isRecovery: true },
			{ type: 'shell',      toolName: 'bash',        stepName: 'run unit tests',         command: 'pnpm test:unit' },
			{ type: 'shell',      toolName: 'bash',        stepName: 'verify integration',     command: 'pnpm test:integration' }
		],
		branch: [
			{ type: 'shell',      toolName: 'bash',       stepName: 'bootstrap env',        command: 'pnpm install' },
			[
				{ type: 'file_read',  toolName: 'read_file',  stepName: 'read prisma schema',   filePath: '/workspace/prisma/schema.prisma' },
				{ type: 'file_read',  toolName: 'read_file',  stepName: 'read existing auth',   filePath: '/workspace/src/auth/index.ts' },
			],
			{ type: 'file_write', toolName: 'write_file', stepName: 'write JWT handler',    filePath: '/workspace/src/auth/jwt.ts' },
			[
				{ type: 'file_write', toolName: 'write_file', stepName: 'write auth middleware', filePath: '/workspace/src/middleware/auth.ts' },
				{ type: 'file_write', toolName: 'write_file', stepName: 'write auth routes',    filePath: '/workspace/src/routes/auth.ts' },
			],
			{ type: 'shell',      toolName: 'bash',       stepName: 'run test suite',       command: 'pnpm test' },
		]
	},

	setup_db_migrations: {
		// 3 intermediates → 5 nodes
		failure: [
			{ type: 'file_read',  toolName: 'read_file',   stepName: 'read schema',           filePath: '/workspace/prisma/schema.prisma' },
			{ type: 'file_write', toolName: 'write_file',  stepName: 'write migration file',  filePath: '/workspace/prisma/migrations/001_init.sql' },
			{ type: 'shell',      toolName: 'bash',        stepName: 'run migration',          command: 'pnpm prisma migrate dev', fails: true }
		],
		// 4 intermediates → 6 nodes
		successA: [
			{ type: 'file_read',  toolName: 'read_file',   stepName: 'read schema',           filePath: '/workspace/prisma/schema.prisma' },
			{ type: 'shell',      toolName: 'bash',        stepName: 'check db version',      command: 'pnpm prisma version' },
			{ type: 'file_write', toolName: 'write_file',  stepName: 'write migration file',  filePath: '/workspace/prisma/migrations/001_init.sql' },
			{ type: 'shell',      toolName: 'bash',        stepName: 'run migration',          command: 'pnpm prisma migrate dev' },
			{ type: 'shell',      toolName: 'bash',        stepName: 'verify schema',          command: 'pnpm prisma db pull' }
		],
		// 6 intermediates → 8 nodes
		successB: [
			{ type: 'file_read',  toolName: 'read_file',   stepName: 'read schema',           filePath: '/workspace/prisma/schema.prisma' },
			{ type: 'tool_use',   toolName: 'grep',        stepName: 'search existing models' },
			{ type: 'shell',      toolName: 'bash',        stepName: 'check db version',      command: 'pnpm prisma version' },
			{ type: 'file_write', toolName: 'write_file',  stepName: 'write migration file',  filePath: '/workspace/prisma/migrations/001_init.sql' },
			{ type: 'file_read',  toolName: 'read_file',   stepName: 'verify migration sql',  filePath: '/workspace/prisma/migrations/001_init.sql' },
			{ type: 'shell',      toolName: 'bash',        stepName: 'run migration',          command: 'pnpm prisma migrate dev' },
			{ type: 'shell',      toolName: 'bash',        stepName: 'verify schema',          command: 'pnpm prisma db pull' }
		],
		// recovery: fail on migration, recover by fixing sql → 9 nodes
		recovery: [
			{ type: 'file_read',  toolName: 'read_file',   stepName: 'read schema',           filePath: '/workspace/prisma/schema.prisma' },
			{ type: 'shell',      toolName: 'bash',        stepName: 'check db version',      command: 'pnpm prisma version' },
			{ type: 'file_write', toolName: 'write_file',  stepName: 'write migration file',  filePath: '/workspace/prisma/migrations/001_init.sql' },
			{ type: 'shell',      toolName: 'bash',        stepName: 'run migration',          command: 'pnpm prisma migrate dev', fails: true },
			{ type: 'file_read',  toolName: 'read_file',   stepName: 'read error logs',        filePath: '/workspace/prisma/migrations/migration_lock.toml', isRecovery: true },
			{ type: 'file_write', toolName: 'write_file',  stepName: 'fix migration script',   filePath: '/workspace/prisma/migrations/001_init.sql' },
			{ type: 'shell',      toolName: 'bash',        stepName: 'run migration',          command: 'pnpm prisma migrate dev' },
			{ type: 'shell',      toolName: 'bash',        stepName: 'verify schema',          command: 'pnpm prisma db pull' }
		],
		branch: [
			[
				{ type: 'file_read',  toolName: 'read_file', stepName: 'read schema',       filePath: '/workspace/prisma/schema.prisma' },
				{ type: 'shell',      toolName: 'bash',      stepName: 'check db version',  command: 'pnpm prisma version' },
			],
			{ type: 'file_write', toolName: 'write_file', stepName: 'write migration file', filePath: '/workspace/prisma/migrations/001_init.sql' },
			{ type: 'shell',      toolName: 'bash',       stepName: 'run migration',        command: 'pnpm prisma migrate dev' },
			[
				{ type: 'shell',      toolName: 'bash',      stepName: 'verify schema',     command: 'pnpm prisma db pull' },
				{ type: 'tool_use',   toolName: 'grep',      stepName: 'grep migration log' },
			],
		]
	},

	deploy_docker_service: {
		// 3 intermediates → 5 nodes (risky: admin perms)
		failure: [
			{ type: 'shell', toolName: 'bash', stepName: 'pull docker image',  command: 'docker pull app:latest' },
			{ type: 'shell', toolName: 'bash', stepName: 'stop old container', command: 'docker stop app', permission: 'admin' },
			{ type: 'shell', toolName: 'bash', stepName: 'start new container',command: 'docker run -d app:latest', permission: 'admin', fails: true }
		],
		// 5 intermediates → 7 nodes
		successA: [
			{ type: 'shell', toolName: 'bash', stepName: 'pull docker image',   command: 'docker pull app:latest' },
			{ type: 'shell', toolName: 'bash', stepName: 'stop old container',  command: 'docker stop app', permission: 'admin' },
			{ type: 'shell', toolName: 'bash', stepName: 'start new container', command: 'docker run -d app:latest', permission: 'admin' },
			{ type: 'shell', toolName: 'bash', stepName: 'health check',        command: 'curl -f http://localhost:8000/health' },
			{ type: 'shell', toolName: 'bash', stepName: 'reload nginx',        command: 'sudo nginx -s reload', permission: 'admin' },
			{ type: 'shell', toolName: 'bash', stepName: 'tail deploy logs',    command: 'docker logs app --tail 50' }
		],
		// 4 intermediates → 6 nodes
		successB: [
			{ type: 'shell', toolName: 'bash', stepName: 'pull docker image',   command: 'docker pull app:latest' },
			{ type: 'shell', toolName: 'bash', stepName: 'stop old container',  command: 'docker stop app', permission: 'admin' },
			{ type: 'shell', toolName: 'bash', stepName: 'start new container', command: 'docker run -d app:latest', permission: 'admin' },
			{ type: 'shell', toolName: 'bash', stepName: 'health check',        command: 'curl -f http://localhost:8000/health' },
			{ type: 'shell', toolName: 'bash', stepName: 'tail deploy logs',    command: 'docker logs app --tail 50' }
		],
		// recovery: container fails to start, recover by checking port conflict → 8 nodes
		recovery: [
			{ type: 'shell',      toolName: 'bash',       stepName: 'pull docker image',   command: 'docker pull app:latest' },
			{ type: 'shell',      toolName: 'bash',       stepName: 'stop old container',  command: 'docker stop app', permission: 'admin' },
			{ type: 'shell',      toolName: 'bash',       stepName: 'start new container', command: 'docker run -d app:latest', permission: 'admin', fails: true },
			{ type: 'shell',      toolName: 'bash',       stepName: 'check port conflict', command: 'lsof -i :8000', isRecovery: true },
			{ type: 'shell',      toolName: 'bash',       stepName: 'kill blocking process', command: 'kill -9 $(lsof -ti :8000)', permission: 'admin' },
			{ type: 'shell',      toolName: 'bash',       stepName: 'start new container', command: 'docker run -d app:latest', permission: 'admin' },
			{ type: 'shell',      toolName: 'bash',       stepName: 'health check',        command: 'curl -f http://localhost:8000/health' }
		],
		branch: [
			{ type: 'shell', toolName: 'bash', stepName: 'pull docker image', command: 'docker pull app:latest' },
			[
				{ type: 'shell', toolName: 'bash', stepName: 'stop old container',     command: 'docker stop app', permission: 'admin' },
				{ type: 'shell', toolName: 'bash', stepName: 'check port availability', command: 'lsof -i :8000' },
			],
			{ type: 'shell', toolName: 'bash', stepName: 'start new container', command: 'docker run -d app:latest', permission: 'admin' },
			[
				{ type: 'shell', toolName: 'bash', stepName: 'health check', command: 'curl -f http://localhost:8000/health' },
				{ type: 'shell', toolName: 'bash', stepName: 'reload nginx',  command: 'sudo nginx -s reload', permission: 'admin' },
			],
		]
	},

	run_test_suite: {
		// 3 intermediates → 5 nodes
		failure: [
			{ type: 'file_read', toolName: 'read_file', stepName: 'read test config',     filePath: '/workspace/vitest.config.ts' },
			{ type: 'shell',     toolName: 'bash',      stepName: 'install dependencies', command: 'pnpm install' },
			{ type: 'shell',     toolName: 'bash',      stepName: 'run test suite',       command: 'pnpm test', fails: true }
		],
		// 3 intermediates → 5 nodes
		successA: [
			{ type: 'file_read', toolName: 'read_file', stepName: 'read test config',       filePath: '/workspace/vitest.config.ts' },
			{ type: 'shell',     toolName: 'bash',      stepName: 'install dependencies',   command: 'pnpm install' },
			{ type: 'shell',     toolName: 'bash',      stepName: 'run test suite',         command: 'pnpm test' },
			{ type: 'shell',     toolName: 'bash',      stepName: 'generate coverage report', command: 'pnpm test --coverage' }
		],
		// 5 intermediates → 7 nodes
		successB: [
			{ type: 'file_read',  toolName: 'read_file', stepName: 'read test config',       filePath: '/workspace/vitest.config.ts' },
			{ type: 'tool_use',   toolName: 'grep',      stepName: 'find test files' },
			{ type: 'shell',      toolName: 'bash',      stepName: 'install dependencies',   command: 'pnpm install' },
			{ type: 'shell',      toolName: 'bash',      stepName: 'run unit tests',         command: 'pnpm test:unit' },
			{ type: 'shell',      toolName: 'bash',      stepName: 'run e2e tests',          command: 'pnpm test:e2e' },
			{ type: 'shell',      toolName: 'bash',      stepName: 'generate coverage report', command: 'pnpm test --coverage' }
		],
		// recovery: unit tests fail, fix + retry → 9 nodes
		recovery: [
			{ type: 'file_read',  toolName: 'read_file', stepName: 'read test config',       filePath: '/workspace/vitest.config.ts' },
			{ type: 'tool_use',   toolName: 'grep',      stepName: 'find test files' },
			{ type: 'shell',      toolName: 'bash',      stepName: 'install dependencies',   command: 'pnpm install' },
			{ type: 'shell',      toolName: 'bash',      stepName: 'run test suite',         command: 'pnpm test', fails: true },
			{ type: 'file_read',  toolName: 'read_file', stepName: 'read test output',       filePath: '/workspace/test-results/output.txt', isRecovery: true },
			{ type: 'file_write', toolName: 'write_file', stepName: 'fix failing test',      filePath: '/workspace/src/__tests__/auth.test.ts' },
			{ type: 'shell',      toolName: 'bash',      stepName: 'run test suite',         command: 'pnpm test' },
			{ type: 'shell',      toolName: 'bash',      stepName: 'generate coverage report', command: 'pnpm test --coverage' }
		],
		branch: [
			{ type: 'file_read', toolName: 'read_file', stepName: 'read test config',     filePath: '/workspace/vitest.config.ts' },
			{ type: 'shell',     toolName: 'bash',      stepName: 'install dependencies', command: 'pnpm install' },
			[
				{ type: 'shell', toolName: 'bash', stepName: 'run unit tests', command: 'pnpm test:unit' },
				{ type: 'shell', toolName: 'bash', stepName: 'run e2e tests',  command: 'pnpm test:e2e' },
			],
			{ type: 'shell', toolName: 'bash', stepName: 'generate coverage report', command: 'pnpm test --coverage' },
		]
	},

	analyze_bundle_size: {
		// 3 intermediates → 5 nodes
		failure: [
			{ type: 'shell',      toolName: 'bash',      stepName: 'build production bundle', command: 'pnpm build' },
			{ type: 'shell',      toolName: 'bash',      stepName: 'run bundle analyzer',     command: 'pnpm analyze', fails: true },
			{ type: 'file_read',  toolName: 'read_file', stepName: 'read partial report',     filePath: '/workspace/dist/stats.json' }
		],
		// 4 intermediates → 6 nodes
		successA: [
			{ type: 'shell',      toolName: 'bash',      stepName: 'build production bundle',  command: 'pnpm build' },
			{ type: 'shell',      toolName: 'bash',      stepName: 'run bundle analyzer',      command: 'pnpm analyze' },
			{ type: 'file_read',  toolName: 'read_file', stepName: 'read analysis report',     filePath: '/workspace/dist/stats.json' },
			{ type: 'file_write', toolName: 'write_file', stepName: 'write optimization notes', filePath: '/workspace/docs/bundle-notes.md' },
			{ type: 'shell',      toolName: 'bash',      stepName: 'compare with baseline',    command: 'pnpm bundle-compare' }
		],
		// 5 intermediates → 7 nodes
		successB: [
			{ type: 'shell',      toolName: 'bash',      stepName: 'build production bundle',  command: 'pnpm build' },
			{ type: 'shell',      toolName: 'bash',      stepName: 'run bundle analyzer',      command: 'pnpm analyze' },
			{ type: 'tool_use',   toolName: 'grep',      stepName: 'search large dependencies' },
			{ type: 'file_read',  toolName: 'read_file', stepName: 'read analysis report',     filePath: '/workspace/dist/stats.json' },
			{ type: 'file_write', toolName: 'write_file', stepName: 'write optimization notes', filePath: '/workspace/docs/bundle-notes.md' },
			{ type: 'shell',      toolName: 'bash',      stepName: 'compare with baseline',    command: 'pnpm bundle-compare' }
		],
		// recovery: analyzer fails, rebuild and retry → 8 nodes
		recovery: [
			{ type: 'shell',      toolName: 'bash',      stepName: 'build production bundle',  command: 'pnpm build' },
			{ type: 'shell',      toolName: 'bash',      stepName: 'run bundle analyzer',      command: 'pnpm analyze', fails: true },
			{ type: 'file_read',  toolName: 'read_file', stepName: 'read build log',           filePath: '/workspace/.vite/build-log.txt', isRecovery: true },
			{ type: 'file_write', toolName: 'write_file', stepName: 'fix vite config',         filePath: '/workspace/vite.config.ts' },
			{ type: 'shell',      toolName: 'bash',      stepName: 'build production bundle',  command: 'pnpm build' },
			{ type: 'shell',      toolName: 'bash',      stepName: 'run bundle analyzer',      command: 'pnpm analyze' },
			{ type: 'file_read',  toolName: 'read_file', stepName: 'read analysis report',     filePath: '/workspace/dist/stats.json' }
		],
		branch: [
			{ type: 'shell', toolName: 'bash', stepName: 'build production bundle', command: 'pnpm build' },
			[
				{ type: 'tool_use',  toolName: 'grep',      stepName: 'grep large dependencies' },
				{ type: 'file_read', toolName: 'read_file', stepName: 'read analysis report', filePath: '/workspace/dist/stats.json' },
			],
			{ type: 'file_write', toolName: 'write_file', stepName: 'write optimization notes', filePath: '/workspace/docs/bundle-notes.md' },
			{ type: 'shell',      toolName: 'bash',       stepName: 'compare with baseline',   command: 'pnpm bundle-compare' },
		]
	},

	fix_type_errors: {
		// 3 intermediates → 5 nodes
		failure: [
			{ type: 'shell',      toolName: 'bash',      stepName: 'run tsc check',           command: 'pnpm tsc --noEmit' },
			{ type: 'tool_use',   toolName: 'grep',      stepName: 'find error locations' },
			{ type: 'shell',      toolName: 'bash',      stepName: 'verify tsc clean',        command: 'pnpm tsc --noEmit', fails: true }
		],
		// 4 intermediates → 6 nodes
		successA: [
			{ type: 'shell',      toolName: 'bash',      stepName: 'run tsc check',           command: 'pnpm tsc --noEmit' },
			{ type: 'tool_use',   toolName: 'grep',      stepName: 'find error locations' },
			{ type: 'file_read',  toolName: 'read_file', stepName: 'read file with errors',   filePath: '/workspace/src/types/index.ts' },
			{ type: 'file_write', toolName: 'write_file', stepName: 'apply type fixes',       filePath: '/workspace/src/types/index.ts' },
			{ type: 'shell',      toolName: 'bash',      stepName: 'verify tsc clean',        command: 'pnpm tsc --noEmit' }
		],
		// 6 intermediates → 8 nodes
		successB: [
			{ type: 'shell',      toolName: 'bash',      stepName: 'run tsc check',           command: 'pnpm tsc --noEmit' },
			{ type: 'tool_use',   toolName: 'grep',      stepName: 'find error locations' },
			{ type: 'file_read',  toolName: 'read_file', stepName: 'read file with errors',   filePath: '/workspace/src/types/index.ts' },
			{ type: 'file_write', toolName: 'write_file', stepName: 'apply type fixes',       filePath: '/workspace/src/types/index.ts' },
			{ type: 'file_read',  toolName: 'read_file', stepName: 'read related types',      filePath: '/workspace/src/types/api.ts' },
			{ type: 'file_write', toolName: 'write_file', stepName: 'fix related types',      filePath: '/workspace/src/types/api.ts' },
			{ type: 'shell',      toolName: 'bash',      stepName: 'verify tsc clean',        command: 'pnpm tsc --noEmit' }
		],
		// recovery: first fix attempt fails tsc, deeper fix needed → 8 nodes
		recovery: [
			{ type: 'shell',      toolName: 'bash',      stepName: 'run tsc check',           command: 'pnpm tsc --noEmit' },
			{ type: 'tool_use',   toolName: 'grep',      stepName: 'find error locations' },
			{ type: 'file_read',  toolName: 'read_file', stepName: 'read file with errors',   filePath: '/workspace/src/types/index.ts' },
			{ type: 'file_write', toolName: 'write_file', stepName: 'apply type fixes',       filePath: '/workspace/src/types/index.ts' },
			{ type: 'shell',      toolName: 'bash',      stepName: 'verify tsc clean',        command: 'pnpm tsc --noEmit', fails: true },
			{ type: 'file_read',  toolName: 'read_file', stepName: 'inspect type definitions', filePath: '/workspace/src/types/api.ts', isRecovery: true },
			{ type: 'file_write', toolName: 'write_file', stepName: 'fix type definitions',   filePath: '/workspace/src/types/api.ts' },
			{ type: 'shell',      toolName: 'bash',      stepName: 'verify tsc clean',        command: 'pnpm tsc --noEmit' }
		],
		branch: [
			{ type: 'shell',    toolName: 'bash', stepName: 'run tsc check',      command: 'pnpm tsc --noEmit' },
			{ type: 'tool_use', toolName: 'grep', stepName: 'find error locations' },
			[
				{ type: 'file_read', toolName: 'read_file', stepName: 'read types index', filePath: '/workspace/src/types/index.ts' },
				{ type: 'file_read', toolName: 'read_file', stepName: 'read API types',   filePath: '/workspace/src/types/api.ts' },
			],
			{ type: 'file_write', toolName: 'write_file', stepName: 'apply type fixes', filePath: '/workspace/src/types/index.ts' },
			{ type: 'shell',      toolName: 'bash',       stepName: 'verify tsc clean',  command: 'pnpm tsc --noEmit' },
		]
	}
};

function inferPermission(step) {
	if (step.permission) return step.permission;
	if (step.type === 'file_write') return 'write';
	if (step.type === 'shell') return 'write';
	return 'read';
}

function baseRisk(permissionLevel) {
	if (permissionLevel === 'dangerous') return 0.55;
	if (permissionLevel === 'admin') return 0.38;
	if (permissionLevel === 'write') return 0.16;
	return 0.04;
}

function round(value, digits = 0) {
	const factor = 10 ** digits;
	return Math.round(value * factor) / factor;
}

function sampleActionTokens(rng, type, index) {
	if (index === 0) return between(rng, 350, 800); // entry step
	if (type === 'shell') return between(rng, 140, 580);
	if (type === 'file_write') return between(rng, 300, 1200);
	if (type === 'file_read') return between(rng, 80, 420);
	return between(rng, 80, 320); // tool_use / grep
}

function fakeStdout(step) {
	if (step.type === 'shell') {
		const cmd = step.command ?? '';
		if (cmd.includes('test')) return 'collected 12 items\n12 passed in 1.43s';
		if (cmd.includes('build')) return 'vite v5.2.0 building for production...\n✓ built in 3.48s';
		if (cmd.includes('docker pull')) return 'latest: Pulling from library/app\nDigest: sha256:abc123\nStatus: Image is up to date';
		if (cmd.includes('docker stop')) return 'app';
		if (cmd.includes('docker run')) return 'c3d4e5f6a7b8';
		if (cmd.includes('curl')) return '{"status":"ok","uptime":182}';
		if (cmd.includes('nginx')) return '';
		if (cmd.includes('prisma migrate')) return 'The following migration(s) have been applied:\n✓ 001_init';
		if (cmd.includes('prisma db pull')) return 'Prisma schema updated';
		if (cmd.includes('tsc')) return '';
		if (cmd.includes('analyze')) return 'Bundle analysis complete. Total: 312 kB';
		return 'Command completed successfully';
	}
	if (step.type === 'tool_use') return 'Found 8 matching references';
	return `opened ${step.filePath ?? '/workspace/src/index.ts'}`;
}

function fakeError(step) {
	if (step.type === 'shell') {
		const cmd = step.command ?? '';
		if (cmd.includes('test')) return 'FAIL src/__tests__/auth.test.ts\n  ✗ should return 401 for invalid token\n  Expected: 401, Received: 500\n1 failed, 11 passed';
		if (cmd.includes('docker run')) return "Error: driver failed programming external connectivity on endpoint app: Bind for 0.0.0.0:8000 failed: port is already allocated";
		if (cmd.includes('prisma migrate')) return 'Error: P1001: Can\'t reach database server at localhost:5432\nMigration failed';
		if (cmd.includes('tsc')) return 'src/types/index.ts(42,7): error TS2322: Type \'string | undefined\' is not assignable to type \'string\'.\n3 errors found.';
		if (cmd.includes('analyze')) return 'Error: rollup-plugin-visualizer: stats file not found. Run build first.';
	}
	return 'Command failed with exit code 1';
}

function fakeReasoning(step, template) {
	if (step.isRecovery) return `Recovering from failure — trying alternate approach for ${template.title.toLowerCase()}.`;
	if (step.type === 'file_write') return `Applying changes for ${template.title.toLowerCase()}.`;
	if (step.type === 'shell') return `Executing shell step to verify the ${template.type} path.`;
	return `Inspect state before changing ${template.title.toLowerCase()}.`;
}

const sessionFocuses = [
	['feature-auth-system', 'api-refactor'],
	['morning-deploy', 'hotfix-prod'],
	['pr-202', 'pr-199']
];

const sessionBranches = [
	['feat/auth-system', 'feat/refactor-api'],
	['main', 'hotfix/prod-fix'],
	['pr/202-feature', 'pr/199-bugfix']
];

const sessionTriggers = [
	['cli', 'cli'],
	['scheduled', 'api'],
	['webhook', 'webhook']
];

const sessionNotes = [
	['Implementing JWT auth system and API validation', 'Refactoring API layer and optimizing queries'],
	['Morning production deployment run', 'Emergency hotfix for prod regression'],
	['Feature PR #202: auth and bundle improvements', 'Bugfix PR #199: type errors and test fixes']
];

export function generateObserveGraphMockData(seed = 20260322) {
	const rng = mulberry32(seed);
	const now = new Date('2026-03-22T16:00:00.000Z');

	const instances = instanceBlueprints.slice(0, INSTANCE_COUNT).map((bp, index) => {
		const registeredAt = new Date(now.getTime() - (14 * 24 - index * 24) * 60 * 60 * 1000);
		const lastSeenAt = new Date(now.getTime() - between(rng, 30, 300) * 1000);
		const secondsAgo = Math.floor((now.getTime() - lastSeenAt.getTime()) / 1000);
		const status = secondsAgo > 5400 ? 'offline' : secondsAgo > 1200 ? 'idle' : 'online';
		return {
			instanceId: `inst_${bp.slug}`,
			slug: bp.slug,
			name: bp.name,
			host: bp.host,
			port: 3000 + index,
			environment: bp.environment,
			os: bp.os,
			arch: bp.arch,
			zeroclawVersion: bp.zeroclawVersion,
			modelDefault: bp.modelDefault,
			registeredAt: registeredAt.toISOString(),
			lastSeenAt: lastSeenAt.toISOString(),
			status,
			isPinned: bp.isPinned,
			tags: bp.tags
		};
	});

	const sessions = [];
	const tasks = [];
	const actions = [];
	let taskOrdinal = 0;

	for (let instIdx = 0; instIdx < instances.length; instIdx++) {
		const instance = instances[instIdx];
		const templateSlug = instance.slug.replace(/-/g, '_').replace(/^ci_runner$/, 'ci_runner');

		for (let sessIdx = 0; sessIdx < SESSIONS_PER_INSTANCE; sessIdx++) {
			// Session 0 = yesterday, Session 1 = 2 days ago (both within 7-day window)
			const daysAgo = sessIdx + 1;
			const sessionDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
			const dateStr = sessionDate.toISOString().slice(0, 10);
			const focus = sessionFocuses[instIdx][sessIdx];
			const sessionId = `${instance.slug}-${dateStr}-${focus}`;

			const startHour = instIdx === 0 ? 9 : instIdx === 1 ? 6 : 7;
			const sessionStart = new Date(
				sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate(),
				startHour + between(rng, 0, 2), between(rng, 0, 59), 0, 0
			);
			// Convert to UTC representation
			const sessionStartMs = sessionStart.getTime() - sessionStart.getTimezoneOffset() * 60000;

			const sessionTasks = [];
			let cursor = sessionStartMs;

			// 4-5 tasks per session
			const taskCount = MIN_TASKS_PER_SESSION + (rng() > 0.5 ? 1 : 0);
			for (let t = 0; t < taskCount; t++) {
				const template = taskTemplates[taskOrdinal % taskTemplates.length];
				const pathType = pickPath(rng);
				const templatePaths = TEMPLATE_PATHS[template.slug];
				// Fallback to generic if template not in TEMPLATE_PATHS
				const pathSteps = templatePaths
					? templatePaths[pathType] ?? templatePaths.successA
					: [];

				const runId = `run_${String(taskOrdinal + 1).padStart(3, '0')}`;
				const taskId = `task_${String(taskOrdinal + 1).padStart(3, '0')}`;
				const templateId = `tmpl_${template.slug}`;

				const runActions = [];
				const startedAt = new Date(cursor);

				// Entry: load root task context (always first, always success)
				const entryActionId = `${taskId}_act_01`;
				const entryDuration = between(rng, 180, 750);
				const entryEnd = cursor + entryDuration;
				runActions.push({
					actionId: entryActionId,
					parentActionIds: [],
					sequence: 1,
					stepName: SHARED_ENTRY_STEP_NAME,
					toolName: 'read_file',
					type: 'file_read',
					filePath: SHARED_ENTRY_FILE_PATH,
					command: null,
					status: 'success',
					startedAt: new Date(cursor),
					endedAt: new Date(entryEnd),
					durationMs: entryDuration,
					totalTokens: sampleActionTokens(rng, 'file_read', 0),
					latencyMs: entryDuration,
					costUsd: round(entryDuration * 0.000018, 4),
					permissionLevel: 'read',
					riskScore: round(0.04 + rng() * 0.06, 2),
					isRecovery: false,
					fails: false
				});
				cursor = entryEnd + between(rng, 8, 35) * 1000;

				// Path-specific steps (supports arrays for parallel/branching groups)
				let currentParentIds = [entryActionId];
				for (const item of pathSteps) {
					const group = Array.isArray(item) ? item : [item];
					const newParentIds = [];

					for (const step of group) {
						const seq = runActions.length + 1;
						const actionId = `${taskId}_act_${String(seq).padStart(2, '0')}`;
						const durationMs = step.type === 'shell'
							? between(rng, 800, 9500)
							: step.type === 'file_write'
								? between(rng, 400, 2800)
								: between(rng, 120, 1800);
						const shouldFail = step.fails === true;
						const status = shouldFail ? 'failed' : 'success';
						const permissionLevel = inferPermission(step);

						runActions.push({
							actionId,
							parentActionIds: [...currentParentIds],
							sequence: seq,
							stepName: step.stepName,
							toolName: step.toolName,
							type: step.type,
							filePath: step.filePath ?? null,
							command: step.command ?? null,
							status,
							startedAt: new Date(cursor),
							endedAt: new Date(cursor + durationMs),
							durationMs,
							totalTokens: sampleActionTokens(rng, step.type, seq - 1),
							latencyMs: durationMs,
							costUsd: round(durationMs * 0.000014, 4),
							permissionLevel,
							riskScore: round(baseRisk(permissionLevel) + rng() * 0.14, 2),
							isRecovery: step.isRecovery === true,
							fails: shouldFail
						});
						newParentIds.push(actionId);
						cursor += durationMs + between(rng, 10, 45) * 1000;
					}

					currentParentIds = newParentIds;
				}

				// Task status: failed only if last action failed AND no subsequent recovery
				const lastAction = runActions.at(-1);
				const taskStatus = lastAction?.status === 'failed' ? 'failed' : 'completed';
				const completedAt = lastAction?.endedAt ?? startedAt;
				const lastActionAt = (lastAction?.endedAt ?? startedAt).toISOString();

				const taskActions = runActions.map((ra) => {
					const stepId = `${templateId}:${slugify(ra.toolName)}:${slugify(ra.stepName)}`;
					const thinkingTokens = Math.round(ra.totalTokens * 0.18);
					const outputTokens = ra.totalTokens - thinkingTokens;
					return {
						actionId: ra.actionId,
						parentActionIds: ra.parentActionIds,
						taskId,
						instanceId: instance.instanceId,
						runId,
						stepId,
						sequence: ra.sequence,
						stepName: ra.stepName,
						type: ra.type,
						toolName: ra.toolName,
						command: ra.command,
						filePath: ra.filePath,
						fileSizeBytes: null,
						stdout: ra.status === 'success' ? fakeStdout(ra) : null,
						stderr: ra.status === 'failed' ? fakeError(ra) : null,
						exitCode: ra.type === 'shell' ? (ra.status === 'failed' ? 1 : 0) : null,
						permissionLevel: ra.permissionLevel,
						riskScore: ra.riskScore,
						isFlagged: ra.riskScore >= 0.75,
						flagReason: ra.riskScore >= 0.75 ? 'High-risk admin operation' : null,
						status: ra.status,
						startedAt: ra.startedAt.toISOString(),
						endedAt: ra.endedAt.toISOString(),
						durationMs: ra.durationMs,
						reasoning: fakeReasoning(ra, template),
						thinkingTokens,
						outputTokens,
						totalTokens: ra.totalTokens,
						modelUsed: instance.modelDefault,
						latencyMs: ra.latencyMs,
						costUsd: ra.costUsd,
						retryCount: ra.isRecovery ? 1 : 0,
						isRecovery: ra.isRecovery
					};
				});

				tasks.push({
					taskId,
					sessionId,
					instanceId: instance.instanceId,
					templateId,
					runId,
					title: template.title,
					description: template.description,
					type: template.type,
					technologies: template.technologies,
					status: taskStatus,
					priority: template.priority,
					startedAt: startedAt.toISOString(),
					completedAt: completedAt.toISOString(),
					durationMs: completedAt.getTime() - startedAt.getTime(),
					totalTokens: sum(runActions.map((a) => a.totalTokens)),
					thinkingTokens: sum(runActions.map((a) => Math.round(a.totalTokens * 0.18))),
					outputTokens: sum(runActions.map((a) => a.totalTokens - Math.round(a.totalTokens * 0.18))),
					totalCostUsd: round(sum(runActions.map((a) => a.costUsd)), 4),
					actionCount: taskActions.length,
					isBookmarked: rng() > 0.82,
					rating: taskStatus === 'completed' ? between(rng, 3, 5) : null,
					tags: template.tags,
					error: taskStatus === 'failed' ? 'Final step failed — no recovery path taken.' : null,
					lastActionAt
				});
				actions.push(...taskActions);
				sessionTasks.push(tasks[tasks.length - 1]);
				taskOrdinal++;
				cursor = completedAt.getTime() + between(rng, 45, 150) * 1000;
			}

			const endedAt = new Date(cursor);
			const sessionStatus = sessionTasks.some((t) => t.status === 'failed') ? 'failed' : 'completed';

			sessions.push({
				sessionId,
				instanceId: instance.instanceId,
				trigger: sessionTriggers[instIdx][sessIdx],
				workingDir: '/workspace',
				gitRepo: 'github.com/zeroclaw/observegraph',
				gitBranch: sessionBranches[instIdx][sessIdx],
				gitCommit: hashSnapshot({ sessionId, seed }).slice(0, 7),
				modelOverride: null,
				startedAt: new Date(sessionStartMs).toISOString(),
				endedAt: endedAt.toISOString(),
				durationMs: endedAt.getTime() - sessionStartMs,
				status: sessionStatus,
				totalTokens: sum(sessionTasks.map((t) => t.totalTokens)),
				totalCostUsd: round(sum(sessionTasks.map((t) => t.totalCostUsd)), 4),
				taskCount: sessionTasks.length,
				actionCount: sum(sessionTasks.map((t) => t.actionCount)),
				exitCode: sessionStatus === 'failed' ? 1 : 0,
				notes: sessionNotes[instIdx][sessIdx]
			});
		}
	}

	const taskTemplatesOut = deriveTemplates(tasks);
	const { stepNodes, stepEdges } = deriveGraphArtifacts(tasks, actions);
	const sessionMetrics = deriveInstanceMetrics({ instances, sessions, tasks, actions, now });

	const instancesWithMetrics = instances.map((instance) => {
		const sessionCount = sessions.filter((s) => s.instanceId === instance.instanceId).length;
		return { ...instance, sessionCount, metrics: sessionMetrics.get(instance.instanceId) };
	});

	return {
		meta: {
			seed,
			generatedAt: now.toISOString(),
			totalTaskRuns: tasks.length,
			totalInstances: instances.length
		},
		instances: instancesWithMetrics,
		sessions,
		tasks,
		actions,
		taskTemplates: taskTemplatesOut,
		stepNodes,
		stepEdges
	};
}

function deriveTemplates(tasks) {
	const grouped = new Map();
	for (const task of tasks) {
		if (!grouped.has(task.templateId)) grouped.set(task.templateId, []);
		grouped.get(task.templateId).push(task);
	}

	return [...grouped.entries()].map(([templateId, runs]) => {
		const sample = runs[0];
		const successful = runs.filter((r) => r.status === 'completed');
		const bestRun = [...successful].sort((a, b) => a.totalCostUsd - b.totalCostUsd)[0] ?? sample;
		return {
			templateId,
			title: sample.title,
			fingerprint: slugify(sample.title),
			type: sample.type,
			technologies: sample.technologies,
			createdAt: runs.map((r) => r.startedAt).sort()[0],
			runCount: runs.length,
			successRate: round(successful.length / runs.length, 2),
			avgTokens: round(average(runs.map((r) => r.totalTokens))),
			avgDurationMs: round(average(runs.map((r) => r.durationMs))),
			bestRunId: bestRun.runId,
			tags: sample.tags
		};
	});
}

function deriveGraphArtifacts(tasks, allActions) {
	const nodeMap = new Map();
	const edgeMap = new Map();
	const actionsByTask = new Map();

	for (const a of allActions) {
		if (!actionsByTask.has(a.taskId)) actionsByTask.set(a.taskId, []);
		actionsByTask.get(a.taskId).push(a);
	}
	for (const taskId of actionsByTask.keys()) {
		actionsByTask.get(taskId).sort((a, b) => a.sequence - b.sequence);
	}

	for (const task of tasks) {
		const groupedActions = actionsByTask.get(task.taskId) ?? [];

		for (const action of groupedActions) {
			const nodeKey = `${task.templateId}:${action.stepId}`;
			if (!nodeMap.has(nodeKey)) {
				nodeMap.set(nodeKey, {
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
			const node = nodeMap.get(nodeKey);
			node.runCount += 1;
			node.successCount += action.status === 'success' ? 1 : 0;
			node.tokenSamples.push(action.totalTokens);
			node.latencySamples.push(action.latencyMs);
			node.costSamples.push(action.costUsd);
			node.isEntry = node.isEntry || action.sequence === 1;
			node.isExit = node.isExit || action.sequence === groupedActions.length;
		}

		for (let i = 0; i < groupedActions.length - 1; i++) {
			const curr = groupedActions[i];
			const next = groupedActions[i + 1];
			const edgeKey = `${task.templateId}:${curr.stepId}:${next.stepId}`;
			if (!edgeMap.has(edgeKey)) {
				edgeMap.set(edgeKey, {
					edgeId: `edge_${task.templateId}_${curr.stepId}_${next.stepId}`,
					templateId: task.templateId,
					fromStepId: curr.stepId,
					toStepId: next.stepId,
					runCount: 0,
					runIds: [],
					tokenSamples: [],
					latencySamples: [],
					successCount: 0
				});
			}
			const edge = edgeMap.get(edgeKey);
			edge.runCount += 1;
			edge.runIds.push(task.runId);
			edge.tokenSamples.push(next.totalTokens);
			edge.latencySamples.push(next.latencyMs);
			edge.successCount += next.status === 'success' ? 1 : 0;

			// Also record the bypass edge when a failure recovery occurs:
			// prev → recovery (skipping the failed node) appears as a template-level DAG branch
			if (curr.status === 'failed' && next.isRecovery && i > 0) {
				const prev = groupedActions[i - 1];
				const bypassKey = `${task.templateId}:${prev.stepId}:${next.stepId}:bypass`;
				if (!edgeMap.has(bypassKey)) {
					edgeMap.set(bypassKey, {
						edgeId: `edge_bypass_${task.templateId}_${prev.stepId}_${next.stepId}`,
						templateId: task.templateId,
						fromStepId: prev.stepId,
						toStepId: next.stepId,
						runCount: 0,
						runIds: [],
						tokenSamples: [],
						latencySamples: [],
						successCount: 0
					});
				}
				const bypassEdge = edgeMap.get(bypassKey);
				bypassEdge.runCount += 1;
				bypassEdge.runIds.push(task.runId);
				bypassEdge.tokenSamples.push(next.totalTokens);
				bypassEdge.latencySamples.push(next.latencyMs);
				bypassEdge.successCount += 1;
			}
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
		const instanceSessions = sessions.filter((s) => s.instanceId === instance.instanceId);
		const instanceTasks = tasks.filter((t) => t.instanceId === instance.instanceId);
		const instanceActions = actions.filter((a) => a.instanceId === instance.instanceId);
		const rng2 = mulberry32(hashSnapshot(instance.instanceId).charCodeAt(0));
		metrics.set(instance.instanceId, {
			sessionCount7d: instanceSessions.filter(
				(s) => new Date(s.startedAt).getTime() >= sevenDaysAgo
			).length,
			taskCount7d: instanceTasks.filter(
				(t) => new Date(t.startedAt).getTime() >= sevenDaysAgo
			).length,
			actionCount7d: instanceActions.filter(
				(a) => new Date(a.startedAt).getTime() >= sevenDaysAgo
			).length,
			completedToday: instanceTasks.filter(
				(t) =>
					t.status === 'completed' &&
					new Date(t.startedAt).getTime() >= todayStart.getTime()
			).length,
			runningTasks: instance.status === 'online' ? between(rng2, 0, 3) : 0,
			totalTokens7d: sum(instanceTasks.map((t) => t.totalTokens)),
			totalCostUsd7d: round(sum(instanceTasks.map((t) => t.totalCostUsd)), 4)
		});
	}

	return metrics;
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
