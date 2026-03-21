import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateObserveGraphMockData, summarizeMockData } from './lib/observegraph-generator.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const mockdataDir = path.join(rootDir, 'mockdata');

async function main() {
	const data = generateObserveGraphMockData();
	await mkdir(mockdataDir, { recursive: true });

	const fileEntries = [
		['instances.json', data.instances],
		['sessions.json', data.sessions],
		['tasks.json', data.tasks],
		['actions.json', data.actions],
		['taskTemplates.json', data.taskTemplates],
		['stepNodes.json', data.stepNodes],
		['stepEdges.json', data.stepEdges],
		['meta.json', data.meta]
	];

	for (const [filename, payload] of fileEntries) {
		await writeFile(
			path.join(mockdataDir, filename),
			`${JSON.stringify(payload, null, 2)}\n`,
			'utf8'
		);
	}

	console.log(JSON.stringify(summarizeMockData(data), null, 2));
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
