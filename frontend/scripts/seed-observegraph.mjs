import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ConvexHttpClient } from 'convex/browser';

import { api } from '../convex/_generated/api.js';
import { generateObserveGraphMockData, summarizeMockData } from './lib/observegraph-generator.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
async function loadEnvFile(filename) {
	try {
		const source = await readFile(path.join(rootDir, filename), 'utf8');
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
	await loadEnvFile('.env.local');
	await loadEnvFile('.env');

	const convexUrl = process.env.PUBLIC_CONVEX_URL;
	if (!convexUrl) {
		throw new Error('PUBLIC_CONVEX_URL is required to seed ObserveGraph mock data.');
	}

	const payload = generateObserveGraphMockData();
	const client = new ConvexHttpClient(convexUrl);
	const result = await client.action(api.observegraphSeed.importMockData, payload);

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
	console.error(error);
	process.exitCode = 1;
});
