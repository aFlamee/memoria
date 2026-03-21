import neo4j from 'neo4j-driver';

function flattenProperties(row) {
	const flattened = {};
	for (const [key, value] of Object.entries(row)) {
		if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
			flattened[key] = value;
			continue;
		}
		if (Array.isArray(value)) {
			flattened[key] = value;
			continue;
		}
		if (typeof value === 'object') {
			for (const [nestedKey, nestedValue] of Object.entries(value)) {
				flattened[`${key}_${nestedKey}`] = nestedValue;
			}
		}
	}
	return flattened;
}

async function waitForConnectivity(driver, attempts = 20, delayMs = 1500) {
	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		try {
			await driver.verifyConnectivity();
			return;
		} catch (error) {
			if (attempt === attempts) {
				throw error;
			}
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}
	}
}

export async function projectObserveGraphToNeo4j(data, env) {
	const password = env.NEO4J_PASSWORD;
	if (!password) {
		return { status: 'skipped', reason: 'NEO4J_PASSWORD is not configured locally' };
	}

	const username = env.NEO4J_USERNAME ?? 'neo4j';
	const boltPort = env.NEO4J_BOLT_PORT ?? '7687';
	const driver = neo4j.driver(`bolt://127.0.0.1:${boltPort}`, neo4j.auth.basic(username, password));
	const session = driver.session();

	try {
		await waitForConnectivity(driver);
		await session.run(
			'CREATE CONSTRAINT observegraph_instance_id IF NOT EXISTS FOR (n:Instance) REQUIRE n.instanceId IS UNIQUE'
		);
		await session.run(
			'CREATE CONSTRAINT observegraph_session_id IF NOT EXISTS FOR (n:Session) REQUIRE n.sessionId IS UNIQUE'
		);
		await session.run(
			'CREATE CONSTRAINT observegraph_task_id IF NOT EXISTS FOR (n:Task) REQUIRE n.taskId IS UNIQUE'
		);
		await session.run(
			'CREATE CONSTRAINT observegraph_action_id IF NOT EXISTS FOR (n:Action) REQUIRE n.actionId IS UNIQUE'
		);
		await session.run(
			'CREATE CONSTRAINT observegraph_template_id IF NOT EXISTS FOR (n:TaskTemplate) REQUIRE n.templateId IS UNIQUE'
		);
		await session.run(
			'CREATE CONSTRAINT observegraph_step_id IF NOT EXISTS FOR (n:StepNode) REQUIRE n.stepId IS UNIQUE'
		);
		await session.run('MATCH (n:ObserveGraph) DETACH DELETE n');

		await session.run(
			`UNWIND $rows AS row
			MERGE (n:ObserveGraph:Instance {instanceId: row.instanceId})
			SET n += row`,
			{ rows: data.instances.map(flattenProperties) }
		);
		await session.run(
			`UNWIND $rows AS row
			MERGE (n:ObserveGraph:Session {sessionId: row.sessionId})
			SET n += row`,
			{ rows: data.sessions }
		);
		await session.run(
			`UNWIND $rows AS row
			MERGE (n:ObserveGraph:Task {taskId: row.taskId})
			SET n += row`,
			{ rows: data.tasks }
		);
		await session.run(
			`UNWIND $rows AS row
			MERGE (n:ObserveGraph:Action {actionId: row.actionId})
			SET n += row`,
			{ rows: data.actions }
		);
		await session.run(
			`UNWIND $rows AS row
			MERGE (n:ObserveGraph:TaskTemplate {templateId: row.templateId})
			SET n += row`,
			{ rows: data.taskTemplates }
		);
		await session.run(
			`UNWIND $rows AS row
			MERGE (n:ObserveGraph:StepNode {stepId: row.stepId})
			SET n += row`,
			{ rows: data.stepNodes }
		);
		await session.run(
			`UNWIND $rows AS row
			MATCH (i:Instance {instanceId: row.instanceId})
			MATCH (s:Session {sessionId: row.sessionId})
			MERGE (i)-[:HAS_SESSION]->(s)`,
			{ rows: data.sessions }
		);
		await session.run(
			`UNWIND $rows AS row
			MATCH (s:Session {sessionId: row.sessionId})
			MATCH (t:Task {taskId: row.taskId})
			MERGE (s)-[:HAS_TASK]->(t)`,
			{ rows: data.tasks }
		);
		await session.run(
			`UNWIND $rows AS row
			MATCH (t:Task {taskId: row.taskId})
			MATCH (a:Action {actionId: row.actionId})
			MERGE (t)-[:PERFORMED {sequence: row.sequence, runId: row.runId}]->(a)`,
			{ rows: data.actions }
		);
		await session.run(
			`UNWIND $rows AS row
			MATCH (t:Task {taskId: row.taskId})
			MATCH (tmpl:TaskTemplate {templateId: row.templateId})
			MERGE (t)-[:RUN_OF {runId: row.runId}]->(tmpl)`,
			{ rows: data.tasks }
		);
		await session.run(
			`UNWIND $rows AS row
			MATCH (a:Action {actionId: row.actionId})
			MATCH (sn:StepNode {stepId: row.stepId})
			MERGE (a)-[:INSTANCE_OF {runId: row.runId, taskId: row.taskId}]->(sn)`,
			{ rows: data.actions }
		);
		await session.run(
			`UNWIND $rows AS row
			MATCH (s1:StepNode {stepId: row.fromStepId})
			MATCH (s2:StepNode {stepId: row.toStepId})
			MERGE (s1)-[rel:STEP_SEQUENCE {edgeId: row.edgeId}]->(s2)
			SET rel += row`,
			{ rows: data.stepEdges }
		);

		return {
			status: 'projected',
			counts: {
				instances: data.instances.length,
				sessions: data.sessions.length,
				tasks: data.tasks.length,
				actions: data.actions.length,
				taskTemplates: data.taskTemplates.length,
				stepNodes: data.stepNodes.length,
				stepEdges: data.stepEdges.length
			}
		};
	} finally {
		await session.close();
		await driver.close();
	}
}
